#!/bin/bash
# 数据库角色系统初始化脚本
# 用于在Linux系统上初始化数据库并创建管理员账户

# 数据库配置（请根据实际情况修改）
DB_HOST="localhost"
DB_USER="web_user"
read -sp "请输入数据库密码: " DB_PASSWORD
echo
DB_NAME="web_manager"  # 请修改为您现有的数据库名称

# 颜色输出函数
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查MySQL是否可用
check_mysql() {
    print_info "检查MySQL连接..."
    mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" > /dev/null 2>&1
    if [ $? -ne 0 ]; then
        print_error "无法连接到MySQL数据库。请检查数据库配置。"
        exit 1
    fi
    print_info "MySQL连接正常"
}

# 检查数据库是否存在
check_database() {
    print_info "检查数据库 $DB_NAME 是否存在..."
    db_exists=$(mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" -e "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = '$DB_NAME';" | wc -l)
    if [ $db_exists -lt 2 ]; then
        print_error "数据库 $DB_NAME 不存在。请先创建数据库或修改DB_NAME配置。"
        exit 1
    fi
    print_info "数据库 $DB_NAME 存在"
}

# 检查用户表是否存在，如果不存在则创建
check_or_create_user_table() {
    print_info "检查用户表是否存在..."
    table_exists=$(mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = '$DB_NAME' AND TABLE_NAME = 'sys_user';" | tail -1)
    
    if [ $table_exists -eq 0 ]; then
        print_info "用户表不存在，正在创建..."
        create_user_table
    else
        print_info "用户表已存在，检查是否需要添加角色字段..."
        # 检查角色字段是否存在
        role_column_exists=$(mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '$DB_NAME' AND TABLE_NAME = 'sys_user' AND COLUMN_NAME = 'role';" | tail -1)
        
        if [ $role_column_exists -eq 0 ]; then
            print_info "角色字段不存在，正在添加..."
            mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "ALTER TABLE sys_user ADD COLUMN role TINYINT DEFAULT 0 COMMENT '用户角色: 0=普通用户, 1=管理员';"
            if [ $? -eq 0 ]; then
                print_info "角色字段添加成功"
            else
                print_error "角色字段添加失败"
                exit 1
            fi
        else
            print_info "角色字段已存在"
        fi
    fi
}

# 创建用户表
create_user_table() {
    print_info "创建用户表..."
    mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" <<EOF
CREATE TABLE IF NOT EXISTS sys_user (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role TINYINT DEFAULT 0 COMMENT '用户角色: 0=普通用户, 1=管理员',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_email_role (email, role)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='系统用户表';
EOF
    if [ $? -eq 0 ]; then
        print_info "用户表创建成功"
    else
        print_error "用户表创建失败"
        exit 1
    fi
}

# 生成安全的 bcrypt 密码哈希（与 C++ 后端一致）
generate_password_hash() {
    local password="$1"
    # 使用 Python 的 bcrypt 库生成 $2b$12$... 哈希
    if command -v python3 > /dev/null; then
        hash=$(python3 -c "import bcrypt; print(bcrypt.hashpw(b'$password', bcrypt.gensalt(12)).decode())" 2>/dev/null)
        if [[ "$hash" == \$2b\$12\$* ]]; then
            echo "$hash"
            return 0
        else
            echo "" # 失败返回空
            return 1
        fi
    fi
    echo "[ERROR] 需要 Python3 和 bcrypt 库支持。请先安装： pip install bcrypt" >&2
    return 1
}

# 创建管理员账户
create_admin_user() {
    print_info "创建管理员账户..."
    
    # 获取管理员信息
    read -p "请输入管理员用户名 (默认: admin): " admin_username
    admin_username=${admin_username:-admin}
    
    read -p "请输入管理员邮箱 (默认: admin@example.com): " admin_email
    admin_email=${admin_email:-admin@example.com}
    
    while true; do
        read -s -p "请输入管理员密码: " admin_password
        echo
        read -s -p "请再次确认密码: " admin_password_confirm
        echo
        
        if [ "$admin_password" = "$admin_password_confirm" ]; then
            break
        else
            print_warn "两次输入的密码不一致，请重新输入"
        fi
    done
    
    # 生成密码哈希
    print_info "正在生成安全的 bcrypt 密码哈希..."
    password_hash=$(generate_password_hash "$admin_password")
    if [ -z "$password_hash" ]; then
        print_error "密码哈希生成失败，请确保已安装 Python3 和 bcrypt 库 (pip install bcrypt)"
        exit 1
    fi
    
    # 插入管理员账户
    mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" <<EOF
INSERT INTO sys_user (name, email, password_hash, role) 
VALUES ('$admin_username', '$admin_email', '$password_hash', 1)
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    password_hash = VALUES(password_hash),
    role = VALUES(role);
EOF
    
    if [ $? -eq 0 ]; then
        print_info "管理员账户创建成功！"
        print_info "用户名: $admin_username"
        print_info "邮箱: $admin_email"
        print_info "角色: 管理员"
    else
        print_error "管理员账户创建失败"
        exit 1
    fi
}

# 执行SQL初始化脚本
run_sql_init() {
    if [ -f "database_role_init.sql" ]; then
        print_info "执行数据库初始化脚本..."
        mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < database_role_init.sql
        if [ $? -eq 0 ]; then
            print_info "数据库初始化脚本执行成功"
        else
            print_warn "数据库初始化脚本执行时出现问题，但不影响核心功能"
        fi
    else
        print_warn "未找到database_role_init.sql文件，跳过扩展功能初始化"
    fi
}

# 验证安装
verify_installation() {
    print_info "验证安装结果..."
    
    # 检查表是否存在
    table_count=$(mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SHOW TABLES LIKE 'sys_user';" | wc -l)
    if [ $table_count -gt 1 ]; then
        print_info "✓ sys_user表存在"
    else
        print_error "✗ sys_user表不存在"
        return 1
    fi
    
    # 检查管理员用户是否存在
    admin_count=$(mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SELECT COUNT(*) FROM sys_user WHERE role = 1;" | tail -1)
    if [ "$admin_count" -gt 0 ]; then
        print_info "✓ 管理员账户已创建 (共 $admin_count 个)"
    else
        print_error "✗ 未找到管理员账户"
        return 1
    fi
    
    print_info "安装验证完成！"
    return 0
}

# 主函数
main() {
    print_info "开始为现有数据库添加角色系统..."
    print_info "================================"
    
    # 提示用户确认数据库配置
    echo "当前数据库配置："
    echo "  主机: $DB_HOST"
    echo "  用户: $DB_USER"
    echo "  数据库: $DB_NAME"
    echo
    echo "注意：此脚本将修改现有的数据库表结构！"
    read -p "请确认配置正确并继续，或按Ctrl+C取消: "
    
    # 执行初始化步骤
    check_mysql
    check_database
    check_or_create_user_table
    run_sql_init
    create_admin_user
    
    # 验证安装
    if verify_installation; then
        print_info "================================"
        print_info "数据库角色系统升级完成！"
        print_info "您现在可以启动应用程序并使用管理员账户登录。"
        print_info "管理员将可以访问位于 /admin.html 的管理界面。"
    else
        print_error "升级过程中出现问题，请检查错误信息"
        exit 1
    fi
}

# 如果直接运行此脚本，执行主函数
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
