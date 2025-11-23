#include "logIn.h"
#include <bcrypt/bcrypt.h>
#include <nlohmann/json.hpp>
#include "MySQLProc.h"
// 验证密码：对比输入密码与存储的哈希值
bool verifyPassword(const std::string& inputPassword, const std::string& storedHash) {
    // bcrypt_checkpw会自动从storedHash中提取盐值计算
    return bcrypt_checkpw(inputPassword.c_str(), storedHash.c_str()) == 0;
}

void handleLogInRequest(const std::string &requestBody, std::function<void(int, const std::string &)> sendResponse)
{
    // 解析 JSON 数据
    nlohmann::json jsonData = nlohmann::json::parse(requestBody);
    std::string email = jsonData["email"];
    std::string password = jsonData["password"];

    // 查询用户信息
    UserInfo userInfo = QueryUserInfoByEmail(email);
    if (userInfo.email.empty()) {
        sendResponse(401, R"({"success": false, "message": "邮箱或密码错误"})");
        return;
    }

    // 验证密码
    if (!verifyPassword(password, userInfo.passwordHash)) {
        sendResponse(401, R"({"success": false, "message": "邮箱或密码错误"})");
        return;
    }

    // 登录成功
    sendResponse(200, R"({"success": true, "message": "登录成功"})");
}
