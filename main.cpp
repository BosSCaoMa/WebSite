#include <iostream>
#include <string>
#include <unordered_map>
#include "LogM.h"
#include "MySQLProc.h"

using namespace std;
int main()
{
    LOG_INFO("Application started");
    // 获取MySQL密码
    cout << "press your mysql password:" << endl;
    getline(cin, DB_PASSWORD);
    LOG_INFO("MySQL password set");

    return 0;
}