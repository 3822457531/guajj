import { prisma } from "@/lib/prisma";

const KEY_WECHAT_CHANNEL = "wechat_channel_id";

/** 支付宝 */
export const PAY_CHANNEL_ALIPAY = 32;
/** 微信 */
export const PAY_CHANNEL_WECHAT = 33;
/** 微信推荐（默认） */
export const PAY_CHANNEL_WECHAT_RECOMMENDED = 34;

export const PAY_CHANNELS = [
  { id: PAY_CHANNEL_ALIPAY, name: "支付宝", kind: "alipay" as const },
  { id: PAY_CHANNEL_WECHAT, name: "微信", kind: "wechat" as const },
  { id: PAY_CHANNEL_WECHAT_RECOMMENDED, name: "微信推荐", kind: "wechat" as const }
] as const;

export async function getPayConfig(key: string): Promise<string | null> {
  const row = await prisma.payConfig.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setPayConfig(key: string, value: string) {
  await prisma.payConfig.upsert({
    where: { key },
    create: { key, value },
    update: { value }
  });
}

export async function getWechatChannelId(): Promise<number> {
  const v = await getPayConfig(KEY_WECHAT_CHANNEL);
  const n = Number(v);
  if (n === PAY_CHANNEL_WECHAT || n === PAY_CHANNEL_WECHAT_RECOMMENDED) return n;
  return PAY_CHANNEL_WECHAT_RECOMMENDED;
}

export async function setWechatChannelId(channelId: number) {
  const id =
    channelId === PAY_CHANNEL_WECHAT || channelId === PAY_CHANNEL_WECHAT_RECOMMENDED
      ? channelId
      : PAY_CHANNEL_WECHAT_RECOMMENDED;
  await setPayConfig(KEY_WECHAT_CHANNEL, String(id));
}

export function channelNameOf(channelId: number): string {
  return PAY_CHANNELS.find((c) => c.id === channelId)?.name ?? `渠道${channelId}`;
}

export function isAllowedPayChannel(channelId: number, wechatDefault: number): boolean {
  if (channelId === PAY_CHANNEL_ALIPAY) return true;
  return channelId === wechatDefault || channelId === PAY_CHANNEL_WECHAT || channelId === PAY_CHANNEL_WECHAT_RECOMMENDED;
}
