-- AlterTable
ALTER TABLE `SiteSettings` ADD COLUMN `homeFeedMode` VARCHAR(16) NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE `TgIndexedMessage` ADD COLUMN `isPinned` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `TgIndexedMessage` ADD COLUMN `heat` INTEGER NOT NULL DEFAULT 100;

-- CreateIndex
CREATE INDEX `TgIndexedMessage_isPinned_messageDate_idx` ON `TgIndexedMessage`(`isPinned`, `messageDate`);
