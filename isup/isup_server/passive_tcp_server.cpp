#include "passive_tcp_server.hpp"

#include <cstring>
#include <iostream>
#include <thread>
#include <utility>

#ifdef _WIN32
static void set_recv_timeout(socket_t sock, int milliseconds) {
    DWORD timeout = static_cast<DWORD>(milliseconds);
    setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&timeout), sizeof(timeout));
}
#else
#include <sys/time.h>

static void set_recv_timeout(socket_t sock, int milliseconds) {
    timeval timeout{};
    timeout.tv_sec = milliseconds / 1000;
    timeout.tv_usec = (milliseconds % 1000) * 1000;
    setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));
}
#endif


PassiveTcpServer::PassiveTcpServer(std::string name, uint16_t port)
    : name_(std::move(name)), port_(port) {}


void PassiveTcpServer::start() {
    std::thread([this]() {
        run();
    }).detach();
}


bool PassiveTcpServer::looks_like_http(const std::string& payload) {
    return payload.rfind("GET ", 0) == 0
        || payload.rfind("POST ", 0) == 0
        || payload.rfind("PUT ", 0) == 0
        || payload.rfind("DELETE ", 0) == 0
        || payload.rfind("HEAD ", 0) == 0
        || payload.rfind("OPTIONS ", 0) == 0;
}


void PassiveTcpServer::handle_client(socket_t client, const std::string& remote_ip, uint16_t remote_port) {
    set_recv_timeout(client, 1500);

    char buffer[4096];
    int received = recv(client, buffer, sizeof(buffer), 0);
    if (received > 0) {
        std::string payload(buffer, buffer + received);
        std::cout << "[" << name_ << "] Connection from " << remote_ip << ":" << remote_port
                  << ", bytes=" << received << "\n";

        if (looks_like_http(payload)) {
            static const char response[] =
                "HTTP/1.1 200 OK\r\n"
                "Content-Type: application/json\r\n"
                "Connection: close\r\n"
                "Content-Length: 15\r\n"
                "\r\n"
                "{\"result\":\"ok\"}";
            send(client, response, static_cast<int>(sizeof(response) - 1), 0);
        }
    }

    closesocket(client);
}


void PassiveTcpServer::run() {
    socket_t server_sock = socket(AF_INET, SOCK_STREAM, 0);
    if (server_sock == INVALID_SOCKET) {
        std::cerr << "[" << name_ << "] Failed to create socket\n";
        return;
    }

    int opt = 1;
    setsockopt(server_sock, SOL_SOCKET, SO_REUSEADDR,
               reinterpret_cast<char*>(&opt), sizeof(opt));

    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(port_);
    addr.sin_addr.s_addr = INADDR_ANY;

    if (bind(server_sock, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) == SOCKET_ERROR) {
        std::cerr << "[" << name_ << "] Bind failed on port " << port_ << "\n";
        closesocket(server_sock);
        return;
    }

    if (listen(server_sock, 32) == SOCKET_ERROR) {
        std::cerr << "[" << name_ << "] Listen failed on port " << port_ << "\n";
        closesocket(server_sock);
        return;
    }

    std::cout << "[" << name_ << "] Standby listener running on TCP port " << port_ << "...\n";

    while (true) {
        sockaddr_in client_addr{};
        socklen_t client_len = sizeof(client_addr);
        socket_t client = accept(server_sock, reinterpret_cast<sockaddr*>(&client_addr), &client_len);
        if (client == INVALID_SOCKET) {
            continue;
        }

        char ip_buf[INET_ADDRSTRLEN];
        std::memset(ip_buf, 0, sizeof(ip_buf));
        inet_ntop(AF_INET, &client_addr.sin_addr, ip_buf, sizeof(ip_buf));
        const std::string remote_ip = ip_buf;
        const uint16_t remote_port = ntohs(client_addr.sin_port);

        std::thread([this, client, remote_ip, remote_port]() {
            handle_client(client, remote_ip, remote_port);
        }).detach();
    }
}
