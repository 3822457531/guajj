-- CreateTable
CREATE TABLE `TgSourceChannel` (
    `id` VARCHAR(30) NOT NULL,
    `chatId` VARCHAR(32) NULL,
    `username` VARCHAR(64) NULL,
    `title` VARCHAR(255) NULL,
    `inviteLink` VARCHAR(512) NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `lastMessageId` INT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TgSourceChannel_chatId_key`(`chatId`),
    INDEX `TgSourceChannel_isEnabled_idx`(`isEnabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
