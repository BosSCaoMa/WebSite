#include "signUp.h"
#include <json.hpp>
#include "LogM.h"
#include <crypt.h>
#include <iostream>
#include "MySQLProc.h"
#include <memory>
#include <mysql_driver.h>
#include <mysql_connection.h>
#include <cppconn/prepared_statement.h>
#include <cppconn/exception.h>
#include <stdexcept>
#include <random>

static std::string generateBcryptSalt(int cost = 12) {
    // bcrypt 的“base64”字符集：[./0-9A-Za-z]
    static const char alphabet[] =
        "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

    if (cost < 4)  cost = 4;
    if (cost > 31) cost = 31;

    // 前缀：$2b$<cost>$
    char prefix[8];
    std::snprintf(prefix, sizeof(prefix), "$2b$%02d$", cost);

    std::string salt = prefix;
    salt.reserve(salt.size() + 22);

    std::random_device rd;
    std::uniform_int_distribution<int> dist(0, sizeof(alphabet) - 2); // 去掉末尾 '\0'

    // 22 个随机字符
    for (int i = 0; i < 22; ++i) {
        salt.push_back(alphabet[dist(rd)]);
    }

    return salt;
}

// 加密密码：返回哈希值（含盐值）
std::string hashPassword(const std::string& password) {
    std::string salt = generateBcryptSalt();   // 例如: $2b$12$xxxxxxxxxxxxxxxxxxxxxx

    const char* out = crypt(password.c_str(), salt.c_str());
    if (!out) {
        throw std::runtime_error("crypt() failed when hashing password");
    }

    // 形如: $2b$12$...22字节盐...31字节hash...
    return std::string(out);
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







