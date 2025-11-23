#include "MySQLProc.h"
#include <atomic>
using namespace std;

std::string DB_PASSWORD;
const std::string DB_HOST = "tcp://127.0.0.1:3306";  // 经典协议端口 3306
const std::string DB_USER = "web_user";
const std::string DB_NAME = "web_manager";

std::string GetInitName()
{
    static atomic<int> defaultName = 900001;
    string initName = "user_" + to_string(defaultName++);
    return initName;
}

SignUpResult GetSignUpResult(const UserInfo &userInfo)
{
    MySQLConnection dbConn(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
    if (!dbConn.getConnection()) {
        cerr << "Database connection failed!" << endl;
        return SignUpResult::DbError;
    }

    try {
        // 使用预处理语句防止SQL注入
        std::unique_ptr<sql::PreparedStatement> pstmt(
            dbConn.getConnection()->prepareStatement(
                "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)"
            )
        );
        pstmt->setString(1, userInfo.name);
        pstmt->setString(2, userInfo.email);
        pstmt->setString(3, userInfo.passwordHash);

        int affectedRows = pstmt->executeUpdate();
        if (affectedRows == 1) {
            return static_cast<int>(SignUpResult::Success);
        } else {
            return static_cast<int>(SignUpResult::DbError);
        }
    } catch (sql::SQLException &e) {
        // 处理重复邮箱错误（MySQL错误码1062）
        if (e.getErrorCode() == 1062 || std::string(e.getSQLStateCStr()) == "23000") {
            return static_cast<int>(SignUpResult::EmailExists);
        } else {
            cerr << "SQL Error: " << e.what() << ", Error Code: " << e.getErrorCode() << endl;
            return -1; // 其他数据库错误
        }
    }
}

MySQLConnection::MySQLConnection(const std::string &host, const std::string &user,
    const std::string &password, const std::string &database)
{
    driver_ = sql::mysql::get_mysql_driver_instance();
    conn_.reset(driver_->connect(host, user, password));
    conn_->setSchema(database);
}

MySQLConnection::~MySQLConnection()
{
    // 连接会自动关闭
}