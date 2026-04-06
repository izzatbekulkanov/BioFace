#pragma once
// ============================================================
//  BioFace — ISUP Server
//  redis_bridge.hpp — Redis Pub/Sub command bridge
//
//  Flow:
//    Python publishes to  → bioface:cmd:{device_id}
//    C++ subscribes       → handles command, sends ISUP TCP
//    C++ publishes result → bioface:resp:{device_id}
//    Python reads         → await_response()
//
//  Uses raw RESP protocol over plain Winsock/POSIX sockets.
//  No external library dependency (no hiredis needed).
// ============================================================

#include "isup_server.hpp"
#include <string>
#include <thread>
#include <atomic>

class RedisBridge {
public:
    RedisBridge(DeviceRegistry& registry,
                const std::string& redis_host = "127.0.0.1",
                int redis_port = 6379);

    ~RedisBridge();

    void start();   // Starts background thread (non-blocking)
    void stop();

private:
    void run();                                          // subscriber loop
    bool connect_sub();                                  // connect & PSUBSCRIBE
    bool connect_pub();                                  // separate pub connection

    // RESP helpers
    bool resp_send(socket_t s, const std::string& raw);
    std::string resp_readline(socket_t s);
    std::string resp_read_bulk(socket_t s);
    bool resp_read_message(socket_t s,
                           std::string& type_out,
                           std::string& channel_out,
                           std::string& data_out);

    // Publish a response back to Python
    void publish_response(const std::string& device_id,
                          const std::string& json);

    // Build command from parsed JSON and forward via ISUP
    std::string dispatch_command(const std::string& device_id,
                                 const std::string& cmd_json);

    DeviceRegistry&    registry_;
    std::string        redis_host_;
    int                redis_port_;
    socket_t           sub_sock_;
    socket_t           pub_sock_;
    std::thread        thread_;
    std::atomic<bool>  running_;
};
