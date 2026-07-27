-- CreateTable
CREATE TABLE `PayConfig` (
    `key` VARCHAR(64) NOT NULL,
    `value` TEXT NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuapiPackage` (
    `id` VARCHAR(30) NOT NULL,
    `title` VARCHAR(128) NOT NULL,
    `goodsKey` VARCHAR(64) NOT NULL,
    `guapiAmount` INTEGER NOT NULL,
    `priceYuan` DECIMAL(10, 2) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GuapiPackage_enabled_sortOrder_idx`(`enabled`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuapiOrder` (
    `id` VARCHAR(30) NOT NULL,
    `guestUserId` VARCHAR(30) NOT NULL,
    `packageId` VARCHAR(30) NOT NULL,
    `tradeNo` VARCHAR(64) NULL,
    `channelId` INTEGER NOT NULL,
    `channelName` VARCHAR(32) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `totalAmount` DECIMAL(10, 2) NULL,
    `guapiAmount` INTEGER NOT NULL,
    `payUrl` VARCHAR(512) NULL,
    `shopSessionCookie` VARCHAR(512) NULL,
    `status` ENUM('pending', 'paid', 'closed') NOT NULL DEFAULT 'pending',
    `paidAt` DATETIME(3) NULL,
    `fulfilledAt` DATETIME(3) NULL,
    `contact` VARCHAR(64) NOT NULL,
    `rawCreateResp` TEXT NULL,
    `rawQueryResp` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GuapiOrder_tradeNo_key`(`tradeNo`),
    INDEX `GuapiOrder_guestUserId_createdAt_idx`(`guestUserId`, `createdAt`),
    INDEX `GuapiOrder_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GuapiOrder` ADD CONSTRAINT `GuapiOrder_guestUserId_fkey` FOREIGN KEY (`guestUserId`) REFERENCES `GuestUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuapiOrder` ADD CONSTRAINT `GuapiOrder_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `GuapiPackage`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
