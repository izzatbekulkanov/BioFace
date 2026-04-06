#pragma once

#include "isup_server.hpp"

#include <string>


class PassiveTcpServer {
public:
    PassiveTcpServer(std::string name, uint16_t port);
    void start();

private:
    void run();
    void handle_client(socket_t client, const std::string& remote_ip, uint16_t remote_port);
    static bool looks_like_http(const std::string& payload);

    std::string name_;
    uint16_t port_;
};
