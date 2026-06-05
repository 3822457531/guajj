"use client";

import { submitCommentAction } from "@/app/post/[id]/actions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { flattenDouyinThread, type CommentTreeNode } from "@/lib/comments-tree";
import { SUYANW_LOGIN_TYPES } from "@/lib/suyanw-oauth";

const LOGIN_LABEL: Record<string, string> = {
  anonymous: "匿名",
  qq: "QQ",
  wx: "微信",
  alipay: "支付宝",
  sina: "微博",
  baidu: "百度",
  douyin: "抖音",
  huawei: "华为",
  // google: "谷歌",
  // microsoft: "微软",
  // twitter: "Twitter",
  // dingtalk: "钉钉",
  // gitee: "Gitee",
  // github: "GitHub"
};

export type PostCommentsUser = {
  id: string;
  nickname: string;
  faceimg: string;
  loginType: string;
};

export type CommentFlash =
  | { kind: "ok" }
  | {
      kind: "error";
      message: string;
    };

type SocialMeResponse = {
  user: PostCommentsUser | null;
};

function formatTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function CommentSubmitButton({ idleLabel }: { idleLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending}>
      {pending ? "发送中…" : idleLabel}
    </button>
  );
}

/** 单条评论卡片（根评论或楼主下的扁平回复，可选 @ 前缀） */
function CommentSingleCard({
  node,
  atNickname,
  onReply,
  showReplyButton
}: {
  node: CommentTreeNode;
  atNickname?: string;
  onReply: (id: string, nickname: string) => void;
  showReplyButton: boolean;
}) {
  return (
    <div className="comment-card">
      <div className="comment-avatar">
        {node.author.faceimg ? (
          <img src={node.author.faceimg} alt="" width={40} height={40} />
        ) : (
          <span className="comment-avatar-fallback">{node.author.nickname.slice(0, 1)}</span>
        )}
      </div>
      <div className="comment-main">
        <div className="comment-meta">
          <span className="comment-name">{node.author.nickname}</span>
          <span className="comment-type">{LOGIN_LABEL[node.author.loginType] || node.author.loginType}</span>
          <span className="comment-time">{formatTime(node.createdAt)}</span>
        </div>
        <p className="comment-body">
          {atNickname ? (
            <>
              <span className="comment-at">@{atNickname}</span>{" "}
            </>
          ) : null}
          {node.body}
        </p>
        {showReplyButton ? (
          <button type="button" className="comment-reply-btn" onClick={() => onReply(node.id, node.author.nickname)}>
            回复
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** 抖音式：每个楼主一层缩进，楼下回复单层列表 + @ */
function CommentThreadDouyin({
  root,
  onReply,
  showReplyButton
}: {
  root: CommentTreeNode;
  onReply: (id: string, nickname: string) => void;
  showReplyButton: boolean;
}) {
  const flat = flattenDouyinThread(root);
  return (
    <div className="comment-thread-root">
      <CommentSingleCard node={root} onReply={onReply} showReplyButton={showReplyButton} />
      {flat.length > 0 ? (
        <div className="comment-thread-replies">
          {flat.map(({ node, atNickname }) => (
            <CommentSingleCard key={node.id} node={node} atNickname={atNickname} onReply={onReply} showReplyButton={showReplyButton} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function PostComments({
  postId,
  initialTree,
  currentUser,
  commentFlash,
  allowAnonymousComments,
  variant = "default"
}: {
  postId: string;
  initialTree: CommentTreeNode[];
  currentUser: PostCommentsUser | null;
  commentFlash: CommentFlash | null;
  allowAnonymousComments: boolean;
  variant?: "default" | "h5";
}) {
  const router = useRouter();
  const composeRef = useRef<HTMLDivElement>(null);
  const [activeUser, setActiveUser] = useState<PostCommentsUser | null>(currentUser);
  const [replyTarget, setReplyTarget] = useState<{ id: string; nickname: string } | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [successToastVisible, setSuccessToastVisible] = useState(false);

  const returnPath = useMemo(() => `/post/${postId}`, [postId]);
  const canComment = Boolean(activeUser) || allowAnonymousComments;
  const submitIdleLabel = replyTarget
    ? "发送回复"
    : activeUser
      ? "发表评论"
      : allowAnonymousComments
        ? "匿名发表评论"
        : "发表评论";

  useEffect(() => {
    setActiveUser(currentUser);
  }, [currentUser]);

  useEffect(() => {
    let ignore = false;
    void (async () => {
      try {
        const response = await fetch("/api/auth/social/me", {
          credentials: "same-origin",
          cache: "no-store"
        });
        const payload = (await response.json().catch(() => null)) as SocialMeResponse | null;
        if (!ignore && payload) setActiveUser(payload.user);
      } catch {
        /* 保持 RSC 下发的 currentUser */
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  /** 点回复后滚到底部表单，并把 parentId 写进隐藏域（见下方 key 与 defaultValue） */
  useEffect(() => {
    if (!replyTarget) return;
    composeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [replyTarget]);

  /** 评论发表成功：弹层约 2 秒后去掉 URL 参数并刷新，不在表单上方常驻文案 */
  useEffect(() => {
    if (commentFlash?.kind !== "ok") return;
    setSuccessToastVisible(true);
    const t = window.setTimeout(() => {
      setSuccessToastVisible(false);
      router.replace(`/post/${postId}`, { scroll: false });
      router.refresh();
    }, 2000);
    return () => {
      window.clearTimeout(t);
      setSuccessToastVisible(false);
    };
  }, [commentFlash, postId, router]);

  const loginUrl = useCallback(
    (type: string) => `/api/auth/social/start?type=${encodeURIComponent(type)}&return=${encodeURIComponent(returnPath)}`,
    [returnPath]
  );

  const onReply = useCallback((id: string, nickname: string) => {
    setReplyTarget({ id, nickname });
  }, []);

  const cancelReply = useCallback(() => {
    setReplyTarget(null);
  }, []);

  const logout = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      setReplyTarget(null);
      await fetch(`/api/auth/social/logout?next=${encodeURIComponent(returnPath)}`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store"
      });
      setActiveUser(null);
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }, [loggingOut, returnPath, router]);

  const parentHiddenKey = replyTarget?.id ?? "__root__";
  const parentHiddenValue = replyTarget?.id ?? "";

  return (
    <section id="comments" className={`comment-section${variant === "h5" ? " h5-comment-section" : ""}`}>
      <div className="section-title comment-section-title">
        <h2>评论区</h2>
        <span className="chip">
          {allowAnonymousComments ? "匿名可评 " : "仅登录可评"}
        </span>
      </div>

      {activeUser ? (
        <div className="comment-user-bar">
          <div className="comment-user-info">
            {activeUser.faceimg ? (
              <img src={activeUser.faceimg} alt="" width={36} height={36} className="comment-user-avatar" />
            ) : null}
            <span>
              已登录：<strong>{activeUser.nickname}</strong>（{LOGIN_LABEL[activeUser.loginType] || activeUser.loginType}）
            </span>
          </div>
          <button type="button" className="btn ghost comment-logout" disabled={loggingOut} onClick={logout}>
            {loggingOut ? "退出中…" : "退出登录"}
          </button>
        </div>
      ) : (
        <div className="comment-login-panel">
          <p className="comment-login-tip">
            {allowAnonymousComments
              ? "未登录将以「匿名」发表评论。可选聚合登录以显示第三方昵称与头像"
              : "本站已关闭匿名评论，仅登录用户可发表评论。请选择一种方式登录"}
          </p>
          <div className="comment-login-grid">
            {SUYANW_LOGIN_TYPES.map((type) => (
              <a key={type} className="comment-login-chip" href={loginUrl(type)}>
                {LOGIN_LABEL[type] || type}
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="comment-list">
        {initialTree.length === 0 ? (
          <p className="comment-empty">还没有评论，快来抢沙发～</p>
        ) : (
          initialTree.map((node) => (
            <CommentThreadDouyin key={node.id} root={node} onReply={onReply} showReplyButton={canComment} />
          ))
        )}
      </div>

      <div ref={composeRef}>
        {commentFlash?.kind === "error" ? (
          <p className="comment-error" style={{ marginBottom: 8 }}>
            {commentFlash.message}
            <Link href={`/post/${postId}`} style={{ marginLeft: 10, fontWeight: 700 }}>
              关闭提示
            </Link>
          </p>
        ) : null}

        {canComment ? (
        <form
          className="comment-compose comment-compose-footer"
          action={submitCommentAction.bind(null, replyTarget?.id ?? "")}
        >
          <input type="hidden" name="postId" value={postId} />
          {/* 受控隐藏域：与 bind 双保险，避免仅 defaultValue 时提交丢失 parentId */}
          <input type="hidden" name="parentId" value={parentHiddenValue} readOnly aria-hidden />

          {replyTarget ? (
            <div className="comment-reply-banner">
              <div>
                正在回复 <strong>@{replyTarget.nickname}</strong>
                <span style={{ color: "var(--muted)", marginLeft: 6 }}>（提交时会带上父评论 ID）</span>
              </div>
              <div className="comment-reply-banner-row">
                <div className="comment-reply-id-wrap">
                  <label className="comment-reply-id-label" htmlFor="comment-parent-display">
                    父评论 ID（与下方隐藏字段 parentId 一致）
                  </label>
                  <input
                    id="comment-parent-display"
                    key={replyTarget.id}
                    type="text"
                    readOnly
                    tabIndex={0}
                    className="comment-reply-id-readonly"
                    defaultValue={replyTarget.id}
                    aria-readonly
                  />
                </div>
                <button type="button" className="btn ghost" onClick={cancelReply}>
                  取消回复
                </button>
              </div>
            </div>
          ) : (
            <p className="comment-compose-lead">发表新评论</p>
          )}

          <textarea
            id="post-comment-body"
            className={`comment-textarea${replyTarget ? " comment-textarea--reply" : ""}`}
            name="body"
            key={parentHiddenKey}
            rows={4}
            maxLength={2000}
            required
            minLength={1}
            placeholder={
              replyTarget
                ? allowAnonymousComments && !activeUser
                  ? `回复 @${replyTarget.nickname}…（未登录将以「匿名」发布）`
                  : `回复 @${replyTarget.nickname}…`
                : allowAnonymousComments && !activeUser
                  ? "说点什么…（未登录将以「匿名」发布）"
                  : "说点什么…"
            }
            defaultValue=""
          />
          <CommentSubmitButton idleLabel={submitIdleLabel} />
        </form>
        ) : (
          <p className="comment-compose-locked" style={{ color: "var(--muted)", marginTop: 16, fontSize: 14 }}>
            当前仅允许登录用户评论，请先选择上方一种方式登录。
          </p>
        )}
      </div>
    </section>
  );
}
