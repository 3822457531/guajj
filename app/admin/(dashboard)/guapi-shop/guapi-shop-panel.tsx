"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  deleteGuapiPackageAction,
  saveWechatChannelAction,
  toggleGuapiPackageAction,
  upsertGuapiPackageAction
} from "./actions";

const PAY_CHANNEL_WECHAT = 33;
const PAY_CHANNEL_WECHAT_RECOMMENDED = 34;

type PackageRow = {
  id: string;
  title: string;
  goodsKey: string;
  guapiAmount: number;
  priceYuan: number;
  sortOrder: number;
  enabled: boolean;
};

export function GuapiShopPanel({
  packages,
  wechatChannelId
}: {
  packages: PackageRow[];
  wechatChannelId: number;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const editing = packages.find((p) => p.id === editingId) || null;

  function onSaveChannel(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveWechatChannelAction(fd);
      setMsg(res.message || "");
    });
  }

  function onSavePackage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (editingId) fd.set("id", editingId);
    startTransition(async () => {
      const res = await upsertGuapiPackageAction(fd);
      setMsg(res.message || "");
      if (res.ok) {
        setEditingId(null);
        form.reset();
      }
    });
  }

  return (
    <div className="sms-admin-grid">
      <section className="admin-panel" style={{ padding: 20 }}>
        <h2 style={{ margin: "0 0 12px" }}>支付渠道</h2>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 12px" }}>
          支付宝固定 channel_id=32；微信可选 33 或 34（推荐）。
        </p>
        <form onSubmit={onSaveChannel} className="form-grid">
          <label>
            默认微信渠道
            <select name="wechatChannelId" className="form-input" defaultValue={wechatChannelId}>
              <option value={PAY_CHANNEL_WECHAT_RECOMMENDED}>34 · 微信通道推荐</option>
              <option value={PAY_CHANNEL_WECHAT}>33 · 微信通道</option>
            </select>
          </label>
          <button type="submit" className="btn primary" disabled={pending}>
            保存
          </button>
        </form>
      </section>

      <section className="admin-panel" style={{ padding: 20 }}>
        <h2 style={{ margin: "0 0 12px" }}>{editing ? "编辑套餐" : "新建套餐"}</h2>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 12px" }}>
          goods_key 须与第三方店铺商品一致；瓜皮数量为本站发货额度。
        </p>
        <form onSubmit={onSavePackage} className="form-grid" key={editingId || "new"}>
          <label>
            标题
            <input
              name="title"
              className="form-input"
              required
              defaultValue={editing?.title || ""}
              placeholder="例如：10 瓜皮"
            />
          </label>
          <label>
            goods_key
            <input
              name="goodsKey"
              className="form-input"
              required
              defaultValue={editing?.goodsKey || ""}
              placeholder="slof0m"
            />
          </label>
          <label>
            瓜皮数量
            <input
              type="number"
              name="guapiAmount"
              className="form-input"
              min={1}
              step={1}
              required
              defaultValue={editing?.guapiAmount ?? 10}
            />
          </label>
          <label>
            标价（元）
            <input
              type="number"
              name="priceYuan"
              className="form-input"
              min={0}
              step={0.01}
              required
              defaultValue={editing?.priceYuan ?? 1}
            />
          </label>
          <label>
            排序（小在前）
            <input
              type="number"
              name="sortOrder"
              className="form-input"
              step={1}
              defaultValue={editing?.sortOrder ?? 0}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" name="enabled" value="1" defaultChecked={editing?.enabled ?? true} />
            上架出售
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="submit" className="btn primary" disabled={pending}>
              {editing ? "保存修改" : "创建套餐"}
            </button>
            {editing ? (
              <button
                type="button"
                className="btn secondary"
                disabled={pending}
                onClick={() => setEditingId(null)}
              >
                取消编辑
              </button>
            ) : null}
          </div>
        </form>
        {msg ? <p className="admin-flash success">{msg}</p> : null}
      </section>

      <section className="admin-panel" style={{ padding: 0, overflow: "hidden", gridColumn: "1 / -1" }}>
        <h2 style={{ padding: "16px 20px 0", margin: 0 }}>套餐列表（{packages.length}）</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>标题</th>
                <th>goods_key</th>
                <th>瓜皮</th>
                <th>标价</th>
                <th>排序</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {packages.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ color: "var(--muted)" }}>
                    暂无套餐，请先创建
                  </td>
                </tr>
              ) : (
                packages.map((pkg) => (
                  <tr key={pkg.id}>
                    <td>{pkg.title}</td>
                    <td>
                      <code>{pkg.goodsKey}</code>
                    </td>
                    <td style={{ fontWeight: 700 }}>{pkg.guapiAmount}</td>
                    <td>¥{pkg.priceYuan}</td>
                    <td>{pkg.sortOrder}</td>
                    <td>{pkg.enabled ? "上架" : "下架"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        className="btn secondary"
                        style={{ marginRight: 6 }}
                        disabled={pending}
                        onClick={() => setEditingId(pkg.id)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="btn secondary"
                        style={{ marginRight: 6 }}
                        disabled={pending}
                        onClick={() => {
                          const fd = new FormData();
                          fd.set("id", pkg.id);
                          fd.set("enabled", pkg.enabled ? "0" : "1");
                          startTransition(async () => {
                            const res = await toggleGuapiPackageAction(fd);
                            setMsg(res.message || "");
                          });
                        }}
                      >
                        {pkg.enabled ? "下架" : "上架"}
                      </button>
                      <button
                        type="button"
                        className="btn secondary"
                        disabled={pending}
                        onClick={() => {
                          if (!confirm("确定删除该套餐？若已有订单将改为下架。")) return;
                          const fd = new FormData();
                          fd.set("id", pkg.id);
                          startTransition(async () => {
                            const res = await deleteGuapiPackageAction(fd);
                            setMsg(res.message || "");
                            if (editingId === pkg.id) setEditingId(null);
                          });
                        }}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
