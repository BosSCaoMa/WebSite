// 后端API 规范说明：

// 接收 JSON 数据：能处理 Content-Type: application/json 的 POST 请求。

// 登录API (/api/login)：

// 接收 { "email": "...", "password": "..." }。

// 成功时，返回 200 OK 状态码和 JSON { "success": true, "message": "登录成功" }。

// 失败时，返回非 2xx 的状态码（如 401, 400）和 JSON { "success": false, "message": "邮箱或密码错误" }。

// 注册API (/api/register)：

// 接收 { "name": "...", "email": "...", "password": "..." }。

// 成功时，返回 201 Created 或 200 OK 状态码和 JSON { "success": true, "message": "注册成功" }。

// 失败时，返回非 2xx 的状态码（如 409, 400）和 JSON { "success": false, "message": "邮箱已被注册" }。

#ifndef SIGNUP_H
#define SIGNUP_H


#include <string>
#include <functional>


void handleSignUpRequest(const std::string& requestBody,
                         std::function<void(int, const std::string&)> sendResponse);





#endif // SIGNUP_H