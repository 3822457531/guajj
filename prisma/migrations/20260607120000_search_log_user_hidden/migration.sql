-- 用户端软删除搜索记录（管理员仍可见）
ALTER TABLE `SearchLog` ADD COLUMN `userHiddenAt` DATETIME(3) NULL;

CREATE INDEX `SearchLog_guestUserId_source_userHiddenAt_createdAt_idx` ON `SearchLog`(`guestUserId`, `source`, `userHiddenAt`, `createdAt`);
