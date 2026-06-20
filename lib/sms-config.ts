import { prisma } from "@/lib/prisma";

const CONFIG_LUBAN_APIKEY = "luban_apikey";
const CONFIG_PRICING = "pricing";

export type SmsPricing = {
  get_number: number;
  get_sms: number;
  send_sms: number;
};

const DEFAULT_PRICING: SmsPricing = {
  get_number: 1,
  get_sms: 1,
  send_sms: 2
};

export async function getSmsConfig(key: string): Promise<string | null> {
  const row = await prisma.smsConfig.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSmsConfig(key: string, value: string) {
  await prisma.smsConfig.upsert({
    where: { key },
    create: { key, value },
    update: { value }
  });
}

export async function getLubanApikey() {
  const v = await getSmsConfig(CONFIG_LUBAN_APIKEY);
  return v || process.env.LUBAN_APIKEY || "";
}

export async function setLubanApikey(apikey: string) {
  await setSmsConfig(CONFIG_LUBAN_APIKEY, apikey || "");
}

export async function getSmsPricing(): Promise<SmsPricing> {
  const v = await getSmsConfig(CONFIG_PRICING);
  if (!v) return { ...DEFAULT_PRICING };
  try {
    const parsed = JSON.parse(v) as Partial<SmsPricing>;
    return {
      get_number: Math.max(0, Math.round(Number(parsed.get_number) || DEFAULT_PRICING.get_number)),
      get_sms: Math.max(0, Math.round(Number(parsed.get_sms) || DEFAULT_PRICING.get_sms)),
      send_sms: Math.max(0, Math.round(Number(parsed.send_sms) || DEFAULT_PRICING.send_sms))
    };
  } catch {
    return { ...DEFAULT_PRICING };
  }
}

export async function setSmsPricing(pricing: Partial<SmsPricing>) {
  const current = await getSmsPricing();
  await setSmsConfig(
    CONFIG_PRICING,
    JSON.stringify({
      get_number: Math.max(0, Math.round(Number(pricing.get_number ?? current.get_number))),
      get_sms: Math.max(0, Math.round(Number(pricing.get_sms ?? current.get_sms))),
      send_sms: Math.max(0, Math.round(Number(pricing.send_sms ?? current.send_sms)))
    })
  );
}
