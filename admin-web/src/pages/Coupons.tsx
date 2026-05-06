import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import {
  createAdminCoupon,
  deleteAdminCoupon,
  fetchAdminCoupons,
  fetchPointPolicy,
  grantAdminCoupon,
  updateAdminCoupon,
  updatePointPolicy,
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

  const [policyLoading, setPolicyLoading] = useState(true);
  const [policySaving, setPolicySaving] = useState(false);
  const [pointsEarnRatePercent, setPointsEarnRatePercent] = useState('1');
  const [pointsUseThreshold, setPointsUseThreshold] = useState('1000');

  const [name, setName] = useState('');
  const [type, setType] = useState<1 | 2>(2);
  const [value, setValue] = useState('');
  const [base, setBase] = useState('');
  const [totalCount, setTotalCount] = useState('100');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<{
    id: number;
    name: string;
    type: 1 | 2;
    value: string;
    base: string;
    totalCount: string;
    startDate: string;
    endDate: string;
    status: 'enabled' | 'disabled';
  } | null>(null);

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

  const loadPolicy = useCallback(async () => {
    if (!token) return;
    setPolicyLoading(true);
    try {
      const p = await fetchPointPolicy(token);
      setPointsEarnRatePercent(String(p.pointsEarnRatePercent ?? 1));
      setPointsUseThreshold(String(p.pointsUseThreshold ?? 1000));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '积分规则加载失败');
    } finally {
      setPolicyLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadPolicy();
  }, [loadPolicy]);

  async function onSavePolicy() {
    if (!token) return;
    const rate = Number(pointsEarnRatePercent);
    const threshold = Math.floor(Number(pointsUseThreshold));
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      setErr('积分奖励比例需为 0~100');
      return;
    }
    if (!Number.isFinite(threshold) || threshold < 0) {
      setErr('积分可用门槛需为非负整数');
      return;
    }
    setPolicySaving(true);
    setErr('');
    try {
      const next = await updatePointPolicy(token, {
        pointsEarnRatePercent: rate,
        pointsUseThreshold: threshold,
      });
      setPointsEarnRatePercent(String(next.pointsEarnRatePercent));
      setPointsUseThreshold(String(next.pointsUseThreshold));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '保存失败');
    } finally {
      setPolicySaving(false);
    }
  }

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

  function openEdit(c: AdminCouponRow) {
    const st = new Date(c.startTime).toISOString().slice(0, 10);
    const et = new Date(c.endTime).toISOString().slice(0, 10);
    setEditDraft({
      id: c.id,
      name: c.name,
      type: c.type,
      value: String(c.value),
      base: String(c.base),
      totalCount: String(c.totalCount),
      startDate: st,
      endDate: et,
      status: c.status === 'disabled' ? 'disabled' : 'enabled',
    });
    setErr('');
  }

  async function saveEdit() {
    if (!token || !editDraft) return;
    const vv = Math.floor(Number(editDraft.value));
    const bb = Math.floor(Number(editDraft.base || 0));
    const cc = Math.floor(Number(editDraft.totalCount || 0));
    const st = new Date(editDraft.startDate).getTime();
    const et = new Date(editDraft.endDate).getTime();
    if (!editDraft.name.trim() || !Number.isFinite(vv) || vv <= 0 || !Number.isFinite(st) || !Number.isFinite(et) || et <= st) {
      setErr('请检查优惠券参数');
      return;
    }
    if (!Number.isFinite(bb) || bb < 0) {
      setErr('门槛需为非负整数');
      return;
    }
    if (!Number.isFinite(cc) || cc <= 0) {
      setErr('总量需大于0');
      return;
    }
    setEditingId(editDraft.id);
    setErr('');
    try {
      await updateAdminCoupon(token, editDraft.id, {
        name: editDraft.name.trim(),
        type: editDraft.type,
        value: vv,
        base: bb,
        totalCount: cc,
        startTime: st,
        endTime: et,
        status: editDraft.status,
      });
      setEditDraft(null);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '编辑失败');
    } finally {
      setEditingId(null);
    }
  }

  async function onDelete(c: AdminCouponRow) {
    if (!token) return;
    if (!window.confirm(`确定删除优惠券「${c.name}」？已领取记录也会一并删除。`)) return;
    setDeletingId(c.id);
    setErr('');
    try {
      await deleteAdminCoupon(token, c.id);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '删除失败');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>优惠券管理</h2>
      {err ? <div className="err-banner">{err}</div> : null}

      <div className="card" style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem', maxWidth: 740 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <strong>积分规则</strong>
          <button className="btn btn-primary" type="button" disabled={policyLoading || policySaving} onClick={onSavePolicy}>
            {policySaving ? '保存中…' : '保存积分规则'}
          </button>
        </div>
        {policyLoading ? (
          <p style={{ margin: 0, color: 'var(--muted)' }}>加载中…</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>积分奖励比例（%）</span>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={pointsEarnRatePercent}
                onChange={(e) => setPointsEarnRatePercent(e.target.value)}
                disabled={policySaving}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>积分可用门槛</span>
              <input
                type="number"
                min={0}
                step={1}
                value={pointsUseThreshold}
                onChange={(e) => setPointsUseThreshold(e.target.value)}
                disabled={policySaving}
              />
            </label>
          </div>
        )}
      </div>

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

      {editDraft ? (
        <div className="card" style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <strong>编辑优惠券 #{editDraft.id}</strong>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary" type="button" disabled={editingId === editDraft.id} onClick={saveEdit}>
                {editingId === editDraft.id ? '保存中…' : '保存'}
              </button>
              <button className="btn btn-ghost" type="button" disabled={editingId === editDraft.id} onClick={() => setEditDraft(null)}>
                取消
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.8fr 0.8fr', gap: '0.75rem' }}>
            <input
              placeholder="优惠券名称"
              value={editDraft.name}
              onChange={(e) => setEditDraft((d) => (d ? { ...d, name: e.target.value } : d))}
            />
            <select
              value={String(editDraft.type)}
              onChange={(e) => setEditDraft((d) => (d ? { ...d, type: Number(e.target.value) as 1 | 2 } : d))}
            >
              <option value="2">满减券（分）</option>
              <option value="1">折扣券（85=8.5折）</option>
            </select>
            <input
              placeholder="面值/折扣值"
              value={editDraft.value}
              onChange={(e) => setEditDraft((d) => (d ? { ...d, value: e.target.value } : d))}
            />
            <input
              placeholder="门槛(分,可空)"
              value={editDraft.base}
              onChange={(e) => setEditDraft((d) => (d ? { ...d, base: e.target.value } : d))}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.6fr 0.7fr', gap: '0.75rem' }}>
            <input
              type="date"
              value={editDraft.startDate}
              onChange={(e) => setEditDraft((d) => (d ? { ...d, startDate: e.target.value } : d))}
            />
            <input
              type="date"
              value={editDraft.endDate}
              onChange={(e) => setEditDraft((d) => (d ? { ...d, endDate: e.target.value } : d))}
            />
            <input
              placeholder="总量"
              value={editDraft.totalCount}
              onChange={(e) => setEditDraft((d) => (d ? { ...d, totalCount: e.target.value } : d))}
            />
            <select
              value={editDraft.status}
              onChange={(e) => setEditDraft((d) => (d ? { ...d, status: e.target.value as 'enabled' | 'disabled' } : d))}
            >
              <option value="enabled">启用</option>
              <option value="disabled">停用</option>
            </select>
          </div>
        </div>
      ) : null}

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
                    <button
                      className="btn btn-ghost"
                      type="button"
                      style={{ marginLeft: 8 }}
                      onClick={() => openEdit(r)}
                    >
                      编辑
                    </button>
                    <button
                      className="btn btn-danger"
                      type="button"
                      style={{ marginLeft: 8 }}
                      disabled={deletingId === r.id}
                      onClick={() => onDelete(r)}
                    >
                      {deletingId === r.id ? '删除中…' : '删除'}
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

