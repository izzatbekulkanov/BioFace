#pragma once
// ============================================================
//  BioFace — ISUP Server
//  http_api.hpp  —  Simple HTTP REST server for BioFace backend
//  Listens on port 7670, responds with JSON
// ============================================================

#include "isup_server.hpp"

class HttpApiServer {
public:
    HttpApiServer(uint16_t port, DeviceRegistry& registry);
    void start();  // blocking

private:
    void handle_client(socket_t sock);
    std::string build_device_json(const DeviceInfo& dev) const;
    std::string build_devices_json(const std::vector<DeviceInfo>& devs) const;
    std::string http_200(const std::string& body) const;
    std::string http_404() const;

    uint16_t        port_;
    DeviceRegistry& registry_;
};
