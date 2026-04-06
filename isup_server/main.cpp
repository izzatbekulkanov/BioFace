// ============================================================
//  BioFace - ISUP Server
//  main.cpp - Entry point
//  Usage:
//    isup_server.exe [isup_key] [isup_port] [api_port] [redis_host] [redis_port] [alarm_port] [picture_port]
//  Defaults:
//    key=bioface2024, isup=7660, api=7670, redis=127.0.0.1:6379, alarm=7661, picture=7662
// ============================================================

#include "http_api.hpp"
#include "isup_server.hpp"
#include "passive_tcp_server.hpp"
#include "redis_bridge.hpp"

#include <csignal>
#include <iostream>
#include <thread>

static volatile bool running = true;

void signal_handler(int) {
    running = false;
    std::exit(0);
}

int main(int argc, char* argv[]) {
    std::signal(SIGINT, signal_handler);
    std::signal(SIGTERM, signal_handler);

#ifdef _WIN32
    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        std::cerr << "[Main] WSAStartup failed\n";
        return 1;
    }
#endif

    std::string isup_key = (argc > 1) ? argv[1] : "bioface2024";
    uint16_t isup_port = (argc > 2) ? static_cast<uint16_t>(std::stoi(argv[2])) : 7660;
    uint16_t api_port = (argc > 3) ? static_cast<uint16_t>(std::stoi(argv[3])) : 7670;
    std::string redis_host = (argc > 4) ? argv[4] : "127.0.0.1";
    int redis_port = (argc > 5) ? std::stoi(argv[5]) : 6379;
    uint16_t alarm_port = (argc > 6) ? static_cast<uint16_t>(std::stoi(argv[6])) : 7661;
    uint16_t picture_port = (argc > 7) ? static_cast<uint16_t>(std::stoi(argv[7])) : 7662;

    std::cout << "============================================\n";
    std::cout << "  BioFace ISUP Server v2.1\n";
    std::cout << "  ISUP Key    : " << isup_key << "\n";
    std::cout << "  ISUP Port   : " << isup_port << " (TCP)\n";
    std::cout << "  Alarm Port  : " << alarm_port << " (TCP standby)\n";
    std::cout << "  Picture Port: " << picture_port << " (TCP standby)\n";
    std::cout << "  REST API    : http://localhost:" << api_port << "\n";
    std::cout << "  Redis       : " << redis_host << ":" << redis_port << "\n";
    std::cout << "============================================\n\n";

    DeviceRegistry registry;

    HttpApiServer http_server(api_port, registry);
    std::thread http_thread([&http_server]() {
        http_server.start();
    });
    http_thread.detach();

    PassiveTcpServer alarm_server("Alarm", alarm_port);
    alarm_server.start();

    PassiveTcpServer picture_server("Picture", picture_port);
    picture_server.start();

    RedisBridge redis_bridge(registry, redis_host, redis_port);
    redis_bridge.start();

    ISUPServer isup_server(isup_port, isup_key, registry);
    isup_server.start();

    redis_bridge.stop();

#ifdef _WIN32
    WSACleanup();
#endif
    return 0;
}
