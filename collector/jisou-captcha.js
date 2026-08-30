/**
 * 极搜 @jisou 数学题人机验证处理
 *
 * 环境变量 JISOU_CAPTCHA_MODE:
 *   auto   — OCR 识别算式并自动点按钮（默认）
 *   wait   — 等待你在手机/桌面 TG 里手动点选，脚本检测到通过后重试
 *   manual — 直接报错，提示手动验证
 */
const { Api } = require("telegram/tl");
const { sleep } = require("./gram-client");
const { createChallenge, DEFAULT_TTL_MS } = require("./jisou-captcha-store");

function captchaMode() {
  const m = (process.env.JISOU_CAPTCHA_MODE || "web").trim().toLowerCase();
  if (m === "wait" || m === "manual" || m === "web") return m;
  return "auto";
}

function captchaWaitMs() {
  const n = Number(process.env.JISOU_CAPTCHA_WAIT_MS ?? 90000);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 90000;
}

function callbackClickTimeoutMs() {
  const n = Number(process.env.JISOU_CALLBACK_CLICK_TIMEOUT_MS ?? 4500);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 4500;
}

function isIgnorableCallbackError(err) {
  const msg = String(err?.errorMessage || err?.message || err || "");
  return (
    err?.code === "JISOU_CALLBACK_LOCAL_TIMEOUT" ||
    /BOT_RESPONSE_TIMEOUT|CALLBACK_QUERY_TIMEOUT|QUERY_ID_INVALID/i.test(msg) ||
    /TIMEOUT/i.test(msg)
  );
}

/** 用于判断极搜是否刷新了验证码图片 */
function captchaMediaSignature(msg) {
  const media = msg?.media;
  if (!media) return "";
  const photo = media.photo ?? media.document;
  if (!photo) return "";
  const id = photo.id != null ? String(photo.id) : "";
  const dc = photo.dcId != null ? String(photo.dcId) : "";
  return `${media.className || "media"}:${dc}:${id}`;
}

/** 极搜验证码文案里的 @推广号，不展示给网页用户 */
function sanitizeCaptchaPrompt(text) {
  const raw = String(text || "").trim();
  if (!raw) return raw;

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^@[A-Za-z0-9_]{2,32}$/.test(line))
    .map((line) => line.replace(/(?:^|\s)@[A-Za-z0-9_]{2,32}(?=\s|$)/g, " ").trim())
    .filter(Boolean);

  return lines.join("\n").trim();
}

function flattenCallbackButtons(msg) {
  const rows = msg?.replyMarkup?.rows || [];
  const out = [];
  for (const row of rows) {
    const buttons = row.buttons || (Array.isArray(row) ? row : []);
    for (const btn of buttons) {
      if (!btn) continue;
      const isCallback =
        btn.className === "KeyboardButtonCallback" ||
        btn.className === "KeyboardButtonCallbackButton" ||
        (btn.data != null && btn.text != null);
      if (!isCallback) continue;
      out.push({
        text: String(btn.text ?? "").trim(),
        data: btn.data
      });
    }
  }
  return out;
}

/** 是否为极搜数学题验证消息 */
function isJisouCaptcha(msg) {
  if (!msg) return false;
  const text = String(msg.message || "");
  if (/人机验证|完成.*验证|计算结果|必须完成/i.test(text)) return true;

  const buttons = flattenCallbackButtons(msg);
  if (msg.media && buttons.length >= 4) {
    const numeric = buttons.filter((b) => /^\d+$/.test(b.text));
    if (numeric.length >= 4) return true;
  }
  return false;
}

function normalizeOp(op) {
  const o = String(op).trim();
  if (o === "+" || o === "＋") return "+";
  if (o === "-" || o === "－" || o === "−") return "-";
  if (o === "*" || o === "×" || o === "x" || o === "X" || o === "＊") return "*";
  if (o === "/" || o === "÷" || o === "／") return "/";
  return null;
}

function solveEquation(a, op, b) {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  switch (op) {
    case "+":
      return x + y;
    case "-":
      return x - y;
    case "*":
      return x * y;
    case "/":
      return Math.floor(x / y);
    default:
      return null;
  }
}

/** 从 OCR 文本解析算式，如 "6×4=?" */
function parseMathFromOcr(text) {
  const raw = String(text || "")
    .replace(/[？?=\s]/g, "")
    .replace(/[oO]/g, "0")
    .replace(/[lI|]/g, "1");

  const patterns = [
    /(\d{1,3})\s*([+\-*/×÷xX＋－])\s*(\d{1,3})/,
    /(\d{1,3})([+\-*/×÷xX])(\d{1,3})/
  ];

  for (const re of patterns) {
    const m = raw.match(re);
    if (!m) continue;
    const op = normalizeOp(m[2]);
    if (!op) continue;
    const ans = solveEquation(m[1], op, m[3]);
    if (ans != null && Number.isFinite(ans)) {
      return { left: Number(m[1]), op, right: Number(m[3]), answer: ans, raw: m[0] };
    }
  }
  return null;
}

let ocrWorkerPromise = null;

/** 避免 Next 打包器静态解析 require；仅 OCR 时加载 */
function loadTesseractModule() {
  const name = "tesseract" + ".js";
  try {
    return require(name);
  } catch (err) {
    const e = new Error("tesseract.js 未安装，请在项目根目录执行: npm install");
    e.code = "TESSERACT_NOT_INSTALLED";
    e.cause = err;
    throw e;
  }
}

async function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      const { createWorker } = loadTesseractModule();
      const worker = await createWorker("eng");
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789+-×÷*/=xX? "
      });
      return worker;
    })();
  }
  return ocrWorkerPromise;
}

async function ocrCaptchaImage(buffer) {
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(buffer);
  return String(data?.text || "").trim();
}

function toNodeBuffer(raw) {
  if (!raw) return null;
  if (Buffer.isBuffer(raw)) return raw;
  if (raw instanceof Uint8Array) return Buffer.from(raw);
  if (ArrayBuffer.isView(raw)) return Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength);
  if (raw instanceof ArrayBuffer) return Buffer.from(raw);
  if (typeof raw === "string" && raw.length > 0) return Buffer.from(raw, "binary");
  return null;
}

function sniffImageMime(buf) {
  if (!buf || buf.length < 3) return "image/jpeg";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return "image/png";
  }
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return "image/jpeg";
}

/**
 * 验证码图首次常因媒体未就绪 / GramJS 返回 Uint8Array 而失败，导致整次 428 无图或搜索报错。
 * 这里兼容多种二进制类型，并短重试。
 */
async function downloadCaptchaImage(client, msg, retries = 3) {
  let lastErr = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const raw = await client.downloadMedia(msg, {});
      const buffer = toNodeBuffer(raw);
      if (buffer && buffer.length > 0) {
        if (attempt > 1) {
          console.log(`[极搜验证] 验证码图片第 ${attempt} 次下载成功 size=${buffer.length}`);
        }
        return buffer;
      }
      lastErr = new Error("验证码图片下载为空");
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      console.warn(
        `[极搜验证] 验证码图片下载失败 attempt=${attempt}/${retries}:`,
        lastErr.message || lastErr
      );
    }
    if (attempt < retries) await sleep(350 * attempt);
  }
  throw lastErr || new Error("验证码图片下载失败");
}

function findAnswerButton(msg, answer) {
  const target = String(answer);
  const buttons = flattenCallbackButtons(msg);
  return buttons.find((b) => b.text === target) || null;
}

async function clickCallbackButton(client, botEntity, msg, button) {
  if (!button?.data) throw new Error("回调按钮无 data");

  let ack = false;
  const invokePromise = client
    .invoke(
      new Api.messages.GetBotCallbackAnswer({
        peer: botEntity,
        msgId: msg.id,
        data: button.data,
        game: false
      })
    )
    .then(() => {
      ack = true;
    })
    .catch((err) => {
      if (isIgnorableCallbackError(err)) {
        console.warn(
          "[极搜验证] GetBotCallbackAnswer 未即时确认（常见于答错/极搜刷题），继续轮询 TG 消息:",
          err?.errorMessage || err?.message || err
        );
        return;
      }
      throw err;
    });

  await Promise.race([invokePromise, sleep(callbackClickTimeoutMs())]);
  await sleep(400);
  return { ack };
}

/**
 * 打包验证码给前端用户（不 OCR、不代解）
 * @param {import('telegram').TelegramClient} client
 * @param {import('telegram').Api.TypeEntityLike} botEntity
 * @param {import('telegram').Api.Message} captchaMsg
 * @param {string} query
 * @param {number} [sentMessageId] 触发验证码前发出的关键词 messageId
 */
async function packCaptchaForWeb(client, botEntity, captchaMsg, query, sentMessageId) {
  const imageBuffer = await downloadCaptchaImage(client, captchaMsg);
  const imageMime = sniffImageMime(imageBuffer);
  const buttons = flattenCallbackButtons(captchaMsg);
  const buttonByAnswer = {};

  for (const b of buttons) {
    const label = String(b.text ?? "").trim();
    if (!label || !b.data) continue;
    const dataHex = Buffer.isBuffer(b.data)
      ? b.data.toString("hex")
      : typeof b.data === "string" && /^[0-9a-f]+$/i.test(b.data)
        ? b.data
        : Buffer.from(String(b.data)).toString("hex");
    buttonByAnswer[label] = dataHex;
  }

  let options = buttons.map((b) => String(b.text ?? "").trim()).filter((t) => /^\d+$/.test(t));
  if (!options.length) {
    options = Object.keys(buttonByAnswer);
  }

  const prompt =
    sanitizeCaptchaPrompt(String(captchaMsg.message || "").trim()) ||
    "极搜人机验证：请查看图片中的算式，点击下方正确答案";

  const challengeId = createChallenge({
    query: String(query || "").trim(),
    botUsername: (process.env.JISOU_BOT_USERNAME || "jisou").replace(/^@/, ""),
    captchaMsgId: captchaMsg.id,
    sentMessageId: Number(sentMessageId) > 0 ? Number(sentMessageId) : null,
    prompt,
    options,
    imageBuffer,
    imageMime,
    buttonByAnswer,
    captchaMediaSig: captchaMediaSignature(captchaMsg)
  });

  console.log(
    `[极搜验证] web 模式：已打包 challenge=${challengeId} options=${options.join(",")} mime=${imageMime} size=${imageBuffer.length}`
  );

  return {
    challengeId,
    prompt,
    options,
    expiresInSec: Math.round(DEFAULT_TTL_MS / 1000),
    // 随 428 响应内联，避免前端再请求 /captcha/.../image 时冷启动/超时导致首张裂图
    imageDataUrl: `data:${imageMime};base64,${imageBuffer.toString("base64")}`
  };
}

/**
 * 用户选定答案后，GramJS 代点 callback（采集号会话）
 * @param {object} challenge from captcha store
 * @param {string} answer
 */
async function submitWebCaptchaAnswer(client, botEntity, challenge, answer) {
  const label = String(answer ?? "").trim();
  const dataHex = challenge.buttonByAnswer?.[label];
  if (!dataHex) {
    const err = new Error(`无效答案选项: ${label || "(空)"}`);
    err.code = "JISOU_CAPTCHA_INVALID_ANSWER";
    throw err;
  }

  const batch = await client.getMessages(botEntity, { ids: [challenge.captchaMsgId] });
  const captchaMsg = batch?.[0];
  if (!captchaMsg) {
    const err = new Error("验证码消息已过期，请重新搜索");
    err.code = "JISOU_CAPTCHA_EXPIRED";
    throw err;
  }

  if (!isJisouCaptcha(captchaMsg)) {
    console.log("[极搜验证] 验证码消息已被处理，跳过点击");
    return { clicked: false, alreadySolved: true };
  }

  await clickCallbackButton(client, botEntity, captchaMsg, {
    text: label,
    data: Buffer.from(dataHex, "hex")
  });
  console.log(`[极搜验证] web 模式：用户选择 ${label}，已代点 callback（不依赖 bot callback ack）`);
  return { clicked: true, answer: label };
}

/**
 * OCR 算式并点击正确答案
 */
async function solveCaptchaAuto(client, botEntity, captchaMsg) {
  const imageBuffer = await downloadCaptchaImage(client, captchaMsg);
  const ocrText = await ocrCaptchaImage(imageBuffer);
  const parsed = parseMathFromOcr(ocrText);

  if (!parsed) {
    const err = new Error(`OCR 无法识别算式，原始识别: ${ocrText || "(空)"}`);
    err.code = "JISOU_CAPTCHA_OCR_FAILED";
    err.ocrText = ocrText;
    throw err;
  }

  const button = findAnswerButton(captchaMsg, parsed.answer);
  if (!button) {
    const err = new Error(`未找到答案按钮: ${parsed.answer}（算式 ${parsed.raw}）`);
    err.code = "JISOU_CAPTCHA_BUTTON_NOT_FOUND";
    err.parsed = parsed;
    throw err;
  }

  console.log(`[极搜验证] OCR="${ocrText}" → ${parsed.left} ${parsed.op} ${parsed.right} = ${parsed.answer}，点击按钮`);
  await clickCallbackButton(client, botEntity, captchaMsg, button);
  return { mode: "auto", answer: parsed.answer, ocrText, parsed };
}

/** 等待同一账号在官方 TG 客户端里手动点选 */
async function waitForManualCaptchaSolve(client, botEntity, captchaMsg) {
  const waitMs = captchaWaitMs();
  const deadline = Date.now() + waitMs;
  const afterId = captchaMsg.id;
  console.warn(
    `[极搜验证] 请在 Telegram 打开 @${process.env.JISOU_BOT_USERNAME || "jisou"} 完成人机验证（最多等待 ${Math.round(waitMs / 1000)}s）`
  );

  while (Date.now() < deadline) {
    const [fresh] = await client.getMessages(botEntity, { ids: [captchaMsg.id] });
    if (fresh && !isJisouCaptcha(fresh)) {
      console.log("[极搜验证] 检测到验证已通过（手动，原消息已更新）");
      return { mode: "wait", solved: true };
    }

    const batch = await client.getMessages(botEntity, { minId: afterId, limit: 8 });
    const later = (batch || []).filter((m) => m?.id > afterId && !isJisouCaptcha(m));
    if (later.length) {
      console.log("[极搜验证] 检测到验证后新消息（手动）");
      return { mode: "wait", solved: true };
    }

    await sleep(2500);
  }

  const err = new Error("等待手动完成极搜验证超时，请在 TG 客户端完成验证后重试");
  err.code = "JISOU_CAPTCHA_WAIT_TIMEOUT";
  throw err;
}

/**
 * 处理极搜验证码
 * @returns {Promise<{ mode: string, solved: boolean }>}
 */
async function handleJisouCaptcha(client, botEntity, captchaMsg) {
  const mode = captchaMode();

  if (mode === "manual") {
    const err = new Error(
      "极搜要求人机验证：请在 Telegram 客户端打开 @jisou 完成验证后，将 JISOU_CAPTCHA_MODE=wait 或 auto 再重试"
    );
    err.code = "JISOU_CAPTCHA_REQUIRED";
    throw err;
  }

  if (mode === "wait") {
    await waitForManualCaptchaSolve(client, botEntity, captchaMsg);
    return { mode: "wait", solved: true };
  }

  try {
    const result = await solveCaptchaAuto(client, botEntity, captchaMsg);
    return { mode: "auto", solved: true, ...result };
  } catch (autoErr) {
    console.warn("[极搜验证] 自动识别失败，回退为等待手动验证:", autoErr.message);
    await waitForManualCaptchaSolve(client, botEntity, captchaMsg);
    return { mode: "wait", solved: true, autoError: autoErr.message };
  }
}

module.exports = {
  isJisouCaptcha,
  handleJisouCaptcha,
  packCaptchaForWeb,
  submitWebCaptchaAnswer,
  parseMathFromOcr,
  flattenCallbackButtons,
  clickCallbackButton,
  captchaMode,
  downloadCaptchaImage,
  captchaMediaSignature,
  sanitizeCaptchaPrompt
};
