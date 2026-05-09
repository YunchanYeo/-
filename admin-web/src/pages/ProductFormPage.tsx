import { type ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth';
import {
  createProduct,
  deleteProduct,
  fetchCategories,
  fetchProduct,
  updateProduct,
  uploadAdminImage,
  type CategoryRow,
  type ProductRow,
} from '../api/admin';
import { resolveUploadUrl } from '../api/client';

function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const res = String(r.result || '');
      const m = res.match(/^data:([^;]+);base64,(.+)$/);
      if (m) resolve({ mime: m[1], base64: m[2] });
      else reject(new Error('无法读取图片'));
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export default function ProductFormPage() {
  const { id } = useParams();
  const isNew = !id;
  const productId = id ? Number(id) : NaN;
  const { token } = useAuth();
  const nav = useNavigate();

  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [title, setTitle] = useState('');
  const [priceYuan, setPriceYuan] = useState('');
  const [originYuan, setOriginYuan] = useState('');
  const [stock, setStock] = useState('0');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [company, setCompany] = useState('');
  const [status, setStatus] = useState<'ON' | 'OFF'>('ON');
  const [image, setImage] = useState('');

  useEffect(() => {
    if (!token) return;
    fetchCategories(token).then(setCats).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token || isNew || !Number.isFinite(productId)) return;
    setLoading(true);
    fetchProduct(token, productId)
      .then((p: ProductRow) => {
        setTitle(p.title);
        setPriceYuan((p.price / 100).toFixed(2));
        setOriginYuan(p.originPrice != null ? (p.originPrice / 100).toFixed(2) : '');
        setStock(String(p.stock));
        setCategory(p.category || '');
        setDescription(p.description || '');
        setBrand(p.brand || '');
        setCompany(p.company || '');
        setStatus(p.status === 'OFF' ? 'OFF' : 'ON');
        setImage(p.image || '');
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [token, isNew, productId]);

  async function onPickImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!token) {
      setErr('登录已失效，请重新登录后再上传');
      e.target.value = '';
      return;
    }
    setErr('');
    try {
      const { base64, mime } = await fileToBase64(file);
      const up = await uploadAdminImage(token, {
        fileName: file.name,
        mimeType: mime,
        base64Data: base64,
      });
      setImage(up.imageUrl);
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : '上传失败');
    }
    e.target.value = '';
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const priceCent = Math.round(Number(priceYuan) * 100);
    const originCent =
      originYuan.trim() === '' ? null : Math.round(Number(originYuan) * 100);
    const stockN = Math.floor(Number(stock));
    if (!title.trim()) {
      setErr('请填写标题');
      return;
    }
    if (!Number.isFinite(priceCent) || priceCent < 0) {
      setErr('售价无效');
      return;
    }
    if (originCent !== null && (!Number.isFinite(originCent) || originCent < 0)) {
      setErr('原价无效');
      return;
    }
    if (!Number.isFinite(stockN) || stockN < 0) {
      setErr('库存无效');
      return;
    }

    const common = {
      title: title.trim(),
      price: priceCent,
      stock: stockN,
      image,
      description,
      brand,
      company,
      category: category.trim(),
      status,
    };

    setSaving(true);
    setErr('');
    try {
      if (isNew) {
        await createProduct(token, {
          ...common,
          ...(originCent !== null ? { originPrice: originCent } : {}),
        });
      } else {
        await updateProduct(token, productId, {
          ...common,
          originPrice: originCent,
        });
      }
      nav('/products');
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!token || isNew || !Number.isFinite(productId)) return;
    if (!window.confirm(`确定删除「${title || '该商品'}」？删除后不可恢复。`)) return;
    setDeleting(true);
    setErr('');
    try {
      await deleteProduct(token, productId);
      nav('/products');
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  }

  if (!isNew && !Number.isFinite(productId)) {
    return <p style={{ color: 'var(--muted)' }}>无效的商品 ID</p>;
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: 680, minWidth: 0, padding: '0 clamp(0, 2vw, 0.5rem)', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: '1rem' }}>
          <Link to="/products" style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
            ← 返回列表
          </Link>
        </div>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>{isNew ? '新建商品' : '编辑商品'}</h2>
        {err ? <div className="err-banner">{err}</div> : null}

        {loading ? (
          <p style={{ color: 'var(--muted)' }}>加载中…</p>
        ) : (
          <form className="card" onSubmit={onSubmit} style={{ display: 'grid', gap: '1rem', maxWidth: 560, margin: '0 auto' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>标题</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>售价（元）</span>
              <input value={priceYuan} onChange={(e) => setPriceYuan(e.target.value)} required />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>原价（元，可空）</span>
              <input value={originYuan} onChange={(e) => setOriginYuan(e.target.value)} />
            </label>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>库存</span>
            <input type="number" min={0} step={1} value={stock} onChange={(e) => setStock(e.target.value)} required />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>分类（与小程序分类名称一致）</span>
            <input list="cat-options" value={category} onChange={(e) => setCategory(e.target.value)} />
            <datalist id="cat-options">
              {cats.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>状态</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as 'ON' | 'OFF')}>
              <option value="ON">上架</option>
              <option value="OFF">下架</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>描述</span>
            <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>品牌</span>
              <input value={brand} onChange={(e) => setBrand(e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>厂商</span>
              <input value={company} onChange={(e) => setCompany(e.target.value)} />
            </label>
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block', marginBottom: '0.35rem' }}>
              主图
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {image ? (
                <img
                  alt=""
                  src={resolveUploadUrl(image)}
                  style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
                />
              ) : null}
              <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
                上传图片
                <input type="file" accept="image/*" hidden onChange={onPickImage} />
              </label>
              {image ? (
                <button type="button" className="btn btn-danger" onClick={() => setImage('')}>
                  清除
                </button>
              ) : null}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="submit" className="btn btn-primary" disabled={saving || deleting}>
              {saving ? '保存中…' : '保存'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => nav('/products')} disabled={deleting}>
              取消
            </button>
            {!isNew ? (
              <button type="button" className="btn btn-danger" onClick={() => void onDelete()} disabled={saving || deleting}>
                {deleting ? '删除中…' : '删除商品'}
              </button>
            ) : null}
          </div>
          </form>
        )}
      </div>
    </div>
  );
}
