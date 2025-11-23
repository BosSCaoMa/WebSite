#ifndef MYSQLPROC_H
#define MYSQLPROC_H

#include <string>
#include <memory>
#include <iostream>
#include <queue>
#include <mutex>
#include <condition_variable>
#include <thread>
#include <chrono>
#include <mysql_driver.h>
#include <mysql_connection.h>
#include <cppconn/prepared_statement.h>
#include <cppconn/exception.h>

struct UserInfo {
    std::string name;
    std::string email;
    std::string passwordHash;
};
enum class SignUpResult {
    Success = 0,
    EmailExists = 1,
    DbError = -1,
};

std::string GetInitName();
SignUpResult GetSignUpResult(const UserInfo& userInfo);
UserInfo QueryUserInfoByEmail(const std::string& email);

class ConnectionPool {
public:
    // 获取单例实例
    static ConnectionPool& instance();
    // 初始化（原构造函数逻辑迁移到此）
    static void init(const std::string& host,
                     const std::string& user,
                     const std::string& password,
                     const std::string& database,
                     int maxConnections = 10,
                     int minConnections = 2);

    ~ConnectionPool();

    // 从池中获取一个连接（shared_ptr）
    std::shared_ptr<sql::Connection> getConnection();

    // 归还连接
    void returnConnection(std::shared_ptr<sql::Connection> conn);

    // 关闭连接池
    void shutdown();

    ConnectionPool(const ConnectionPool&) = delete;
    ConnectionPool& operator=(const ConnectionPool&) = delete;

private:
    ConnectionPool() = default; // 私有构造，使用init完成初始化

    // 创建一个新连接并放入队列
    void createConnection();

    // 验证连接是否有效
    bool isConnectionValid(std::shared_ptr<sql::Connection> conn);

    // 动态扩展连接池
    bool canExpandPool();

private:
    std::queue<std::shared_ptr<sql::Connection>> connections_;
    std::mutex mutex_;
    std::condition_variable condVar_;

    sql::Driver* driver_{nullptr};

    bool isRunning_{false};
    int maxConnections_{0};
    int minConnections_{0};
    int currentConnections_{0}; // 当前总连接数

    // 记录数据库配置信息
    std::string host_;
    std::string user_;
    std::string password_;
    std::string database_;
};

class ConnectionPoolAgent {
public:
    explicit ConnectionPoolAgent(ConnectionPool* pool,
                                 int retryIntervalMs = 10)
        : pool_(pool)
    {
        while (pool_) {
            conn_ = pool_->getConnection();
            if (conn_) break;

            // 没拿到就睡一会再试，避免空转占满CPU
            std::this_thread::sleep_for(
                std::chrono::milliseconds(retryIntervalMs)
            );
        }
    }

    ~ConnectionPoolAgent() {
        if (pool_ && conn_) {
            pool_->returnConnection(conn_);
        }
    }

    sql::Connection* operator->() { return conn_.get(); }
    explicit operator bool() const { return conn_ != nullptr; }

private:
    ConnectionPool* pool_;
    std::shared_ptr<sql::Connection> conn_;
};

#endif // MYSQLPROC_H