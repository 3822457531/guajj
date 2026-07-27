-- AlterTable
ALTER TABLE `GuestUser` ADD COLUMN `isAgent` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `agentAt` DATETIME(3) NULL,
    ADD COLUMN `agentWalletYuan` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `GuestUser_isAgent_idx` ON `GuestUser`(`isAgent`);

-- CreateTable
CREATE TABLE `AgentConfig` (
    `key` VARCHAR(64) NOT NULL,
    `value` TEXT NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgentPackage` (
    `id` VARCHAR(30) NOT NULL,
    `title` VARCHAR(128) NOT NULL,
    `goodsKey` VARCHAR(64) NOT NULL,
    `priceYuan` DECIMAL(10, 2) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AgentPackage_enabled_sortOrder_idx`(`enabled`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgentOrder` (
    `id` VARCHAR(30) NOT NULL,
    `guestUserId` VARCHAR(30) NOT NULL,
    `packageId` VARCHAR(30) NOT NULL,
    `tradeNo` VARCHAR(64) NULL,
    `channelId` INTEGER NOT NULL,
    `channelName` VARCHAR(32) NOT NULL,
    `totalAmount` DECIMAL(10, 2) NULL,
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

    UNIQUE INDEX `AgentOrder_tradeNo_key`(`tradeNo`),
    INDEX `AgentOrder_guestUserId_createdAt_idx`(`guestUserId`, `createdAt`),
    INDEX `AgentOrder_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgentCommission` (
    `id` VARCHAR(30) NOT NULL,
    `beneficiaryId` VARCHAR(30) NOT NULL,
    `fromGuestId` VARCHAR(30) NOT NULL,
    `guapiOrderId` VARCHAR(30) NOT NULL,
    `level` ENUM('direct', 'indirect') NOT NULL,
    `orderAmount` DECIMAL(10, 2) NOT NULL,
    `rate` DECIMAL(6, 4) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AgentCommission_beneficiaryId_createdAt_idx`(`beneficiaryId`, `createdAt`),
    INDEX `AgentCommission_fromGuestId_createdAt_idx`(`fromGuestId`, `createdAt`),
    UNIQUE INDEX `AgentCommission_guapiOrderId_level_key`(`guapiOrderId`, `level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgentWithdrawal` (
    `id` VARCHAR(30) NOT NULL,
    `guestUserId` VARCHAR(30) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `channel` ENUM('alipay', 'wechat') NOT NULL,
    `account` VARCHAR(128) NOT NULL,
    `accountName` VARCHAR(64) NULL,
    `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `adminNote` VARCHAR(255) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AgentWithdrawal_guestUserId_createdAt_idx`(`guestUserId`, `createdAt`),
    INDEX `AgentWithdrawal_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AgentOrder` ADD CONSTRAINT `AgentOrder_guestUserId_fkey` FOREIGN KEY (`guestUserId`) REFERENCES `GuestUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentOrder` ADD CONSTRAINT `AgentOrder_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `AgentPackage`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentCommission` ADD CONSTRAINT `AgentCommission_beneficiaryId_fkey` FOREIGN KEY (`beneficiaryId`) REFERENCES `GuestUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentCommission` ADD CONSTRAINT `AgentCommission_fromGuestId_fkey` FOREIGN KEY (`fromGuestId`) REFERENCES `GuestUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentWithdrawal` ADD CONSTRAINT `AgentWithdrawal_guestUserId_fkey` FOREIGN KEY (`guestUserId`) REFERENCES `GuestUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
