#pragma once
// ============================================================
//  BioFace — ISUP Server
//  isup_server.hpp  —  Structs, Registry, Session declarations
//  Protocol: Hikvision ISUP 5.0 (TCP port 7660)
// ============================================================

#include <string>
#include <unordered_map>
#include <mutex>
#include <vector>
#include <ctime>
#include <cstdint>
#include <functional>

#ifdef _WIN32
  #include <winsock2.h>
  #include <ws2tcpip.h>
  #pragma comment(lib, "ws2_32.lib")
  typedef SOCKET socket_t;
#else
  #include <sys/socket.h>
  #include <netinet/in.h>
  #include <arpa/inet.h>
  #include <unistd.h>
  typedef int socket_t;
  #define INVALID_SOCKET (-1)
  #define SOCKET_ERROR   (-1)
  #define closesocket(s) close(s)
#endif

// ─────────────────────────────────────────────────────────────
//  ISUP Packet Header  (14 bytes, big-endian)
// ─────────────────────────────────────────────────────────────
#pragma pack(push, 1)
struct ISUPHeader {
    uint32_t magic;          // 0x20150101
    uint16_t version;        // 0x0500 = ISUP 5.0
    uint8_t  msg_type;       // Message type
    uint8_t  encrypt_type;   // 0 = none, 1 = AES128
    uint32_t seq;            // Sequence number
    uint32_t payload_len;    // Length of following payload
};
#pragma pack(pop)

constexpr uint32_t ISUP_MAGIC        = 0x20150101;
constexpr uint16_t ISUP_VERSION_50   = 0x0500;

// Message types
enum ISUPMsgType : uint8_t {
    MSG_REGISTER_REQ  = 0x01,
    MSG_REGISTER_ACK  = 0x02,
    MSG_HEARTBEAT_REQ = 0x03,
    MSG_HEARTBEAT_ACK = 0x04,
    MSG_UNREGISTER    = 0x05,
};

// ─────────────────────────────────────────────────────────────
//  Device info stored after successful registration
// ─────────────────────────────────────────────────────────────
struct DeviceInfo {
    std::string device_id;
    std::string ip;
    uint16_t    port;
    std::string model;
    std::string firmware;
    std::string isup_version;
    std::time_t registered_at;
    std::time_t last_seen;
    bool        online;
    socket_t    sock;   // live socket (INVALID_SOCKET if offline)
};

// ─────────────────────────────────────────────────────────────
//  Thread-safe device registry
// ─────────────────────────────────────────────────────────────
class DeviceRegistry {
public:
    void add(const DeviceInfo& dev);
    void remove(const std::string& device_id);
    void update_heartbeat(const std::string& device_id);
    bool exists(const std::string& device_id) const;
    DeviceInfo get(const std::string& device_id) const;
    std::vector<DeviceInfo> all() const;
    size_t count() const;

private:
    mutable std::mutex mtx_;
    std::unordered_map<std::string, DeviceInfo> devices_;
};

// ─────────────────────────────────────────────────────────────
//  Single camera session (runs in its own thread)
// ─────────────────────────────────────────────────────────────
class ISUPSession {
public:
    ISUPSession(socket_t sock, const std::string& remote_ip,
                uint16_t remote_port, DeviceRegistry& registry,
                const std::string& isup_key);
    void run();   // blocking — call from thread

private:
    bool recv_packet(ISUPHeader& hdr, std::vector<uint8_t>& payload);
    void send_packet(uint8_t msg_type, const std::vector<uint8_t>& payload);
    bool handle_register(const ISUPHeader& hdr, const std::vector<uint8_t>& payload);
    void handle_heartbeat(const ISUPHeader& hdr);
    void handle_unregister();

    // SHA-256 helper: HMAC of (device_id + isup_key)
    static std::string sha256_hex(const std::string& data);

    socket_t           sock_;
    std::string        remote_ip_;
    uint16_t           remote_port_;
    DeviceRegistry&    registry_;
    std::string        isup_key_;
    std::string        device_id_;   // set after successful register
    bool               registered_;
    uint32_t           seq_;
};

// ─────────────────────────────────────────────────────────────
//  Main TCP server — accepts connections, spawns sessions
// ─────────────────────────────────────────────────────────────
class ISUPServer {
public:
    ISUPServer(uint16_t tcp_port, const std::string& isup_key,
               DeviceRegistry& registry);
    void start();  // blocking listen loop

private:
    uint16_t        tcp_port_;
    std::string     isup_key_;
    DeviceRegistry& registry_;
};
