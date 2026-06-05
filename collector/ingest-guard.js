/**
 * 采集入库时间水位：只接受 messageDate 严格晚于该频道已入库最新消息时间的帖子
 */

function messageDateFromMsg(msg) {
  return msg.date ? new Date(msg.date * 1000) : new Date();
}

/** @param {Date | undefined | null} floor */
function isNewerThanFloor(messageDate, floor) {
  if (!floor) return true;
  return messageDate.getTime() > floor.getTime();
}

/**
 * 各频道已入库的最大 messageDate；无记录时用 fallback（通常为采集启动时刻）
 * @param {import('../lib/generated/prisma').PrismaClient} prisma
 * @param {string[]} chatIds
 * @param {Date} fallbackDate
 */
async function loadLastIndexedDates(prisma, chatIds, fallbackDate) {
  const map = new Map();
  for (const chatId of chatIds) {
    const row = await prisma.tgIndexedMessage.findFirst({
      where: { chatId },
      orderBy: { messageDate: "desc" },
      select: { messageDate: true }
    });
    map.set(chatId, row?.messageDate ?? fallbackDate);
  }
  return map;
}

function bumpLastIndexedDate(map, chatId, messageDate) {
  const prev = map.get(chatId);
  if (!prev || messageDate.getTime() > prev.getTime()) {
    map.set(chatId, messageDate);
  }
}

module.exports = {
  messageDateFromMsg,
  isNewerThanFloor,
  loadLastIndexedDates,
  bumpLastIndexedDate
};
