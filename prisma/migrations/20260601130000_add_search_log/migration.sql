-- CreateTable
CREATE TABLE `SearchLog` (
    `id` VARCHAR(30) NOT NULL,
    `keyword` VARCHAR(191) NOT NULL,
    `visitorId` VARCHAR(64) NOT NULL,
    `ip` VARCHAR(45) NOT NULL,
    `socialUserId` VARCHAR(30) NULL,
    `resultCount` INTEGER NOT NULL DEFAULT 0,
    `userAgent` VARCHAR(512) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SearchLog_createdAt_idx`(`createdAt`),
    INDEX `SearchLog_keyword_createdAt_idx`(`keyword`, `createdAt`),
    INDEX `SearchLog_visitorId_createdAt_idx`(`visitorId`, `createdAt`),
    INDEX `SearchLog_socialUserId_createdAt_idx`(`socialUserId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SearchLog` ADD CONSTRAINT `SearchLog_socialUserId_fkey` FOREIGN KEY (`socialUserId`) REFERENCES `SocialUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
