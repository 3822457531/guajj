-- CreateTable
CREATE TABLE `JisouHotSearchSnapshot` (
    `id` VARCHAR(30) NOT NULL,
    `keywordCount` INTEGER NOT NULL DEFAULT 0,
    `items` JSON NOT NULL,
    `sourceFetchedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `JisouHotSearchSnapshot_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
