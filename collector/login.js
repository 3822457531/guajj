/**
 * 首次登录采集账号，生成 session 文件。
 * 用法: npm run collector:login
 */
const input = require("input");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { requireEnv, readSession, writeSession } = require("./config");

async function main() {
  const { apiId, apiHash, phone, sessionFile } = requireEnv();
  const saved = readSession(sessionFile);
  const client = new TelegramClient(new StringSession(saved), apiId, apiHash, {
    connectionRetries: 5
  });

  console.log("正在连接 Telegram…");
  await client.start({
    phoneNumber: async () => phone || (await input.text("手机号（含国家码 +86…）: ")),
    phoneCode: async () => await input.text("请输入 Telegram 里收到的验证码: "),
    password: async () => await input.text("若开启了两步验证，请输入云密码（没有则回车）: "),
    onError: (err) => console.error(err)
  });

  const me = await client.getMe();
  console.log(`登录成功: ${me.firstName || ""} (@${me.username || "无用户名"}) id=${me.id}`);
  writeSession(sessionFile, client.session.save());
  await client.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
