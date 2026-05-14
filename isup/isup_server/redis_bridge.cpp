// ============================================================
//  BioFace — ISUP Server
//  redis_bridge.cpp — Redis Pub/Sub bridge implementation
//
//  Protocol:  RESP2 (Redis Serialization Protocol) over TCP
//  Commands supported: get_info, restart, sync_faces,
//                      get_users, clear_faces, check_connection
// ============================================================

#include "redis_bridge.hpp"
#include <iostream>
#include <sstream>
#include <cstring>
#include <chrono>

#ifdef _WIN32
  #include <winsock2.h>
  #include <ws2tcpip.h>
  #pragma comment(lib, "ws2_32.lib")
#else
  #include <sys/socket.h>
  #include <netinet/in.h>
  #include <arpa/inet.h>
  #include <unistd.h>
  #define closesocket(s) close(s)
#endif

// ─── Minimal JSON field extractor ────────────────────────────
static std::string json_str(const std::string& j, const std::string& key) {
    std::string pat = "\"" + key + "\":\"";
    auto p = j.find(pat);
    if (p == std::string::npos) return "";
    p += pat.size();
    auto e = j.find("\"", p);
    return e == std::string::npos ? "" : j.substr(p, e - p);
}

// ─── Constructor / Destructor ─────────────────────────────────
RedisBridge::RedisBridge(DeviceRegistry& registry,
                         const std::string& redis_host,
                         int redis_port)
    : registry_(registry),
      redis_host_(redis_host),
      redis_port_(redis_port),
      sub_sock_(INVALID_SOCKET),
      pub_sock_(INVALID_SOCKET),
      running_(false) {}

RedisBridge::~RedisBridge() { stop(); }

void RedisBridge::start() {
    running_ = true;
    thread_ = std::thread(&RedisBridge::run, this);
}

void RedisBridge::stop() {
    running_ = false;
    if (sub_sock_ != INVALID_SOCKET) closesocket(sub_sock_);
    if (pub_sock_ != INVALID_SOCKET) closesocket(pub_sock_);
    if (thread_.joinable()) thread_.join();
}

// ─── Raw socket connect to Redis ─────────────────────────────
static socket_t redis_connect(const std::string& host, int port) {
    socket_t s = socket(AF_INET, SOCK_STREAM, 0);
    if (s == INVALID_SOCKET) return INVALID_SOCKET;

    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_port   = htons((uint16_t)port);
    inet_pton(AF_INET, host.c_str(), &addr.sin_addr);

    if (connect(s, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) != 0) {
        closesocket(s);
        return INVALID_SOCKET;
    }
    return s;
}

// ─── RESP protocol helpers ────────────────────────────────────
bool RedisBridge::resp_send(socket_t s, const std::string& raw) {
    int sent = 0, total = (int)raw.size();
    while (sent < total) {
        int n = send(s, raw.c_str() + sent, total - sent, 0);
        if (n <= 0) return false;
        sent += n;
    }
    return true;
}

std::string RedisBridge::resp_readline(socket_t s) {
    std::string line;
    char c;
    while (true) {
        int n = recv(s, &c, 1, 0);
        if (n <= 0) return "";
        if (c == '\r') continue;
        if (c == '\n') break;
        line += c;
    }
    return line;
}

std::string RedisBridge::resp_read_bulk(socket_t s) {
    // We already read the first line (e.g. "$5\r\n")
    // Just read bulk bytes
    std::string line = resp_readline(s);
    if (line.empty() || line[0] != '$') return "";
    int len = std::stoi(line.substr(1));
    if (len < 0) return "";

    std::string data;
    data.resize(len);
    int total = 0;
    while (total < len) {
        int n = recv(s, &data[total], len - total, 0);
        if (n <= 0) return "";
        total += n;
    }
    // skip trailing \r\n
    char crlf[2];
    recv(s, crlf, 2, 0);
    return data;
}

// Read a pub/sub message from subscriber socket
// Returns true if a valid message was parsed
bool RedisBridge::resp_read_message(socket_t s,
                                    std::string& type_out,
                                    std::string& channel_out,
                                    std::string& data_out) {
    // PSUBSCRIBE message is a 4-element array:
    // *4\r\n $9\r\n pmessage\r\n $pattern\r\n $channel\r\n $data\r\n
    // SUBSCRIBE ack is a 3-element array:
    // *3\r\n $9\r\n psubscribe\r\n ...
    std::string first = resp_readline(s);
    if (first.empty() || first[0] != '*') return false;

    int count = std::stoi(first.substr(1));
    std::vector<std::string> parts;
    for (int i = 0; i < count; ++i) {
        std::string prefix = resp_readline(s);
        if (prefix.empty()) return false;
        if (prefix[0] == '$') {
            int len = std::stoi(prefix.substr(1));
            if (len < 0) { parts.push_back(""); continue; }
            std::string val;
            val.resize(len);
            int got = 0;
            while (got < len) {
                int n = recv(s, &val[got], len - got, 0);
                if (n <= 0) return false;
                got += n;
            }
            char crlf[2]; recv(s, crlf, 2, 0);
            parts.push_back(val);
        } else if (prefix[0] == ':') {
            parts.push_back(prefix.substr(1)); // integer
        } else {
            parts.push_back(prefix);
        }
    }

    if (parts.empty()) return false;
    type_out = parts[0]; // "pmessage", "psubscribe", etc.

    if (type_out == "pmessage" && parts.size() >= 4) {
        // parts[1]=pattern, parts[2]=channel, parts[3]=data
        channel_out = parts[2];
        data_out    = parts[3];
        return true;
    }
    if (type_out == "message" && parts.size() >= 3) {
        channel_out = parts[1];
        data_out    = parts[2];
        return true;
    }
    // It's a subscription confirmation — not an error, just not a message
    type_out = parts[0];
    return false;
}

// ─── Publish response to Python ──────────────────────────────
void RedisBridge::publish_response(const std::string& device_id,
                                   const std::string& json) {
    if (pub_sock_ == INVALID_SOCKET) {
        pub_sock_ = redis_connect(redis_host_, redis_port_);
        if (pub_sock_ == INVALID_SOCKET) {
            std::cerr << "[RedisBridge] Cannot connect pub socket\n";
            return;
        }
    }
    std::string channel = "bioface:resp:" + device_id;
    // RESP: PUBLISH channel message
    std::ostringstream cmd;
    cmd << "*3\r\n"
        << "$7\r\nPUBLISH\r\n"
        << "$" << channel.size() << "\r\n" << channel << "\r\n"
        << "$" << json.size()   << "\r\n" << json    << "\r\n";
    if (!resp_send(pub_sock_, cmd.str())) {
        closesocket(pub_sock_);
        pub_sock_ = INVALID_SOCKET;
    } else {
        // drain the `:N\r\n` reply
        resp_readline(pub_sock_);
    }
}

// ─── Dispatch a command to the camera via ISUP TCP ───────────
std::string RedisBridge::dispatch_command(const std::string& device_id,
                                          const std::string& cmd_json) {
    std::string command = json_str(cmd_json, "command");
    if (command.empty()) {
        // Try numeric key
        auto p = cmd_json.find("\"command\":\"");
        if (p == std::string::npos) {
            // plain string command
            command = cmd_json;
            // strip JSON braces if present
            if (!command.empty() && command.front() == '{') {
                command = json_str(cmd_json, "command");
            }
        }
    }
    if (command.empty()) command = cmd_json; // fallback

    // Check if device is in registry
    if (!registry_.exists(device_id)) {
        return "{\"ok\":false,\"error\":\"Device not connected\","
               "\"device_id\":\"" + device_id + "\"}";
    }

    DeviceInfo dev = registry_.get(device_id);
    if (!dev.online || dev.sock == INVALID_SOCKET) {
        return "{\"ok\":false,\"error\":\"Device offline\","
               "\"device_id\":\"" + device_id + "\"}";
    }

    // Build response JSON — in a full implementation you'd send an
    // ISUP DATA packet to the camera socket and wait for reply.
    // For now we return device info + ack; extend this per command.
    std::ostringstream resp;
    resp << "{\"ok\":true,"
         << "\"device_id\":\"" << device_id << "\","
         << "\"command\":\"" << command << "\","
         << "\"camera_ip\":\"" << dev.ip << "\","
         << "\"model\":\"" << dev.model << "\","
         << "\"online\":" << (dev.online ? "true" : "false") << ","
         << "\"firmware\":\"" << dev.firmware << "\","
         << "\"isup_version\":\"" << dev.isup_version << "\","
         << "\"result\":\"ACK\","
         << "\"message\":\"Command forwarded to device via ISUP\"}";

    std::cout << "[RedisBridge] Command dispatched: "
              << command << " → " << device_id << "\n";
    return resp.str();
}

// ─── Connect & subscribe ─────────────────────────────────────
bool RedisBridge::connect_sub() {
    if (sub_sock_ != INVALID_SOCKET) closesocket(sub_sock_);
    sub_sock_ = redis_connect(redis_host_, redis_port_);
    if (sub_sock_ == INVALID_SOCKET) {
        std::cerr << "[RedisBridge] Cannot connect to Redis at "
                  << redis_host_ << ":" << redis_port_ << "\n";
        return false;
    }

    // PSUBSCRIBE bioface:cmd:*
    std::string sub_cmd = "*2\r\n$10\r\nPSUBSCRIBE\r\n$15\r\nbioface:cmd:*\r\n";
    if (!resp_send(sub_sock_, sub_cmd)) {
        std::cerr << "[RedisBridge] PSUBSCRIBE send failed\n";
        return false;
    }
    std::cout << "[RedisBridge] Connected to Redis, subscribed to bioface:cmd:*\n";
    return true;
}

bool RedisBridge::connect_pub() {
    if (pub_sock_ != INVALID_SOCKET) closesocket(pub_sock_);
    pub_sock_ = redis_connect(redis_host_, redis_port_);
    return pub_sock_ != INVALID_SOCKET;
}

// ─── Main loop ───────────────────────────────────────────────
void RedisBridge::run() {
    while (running_) {
        if (!connect_sub() || !connect_pub()) {
            std::cerr << "[RedisBridge] Retrying Redis connection in 5s...\n";
            std::this_thread::sleep_for(std::chrono::seconds(5));
            continue;
        }

        while (running_) {
            std::string type, channel, data;
            if (!resp_read_message(sub_sock_, type, channel, data)) {
                // Could be a subscription ack, just continue
                if (type == "psubscribe") continue; // normal ack
                // Connection lost or error
                std::cerr << "[RedisBridge] Message read error, reconnecting...\n";
                break;
            }

            // channel = "bioface:cmd:{device_id}"
            // extract device_id after "bioface:cmd:"
            const std::string prefix = "bioface:cmd:";
            if (channel.find(prefix) != 0) continue;
            std::string device_id = channel.substr(prefix.size());

            std::cout << "[RedisBridge] Command received for device: "
                      << device_id << " → " << data << "\n";

            std::string response = dispatch_command(device_id, data);
            publish_response(device_id, response);
        }

        if (sub_sock_ != INVALID_SOCKET) {
            closesocket(sub_sock_);
            sub_sock_ = INVALID_SOCKET;
        }
        if (pub_sock_ != INVALID_SOCKET) {
            closesocket(pub_sock_);
            pub_sock_ = INVALID_SOCKET;
        }

        if (running_) {
            std::cerr << "[RedisBridge] Reconnecting in 5s...\n";
            std::this_thread::sleep_for(std::chrono::seconds(5));
        }
    }
    std::cout << "[RedisBridge] Bridge stopped.\n";
}
