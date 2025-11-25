#ifndef BUSINESS_H
#define BUSINESS_H
#include <string>
#include <functional>

void handleBusinessRequest(const std::string& token, std::function<void(int, const std::string&)> sendResponse);





#endif // BUSINESS_H