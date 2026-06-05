-- 开发环境：清空 chigua 库并重建（解决迁移失败后的脏状态）
-- 用法: npx prisma db execute --file scripts/mysql-reset.sql

DROP DATABASE IF EXISTS `chigua`;
CREATE DATABASE `chigua` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
