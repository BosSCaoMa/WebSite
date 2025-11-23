#include <iostream>
#include <string>
#include "LogM.h"
#include "MySQLProc.h"
#include "ConnectProc.h"
using namespace std;


int main()
{
    LOG_INFO("Application started");

    // 使用全局 extern DB_PASSWORD（不要重复定义）
    const std::string DB_HOST = "tcp://127.0.0.1:3306";  // 经典协议端口 3306
    const std::string DB_USER = "web_user";
    const std::string DB_NAME = "web_manager";
    cout << "press your mysql password:" << endl;
    getline(cin, DB_PASSWORD);
    LOG_INFO("MySQL password set");

    // 初始化数据库连接池
    ConnectionPool::init(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, 10, 2);

    // 监听端口9000，多线程处理请求
    while (true) {
        ProcWebConnect(9000); // 若内部永久循环，此处可去掉 while(true)
    }
    return 0;
}