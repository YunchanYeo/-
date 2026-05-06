import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { createCategory, deleteCategory, fetchCategories, updateCategory, type CategoryRow } from '../api/admin';
import { resolveUploadUrl } from '../api/client';

export default function CategoriesPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setErr('');
    setLoading(true);
    try {
      setRows(await fetchCategories(token));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token || !newName.trim()) return;
    setCreating(true);
    setErr('');
    try {
      await createCategory(token, { name: newName.trim() });
      setNewName('');
      await load();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : '创建失败');
    } finally {
      setCreating(false);
    }
  }

  async function saveRow(r: CategoryRow, patch: { name?: string; sortOrder?: number }) {
    if (!token) return;
    setErr('');
    try {
      await updateCategory(token, r.id, patch);
      await load();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : '更新失败');
    }
  }

  async function remove(id: number) {
    if (!token || !confirm('确定删除该分类？')) return;
    setErr('');
    try {
      await deleteCategory(token, id);
      await load();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : '删除失败');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>商品分类</h2>
        <button type="button" className="btn btn-ghost" onClick={() => load()} disabled={loading}>
          刷新
        </button>
      </div>
      {err ? <div className="err-banner">{err}</div> : null}

      <form className="card" onSubmit={onCreate} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 200px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>新分类名称</span>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="不超过 32 字" maxLength={32} />
        </label>
        <button type="submit" className="btn btn-primary" disabled={creating || !newName.trim()}>
          {creating ? '创建中…' : '添加'}
        </button>
      </form>

      <div className="card table-wrap">
        {loading ? (
          <p style={{ color: 'var(--muted)', margin: 0 }}>加载中…</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 72 }}>缩略图</th>
                <th>名称</th>
                <th style={{ width: 120 }}>排序</th>
                <th style={{ width: 120 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <CategoryEditorRow key={r.id} row={r} onSave={saveRow} onDelete={() => remove(r.id)} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CategoryEditorRow({
  row,
  onSave,
  onDelete,
}: {
  row: CategoryRow;
  onSave: (r: CategoryRow, patch: { name?: string; sortOrder?: number }) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(row.name);
  const [sort, setSort] = useState(String(row.sortOrder));

  useEffect(() => {
    setName(row.name);
    setSort(String(row.sortOrder));
  }, [row.name, row.sortOrder]);

  const dirty = name.trim() !== row.name || Number(sort) !== row.sortOrder;

  return (
    <tr>
      <td>
        {row.thumbnail ? (
          <img alt="" src={resolveUploadUrl(row.thumbnail)} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8 }} />
        ) : (
          <span className="badge">—</span>
        )}
      </td>
      <td>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', maxWidth: 280 }} />
      </td>
      <td>
        <input type="number" step={1} value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: 88 }} />
      </td>
      <td>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '0.35rem 0.55rem', fontSize: '0.8rem' }}
            disabled={!dirty}
            onClick={() => {
              const sortOrder = Math.floor(Number(sort));
              if (!Number.isFinite(sortOrder)) return;
              onSave(row, { name: name.trim(), sortOrder });
            }}
          >
            保存
          </button>
          <button type="button" className="btn btn-danger" style={{ padding: '0.35rem 0.55rem', fontSize: '0.8rem' }} onClick={onDelete}>
            删除
          </button>
        </div>
      </td>
    </tr>
  );
}
