-- CreateTable
CREATE TABLE `GlobalSearchCache` (
    `id` VARCHAR(30) NOT NULL,
    `keyword` VARCHAR(191) NOT NULL,
    `guestUserId` VARCHAR(30) NOT NULL,
    `channelCount` INTEGER NOT NULL DEFAULT 0,
    `payload` JSON NOT NULL,
    `sourceFetchedAt` DATETIME(3) NULL,
    `userHiddenAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GlobalSearchCache_guestUserId_keyword_key`(`guestUserId`, `keyword`),
    INDEX `GlobalSearchCache_guestUserId_userHiddenAt_updatedAt_idx`(`guestUserId`, `userHiddenAt`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GlobalSearchCache` ADD CONSTRAINT `GlobalSearchCache_guestUserId_fkey` FOREIGN KEY (`guestUserId`) REFERENCES `GuestUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
