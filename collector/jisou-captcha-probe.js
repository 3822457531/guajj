/**
 * 单独测试极搜验证码处理（发一条搜索词，走完整验证+搜索流程）
 * 用法: npm run collector:jisou-captcha-probe -- 朋友圈
 */
const { searchJisouChannels } = require("./jisou-search-service");

async function main() {
  const query = (process.argv[2] || "朋友圈").trim();
  console.log(`测试极搜（含验证码处理），关键词: ${query}`);
  console.log(`JISOU_CAPTCHA_MODE=${process.env.JISOU_CAPTCHA_MODE || "auto"}`);

  const result = await searchJisouChannels(query);
  console.log(`\n成功: 频道 ${result.channelCount} 个`);
  console.log(JSON.stringify(result.channels.slice(0, 5), null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
