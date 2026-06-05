/**
 * 探测 @jisou 极搜 bot 的返回格式（发消息 + Inline 模式）
 * 用法:
 *   npm run collector:jisou-probe
 *   npm run collector:jisou-probe -- 美腿丝袜
 *   JISOU_PROBE_TIMEOUT_MS=20000 npm run collector:jisou-probe -- 测试
 */
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const { Api } = require("telegram/tl");
const { requireEnv, readSession } = require("./config");
const { parseJisouSearchMessage, parseJisouReplyMarkup } = require("./jisou-parse");

const BOT_USERNAME = (process.env.JISOU_BOT_USERNAME || "jisou").replace(/^@/, "");
const DEFAULT_QUERY = "美腿丝袜";

function probeTimeoutMs() {
  const n = Number(process.env.JISOU_PROBE_TIMEOUT_MS ?? 15000);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 15000;
}

function clip(text, max = 800) {
  const s = String(text ?? "");
  return s.length > max ? `${s.slice(0, max)}…(${s.length} 字)` : s;
}

function serializeInlineButton(btn) {
  if (!btn) return null;
  const out = { className: btn.className };
  if (btn.text != null) out.text = String(btn.text);
  if (btn.url) out.url = btn.url;
  if (btn.data) out.data = Buffer.isBuffer(btn.data) ? btn.data.toString("hex") : String(btn.data);
  return out;
}

function serializeReplyMarkup(markup) {
  if (!markup) return null;
  if (markup.className === "ReplyInlineMarkup" && Array.isArray(markup.rows)) {
    return {
      type: "inline",
      rows: markup.rows.map((row) =>
        (row.buttons || []).map(serializeInlineButton).filter(Boolean)
      )
    };
  }
  return { type: markup.className || "unknown", raw: clip(JSON.stringify(markup), 400) };
}

function serializeEntities(entities) {
  if (!Array.isArray(entities) || entities.length === 0) return [];
  return entities.map((e) => {
    const base = { className: e.className, offset: e.offset, length: e.length };
    if (e.url) base.url = e.url;
    if (e.userId != null) base.userId = String(e.userId);
    return base;
  });
}

function summarizeMessage(msg, label) {
  const text = msg.message || msg.text || "";
  console.log(`\n--- ${label} ---`);
  console.log("id:", msg.id);
  console.log("date:", msg.date ? new Date(msg.date * 1000).toISOString() : null);
  console.log("text:", clip(text, 1200));
  const entities = serializeEntities(msg.entities);
  if (entities.length) console.log("entities:", JSON.stringify(entities, null, 2));
  const markup = serializeReplyMarkup(msg.replyMarkup);
  if (markup) console.log("replyMarkup:", JSON.stringify(markup, null, 2));
}

function parseInlineResult(r, index) {
  const title = r.title || r.description || "";
  const desc = r.description || "";
  let url = null;
  if (r.url) url = r.url;
  if (r.sendMessage?.message) {
    /* inline result may embed message */
  }
  if (r.content?.className === "InputWebDocument" && r.content.url) {
    url = r.content.url;
  }
  return { index, id: r.id, type: r.type, title: clip(title, 120), description: clip(desc, 200), url };
}

async function tryInlineSearch(client, botEntity, query) {
  console.log("\n========== 1) Inline 模式 GetInlineBotResults ==========");
  try {
    const me = await client.getMe();
    const result = await client.invoke(
      new Api.messages.GetInlineBotResults({
        bot: botEntity,
        peer: me,
        query: query.trim(),
        offset: ""
      })
    );
    console.log("gallery:", result.gallery);
    console.log("switchPm:", result.switchPm ? { text: String(result.switchPm.text), startParam: result.switchPm.startParam } : null);
    console.log("nextOffset:", result.nextOffset || "");
    console.log("resultsCount:", result.results?.length ?? 0);

    const items = (result.results || []).slice(0, 10).map(parseInlineResult);
    if (items.length) {
      console.log("\n前 10 条 inline 结果:");
      console.log(JSON.stringify(items, null, 2));
    } else {
      console.log("（无 inline 结果 — 可能未开启 Inline 或关键词无匹配）");
    }
    return { ok: true, count: result.results?.length ?? 0, items };
  } catch (err) {
    console.log("Inline 探测失败:", err.message);
    if (err.errorMessage) console.log("  errorMessage:", err.errorMessage);
    return { ok: false, error: err.message };
  }
}

async function waitForBotReplies(client, botEntity, afterMessageId, timeoutMs) {
  const botId = botEntity.id;
  const collected = [];

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      client.removeEventHandler(handler);
      resolve(collected);
    }, timeoutMs);

    async function handler(event) {
      try {
        const msg = event.message;
        if (!msg?.id) return;
        if (msg.id <= afterMessageId) return;
        const sender = await msg.getSender();
        if (!sender || String(sender.id) !== String(botId)) return;
        collected.push(msg);
        summarizeMessage(msg, `Bot 回复 #${collected.length}`);
      } catch (err) {
        console.warn("处理回复事件失败:", err.message);
      }
    }

    client.addEventHandler(handler, new NewMessage({}));
  });
}

async function trySendMessage(client, botEntity, query, timeoutMs) {
  console.log("\n========== 2) 私聊发消息等待回复 ==========");
  console.log(`向 @${BOT_USERNAME} 发送:`, JSON.stringify(query));

  const sent = await client.sendMessage(botEntity, { message: query });
  console.log("已发送 message id:", sent.id);

  console.log(`等待 bot 回复（最多 ${timeoutMs / 1000}s）…`);
  const replies = await waitForBotReplies(client, botEntity, sent.id, timeoutMs);

  if (replies.length === 0) {
    console.log("（超时内未收到 bot 新消息，可加大 JISOU_PROBE_TIMEOUT_MS 重试）");
    return { ok: false, count: 0, replies: [] };
  }

  console.log(`\n共收到 ${replies.length} 条 bot 消息`);

  const structured = replies.map((msg, i) => {
    const text = msg.message || "";
    const search = parseJisouSearchMessage(text, msg.entities || []);
    const buttons = parseJisouReplyMarkup(msg.replyMarkup);
    return {
      index: i + 1,
      messageId: msg.id,
      ...search,
      buttons
    };
  });

  const first = structured[0];
  if (first) {
    console.log("\n========== 3) 结构化解析（可接入站点）==========");
    console.log(`频道结果 ${first.channelCount} 条，广告 ${first.ads.length} 条，热搜词 ${first.hotKeywords.length} 个`);
    if (first.channels.length) {
      console.log("\n频道列表（前 10）:");
      console.log(JSON.stringify(first.channels.slice(0, 10), null, 2));
    }
    if (first.hotKeywords.length) {
      console.log("\n热搜词:");
      console.log(JSON.stringify(first.hotKeywords, null, 2));
    }
    if (first.buttons.actions.length) {
      console.log("\n分页/操作按钮:");
      console.log(JSON.stringify(first.buttons.actions, null, 2));
    }
  }

  return { ok: true, count: replies.length, structured };
}

async function main() {
  const query = (process.argv[2] || process.env.JISOU_PROBE_QUERY || DEFAULT_QUERY).trim();
  if (!query) throw new Error("请提供搜索关键词，例如: npm run collector:jisou-probe -- 美腿丝袜");

  const { apiId, apiHash, sessionFile } = requireEnv();
  const session = readSession(sessionFile);
  if (!session) {
    throw new Error("未找到 session，请先运行: npm run collector:login");
  }

  const timeoutMs = probeTimeoutMs();
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 5
  });

  console.log(`连接 Telegram，探测 @${BOT_USERNAME}，关键词: ${query}`);
  await client.connect();

  const me = await client.getMe();
  console.log(`当前账号: ${me.firstName || ""} (@${me.username || "无用户名"}) id=${me.id}`);

  let botEntity;
  try {
    botEntity = await client.getEntity(BOT_USERNAME);
    console.log(`Bot: @${botEntity.username || BOT_USERNAME} id=${botEntity.id}`);
  } catch (err) {
    throw new Error(`找不到 @${BOT_USERNAME}，请确认采集号已与极搜 bot 有过对话: ${err.message}`);
  }

  const inline = await tryInlineSearch(client, botEntity, query);
  const chat = await trySendMessage(client, botEntity, query, timeoutMs);

  console.log("\n========== 结论 ==========");
  if (inline.ok && inline.count > 0) {
    console.log("✓ Inline 模式可用，优先用 GetInlineBotResults 接入（结构化、延迟低）");
  } else {
    console.log("✗ Inline 无结果或未支持，需解析私聊回复消息");
  }
  if (chat.ok && chat.count > 0) {
    const n = chat.structured?.[0]?.channelCount ?? 0;
    console.log(`✓ 私聊可用：已解析 ${n} 个频道链接（见上方「结构化解析」）`);
    console.log("  翻页需模拟点击「下一页」callback，后续可用 GetBotCallbackAnswer 实现");
  } else {
    console.log("✗ 未收到私聊回复，检查 session 是否有效、是否需先 /start 极搜");
  }

  await client.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
