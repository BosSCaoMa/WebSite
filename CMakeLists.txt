cmake_minimum_required(VERSION 3.15)
project(WebSite LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 自动收集后端 cpp 源文件（新增文件自动加入）
file(GLOB BACKEND_SRC CONFIGURE_DEPENDS
    "${CMAKE_CURRENT_SOURCE_DIR}/backEnd/*.cpp"
)

# 可执行文件源列表
add_executable(WebSite
    main.cpp
    ${BACKEND_SRC}
)

# 第三方库根目录（可放单头版 json.hpp: third_party/nlohmann/json.hpp）
set(THIRD_PARTY_DIR "${CMAKE_CURRENT_SOURCE_DIR}/third_party")

# 头文件路径（日志库、后端接口、第三方）
target_include_directories(WebSite PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/lib          # LogM.h 等
    ${CMAKE_CURRENT_SOURCE_DIR}/backEnd/include
    ${THIRD_PARTY_DIR}/nlohmann              # 放置 json.hpp 后可用 #include <json.hpp>
)

# ---- 使用 LogM.dll 的最小配置 ----
set(LOGM_DIR "${CMAKE_CURRENT_SOURCE_DIR}/lib")

# 方式一：直接链接 .lib
target_link_libraries(WebSite PRIVATE
    "${LOGM_DIR}/LogM.lib"
)

# 构建后复制 DLL 到可执行文件同目录，运行时可找到
add_custom_command(TARGET WebSite POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${LOGM_DIR}/LogM.dll"
        "$<TARGET_FILE_DIR:WebSite>"
)
