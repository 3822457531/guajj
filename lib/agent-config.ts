import { prisma } from "@/lib/prisma";

const KEY_DIRECT_RATE = "direct_rate";
const KEY_INDIRECT_RATE = "indirect_rate";
const KEY_MIN_WITHDRAW = "min_withdraw_yuan";

const DEFAULT_DIRECT_RATE = 0.2;
const DEFAULT_INDIRECT_RATE = 0.05;
const DEFAULT_MIN_WITHDRAW = 10;

export type AgentRates = {
  directRate: number;
  indirectRate: number;
  minWithdrawYuan: number;
};

export async function getAgentConfig(key: string): Promise<string | null> {
  const row = await prisma.agentConfig.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setAgentConfig(key: string, value: string) {
  await prisma.agentConfig.upsert({
    where: { key },
    create: { key, value },
    update: { value }
  });
}

function clampRate(n: number, fallback: number) {
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(1, n);
}

export async function getAgentRates(): Promise<AgentRates> {
  const [d, i, m] = await Promise.all([
    getAgentConfig(KEY_DIRECT_RATE),
    getAgentConfig(KEY_INDIRECT_RATE),
    getAgentConfig(KEY_MIN_WITHDRAW)
  ]);
  return {
    directRate: clampRate(Number(d ?? DEFAULT_DIRECT_RATE), DEFAULT_DIRECT_RATE),
    indirectRate: clampRate(Number(i ?? DEFAULT_INDIRECT_RATE), DEFAULT_INDIRECT_RATE),
    minWithdrawYuan: Math.max(0, Number(m ?? DEFAULT_MIN_WITHDRAW) || DEFAULT_MIN_WITHDRAW)
  };
}

export async function setAgentRates(input: Partial<AgentRates>) {
  const current = await getAgentRates();
  const directRate = clampRate(
    input.directRate != null ? Number(input.directRate) : current.directRate,
    current.directRate
  );
  const indirectRate = clampRate(
    input.indirectRate != null ? Number(input.indirectRate) : current.indirectRate,
    current.indirectRate
  );
  const minWithdrawYuan = Math.max(
    0,
    Number(input.minWithdrawYuan != null ? input.minWithdrawYuan : current.minWithdrawYuan) || 0
  );
  await Promise.all([
    setAgentConfig(KEY_DIRECT_RATE, String(directRate)),
    setAgentConfig(KEY_INDIRECT_RATE, String(indirectRate)),
    setAgentConfig(KEY_MIN_WITHDRAW, String(minWithdrawYuan))
  ]);
  return { directRate, indirectRate, minWithdrawYuan };
}

/** 向下截断到分 */
export function floorToCent(yuan: number): number {
  if (!Number.isFinite(yuan) || yuan <= 0) return 0;
  return Math.floor(yuan * 100 + 1e-9) / 100;
}
