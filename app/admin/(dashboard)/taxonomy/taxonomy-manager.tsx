import type { Category, Tag } from "@/lib/generated/prisma";
import {
  createCategoryAction,
  createTagAction,
  deleteCategoryAction,
  deleteTagAction,
  updateCategoryAction,
  updateTagAction
} from "./actions";

export default function TaxonomyManager({
  categories,
  tags,
  flashError,
  flashSaved
}: {
  categories: Category[];
  tags: Tag[];
  flashError?: string | null;
  flashSaved?: string | null;
}) {
  return (
    <>
      {flashSaved === "category" ? <p className="admin-flash success">分类操作已保存。</p> : null}
      {flashSaved === "tag" ? <p className="admin-flash success">标签操作已保存。</p> : null}
      {flashError === "duplicate" ? (
        <p className="admin-flash" style={{ background: "rgba(239, 68, 68, 0.1)", color: "#b91c1c", border: "1px solid rgba(239, 68, 68, 0.25)" }}>
          名称或英文标识与已有记录冲突，请更换后重试。
        </p>
      ) : null}
      {flashError === "category-in-use" ? (
        <p className="admin-flash" style={{ background: "rgba(239, 68, 68, 0.1)", color: "#b91c1c", border: "1px solid rgba(239, 68, 68, 0.25)" }}>
          该分类下仍有内容，请先修改相关文章的分类后再删除。
        </p>
      ) : null}
      {flashError === "name" ? (
        <p className="admin-flash" style={{ background: "rgba(239, 68, 68, 0.1)", color: "#b91c1c", border: "1px solid rgba(239, 68, 68, 0.25)" }}>
          名称不能为空。
        </p>
      ) : null}

      <div className="two-col">
        <section className="form-card admin-panel" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>分类管理</h2>
          <form className="form-grid" action={createCategoryAction}>
            <div className="field">
              <label>分类名称</label>
              <input name="name" placeholder="例如：商业" required />
            </div>
            <div className="field">
              <label>英文标识（可空，将自动生成）</label>
              <input name="slug" placeholder="business" />
            </div>
            <button className="btn" type="submit">
              新增分类
            </button>
          </form>

          <table className="admin-table" style={{ marginTop: 18 }}>
            <thead>
              <tr>
                <th>名称</th>
                <th>标识</th>
                <th style={{ width: 220 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((item) => (
                <tr key={item.id}>
                  <td colSpan={3} style={{ padding: 12 }}>
                    <div className="toolbar" style={{ flexWrap: "wrap", alignItems: "flex-end", gap: 10 }}>
                      <form action={updateCategoryAction.bind(null, item.id)} className="toolbar" style={{ flex: 1, minWidth: 240, flexWrap: "wrap", gap: 8 }}>
                        <div className="field" style={{ flex: 1, minWidth: 120, margin: 0 }}>
                          <label style={{ fontSize: 12 }}>名称</label>
                          <input name="name" defaultValue={item.name} required />
                        </div>
                        <div className="field" style={{ flex: 1, minWidth: 120, margin: 0 }}>
                          <label style={{ fontSize: 12 }}>标识</label>
                          <input name="slug" defaultValue={item.slug} required />
                        </div>
                        <button className="btn secondary" type="submit">
                          保存
                        </button>
                      </form>
                      <form action={deleteCategoryAction.bind(null, item.id)}>
                        <button className="btn ghost" type="submit">
                          删除
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="form-card admin-panel" style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>标签管理</h2>
          <form className="form-grid" action={createTagAction}>
            <div className="field">
              <label>标签名称</label>
              <input name="name" placeholder="例如：独家" required />
            </div>
            <div className="field">
              <label>英文标识（可空，将自动生成）</label>
              <input name="slug" placeholder="exclusive" />
            </div>
            <button className="btn" type="submit">
              新增标签
            </button>
          </form>

          <table className="admin-table" style={{ marginTop: 18 }}>
            <thead>
              <tr>
                <th>名称</th>
                <th>标识</th>
                <th style={{ width: 220 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {tags.map((item) => (
                <tr key={item.id}>
                  <td colSpan={3} style={{ padding: 12 }}>
                    <div className="toolbar" style={{ flexWrap: "wrap", alignItems: "flex-end", gap: 10 }}>
                      <form action={updateTagAction.bind(null, item.id)} className="toolbar" style={{ flex: 1, minWidth: 240, flexWrap: "wrap", gap: 8 }}>
                        <div className="field" style={{ flex: 1, minWidth: 120, margin: 0 }}>
                          <label style={{ fontSize: 12 }}>名称</label>
                          <input name="name" defaultValue={item.name} required />
                        </div>
                        <div className="field" style={{ flex: 1, minWidth: 120, margin: 0 }}>
                          <label style={{ fontSize: 12 }}>标识</label>
                          <input name="slug" defaultValue={item.slug} required />
                        </div>
                        <button className="btn secondary" type="submit">
                          保存
                        </button>
                      </form>
                      <form action={deleteTagAction.bind(null, item.id)}>
                        <button className="btn ghost" type="submit">
                          删除
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
