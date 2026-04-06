cmake_minimum_required(VERSION 3.14)
project(isup_server CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ── Sources ──────────────────────────────────────────────────
add_executable(isup_server
    main.cpp
    isup_server.cpp
    http_api.cpp
    passive_tcp_server.cpp
    redis_bridge.cpp
)

# ── Include current directory ─────────────────────────────────
target_include_directories(isup_server PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})

# ── Link libraries ────────────────────────────────────────────
if (WIN32)
    # Windows Sockets
    target_link_libraries(isup_server ws2_32)
else()
    # Linux: pthreads
    find_package(Threads REQUIRED)
    target_link_libraries(isup_server Threads::Threads)
endif()

# ── Compiler warnings / optimizations ─────────────────────────
if (MSVC)
    target_compile_options(isup_server PRIVATE /W3 /O2)
else()
    target_compile_options(isup_server PRIVATE -Wall -Wextra -O2)
endif()

message(STATUS "Platform: ${CMAKE_SYSTEM_NAME}")
message(STATUS "Build type: ${CMAKE_BUILD_TYPE}")
