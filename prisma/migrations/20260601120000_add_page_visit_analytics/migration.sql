-- CreateTable
CREATE TABLE `PageVisit` (
    `id` VARCHAR(30) NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(30) NULL,
    `visitorId` VARCHAR(64) NOT NULL,
    `ip` VARCHAR(45) NOT NULL,
    `socialUserId` VARCHAR(30) NULL,
    `userAgent` VARCHAR(512) NULL,
    `referrer` VARCHAR(512) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PageVisit_createdAt_idx`(`createdAt`),
    INDEX `PageVisit_path_createdAt_idx`(`path`, `createdAt`),
    INDEX `PageVisit_socialUserId_createdAt_idx`(`socialUserId`, `createdAt`),
    INDEX `PageVisit_visitorId_createdAt_idx`(`visitorId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DailySiteStat` (
    `id` VARCHAR(30) NOT NULL,
    `date` DATE NOT NULL,
    `pageViews` INTEGER NOT NULL DEFAULT 0,
    `uniqueVisitors` INTEGER NOT NULL DEFAULT 0,
    `loggedInPageViews` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DailySiteStat_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PageVisit` ADD CONSTRAINT `PageVisit_socialUserId_fkey` FOREIGN KEY (`socialUserId`) REFERENCES `SocialUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
