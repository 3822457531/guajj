const { PrismaClient } = require("../lib/generated/prisma");
const crypto = require("crypto");

const prisma = new PrismaClient();

function passwordHash(password) {
  const salt = "local-seed-salt";
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `pbkdf2$${salt}$${hash}`;
}

const categories = [
  ["娱乐", "entertainment"],
  ["网红", "influencer"],
  ["影视", "film"],
  ["综艺", "variety"],
  ["直播", "live"],
  ["职场111", "workplace"]
];

const tags = [
  ["热瓜", "hot"],
  ["图文", "article"],
  ["视频", "video"],
  ["时间线", "timeline"],
  ["幕后", "behind"],
  ["轻讨论", "talk"]
];

async function main() {
  await prisma.adminUser.upsert({
    where: { username: "admin" },
    update: {},
    create: { username: "admin", passwordHash: passwordHash("admin123456") }
  });

  const categoryMap = {};
  for (const [name, slug] of categories) {
    categoryMap[slug] = await prisma.category.upsert({
      where: { slug },
      update: { name },
      create: { name, slug }
    });
  }

  const tagMap = {};
  for (const [name, slug] of tags) {
    tagMap[slug] = await prisma.tag.upsert({
      where: { slug },
      update: { name },
      create: { name, slug }
    });
  }

  const posts = [
    {
      title: "晚间热瓜：新综艺录制路透连出三波反转",
      summary: "从排练动线到嘉宾互动，今晚的线索被整理成一条清晰时间线。",
      body: "今晚的热度主要来自一档新综艺的录制路透。第一波是现场观众提到舞台互动比预告更密集，第二波是工作人员调整流程后，嘉宾分组出现变化，第三波则是官方物料提前释放了新主题。当前能确定的是节目正在加速预热，具体名场面仍要等正式播出后再判断。\n\n吃瓜建议：先看时间线，再看官方释出的完整版本，避免被片段剪辑带偏。",
      type: "ARTICLE",
      coverUrl: "/assets/cover-spotlight.svg",
      heat: 982,
      isPinned: true,
      categorySlug: "variety",
      tagSlugs: ["hot", "timeline", "talk"]
    },
    {
      title: "直播间小风波：一场临时改价引发弹幕热议",
      summary: "品牌方、主播间和用户侧各有说法，真正关键是规则是否提前说明。",
      body: "一场直播活动里，部分商品在短时间内出现价格调整，弹幕因此快速升温。复盘下来，争议点并不在于优惠本身，而在于用户是否能提前看到清晰规则。若后续要平息讨论，最有效的方式不是情绪回应，而是公开说明库存、时间和补偿边界。\n\n目前内容为虚构案例，用于展示吃瓜网的信息编排方式。",
      type: "ARTICLE",
      coverUrl: "/assets/cover-live.svg",
      heat: 731,
      isPinned: false,
      categorySlug: "live",
      tagSlugs: ["article", "talk"]
    },
    {
      title: "短视频区：片场花絮三十秒预览",
      summary: "视频内容位已经打通，后台上传 MP4 后可直接替换播放。",
      body: "这个条目用于展示视频内容卡片和详情页播放器。首版默认展示封面和播放器区域，后台上传视频后会显示真实播放源。",
      type: "VIDEO",
      coverUrl: "/assets/cover-stage.svg",
      videoUrl: "",
      heat: 668,
      isPinned: true,
      categorySlug: "film",
      tagSlugs: ["video", "behind"]
    },
    {
      title: "图集：城市大屏物料更新，粉丝开始猜新代言",
      summary: "从画面色彩到发布时间，大家把细节都翻了一遍。",
      body: "城市大屏物料更新后，讨论点集中在发布时间、色彩风格和品牌露出位置。虽然猜测很多，但在正式官宣前只能把它当作营销预热观察。\n\n后台可以把这类内容设置为图文或图集，并上传多张图片后写入正文。",
      type: "GALLERY",
      coverUrl: "/assets/cover-city.svg",
      heat: 544,
      isPinned: false,
      categorySlug: "entertainment",
      tagSlugs: ["article", "behind"]
    },
    {
      title: "职场边角料：经纪团队换班后节奏明显变快",
      summary: "宣发节奏、物料密度和商务出现频率，是判断团队变化的三个窗口。",
      body: "最近几个虚构艺人项目的排期被重新整理后，一个明显现象是宣发动作更集中。团队换班并不一定意味着方向大改，但会影响对外沟通的速度和内容密度。对于吃瓜群众来说，看长期节奏比看单个物料更有价值。",
      type: "ARTICLE",
      coverUrl: "/assets/cover-studio.svg",
      heat: 493,
      isPinned: false,
      categorySlug: "workplace",
      tagSlugs: ["timeline", "talk"]
    }
  ];

  const vipSamples = [
    {
      chatId: "-1001111000001",
      messageId: 1001,
      contentType: "VIDEO",
      title: "牛教练健身日常片段曝光",
      snippet: "牛教练在健身房录制的一段日常训练，网友讨论动作是否标准…",
      rawText:
        "牛教练健身日常片段曝光\n\n牛教练在健身房录制的一段日常训练，网友讨论动作是否标准。相关话题持续发酵，更多片段仍在整理中。",
      sourceTitle: "吃瓜速递",
      sourceUsername: "gossip_feed",
      durationSec: 42
    },
    {
      chatId: "-1001111000001",
      messageId: 1002,
      contentType: "VIDEO",
      title: "牛教练直播回放精华剪辑",
      snippet: "昨晚直播中的高能片段汇总，含互动问答环节…",
      rawText: "牛教练直播回放精华剪辑\n\n昨晚直播中的高能片段汇总，含互动问答环节。",
      sourceTitle: "吃瓜速递",
      durationSec: 81
    },
    {
      chatId: "-1001111000002",
      messageId: 2001,
      contentType: "TEXT",
      title: "牛教练聊天记录整理（文字版）",
      snippet: "群友整理的对话时间线，涉及合作与行程讨论…",
      rawText: "牛教练聊天记录整理（文字版）\n\n群友整理的对话时间线，涉及合作与行程讨论。仅供检索演示。",
      sourceTitle: "圈内爆料"
    },
    {
      chatId: "-1001111000003",
      messageId: 3001,
      contentType: "DOCUMENT",
      title: "牛教练相关物料 PDF 汇总",
      snippet: "包含多张截图与说明的压缩整理，文件较大建议 WiFi 下载…",
      rawText: "牛教练相关物料 PDF 汇总\n\n包含多张截图与说明的压缩整理。",
      sourceTitle: "资源归档"
    },
    {
      chatId: "-1001111000001",
      messageId: 1003,
      contentType: "PHOTO",
      title: "牛教练活动现场九宫格",
      snippet: "粉丝拍摄的现场图集，共 9 张高清图…",
      rawText: "牛教练活动现场九宫格\n\n粉丝拍摄的现场图集。",
      sourceTitle: "吃瓜速递",
      mediaUrl: "/assets/cover-city.svg"
    },
    {
      chatId: "-1001111000004",
      messageId: 4001,
      contentType: "VIDEO",
      title: "赵露思新剧路透短视频",
      snippet: "片场路透 30 秒，服装造型引热议…",
      rawText: "赵露思新剧路透短视频\n\n片场路透 30 秒，服装造型引热议。",
      sourceTitle: "影视路透站",
      durationSec: 30
    },
    {
      chatId: "-1001111000004",
      messageId: 4002,
      contentType: "TEXT",
      title: "教母话题长文梳理",
      snippet: "按时间线梳理近期争议节点，附多方说法…",
      rawText: "教母话题长文梳理\n\n按时间线梳理近期争议节点。",
      sourceTitle: "深度吃瓜"
    },
    {
      chatId: "-1001111000005",
      messageId: 5001,
      contentType: "VIDEO",
      title: "货代周周访谈片段",
      snippet: "行业访谈节选，谈及跨境物流与行情…",
      rawText: "货代周周访谈片段\n\n行业访谈节选。",
      sourceTitle: "财经边角",
      durationSec: 125
    }
  ];

  for (const sample of vipSamples) {
    await prisma.tgIndexedMessage.upsert({
      where: { chatId_messageId: { chatId: sample.chatId, messageId: sample.messageId } },
      update: {},
      create: {
        ...sample,
        messageDate: new Date(Date.now() - sample.messageId * 3600_000)
      }
    });
  }

  for (const item of posts) {
    const existing = await prisma.post.findFirst({ where: { title: item.title } });
    const category = categoryMap[item.categorySlug];
    if (!existing) {
      const created = await prisma.post.create({
        data: {
          title: item.title,
          summary: item.summary,
          body: item.body,
          type: item.type,
          status: "PUBLISHED",
          coverUrl: item.coverUrl,
          videoUrl: item.videoUrl,
          heat: item.heat,
          isPinned: item.isPinned,
          publishedAt: new Date(),
          categoryId: category.id
        }
      });
      for (const slug of item.tagSlugs) {
        await prisma.postTag.create({ data: { postId: created.id, tagId: tagMap[slug].id } });
      }
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
