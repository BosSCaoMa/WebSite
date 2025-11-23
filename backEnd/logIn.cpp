#include "logIn.h"
#include <crypt.h>
#include <json.hpp>
#include "MySQLProc.h"
// 验证密码：对比输入密码与存储的哈希值
bool verifyPassword(const std::string& inputPassword, const std::string& storedHash) {
    // crypt 会从 storedHash 里读出算法 / cost / 盐，然后再算一次
    const char* out = crypt(inputPassword.c_str(), storedHash.c_str());
    if (!out) return false;

    return storedHash == std::string(out);
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
