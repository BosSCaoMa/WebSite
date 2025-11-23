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

# 公共包含路径
target_include_directories(WebSite PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/lib              # LogM.h / json.hpp
    ${CMAKE_CURRENT_SOURCE_DIR}/backEnd/include
    ${THIRD_PARTY_DIR}/nlohmann                  # 如有单头版放这里
)

# ---- 使用 LogM.dll 的最小配置 ----
set(LOGM_DIR "${CMAKE_CURRENT_SOURCE_DIR}/lib")

# ---------------- Windows 专用配置 ----------------
if (WIN32)
    # 链接静态/导入库
    if (EXISTS "${LOGM_DIR}/LogM.lib")
        target_link_libraries(WebSite PRIVATE "${LOGM_DIR}/LogM.lib")
    endif()
    # 复制 DLL 以便运行
    if (EXISTS "${LOGM_DIR}/LogM.dll")
        add_custom_command(TARGET WebSite POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy_if_different
                "${LOGM_DIR}/LogM.dll"
                "$<TARGET_FILE_DIR:WebSite>"
        )
    endif()
endif()

# ---------------- Linux / UNIX 专用配置 ----------------
if (UNIX)
    message(STATUS "Configuring for Linux/UNIX")
    # 线程
    find_package(Threads REQUIRED)

    # 查找 MySQL Connector/C++ (库名可能是 mysqlcppconn 或 mysqlcppconn8)
    find_library(MYSQLCPPCONN_LIB NAMES mysqlcppconn mysqlcppconn8)
    if (MYSQLCPPCONN_LIB)
        message(STATUS "Found MySQL Connector/C++: ${MYSQLCPPCONN_LIB}")
        target_link_libraries(WebSite PRIVATE ${MYSQLCPPCONN_LIB})
    else()
        message(WARNING "MySQL Connector/C++ library not found. Install libmysqlcppconn-dev (Ubuntu) or equivalent.")
    endif()

    # 尝试寻找 MySQL 头文件（可选）
    find_path(MYSQL_CONN_INCLUDE_DIR mysql_driver.h
        PATHS /usr/include /usr/local/include /usr/include/mysql /usr/local/include/mysql
    )
    if (MYSQL_CONN_INCLUDE_DIR)
        target_include_directories(WebSite PRIVATE ${MYSQL_CONN_INCLUDE_DIR})
        message(STATUS "MySQL headers: ${MYSQL_CONN_INCLUDE_DIR}")
    endif()

    # bcrypt 库（若使用系统 libbcrypt）
    find_library(BCRYPT_LIB bcrypt)
    if (BCRYPT_LIB)
        message(STATUS "Found bcrypt: ${BCRYPT_LIB}")
        target_link_libraries(WebSite PRIVATE ${BCRYPT_LIB})
    else()
        message(WARNING "bcrypt library not found. Install libbcrypt-dev or adjust include/link settings.")
    endif()

    # 链接线程库
    target_link_libraries(WebSite PRIVATE Threads::Threads)
endif()