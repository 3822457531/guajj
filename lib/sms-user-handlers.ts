import { prisma } from "@/lib/prisma";
import * as luban from "@/lib/luban-sms";
import { getLubanApikey, getSmsPricing } from "@/lib/sms-config";
import {
  INSUFFICIENT_GUAPI_CODE,
  deductGuestGuapi,
  getGuestGuapiRemaining,
  logSmsAction
} from "@/lib/sms-guapi";

function insufficientGuapi(remaining: number, required: number) {
  return {
    ok: false,
    code: 402,
    message: "瓜皮不足，请联系管理员充值或邀请好友",
    data: { code: INSUFFICIENT_GUAPI_CODE, balance: remaining, required }
  };
}

export async function smsGetBalance(guestUserId: string) {
  const quota = await getGuestGuapiRemaining(guestUserId);
  return {
    ok: true,
    data: {
      remaining: quota.remaining,
      limit: quota.limit,
      used: quota.used,
      balance: quota.remaining
    }
  };
}

export async function smsGetBalanceLog(guestUserId: string, page: number, size: number) {
  const skip = (page - 1) * size;
  const [list, total] = await Promise.all([
    prisma.smsGuapiLog.findMany({
      where: { guestUserId },
      orderBy: { createdAt: "desc" },
      skip,
      take: size,
      select: { id: true, amount: true, type: true, description: true, createdAt: true }
    }),
    prisma.smsGuapiLog.count({ where: { guestUserId } })
  ]);
  return { ok: true, data: { list, total, page, size } };
}

export async function smsRequestNumber(guestUserId: string, phone: string, cardType: string) {
  const apikey = await getLubanApikey();
  if (!apikey) {
    return { ok: false, code: 500, message: "系统未配置 LubanSMS API Key，请联系管理员" };
  }

  const pricing = await getSmsPricing();
  const quota = await getGuestGuapiRemaining(guestUserId);
  const price = pricing.get_number;
  if (quota.remaining < price) return insufficientGuapi(quota.remaining, price);

  const data = await luban.getKeywordNumber(apikey, phone, cardType);
  if (data.code !== 0) return data;

  await deductGuestGuapi(guestUserId, price, "consume_get_number", `请求号码 ${data.phone}`);
  await prisma.smsNumberRecord.create({
    data: { guestUserId, phone: String(data.phone || "") }
  });
  await logSmsAction({
    guestUserId,
    action: "getNumber",
    phone: String(data.phone || ""),
    rawResponse: data
  });

  return data;
}

export async function smsFetchSms(guestUserId: string, phone: string, keyword: string) {
  const apikey = await getLubanApikey();
  if (!apikey) return { ok: false, code: 500, message: "系统未配置 API Key" };
  if (!phone || !keyword) return { ok: false, code: 400, message: "缺少 phone 或 keyword" };

  const pricing = await getSmsPricing();
  const quota = await getGuestGuapiRemaining(guestUserId);
  const price = pricing.get_sms;
  if (quota.remaining < price) return insufficientGuapi(quota.remaining, price);

  const data = await luban.getKeywordSms(apikey, phone, keyword);
  if (data.code !== 0) return data;

  await deductGuestGuapi(guestUserId, price, "consume_get_sms", `获取短信 ${keyword}`);
  await prisma.smsUserRecord.create({
    data: {
      guestUserId,
      phone,
      message: String(data.msg || ""),
      keyword
    }
  });
  await logSmsAction({
    guestUserId,
    action: "getSms",
    phone,
    keyword,
    message: String(data.msg || ""),
    rawResponse: data
  });

  return data;
}

export async function smsReleaseNumber(guestUserId: string, phone: string) {
  const apikey = await getLubanApikey();
  if (!apikey) return { ok: false, code: 500, message: "系统未配置 API Key" };
  if (!phone) return { ok: false, code: 400, message: "缺少 phone" };

  const data = await luban.delKeywordNumber(apikey, phone);
  if (data.code === 0) {
    await prisma.smsNumberRecord.updateMany({
      where: { guestUserId, phone, releasedAt: null },
      data: { releasedAt: new Date() }
    });
    await logSmsAction({ guestUserId, action: "releaseNumber", phone, rawResponse: data });
  }
  return data;
}

export async function smsGetHistory(guestUserId: string, page: number, size: number) {
  const skip = (page - 1) * size;
  const [rows, total] = await Promise.all([
    prisma.smsUserRecord.findMany({
      where: { guestUserId },
      orderBy: { createdAt: "desc" },
      skip,
      take: size
    }),
    prisma.smsUserRecord.count({ where: { guestUserId } })
  ]);
  const list = rows.map((r) => ({
    time: r.createdAt.toISOString(),
    phone: r.phone,
    message: r.message,
    provider: r.provider
  }));
  return { ok: true, code: 0, msg: list, list, total, page, size };
}

export async function smsSendBulk(
  guestUserId: string,
  telList: string[],
  text: string,
  from: string,
  type: 0 | 1
) {
  const apikey = await getLubanApikey();
  if (!apikey) return { ok: false, code: 500, message: "系统未配置 API Key" };
  if (!telList.length || !text || !from) {
    return { ok: false, code: 400, message: "缺少 tel_list / text / from" };
  }
  if (telList.length > 30) return { ok: false, code: 400, message: "单次最多 30 个号码" };

  const pricing = await getSmsPricing();
  const totalPrice = pricing.send_sms * telList.length;
  const quota = await getGuestGuapiRemaining(guestUserId);
  if (quota.remaining < totalPrice) {
    return {
      ok: false,
      code: 402,
      message: "瓜皮不足，请联系管理员充值或邀请好友",
      data: { code: INSUFFICIENT_GUAPI_CODE, balance: quota.remaining, required: totalPrice, count: telList.length }
    };
  }

  const data = await luban.bulksms(apikey, telList, type, text, from);
  if (data.code === 0) {
    await deductGuestGuapi(guestUserId, totalPrice, "consume_send_sms", `发送短信 ${telList.length} 条`);
    await logSmsAction({
      guestUserId,
      action: "sendSms",
      phone: telList.join(","),
      message: text,
      rawResponse: data
    });
  }
  return data;
}

export async function smsGetPricingPublic() {
  const pricing = await getSmsPricing();
  return { ok: true, data: pricing };
}
