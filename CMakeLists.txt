cmake_minimum_required(VERSION 3.15)
project(WebSite LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 可执行文件
add_executable(WebSite main.cpp)

# 头文件路径（动态库及后端接口）
target_include_directories(WebSite PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/lib
    ${CMAKE_CURRENT_SOURCE_DIR}/backEnd/include
)

# 查找不同工具链下的导入库
set(LOGM_DIR "${CMAKE_CURRENT_SOURCE_DIR}/lib")
set(LOGM_DLL "${LOGM_DIR}/LogM.dll")
if(MSVC)
    # MSVC 期望 .lib 导入库
    find_library(LOGM_IMP_LIB NAMES LogM PATHS "${LOGM_DIR}" NO_DEFAULT_PATH)
    if(NOT LOGM_IMP_LIB)
        message(FATAL_ERROR "未找到 LogM.lib (MSVC 需要), 请放到 ${LOGM_DIR}")
    endif()
    add_library(LogM SHARED IMPORTED GLOBAL)
    set_target_properties(LogM PROPERTIES
        IMPORTED_LOCATION "${LOGM_DLL}"
        IMPORTED_IMPLIB  "${LOGM_IMP_LIB}"
        INTERFACE_INCLUDE_DIRECTORIES "${LOGM_DIR}"
    )
else()
    # MinGW / GCC: 可能是 libLogM.dll.a 或者直接使用 dll
    find_library(LOGM_IMP_LIB NAMES LogM libLogM PATHS "${LOGM_DIR}" NO_DEFAULT_PATH)
    add_library(LogM SHARED IMPORTED GLOBAL)
    if(LOGM_IMP_LIB)
        set_target_properties(LogM PROPERTIES
            IMPORTED_LOCATION "${LOGM_DLL}"
            IMPORTED_IMPLIB  "${LOGM_IMP_LIB}"
            INTERFACE_INCLUDE_DIRECTORIES "${LOGM_DIR}"
        )
    else()
        # 没有导入库时部分平台仍可延迟绑定，但 MSVC 不行
        set_target_properties(LogM PROPERTIES
            IMPORTED_LOCATION "${LOGM_DLL}"
            INTERFACE_INCLUDE_DIRECTORIES "${LOGM_DIR}"
        )
    endif()
endif()

# 链接动态库
target_link_libraries(WebSite PRIVATE LogM)

# 构建后复制 DLL 到可执行文件同目录，运行时可找到
add_custom_command(TARGET WebSite POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${LOGM_DLL}"
        "$<TARGET_FILE_DIR:WebSite>"
)
