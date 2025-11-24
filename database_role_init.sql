-- 数据库角色管理系统升级脚本
-- 此脚本用于为现有数据库添加角色支持和创建管理员账户

-- 1. 检查并添加角色字段（如果不存在）
-- 使用 IF NOT EXISTS 的替代方案，先检查列是否存在
SET @column_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sys_user' AND COLUMN_NAME = 'role');

SET @sql = IF(@column_exists = 0, 
    'ALTER TABLE sys_user ADD COLUMN role TINYINT DEFAULT 0 COMMENT ''用户角色: 0=普通用户, 1=管理员''', 
    'SELECT ''角色列已存在，跳过添加'' as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. 更新索引以提高查询性能
CREATE INDEX idx_user_role ON sys_user(role);
CREATE INDEX idx_user_email_role ON sys_user(email, role);

-- 3. 创建一个默认管理员账户
-- 密码是 "admin123"，这里使用了简单的示例哈希值
-- 实际部署时应该使用更复杂的密码和更安全的哈希算法
INSERT INTO sys_user (username, email, password_hash, role) 
VALUES ('admin', 'admin@example.com', '$6$rounds=656000$YourSaltHere$HashedPasswordHere', 1)
ON DUPLICATE KEY UPDATE 
  username = VALUES(username),
  password_hash = VALUES(password_hash),
  role = VALUES(role);

-- 4. 可选：创建角色权限表（为将来扩展准备）
CREATE TABLE IF NOT EXISTS sys_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL COMMENT '权限名称',
    description VARCHAR(200) COMMENT '权限描述',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT='系统权限表';

-- 插入基本权限
INSERT INTO sys_permissions (name, description) VALUES
('user_management', '用户管理权限'),
('system_settings', '系统设置权限'),
('log_management', '日志管理权限'),
('backup_management', '备份管理权限'),
('security_management', '安全管理权限')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- 5. 创建角色权限关联表
CREATE TABLE IF NOT EXISTS sys_role_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role TINYINT NOT NULL COMMENT '角色: 0=普通用户, 1=管理员',
    permission_id INT NOT NULL COMMENT '权限ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (permission_id) REFERENCES sys_permissions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_role_permission (role, permission_id)
) COMMENT='角色权限关联表';

-- 给管理员角色分配所有权限
INSERT INTO sys_role_permissions (role, permission_id)
SELECT 1, id FROM sys_permissions
ON DUPLICATE KEY UPDATE role = VALUES(role);

-- 6. 创建用户登录日志表（用于安全审计）
CREATE TABLE IF NOT EXISTS sys_login_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_email VARCHAR(100) NOT NULL COMMENT '用户邮箱',
    ip_address VARCHAR(45) COMMENT '登录IP地址',
    user_agent TEXT COMMENT '用户代理信息',
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
    status TINYINT DEFAULT 1 COMMENT '登录状态: 1=成功, 0=失败',
    failure_reason VARCHAR(200) COMMENT '失败原因',
    INDEX idx_user_email (user_email),
    INDEX idx_login_time (login_time),
    INDEX idx_ip_address (ip_address)
) COMMENT='用户登录日志表';

-- 7. 创建系统操作日志表（用于管理员操作审计）
CREATE TABLE IF NOT EXISTS sys_operation_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_email VARCHAR(100) NOT NULL COMMENT '操作用户邮箱',
    operation_type VARCHAR(50) NOT NULL COMMENT '操作类型',
    operation_desc TEXT COMMENT '操作描述',
    target_type VARCHAR(50) COMMENT '操作目标类型',
    target_id VARCHAR(100) COMMENT '操作目标ID',
    ip_address VARCHAR(45) COMMENT '操作IP地址',
    operation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
    status TINYINT DEFAULT 1 COMMENT '操作状态: 1=成功, 0=失败',
    error_message TEXT COMMENT '错误信息',
    INDEX idx_user_email (user_email),
    INDEX idx_operation_type (operation_type),
    INDEX idx_operation_time (operation_time)
) COMMENT='系统操作日志表';

-- 8. 创建一个视图来方便查询用户信息和角色
CREATE VIEW view_user_info AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.role,
    CASE 
        WHEN u.role = 1 THEN '管理员'
        WHEN u.role = 0 THEN '普通用户'
        ELSE '未知角色'
    END as role_name,
    u.created_at,
    u.updated_at
FROM sys_user u;

-- 9. 创建存储过程来安全地验证用户登录
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS sp_validate_user_login(
    IN p_email VARCHAR(100),
    IN p_ip_address VARCHAR(45),
    IN p_user_agent TEXT
)
BEGIN
    DECLARE v_user_count INT DEFAULT 0;
    DECLARE v_user_role TINYINT DEFAULT 0;
    
    -- 检查用户是否存在
    SELECT COUNT(*), COALESCE(role, 0) INTO v_user_count, v_user_role
    FROM sys_user 
    WHERE email = p_email;
    
    -- 记录登录尝试
    INSERT INTO sys_login_logs (user_email, ip_address, user_agent, status, failure_reason)
    VALUES (
        p_email, 
        p_ip_address, 
        p_user_agent, 
        CASE WHEN v_user_count > 0 THEN 1 ELSE 0 END,
        CASE WHEN v_user_count = 0 THEN '用户不存在' ELSE NULL END
    );
    
    -- 返回用户信息
    SELECT v_user_count as user_exists, v_user_role as user_role;
END //
DELIMITER ;

-- 10. 创建存储过程来记录管理员操作
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS sp_log_admin_operation(
    IN p_user_email VARCHAR(100),
    IN p_operation_type VARCHAR(50),
    IN p_operation_desc TEXT,
    IN p_target_type VARCHAR(50),
    IN p_target_id VARCHAR(100),
    IN p_ip_address VARCHAR(45),
    IN p_status TINYINT,
    IN p_error_message TEXT
)
BEGIN
    INSERT INTO sys_operation_logs (
        user_email, operation_type, operation_desc, 
        target_type, target_id, ip_address, 
        status, error_message
    ) VALUES (
        p_user_email, p_operation_type, p_operation_desc,
        p_target_type, p_target_id, p_ip_address,
        p_status, p_error_message
    );
END //
DELIMITER ;

-- 检查和显示当前表结构
SHOW CREATE TABLE sys_user;

-- 显示当前所有用户和角色信息
SELECT * FROM view_user_info;
