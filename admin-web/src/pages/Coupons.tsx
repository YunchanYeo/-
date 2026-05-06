import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import {
  createAdminCoupon,
  fetchAdminCoupons,
  grantAdminCoupon,
  type AdminCouponRow,
} from '../api/admin';

function fmtDate(ts: number) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export default function CouponsPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<AdminCouponRow[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [grantingId, setGrantingId] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<1 | 2>(2);
  const [value, setValue] = useState('');
  const [base, setBase] = useState('');
  const [totalCount, setTotalCount] = useState('100');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr('');
    try {
      setRows(await fetchAdminCoupons(token));
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
    if (!token) return;
    const vv = Math.floor(Number(value));
    const bb = base.trim() ? Math.floor(Number(base)) : 0;
    const cc = totalCount.trim() ? Math.floor(Number(totalCount)) : 100;
    const st = new Date(startDate).getTime();
    const et = new Date(endDate).getTime();
    if (!name.trim() || !Number.isFinite(vv) || vv <= 0 || !Number.isFinite(st) || !Number.isFinite(et) || et <= st) {
      setErr('请检查优惠券参数');
      return;
    }
    setCreating(true);
    setErr('');
    try {
      await createAdminCoupon(token, {
        name: name.trim(),
        type,
        value: vv,
        base: Number.isFinite(bb) && bb > 0 ? bb : 0,
        totalCount: Number.isFinite(cc) && cc > 0 ? cc : 100,
        startTime: st,
        endTime: et,
      });
      setName('');
      setValue('');
      setBase('');
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '创建失败');
    } finally {
      setCreating(false);
    }
  }

  async function onGrantAll(couponId: number) {
    if (!token) return;
    setGrantingId(couponId);
    setErr('');
    try {
      const r = await grantAdminCoupon(token, couponId, { grantAllUsers: true });
      await load();
      alert(`已发放 ${r.grantedCount} 张`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '发放失败');
    } finally {
      setGrantingId(null);
    }
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>优惠券管理</h2>
      {err ? <div className="err-banner">{err}</div> : null}

      <form className="card" onSubmit={onCreate} style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.8fr 0.8fr', gap: '0.75rem' }}>
          <input placeholder="优惠券名称" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={String(type)} onChange={(e) => setType(Number(e.target.value) as 1 | 2)}>
            <option value="2">满减券（分）</option>
            <option value="1">折扣券（85=8.5折）</option>
          </select>
          <input placeholder="面值/折扣值" value={value} onChange={(e) => setValue(e.target.value)} />
          <input placeholder="门槛(分,可空)" value={base} onChange={(e) => setBase(e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.6fr auto', gap: '0.75rem' }}>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <input placeholder="总量" value={totalCount} onChange={(e) => setTotalCount(e.target.value)} />
          <button className="btn btn-primary" type="submit" disabled={creating}>
            {creating ? '创建中…' : '创建优惠券'}
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
                <th>名称</th>
                <th>类型</th>
                <th>值</th>
                <th>库存</th>
                <th>有效期</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.name}</td>
                  <td>{r.type === 2 ? '满减' : '折扣'}</td>
                  <td>{r.type === 2 ? `¥${(r.value / 100).toFixed(2)}` : `${r.value / 10}折`}</td>
                  <td>
                    {r.issuedCount}/{r.totalCount}
                  </td>
                  <td>
                    {fmtDate(r.startTime)} ~ {fmtDate(r.endTime)}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      disabled={grantingId === r.id}
                      onClick={() => onGrantAll(r.id)}
                    >
                      {grantingId === r.id ? '发放中…' : '发给全部用户'}
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

