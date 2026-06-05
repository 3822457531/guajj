-- AlterTable
ALTER TABLE `SiteSettings` ADD COLUMN `dailySearchLimit` INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN `referralSearchBonus` INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE `GuestUser` (
    `id` VARCHAR(30) NOT NULL,
    `publicId` VARCHAR(32) NOT NULL,
    `secretKeyHash` VARCHAR(255) NOT NULL,
    `referrerId` VARCHAR(30) NULL,
    `searchBonus` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GuestUser_publicId_key`(`publicId`),
    INDEX `GuestUser_referrerId_idx`(`referrerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `SearchLog` ADD COLUMN `guestUserId` VARCHAR(30) NULL;

-- CreateIndex
CREATE INDEX `SearchLog_guestUserId_createdAt_idx` ON `SearchLog`(`guestUserId`, `createdAt`);

-- AddForeignKey
ALTER TABLE `GuestUser` ADD CONSTRAINT `GuestUser_referrerId_fkey` FOREIGN KEY (`referrerId`) REFERENCES `GuestUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SearchLog` ADD CONSTRAINT `SearchLog_guestUserId_fkey` FOREIGN KEY (`guestUserId`) REFERENCES `GuestUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
