import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import {
  createAdminPromotion,
  deleteAdminPromotion,
  fetchAdminPromotions,
  uploadAdminImageMultipart,
  updateAdminPromotion,
  type PromotionRow,
} from '../api/admin';

type FormState = {
  id: string;
  title: string;
  imageUrl: string;
  description: string;
  status: 'ON' | 'OFF';
  sortOrder: string;
  relatedProductId: string;
};

const EMPTY_FORM: FormState = {
  id: '',
  title: '',
  imageUrl: '',
  description: '',
  status: 'ON',
  sortOrder: '0',
  relatedProductId: '',
};

export default function PromotionsPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<PromotionRow[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr('');
    try {
      setRows(await fetchAdminPromotions(token));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const title = form.title.trim();
    const imageUrl = form.imageUrl.trim();
    if (!title || !imageUrl) {
      setErr('活动标题和图片URL是必填项');
      return;
    }
    setSaving(true);
    setErr('');
    const payload = {
      title,
      imageUrl,
      description: form.description.trim(),
      status: (form.status === 'OFF' ? 'OFF' : 'ON') as 'ON' | 'OFF',
      sortOrder: Number(form.sortOrder || 0),
      relatedProductId: form.relatedProductId.trim() ? Number(form.relatedProductId) : null,
    };
    try {
      if (form.id) {
        await updateAdminPromotion(token, Number(form.id), payload);
      } else {
        await createAdminPromotion(token, payload);
      }
      setForm(EMPTY_FORM);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(row: PromotionRow) {
    if (!token) return;
    if (!window.confirm(`确定删除活动「${row.title}」？`)) return;
    try {
      await deleteAdminPromotion(token, row.id);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '删除失败');
    }
  }

  function onEdit(row: PromotionRow) {
    setForm({
      id: String(row.id),
      title: row.title || '',
      imageUrl: row.imageUrl || '',
      description: row.description || '',
      status: row.status === 'OFF' ? 'OFF' : 'ON',
      sortOrder: String(row.sortOrder ?? 0),
      relatedProductId: row.relatedProductId == null ? '' : String(row.relatedProductId),
    });
  }

  async function onPickImage(file?: File | null) {
    if (!token || !file) return;
    setErr('');
    setUploading(true);
    try {
      const uploaded = await uploadAdminImageMultipart(token, file, file.name || 'promotion.jpg', file.type || 'image/jpeg');
      setForm((p) => ({ ...p, imageUrl: uploaded.imageUrl || '' }));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '图片上传失败');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>活动管理</h2>
      {err ? <div className="err-banner">{err}</div> : null}

      <form className="card" onSubmit={onSubmit} style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr', gap: '0.75rem' }}>
          <input placeholder="活动标题" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          <input placeholder="关联商品ID(选填)" value={form.relatedProductId} onChange={(e) => setForm((p) => ({ ...p, relatedProductId: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="btn btn-ghost" style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}>
            {uploading ? '上传中…' : '上传活动图片'}
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              style={{ display: 'none' }}
              onChange={(e) => onPickImage(e.target.files?.[0] || null)}
            />
          </label>
          <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            {form.imageUrl ? '图片已上传' : '请先上传活动图片'}
          </span>
        </div>
        {form.imageUrl ? (
          <img
            src={form.imageUrl}
            alt=""
            style={{ width: 220, height: 132, borderRadius: 8, objectFit: 'contain', background: '#f5f6f8', border: '1px solid #eee' }}
          />
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.6fr 0.6fr auto', gap: '0.75rem' }}>
          <input placeholder="活动说明" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value === 'OFF' ? 'OFF' : 'ON' }))}>
            <option value="ON">ON</option>
            <option value="OFF">OFF</option>
          </select>
          <input placeholder="排序值" value={form.sortOrder} onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))} />
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? '保存中…' : form.id ? '更新活动' : '新增活动'}
          </button>
        </div>
      </form>

      <div className="card table-wrap">
        {loading ? (
          <p style={{ margin: 0, color: 'var(--muted)' }}>加载中…</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>标题</th>
                <th>状态</th>
                <th>排序</th>
                <th>关联商品</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.title}</td>
                  <td>{r.status}</td>
                  <td>{r.sortOrder}</td>
                  <td>{r.relatedProductId ?? '-'}</td>
                  <td>
                    <button className="btn btn-ghost" type="button" onClick={() => onEdit(r)}>
                      编辑
                    </button>
                    <button className="btn btn-danger" type="button" style={{ marginLeft: 8 }} onClick={() => onDelete(r)}>
                      删除
                    </button>
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

