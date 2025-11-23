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

# MySQL

## 用户字段存储

```mysql
```



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

