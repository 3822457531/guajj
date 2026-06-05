-- AlterTable
ALTER TABLE `GuestUser` ADD COLUMN `registerIp` VARCHAR(45) NULL,
    ADD COLUMN `lastLoginIp` VARCHAR(45) NULL,
    ADD COLUMN `lastLoginAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `GuestUser_createdAt_idx` ON `GuestUser`(`createdAt`);
CREATE INDEX `GuestUser_lastLoginAt_idx` ON `GuestUser`(`lastLoginAt`);
