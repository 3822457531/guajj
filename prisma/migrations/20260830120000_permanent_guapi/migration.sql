-- 永久瓜皮：注册礼 / 签到配置 + 签到时间；余额迁移自 searchBonus
ALTER TABLE `SiteSettings`
  ADD COLUMN `registerGuapiGift` INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN `checkInGuapiGift` INTEGER NOT NULL DEFAULT 1;

ALTER TABLE `GuestUser`
  ADD COLUMN `lastCheckInAt` DATETIME(3) NULL;

-- 旧「邀请/购买累加到 searchBonus」迁入可用余额；每日基础额度不再自动发放
UPDATE `GuestUser`
SET `guapiBalance` = GREATEST(0, `searchBonus`)
WHERE `guapiBalance` = 0 AND `searchBonus` > 0;
