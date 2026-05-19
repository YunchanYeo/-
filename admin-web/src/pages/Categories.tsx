import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
  uploadAdminImageMultipart,
  type CategoryRow,
} from '../api/admin';
import { resolveUploadUrl } from '../api/client';

const DEFAULT_CATEGORY_THUMB_BY_NAME: Record<string, string> = {
  零食: 'https://img.icons8.com/color/240/potato-chips.png',
  面: 'https://img.icons8.com/color/240/noodles.png',
  饮料: 'https://img.icons8.com/color/240/water-bottle.png',
  饭: 'https://img.icons8.com/color/240/rice-bowl.png',
  罐头: 'https://img.icons8.com/color/240/tin-can.png',
  糖果: 'https://img.icons8.com/color/240/candy.png',
};
const FALLBACK_CATEGORY_THUMB = 'https://img.icons8.com/color/240/shopping-basket-2.png';

function getDefaultCategoryThumb(name: string) {
  return DEFAULT_CATEGORY_THUMB_BY_NAME[name.trim()] || FALLBACK_CATEGORY_THUMB;
}

function getCategoryIconPreview(name: string, customThumb: string | null | undefined, resolvedThumb?: string | null) {
  const custom = String(customThumb || '').trim();
  if (custom) return resolveUploadUrl(custom);
  const resolved = String(resolvedThumb || '').trim();
  if (resolved) return resolveUploadUrl(resolved);
  return getDefaultCategoryThumb(name);
}

export default function CategoriesPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newThumb, setNewThumb] = useState('');
  const [creating, setCreating] = useState(false);
  const [uploadingNew, setUploadingNew] = useState(false);

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

  async function onUploadNewThumb(file?: File | null) {
    if (!token || !file) return;
    setUploadingNew(true);
    setErr('');
    try {
      const up = await uploadAdminImageMultipart(token, file, file.name || 'category.jpg', file.type || 'image/jpeg');
      setNewThumb(up.imageUrl || '');
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : '图片上传失败');
    } finally {
      setUploadingNew(false);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token || !newName.trim()) return;
    setCreating(true);
    setErr('');
    try {
      await createCategory(token, {
        name: newName.trim(),
        thumbnail: newThumb.trim() || undefined,
      });
      setNewName('');
      setNewThumb('');
      await load();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : '创建失败');
    } finally {
      setCreating(false);
    }
  }

  async function saveRow(
    r: CategoryRow,
    patch: { name?: string; sortOrder?: number; thumbnail?: string | null },
  ) {
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
      <p style={{ margin: '0 0 1rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
        分类图标显示在小程序首页「商品分类」区域；未上传则使用系统默认图标。
      </p>
      {err ? <div className="err-banner">{err}</div> : null}

      <form
        className="card"
        onSubmit={onCreate}
        style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>新分类名称</span>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="不超过 32 字" maxLength={32} />
        </label>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="btn btn-ghost" style={{ cursor: uploadingNew ? 'not-allowed' : 'pointer' }}>
            {uploadingNew ? '上传中…' : '上传分类图标'}
            <input
              type="file"
              accept="image/*"
              disabled={uploadingNew}
              style={{ display: 'none' }}
              onChange={(e) => onUploadNewThumb(e.target.files?.[0] || null)}
            />
          </label>
          <img
            alt=""
            src={newThumb ? resolveUploadUrl(newThumb) : getDefaultCategoryThumb(newName || '分类')}
            style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'contain', background: '#f5f6f8' }}
          />
          <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            {newThumb ? '自定义图标' : '将使用系统默认图标'}
          </span>
          {newThumb ? (
            <button type="button" className="btn btn-ghost" onClick={() => setNewThumb('')}>
              恢复默认图标
            </button>
          ) : null}
        </div>
        <button type="submit" className="btn btn-primary" disabled={creating || !newName.trim()} style={{ justifySelf: 'start' }}>
          {creating ? '创建中…' : '添加分类'}
        </button>
      </form>

      <div className="card table-wrap">
        {loading ? (
          <p style={{ color: 'var(--muted)', margin: 0 }}>加载中…</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 88 }}>图标</th>
                <th>名称</th>
                <th style={{ width: 120 }}>排序</th>
                <th style={{ width: 200 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <CategoryEditorRow key={r.id} row={r} token={token} onSave={saveRow} onDelete={() => remove(r.id)} onError={setErr} />
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
  token,
  onSave,
  onDelete,
  onError,
}: {
  row: CategoryRow;
  token: string | null;
  onSave: (r: CategoryRow, patch: { name?: string; sortOrder?: number; thumbnail?: string | null }) => void;
  onDelete: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState(row.name);
  const [sort, setSort] = useState(String(row.sortOrder));
  const [thumb, setThumb] = useState(row.thumbnail || '');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setName(row.name);
    setSort(String(row.sortOrder));
    setThumb(row.thumbnail || '');
  }, [row.name, row.sortOrder, row.thumbnail]);

  const dirty =
    name.trim() !== row.name ||
    Number(sort) !== row.sortOrder ||
    (thumb || '') !== (row.thumbnail || '');

  async function onClearThumb() {
    setThumb('');
    onError('');
    try {
      await onSave(row, { thumbnail: null });
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : '恢复默认失败');
    }
  }

  async function onPickThumb(file?: File | null) {
    if (!token || !file) return;
    setUploading(true);
    onError('');
    try {
      const up = await uploadAdminImageMultipart(token, file, file.name || 'category.jpg', file.type || 'image/jpeg');
      const imageUrl = up.imageUrl || '';
      setThumb(imageUrl);
      // 上传后立即写入 DB，避免只换图不点「保存」导致小程序首页仍是默认图标
      await onSave(row, { thumbnail: imageUrl });
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : '图片上传失败');
    } finally {
      setUploading(false);
    }
  }

  return (
    <tr>
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
          <img
            alt=""
            src={getCategoryIconPreview(name, thumb, row.thumb)}
            style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'contain', background: '#f5f6f8' }}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            {thumb ? '自定义' : '默认'}
          </span>
          <label className="btn btn-ghost" style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', cursor: uploading ? 'not-allowed' : 'pointer' }}>
            {uploading ? '…' : '换图'}
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              style={{ display: 'none' }}
              onChange={(e) => onPickThumb(e.target.files?.[0] || null)}
            />
          </label>
          {thumb ? (
            <button type="button" className="btn btn-ghost" style={{ padding: 0, fontSize: '0.75rem' }} onClick={() => void onClearThumb()}>
              恢复默认
            </button>
          ) : null}
        </div>
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
              onSave(row, {
                name: name.trim(),
                sortOrder,
                thumbnail: thumb.trim() || null,
              });
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
