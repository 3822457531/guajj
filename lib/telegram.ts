import crypto from "crypto";
import path from "path";
import { MediaType, PostStatus, PostType, type TelegramConfig } from "@/lib/generated/prisma";
import { saveMediaBytes } from "@/lib/media-storage";
import { prisma } from "@/lib/prisma";
import { parseGalleryExtras, parseGalleryVideos } from "@/lib/post-gallery";
import { isRepostAttributionOnlyLine, stripRepostAttributionFromText } from "@/lib/strip-repost-attribution";

type TelegramPhotoSize = { file_id: string; file_unique_id?: string; width: number; height: number; file_size?: number };
type TelegramMedia = { file_id: string; file_name?: string; mime_type?: string; file_size?: number };

type ForwardOrigin = {
  type?: string;
  chat?: { title?: string; username?: string };
  sender_user?: { first_name?: string; username?: string };
};

type TelegramMessage = {
  message_id: number;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  video?: TelegramMedia;
  animation?: TelegramMedia;
  document?: TelegramMedia;
  chat?: { id: number | string; title?: string; username?: string; type?: string };
  media_group_id?: number;
  forward_origin?: ForwardOrigin;
  forward_from_chat?: { title?: string; username?: string };
  forward_from?: { first_name?: string; username?: string };
  is_automatic_forward?: boolean;
};

export type TelegramUpdate = {
  update_id?: number;
  channel_post?: TelegramMessage;
  message?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
};

const PLACEHOLDER_COVERS = new Set(["/assets/cover-spotlight.svg", "/assets/cover-live.svg"]);

function safeExt(filePath?: string, mime?: string) {
  const ext = filePath ? path.extname(filePath).toLowerCase() : "";
  if (ext) return ext;
  if (mime?.includes("png")) return ".png";
  if (mime?.includes("webp")) return ".webp";
  if (mime?.includes("gif")) return ".gif";
  if (mime?.includes("heic") || mime?.includes("heif")) return ".heic";
  if (mime?.includes("avif")) return ".avif";
  if (mime?.includes("video")) return ".mp4";
  return ".jpg";
}

function mimeFromImageFileName(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".heic") || n.endsWith(".heif")) return "image/heic";
  if (n.endsWith(".avif")) return "image/avif";
  return "image/jpeg";
}

function pickMessage(update: TelegramUpdate) {
  return update.channel_post || update.message || update.edited_channel_post || null;
}

function textFromMessage(message: TelegramMessage) {
  return (message.caption || message.text || "").trim();
}

/** 频道里转发＝你方已人工把关：用于自动发布判断 */
export function isForwardedTelegramMessage(message: TelegramMessage): boolean {
  return Boolean(
    message.forward_origin ||
      message.forward_from_chat ||
      message.forward_from ||
      message.is_automatic_forward
  );
}

function forwardPrefix(message: TelegramMessage): string {
  const fo = message.forward_origin;
  if (fo?.type === "channel" && fo.chat) {
    const c = fo.chat;
    return `【转自 ${c.title || (c.username ? `@${c.username}` : "频道")}】\n`;
  }
  if (fo?.type === "chat" && fo.chat) {
    return `【转自 ${fo.chat.title || "群聊"}】\n`;
  }
  if (fo?.type === "user" && fo.sender_user) {
    const u = fo.sender_user;
    return `【转自 ${u.first_name || (u.username ? `@${u.username}` : "用户")}】\n`;
  }
  if (message.forward_from_chat) {
    const c = message.forward_from_chat;
    return `【转自 ${c.title || c.username || "频道"}】\n`;
  }
  if (message.forward_from) {
    const u = message.forward_from;
    return `【转自 ${u.first_name || (u.username ? `@${u.username}` : "用户")}】\n`;
  }
  return "";
}

export function buildTelegramRawText(message: TelegramMessage): string {
  return (forwardPrefix(message) + textFromMessage(message)).trim();
}

function resolveImportStatus(config: TelegramConfig, message: TelegramMessage): PostStatus {
  if (config.autoPublish) return PostStatus.PUBLISHED;
  if (isForwardedTelegramMessage(message)) return PostStatus.PUBLISHED;
  return config.defaultStatus;
}

export function parseTelegramContent(text: string) {
  const cleaned = stripRepostAttributionFromText(text.trim());
  const lines = cleaned.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const substantive = lines.filter((line) => !isRepostAttributionOnlyLine(line));

  const defaultTitle = "佳佳吃瓜新吃瓜";
  const defaultSummary = "频道自动采集内容，进入后台可继续编辑标题、热度和正文。";

  if (substantive.length === 0) {
    return { title: defaultTitle, summary: defaultSummary, body: defaultSummary };
  }

  const firstLine = substantive[0];
  const title = (firstLine || defaultTitle).slice(0, 80);
  const summary = (
    substantive[1] ??
    (firstLine ? firstLine.slice(0, 140) : null) ??
    defaultSummary
  ).slice(0, 140);

  return {
    title,
    summary,
    body: substantive.join("\n")
  };
}

type PickedMedia = { kind: MediaType; fileId: string; mime?: string; size?: number };

function pickMedia(message: TelegramMessage): PickedMedia | null {
  if (message.video) return { kind: MediaType.VIDEO, fileId: message.video.file_id, mime: message.video.mime_type, size: message.video.file_size };
  if (message.animation) return { kind: MediaType.VIDEO, fileId: message.animation.file_id, mime: message.animation.mime_type, size: message.animation.file_size };
  const doc = message.document;
  if (doc?.file_id) {
    const name = doc.file_name || "";
    if (doc.mime_type?.startsWith("video/")) {
      return { kind: MediaType.VIDEO, fileId: doc.file_id, mime: doc.mime_type, size: doc.file_size };
    }
    if (doc.mime_type?.startsWith("image/")) {
      return {
        kind: MediaType.IMAGE,
        fileId: doc.file_id,
        mime: doc.mime_type || "image/jpeg",
        size: doc.file_size
      };
    }
    // 频道里「以文件发送」常见无 mime 或 application/octet-stream，仅靠扩展名识别
    if (/\.(jpe?g|png|gif|webp|bmp|heic|heif|avif)$/i.test(name)) {
      const mime =
        doc.mime_type && doc.mime_type.startsWith("image/") ? doc.mime_type : mimeFromImageFileName(name);
      return { kind: MediaType.IMAGE, fileId: doc.file_id, mime, size: doc.file_size };
    }
  }
  if (message.photo?.length) {
    const photo = [...message.photo].sort((a, b) => (b.file_size || b.width * b.height) - (a.file_size || a.width * a.height))[0];
    return { kind: MediaType.IMAGE, fileId: photo.file_id, mime: "image/jpeg", size: photo.file_size };
  }
  return null;
}

async function telegramApi<T>(token: string, method: string, body?: unknown) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) throw new Error(json.description || `Telegram ${method} failed`);
  return json.result as T;
}

async function downloadTelegramPickedMedia(config: TelegramConfig, picked: PickedMedia) {
  const fileInfo = await telegramApi<{ file_path: string; file_size?: number }>(config.botToken, "getFile", { file_id: picked.fileId });
  const fileRes = await fetch(`https://api.telegram.org/file/bot${config.botToken}/${fileInfo.file_path}`);
  if (!fileRes.ok) throw new Error("Telegram file download failed");

  const ext = safeExt(fileInfo.file_path, picked.mime);
  const filename = `tg-${Date.now()}-${crypto.randomUUID()}${ext}`;
  const buffer = Buffer.from(await fileRes.arrayBuffer());
  const contentType =
    picked.mime ||
    (picked.kind === MediaType.VIDEO ? "video/mp4" : picked.kind === MediaType.IMAGE ? "image/jpeg" : "application/octet-stream");

  const { url } = await saveMediaBytes({
    buffer,
    subPath: `telegram/${filename}`,
    contentType
  });

  await prisma.mediaAsset.create({
    data: {
      filename,
      url,
      type: picked.kind,
      size: fileInfo.file_size || picked.size || buffer.length
    }
  });

  return { mediaUrl: url, mediaType: picked.kind };
}

/** 仅在 downloadMedia 开启且能识别到媒体时尝试下载；失败不抛错，避免整条 Webhook 丢失 */
async function tryDownloadTelegramMedia(config: TelegramConfig, message: TelegramMessage) {
  const picked = pickMedia(message);
  if (!picked || !config.downloadMedia) {
    return { mediaUrl: null as string | null, mediaType: null as MediaType | null, picked };
  }
  try {
    const { mediaUrl, mediaType } = await downloadTelegramPickedMedia(config, picked);
    return { mediaUrl, mediaType, picked };
  } catch (err) {
    console.error("[telegram] media download failed", err);
    return { mediaUrl: null, mediaType: null, picked };
  }
}

export async function processTelegramUpdate(config: TelegramConfig, update: TelegramUpdate) {
  const message = pickMessage(update);
  if (!message?.message_id || !message.chat?.id) return { skipped: "no-message" };

  const chatId = String(message.chat.id);
  if (config.channelId && chatId !== config.channelId && message.chat.username !== config.channelId.replace(/^@/, "")) {
    return { skipped: "wrong-channel" };
  }

  const rawText = buildTelegramRawText(message);
  const existing = await prisma.telegramImport.findUnique({
    where: { chatId_messageId: { chatId, messageId: message.message_id } }
  });
  if (existing) return { skipped: "duplicate", postId: existing.postId };

  const mediaGroupId = message.media_group_id != null ? String(message.media_group_id) : null;

  if (mediaGroupId) {
    const leader = await prisma.telegramImport.findFirst({
      where: { chatId, mediaGroupId, postId: { not: null } },
      orderBy: { createdAt: "asc" }
    });

    if (leader?.postId) {
      const post = await prisma.post.findUnique({ where: { id: leader.postId } });
      if (!post) return { skipped: "post-missing" };

      const { mediaUrl, mediaType, picked } = await tryDownloadTelegramMedia(config, message);
      const imgExtras = parseGalleryExtras(post.galleryImageUrls);
      const nextImgExtras = mediaUrl && mediaType === MediaType.IMAGE ? [...imgExtras, mediaUrl] : imgExtras;

      let nextVideoUrl = post.videoUrl;
      let nextGalleryVideoUrls = post.galleryVideoUrls;
      const vidExtras = parseGalleryVideos(post.galleryVideoUrls);

      if (mediaUrl && mediaType === MediaType.VIDEO) {
        const main = post.videoUrl?.trim();
        if (!main) {
          nextVideoUrl = mediaUrl;
        } else if (mediaUrl !== main && !vidExtras.includes(mediaUrl)) {
          nextGalleryVideoUrls = JSON.stringify([...vidExtras, mediaUrl]);
        }
      }

      const parsed = parseTelegramContent(rawText);
      const richerCaption = rawText.length > post.body.length;
      const nextStatus = resolveImportStatus(config, message);

      const finalVidExtras = parseGalleryVideos(nextGalleryVideoUrls);
      const hasAnyVideo = Boolean((nextVideoUrl ?? "").trim() || finalVidExtras.length > 0);
      const hasAnyImage =
        nextImgExtras.length > 0 || (Boolean(post.coverUrl) && !PLACEHOLDER_COVERS.has(post.coverUrl));

      let mergedType = post.type;
      if (hasAnyImage && hasAnyVideo) mergedType = PostType.GALLERY;
      else if (hasAnyVideo && !hasAnyImage) mergedType = PostType.VIDEO;
      else if (hasAnyImage && !hasAnyVideo) mergedType = PostType.GALLERY;

      await prisma.post.update({
        where: { id: post.id },
        data: {
          type: mergedType,
          videoUrl: nextVideoUrl,
          galleryVideoUrls: nextGalleryVideoUrls,
          galleryImageUrls:
            mediaUrl && mediaType === MediaType.IMAGE ? JSON.stringify(nextImgExtras) : post.galleryImageUrls,
          ...(mediaUrl && mediaType === MediaType.IMAGE && PLACEHOLDER_COVERS.has(post.coverUrl) ? { coverUrl: mediaUrl } : {}),
          ...(richerCaption ? { title: parsed.title, summary: parsed.summary, body: parsed.body } : {}),
          ...(nextStatus === PostStatus.PUBLISHED && post.status !== PostStatus.PUBLISHED
            ? { status: PostStatus.PUBLISHED, publishedAt: new Date() }
            : {})
        }
      });

      await prisma.telegramImport.create({
        data: {
          updateId: update.update_id,
          messageId: message.message_id,
          chatId,
          chatTitle: message.chat.title || message.chat.username || null,
          rawText,
          mediaType: (mediaType ?? picked?.kind) || null,
          mediaUrl,
          postId: post.id,
          mediaGroupId
        }
      });

      if (update.update_id) {
        await prisma.telegramConfig.update({ where: { id: config.id }, data: { lastUpdateId: update.update_id } });
      }
      const mergeWarn =
        picked && !mediaUrl ? (!config.downloadMedia ? "download-disabled" : "media-download-failed") : undefined;
      return { merged: true, postId: post.id, ...(mergeWarn ? { warn: mergeWarn } : {}) };
    }
  }

  const { mediaUrl, mediaType, picked } = await tryDownloadTelegramMedia(config, message);
  const parsed = parseTelegramContent(rawText);
  const postType =
    mediaUrl && mediaType === MediaType.VIDEO
      ? PostType.VIDEO
      : mediaUrl && mediaType === MediaType.IMAGE
        ? PostType.GALLERY
        : PostType.ARTICLE;
  const status = resolveImportStatus(config, message);

  const coverUrl =
    mediaUrl && mediaType === MediaType.IMAGE ? mediaUrl : "/assets/cover-live.svg";
  const videoUrl = mediaUrl && mediaType === MediaType.VIDEO ? mediaUrl : null;

  const post = await prisma.post.create({
    data: {
      title: parsed.title,
      summary: parsed.summary,
      body: parsed.body,
      type: postType,
      status,
      coverUrl,
      videoUrl,
      galleryImageUrls: null,
      galleryVideoUrls: null,
      isPinned: false,
      views: 300,
      heat: 300,
      publishedAt: status === PostStatus.PUBLISHED ? new Date() : null,
      categoryId: config.defaultCategoryId
    }
  });

  await prisma.telegramImport.create({
    data: {
      updateId: update.update_id,
      messageId: message.message_id,
      chatId,
      chatTitle: message.chat.title || message.chat.username || null,
      rawText,
      mediaType: (mediaType ?? picked?.kind) || null,
      mediaUrl,
      postId: post.id,
      mediaGroupId
    }
  });

  if (update.update_id) {
    await prisma.telegramConfig.update({ where: { id: config.id }, data: { lastUpdateId: update.update_id } });
  }

  const createWarn =
    picked && !mediaUrl ? (!config.downloadMedia ? "download-disabled" : "media-download-failed") : undefined;
  return { created: true, postId: post.id, ...(createWarn ? { warn: createWarn } : {}) };
}

export async function setTelegramWebhook(config: TelegramConfig, publicBaseUrl: string) {
  const url = `${publicBaseUrl.replace(/\/$/, "")}/api/tg/webhook/${config.webhookSecret}`;
  return telegramApi(config.botToken, "setWebhook", {
    url,
    allowed_updates: ["message", "channel_post", "edited_channel_post"]
  });
}

export async function pullTelegramUpdates(config: TelegramConfig) {
  const updates = await telegramApi<TelegramUpdate[]>(config.botToken, "getUpdates", {
    offset: config.lastUpdateId ? config.lastUpdateId + 1 : undefined,
    timeout: 0,
    allowed_updates: ["message", "channel_post", "edited_channel_post"]
  });

  const results = [];
  for (const update of updates) {
    results.push(await processTelegramUpdate(config, update));
  }
  return results;
}
