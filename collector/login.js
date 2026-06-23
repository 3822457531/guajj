/**
 * 首次登录采集账号，生成 session 文件。
 *
 * 用法:
 *   npm run collector:login              搜索号 → session.txt
 *   npm run collector:login:media        媒体号 → back.txt（缩略图/warm/batch）
 *   npm run collector:login:stream       视频流号 → stream.txt（多人并发播放，可选第三号）
 *   npm run collector:login -- --fresh     忽略旧 session，强制重新验证码登录
 */
const fs = require("fs");
const input = require("input");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { requireEnv, requireGramCredentials, readSession, writeSession } = require("./config");

const args = new Set(process.argv.slice(2));
const fresh = args.has("--fresh");
const forMedia = args.has("--media");
const forStream = args.has("--stream");

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

双 / 三 session 说明：
  session.txt — 极搜 + 频道详情（双 session 时）
  back.txt    — 缩略图 batch / warm
  stream.txt  — 视频直出流（可选第三号，多人同时播放）

注意：服务器与本地请各用各的 session，不要互相拷贝。
`);
  console.error(`当前 session 路径: ${sessionFile}`);
}

function resolveLoginTarget() {
  const { sessionFile, mediaSessionFile, streamSessionFile } = requireEnv();
  if (forStream) {
    return {
      targetFile: streamSessionFile,
      credsRole: "stream",
      roleLabel: "视频流（stream.txt）"
    };
  }
  if (forMedia) {
    return {
      targetFile: mediaSessionFile,
      credsRole: "media",
      roleLabel: "媒体（back.txt）"
    };
  }
  return {
    targetFile: sessionFile,
    credsRole: "search",
    roleLabel: "搜索（session.txt）"
  };
}

async function main() {
  const { targetFile, credsRole, roleLabel } = resolveLoginTarget();
  const creds = requireGramCredentials(credsRole);

  console.log(`登录目标：${roleLabel} · apiId=${creds.apiId}`);

  if (fresh) {
    backupSessionFile(targetFile);
    console.log("(--fresh) 将使用空 session 重新登录，请准备接收 Telegram 验证码");
  }

  const saved = fresh ? "" : readSession(targetFile);
  if (saved && !fresh) {
    console.log(`读取已有 session: ${targetFile}`);
  }

  const client = new TelegramClient(new StringSession(saved), creds.apiId, creds.apiHash, {
    connectionRetries: 5
  });

  console.log("正在连接 Telegram…");
  try {
    await client.start({
      phoneNumber: async () => creds.phone || (await input.text("手机号（含国家码 +86…）: ")),
      phoneCode: async () => await input.text("请输入 Telegram 里收到的验证码: "),
      password: async () => await input.text("若开启了两步验证，请输入云密码（没有则回车）: "),
      onError: (err) => console.error(err)
    });
  } catch (err) {
    const msg = String(err?.errorMessage || err?.message || err);
    if (/AUTH_KEY_DUPLICATED/i.test(msg)) {
      printDuplicateHelp(targetFile);
      process.exit(1);
    }
    throw err;
  }

  const me = await client.getMe();
  console.log(`登录成功: ${me.firstName || ""} (@${me.username || "无用户名"}) id=${me.id}`);
  writeSession(targetFile, client.session.save());
  await client.disconnect();
  console.log("已断开连接。可重新启动 pm2 / next。");
}

main().catch((err) => {
  const msg = String(err?.errorMessage || err?.message || err);
  if (/AUTH_KEY_DUPLICATED/i.test(msg)) {
    try {
      printDuplicateHelp(resolveLoginTarget().targetFile);
    } catch {
      /* ignore */
    }
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
