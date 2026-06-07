-- 全网搜索独立配额 + SearchSource.GLOBAL
ALTER TABLE `SiteSettings` ADD COLUMN `globalDailySearchLimit` INTEGER NOT NULL DEFAULT 5;

ALTER TABLE `SearchLog` MODIFY COLUMN `source` ENUM('HOME', 'VIP', 'GLOBAL') NOT NULL DEFAULT 'HOME';
