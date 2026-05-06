import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { fetchLogisticsTrace, fetchOrders, updateOrderStatus, updateShipping, type OrderRow } from '../api/admin';

const ORDER_STATUS_OPTIONS = [
  { value: 10, label: '待发货' },
  { value: 40, label: '待收货' },
  { value: 50, label: '已完成' },
  { value: 60, label: '已取消' },
] as const;

export default function OrdersPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOrder, setModalOrder] = useState<OrderRow | null>(null);
  const [traceOpen, setTraceOpen] = useState<OrderRow | null>(null);
  const [traceJson, setTraceJson] = useState('');
  const [traceLoading, setTraceLoading] = useState(false);

  const [companyCode, setCompanyCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [logisticsNo, setLogisticsNo] = useState('');
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string>('');

  const load = useCallback(async () => {
    if (!token) return;
    setErr('');
    setLoading(true);
    try {
      setRows(await fetchOrders(token));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  function openShip(o: OrderRow) {
    setModalOrder(o);
    setCompanyCode(o.logisticsCompanyCode || '');
    setCompanyName(o.logisticsCompanyName || '');
    setLogisticsNo(o.logisticsNo || '');
    setRemark(o.logisticsRemark || '');
  }

  async function onShipSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || !modalOrder) return;
    setSubmitting(true);
    setErr('');
    try {
      await updateShipping(token, modalOrder.orderNo, {
        logisticsCompanyCode: companyCode.trim() || undefined,
        logisticsCompanyName: companyName.trim(),
        logisticsNo: logisticsNo.trim(),
        logisticsRemark: remark.trim() || undefined,
      });
      setModalOrder(null);
      await load();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : '发货失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function loadTrace(o: OrderRow) {
    if (!token) return;
    setTraceOpen(o);
    setTraceJson('');
    setTraceLoading(true);
    try {
      const data = await fetchLogisticsTrace(token, o.orderNo);
      setTraceJson(JSON.stringify(data, null, 2));
    } catch (ex: unknown) {
      setTraceJson(ex instanceof Error ? ex.message : '查询失败');
    } finally {
      setTraceLoading(false);
    }
  }

  async function onUpdateStatus(o: OrderRow, orderStatus: number) {
    if (!token) return;
    setStatusUpdating(o.orderNo);
    setErr('');
    try {
      const label = ORDER_STATUS_OPTIONS.find((x) => x.value === orderStatus)?.label;
      await updateOrderStatus(token, o.orderNo, { orderStatus, ...(label ? { orderStatusName: label } : {}) });
      await load();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : '更新状态失败');
    } finally {
      setStatusUpdating('');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>订单与发货</h2>
        <button type="button" className="btn btn-ghost" onClick={() => load()} disabled={loading}>
          刷新
        </button>
      </div>
      {err ? <div className="err-banner">{err}</div> : null}

      <div className="card table-wrap">
        {loading ? (
          <p style={{ color: 'var(--muted)', margin: 0 }}>加载中…</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>订单号</th>
                <th>用户</th>
                <th>金额</th>
                <th>状态</th>
                <th>物流</th>
                <th style={{ width: 200 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.orderNo}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{o.orderNo}</td>
                  <td>{o.nickName || o.phoneNumber || `用户 ${o.userId}`}</td>
                  <td>¥{(o.paymentAmount / 100).toFixed(2)}</td>
                  <td>
                    <span className="badge">{o.orderStatusName}</span>
                  </td>
                  <td style={{ fontSize: '0.8rem', maxWidth: 220 }}>
                    {o.logisticsNo ? (
                      <>
                        {o.logisticsCompanyName} · {o.logisticsNo}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-primary" style={{ padding: '0.35rem 0.55rem', fontSize: '0.8rem' }} onClick={() => openShip(o)}>
                        发货 / 改物流
                      </button>
                      <select
                        value={String(o.orderStatus)}
                        disabled={statusUpdating === o.orderNo}
                        onChange={(e) => onUpdateStatus(o, Number(e.target.value))}
                        style={{ padding: '0.35rem 0.45rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.8rem' }}
                      >
                        {ORDER_STATUS_OPTIONS.map((it) => (
                          <option key={it.value} value={it.value}>
                            {it.label}
                          </option>
                        ))}
                      </select>
                      <button type="button" className="btn btn-ghost" style={{ padding: '0.35rem 0.55rem', fontSize: '0.8rem' }} onClick={() => loadTrace(o)}>
                        轨迹
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOrder ? (
        <div
          role="dialog"
          aria-modal
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 50,
          }}
          onClick={() => setModalOrder(null)}
        >
          <div className="card" style={{ width: '100%', maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.05rem' }}>发货 · {modalOrder.orderNo}</h3>
            <form onSubmit={onShipSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>快递公司代码（可选，轨迹用）</span>
                <input value={companyCode} onChange={(e) => setCompanyCode(e.target.value)} placeholder="如 shunfeng" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>快递公司名称</span>
                <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>运单号</span>
                <input value={logisticsNo} onChange={(e) => setLogisticsNo(e.target.value)} required />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>备注（可选）</span>
                <input value={remark} onChange={(e) => setRemark(e.target.value)} />
              </label>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? '提交中…' : '保存'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setModalOrder(null)}>
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {traceOpen ? (
        <div
          role="dialog"
          aria-modal
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 50,
          }}
          onClick={() => setTraceOpen(null)}
        >
          <div className="card" style={{ width: '100%', maxWidth: 560, maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.05rem' }}>物流轨迹 · {traceOpen.orderNo}</h3>
            {traceLoading ? (
              <p style={{ color: 'var(--muted)' }}>查询中…</p>
            ) : (
              <pre style={{ margin: 0, fontSize: '0.78rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{traceJson}</pre>
            )}
            <button type="button" className="btn btn-ghost" style={{ marginTop: '1rem' }} onClick={() => setTraceOpen(null)}>
              关闭
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
