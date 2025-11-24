# WebSite
```text
浏览器(用户)
    |
    | 访问 http://你的服务器/
    v
Nginx
  - /         -> 返回静态网页 (HTML/JS/CSS)
  - /api/...  -> 反向代理到 127.0.0.1:9000 (你的 C++ 服务)
                      |
                      v
                 C++ 程序(HTTP 服务)
```

## 一、项目简介
一个使用 C++ 自实现轻量级 HTTP 解析与路由的后端示例，配合 Nginx 提供静态资源与反向代理。当前支持用户注册、登录、登出，使用 MySQL 存储用户信息，采用 bcrypt 哈希（通过 crypt 接口）存储密码，登录后生成简单的 Base64 token 并保存在内存 Session 中。

## 二、当前功能
- HTTP 请求解析(parse_http_request)：解析请求行、头部、正文，抽取 Authorization: Bearer <token> 或自定义 Token 头。
- 路由：/api/login, /api/register, /api/logout。
- 会话管理：内存中维护 token -> Session（含过期时间），互斥锁保护并发访问。
- 密码校验：使用系统 crypt 支持的 bcrypt 哈希对比。
- 简单日志：封装在 LogM 库，输出调试与错误信息。
- MySQL 访问：通过 `MySQLProc`（未在此详述）查询用户信息。

## 三、技术要点
| 模块 | 要点 |
| ---- | ---- |
| 网络 | 基于 POSIX socket，阻塞 accept + 每连接一个线程（后续可改为线程池/epoll）。 |
| HTTP | 手工解析，支持 Content-Length；暂不支持分块传输/长连接复用。 |
| 安全 | 密码 bcrypt 哈希存储；token 简易方案（email+时间戳+随机数 Base64），未签名。 |
| 并发 | session map 使用 `std::mutex` 保护；其他区域尚未细化。 |
| 架构 | 前端静态资源与后端 API 分离，Nginx 反向代理。 |
| 构建 | 目前可用 g++ 单文件编译；已存在 CMakeLists.txt，后续完善多文件目标与库。 |

## 四、目录结构
```
backEnd/
  ConnectProc.cpp        # 网络监听+请求分发
  logIn.cpp              # 登录逻辑 + token生成 + session存储
  signUp.cpp             # 注册逻辑
  MySQLProc.cpp          # MySQL相关操作
  include/               # 头文件
lib/                     # 第三方/自建库 (json.hpp, 日志库等)
web/                     # 前端静态资源 (index.html)
CMakeLists.txt           # 构建脚本(待扩展)
```

## 五、构建与运行（临时）
示例（Linux）：
```bash
g++ -std=c++17 -pthread backEnd/ConnectProc.cpp backEnd/logIn.cpp backEnd/signUp.cpp backEnd/MySQLProc.cpp -IbackEnd/include -Ilib -o server
./server   # 默认监听在代码中设定的端口（如 9000）
```
Windows 可使用 msys2/ucrt64 g++，或完善 CMake 后直接 `cmake .. && cmake --build .`。

## 六、现有 MySQL 表
```mysql
CREATE TABLE `sys_user` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `username` VARCHAR(50) NOT NULL COMMENT '用户名（唯一）',
  `email` VARCHAR(100) NOT NULL COMMENT '邮箱（唯一）',
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'bcrypt哈希值（含盐分）',
  `password_algorithm` VARCHAR(50) NOT NULL DEFAULT 'bcrypt' COMMENT '加密算法标识',
  `password_update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '密码最后修改时间',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '1-正常，0-禁用',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_username` (`username`),
  UNIQUE KEY `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';
```

## 七、待完善与拓展方向
1. Token 安全
   - 使用 JWT（签名+过期+声明）或 HMAC 签名的自定义 token。
   - 支持刷新令牌与滑动过期。
2. Session 持久化
   - 使用 Redis 取代内存 map，实现跨进程/多实例共享；引入过期检查定时器。
3. HTTP 能力
   - 支持 Keep-Alive、分块传输、错误码完善、统一响应封装。
4. 并发模型
   - 改造为 epoll + 线程池，提高高并发性能；加入优雅关闭机制。
5. 配置与环境
   - 使用 YAML/JSON 配置文件（端口、数据库、日志级别等）；支持热加载。
6. 日志与监控
   - 日志分级落盘、接入 ELK；指标采集 (Prometheus) + 健康检查接口。
7. 安全加固
   - HTTPS/TLS 终端（可由 Nginx 终止）；CSRF/XSS 基础防护、速率限制、IP黑名单。
8. 数据访问
   - 引入连接池、预编译语句、事务与错误重试策略。
9. 测试与质量
   - 单元测试(GTest)、集成测试、CI/CD（GitHub Actions）。
10. 构建与部署
   - 完善 CMake 分模块；Docker 镜像；k8s 部署；版本语义化。 
11. 前端交互
   - 登录状态前端存储（cookie/httpOnly 或 localStorage）；路由守卫；登出自动清理。
12. 国际化与可观测性
   - 返回标准错误码 + message 多语言；Tracing (OpenTelemetry)。

## 八、后续优先级建议
高 -> Token安全/JWT；并发模型优化；Redis Session；日志与监控。
中 -> 构建与CI；连接池；配置系统。
低 -> 国际化、灰度发布、观测性全链路。

## 九、快速验证接口（curl 示例）
```bash
# 登录
curl -X POST http://127.0.0.1:9000/api/login -H 'Content-Type: application/json' -d '{"email":"a@b.com","password":"123456"}'
# 登出（假设获得token）
curl -X POST http://127.0.0.1:9000/api/logout -H "Authorization: Bearer <token>"
```

## 十、风险提示
- 当前 token 无签名易被伪造；
- Session 仅在内存中，重启即失效；
- 简易线程模型在高并发下可能耗尽资源；
- 缺少输入校验与频率限制，存在滥用风险。

---
若需将 bcrypt 改为 Argon2 或添加 JWT，请在 Issue 中记录需求。

