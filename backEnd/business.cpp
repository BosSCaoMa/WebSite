#include "include/business.h"
#include <string>
#include <functional>

void handleBusinessRequest(const std::string& token, std::function<void(int, const std::string&)> sendResponse) {
    // TODO: 实现业务逻辑
    // 示例：直接返回成功
    sendResponse(200, R"({"success": true, "message": "业务处理成功"})");
}
