#include "MySQLProc.h"
#include <atomic>
#include <iostream>
#include <cppconn/statement.h>
#include <cppconn/resultset.h>
#include "LogM.h"
using namespace std;

std::string GetInitName()
{
    static atomic<int> defaultName = 900001;
    string initName = "user_" + to_string(defaultName++);
    return initName;
}

SignUpResult GetSignUpResult(const UserInfo &userInfo)
{
    ConnectionPoolAgent dbAgent(&ConnectionPool::instance());
    try {
        // 使用预处理语句防止SQL注入
        std::unique_ptr<sql::PreparedStatement> pstmt(
            dbAgent->prepareStatement(
                "INSERT INTO sys_user (name, email, password_hash, role) VALUES (?, ?, ?, ?)"
            )
        );
        pstmt->setString(1, userInfo.name);
        pstmt->setString(2, userInfo.email);
        pstmt->setString(3, userInfo.passwordHash);
        pstmt->setInt(4, static_cast<int>(userInfo.role));

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

UserInfo QueryUserInfoByEmail(const std::string &email)
{
    ConnectionPoolAgent dbAgent(&ConnectionPool::instance());
    UserInfo userInfo;

    try {
        std::unique_ptr<sql::PreparedStatement> pstmt(
            dbAgent->prepareStatement("SELECT name, email, password_hash, role FROM sys_user WHERE email = ?")
        );
        pstmt->setString(1, email);

        std::unique_ptr<sql::ResultSet> resultSet(pstmt->executeQuery());
        if (resultSet->next()) {
            userInfo.name = resultSet->getString("name");
            userInfo.email = resultSet->getString("email");
            userInfo.passwordHash = resultSet->getString("password_hash");
            int roleValue = resultSet->getInt("role");
            userInfo.role = static_cast<UserRole>(roleValue);
        }
    } catch (sql::SQLException &e) {
        LOG_ERROR("SQL Error: %s, Error Code: %d", e.what(), e.getErrorCode());
    }

    return userInfo;
}

UserRole GetUserRole(const std::string& email)
{
    ConnectionPoolAgent dbAgent(&ConnectionPool::instance());
    
    try {
        std::unique_ptr<sql::PreparedStatement> pstmt(
            dbAgent->prepareStatement("SELECT role FROM sys_user WHERE email = ?")
        );
        pstmt->setString(1, email);

        std::unique_ptr<sql::ResultSet> resultSet(pstmt->executeQuery());
        if (resultSet->next()) {
            int roleValue = resultSet->getInt("role");
            return static_cast<UserRole>(roleValue);
        }
    } catch (sql::SQLException &e) {
        LOG_ERROR("SQL Error: %s, Error Code: %d", e.what(), e.getErrorCode());
    }

    return UserRole::User; // 默认返回普通用户角色
}

// -------------------- 单例相关实现 --------------------
ConnectionPool& ConnectionPool::instance() {
    static ConnectionPool inst; // Meyers Singleton
    return inst;
}

void ConnectionPool::init(const std::string& host,
                          const std::string& user,
                          const std::string& password,
                          const std::string& database,
                          int maxConnections,
                          int minConnections) {
    ConnectionPool& inst = instance();
    std::lock_guard<std::mutex> lock(inst.mutex_);
    if (inst.isRunning_) {
        // 已经初始化过，直接返回
        return;
    }
    inst.maxConnections_ = maxConnections;
    inst.minConnections_ = minConnections;
    inst.currentConnections_ = 0;
    inst.isRunning_ = true;
    inst.host_ = host;
    inst.user_ = user;
    inst.password_ = password;
    inst.database_ = database;

    inst.driver_ = sql::mysql::get_mysql_driver_instance();

    for (int i = 0; i < inst.minConnections_; ++i) {
        try {
            inst.createConnection();
        } catch (const sql::SQLException& e) {
            LOG_ERROR("Failed to create initial connection: %s, code: %d",
                      e.what(), e.getErrorCode());
        }
    }
}
// ------------------------------------------------------

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