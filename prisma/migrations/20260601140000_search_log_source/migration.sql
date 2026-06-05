-- AlterTable
ALTER TABLE `SearchLog` ADD COLUMN `source` ENUM('HOME', 'VIP') NOT NULL DEFAULT 'HOME';

-- CreateIndex
CREATE INDEX `SearchLog_source_createdAt_idx` ON `SearchLog`(`source`, `createdAt`);
CREATE INDEX `SearchLog_source_keyword_createdAt_idx` ON `SearchLog`(`source`, `keyword`, `createdAt`);

-- DropIndex
DROP INDEX `SearchLog_keyword_createdAt_idx` ON `SearchLog`;
