#ifndef CONNECTPROC_H
#define CONNECTPROC_H

#include <string>
#include <unordered_map>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <thread>
#include <iostream>

struct HttpRequest {
    std::string method;
    std::string path;
    std::string version;
    std::unordered_map<std::string, std::string> headers;
    std::string body;
};

static inline std::string trim(const std::string& s) {
    size_t start = s.find_first_not_of(" \t\r\n");
    if (start == std::string::npos) return "";
    size_t end = s.find_last_not_of(" \t\r\n");
    return s.substr(start, end - start + 1);
}

// 解析原始HTTP请求报文，填充HttpRequest结构体。目前假设可以一次性读完
bool parse_http_request(const std::string& raw, HttpRequest& req);

// 处理单个客户端
void handle_client(int client_fd);
// 启动监听端口，返回0成功，非0错误
int ProcWebConnect(int port);

#endif // CONNECTPROC_H