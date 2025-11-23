#ifndef MYSQLPROC_H
#define MYSQLPROC_H

#include <string>
#include <memory>
#include <iostream>
#include <queue>
#include <mutex>
#include <condition_variable>
#include <mysql_driver.h>
#include <mysql_connection.h>
#include <cppconn/prepared_statement.h>
#include <cppconn/exception.h>

extern std::string DB_PASSWORD;
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

class MySQLConnection {
public:
    MySQLConnection(const std::string& host,
                    const std::string& user,
                    const std::string& password,
                    const std::string& database);
    ~MySQLConnection();
    MySQLConnection(const MySQLConnection&) = delete;
    MySQLConnection& operator=(const MySQLConnection&) = delete;

    MySQLConnection(MySQLConnection&&) noexcept = default;
    MySQLConnection& operator=(MySQLConnection&&) noexcept = default;


    // 获取原始连接
    sql::Connection* getConnection() { return conn_.get(); }

private:
    sql::mysql::MySQL_Driver* driver_;
    std::unique_ptr<sql::Connection> conn_;
};


#endif // MYSQLPROC_H