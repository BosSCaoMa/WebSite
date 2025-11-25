#include <iostream>
#include <string>
#include "LogM.h"
#include "MySQLProc.h"
#include "ConnectProc.h"
using namespace std;


int main()
{
    LOG_INFO("Application started");

    
    const std::string DB_HOST = "tcp://127.0.0.1:3306";  // 经典协议端口 3306
    const std::string DB_USER = "web_user";
    const std::string DB_NAME = "web_manager";
    string DB_PASSWORD;
    cout << "press your mysql password:" << endl;
    getline(cin, DB_PASSWORD);
    cout<< "running" << endl;

    // 初始化数据库连接池
    ConnectionPool::init(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, 10, 2);

    // 监听端口9000，多线程处理请求
    ProcWebConnect(9000);
    return 0;
}