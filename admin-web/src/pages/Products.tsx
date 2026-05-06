import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { fetchProducts, updateProductStock, type ProductRow } from '../api/admin';
import { resolveUploadUrl } from '../api/client';

export default function ProductsPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr('');
    setLoading(true);
    try {
      const data = await fetchProducts(token);
      setRows(data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveStock(id: number) {
    if (!token) return;
    const raw = draft[id];
    const stock = raw !== undefined ? Number(raw) : NaN;
    if (!Number.isFinite(stock) || stock < 0) {
      setErr('库存须为非负整数');
      return;
    }
    setSavingId(id);
    setErr('');
    try {
      const updated = await updateProductStock(token, id, Math.floor(stock));
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setDraft((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>商品与库存</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Link to="/products/new" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            新建商品
          </Link>
          <button type="button" className="btn btn-ghost" onClick={() => load()} disabled={loading}>
            刷新
          </button>
        </div>
      </div>
      {err ? <div className="err-banner">{err}</div> : null}
      <div className="card table-wrap">
        {loading ? (
          <p style={{ color: 'var(--muted)', margin: 0 }}>加载中…</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 72 }}>图</th>
                <th>名称</th>
                <th>分类</th>
                <th>售价</th>
                <th style={{ width: 140 }}>库存</th>
                <th>状态</th>
                <th style={{ width: 160 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.image ? (
                      <img
                        alt=""
                        src={resolveUploadUrl(r.image)}
                        style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8 }}
                      />
                    ) : (
                      <span className="badge">无图</span>
                    )}
                  </td>
                  <td>{r.title}</td>
                  <td>{r.category || '—'}</td>
                  <td>¥{(r.price / 100).toFixed(2)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        style={{ width: 88 }}
                        value={draft[r.id] ?? String(r.stock)}
                        onChange={(e) => setDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                        disabled={
                          savingId === r.id ||
                          Number(draft[r.id] ?? r.stock) === r.stock
                        }
                        onClick={() => saveStock(r.id)}
                      >
                        保存
                      </button>
                    </div>
                  </td>
                  <td>
                    <span className="badge">{r.status === 'ON' ? '上架' : '下架'}</span>
                  </td>
                  <td>
                    <Link to={`/products/${r.id}`} style={{ fontSize: '0.875rem' }}>
                      编辑详情 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
