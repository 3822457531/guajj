/*
 Navicat Premium Data Transfer

 Source Server         : guajj
 Source Server Type    : SQLite
 Source Server Version : 3017000
 Source Schema         : main

 Target Server Type    : SQLite
 Target Server Version : 3017000
 File Encoding         : 65001

 Date: 21/05/2026 12:21:51
*/

PRAGMA foreign_keys = false;

-- ----------------------------
-- Table structure for AdminUser
-- ----------------------------
DROP TABLE IF EXISTS "AdminUser";
CREATE TABLE "AdminUser" (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  PRIMARY KEY ("id")
);

-- ----------------------------
-- Records of "AdminUser"
-- ----------------------------
INSERT INTO "AdminUser" VALUES ('admmopenbh4bad6bb00bbb524fb', 'admin', 'pbkdf2$local-seed-salt$bed9d40fd1a9dd07ffe0902bbf89912f4f0bb3587e05223d0ccc371ab5596633', '2026-05-03T06:44:03.249Z', '2026-05-03T06:44:03.251Z');

-- ----------------------------
-- Table structure for Category
-- ----------------------------
DROP TABLE IF EXISTS "Category";
CREATE TABLE "Category" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- ----------------------------
-- Records of "Category"
-- ----------------------------
INSERT INTO "Category" VALUES ('catmopenbh390c925d466517c85', '娱乐', 'entertainment', '2026-05-03T06:44:03.253Z');
INSERT INTO "Category" VALUES ('catmopenbh3eff91c738e2f7b61', '影视', 'film', '2026-05-03T06:44:03.255Z');
INSERT INTO "Category" VALUES ('catmopenbh30c6340029dfce27b', '综艺', 'variety', '2026-05-03T06:44:03.256Z');
INSERT INTO "Category" VALUES ('catmopenbh37ec921b9da135426', '直播', 'live', '2026-05-03T06:44:03.256Z');
INSERT INTO "Category" VALUES ('catmopenbh3a4c69a1b95539aea', '职场111', 'workplace', '2026-05-03T06:44:03.257Z');
INSERT INTO "Category" VALUES ('cmpez14ua0002x6vkdbmz53u7', '网红', 'influencer', 1779336534466);

-- ----------------------------
-- Table structure for Comment
-- ----------------------------
DROP TABLE IF EXISTS "Comment";
CREATE TABLE "Comment" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "parentId" TEXT,
  "body" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "SocialUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ----------------------------
-- Records of "Comment"
-- ----------------------------
INSERT INTO "Comment" VALUES ('cmor6068w0002x6xg0996tydd', 'cmopq48c800026izc0cqwb8dk', 'cmor6068p0000x6xg5dqd1v8g', NULL, 123, 1777897058720);
INSERT INTO "Comment" VALUES ('cmor653is0009x6xgsqq22ucy', 'cmopq48c800026izc0cqwb8dk', 'cmor2ahrz0000x6hc95t87hg2', NULL, '什么鬼?', 1777897288468);
INSERT INTO "Comment" VALUES ('cmor69brh0002x6y8cxc8mw21', 'cmopq48c800026izc0cqwb8dk', 'cmor6068p0000x6xg5dqd1v8g', NULL, 111, 1777897485773);
INSERT INTO "Comment" VALUES ('cmor7oxtl0002x6705k2m9yzd', 'cmopq6s5i00076izccm0jzvr0', 'cmor6068p0000x6xg5dqd1v8g', NULL, 111, 1777899893817);
INSERT INTO "Comment" VALUES ('cmor7p7cl0005x6705u8tatwq', 'cmopq6s5i00076izccm0jzvr0', 'cmor6068p0000x6xg5dqd1v8g', NULL, '????', 1777899906165);
INSERT INTO "Comment" VALUES ('cmor7piab0008x670hnmcfqfk', 'cmopq6s5i00076izccm0jzvr0', 'cmor6068p0000x6xg5dqd1v8g', NULL, '什么？', 1777899920339);
INSERT INTO "Comment" VALUES ('cmor7q3ol000bx670hj9594br', 'cmopq48c800026izc0cqwb8dk', 'cmor6068p0000x6xg5dqd1v8g', NULL, '好吧', 1777899948070);
INSERT INTO "Comment" VALUES ('cmos9we3h00026ileoa7by6c8', 'postmopenbk2871cac051987a083', 'cmor6068p0000x6xg5dqd1v8g', NULL, 111, 1777964066909);
INSERT INTO "Comment" VALUES ('cmos9wifn00056ilehw4no316', 'postmopenbk2871cac051987a083', 'cmor6068p0000x6xg5dqd1v8g', NULL, 333, 1777964072531);
INSERT INTO "Comment" VALUES ('cmosmz67b00026ilhwyzdlmb3', 'cmosbcwbk000c6i8ijiux3tc9', 'cmor2ahrz0000x6hc95t87hg2', NULL, '还不错的呢', 1777986031656);
INSERT INTO "Comment" VALUES ('cmosn6z4n00046ilhzxa4u847', 'cmosbg0fa000p6i8i18lp6lcb', 'cmor2ahrz0000x6hc95t87hg2', NULL, '有点南坪', 1777986395735);
INSERT INTO "Comment" VALUES ('cmosr9gc200026i1zyshsr5q3', 'cmosbg0fa000p6i8i18lp6lcb', 'cmor6068p0000x6xg5dqd1v8g', 'cmosn6z4n00046ilhzxa4u847', '???', 1777993229810);
INSERT INTO "Comment" VALUES ('cmotpf1bb0002x6dg3ub50um8', 'cmosbg0fa000p6i8i18lp6lcb', 'cmor6068p0000x6xg5dqd1v8g', 'cmosr9gc200026i1zyshsr5q3', 666, 1778050597223);
INSERT INTO "Comment" VALUES ('cmotpzzsc0005x6dg9qe1qbmv', 'cmosbg0fa000p6i8i18lp6lcb', 'cmor6068p0000x6xg5dqd1v8g', NULL, '什么情况???', 1778051575020);

-- ----------------------------
-- Table structure for MediaAsset
-- ----------------------------
DROP TABLE IF EXISTS "MediaAsset";
CREATE TABLE "MediaAsset" (
  "id" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- ----------------------------
-- Records of "MediaAsset"
-- ----------------------------
INSERT INTO "MediaAsset" VALUES ('cmopq48bw00006izcilgz7lwm', 'tg-1777809907977-78ba6f71-a4fb-4c27-b5a8-dfebdc89e21d.jpg', '/uploads/telegram/tg-1777809907977-78ba6f71-a4fb-4c27-b5a8-dfebdc89e21d.jpg', 'IMAGE', 22293, 1777809908012);
INSERT INTO "MediaAsset" VALUES ('cmopq6s5300056izc0jlc8wnr', 'tg-1777810025704-df0f5233-5e9f-42c4-b454-12383cab02a3.mp4', '/uploads/telegram/tg-1777810025704-df0f5233-5e9f-42c4-b454-12383cab02a3.mp4', 'VIDEO', 3893969, 1777810026999);
INSERT INTO "MediaAsset" VALUES ('cmoqzcfpy00006ijkbjodlrnn', 'tg-1777885871701-824642c3-0037-4fdf-84ed-2a06b813c2eb.mp4', '/uploads/telegram/tg-1777885871701-824642c3-0037-4fdf-84ed-2a06b813c2eb.mp4', 'VIDEO', 13023490, 1777885873558);
INSERT INTO "MediaAsset" VALUES ('cmosbctnt00006i8is5nasghu', 'tg-1777966510985-a25bceb5-55c4-454b-8ce1-2eea223c82c0.mp4', '/uploads/telegram/tg-1777966510985-a25bceb5-55c4-454b-8ce1-2eea223c82c0.mp4', 'VIDEO', 13023490, 1777966513193);
INSERT INTO "MediaAsset" VALUES ('cmosbcvlk00056i8i33ooiol2', 'tg-1777966515378-ede514ad-64c0-45f0-8b74-39257d31f9a7.mp4', '/uploads/telegram/tg-1777966515378-ede514ad-64c0-45f0-8b74-39257d31f9a7.mp4', 'VIDEO', 3039487, 1777966515704);
INSERT INTO "MediaAsset" VALUES ('cmosbcwba000a6i8iyszyrdim', 'tg-1777966516381-bb61d3a8-9d55-4da7-bc7a-e3342118f39f.mp4', '/uploads/telegram/tg-1777966516381-bb61d3a8-9d55-4da7-bc7a-e3342118f39f.mp4', 'VIDEO', 3039487, 1777966516630);
INSERT INTO "MediaAsset" VALUES ('cmosbg0ey000n6i8iv4hlmfux', 'tg-1777966661617-6007ddcc-c49d-4486-8cda-344c61f2b540.jpg', '/uploads/telegram/tg-1777966661617-6007ddcc-c49d-4486-8cda-344c61f2b540.jpg', 'IMAGE', 182745, 1777966661914);
INSERT INTO "MediaAsset" VALUES ('cmosbg17o000s6i8itcatf0ao', 'tg-1777966662804-dbb35798-5f9e-459c-a8b6-1b36ca1c7280.jpg', '/uploads/telegram/tg-1777966662804-dbb35798-5f9e-459c-a8b6-1b36ca1c7280.jpg', 'IMAGE', 114848, 1777966662949);
INSERT INTO "MediaAsset" VALUES ('cmosbg1qs000v6i8im0vjvtp6', 'tg-1777966663489-b10aebbc-97c5-42e8-afb7-762b092820ed.jpg', '/uploads/telegram/tg-1777966663489-b10aebbc-97c5-42e8-afb7-762b092820ed.jpg', 'IMAGE', 110297, 1777966663636);
INSERT INTO "MediaAsset" VALUES ('cmosbg261000y6i8i55ita24c', 'tg-1777966664177-586ba956-1174-41b9-b408-d43773aaee7c.jpg', '/uploads/telegram/tg-1777966664177-586ba956-1174-41b9-b408-d43773aaee7c.jpg', 'IMAGE', 108299, 1777966664185);
INSERT INTO "MediaAsset" VALUES ('cmosbg2pe00116i8i1sydasfk', 'tg-1777966664734-76f0c71d-f3a9-4b4e-97b8-226ddd7faf51.jpg', '/uploads/telegram/tg-1777966664734-76f0c71d-f3a9-4b4e-97b8-226ddd7faf51.jpg', 'IMAGE', 116118, 1777966664882);
INSERT INTO "MediaAsset" VALUES ('cmosbg35000146i8iol29enyl', 'tg-1777966665435-ee66ad47-a39d-412b-b4c6-2a1e067933a0.jpg', '/uploads/telegram/tg-1777966665435-ee66ad47-a39d-412b-b4c6-2a1e067933a0.jpg', 'IMAGE', 104331, 1777966665444);
INSERT INTO "MediaAsset" VALUES ('cmosnbbfb00096ilhhhg527hy', 'tg-1777986597430-95010776-d4bf-4780-9d88-aedc82146875.mp4', '/uploads/telegram/tg-1777986597430-95010776-d4bf-4780-9d88-aedc82146875.mp4', 'VIDEO', 1573961, 1777986598295);
INSERT INTO "MediaAsset" VALUES ('cmosnjrf800006i72mg2poqe7', 'tg-1777986992197-a1193c16-fdc0-47b1-ac86-978d8781d953.jpg', '/uploads/telegram/tg-1777986992197-a1193c16-fdc0-47b1-ac86-978d8781d953.jpg', 'IMAGE', 35385, 1777986992277);
INSERT INTO "MediaAsset" VALUES ('cmosnjs1y00056i72dms8bm8s', 'tg-1777986993064-130c8a25-af33-4c25-af5e-4b0ca60e0df0.jpg', '/uploads/telegram/tg-1777986993064-130c8a25-af33-4c25-af5e-4b0ca60e0df0.jpg', 'IMAGE', 26132, 1777986993095);
INSERT INTO "MediaAsset" VALUES ('cmosnjt0l00086i72tjd1eamo', 'tg-1777986994204-d7b2f30b-4650-4669-a160-ee0790ef9c0b.jpg', '/uploads/telegram/tg-1777986994204-d7b2f30b-4650-4669-a160-ee0790ef9c0b.jpg', 'IMAGE', 64010, 1777986994341);
INSERT INTO "MediaAsset" VALUES ('cmosnlyt0000b6i72tgumbduq', 'tg-1777987093744-5f723cbe-7cf1-4284-9ed9-5c3a7aafad70.mp4', '/uploads/telegram/tg-1777987093744-5f723cbe-7cf1-4284-9ed9-5c3a7aafad70.mp4', 'VIDEO', 7957856, 1777987095156);
INSERT INTO "MediaAsset" VALUES ('cmosom2ra000g6i72rkmkoy3k', 'tg-1777988777405-d0266b0c-6187-4acc-832f-a4277cd96df6.mp4', '/uploads/telegram/tg-1777988777405-d0266b0c-6187-4acc-832f-a4277cd96df6.mp4', 'VIDEO', 8299773, 1777988779894);
INSERT INTO "MediaAsset" VALUES ('cmost7t3000006iqe4ujsyb4k', 'tg-1777996512097-242da392-bebb-4a05-a640-1bcf9a4ec3ff.jpg', '/uploads/telegram/tg-1777996512097-242da392-bebb-4a05-a640-1bcf9a4ec3ff.jpg', 'IMAGE', 102579, 1777996512252);
INSERT INTO "MediaAsset" VALUES ('cmost7tq500056iqe2danig8s', 'tg-1777996513081-9cf58db1-2dd1-40ba-95ec-9d67d4abb1a9.jpg', '/uploads/telegram/tg-1777996513081-9cf58db1-2dd1-40ba-95ec-9d67d4abb1a9.jpg', 'IMAGE', 84243, 1777996513085);
INSERT INTO "MediaAsset" VALUES ('cmost7uay00086iqeejoabo6s', 'tg-1777996513827-cb07d2c8-54ee-49a5-a3d8-670cf656ac84.jpg', '/uploads/telegram/tg-1777996513827-cb07d2c8-54ee-49a5-a3d8-670cf656ac84.jpg', 'IMAGE', 90386, 1777996513835);

-- ----------------------------
-- Table structure for OAuthLoginState
-- ----------------------------
DROP TABLE IF EXISTS "OAuthLoginState";
CREATE TABLE "OAuthLoginState" (
  "id" TEXT NOT NULL,
  "returnPath" TEXT NOT NULL,
  "oauthType" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- ----------------------------
-- Records of "OAuthLoginState"
-- ----------------------------
INSERT INTO "OAuthLoginState" VALUES ('8321e7c5a03574271b1f69f9408591ae5815bfc3', '/post/cmosbg0fa000p6i8i18lp6lcb', 'wx', 1778066479136, 1778065579138);

-- ----------------------------
-- Table structure for Post
-- ----------------------------
DROP TABLE IF EXISTS "Post";
CREATE TABLE "Post" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'ARTICLE',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "coverUrl" TEXT NOT NULL,
  "videoUrl" TEXT,
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "heat" INTEGER NOT NULL DEFAULT 100,
  "views" INTEGER NOT NULL DEFAULT 0,
  "publishedAt" DATETIME,
  "categoryId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "galleryImageUrls" TEXT,
  "contentBlocks" TEXT,
  "galleryVideoUrls" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "Post_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ----------------------------
-- Records of "Post"
-- ----------------------------
INSERT INTO "Post" VALUES ('postmopenbjy52516e3f611bf65d', '晚间热瓜：新综艺录制路透连出三波反转', '从排练动线到嘉宾互动，今晚的线索被整理成一条清晰时间线。', '今晚的热度主要来自一档新综艺的录制路透。第一波是现场观众提到舞台互动比预告更密集，第二波是工作人员调整流程后，嘉宾分组出现变化，第三波则是官方物料提前释放了新主题。当前能确定的是节目正在加速预热，具体名场面仍要等正式播出后再判断。

吃瓜建议：先看时间线，再看官方释出的完整版本，避免被片段剪辑带偏。', 'ARTICLE', 'PUBLISHED', '/assets/cover-spotlight.svg', NULL, 0, 0, 0, 1778139034967, 'catmopenbh3eff91c738e2f7b61', '2026-05-03T06:44:03.262Z', 1778139034969, NULL, NULL, NULL);
INSERT INTO "Post" VALUES ('postmopenbk0f5ac57f289023af1', '直播间小风波：一场临时改价引发弹幕热议', '品牌方、主播间和用户侧各有说法，真正关键是规则是否提前说明。', '一场直播活动里，部分商品在短时间内出现价格调整，弹幕因此快速升温。复盘下来，争议点并不在于优惠本身，而在于用户是否能提前看到清晰规则。若后续要平息讨论，最有效的方式不是情绪回应，而是公开说明库存、时间和补偿边界。

目前内容为虚构案例，用于展示吃瓜网的信息编排方式。', 'ARTICLE', 'PUBLISHED', '/assets/cover-live.svg', NULL, 0, 731, 16, '2026-05-03T06:44:03.264Z', 'catmopenbh37ec921b9da135426', '2026-05-03T06:44:03.264Z', 1778046671484, NULL, NULL, NULL);
INSERT INTO "Post" VALUES ('postmopenbk2871cac051987a083', '短视频区：片场花絮三十秒预览', '视频内容位已经打通，后台上传 MP4 后可直接替换播放。', '这个条目用于展示视频内容卡片和详情页播放器。首版默认展示封面和播放器区域，后台上传视频后会显示真实播放源。', 'VIDEO', 'PUBLISHED', '/assets/cover-stage.svg', NULL, 0, 668, 21, 1777892037046, 'catmopenbh3eff91c738e2f7b61', '2026-05-03T06:44:03.266Z', 1778029516055, NULL, NULL, NULL);
INSERT INTO "Post" VALUES ('postmopenbk31d383820f611f5b3', '图集：城市大屏物料更新，粉丝开始猜新代言', '从画面色彩到发布时间，大家把细节都翻了一遍。', '城市大屏物料更新后，讨论点集中在发布时间、色彩风格和品牌露出位置。虽然猜测很多，但在正式官宣前只能把它当作营销预热观察。

后台可以把这类内容设置为图文或图集，并上传多张图片后写入正文。', 'GALLERY', 'ARCHIVED', '/assets/cover-city.svg', NULL, 0, 544, 0, NULL, 'catmopenbh390c925d466517c85', '2026-05-03T06:44:03.267Z', 1777791881160, NULL, NULL, NULL);
INSERT INTO "Post" VALUES ('postmopenbk42d9242d76dc48a50', '职场边角料：经纪团队换班后节奏明显变快', '宣发节奏、物料密度和商务出现频率，是判断团队变化的三个窗口。', '最近几个虚构艺人项目的排期被重新整理后，一个明显现象是宣发动作更集中。团队换班并不一定意味着方向大改，但会影响对外沟通的速度和内容密度。对于吃瓜群众来说，看长期节奏比看单个物料更有价值。', 'ARTICLE', 'PUBLISHED', '/assets/cover-studio.svg', NULL, 0, 493, 13, '2026-05-03T06:44:03.268Z', 'catmopenbh3a4c69a1b95539aea', '2026-05-03T06:44:03.268Z', 1778033395732, NULL, NULL, NULL);
INSERT INTO "Post" VALUES ('cmopkwbbq0001x6fcr79fg2f9', 'Webhook 自测：纯文字', 'Webhook 自测：纯文字', 'Webhook 自测：纯文字', 'ARTICLE', 'PUBLISHED', '/assets/cover-live.svg', NULL, 0, 300, 23, 1777801308102, 'catmopenbh390c925d466517c85', 1777801140566, 1778029517037, NULL, NULL, NULL);
INSERT INTO "Post" VALUES ('cmopq48c800026izc0cqwb8dk', '郑恺抽烟事件又上热搜：大家到底在气什么？', '郑恺抽烟事件又上热搜：大家到底在气什么111？', '这两天，郑恺因为“抽烟”相关话题再次引发讨论，不少网友一边吃瓜，一边发问：明星抽烟，为什么总能掀起这么大的舆论？

乍一看，这似乎不算什么“惊天大瓜”。毕竟，抽烟本身并不是什么罕见事，很多公众人物也曾因为类似画面被拍到而登上热搜。但问题就在于，当普通人的日常行为放到明星身上，意义往往就变了。

对很多网友来说，大家讨论的未必只是“抽烟”这件事本身，而是更深一层的东西——公众形象、场合影响、以及明星作为公众人物所承担的示范效应。

尤其是在如今的舆论环境里，明星的一举一动都容易被无限放大。有人觉得：成年人抽烟是个人选择，只要不违反公共规定，不必过度上纲上线；但也有人认为：既然享受了公众关注和商业价值，就应该对自己的形象更加谨慎，至少别在容易引发争议的场景里留下话柄。

所以你会发现，每次类似事件出现，评论区几乎都会自动分成两派：

一派觉得没必要小题大做。“抽烟又不等于塌房”“明星也是普通人”“别把公众人物神化”。

另一派则认为问题没那么简单。“重点不是抽烟，而是场合和影响”“作为有粉丝、有代言的人，确实应该注意一点”“如果涉及公共场所规范，那就不是小事”。

这也是娱乐圈舆情最有意思的地方：同样一件事，在不同人眼里，完全是两种性质。

而郑恺这次之所以引发讨论，某种程度上也和他的既有公众印象有关。一直以来，他给人的感觉偏向阳光、活跃、综艺感强，属于比较有“观众缘”的类型。也正因为如此，一旦出现和部分人预期不一致的画面，就更容易让网友产生落差感。

说白了，网友有时候不是单纯在评价一件事，而是在评价：“这件事和我印象里的你，是不是一致？”

如果', 'ARTICLE', 'PUBLISHED', '/assets/cover-spotlight.svg', NULL, 0, 100, 122, 1777900471420, 'catmopenbh390c925d466517c85', 1777809908025, 1777967849996, NULL, NULL, NULL);
INSERT INTO "Post" VALUES ('cmopq6s5i00076izccm0jzvr0', 'Webhook 自测：视频', '如果哭红的双眼留不住你 那么我将放你自由', 'Webhook 自测：视频', 'ARTICLE', 'PUBLISHED', '/assets/cover-spotlight.svg', '/uploads/telegram/tg-1777810025704-df0f5233-5e9f-42c4-b454-12383cab02a3.mp4', 1, 10, 12, 1778138930793, 'catmopenbh3eff91c738e2f7b61', 1777810027014, 1778138964823, NULL, NULL, '["/uploads/telegram/tg-1777885871701-824642c3-0037-4fdf-84ed-2a06b813c2eb.mp4","/uploads/telegram/tg-1777988777405-d0266b0c-6187-4acc-832f-a4277cd96df6.mp4","/uploads/telegram/tg-1777987093744-5f723cbe-7cf1-4284-9ed9-5c3a7aafad70.mp4"]');
INSERT INTO "Post" VALUES ('cmoqz3bdm00016i7vw45ws478', '今天发布了新的作品', '今天发布了新的作品', '今天发布了新的作品', 'ARTICLE', 'PUBLISHED', '/assets/cover-spotlight.svg', NULL, 0, 100, 1, 1777900611462, 'catmopenbh390c925d466517c85', 1777885448026, 1777967382828, NULL, NULL, NULL);
INSERT INTO "Post" VALUES ('cmoqzcfqb00026ijkdn25ijbm', 'Kling 10s 广告生成！', '提示词：', 'Kling 10s 广告生成！

提示词：

参考图片只用于保持人物长相、脸部质感、服装风格和光影一致，不要静态展示参考图片，不要停留在原图构图。从第0秒第一帧开始人物已经在动作中，画面持续运动。

10秒电影级奢华广告短片。清晨法式梳妆台前，一位优雅亚洲女生穿着丝绸睡袍正在快速装扮。

0-1.5秒：第一帧开始，女生右手已经拿着粉扑接触脸颊，粉扑轻轻按压面部，脸部和手部同时轻微运动，镜头微距缓慢推进，不要静态停留。

1.5-3秒：切到右眼微距特写，头发完全别到耳后，画面中只出现眼睛、眉毛、睫毛和银色睫毛夹。睫毛夹水平靠近上睫毛根部，只夹住睫毛，不接触头发、不接触眉毛、不接触皮肤。睫毛夹缓慢闭合再松开，睫毛自然上翘。

3-4.5秒：切到嘴唇和手部微距，女生手持复古红色口红，口红膏体清晰接触下唇中央，从左到右缓慢滑过下唇，再轻轻涂过上唇，嘴唇逐渐呈现红色光泽。口红不能悬空，不能涂到脸颊。

4.5-6秒：切到侧脸和肩部中景，一缕长发被卷发棒轻轻缠绕，卷发棒只接触发中和发尾，不靠近眼睛、嘴唇和脸部，发丝缓慢卷曲，出现轻微水汽。

6-7.5秒：镜头跟随女生手指滑过黑色高级礼服面料，布料质感清晰，手指拿起带 BMW 标志的车钥匙，钥匙和标志清晰特写。

7.5-10秒：瞬间切换到夜晚霓虹街道，低角度追踪红色宝马跑车疾驰，车身反射霓虹灯光。跑车停下，剪刀门开启，穿着华丽黑色礼服的女生优雅下车，低角度特写礼服、车门和自信表情。

全程高动态，第一帧即动作，禁止静态展示参考图，禁止前2秒定格，禁止照片感开场，动作连续，镜头持续运动，cinematic lighting，luxury fashion commercial，smooth motion。

#kling #可灵 #广告 #短视频', 'ARTICLE', 'PUBLISHED', '/assets/cover-spotlight.svg', '/uploads/telegram/tg-1777885871701-824642c3-0037-4fdf-84ed-2a06b813c2eb.mp4', 0, 100, 7, 1777886857963, 'catmopenbh390c925d466517c85', 1777885873571, 1777988612904, NULL, NULL, NULL);
INSERT INTO "Post" VALUES ('cmor5wvo90001x6eo43ow162s', 1, 2, 3, 'ARTICLE', 'PUBLISHED', '/assets/cover-spotlight.svg', NULL, 0, 100, 1, 1777896905045, 'catmopenbh390c925d466517c85', 1777896905048, 1777967383704, NULL, NULL, NULL);
INSERT INTO "Post" VALUES ('cmor8733n0001x6a090im4ofx', 1, 3, 3, 'ARTICLE', 'PUBLISHED', '/assets/cover-spotlight.svg', NULL, 0, 100, 1, 1777900740465, 'catmopenbh390c925d466517c85', 1777900740467, 1777967382113, NULL, NULL, NULL);
INSERT INTO "Post" VALUES ('cmosbcto100026i8izjfvwogp', '【转自 AI绘画作品 · AI提示词】', '【转自 AI绘画作品 · AI提示词】', '【转自 AI绘画作品 · AI提示词】', 'VIDEO', 'PUBLISHED', '/assets/cover-live.svg', '/uploads/telegram/tg-1777966510985-a25bceb5-55c4-454b-8ce1-2eea223c82c0.mp4', 0, 300, 303, 1777966513200, 'catmopenbh390c925d466517c85', 1777966513202, 1777967850106, NULL, NULL, NULL);
INSERT INTO "Post" VALUES ('cmosbcvm600076i8ii522iqrg', '【转自 摸鱼文案馆】', '人在最接近幸福的时候最幸福', '【转自 摸鱼文案馆】
人在最接近幸福的时候最幸福

🐈 投稿来自 ————     🥰 呆呆不呆  

😂   摸鱼小群组  | 🧬   欢迎投稿', 'VIDEO', 'PUBLISHED', '/assets/cover-live.svg', '/uploads/telegram/tg-1777966515378-ede514ad-64c0-45f0-8b74-39257d31f9a7.mp4', 0, 300, 303, 1777966515721, 'catmopenbh390c925d466517c85', 1777966515727, 1777967849884, NULL, NULL, NULL);
INSERT INTO "Post" VALUES ('cmosbcwbk000c6i8ijiux3tc9', '【转自 摸鱼文案馆】', '人在最接近幸福的时候最幸福', '【转自 摸鱼文案馆】
人在最接近幸福的时候最幸福

🐈 投稿来自 ————     🥰 呆呆不呆  

😂   摸鱼小群组  | 🧬   欢迎投稿', 'VIDEO', 'PUBLISHED', '/assets/cover-live.svg', '/uploads/telegram/tg-1777966516381-bb61d3a8-9d55-4da7-bc7a-e3342118f39f.mp4', 0, 300, 322, 1777966516639, 'catmopenbh390c925d466517c85', 1777966516641, 1778138633684, NULL, NULL, NULL);
INSERT INTO "Post" VALUES ('cmosbcwld000g6i8ifxvdzpu1', '今天还不错的呢', '今天还不错的呢', '今天还不错的呢', 'ARTICLE', 'PUBLISHED', '/assets/cover-live.svg', NULL, 0, 300, 305, 1777966516992, 'catmopenbh390c925d466517c85', 1777966516993, 1778139886185, NULL, NULL, NULL);
INSERT INTO "Post" VALUES ('cmosbg0fa000p6i8i18lp6lcb', '【转自 优质信息收藏夹】', '熬了 3 个月、约 250 个小时，终于把我的第一个 Chrome 插件做出来了 🌱', '【转自 优质信息收藏夹】
熬了 3 个月、约 250 个小时，终于把我的第一个 Chrome 插件做出来了 🌱

它叫 Image Harvest，专门解决一个我一直很烦的问题——

每次想批量下载网页图片，要么右键被禁用，要么藏在 CSS 背景里抓不到，要么需要一张张点。
试过的所有"图片下载器"插件不是漏图就是夹带各种追踪。

所以我自己写了一个：
✓ 把网页里所有图片都扒出来（包括 CSS 背景、iframe、Shadow DOM 里的）
✓ 一键打包 ZIP 下载
✓ 可以多标签页同时扒
✓ 反向以图搜图（Google / TinEye / Baidu / Yandex）
✓ 相似图片自动识别去重
✓ 全本地处理，零追踪

免费版功能管够，重度用户可以解锁 Pro。

—— 试试看 ——
🛒 安装（Chrome Web Store）：https://chromewebstore.google.com/detail/iecgnjidmogebokcfnejncgnelcepffo
🌐 官网（功能详情）：https://image-harvest.kyriewen.cn

如果觉得还不错，**真心求一个 5 星好评**🙏 对一个独立开发者来说就是续命药水：
⭐ 留评：https://chromewebstore.google.com/detail/iecgnjidmogebokcfnejncgnelcepffo/reviews

有任何 bug 或建议，评论区直接砸过来。', 'ARTICLE', 'PUBLISHED', '/uploads/telegram/tg-1777966661617-6007ddcc-c49d-4486-8cda-344c61f2b540.jpg', NULL, 0, 0, 0, 1778138939640, 'catmopenbh3eff91c738e2f7b61', 1777966661926, 1778138939643, '["/uploads/telegram/tg-1777966662804-dbb35798-5f9e-459c-a8b6-1b36ca1c7280.jpg","/uploads/telegram/tg-1777966663489-b10aebbc-97c5-42e8-afb7-762b092820ed.jpg","/uploads/telegram/tg-1777966664177-586ba956-1174-41b9-b408-d43773aaee7c.jpg","/uploads/telegram/tg-1777966664734-76f0c71d-f3a9-4b4e-97b8-226ddd7faf51.jpg","/uploads/telegram/tg-1777966665435-ee66ad47-a39d-412b-b4c6-2a1e067933a0.jpg"]', NULL, NULL);
INSERT INTO "Post" VALUES ('cmosn8ok500066ilhqhi59ixn', '【转自 今天你想跑路了吗？？】', '集美💅简简单单维权😁', '【转自 今天你想跑路了吗？？】
集美💅简简单单维权😁
使用女性力量
却被县城精神小伙居然暴打了😡

「匿名投票」
支持小伙：💅😁🥰❤️🫡😱
支持集美：😭😢😂🙈🤣👍
其他Emojy：我就是来凑数的参与最重要', 'ARTICLE', 'PUBLISHED', '/assets/cover-live.svg', NULL, 0, 300, 308, 1777986475347, 'catmopenbh390c925d466517c85', 1777986475349, 1778062262136, NULL, NULL, NULL);
INSERT INTO "Post" VALUES ('cmosnbbfl000b6ilhyxqqz7fz', '【转自 摸鱼文案馆】', '如果哭红的双眼留不住你 那么我将放你自由', '【转自 摸鱼文案馆】
如果哭红的双眼留不住你 那么我将放你自由

🐈 投稿来自 ————   🐰  迈巴赫

😂   摸鱼小群组  | 🧬   欢迎投稿', 'ARTICLE', 'PUBLISHED', '/assets/cover-live.svg', '/uploads/telegram/tg-1777986597430-95010776-d4bf-4780-9d88-aedc82146875.mp4', 1, 309, 309, 1778139026590, 'catmopenbh3eff91c738e2f7b61', 1777986598305, 1778139026592, NULL, NULL, NULL);
INSERT INTO "Post" VALUES ('cmosnjrff00026i72wdfwi8vc', '【转自 摸鱼文案馆】', '“世界上最好的贵人，就是执行力超强的自己”💕', '【转自 摸鱼文案馆】
“世界上最好的贵人，就是执行力超强的自己”💕

🐈 投稿来自 ————     香米  💨💨

😂   摸鱼小群组  | 🧬   欢迎投稿', 'ARTICLE', 'PUBLISHED', '/uploads/telegram/tg-1777986992197-a1193c16-fdc0-47b1-ac86-978d8781d953.jpg', NULL, 0, 0, 21, 1778138881989, 'catmopenbh3eff91c738e2f7b61', 1777986992283, 1778140280607, '["/uploads/telegram/tg-1777986993064-130c8a25-af33-4c25-af5e-4b0ca60e0df0.jpg","/uploads/telegram/tg-1777986994204-d7b2f30b-4650-4669-a160-ee0790ef9c0b.jpg"]', NULL, NULL);
INSERT INTO "Post" VALUES ('cmosnlytk000d6i72gus87pll', '【转自 吃瓜热点】', '便利店倒霉🤯', '【转自 吃瓜热点】
便利店倒霉🤯', 'VIDEO', 'PUBLISHED', '/assets/cover-live.svg', '/uploads/telegram/tg-1777987093744-5f723cbe-7cf1-4284-9ed9-5c3a7aafad70.mp4', 0, 300, 304, 1777987095172, 'catmopenbh390c925d466517c85', 1777987095176, 1778048207460, NULL, NULL, NULL);
INSERT INTO "Post" VALUES ('cmosom2ro000i6i72nu2jurej', '【转自 今天你想跑路了吗？？】', '日支地雷妹真实线下', '【转自 今天你想跑路了吗？？】
日支地雷妹真实线下
be like：', 'ARTICLE', 'PUBLISHED', '/assets/cover-live.svg', '/uploads/telegram/tg-1777988777405-d0266b0c-6187-4acc-832f-a4277cd96df6.mp4', 1, 306, 307, 1778138669751, 'catmopenbh3eff91c738e2f7b61', 1777988779908, 1778138892331, NULL, NULL, NULL);
INSERT INTO "Post" VALUES ('cmost7t3600026iqet6aymgj9', '斯威士兰国王姆斯瓦蒂三世今日接见了台湾领导人赖清德。', '斯威士兰国王姆斯瓦蒂三世今日接见了台湾领导人赖清德。', '【转自 吃瓜🍉｜搞笑🥸｜软色情🥵｜树洞投稿📮】
斯威士兰国王姆斯瓦蒂三世今日接见了台湾领导人赖清德。', 'ARTICLE', 'PUBLISHED', '/uploads/telegram/tg-1777996512097-242da392-bebb-4a05-a640-1bcf9a4ec3ff.jpg', NULL, 0, 0, 21, 1778058567464, 'catmopenbh3eff91c738e2f7b61', 1777996512259, 1778140072623, '["/uploads/telegram/tg-1777996513081-9cf58db1-2dd1-40ba-95ec-9d67d4abb1a9.jpg"]', NULL, NULL);

-- ----------------------------
-- Table structure for PostTag
-- ----------------------------
DROP TABLE IF EXISTS "PostTag";
CREATE TABLE "PostTag" (
  "postId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  PRIMARY KEY ("postId", "tagId"),
  CONSTRAINT "PostTag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PostTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ----------------------------
-- Records of "PostTag"
-- ----------------------------
INSERT INTO "PostTag" VALUES ('cmopq48c800026izc0cqwb8dk', 'cmor7wc94000gx670rdek1u0t');
INSERT INTO "PostTag" VALUES ('cmopq48c800026izc0cqwb8dk', 'cmor7vvlj000cx670tk1ejmhb');

-- ----------------------------
-- Table structure for SiteSettings
-- ----------------------------
DROP TABLE IF EXISTS "SiteSettings";
CREATE TABLE "SiteSettings" (
  "id" TEXT NOT NULL DEFAULT 'main',
  "allowAnonymousComments" BOOLEAN NOT NULL DEFAULT true,
  "mediaStorage" TEXT NOT NULL DEFAULT 'local',
  "r2AccountId" TEXT,
  "r2BucketName" TEXT,
  "r2PublicBaseUrl" TEXT,
  "r2AccessKeyId" TEXT,
  "r2SecretAccessKey" TEXT,
  "updatedAt" DATETIME NOT NULL,
  PRIMARY KEY ("id")
);

-- ----------------------------
-- Records of "SiteSettings"
-- ----------------------------
INSERT INTO "SiteSettings" VALUES ('main', 1, 'r2', 'f143aca79e142ece2a6261ad4c1553cb', 'guajj', NULL, '2bcbe3ff21fe15dec35e4de0585c1c3b', '4412226cd85aa005081523b3848f6058fb3b82737e3be5c9ac5246b504c53628', 1778229964944);

-- ----------------------------
-- Table structure for SocialUser
-- ----------------------------
DROP TABLE IF EXISTS "SocialUser";
CREATE TABLE "SocialUser" (
  "id" TEXT NOT NULL,
  "socialUid" TEXT NOT NULL,
  "loginType" TEXT NOT NULL,
  "nickname" TEXT NOT NULL,
  "faceimg" TEXT NOT NULL,
  "gender" TEXT,
  "location" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "lastLoginAt" DATETIME,
  PRIMARY KEY ("id")
);

-- ----------------------------
-- Records of "SocialUser"
-- ----------------------------
INSERT INTO "SocialUser" VALUES ('cmor2ahrz0000x6hc95t87hg2', 'oOmiU6p1Mj1uDqWEeZe4ZUWRQty4', 'wx', '666 ', 'https://thirdwx.qlogo.cn/mmopen/vi_32/Q3auHgzwzM6CQ7b2ub0Kc2FoiaLcAUfPsQoM3Sg4tkLNCyBxXpHDPjibWSQBVyBLdrcicrjquiaSiapzjSFiaEuq3eCmWJqcwumJRBHRYoic3vzmYSbYMxibwSeCDQ/132', '男', NULL, 1777890821759, 1777985984280, NULL);
INSERT INTO "SocialUser" VALUES ('cmor6068p0000x6xg5dqd1v8g', '__site_anonymous__', 'anonymous', '匿名', '', NULL, NULL, 1777897058714, 1778051575012, NULL);

-- ----------------------------
-- Table structure for Tag
-- ----------------------------
DROP TABLE IF EXISTS "Tag";
CREATE TABLE "Tag" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- ----------------------------
-- Records of "Tag"
-- ----------------------------
INSERT INTO "Tag" VALUES ('cmor7vvlj000cx670tk1ejmhb', '猎奇', 'tag-1777900217525', 1777900217527);
INSERT INTO "Tag" VALUES ('cmor7wc94000gx670rdek1u0t', '八卦', 'tag-1777900239110', 1777900239112);
INSERT INTO "Tag" VALUES ('cmor7wg8h000hx6708p121vqm', '陈年旧瓜', 'tag-1777900244271', 1777900244273);
INSERT INTO "Tag" VALUES ('cmor7wx2k000ix670lujt4grk', '热点', 'tag-1777900266091', 1777900266093);
INSERT INTO "Tag" VALUES ('cmpez14ut0007x6vkh6is682d', '热瓜', 'hot', 1779336534486);
INSERT INTO "Tag" VALUES ('cmpez14uy0008x6vkausfam1h', '图文', 'article', 1779336534490);
INSERT INTO "Tag" VALUES ('cmpez14v30009x6vky7fmulx7', '视频', 'video', 1779336534496);
INSERT INTO "Tag" VALUES ('cmpez14v7000ax6vk5ojjouua', '时间线', 'timeline', 1779336534500);
INSERT INTO "Tag" VALUES ('cmpez14vb000bx6vk6anvh0hv', '幕后', 'behind', 1779336534504);
INSERT INTO "Tag" VALUES ('cmpez14vg000cx6vkqz79d0um', '轻讨论', 'talk', 1779336534508);

-- ----------------------------
-- Table structure for TelegramConfig
-- ----------------------------
DROP TABLE IF EXISTS "TelegramConfig";
CREATE TABLE "TelegramConfig" (
  "id" TEXT NOT NULL,
  "botToken" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "channelName" TEXT,
  "webhookSecret" TEXT NOT NULL,
  "defaultCategoryId" TEXT NOT NULL,
  "defaultStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  "autoPublish" BOOLEAN NOT NULL DEFAULT false,
  "downloadMedia" BOOLEAN NOT NULL DEFAULT true,
  "isEnabled" BOOLEAN NOT NULL DEFAULT false,
  "lastUpdateId" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  PRIMARY KEY ("id")
);

-- ----------------------------
-- Records of "TelegramConfig"
-- ----------------------------
INSERT INTO "TelegramConfig" VALUES ('cmopg1xog0000x6fk1p8c21sk', '8654102612:AAHyLi7C_gcwTairzVbE3RNTIZPIV7KMMGA', '@chigua52_free', '吃瓜频道总群', '6dcf738cb55b4b4fde5d85e056ac67d4cf45f7ec0f523e11', 'catmopenbh390c925d466517c85', 'PUBLISHED', 0, 1, 1, 481328812, 1777793004736, 1777996513851);

-- ----------------------------
-- Table structure for TelegramImport
-- ----------------------------
DROP TABLE IF EXISTS "TelegramImport";
CREATE TABLE "TelegramImport" (
  "id" TEXT NOT NULL,
  "updateId" INTEGER,
  "messageId" INTEGER NOT NULL,
  "chatId" TEXT NOT NULL,
  "chatTitle" TEXT,
  "rawText" TEXT NOT NULL,
  "mediaType" TEXT,
  "mediaUrl" TEXT,
  "postId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "mediaGroupId" TEXT,
  PRIMARY KEY ("id"),
  CONSTRAINT "TelegramImport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- ----------------------------
-- Records of "TelegramImport"
-- ----------------------------
INSERT INTO "TelegramImport" VALUES ('cmopilbzu0003x6i435jbg4w8', 481328784, 6, -1003932359637, '52吃瓜', 6666, NULL, NULL, NULL, 1777797268986, NULL);
INSERT INTO "TelegramImport" VALUES ('cmopkwbbx0003x6fc1dln19ms', 700001, 800001, -1003932359637, '52吃瓜', 'Webhook 自测：纯文字', NULL, NULL, 'cmopkwbbq0001x6fcr79fg2f9', 1777801140573, NULL);
INSERT INTO "TelegramImport" VALUES ('cmopq48cp00046izc100dfogb', 700002, 800002, -1003932359637, '52吃瓜', 'Webhook 自测：带图', 'IMAGE', '/uploads/telegram/tg-1777809907977-78ba6f71-a4fb-4c27-b5a8-dfebdc89e21d.jpg', 'cmopq48c800026izc0cqwb8dk', 1777809908041, NULL);
INSERT INTO "TelegramImport" VALUES ('cmopq6s7o00096izc9gzhh5r1', 700003, 800003, -1003932359637, '52吃瓜', 'Webhook 自测：视频', 'VIDEO', '/uploads/telegram/tg-1777810025704-df0f5233-5e9f-42c4-b454-12383cab02a3.mp4', 'cmopq6s5i00076izccm0jzvr0', 1777810027092, NULL);
INSERT INTO "TelegramImport" VALUES ('cmoqz3bdt00036i7vr2spvhki', 700002, 800009, -1003932359637, '52吃瓜', '今天发布了新的作品', NULL, NULL, 'cmoqz3bdm00016i7vw45ws478', 1777885448034, NULL);
INSERT INTO "TelegramImport" VALUES ('cmoqzcfqs00046ijkwokhlz1z', 700003, 13, -1003932359637, '52吃瓜', 'Kling 10s 广告生成！

提示词：

参考图片只用于保持人物长相、脸部质感、服装风格和光影一致，不要静态展示参考图片，不要停留在原图构图。从第0秒第一帧开始人物已经在动作中，画面持续运动。

10秒电影级奢华广告短片。清晨法式梳妆台前，一位优雅亚洲女生穿着丝绸睡袍正在快速装扮。

0-1.5秒：第一帧开始，女生右手已经拿着粉扑接触脸颊，粉扑轻轻按压面部，脸部和手部同时轻微运动，镜头微距缓慢推进，不要静态停留。

1.5-3秒：切到右眼微距特写，头发完全别到耳后，画面中只出现眼睛、眉毛、睫毛和银色睫毛夹。睫毛夹水平靠近上睫毛根部，只夹住睫毛，不接触头发、不接触眉毛、不接触皮肤。睫毛夹缓慢闭合再松开，睫毛自然上翘。

3-4.5秒：切到嘴唇和手部微距，女生手持复古红色口红，口红膏体清晰接触下唇中央，从左到右缓慢滑过下唇，再轻轻涂过上唇，嘴唇逐渐呈现红色光泽。口红不能悬空，不能涂到脸颊。

4.5-6秒：切到侧脸和肩部中景，一缕长发被卷发棒轻轻缠绕，卷发棒只接触发中和发尾，不靠近眼睛、嘴唇和脸部，发丝缓慢卷曲，出现轻微水汽。

6-7.5秒：镜头跟随女生手指滑过黑色高级礼服面料，布料质感清晰，手指拿起带 BMW 标志的车钥匙，钥匙和标志清晰特写。

7.5-10秒：瞬间切换到夜晚霓虹街道，低角度追踪红色宝马跑车疾驰，车身反射霓虹灯光。跑车停下，剪刀门开启，穿着华丽黑色礼服的女生优雅下车，低角度特写礼服、车门和自信表情。

全程高动态，第一帧即动作，禁止静态展示参考图，禁止前2秒定格，禁止照片感开场，动作连续，镜头持续运动，cinematic lighting，luxury fashion commercial，smooth motion。

#kling #可灵 #广告 #短视频', 'VIDEO', '/uploads/telegram/tg-1777885871701-824642c3-0037-4fdf-84ed-2a06b813c2eb.mp4', 'cmoqzcfqb00026ijkdn25ijbm', 1777885873588, NULL);
INSERT INTO "TelegramImport" VALUES ('cmosbcto800046i8iagzlg7bk', 481328792, 14, -1003932359637, '52吃瓜', '【转自 AI绘画作品 · AI提示词】', 'VIDEO', '/uploads/telegram/tg-1777966510985-a25bceb5-55c4-454b-8ce1-2eea223c82c0.mp4', 'cmosbcto100026i8izjfvwogp', 1777966513209, 14223084774756361);
INSERT INTO "TelegramImport" VALUES ('cmosbcvnt00096i8icvhcjdkc', 481328793, 15, -1003932359637, '52吃瓜', '【转自 摸鱼文案馆】
人在最接近幸福的时候最幸福

🐈 投稿来自 ————     🥰 呆呆不呆  

😂   摸鱼小群组  | 🧬   欢迎投稿', 'VIDEO', '/uploads/telegram/tg-1777966515378-ede514ad-64c0-45f0-8b74-39257d31f9a7.mp4', 'cmosbcvm600076i8ii522iqrg', 1777966515785, NULL);
INSERT INTO "TelegramImport" VALUES ('cmosbcwct000e6i8irzp4mhdv', 481328794, 16, -1003932359637, '52吃瓜', '【转自 摸鱼文案馆】
人在最接近幸福的时候最幸福

🐈 投稿来自 ————     🥰 呆呆不呆  

😂   摸鱼小群组  | 🧬   欢迎投稿', 'VIDEO', '/uploads/telegram/tg-1777966516381-bb61d3a8-9d55-4da7-bc7a-e3342118f39f.mp4', 'cmosbcwbk000c6i8ijiux3tc9', 1777966516685, NULL);
INSERT INTO "TelegramImport" VALUES ('cmosbcwlx000i6i8in0gwco64', 481328795, 17, -1003932359637, '52吃瓜', '今天还不错的呢', NULL, NULL, 'cmosbcwld000g6i8ifxvdzpu1', 1777966517014, NULL);
INSERT INTO "TelegramImport" VALUES ('cmosbcwu1000m6i8ipm1dq1fg', 481328796, 18, -1003932359637, '52吃瓜', 666, NULL, NULL, NULL, 1777966517305, NULL);
INSERT INTO "TelegramImport" VALUES ('cmosbg0fq000r6i8ig1drcz43', 481328797, 19, -1003932359637, '52吃瓜', '【转自 优质信息收藏夹】', 'IMAGE', '/uploads/telegram/tg-1777966661617-6007ddcc-c49d-4486-8cda-344c61f2b540.jpg', 'cmosbg0fa000p6i8i18lp6lcb', 1777966661942, 14223733268010841);
INSERT INTO "TelegramImport" VALUES ('cmosbg189000u6i8i6z8jzyna', 481328798, 20, -1003932359637, '52吃瓜', '【转自 优质信息收藏夹】', 'IMAGE', '/uploads/telegram/tg-1777966662804-dbb35798-5f9e-459c-a8b6-1b36ca1c7280.jpg', 'cmosbg0fa000p6i8i18lp6lcb', 1777966662970, 14223733268010841);
INSERT INTO "TelegramImport" VALUES ('cmosbg1rb000x6i8i55vutsvz', 481328799, 21, -1003932359637, '52吃瓜', '【转自 优质信息收藏夹】', 'IMAGE', '/uploads/telegram/tg-1777966663489-b10aebbc-97c5-42e8-afb7-762b092820ed.jpg', 'cmosbg0fa000p6i8i18lp6lcb', 1777966663655, 14223733268010841);
INSERT INTO "TelegramImport" VALUES ('cmosbg26i00106i8ihaqwbn76', 481328800, 22, -1003932359637, '52吃瓜', '【转自 优质信息收藏夹】', 'IMAGE', '/uploads/telegram/tg-1777966664177-586ba956-1174-41b9-b408-d43773aaee7c.jpg', 'cmosbg0fa000p6i8i18lp6lcb', 1777966664202, 14223733268010841);
INSERT INTO "TelegramImport" VALUES ('cmosbg2q000136i8ihqm1nkxy', 481328801, 23, -1003932359637, '52吃瓜', '【转自 优质信息收藏夹】', 'IMAGE', '/uploads/telegram/tg-1777966664734-76f0c71d-f3a9-4b4e-97b8-226ddd7faf51.jpg', 'cmosbg0fa000p6i8i18lp6lcb', 1777966664904, 14223733268010841);
INSERT INTO "TelegramImport" VALUES ('cmosbg36400166i8i57ihtrof', 481328802, 24, -1003932359637, '52吃瓜', '【转自 优质信息收藏夹】
熬了 3 个月、约 250 个小时，终于把我的第一个 Chrome 插件做出来了 🌱

它叫 Image Harvest，专门解决一个我一直很烦的问题——

每次想批量下载网页图片，要么右键被禁用，要么藏在 CSS 背景里抓不到，要么需要一张张点。
试过的所有"图片下载器"插件不是漏图就是夹带各种追踪。

所以我自己写了一个：
✓ 把网页里所有图片都扒出来（包括 CSS 背景、iframe、Shadow DOM 里的）
✓ 一键打包 ZIP 下载
✓ 可以多标签页同时扒
✓ 反向以图搜图（Google / TinEye / Baidu / Yandex）
✓ 相似图片自动识别去重
✓ 全本地处理，零追踪

免费版功能管够，重度用户可以解锁 Pro。

—— 试试看 ——
🛒 安装（Chrome Web Store）：https://chromewebstore.google.com/detail/iecgnjidmogebokcfnejncgnelcepffo
🌐 官网（功能详情）：https://image-harvest.kyriewen.cn

如果觉得还不错，**真心求一个 5 星好评**🙏 对一个独立开发者来说就是续命药水：
⭐ 留评：https://chromewebstore.google.com/detail/iecgnjidmogebokcfnejncgnelcepffo/reviews

有任何 bug 或建议，评论区直接砸过来。', 'IMAGE', '/uploads/telegram/tg-1777966665435-ee66ad47-a39d-412b-b4c6-2a1e067933a0.jpg', 'cmosbg0fa000p6i8i18lp6lcb', 1777966665485, 14223733268010841);
INSERT INTO "TelegramImport" VALUES ('cmosn8okk00086ilhzaiao5s2', 481328803, 25, -1003932359637, '52吃瓜', '【转自 今天你想跑路了吗？？】
集美💅简简单单维权😁
使用女性力量
却被县城精神小伙居然暴打了😡

「匿名投票」
支持小伙：💅😁🥰❤️🫡😱
支持集美：😭😢😂🙈🤣👍
其他Emojy：我就是来凑数的参与最重要', 'VIDEO', NULL, 'cmosn8ok500066ilhqhi59ixn', 1777986475364, NULL);
INSERT INTO "TelegramImport" VALUES ('cmosnbbg4000d6ilhtfyh27aa', 481328804, 26, -1003932359637, '52吃瓜', '【转自 摸鱼文案馆】
如果哭红的双眼留不住你 那么我将放你自由

🐈 投稿来自 ————   🐰  迈巴赫

😂   摸鱼小群组  | 🧬   欢迎投稿', 'VIDEO', '/uploads/telegram/tg-1777986597430-95010776-d4bf-4780-9d88-aedc82146875.mp4', 'cmosnbbfl000b6ilhyxqqz7fz', 1777986598324, NULL);
INSERT INTO "TelegramImport" VALUES ('cmosnjrfl00046i729214ipvt', 481328805, 27, -1003932359637, '52吃瓜', '【转自 摸鱼文案馆】
“世界上最好的贵人，就是执行力超强的自己”💕

🐈 投稿来自 ————     香米  💨💨

😂   摸鱼小群组  | 🧬   欢迎投稿', 'IMAGE', '/uploads/telegram/tg-1777986992197-a1193c16-fdc0-47b1-ac86-978d8781d953.jpg', 'cmosnjrff00026i72wdfwi8vc', 1777986992290, 14223895906140649);
INSERT INTO "TelegramImport" VALUES ('cmosnjs2b00076i72aphkanwi', 481328806, 28, -1003932359637, '52吃瓜', '【转自 摸鱼文案馆】', 'IMAGE', '/uploads/telegram/tg-1777986993064-130c8a25-af33-4c25-af5e-4b0ca60e0df0.jpg', 'cmosnjrff00026i72wdfwi8vc', 1777986993107, 14223895906140649);
INSERT INTO "TelegramImport" VALUES ('cmosnjt1g000a6i72795hxieb', 481328807, 29, -1003932359637, '52吃瓜', '【转自 摸鱼文案馆】', 'IMAGE', '/uploads/telegram/tg-1777986994204-d7b2f30b-4650-4669-a160-ee0790ef9c0b.jpg', 'cmosnjrff00026i72wdfwi8vc', 1777986994372, 14223895906140649);
INSERT INTO "TelegramImport" VALUES ('cmosnlyu2000f6i729rgw3bh4', 481328808, 30, -1003932359637, '52吃瓜', '【转自 吃瓜热点】
便利店倒霉🤯', 'VIDEO', '/uploads/telegram/tg-1777987093744-5f723cbe-7cf1-4284-9ed9-5c3a7aafad70.mp4', 'cmosnlytk000d6i72gus87pll', 1777987095194, NULL);
INSERT INTO "TelegramImport" VALUES ('cmosom2rv000k6i72cjjmjtyz', 481328809, 31, -1003932359637, '52吃瓜', '【转自 今天你想跑路了吗？？】
日支地雷妹真实线下
be like：', 'VIDEO', '/uploads/telegram/tg-1777988777405-d0266b0c-6187-4acc-832f-a4277cd96df6.mp4', 'cmosom2ro000i6i72nu2jurej', 1777988779915, NULL);
INSERT INTO "TelegramImport" VALUES ('cmost7t3d00046iqe1eorjdhh', 481328810, 32, -1003932359637, '52吃瓜', '【转自 吃瓜🍉｜搞笑🥸｜软色情🥵｜树洞投稿📮】
斯威士兰国王姆斯瓦蒂三世今日接见了台湾领导人赖清德。', 'IMAGE', '/uploads/telegram/tg-1777996512097-242da392-bebb-4a05-a640-1bcf9a4ec3ff.jpg', 'cmost7t3600026iqet6aymgj9', 1777996512265, 14223972078086921);
INSERT INTO "TelegramImport" VALUES ('cmost7tqf00076iqehoaph0ba', 481328811, 33, -1003932359637, '52吃瓜', '【转自 吃瓜🍉｜搞笑🥸｜软色情🥵｜树洞投稿📮】', 'IMAGE', '/uploads/telegram/tg-1777996513081-9cf58db1-2dd1-40ba-95ec-9d67d4abb1a9.jpg', 'cmost7t3600026iqet6aymgj9', 1777996513096, 14223972078086921);
INSERT INTO "TelegramImport" VALUES ('cmost7ub9000a6iqeexeb5y9l', 481328812, 34, -1003932359637, '52吃瓜', '【转自 吃瓜🍉｜搞笑🥸｜软色情🥵｜树洞投稿📮】', 'IMAGE', '/uploads/telegram/tg-1777996513827-cb07d2c8-54ee-49a5-a3d8-670cf656ac84.jpg', 'cmost7t3600026iqet6aymgj9', 1777996513845, 14223972078086921);

-- ----------------------------
-- Table structure for TgIndexedMessage
-- ----------------------------
DROP TABLE IF EXISTS "TgIndexedMessage";
CREATE TABLE "TgIndexedMessage" (
  "id" TEXT NOT NULL,
  "chatId" TEXT NOT NULL,
  "messageId" INTEGER NOT NULL,
  "messageDate" DATETIME NOT NULL,
  "contentType" TEXT NOT NULL DEFAULT 'TEXT',
  "title" TEXT NOT NULL,
  "snippet" TEXT NOT NULL,
  "rawText" TEXT NOT NULL,
  "sourceTitle" TEXT,
  "sourceUsername" TEXT,
  "durationSec" INTEGER,
  "mediaUrl" TEXT,
  "mediaGroupId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

-- ----------------------------
-- Records of "TgIndexedMessage"
-- ----------------------------
INSERT INTO "TgIndexedMessage" VALUES ('cmpez14vl000dx6vkyftmr4pp', -1001111000001, 1001, 1775732934511, 'VIDEO', '牛教练健身日常片段曝光', '牛教练在健身房录制的一段日常训练，网友讨论动作是否标准…', '牛教练健身日常片段曝光

牛教练在健身房录制的一段日常训练，网友讨论动作是否标准。相关话题持续发酵，更多片段仍在整理中。', '吃瓜速递', 'gossip_feed', 42, NULL, NULL, 1779336534514);
INSERT INTO "TgIndexedMessage" VALUES ('cmpez14vr000ex6vkgokcrjda', -1001111000001, 1002, 1775729334518, 'VIDEO', '牛教练直播回放精华剪辑', '昨晚直播中的高能片段汇总，含互动问答环节…', '牛教练直播回放精华剪辑

昨晚直播中的高能片段汇总，含互动问答环节。', '吃瓜速递', NULL, 81, NULL, NULL, 1779336534519);
INSERT INTO "TgIndexedMessage" VALUES ('cmpez14vw000fx6vkf9xt4wgs', -1001111000002, 2001, 1772132934523, 'TEXT', '牛教练聊天记录整理（文字版）', '群友整理的对话时间线，涉及合作与行程讨论…', '牛教练聊天记录整理（文字版）

群友整理的对话时间线，涉及合作与行程讨论。仅供检索演示。', '圈内爆料', NULL, NULL, NULL, NULL, 1779336534524);
INSERT INTO "TgIndexedMessage" VALUES ('cmpez14w2000gx6vkgy6dhq12', -1001111000003, 3001, 1768532934530, 'DOCUMENT', '牛教练相关物料 PDF 汇总', '包含多张截图与说明的压缩整理，文件较大建议 WiFi 下载…', '牛教练相关物料 PDF 汇总

包含多张截图与说明的压缩整理。', '资源归档', NULL, NULL, NULL, NULL, 1779336534531);
INSERT INTO "TgIndexedMessage" VALUES ('cmpez14wa000hx6vk8st8ffoe', -1001111000001, 1003, 1775725734537, 'PHOTO', '牛教练活动现场九宫格', '粉丝拍摄的现场图集，共 9 张高清图…', '牛教练活动现场九宫格

粉丝拍摄的现场图集。', '吃瓜速递', NULL, NULL, '/assets/cover-city.svg', NULL, 1779336534538);
INSERT INTO "TgIndexedMessage" VALUES ('cmpez14wh000ix6vk31dqt86e', -1001111000004, 4001, 1764932934544, 'VIDEO', '赵露思新剧路透短视频', '片场路透 30 秒，服装造型引热议…', '赵露思新剧路透短视频

片场路透 30 秒，服装造型引热议。', '影视路透站', NULL, 30, NULL, NULL, 1779336534545);
INSERT INTO "TgIndexedMessage" VALUES ('cmpez14wm000jx6vkfvv4ipyq', -1001111000004, 4002, 1764929334549, 'TEXT', '教母话题长文梳理', '按时间线梳理近期争议节点，附多方说法…', '教母话题长文梳理

按时间线梳理近期争议节点。', '深度吃瓜', NULL, NULL, NULL, NULL, 1779336534550);
INSERT INTO "TgIndexedMessage" VALUES ('cmpez14wq000kx6vkv6zy0eul', -1001111000005, 5001, 1761332934554, 'VIDEO', '货代周周访谈片段', '行业访谈节选，谈及跨境物流与行情…', '货代周周访谈片段

行业访谈节选。', '财经边角', NULL, 125, NULL, NULL, 1779336534555);

-- ----------------------------
-- Indexes structure for table AdminUser
-- ----------------------------
CREATE UNIQUE INDEX "AdminUser_username_key"
ON "AdminUser" (
  "username" ASC
);

-- ----------------------------
-- Indexes structure for table Category
-- ----------------------------
CREATE UNIQUE INDEX "Category_name_key"
ON "Category" (
  "name" ASC
);
CREATE UNIQUE INDEX "Category_slug_key"
ON "Category" (
  "slug" ASC
);

-- ----------------------------
-- Indexes structure for table Comment
-- ----------------------------
CREATE INDEX "Comment_postId_createdAt_idx"
ON "Comment" (
  "postId" ASC,
  "createdAt" ASC
);
CREATE INDEX "Comment_postId_parentId_idx"
ON "Comment" (
  "postId" ASC,
  "parentId" ASC
);

-- ----------------------------
-- Indexes structure for table OAuthLoginState
-- ----------------------------
CREATE INDEX "OAuthLoginState_expiresAt_idx"
ON "OAuthLoginState" (
  "expiresAt" ASC
);

-- ----------------------------
-- Indexes structure for table SocialUser
-- ----------------------------
CREATE UNIQUE INDEX "SocialUser_loginType_socialUid_key"
ON "SocialUser" (
  "loginType" ASC,
  "socialUid" ASC
);

-- ----------------------------
-- Indexes structure for table Tag
-- ----------------------------
CREATE UNIQUE INDEX "Tag_name_key"
ON "Tag" (
  "name" ASC
);
CREATE UNIQUE INDEX "Tag_slug_key"
ON "Tag" (
  "slug" ASC
);

-- ----------------------------
-- Indexes structure for table TelegramConfig
-- ----------------------------
CREATE UNIQUE INDEX "TelegramConfig_webhookSecret_key"
ON "TelegramConfig" (
  "webhookSecret" ASC
);

-- ----------------------------
-- Indexes structure for table TelegramImport
-- ----------------------------
CREATE INDEX "TelegramImport_chatId_mediaGroupId_idx"
ON "TelegramImport" (
  "chatId" ASC,
  "mediaGroupId" ASC
);
CREATE UNIQUE INDEX "TelegramImport_chatId_messageId_key"
ON "TelegramImport" (
  "chatId" ASC,
  "messageId" ASC
);

-- ----------------------------
-- Indexes structure for table TgIndexedMessage
-- ----------------------------
CREATE UNIQUE INDEX "TgIndexedMessage_chatId_messageId_key"
ON "TgIndexedMessage" (
  "chatId" ASC,
  "messageId" ASC
);
CREATE INDEX "TgIndexedMessage_messageDate_idx"
ON "TgIndexedMessage" (
  "messageDate" ASC
);

PRAGMA foreign_keys = true;
