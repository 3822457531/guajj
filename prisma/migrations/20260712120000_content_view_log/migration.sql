-- CreateTable
CREATE TABLE `ContentViewLog` (
    `id` VARCHAR(30) NOT NULL,
    `guestUserId` VARCHAR(30) NOT NULL,
    `username` VARCHAR(64) NOT NULL,
    `messageId` INTEGER NOT NULL,
    `title` VARCHAR(500) NULL,
    `label` VARCHAR(255) NULL,
    `searchQuery` VARCHAR(191) NULL,
    `userHiddenAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ContentViewLog_guestUserId_username_messageId_key`(`guestUserId`, `username`, `messageId`),
    INDEX `ContentViewLog_guestUserId_userHiddenAt_updatedAt_idx`(`guestUserId`, `userHiddenAt`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ContentViewLog` ADD CONSTRAINT `ContentViewLog_guestUserId_fkey` FOREIGN KEY (`guestUserId`) REFERENCES `GuestUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
