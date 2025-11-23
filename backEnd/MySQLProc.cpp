#include "MySQLProc.h"
#include <atomic>
#include <iostream>
#include <cppconn/statement.h>
#include <cppconn/resultset.h>
using namespace std;

std::string DB_PASSWORD;
const std::string DB_HOST = "tcp://127.0.0.1:3306";  // 经典协议端口 3306
const std::string DB_USER = "web_user";
const std::string DB_NAME = "web_manager";

ConnectionPool pool(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, 10, 2);

std::string GetInitName()
{
    static atomic<int> defaultName = 900001;
    string initName = "user_" + to_string(defaultName++);
    return initName;
}

SignUpResult GetSignUpResult(const UserInfo &userInfo)
{
    ConnectionPoolAgent dbAgent(&pool);
    try {
        // 使用预处理语句防止SQL注入
        std::unique_ptr<sql::PreparedStatement> pstmt(
            dbAgent->prepareStatement(
                "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)"
            )
        );
        pstmt->setString(1, userInfo.name);
        pstmt->setString(2, userInfo.email);
        pstmt->setString(3, userInfo.passwordHash);

        int affectedRows = pstmt->executeUpdate();
        if (affectedRows == 1) {
            return SignUpResult::Success;
        } else {
            return SignUpResult::DbError;
        }
    } catch (sql::SQLException &e) {
        // 处理重复邮箱错误（MySQL错误码1062）
        if (e.getErrorCode() == 1062 || std::string(e.getSQLStateCStr()) == "23000") {
            return SignUpResult::EmailExists;
        } else {
            cerr << "SQL Error: " << e.what() << ", Error Code: " << e.getErrorCode() << endl;
            return SignUpResult::DbError; // 其他数据库错误
        }
    }
    return SignUpResult::DbError;
}

ConnectionPool::ConnectionPool(const std::string& host,
                               const std::string& user,
                               const std::string& password,
                               const std::string& database,
                               int maxConnections,
                               int minConnections)
    : maxConnections_(maxConnections),
      minConnections_(minConnections),
      currentConnections_(0),
      isRunning_(true),
      host_(host),
      user_(user),
      password_(password),
      database_(database) 
{
    driver_ = sql::mysql::get_mysql_driver_instance();

    // 预先创建 minConnections_ 个连接
    for (int i = 0; i < minConnections_; ++i) {
        try {
            createConnection();
        } catch (const sql::SQLException& e) {
            std::cerr << "Failed to create initial connection: "
                      << e.what() << ", code: " << e.getErrorCode()
                      << std::endl;
        }
    }
}

ConnectionPool::~ConnectionPool() {
    shutdown();
}

std::shared_ptr<sql::Connection> ConnectionPool::getConnection()
{
    std::unique_lock<std::mutex> lock(mutex_);

    // 如果没有空闲连接且可以扩展连接池，尝试创建新连接
    if (connections_.empty() && canExpandPool()) {
        try {
            createConnection();
        } catch (const sql::SQLException& e) {
            std::cerr << "Failed to create connection on demand: "
                      << e.what() << ", code: " << e.getErrorCode()
                      << std::endl;
        }
    }

    // 等待直到有空闲连接，或者池已经被关闭
    condVar_.wait(lock, [this]() {
        return !connections_.empty() || !isRunning_;
    });

    if (!isRunning_) {
        return nullptr;
    }

    if (!connections_.empty()) {
        auto conn = connections_.front();
        connections_.pop();
        return conn;
    }

    // 理论上走不到这里
    return nullptr;
}

void ConnectionPool::returnConnection(std::shared_ptr<sql::Connection> conn)
{
    if (!conn) return;

    std::unique_lock<std::mutex> lock(mutex_);
    if (!isRunning_) {
        // 池已经关闭了，直接丢弃连接并减少计数
        currentConnections_--;
        return;
    }

    // 验证连接是否有效
    if (isConnectionValid(conn)) {
        connections_.push(conn);
        condVar_.notify_one();
    } else {
        // 连接无效，减少总连接数计数
        currentConnections_--;
        std::cerr << "Invalid connection detected and discarded. Current connections: " 
                  << currentConnections_ << std::endl;
        
        // 如果当前连接数低于最小连接数，尝试创建新连接
        if (currentConnections_ < minConnections_) {
            try {
                createConnection();
                std::cout << "Created new connection to maintain minimum pool size." << std::endl;
            } catch (const sql::SQLException& e) {
                std::cerr << "Failed to create replacement connection: "
                          << e.what() << ", code: " << e.getErrorCode()
                          << std::endl;
            }
        }
    }
}

void ConnectionPool::shutdown()
{
    std::unique_lock<std::mutex> lock(mutex_);
    if (!isRunning_) return;

    isRunning_ = false;

    // 清空队列，shared_ptr 离开作用域会自动析构连接
    while (!connections_.empty()) {
        connections_.pop();
    }

    // 唤醒所有等待中的线程，让它们返回 nullptr
    condVar_.notify_all();
}

void ConnectionPool::createConnection() {
    // 这里可能抛 sql::SQLException，调用处捕获
    std::shared_ptr<sql::Connection> conn(
        driver_->connect(host_, user_, password_)
    );
    conn->setSchema(database_);

    connections_.push(conn);
    currentConnections_++;
}

bool ConnectionPool::isConnectionValid(std::shared_ptr<sql::Connection> conn) {
    if (!conn) return false;
    
    try {
        // 检查连接是否关闭
        if (conn->isClosed()) {
            return false;
        }
        
        // 执行一个简单的查询来验证连接
        std::unique_ptr<sql::Statement> stmt(conn->createStatement());
        std::unique_ptr<sql::ResultSet> res(stmt->executeQuery("SELECT 1"));
        
        // 如果能执行查询并获得结果，连接是有效的
        return res && res->next();
    } catch (const sql::SQLException& e) {
        std::cerr << "Connection validation failed: " 
                  << e.what() << ", code: " << e.getErrorCode() 
                  << std::endl;
        return false;
    } catch (...) {
        std::cerr << "Unknown error during connection validation" << std::endl;
        return false;
    }
}

bool ConnectionPool::canExpandPool() {
    // 检查是否可以扩展连接池（当前连接数小于最大连接数）
    return currentConnections_ < maxConnections_;
}