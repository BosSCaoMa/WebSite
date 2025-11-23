#include "ConnectProc.h"
#include <cstring>
#include <nlohmann/json.hpp>
#include "logIn.h"
#include "signUp.h"
using nlohmann::json;
bool parse_http_request(const std::string& raw, HttpRequest& req)
{
    size_t header_end = raw.find("\r\n\r\n");
    if (header_end == std::string::npos) return false;
    std::string header_part = raw.substr(0, header_end);
    std::string body_part   = raw.substr(header_end + 4);
    size_t line_end = header_part.find("\r\n");
    if (line_end == std::string::npos) return false;
    std::string request_line = header_part.substr(0, line_end);
    {
        std::istringstream iss(request_line);
        if (!(iss >> req.method >> req.path >> req.version)) return false;
    }
    size_t pos = line_end + 2;
    while (pos < header_part.size()) {
        size_t next = header_part.find("\r\n", pos);
        if (next == std::string::npos) next = header_part.size();
        std::string line = header_part.substr(pos, next - pos);
        pos = next + 2;
        if (line.empty()) continue;
        size_t colon = line.find(':');
        if (colon == std::string::npos) continue;
        std::string key = trim(line.substr(0, colon));
        std::string value = trim(line.substr(colon + 1));
        req.headers[key] = value;
    }
    auto it = req.headers.find("Content-Length");
    if (it != req.headers.end()) {
        size_t len = static_cast<size_t>(std::stoul(it->second));
        if (body_part.size() < len) return false;
        req.body = body_part.substr(0, len);
    } else {
        req.body = body_part;
    }
    return true;
}

void handle_client(int client_fd)
{
    std::string raw;
    raw.resize(8192);
    int n = read(client_fd, &raw[0], raw.size() - 1);
    if (n <= 0) {
        close(client_fd);
        return;
    }
    raw.resize(n);

    HttpRequest req;
    if (!parse_http_request(raw, req)) {
        LOG_ERROR("Failed to parse HTTP request");
        close(client_fd);
        return;
    }
    LOG_DEBUG("Received HTTP request: %s %s", req.method.c_str(), req.path.c_str());

    // 构造回调，捕获client_fd
    auto sendResponse = [client_fd](int statusCode, const std::string& body) {
        const char* statusText = (statusCode == 200 ? "OK" : (statusCode == 400 ? "Bad Request" : (statusCode == 401 ? "Unauthorized" : "Error")));
        std::string resp =
            "HTTP/1.1 " + std::to_string(statusCode) + " " + statusText + "\r\n" +
            "Content-Type: application/json; charset=utf-8\r\n" +
            "Content-Length: " + std::to_string(body.size()) + "\r\n" +
            "Connection: close\r\n" +
            "\r\n" +
            body;
        ::write(client_fd, resp.data(), resp.size());
        ::close(client_fd);
    };

    // 简单路由示例：处理登录
    if (req.method == "POST" && req.path == "/api/login") {
        try {
            handleLogInRequest(req.body, sendResponse);
            return; // sendResponse 已关闭连接
        } catch (const std::exception& e) {
            sendResponse(400, std::string("{\"success\": false, \"message\": \"JSON parse error: ") + e.what() + "\"}");
            return;
        }
    } else if (req.method == "POST" && req.path == "/api/register") {
        try {
            handleSignUpRequest(req.body, sendResponse);
            return; // sendResponse 已关闭连接
        } catch (const std::exception& e) {
            sendResponse(400, std::string("{\"success\": false, \"message\": \"JSON parse error: ") + e.what() + "\"}");
            return;
        }
    }

    // 其他未匹配路由，返回404
    sendResponse(404, "{\"success\": false, \"message\": \"Not Found\"}");
}

int ProcWebConnect(int port)
{
    int server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd < 0) {
        perror("socket");
        return 1;
    }
    int opt = 1;
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = inet_addr("127.0.0.1");
    addr.sin_port = htons(port);
    if (bind(server_fd, (sockaddr *)&addr, sizeof(addr)) < 0) {
        perror("bind");
        close(server_fd);
        return 1;
    }
    if (listen(server_fd, 16) < 0) {
        perror("listen");
        close(server_fd);
        return 1;
    }

    while (true) {
        sockaddr_in client_addr{};
        socklen_t client_len = sizeof(client_addr);
        int client_fd = accept(server_fd, (sockaddr *)&client_addr, &client_len);
        if (client_fd < 0) {
            perror("accept");
            continue;
        }
        std::thread t(handle_client, client_fd);
        t.detach();
    }
    close(server_fd);
    return 0;
}
