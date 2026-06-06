/**
 * 首次登录采集账号，生成 session 文件。
 *
 * 用法:
 *   npm run collector:login              使用已有 session.txt（若有效则直接连上）
 *   npm run collector:login -- --fresh     忽略旧 session，强制重新验证码登录（化解 AUTH_KEY_DUPLICATED）
 */
const fs = require("fs");
const input = require("input");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { requireEnv, readSession, writeSession } = require("./config");

const args = new Set(process.argv.slice(2));
const fresh = args.has("--fresh");

function backupSessionFile(sessionFile) {
  if (!fs.existsSync(sessionFile)) return null;
  const bak = `${sessionFile}.bak.${Date.now()}`;
  fs.renameSync(sessionFile, bak);
  console.log(`已备份旧 session → ${bak}`);
  return bak;
}

function printDuplicateHelp(sessionFile) {
  console.error(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  AUTH_KEY_DUPLICATED：这份 session 正被别的进程占用
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

常见占用来源：
  1. 服务器 pm2 / next 仍在跑（有人访问过全网搜索）
  2. 本地 npm run dev 也在用同一份 session.txt
  3. collector:run / backfill 等采集脚本未停

化解步骤（在服务器上执行）：

  pm2 stop all
  ps aux | grep node          # 确认无残留 collector/next 进程

  npm run collector:login -- --fresh

--fresh 会备份旧 session 并用新验证码登录，生成全新 auth key。

注意：服务器与本地请各用各的 session，不要互相拷贝 session.txt。
`);
  console.error(`当前 session 路径: ${sessionFile}`);
}

async function main() {
  const { apiId, apiHash, phone, sessionFile } = requireEnv();

  if (fresh) {
    backupSessionFile(sessionFile);
    console.log("(--fresh) 将使用空 session 重新登录，请准备接收 Telegram 验证码");
  }

  const saved = fresh ? "" : readSession(sessionFile);
  if (saved && !fresh) {
    console.log(`读取已有 session: ${sessionFile}`);
  }

  const client = new TelegramClient(new StringSession(saved), apiId, apiHash, {
    connectionRetries: 5
  });

  console.log("正在连接 Telegram…");
  try {
    await client.start({
      phoneNumber: async () => phone || (await input.text("手机号（含国家码 +86…）: ")),
      phoneCode: async () => await input.text("请输入 Telegram 里收到的验证码: "),
      password: async () => await input.text("若开启了两步验证，请输入云密码（没有则回车）: "),
      onError: (err) => console.error(err)
    });
  } catch (err) {
    const msg = String(err?.errorMessage || err?.message || err);
    if (/AUTH_KEY_DUPLICATED/i.test(msg)) {
      printDuplicateHelp(sessionFile);
      process.exit(1);
    }
    throw err;
  }

  const me = await client.getMe();
  console.log(`登录成功: ${me.firstName || ""} (@${me.username || "无用户名"}) id=${me.id}`);
  writeSession(sessionFile, client.session.save());
  await client.disconnect();
  console.log("已断开连接。可重新启动 pm2 / next。");
}

main().catch((err) => {
  const msg = String(err?.errorMessage || err?.message || err);
  if (/AUTH_KEY_DUPLICATED/i.test(msg)) {
    try {
      const { sessionFile } = requireEnv();
      printDuplicateHelp(sessionFile);
    } catch {
      /* ignore */
    }
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
