-- CreateTable
CREATE TABLE `AdminUser` (
    `id` VARCHAR(30) NOT NULL,
    `username` VARCHAR(64) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AdminUser_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SiteSettings` (
    `id` VARCHAR(16) NOT NULL DEFAULT 'main',
    `allowAnonymousComments` BOOLEAN NOT NULL DEFAULT true,
    `mediaStorage` VARCHAR(32) NOT NULL DEFAULT 'local',
    `r2AccountId` VARCHAR(64) NULL,
    `r2BucketName` VARCHAR(128) NULL,
    `r2PublicBaseUrl` VARCHAR(512) NULL,
    `r2AccessKeyId` VARCHAR(128) NULL,
    `r2SecretAccessKey` VARCHAR(255) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `slug` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Category_name_key`(`name`),
    UNIQUE INDEX `Category_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tag` (
    `id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `slug` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Tag_name_key`(`name`),
    UNIQUE INDEX `Tag_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PostTag` (
    `postId` VARCHAR(30) NOT NULL,
    `tagId` VARCHAR(30) NOT NULL,

    PRIMARY KEY (`postId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Post` (
    `id` VARCHAR(30) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `summary` TEXT NOT NULL,
    `body` LONGTEXT NOT NULL,
    `type` ENUM('ARTICLE', 'VIDEO', 'GALLERY') NOT NULL DEFAULT 'ARTICLE',
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `coverUrl` VARCHAR(512) NOT NULL,
    `videoUrl` VARCHAR(512) NULL,
    `galleryVideoUrls` LONGTEXT NULL,
    `galleryImageUrls` LONGTEXT NULL,
    `contentBlocks` LONGTEXT NULL,
    `isPinned` BOOLEAN NOT NULL DEFAULT false,
    `heat` INTEGER NOT NULL DEFAULT 100,
    `views` INTEGER NOT NULL DEFAULT 0,
    `publishedAt` DATETIME(3) NULL,
    `categoryId` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Post_status_isPinned_createdAt_idx`(`status`, `isPinned`, `createdAt`),
    INDEX `Post_status_publishedAt_idx`(`status`, `publishedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SocialUser` (
    `id` VARCHAR(30) NOT NULL,
    `socialUid` VARCHAR(128) NOT NULL,
    `loginType` VARCHAR(32) NOT NULL,
    `nickname` VARCHAR(128) NOT NULL,
    `faceimg` VARCHAR(512) NOT NULL,
    `gender` VARCHAR(16) NULL,
    `location` VARCHAR(128) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SocialUser_loginType_socialUid_key`(`loginType`, `socialUid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OAuthLoginState` (
    `id` VARCHAR(64) NOT NULL,
    `returnPath` VARCHAR(512) NOT NULL,
    `oauthType` VARCHAR(32) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OAuthLoginState_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Comment` (
    `id` VARCHAR(30) NOT NULL,
    `postId` VARCHAR(30) NOT NULL,
    `authorId` VARCHAR(30) NOT NULL,
    `parentId` VARCHAR(30) NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Comment_postId_parentId_idx`(`postId`, `parentId`),
    INDEX `Comment_postId_createdAt_idx`(`postId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MediaAsset` (
    `id` VARCHAR(30) NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `url` VARCHAR(512) NOT NULL,
    `type` ENUM('IMAGE', 'VIDEO', 'OTHER') NOT NULL,
    `size` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TelegramConfig` (
    `id` VARCHAR(30) NOT NULL,
    `botToken` VARCHAR(255) NOT NULL,
    `channelId` VARCHAR(64) NOT NULL,
    `channelName` VARCHAR(128) NULL,
    `webhookSecret` VARCHAR(64) NOT NULL,
    `defaultCategoryId` VARCHAR(30) NOT NULL,
    `defaultStatus` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `autoPublish` BOOLEAN NOT NULL DEFAULT false,
    `downloadMedia` BOOLEAN NOT NULL DEFAULT true,
    `isEnabled` BOOLEAN NOT NULL DEFAULT false,
    `lastUpdateId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TelegramConfig_webhookSecret_key`(`webhookSecret`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TelegramImport` (
    `id` VARCHAR(30) NOT NULL,
    `updateId` INTEGER NULL,
    `messageId` INTEGER NOT NULL,
    `chatId` VARCHAR(32) NOT NULL,
    `chatTitle` VARCHAR(255) NULL,
    `rawText` LONGTEXT NOT NULL,
    `mediaType` VARCHAR(32) NULL,
    `mediaUrl` VARCHAR(512) NULL,
    `mediaGroupId` VARCHAR(64) NULL,
    `postId` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TelegramImport_chatId_mediaGroupId_idx`(`chatId`, `mediaGroupId`),
    UNIQUE INDEX `TelegramImport_chatId_messageId_key`(`chatId`, `messageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TgIndexedMessage` (
    `id` VARCHAR(30) NOT NULL,
    `chatId` VARCHAR(32) NOT NULL,
    `messageId` INTEGER NOT NULL,
    `messageDate` DATETIME(3) NOT NULL,
    `contentType` ENUM('VIDEO', 'PHOTO', 'DOCUMENT', 'TEXT') NOT NULL DEFAULT 'TEXT',
    `title` VARCHAR(500) NOT NULL,
    `snippet` TEXT NOT NULL,
    `rawText` LONGTEXT NOT NULL,
    `sourceTitle` VARCHAR(255) NULL,
    `sourceUsername` VARCHAR(64) NULL,
    `durationSec` INTEGER NULL,
    `mediaUrl` VARCHAR(512) NULL,
    `mediaGroupId` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TgIndexedMessage_messageDate_idx`(`messageDate`),
    UNIQUE INDEX `TgIndexedMessage_chatId_messageId_key`(`chatId`, `messageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PostTag` ADD CONSTRAINT `PostTag_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostTag` ADD CONSTRAINT `PostTag_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `Tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `SocialUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Comment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TelegramImport` ADD CONSTRAINT `TelegramImport_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- VIP 中文全文检索（ngram）
CREATE FULLTEXT INDEX `TgIndexedMessage_ft_ngram` ON `TgIndexedMessage`(`title`, `snippet`, `rawText`) WITH PARSER ngram;
