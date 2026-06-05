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

function captchaMode() {
  const m = (process.env.JISOU_CAPTCHA_MODE || "auto").trim().toLowerCase();
  if (m === "wait" || m === "manual") return m;
  return "auto";
}

function captchaWaitMs() {
  const n = Number(process.env.JISOU_CAPTCHA_WAIT_MS ?? 90000);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 90000;
}

function flattenCallbackButtons(msg) {
  const rows = msg?.replyMarkup?.rows || [];
  const out = [];
  for (const row of rows) {
    for (const btn of row.buttons || []) {
      if (btn.className === "KeyboardButtonCallback") {
        out.push({
          text: String(btn.text ?? "").trim(),
          data: btn.data
        });
      }
    }
  }
  return out;
}

/** 是否为极搜数学题验证消息 */
function isJisouCaptcha(msg) {
  if (!msg) return false;
  const text = String(msg.message || "");
  if (/人机验证|完成.*验证|计算结果/i.test(text)) return true;

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

async function downloadCaptchaImage(client, msg) {
  const buffer = await client.downloadMedia(msg, {});
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("验证码图片下载失败");
  }
  return buffer;
}

function findAnswerButton(msg, answer) {
  const target = String(answer);
  const buttons = flattenCallbackButtons(msg);
  return buttons.find((b) => b.text === target) || null;
}

async function clickCallbackButton(client, botEntity, msg, button) {
  if (!button?.data) throw new Error("回调按钮无 data");

  await client.invoke(
    new Api.messages.GetBotCallbackAnswer({
      peer: botEntity,
      msgId: msg.id,
      data: button.data,
      game: false
    })
  );
  await sleep(800);
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
  parseMathFromOcr,
  flattenCallbackButtons,
  captchaMode
};
