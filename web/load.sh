#!/bin/bash
set -e

# 备份目录和目标目录
SRC_DIR="/var/www/html"
BACKUP_BASE="/var/www/html_backup"
WEB_SRC="$(dirname "$0")"

# 获取当前时间作为备份文件夹名
TIME_STR=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="$BACKUP_BASE/$TIME_STR"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 备份原有文件
cp -a "$SRC_DIR/." "$BACKUP_DIR/"

# 覆盖复制 web 下所有文件到目标目录
cp -a "$WEB_SRC/." "$SRC_DIR/"

echo "备份完成，web文件已更新到 $SRC_DIR。备份目录：$BACKUP_DIR"