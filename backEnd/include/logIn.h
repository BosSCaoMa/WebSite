// 后端API 规范说明：

// 接收 JSON 数据：能处理 Content-Type: application/json 的 POST 请求。

// 登录API (/api/login)：

// 接收 { "email": "...", "password": "..." }。

// 成功时，返回 200 OK 状态码和 JSON { "success": true, "message": "登录成功" }。

// 失败时，返回非 2xx 的状态码（如 401, 400）和 JSON { "success": false, "message": "邮箱或密码错误" }。
#ifndef LOGIN_H
#define LOGIN_H

#include <string>

// 验证密码：对比输入密码与存储的哈希值
bool verifyPassword(const std::string& inputPassword, const std::string& storedHash);
void handleLogInRequest(const std::string& requestBody,
                        std::function<void(int, const std::string&)> sendResponse);
#endif // LOGIN_H