import type { Comment, SocialUser } from "@/lib/generated/prisma";

export type CommentWithAuthor = Comment & { author: SocialUser };

export type CommentTreeNode = CommentWithAuthor & { children: CommentTreeNode[] };

export function buildCommentTree(rows: CommentWithAuthor[]): CommentTreeNode[] {
  const map = new Map<string, CommentTreeNode>();
  for (const row of rows) {
    map.set(row.id, { ...row, children: [] });
  }

  const roots: CommentTreeNode[] = [];
  for (const row of rows) {
    const node = map.get(row.id)!;
    if (!row.parentId) {
      roots.push(node);
      continue;
    }

    const parent = map.get(row.parentId);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
}

export function sanitizeCommentBody(raw: string, maxLen = 2000) {
  const text = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  if (!text) return "";
  return text.replace(/</g, "＜").replace(/>/g, "＞").slice(0, maxLen);
}

export function commentRowToNode(row: CommentWithAuthor): CommentTreeNode {
  return { ...row, children: [] };
}

/**
 * 抖音式评论区：同一楼主下仅两级视觉缩进。
 * 根评论一层；其下所有回复（含「回复的回复」）同级展示，更深层级通过 @被回复者 区分。
 * 顺序：对根下的子树做前序 DFS。
 */
export function flattenDouyinThread(root: CommentTreeNode): Array<{ node: CommentTreeNode; atNickname?: string }> {
  const out: Array<{ node: CommentTreeNode; atNickname?: string }> = [];
  function walk(n: CommentTreeNode, at?: string) {
    out.push({ node: n, atNickname: at });
    for (const ch of n.children) {
      walk(ch, n.author.nickname);
    }
  }
  for (const c of root.children) {
    walk(c, undefined);
  }
  return out;
}

function insertUnderParent(node: CommentTreeNode, parentId: string, insert: CommentTreeNode): CommentTreeNode {
  if (node.id === parentId) {
    return { ...node, children: [...node.children, insert] };
  }

  return {
    ...node,
    children: node.children.map((child) => insertUnderParent(child, parentId, insert))
  };
}

/** 将新评论插入树：顶层追加，回复挂到对应 parent 下 */
export function insertCommentIntoTree(tree: CommentTreeNode[], newRow: CommentWithAuthor): CommentTreeNode[] {
  const insert = commentRowToNode(newRow);
  if (!newRow.parentId) {
    return [...tree, insert];
  }

  return tree.map((root) => insertUnderParent(root, newRow.parentId!, insert));
}

/** 用服务端评论 id 集合判断是否需要同步本地树，避免刷新时覆盖乐观更新 */
export function commentTreeSignature(tree: CommentTreeNode[]): string {
  const ids: string[] = [];
  const walk = (nodes: CommentTreeNode[]) => {
    for (const node of nodes) {
      ids.push(node.id);
      walk(node.children);
    }
  };

  walk(tree);
  return ids.sort().join(",");
}
