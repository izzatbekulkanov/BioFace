// ============================================================
//  BioFace — ISUP Server
//  isup_server.cpp  —  TCP server, session, device registry
// ============================================================

#include "isup_server.hpp"

#include <iostream>
#include <thread>
#include <sstream>
#include <iomanip>
#include <cstring>
#include <algorithm>

// ── Simple SHA-256 (standalone, no OpenSSL dep) ─────────────
// Based on public domain SHA-256 implementation
static const uint32_t K[64] = {
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
};

static inline uint32_t rotr(uint32_t x, int n){ return (x >> n) | (x << (32-n)); }
static inline uint32_t ch(uint32_t e,uint32_t f,uint32_t g){ return (e&f)^(~e&g); }
static inline uint32_t maj(uint32_t a,uint32_t b,uint32_t c){ return (a&b)^(a&c)^(b&c); }
static inline uint32_t sig0(uint32_t a){ return rotr(a,2)^rotr(a,13)^rotr(a,22); }
static inline uint32_t sig1(uint32_t e){ return rotr(e,6)^rotr(e,11)^rotr(e,25); }
static inline uint32_t gam0(uint32_t x){ return rotr(x,7)^rotr(x,18)^(x>>3); }
static inline uint32_t gam1(uint32_t x){ return rotr(x,17)^rotr(x,19)^(x>>10); }

std::string ISUPSession::sha256_hex(const std::string& data) {
    uint32_t h[8] = {
        0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
        0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19
    };
    std::vector<uint8_t> msg(data.begin(), data.end());
    uint64_t bit_len = msg.size() * 8;
    msg.push_back(0x80);
    while (msg.size() % 64 != 56) msg.push_back(0x00);
    for (int i = 7; i >= 0; --i) msg.push_back((bit_len >> (i*8)) & 0xff);

    for (size_t i = 0; i < msg.size(); i += 64) {
        uint32_t w[64];
        for (int j = 0; j < 16; ++j)
            w[j] = (msg[i+j*4]<<24)|(msg[i+j*4+1]<<16)|(msg[i+j*4+2]<<8)|msg[i+j*4+3];
        for (int j = 16; j < 64; ++j)
            w[j] = gam1(w[j-2]) + w[j-7] + gam0(w[j-15]) + w[j-16];
        uint32_t a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],hh=h[7];
        for (int j = 0; j < 64; ++j) {
            uint32_t t1 = hh + sig1(e) + ch(e,f,g) + K[j] + w[j];
            uint32_t t2 = sig0(a) + maj(a,b,c);
            hh=g; g=f; f=e; e=d+t1; d=c; c=b; b=a; a=t1+t2;
        }
        h[0]+=a; h[1]+=b; h[2]+=c; h[3]+=d;
        h[4]+=e; h[5]+=f; h[6]+=g; h[7]+=hh;
    }
    std::ostringstream oss;
    for (int i = 0; i < 8; ++i)
        oss << std::hex << std::setw(8) << std::setfill('0') << h[i];
    return oss.str();
}

// ─────────────────────────────────────────────────────────────
//  DeviceRegistry
// ─────────────────────────────────────────────────────────────
void DeviceRegistry::add(const DeviceInfo& dev) {
    std::lock_guard<std::mutex> lk(mtx_);
    devices_[dev.device_id] = dev;
    std::cout << "[Registry] Device registered: " << dev.device_id
              << " from " << dev.ip << ":" << dev.port << "\n";
}

void DeviceRegistry::remove(const std::string& device_id) {
    std::lock_guard<std::mutex> lk(mtx_);
    auto it = devices_.find(device_id);
    if (it != devices_.end()) {
        it->second.online = false;
        it->second.sock   = INVALID_SOCKET;
        std::cout << "[Registry] Device offline: " << device_id << "\n";
    }
}

void DeviceRegistry::update_heartbeat(const std::string& device_id) {
    std::lock_guard<std::mutex> lk(mtx_);
    auto it = devices_.find(device_id);
    if (it != devices_.end())
        it->second.last_seen = std::time(nullptr);
}

bool DeviceRegistry::exists(const std::string& device_id) const {
    std::lock_guard<std::mutex> lk(mtx_);
    return devices_.count(device_id) > 0;
}

DeviceInfo DeviceRegistry::get(const std::string& device_id) const {
    std::lock_guard<std::mutex> lk(mtx_);
    return devices_.at(device_id);
}

std::vector<DeviceInfo> DeviceRegistry::all() const {
    std::lock_guard<std::mutex> lk(mtx_);
    std::vector<DeviceInfo> result;
    result.reserve(devices_.size());
    for (const auto& p : devices_) result.push_back(p.second);
    return result;
}

size_t DeviceRegistry::count() const {
    std::lock_guard<std::mutex> lk(mtx_);
    return devices_.size();
}

// ─────────────────────────────────────────────────────────────
//  ISUPSession  helpers
// ─────────────────────────────────────────────────────────────
ISUPSession::ISUPSession(socket_t sock, const std::string& remote_ip,
                         uint16_t remote_port, DeviceRegistry& registry,
                         const std::string& isup_key)
    : sock_(sock), remote_ip_(remote_ip), remote_port_(remote_port),
      registry_(registry), isup_key_(isup_key),
      registered_(false), seq_(0) {}

bool ISUPSession::recv_packet(ISUPHeader& hdr, std::vector<uint8_t>& payload) {
    // Receive fixed 14-byte header
    uint8_t raw[14];
    int total = 0;
    while (total < 14) {
        int n = recv(sock_, reinterpret_cast<char*>(raw + total), 14 - total, 0);
        if (n <= 0) return false;
        total += n;
    }
    // Parse big-endian header
    hdr.magic       = (raw[0]<<24)|(raw[1]<<16)|(raw[2]<<8)|raw[3];
    hdr.version     = (raw[4]<<8)|raw[5];
    hdr.msg_type    = raw[6];
    hdr.encrypt_type= raw[7];
    hdr.seq         = (raw[8]<<24)|(raw[9]<<16)|(raw[10]<<8)|raw[11];
    hdr.payload_len = (raw[12]<<24)|(raw[13]<<16); // only 2 bytes used in practice
    // Some ISUP versions use 4-byte payload_len, we read all 4
    uint8_t plen_raw[2];
    int pn = recv(sock_, reinterpret_cast<char*>(plen_raw), 2, 0);
    if (pn < 2) {
        // Already read 2 bytes in header raw[12..13]; correct calculation:
        hdr.payload_len = (raw[12]<<8)|raw[13]; // reinterpret
    } else {
        hdr.payload_len = ((uint32_t)(raw[12]<<8)|raw[13]) << 16 | (plen_raw[0]<<8)|plen_raw[1];
    }

    if (hdr.magic != ISUP_MAGIC) {
        std::cerr << "[Session] Invalid magic from " << remote_ip_ << "\n";
        return false;
    }
    if (hdr.payload_len == 0) { payload.clear(); return true; }
    if (hdr.payload_len > 65536) { // sanity check
        std::cerr << "[Session] Payload too large: " << hdr.payload_len << "\n";
        return false;
    }
    payload.resize(hdr.payload_len);
    total = 0;
    while (total < (int)hdr.payload_len) {
        int n = recv(sock_, reinterpret_cast<char*>(payload.data() + total),
                     hdr.payload_len - total, 0);
        if (n <= 0) return false;
        total += n;
    }
    return true;
}

void ISUPSession::send_packet(uint8_t msg_type, const std::vector<uint8_t>& payload) {
    uint32_t plen = static_cast<uint32_t>(payload.size());
    // Build 14-byte header
    uint8_t hdr[14];
    hdr[0] = 0x20; hdr[1] = 0x15; hdr[2] = 0x01; hdr[3] = 0x01; // magic
    hdr[4] = 0x05; hdr[5] = 0x00;       // version 5.0
    hdr[6] = msg_type;
    hdr[7] = 0x00;                       // no encryption
    hdr[8] = (seq_>>24)&0xff; hdr[9] = (seq_>>16)&0xff;
    hdr[10]= (seq_>>8)&0xff;  hdr[11]=  seq_&0xff;
    hdr[12]= (plen>>8)&0xff;  hdr[13]=  plen&0xff;
    seq_++;
    send(sock_, reinterpret_cast<char*>(hdr), 14, 0);
    if (plen > 0)
        send(sock_, reinterpret_cast<const char*>(payload.data()), plen, 0);
}

// ─────────────────────────────────────────────────────────────
//  Handle Register Request
//  Payload format (simplified JSON-like or raw string):
//  {"deviceId":"DS-xxxx","model":"DS-2CD","firmware":"V5.x"}
// ─────────────────────────────────────────────────────────────
static std::string json_get(const std::string& json, const std::string& key) {
    std::string pattern = "\"" + key + "\":\"";
    auto pos = json.find(pattern);
    if (pos == std::string::npos) return "";
    pos += pattern.size();
    auto end = json.find("\"", pos);
    if (end == std::string::npos) return "";
    return json.substr(pos, end - pos);
}

bool ISUPSession::handle_register(const ISUPHeader& hdr,
                                  const std::vector<uint8_t>& payload) {
    std::string json_str(payload.begin(), payload.end());
    std::cout << "[Session] Register payload: " << json_str << "\n";

    device_id_ = json_get(json_str, "deviceId");
    if (device_id_.empty()) device_id_ = json_get(json_str, "device_id");
    if (device_id_.empty()) {
        std::cerr << "[Session] Missing deviceId in registration\n";
        return false;
    }

    std::string token = json_get(json_str, "token");
    // Verify: expected = sha256(device_id + isup_key)
    std::string expected = sha256_hex(device_id_ + isup_key_);
    if (!token.empty() && token != expected) {
        std::cerr << "[Session] Auth FAILED for " << device_id_
                  << " (token mismatch)\n";
        // Send ack with error code 401
        std::string err = "{\"result\":401,\"msg\":\"Unauthorized\"}";
        std::vector<uint8_t> ep(err.begin(), err.end());
        send_packet(MSG_REGISTER_ACK, ep);
        return false;
    }

    DeviceInfo dev;
    dev.device_id    = device_id_;
    dev.ip           = remote_ip_;
    dev.port         = remote_port_;
    dev.model        = json_get(json_str, "model");
    dev.firmware     = json_get(json_str, "firmware");
    dev.isup_version = json_get(json_str, "isupVersion");
    dev.registered_at= std::time(nullptr);
    dev.last_seen    = std::time(nullptr);
    dev.online       = true;
    dev.sock         = sock_;
    registry_.add(dev);
    registered_ = true;

    // Send success ACK
    std::string ack =
        "{\"result\":200,\"msg\":\"OK\",\"server\":\"BioFace-ISUP\",\"deviceId\":\""
        + device_id_ + "\"}";
    std::vector<uint8_t> ap(ack.begin(), ack.end());
    send_packet(MSG_REGISTER_ACK, ap);
    std::cout << "[Session] Device " << device_id_ << " registered OK\n";
    return true;
}

void ISUPSession::handle_heartbeat(const ISUPHeader&) {
    if (!device_id_.empty())
        registry_.update_heartbeat(device_id_);
    // Reply with empty heartbeat ACK
    send_packet(MSG_HEARTBEAT_ACK, {});
}

void ISUPSession::handle_unregister() {
    if (!device_id_.empty()) {
        registry_.remove(device_id_);
        std::cout << "[Session] Device " << device_id_ << " unregistered\n";
    }
}

// ─────────────────────────────────────────────────────────────
//  Session main loop
// ─────────────────────────────────────────────────────────────
void ISUPSession::run() {
    std::cout << "[Session] New connection from "
              << remote_ip_ << ":" << remote_port_ << "\n";
    ISUPHeader hdr;
    std::vector<uint8_t> payload;
    while (recv_packet(hdr, payload)) {
        switch (hdr.msg_type) {
            case MSG_REGISTER_REQ:
                if (!handle_register(hdr, payload)) goto done;
                break;
            case MSG_HEARTBEAT_REQ:
                handle_heartbeat(hdr);
                break;
            case MSG_UNREGISTER:
                handle_unregister();
                goto done;
            default:
                std::cerr << "[Session] Unknown msg_type: "
                          << (int)hdr.msg_type << "\n";
                break;
        }
    }
done:
    if (registered_) registry_.remove(device_id_);
    closesocket(sock_);
    std::cout << "[Session] Connection closed: " << remote_ip_ << "\n";
}

// ─────────────────────────────────────────────────────────────
//  ISUPServer — TCP accept loop
// ─────────────────────────────────────────────────────────────
ISUPServer::ISUPServer(uint16_t tcp_port, const std::string& isup_key,
                       DeviceRegistry& registry)
    : tcp_port_(tcp_port), isup_key_(isup_key), registry_(registry) {}

void ISUPServer::start() {
#ifdef _WIN32
    WSADATA wsa;
    WSAStartup(MAKEWORD(2,2), &wsa);
#endif
    socket_t server_sock = socket(AF_INET, SOCK_STREAM, 0);
    if (server_sock == INVALID_SOCKET) {
        std::cerr << "[ISUPServer] Failed to create socket\n";
        return;
    }
    int opt = 1;
    setsockopt(server_sock, SOL_SOCKET, SO_REUSEADDR,
               reinterpret_cast<char*>(&opt), sizeof(opt));

    sockaddr_in addr{};
    addr.sin_family      = AF_INET;
    addr.sin_port        = htons(tcp_port_);
    addr.sin_addr.s_addr = INADDR_ANY;

    if (bind(server_sock, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) == SOCKET_ERROR) {
        std::cerr << "[ISUPServer] Bind failed on port " << tcp_port_ << "\n";
        closesocket(server_sock);
        return;
    }
    listen(server_sock, 64);
    std::cout << "[ISUPServer] Listening on TCP port " << tcp_port_ << "...\n";

    while (true) {
        sockaddr_in client_addr{};
        socklen_t clen = sizeof(client_addr);
        socket_t client = accept(server_sock,
                                 reinterpret_cast<sockaddr*>(&client_addr), &clen);
        if (client == INVALID_SOCKET) continue;

        char ip_buf[INET_ADDRSTRLEN];
        inet_ntop(AF_INET, &client_addr.sin_addr, ip_buf, sizeof(ip_buf));
        std::string remote_ip(ip_buf);
        uint16_t remote_port = ntohs(client_addr.sin_port);

        // Detach session to its own thread
        std::thread([client, remote_ip, remote_port, this]() mutable {
            ISUPSession session(client, remote_ip, remote_port,
                                registry_, isup_key_);
            session.run();
        }).detach();
    }
    closesocket(server_sock);
}
