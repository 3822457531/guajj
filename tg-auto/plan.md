# tg-auto — Telegram 智能客服自动化系统

> 基于 GramJS（Userbot）+ AI 模型的客户聊天自动化平台。  
> 预设话术模板与对话流程，后台可配置模型、查看聊天记录、管理系统参数。  
> GramJS 连接层直接复用 [guajj](../collector/) 已验证的实现。

---

## 1. 项目目标

| 能力 | 说明 |
|------|------|
| **自动接待** | 用小号（Userbot）监听私聊/群聊 @ 消息，按流程自动回复 |
| **话术 + 流程** | 后台配置模板、分支条件、转人工节点，减少重复劳动 |
| **AI 增强** | 在固定话术之外，调用可配置 LLM 做意图识别、自由问答、摘要 |
| **可视化管理** | 模型管理、会话列表、消息详情、账号状态、系统设置 |
| **稳定运行** | 单 session 互斥、断线重连、FloodWait 退避（继承 guajj 经验） |

**不做（V1 范围外）**：多账号矩阵、群发营销、频道采集、支付/订单系统。

---

## 2. 技术选型

| 层级 | 选型 | 理由 |
|------|------|------|
| 管理后台 | **Next.js 16** + React 19 + Server Actions | 与 guajj 一致，开发快、部署简单 |
| 数据库 | **MySQL 8** + Prisma | 会话/消息体量大，关系查询清晰 |
| TG 自动化 | **GramJS** (`telegram` npm) | guajj 已跑通 login / 长连接 / NewMessage |
| AI | **OpenAI 兼容 API**（OpenAI / DeepSeek / 本地 vLLM 等） | 统一 `baseUrl + apiKey + model` 配置 |
| 运行时 | **Node.js 进程分离** | Web（Next）与 Worker（Gram 监听）分进程，避免 AUTH_KEY_DUPLICATED |
| 进程管理 | pm2 / systemd | Worker 需常驻 |

---

## 3. 系统架构

```mermaid
flowchart TB
  subgraph Admin["管理后台 (Next.js)"]
    A1[话术/流程编辑]
    A2[模型管理]
    A3[聊天记录]
    A4[系统设置]
    A5[账号/Session 状态]
  end

  subgraph DB["MySQL"]
    D1[(Flow / Template)]
    D2[(Conversation / Message)]
    D3[(AiModel / Settings)]
    D4[(TgAccount)]
  end

  subgraph Worker["tg-auto-worker (独立进程)"]
    W1[GramJS Client]
    W2[NewMessage Handler]
    W3[Flow Engine]
    W4[AI Router]
    W5[Outbound Send]
  end

  TG["Telegram 用户"] <-->|私聊/群聊| W1
  Admin --> DB
  Worker --> DB
  W4 -->|HTTP| LLM["LLM API"]
```

### 进程职责

| 进程 | 职责 | 禁止 |
|------|------|------|
| `next` (Web) | 后台 UI、REST/Server Actions、只读查库 | **不得** 持有 GramJS 长连接 |
| `worker` | Gram 登录、收消息、跑流程、发回复 | **不得** 与 Web 共用同一 `session.txt` 并发连接 |

> guajj 的 `collector/gram-client.js` 是为「按需 RPC」设计的；tg-auto Worker 改为**常驻连接 + 事件驱动**，但 session 读写、登录流程、chatId 规范化可直接复用。

---

## 4. 从 guajj 复用的代码

建议在 `tg-auto/` 内通过 **复制 + 精简** 引入，避免与 guajj 业务耦合。

| guajj 文件 | 复用内容 | tg-auto 目标路径 |
|------------|----------|------------------|
| `collector/config.js` | `.env` 加载、`TG_API_ID/HASH`、session 读写 | `worker/config.js` |
| `collector/login.js` | 验证码登录、`--fresh` 化解重复 key | `worker/login.js` |
| `collector/chat-id.js` | `normalizeChatId` / `entityToChatId` | `worker/chat-id.js` |
| `collector/gram-client.js` | 连接参数、`isSessionFatal`、断连逻辑 | `worker/gram-client.js`（改为常驻，去掉低优先级抢占） |
| `collector/run.js` | `NewMessage` 事件注册、`getDialogs` 预热 | `worker/listener.js`（改为私聊/群聊过滤） |
| `lib/auth.ts` + `app/admin/*` | 后台登录、侧边栏、表单卡片样式 | `app/admin/*`（改导航与模型） |

### GramJS 发消息（新增，参考 run.js 的 client 用法）

```js
// worker/send.js — 示意
const { Api } = require("telegram");

async function sendText(client, peer, text) {
  await client.sendMessage(peer, { message: text });
}

async function sendTyping(client, peer) {
  await client.invoke(new Api.messages.SetTyping({
    peer,
    action: new Api.SendMessageTypingAction(),
  }));
}
```

### 关键约束（来自 guajj 生产经验）

1. **一份 session 只能一个进程连接** → Web 与 Worker 严格分离。
2. `AUTH_KEY_DUPLICATED` → `npm run worker:login -- --fresh`，并停掉所有占用进程。
3. 捕获 `FLOOD_WAIT_*` → 按秒数 `sleep` 后重试，写入日志表。
4. 私聊与群聊：`event.isPrivate` / `event.isGroup` 过滤；群聊仅响应 @ 本账号或回复本账号消息。

---

## 5. 目录结构（规划）

```
tg-auto/
├── plan.md                 # 本文档
├── package.json
├── prisma/
│   └── schema.prisma
├── worker/                 # 独立 Node 进程
│   ├── config.js           # ← guajj collector/config.js
│   ├── login.js            # ← guajj collector/login.js
│   ├── chat-id.js
│   ├── gram-client.js      # 常驻连接版
│   ├── listener.js         # NewMessage 入口
│   ├── flow-engine.js      # 流程状态机
│   ├── ai-router.js        # 调用 LLM
│   └── send.js
├── app/
│   ├── admin/
│   │   ├── login/
│   │   └── (dashboard)/
│   │       ├── page.tsx            # 概览
│   │       ├── conversations/      # 聊天记录
│   │       ├── flows/              # 流程编辑
│   │       ├── templates/          # 话术模板
│   │       ├── models/             # AI 模型
│   │       ├── accounts/           # TG 账号
│   │       └── settings/           # 系统设置
│   └── api/
│       └── worker/                 # Worker 心跳/指令（可选）
├── lib/
│   ├── prisma.ts
│   ├── auth.ts
│   └── ai-providers.ts
└── .env.example
```

---

## 6. 数据模型（Prisma 草案）

```prisma
// ---------- 账号与连接 ----------
model TgAccount {
  id            String   @id @default(cuid())
  label         String   @db.VarChar(64)    // 显示名
  phone         String?  @db.VarChar(32)
  username      String?  @db.VarChar(64)
  sessionPath   String   @db.VarChar(512)   // 每账号独立 session 文件
  isEnabled     Boolean  @default(true)
  status        String   @default("offline") @db.VarChar(32) // offline | online | error
  lastError     String?  @db.Text
  lastOnlineAt  DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  conversations Conversation[]
}

// ---------- AI 模型 ----------
model AiModel {
  id          String   @id @default(cuid())
  name        String   @db.VarChar(64)      // 后台显示名
  provider    String   @db.VarChar(32)      // openai | deepseek | custom
  baseUrl     String   @db.VarChar(512)
  apiKey      String   @db.VarChar(512)     // 加密存储（见下）
  modelId     String   @db.VarChar(128)     // gpt-4o-mini / deepseek-chat
  maxTokens   Int      @default(1024)
  temperature Float    @default(0.7)
  isDefault   Boolean  @default(false)
  isEnabled   Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// ---------- 话术模板 ----------
model ScriptTemplate {
  id        String   @id @default(cuid())
  name      String   @db.VarChar(128)
  category  String?  @db.VarChar(64)        // 售前 / 售后 / 投诉
  content   String   @db.LongText             // 支持 {{变量}}
  variables String?  @db.Text                 // JSON: ["productName","price"]
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ---------- 对话流程 ----------
model ConversationFlow {
  id          String   @id @default(cuid())
  name        String   @db.VarChar(128)
  description String?  @db.Text
  trigger     String   @db.VarChar(64)       // always | keyword | regex | ai_intent
  triggerArg  String?  @db.VarChar(512)       // 关键词列表或正则
  priority    Int      @default(0)            // 越大越优先
  isEnabled   Boolean  @default(true)
  graphJson   String   @db.LongText           // 节点图 JSON（见 §7）
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// ---------- 会话与消息 ----------
model Conversation {
  id            String   @id @default(cuid())
  tgAccountId   String
  tgAccount     TgAccount @relation(fields: [tgAccountId], references: [id])
  peerId        String   @db.VarChar(32)      // 规范化 chatId
  peerType      String   @db.VarChar(16)      // private | group | supergroup
  peerName      String?  @db.VarChar(128)
  peerUsername  String?  @db.VarChar(64)
  flowId        String?                        // 当前绑定流程
  flowStateJson String?  @db.Text               // 当前节点、变量快照
  mode          String   @default("auto") @db.VarChar(16) // auto | human | paused
  lastMessageAt DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  messages      Message[]

  @@unique([tgAccountId, peerId])
  @@index([lastMessageAt])
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  direction      String   @db.VarChar(8)       // in | out
  tgMessageId    Int?
  contentType    String   @default("text") @db.VarChar(16)
  text           String?  @db.LongText
  rawJson        String?  @db.LongText         // Gram 原始消息（调试）
  aiModelId      String?                      // 若由 AI 生成
  flowNodeId     String?                      // 触发的流程节点
  status         String   @default("sent") @db.VarChar(16) // sent | failed | pending
  createdAt      DateTime @default(now())

  @@index([conversationId, createdAt])
}

// ---------- 系统设置（单行 main）----------
model SystemSettings {
  id                    String   @id @default("main")
  defaultFlowId         String?
  defaultAiModelId      String?
  welcomeEnabled        Boolean  @default(true)
  welcomeTemplateId     String?
  humanTakeoverKeyword  String   @default("人工") @db.VarChar(64)
  maxAiTurnsPerSession  Int      @default(20)
  replyDelayMs          Int      @default(800)    // 模拟打字间隔
  groupReplyMentionOnly Boolean  @default(true)
  logLevel              String   @default("info") @db.VarChar(16)
  updatedAt             DateTime @updatedAt
}

model AdminUser {
  id           String   @id @default(cuid())
  username     String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

**apiKey 存储**：应用层用 `AES-256-GCM` + `AUTH_SECRET` 派生密钥加密后入库，后台仅显示掩码。

---

## 7. 流程引擎（Flow Engine）

### 7.1 节点类型

| 类型 | 说明 |
|------|------|
| `start` | 入口，可挂载欢迎语 |
| `template` | 发送 `ScriptTemplate`，替换 `{{var}}` |
| `branch` | 按关键词 / 正则 / 按钮回调分支 |
| `ai` | 调用 `AiModel`，带 system prompt + 历史 N 轮 |
| `delay` | 等待若干秒（可合并 typing） |
| `human` | 转人工：`conversation.mode = human`，停止自动回复 |
| `end` | 结束，可重置或保持待机 |

### 7.2 graphJson 示例

```json
{
  "nodes": [
    { "id": "start", "type": "start", "next": "welcome" },
    { "id": "welcome", "type": "template", "templateId": "tpl_01", "next": "ask_intent" },
    { "id": "ask_intent", "type": "ai", "systemPrompt": "你是客服，判断用户意图：询价/售后/其他", "next": "route" },
    { "id": "route", "type": "branch", "rules": [
      { "match": "询价", "next": "price_tpl" },
      { "match": "售后", "next": "human" }
    ], "default": "ai_fallback" },
    { "id": "human", "type": "human" }
  ]
}
```

### 7.3 执行循环（worker/flow-engine.js）

```
收到消息
  → 查 Conversation（无则创建，mode=auto）
  → 若 mode=human|paused → 仅入库，不自动回
  → 匹配 ConversationFlow（trigger + priority）
  → 从 flowState.currentNode 继续执行
  → 遇 send/template/ai → send.js / ai-router.js
  → 更新 flowStateJson、写 Message 表
```

---

## 8. AI 模型接入

### 8.1 统一客户端（lib/ai-providers.ts）

```ts
type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function completeChat(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const res = await fetch(`${opts.baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.7,
    }),
  });
  // 解析 choices[0].message.content
}
```

### 8.2 使用场景

| 场景 | 调用方式 |
|------|----------|
| 流程 `ai` 节点 | system + 会话最近 10 条 Message |
| 意图路由 | 短 prompt，输出 JSON `{ intent: string }` |
| 后台「测试模型」 | 管理页单独调试，不写库 |
| 会话摘要 | 后台聊天记录页一键生成 |

### 8.3 模型管理后台

- CRUD：`name / provider / baseUrl / apiKey / modelId / maxTokens / temperature`
- 设默认模型：`SystemSettings.defaultAiModelId`
- 连接测试：发送 ping prompt，显示延迟与 token 用量（可选）

---

## 9. 管理后台功能清单

| 模块 | 路径 | 功能 |
|------|------|------|
| **概览** | `/admin` | 今日会话数、消息量、账号在线状态、最近错误 |
| **聊天记录** | `/admin/conversations` | 列表筛选（账号/日期/模式）；详情页消息时间线；切换人工/恢复自动；导出 CSV |
| **话术模板** | `/admin/templates` | 增删改、变量说明、预览 |
| **对话流程** | `/admin/flows` | 列表 + 可视化编辑器（V1 可用 JSON 编辑器，V2 拖拽） |
| **AI 模型** | `/admin/models` | 模型配置、默认项、测试连接 |
| **TG 账号** | `/admin/accounts` | 绑定手机号、session 路径、启用/停用；展示 worker 心跳 |
| **系统设置** | `/admin/settings` | 欢迎语、转人工关键词、AI 轮数上限、回复延迟、群聊策略 |
| **登录** | `/admin/login` | 复用 guajj `AdminUser` + cookie 会话 |

UI 风格：直接沿用 guajj `admin-layout`、`form-card`、`admin-panel` CSS，降低前端成本。

---

## 10. Worker 细节

### 10.1 启动命令

```bash
npm run worker:login          # 首次：验证码登录
npm run worker                # 常驻监听
npm run dev                   # 仅 Next 后台
```

### 10.2 listener.js 伪代码

```js
const { NewMessage } = require("telegram/events");
const { normalizeChatId } = require("./chat-id");
const { runFlow } = require("./flow-engine");

client.addEventHandler(async (event) => {
  const msg = event.message;
  if (!msg?.message) return;

  const chatId = normalizeChatId(event.chatId);
  const isGroup = event.isGroup || event.isChannel;

  if (isGroup && settings.groupReplyMentionOnly) {
    if (!msg.mentioned || !event.message.replyTo) return;
  }

  await runFlow({ client, account, chatId, msg, peer: event.chatId });
}, new NewMessage({}));
```

### 10.3 心跳（可选）

Worker 每 30s `UPDATE TgAccount SET status='online', lastOnlineAt=now()`；Web 后台读库展示绿灯。

---

## 11. 环境变量（.env.example）

```bash
DATABASE_URL="mysql://tgauto:tgauto@127.0.0.1:3306/tgauto?charset=utf8mb4"
AUTH_SECRET="change-me"
ADMIN_PATH_PREFIX="/cp-xxxx"

# GramJS（与 guajj 相同来源）
TG_API_ID=
TG_API_HASH=
TG_PHONE=+86xxxxxxxxxxx
TG_SESSION_FILE=./worker/sessions/default.txt

# Worker
TG_AUTO_ACCOUNT_ID=            # 对应 TgAccount.id，多账号时由 pm2 实例指定
TG_REPLY_DELAY_MS=800
TG_FLOW_MAX_AI_TURNS=20

# AI 默认（可被数据库 AiModel 覆盖）
AI_DEFAULT_BASE_URL=https://api.openai.com
AI_DEFAULT_API_KEY=
AI_DEFAULT_MODEL=gpt-4o-mini
```

---

## 12. 部署

```bash
# 1. 数据库
npm run db:migrate

# 2. 后台
npm run build && pm2 start npm --name tg-auto-web -- start

# 3. Worker（与 Web 分开）
npm run worker:login
pm2 start npm --name tg-auto-worker -- run worker
```

| 服务 | 端口 | 说明 |
|------|------|------|
| tg-auto-web | 3000 | 仅后台 + API |
| tg-auto-worker | — | 无 HTTP，纯 Gram 长连接 |

Nginx 反代后台，**不要**把 Worker 暴露到公网。

---

## 13. 开发阶段（里程碑）

### Phase 1 — 骨架（约 1 周）

- [ ] 初始化 `tg-auto` 仓库，Prisma schema + migrate
- [ ] 复制并精简 `worker/config.js`、`login.js`、`chat-id.js`
- [ ] `listener.js`：收私聊 → 入库 `Message` → 原样回声（echo 测试）
- [ ] 后台登录 + 会话列表只读

### Phase 2 — 话术与流程（约 1 周）

- [ ] `ScriptTemplate` CRUD
- [ ] `ConversationFlow` + 简化版 flow-engine（`template` / `branch` / `human`）
- [ ] 系统设置：欢迎语、转人工关键词
- [ ] 聊天记录详情页

### Phase 3 — AI 接入（约 1 周）

- [ ] `AiModel` CRUD + 加密 apiKey
- [ ] `ai-router.js` + 流程 `ai` 节点
- [ ] 模型测试页、默认模型绑定
- [ ] 每会话 AI 轮数限制

### Phase 4 — 生产加固（约 1 周）

- [ ] 多账号 session 隔离（一账号一 worker 进程）
- [ ] FloodWait / session fatal 告警
- [ ] 群聊 @ 策略、回复延迟与 typing
- [ ] 导出、基础统计概览
- [ ] Docker Compose（MySQL + web + worker）

### Phase 5 — 体验增强（可选）

- [ ] 流程可视化拖拽编辑
- [ ] 消息媒体（图片/文件）识别与回复
- [ ] Webhook 通知人工（企业微信/邮件）
- [ ] RAG 知识库挂载

---

## 14. 风险与对策

| 风险 | 对策 |
|------|------|
| `AUTH_KEY_DUPLICATED` | Web/Worker 分进程；每账号独立 session 文件；文档化 `--fresh` 流程 |
| Telegram 封号 | 控制发送频率；新号养号；避免群发；加 `replyDelayMs` |
| LLM 幻觉 / 违规回复 | 流程优先走模板；AI 仅作补充；system prompt 限制；敏感词过滤 |
| 消息延迟 | Worker 与 DB 同机房；AI 请求设超时（15s）+ 失败回落模板 |
| 数据隐私 | 后台鉴权；apiKey 加密；日志脱敏；定期清理 rawJson |

---

## 15. 与 guajj 的关系

- **独立项目**：`tg-auto` 单独仓库/目录，共用技术栈与 GramJS 经验，**不**共用 guajj 的 `session.txt`。
- **可复制资产**：`collector/config.js`、`login.js`、`chat-id.js`、`gram-client.js` 的核心逻辑；`app/admin` 的布局与鉴权模式。
- **不复用**：频道采集、`TgIndexedMessage`、极搜、Webhook Bot 发文章等与客服无关模块。

---

## 16. 验收标准（V1）

1. Worker 7×24 在线，私聊消息 3s 内自动回复（无 AI 时）。
2. 后台可配置至少 3 套话术模板并绑定到流程分支。
3. 可配置 1 个 OpenAI 兼容模型并完成一次真实对话。
4. 聊天记录可按会话查看完整往来，支持转人工后停止自动回复。
5. 系统设置修改后 1 分钟内生效（Worker 轮询或 DB notify）。
6. 连续运行 72h 无 `AUTH_KEY_DUPLICATED` 与未处理崩溃。

---

*文档版本：2026-06-13 · 维护者：tg-auto 项目组*
