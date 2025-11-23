#include "signUp.h"
#include <json.hpp>
#include "LogM.h"
#include <bcrypt/bcrypt.h>
#include <iostream>
#include "MySQLProc.h"
#include <memory>
#include <mysql_driver.h>
#include <mysql_connection.h>
#include <cppconn/prepared_statement.h>
#include <cppconn/exception.h>

extern std::string DB_PASSWORD;                  // 你的全局密码变量

// 加密密码：返回哈希值（含盐值）
std::string hashPassword(const std::string& password) {
    // 生成盐值（bcrypt自动生成，参数4-31，值越大越安全但越慢）
    char salt[BCRYPT_HASHSIZE];
    bcrypt_gensalt(12, salt); // 12是cost因子，推荐10-14

    // 哈希密码（结果包含盐值，无需单独存储盐）
    char hash[BCRYPT_HASHSIZE];
    bcrypt_hashpw(password.c_str(), salt, hash);

    return std::string(hash);
}

void handleSignUpRequest(const std::string &requestBody, std::function<void(int, const std::string &)> sendResponse)
{
    LOG_DEBUG("Handling sign-up request");
    // 解析 JSON 请求体--(前端保证密码符合复杂度要求)
    nlohmann::json jsonData = nlohmann::json::parse(requestBody);
    std::string name = jsonData["name"];
    if (name != "INVITE2024") {
        sendResponse(400, R"({"success": false, "message": "无效的邀请码"})");
        return;
    }
    std::string initName = GetInitName();
    std::string email = jsonData["email"];
    std::string password = jsonData["password"];
    
    UserInfo userInfo {
        .name = initName,
        .email = email,
        .passwordHash = hashPassword(password)
    };
    LOG_DEBUG("Received sign-up request: email=%s", email.c_str());
    
    auto res = GetSignUpResult(userInfo);
    if (res == SignUpResult::EmailExists) {
        LOG_DEBUG("Sign-up failed: Email already exists: %s", email.c_str());
        sendResponse(409, R"({"success": false, "message": "邮箱已被注册"})");
        return;
    } else if (res == SignUpResult::DbError) {
        LOG_ERROR("Sign-up failed: Database error for email: %s", email.c_str());
        sendResponse(500, R"({"success": false, "message": "服务器错误，请稍后重试"})");
        return;
    }
    // 示例：注册成功
    sendResponse(201, R"({"success": true, "message": "注册成功"})");
}







