// ============================================================
//  BioFace — ISUP Server
//  http_api.cpp  —  Minimal HTTP/1.1 REST server (port 7670)
//  Endpoints:
//    GET /devices              → all registered devices (JSON)
//    GET /devices/{device_id}  → single device (JSON)
//    DELETE /devices/{id}      → mark device offline
//    GET /health               → {"status":"ok"}
// ============================================================

#include "http_api.hpp"
#include <iostream>
#include <sstream>
#include <cstring>
#include <ctime>
#include <thread>

// ─── HTTP helpers ─────────────────────────────────────────────
static std::string recv_request(socket_t sock) {
    std::string req;
    char buf[4096];
    int n = recv(sock, buf, sizeof(buf)-1, 0);
    if (n > 0) { buf[n] = '\0'; req = buf; }
    return req;
}

static std::string parse_path(const std::string& req) {
    // GET /path HTTP/1.1
    auto sp1 = req.find(' ');
    auto sp2 = req.find(' ', sp1+1);
    if (sp1 == std::string::npos || sp2 == std::string::npos) return "/";
    return req.substr(sp1+1, sp2-sp1-1);
}

static std::string parse_method(const std::string& req) {
    auto sp = req.find(' ');
    if (sp == std::string::npos) return "GET";
    return req.substr(0, sp);
}

// ─── JSON builders ────────────────────────────────────────────
std::string HttpApiServer::build_device_json(const DeviceInfo& d) const {
    std::ostringstream o;
    char t1[32], t2[32];
    std::strftime(t1, sizeof(t1), "%Y-%m-%dT%H:%M:%SZ", std::gmtime(&d.registered_at));
    std::strftime(t2, sizeof(t2), "%Y-%m-%dT%H:%M:%SZ", std::gmtime(&d.last_seen));
    o << "{"
      << "\"device_id\":\""    << d.device_id    << "\","
      << "\"ip\":\""           << d.ip           << "\","
      << "\"port\":"           << d.port         << ","
      << "\"model\":\""        << d.model        << "\","
      << "\"firmware\":\""     << d.firmware     << "\","
      << "\"isup_version\":\"" << d.isup_version << "\","
      << "\"online\":"         << (d.online ? "true" : "false") << ","
      << "\"registered_at\":\"" << t1 << "\","
      << "\"last_seen\":\""     << t2 << "\","
      << "\"rtsp_url\":\"rtsp://" << d.ip << ":554/Streaming/Channels/101\""
      << "}";
    return o.str();
}

std::string HttpApiServer::build_devices_json(const std::vector<DeviceInfo>& devs) const {
    std::ostringstream o;
    o << "[";
    for (size_t i = 0; i < devs.size(); ++i) {
        if (i > 0) o << ",";
        o << build_device_json(devs[i]);
    }
    o << "]";
    return o.str();
}

std::string HttpApiServer::http_200(const std::string& body) const {
    std::ostringstream r;
    r << "HTTP/1.1 200 OK\r\n"
      << "Content-Type: application/json\r\n"
      << "Access-Control-Allow-Origin: *\r\n"
      << "Content-Length: " << body.size() << "\r\n"
      << "Connection: close\r\n\r\n"
      << body;
    return r.str();
}

std::string HttpApiServer::http_404() const {
    std::string body = "{\"error\":\"Not Found\"}";
    std::ostringstream r;
    r << "HTTP/1.1 404 Not Found\r\n"
      << "Content-Type: application/json\r\n"
      << "Access-Control-Allow-Origin: *\r\n"
      << "Content-Length: " << body.size() << "\r\n"
      << "Connection: close\r\n\r\n"
      << body;
    return r.str();
}

// ─── Request handler ─────────────────────────────────────────
void HttpApiServer::handle_client(socket_t sock) {
    std::string req  = recv_request(sock);
    std::string path = parse_path(req);
    std::string method = parse_method(req);
    std::string response;

    if (path == "/health") {
        response = http_200("{\"status\":\"ok\",\"devices\":"
                            + std::to_string(registry_.count()) + "}");
    }
    else if (path == "/devices") {
        if (method == "GET") {
            auto devs = registry_.all();
            response = http_200(build_devices_json(devs));
        } else {
            response = http_404();
        }
    }
    else if (path.rfind("/devices/", 0) == 0) {
        std::string dev_id = path.substr(9); // after "/devices/"
        if (method == "GET") {
            if (registry_.exists(dev_id)) {
                auto dev = registry_.get(dev_id);
                response = http_200(build_device_json(dev));
            } else {
                response = http_404();
            }
        } else if (method == "DELETE") {
            registry_.remove(dev_id);
            response = http_200("{\"result\":\"ok\",\"action\":\"disconnected\"}");
        } else {
            response = http_404();
        }
    }
    else {
        response = http_404();
    }

    send(sock, response.c_str(), (int)response.size(), 0);
    closesocket(sock);
}

// ─── Accept loop ─────────────────────────────────────────────
HttpApiServer::HttpApiServer(uint16_t port, DeviceRegistry& registry)
    : port_(port), registry_(registry) {}

void HttpApiServer::start() {
    socket_t srv = socket(AF_INET, SOCK_STREAM, 0);
    if (srv == INVALID_SOCKET) {
        std::cerr << "[HttpAPI] Failed to create socket\n";
        return;
    }
    int opt = 1;
    setsockopt(srv, SOL_SOCKET, SO_REUSEADDR,
               reinterpret_cast<char*>(&opt), sizeof(opt));

    sockaddr_in addr{};
    addr.sin_family      = AF_INET;
    addr.sin_port        = htons(port_);
    addr.sin_addr.s_addr = INADDR_ANY;
    if (bind(srv, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) == SOCKET_ERROR) {
        std::cerr << "[HttpAPI] Bind failed on port " << port_ << "\n";
        closesocket(srv);
        return;
    }
    if (listen(srv, 32) == SOCKET_ERROR) {
        std::cerr << "[HttpAPI] Listen failed on port " << port_ << "\n";
        closesocket(srv);
        return;
    }

    std::cout << "[HttpAPI] REST API running on http://localhost:" << port_ << "\n";
    std::cout << "[HttpAPI] Endpoints:\n"
              << "  GET  /devices           — all cameras\n"
              << "  GET  /devices/{id}      — single camera\n"
              << "  DELETE /devices/{id}    — disconnect camera\n"
              << "  GET  /health            — server health\n";

    while (true) {
        sockaddr_in cli{};
        socklen_t clen = sizeof(cli);
        socket_t client = accept(srv, reinterpret_cast<sockaddr*>(&cli), &clen);
        if (client == INVALID_SOCKET) continue;
        std::thread([client, this]() mutable {
            handle_client(client);
        }).detach();
    }
    closesocket(srv);
}
