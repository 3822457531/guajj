-- AlterTable: TgIndexedMessage 多图/多视频（与 Post 字段对齐）
ALTER TABLE `TgIndexedMessage`
  ADD COLUMN `galleryImageUrls` LONGTEXT NULL,
  ADD COLUMN `galleryVideoUrls` LONGTEXT NULL,
  ADD COLUMN `contentBlocks` LONGTEXT NULL;
