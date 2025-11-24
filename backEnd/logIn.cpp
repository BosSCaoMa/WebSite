#include "logIn.h"
#include <crypt.h>
#include <json.hpp>
#include "MySQLProc.h"
#include "LogM.h"
#include <mutex>

using namespace std;
unordered_map<string, Session> g_sessionStore;
std::mutex g_sessionMutex; // 新增互斥锁

static std::string base64Encode(const std::string &in) {
    static const char *tbl = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string out;
    size_t i = 0;
    unsigned char a3[3];
    unsigned char a4[4];
    for (unsigned char c : in) {
        a3[i++] = c;
        if (i == 3) {
            a4[0] = (a3[0] & 0xfc) >> 2;
            a4[1] = ((a3[0] & 0x03) << 4) + ((a3[1] & 0xf0) >> 4);
            a4[2] = ((a3[1] & 0x0f) << 2) + ((a3[2] & 0xc0) >> 6);
            a4[3] = a3[2] & 0x3f;
            for (int j = 0; j < 4; ++j) out.push_back(tbl[a4[j]]);
            i = 0;
        }
    }
    if (i) {
        for (size_t j = i; j < 3; ++j) a3[j] = '\0';
        a4[0] = (a3[0] & 0xfc) >> 2;
        a4[1] = ((a3[0] & 0x03) << 4) + ((a3[1] & 0xf0) >> 4);
        a4[2] = ((a3[1] & 0x0f) << 2) + ((a3[2] & 0xc0) >> 6);
        a4[3] = a3[2] & 0x3f;
        for (size_t j = 0; j < i + 1; ++j) out.push_back(tbl[a4[j]]);
        while (out.size() % 4) out.push_back('=');
    }
    return out;
}

static std::string generateToken(const std::string &email) {
    using namespace std::chrono;
    auto ms = duration_cast<milliseconds>(system_clock::now().time_since_epoch()).count();
    std::random_device rd;
    std::mt19937_64 gen(rd());
    uint64_t r = gen();
    std::ostringstream oss;
    oss << email << ':' << ms << ':' << std::hex << r;
    return base64Encode(oss.str());
}

// 验证密码：对比输入密码与存储的哈希值
bool verifyPassword(const std::string& inputPassword, const std::string& storedHash) {
    // crypt 会从 storedHash 里读出算法 / cost / 盐，然后再算一次
    const char* out = crypt(inputPassword.c_str(), storedHash.c_str());
    if (!out) return false;

    return storedHash == std::string(out);
}

void SaveInSessionCB(const string& email, const string& token) {
    // 此处应实现将 token 存储在服务器端的会话存储中，关联到对应的 email
    // 例如，可以使用内存缓存、数据库等方式存储
    // 这里仅为示例，实际实现需根据具体需求进行
    LOG_INFO("Saving session for email: %s with token: %s", email.c_str(), token.c_str());
    Session session;
    session.token = token;
    session.expireAt = std::chrono::steady_clock::now() + std::chrono::hours(1); // 1小时后过期
    session.email = email;
    {
        std::lock_guard<std::mutex> lk(g_sessionMutex);
        g_sessionStore[token] = session;
        LOG_DEBUG("Current session store size: %zu", g_sessionStore.size());
    }
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

    // 登录成功并生成 token
    std::string token = generateToken(userInfo.email);
    SaveInSessionCB(email, token);
    nlohmann::json resp = {
        {"success", true},
        {"message", "登录成功"},
        {"token", token}
    };
    sendResponse(200, resp.dump());
}

// 新增: token 验证
bool validateToken(const std::string& token, std::string* emailOut) {
    if (token.empty()) return false;
    std::lock_guard<std::mutex> lk(g_sessionMutex);
    auto it = g_sessionStore.find(token);
    if (it == g_sessionStore.end()) return false;
    // 过期检查
    if (std::chrono::steady_clock::now() > it->second.expireAt) {
        g_sessionStore.erase(it);
        return false;
    }
    if (emailOut) *emailOut = it->second.email;
    return true;
}

// 新增: 登出处理（删除 session）
void handleLogOutRequest(const std::string& token, std::function<void(int, const std::string&)> sendResponse) {
    if (token.empty()) {
        sendResponse(400, R"({"success": false, "message": "缺少token"})");
        return;
    }
    {
        std::lock_guard<std::mutex> lk(g_sessionMutex);
        auto it = g_sessionStore.find(token);
        if (it == g_sessionStore.end()) {
            sendResponse(401, R"({"success": false, "message": "无效token"})");
            return;
        }
        g_sessionStore.erase(it);
    }
    sendResponse(200, R"({"success": true, "message": "登出成功"})");
}
