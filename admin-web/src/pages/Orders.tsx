import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import {
  fetchAdminOrderVisibility,
  fetchLogisticsTrace,
  fetchOrders,
  updateAdminOrderVisibility,
  updateOrderStatus,
  updateShipping,
  type OrderRow,
} from '../api/admin';
import TraceLeafletMap, { type TraceLeafletMapHandle } from '../TraceLeafletMap';
import { exportOrdersAsSalesSlips } from '../utils/salesSlipExport';

const ADMIN_HIDDEN_ORDERS_KEY = 'admin_web_hidden_order_nos';
const VIRTUAL_ROW_HEIGHT = 52;
const DEFAULT_LIST_VIEWPORT = 560;

function useOrdersListViewportHeight(): number {
  const [h, setH] = useState(DEFAULT_LIST_VIEWPORT);
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      const ih = window.innerHeight;
      if (w <= 480) setH(Math.max(220, Math.round(ih * 0.34)));
      else if (w <= 768) setH(Math.max(300, Math.round(ih * 0.42)));
      else setH(DEFAULT_LIST_VIEWPORT);
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);
  return h;
}

const ORDER_STATUS_OPTIONS = [
  { value: 10, label: '待发货' },
  { value: 40, label: '待收货' },
  { value: 50, label: '已完成' },
  { value: 60, label: '已取消' },
] as const;

type LogisticsTraceData = {
  configured?: boolean;
  hint?: string;
  orderNo?: string;
  logisticsCompanyName?: string;
  logisticsNo?: string;
  traces?: Array<{ time?: string; context?: string; areaName?: string; latitude?: number; longitude?: number }>;
  polylinePoints?: Array<{ latitude: number; longitude: number }>;
};

type ImportFailure = {
  rowNo: number;
  orderNo: string;
  reason: string;
  row: Record<string, any>;
};

type XlsxModule = typeof import('xlsx');
let xlsxModulePromise: Promise<XlsxModule> | null = null;

function getXlsx() {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import('xlsx');
  }
  return xlsxModulePromise;
}

export default function OrdersPage() {
  const listViewportH = useOrdersListViewportHeight();
  const { token } = useAuth();
  const location = useLocation();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOrder, setModalOrder] = useState<OrderRow | null>(null);
  const [detailOrder, setDetailOrder] = useState<OrderRow | null>(null);
  const [focusOrderNo, setFocusOrderNo] = useState<string>('');
  const [traceOpen, setTraceOpen] = useState<OrderRow | null>(null);
  const [traceData, setTraceData] = useState<LogisticsTraceData | null>(null);
  const [traceErr, setTraceErr] = useState('');
  const [traceLoading, setTraceLoading] = useState(false);

  const [companyCode, setCompanyCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [logisticsNo, setLogisticsNo] = useState('');
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [importLog, setImportLog] = useState('');
  const [importFailures, setImportFailures] = useState<ImportFailure[]>([]);
  const [dryRunMode, setDryRunMode] = useState(false);
  const [virtualScrollTop, setVirtualScrollTop] = useState(0);
  const traceMapRef = useRef<TraceLeafletMapHandle | null>(null);
  const importResultRef = useRef<HTMLDivElement | null>(null);
  const [traceRowFocus, setTraceRowFocus] = useState<number | null>(null);
  const [hiddenOrderNos, setHiddenOrderNos] = useState<string[]>([]);
  const [showHiddenOnly, setShowHiddenOnly] = useState(false);
  const [selectedOrderNos, setSelectedOrderNos] = useState<string[]>([]);
  const [filterOrderNo, setFilterOrderNo] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterUserKeyword, setFilterUserKeyword] = useState('');

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

  // 从客服会话跳转过来时：/orders?orderNo=xxxx 自动定位并打开详情
  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const q = String(params.get('orderNo') || '').trim();
    if (!q) return;
    setFocusOrderNo(q);
  }, [location.search]);

  useEffect(() => {
    if (!focusOrderNo) return;
    const hit = rows.find((r) => String(r.orderNo || '').trim() === focusOrderNo);
    if (!hit) return;
    setShowHiddenOnly(false);
    setDetailOrder(hit);
    const t = window.setTimeout(() => setFocusOrderNo(''), 2200);
    return () => window.clearTimeout(t);
  }, [focusOrderNo, rows]);

  useEffect(() => {
    let cancelled = false;
    async function loadVisibility() {
      if (!token) return;
      try {
        const data = await fetchAdminOrderVisibility(token);
        if (cancelled) return;
        const hidden = Array.isArray(data?.hiddenOrderNos) ? data.hiddenOrderNos.map((x) => String(x).trim()).filter(Boolean) : [];
        setHiddenOrderNos(hidden);
        localStorage.setItem(ADMIN_HIDDEN_ORDERS_KEY, JSON.stringify(hidden));
      } catch {
        try {
          const raw = localStorage.getItem(ADMIN_HIDDEN_ORDERS_KEY);
          const parsed = raw ? JSON.parse(raw) : [];
          if (Array.isArray(parsed)) {
            setHiddenOrderNos(parsed.map((x) => String(x).trim()).filter(Boolean));
          }
        } catch {
          setHiddenOrderNos([]);
        }
      }
    }
    loadVisibility();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function saveHiddenOrderNos(next: string[]) {
    const unique = Array.from(new Set(next.map((x) => String(x).trim()).filter(Boolean)));
    setHiddenOrderNos(unique);
    try {
      localStorage.setItem(ADMIN_HIDDEN_ORDERS_KEY, JSON.stringify(unique));
    } catch {
      // ignore
    }
    if (token) {
      updateAdminOrderVisibility(token, { hiddenOrderNos: unique }).catch(() => {
        // ignore sync errors, UI keeps local state
      });
    }
  }

  function removeHiddenOrderNos(orderNos: string[]) {
    const removeSet = new Set(orderNos.map((x) => String(x).trim()).filter(Boolean));
    setHiddenOrderNos((prev) => {
      const next = prev.filter((x) => !removeSet.has(x));
      try {
        localStorage.setItem(ADMIN_HIDDEN_ORDERS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      if (token) {
        updateAdminOrderVisibility(token, { hiddenOrderNos: next }).catch(() => {
          // ignore sync errors
        });
      }
      return next;
    });
  }

  function openShip(o: OrderRow) {
    setModalOrder(o);
    setCompanyCode(o.logisticsCompanyCode || '');
    setCompanyName(o.logisticsCompanyName || '');
    setLogisticsNo(o.logisticsNo || '');
    setRemark(o.logisticsRemark || '');
  }

  function openDetail(o: OrderRow) {
    setDetailOrder(o);
  }

  function formatAddress(addr: Record<string, any> | null | undefined) {
    const a = addr || {};
    const name = String(a.name || a.receiverName || a.userName || '').trim();
    const phone = String(a.phone || a.phoneNumber || a.tel || a.mobile || '').trim();
    const province = String(a.provinceName || a.province || '').trim();
    const city = String(a.cityName || a.city || '').trim();
    const district = String(a.districtName || a.district || a.county || '').trim();
    const detail = String(a.detailAddress || a.address || a.addressDetail || '').trim();
    const line1 = [province, city, district].filter(Boolean).join(' ');
    const line2 = detail;
    return {
      name,
      phone,
      line1,
      line2,
      raw: a,
    };
  }

  function normalizeItems(items: unknown) {
    const arr = Array.isArray(items) ? items : [];
    return arr.map((it: any, idx: number) => {
      const title = String(it?.goodsName || it?.title || it?.name || '商品').trim();
      const qty = Number(it?.quantity ?? it?.buyQuantity ?? 1) || 1;
      const price = Number(it?.price ?? it?.actualPrice ?? it?.settlePrice ?? 0) || 0;
      const image = String(it?.primaryImage || it?.thumb || it?.image || '').trim();
      return { idx: idx + 1, title, qty, price, image, raw: it };
    });
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
    setTraceRowFocus(null);
    setTraceData(null);
    setTraceErr('');
    setTraceLoading(true);
    try {
      const data = await fetchLogisticsTrace(token, o.orderNo);
      setTraceData((data || {}) as LogisticsTraceData);
    } catch (ex: unknown) {
      setTraceErr(ex instanceof Error ? ex.message : '查询失败');
    } finally {
      setTraceLoading(false);
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      window.alert('已复制运单号');
    } catch {
      window.alert('复制失败，请手动复制');
    }
  }

  useEffect(() => {
    setTraceRowFocus(null);
  }, [traceData]);

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

  function onRestoreAllOrders() {
    if (!hiddenOrderNos.length) return;
    if (!window.confirm(`恢复全部 ${hiddenOrderNos.length} 条已隐藏订单到管理员列表？`)) return;
    saveHiddenOrderNos([]);
    setShowHiddenOnly(false);
  }

  async function exportOrders() {
    const XLSX = await getXlsx();
    const data = rows.map((o) => ({
      订单号: o.orderNo,
      用户ID: o.userId,
      昵称: o.nickName ?? '',
      手机号: o.phoneNumber ?? '',
      支付金额_分: o.paymentAmount,
      订单状态码: o.orderStatus,
      订单状态: o.orderStatusName,
      物流公司代码: o.logisticsCompanyCode ?? '',
      物流公司名称: o.logisticsCompanyName ?? '',
      运单号: o.logisticsNo ?? '',
      物流备注: o.logisticsRemark ?? '',
      发货时间: o.shippedAt ?? '',
      创建时间: o.createdAt ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'orders');
    XLSX.writeFile(wb, `orders_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function exportSalesSlipWorkbook() {
    const XLSX = await getXlsx();
    const pickList = () => {
      const selectedInView = selectedOrderNos.filter((no) => visibleOrderNos.includes(no));
      if (selectedInView.length) {
        const set = new Set(selectedInView);
        return displayRows.filter((o) => set.has(o.orderNo));
      }
      return displayRows;
    };
    const list = pickList();
    if (!list.length) {
      window.alert('没有可导出的订单（请调整筛选或勾选列表中的订单）');
      return;
    }
    await exportOrdersAsSalesSlips(XLSX, list);
  }

  async function exportImportTemplate() {
    const XLSX = await getXlsx();
    const ws = XLSX.utils.json_to_sheet([
      {
        订单号: '必填',
        物流公司代码: '可空',
        物流公司名称: '可空',
        运单号: '可空',
        物流备注: '可空',
        订单状态码: '可空:10/40/50/60',
        订单状态: '可空',
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'template');
    XLSX.writeFile(wb, 'orders_import_template.xlsx');
  }

  function normalizeOrderNo(input: unknown) {
    const s = String(input ?? '').trim().replace(/^'+|'+$/g, '');
    if (!s) return '';
    if (/^\d+\.0+$/.test(s)) return s.replace(/\.0+$/, '');
    return s;
  }

  function pick(row: Record<string, any>, keys: string[]) {
    for (const k of keys) {
      const v = row[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  }

  async function processImportRows(
    rowsIn: Record<string, any>[],
    options: { dryRun: boolean; baseRowNo?: number } = { dryRun: false, baseRowNo: 2 },
  ) {
    if (!token) return { logs: [] as string[], importedOrderNos: [] as string[], failures: [] as ImportFailure[] };
    const logs: string[] = [];
    const importedOrderNos = new Set<string>();
    const failures: ImportFailure[] = [];
    const baseRowNo = options.baseRowNo ?? 2;

    for (let i = 0; i < rowsIn.length; i++) {
      const r = rowsIn[i];
      const rowNo = baseRowNo + i;
      const orderNoRaw = pick(r, ['订单号', 'orderNo']);
      const orderNo = normalizeOrderNo(orderNoRaw);
      if (!orderNo) {
        logs.push(`#${rowNo} 跳过：缺少 orderNo`);
        continue;
      }
      if (/[eE]\+?\d+/.test(orderNoRaw)) {
        logs.push(`#${rowNo} ${orderNo} 提示：订单号疑似科学计数法，可能已被 Excel 改写导致无法匹配`);
      }
      const logisticsCompanyName = pick(r, ['物流公司名称', 'logisticsCompanyName']);
      const logisticsNo = pick(r, ['运单号', 'logisticsNo']);
      const logisticsCompanyCode = pick(r, ['物流公司代码', 'logisticsCompanyCode']);
      const logisticsRemark = pick(r, ['物流备注', 'logisticsRemark']);
      const orderStatusRaw = pick(r, ['订单状态码', 'orderStatus']);
      const orderStatusName = pick(r, ['订单状态', 'orderStatusName']);

      try {
        if (options.dryRun) {
          if (logisticsCompanyName && logisticsNo) logs.push(`#${rowNo} ${orderNo} 预检：将更新发货信息`);
          if (orderStatusRaw) logs.push(`#${rowNo} ${orderNo} 预检：将更新订单状态`);
          if (!logisticsCompanyName && !logisticsNo && !orderStatusRaw) logs.push(`#${rowNo} ${orderNo} 跳过：无可处理字段`);
          continue;
        }

        if (logisticsCompanyName && logisticsNo) {
          await updateShipping(token, orderNo, {
            logisticsCompanyName,
            logisticsNo,
            ...(logisticsCompanyCode ? { logisticsCompanyCode } : {}),
            ...(logisticsRemark ? { logisticsRemark } : {}),
          });
          logs.push(`#${rowNo} ${orderNo} 发货信息已更新`);
          importedOrderNos.add(orderNo);
        }
        if (orderStatusRaw) {
          const st = Number(orderStatusRaw);
          if (!Number.isFinite(st)) throw new Error('orderStatus 无效');
          await updateOrderStatus(token, orderNo, { orderStatus: st, ...(orderStatusName ? { orderStatusName } : {}) });
          logs.push(`#${rowNo} ${orderNo} 状态已更新`);
          importedOrderNos.add(orderNo);
        }
        if (!logisticsCompanyName && !logisticsNo && !orderStatusRaw) {
          logs.push(`#${rowNo} ${orderNo} 跳过：无可处理字段`);
        }
      } catch (e: unknown) {
        const reason = e instanceof Error ? e.message : '处理失败';
        logs.push(`#${rowNo} ${orderNo} 失败：${reason}`);
        failures.push({ rowNo, orderNo, reason, row: r });
      }
    }

    return { logs, importedOrderNos: Array.from(importedOrderNos), failures };
  }

  async function onImportExcel(file: File, forceDryRun?: boolean) {
    if (!token) return;
    setImporting(true);
    setImportLog('');
    setImportFailures([]);
    setErr('');
    try {
      const XLSX = await getXlsx();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const first = wb.SheetNames[0];
      if (!first) throw new Error('Excel 无工作表');
      const ws = wb.Sheets[first];
      const rowsIn = XLSX.utils.sheet_to_json<Record<string, any>>(ws, {
        defval: '',
        raw: false,
        rawNumbers: false,
      });

      const isDryRun = typeof forceDryRun === 'boolean' ? forceDryRun : dryRunMode;
      const { logs, importedOrderNos, failures } = await processImportRows(rowsIn, { dryRun: isDryRun, baseRowNo: 2 });
      setImportFailures(failures);
      setImportLog(logs.join('\n'));

      if (!isDryRun && importedOrderNos.length > 0) {
        removeHiddenOrderNos(importedOrderNos);
        setShowHiddenOnly(false);
        await load();
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '导入失败');
    } finally {
      setImporting(false);
    }
  }

  async function retryImportFailures() {
    if (!importFailures.length || !token) return;
    setImporting(true);
    setErr('');
    try {
      const rowsIn = importFailures.map((x) => x.row);
      const minRowNo = Math.min(...importFailures.map((x) => x.rowNo));
      const { logs, importedOrderNos, failures } = await processImportRows(rowsIn, { dryRun: false, baseRowNo: minRowNo });
      setImportFailures(failures);
      setImportLog((prev) => `${prev ? `${prev}\n` : ''}--- 重试结果 ---\n${logs.join('\n')}`);
      if (importedOrderNos.length > 0) {
        removeHiddenOrderNos(importedOrderNos);
        setShowHiddenOnly(false);
        await load();
      }
    } finally {
      setImporting(false);
    }
  }

  async function exportImportFailures() {
    if (!importFailures.length) {
      window.alert('导入失败项为空');
      return;
    }
    const XLSX = await getXlsx();
    const data = importFailures.map((f) => ({
      行号: f.rowNo,
      订单号: f.orderNo,
      失败原因: f.reason,
      物流公司代码: pick(f.row, ['物流公司代码', 'logisticsCompanyCode']),
      物流公司名称: pick(f.row, ['物流公司名称', 'logisticsCompanyName']),
      运单号: pick(f.row, ['运单号', 'logisticsNo']),
      物流备注: pick(f.row, ['物流备注', 'logisticsRemark']),
      订单状态码: pick(f.row, ['订单状态码', 'orderStatus']),
      订单状态: pick(f.row, ['订单状态', 'orderStatusName']),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'import_failures');
    XLSX.writeFile(wb, `orders_import_failures_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const visibleRows = useMemo(
    () => (showHiddenOnly ? rows.filter((o) => hiddenOrderNos.includes(o.orderNo)) : rows.filter((o) => !hiddenOrderNos.includes(o.orderNo))),
    [showHiddenOnly, rows, hiddenOrderNos],
  );
  const displayRows = useMemo(() => {
    let list = visibleRows;
    const no = filterOrderNo.trim().toLowerCase();
    if (no) list = list.filter((o) => String(o.orderNo || '').toLowerCase().includes(no));
    const st = filterStatus.trim();
    if (st !== '') {
      const n = Number(st);
      if (Number.isFinite(n)) list = list.filter((o) => o.orderStatus === n);
    }
    const kw = filterUserKeyword.trim().toLowerCase();
    if (kw) {
      list = list.filter(
        (o) =>
          String(o.nickName || '').toLowerCase().includes(kw) ||
          String(o.phoneNumber || '').toLowerCase().includes(kw) ||
          String(o.userId).includes(kw),
      );
    }
    return list;
  }, [visibleRows, filterOrderNo, filterStatus, filterUserKeyword]);
  const visibleOrderNos = useMemo(() => displayRows.map((o) => o.orderNo), [displayRows]);
  const visibleSelectedCount = selectedOrderNos.filter((no) => visibleOrderNos.includes(no)).length;
  const allVisibleSelected = displayRows.length > 0 && visibleSelectedCount === displayRows.length;
  const importFailCount = importFailures.length;
  const startIndex = Math.max(0, Math.floor(virtualScrollTop / VIRTUAL_ROW_HEIGHT) - 6);
  const endIndex = Math.min(displayRows.length, startIndex + Math.ceil(listViewportH / VIRTUAL_ROW_HEIGHT) + 12);
  const windowRows = displayRows.slice(startIndex, endIndex);
  const topSpacer = startIndex * VIRTUAL_ROW_HEIGHT;
  const bottomSpacer = Math.max(0, (displayRows.length - endIndex) * VIRTUAL_ROW_HEIGHT);

  useEffect(() => {
    // 过滤掉当前视图中不存在的选择项，避免切换“正常/隐藏”视图时误操作
    setSelectedOrderNos((prev) => prev.filter((no) => visibleOrderNos.includes(no)));
  }, [visibleOrderNos]);

  function toggleSelectOne(orderNo: string) {
    setSelectedOrderNos((prev) => (prev.includes(orderNo) ? prev.filter((x) => x !== orderNo) : [...prev, orderNo]));
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedOrderNos([]);
      return;
    }
    setSelectedOrderNos(visibleOrderNos);
  }

  function onBatchHideSelected() {
    if (!selectedOrderNos.length) return;
    if (!window.confirm(`将选中的 ${selectedOrderNos.length} 条订单仅在管理员后台隐藏？`)) return;
    saveHiddenOrderNos([...hiddenOrderNos, ...selectedOrderNos]);
    setSelectedOrderNos([]);
  }

  function onBatchRestoreSelected() {
    if (!selectedOrderNos.length) return;
    if (!window.confirm(`恢复选中的 ${selectedOrderNos.length} 条隐藏订单到管理员列表？`)) return;
    const selectedSet = new Set(selectedOrderNos);
    saveHiddenOrderNos(hiddenOrderNos.filter((x) => !selectedSet.has(x)));
    setSelectedOrderNos([]);
  }

  return (
    <div>
      <div className="page-toolbar">
        <h2 style={{ margin: 0, fontSize: 'clamp(1.05rem, 3.5vw, 1.25rem)' }}>销售订单管理</h2>
        <div className="page-toolbar__actions">
          <button type="button" className="btn btn-ghost" onClick={exportOrders} disabled={loading}>
            导出订单列表
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void exportSalesSlipWorkbook()} disabled={loading}>
            导出销售单(Excel)
          </button>
          <button type="button" className="btn btn-ghost" onClick={exportImportTemplate}>
            下载导入模板
          </button>
          <label className="btn btn-primary" style={{ cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.6 : 1 }}>
            {importing ? '导入中…' : '导入 Excel'}
            <input
              type="file"
              accept=".xlsx,.xls"
              hidden
              disabled={importing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) onImportExcel(f);
              }}
            />
          </label>
          <button type="button" className="btn btn-ghost" onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.xlsx,.xls';
            input.onchange = (e: Event) => {
              const f = (e.target as HTMLInputElement).files?.[0];
              if (f) onImportExcel(f, true);
            };
            input.click();
          }}>
            导入预检(Dry-run)
          </button>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--muted)' }}>
            <input type="checkbox" checked={dryRunMode} onChange={(e) => setDryRunMode(e.target.checked)} />
            默认预检模式
          </label>
          <button type="button" className="btn btn-ghost" onClick={() => load()} disabled={loading}>
            刷新
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowHiddenOnly((v) => !v)}
            disabled={!hiddenOrderNos.length && !showHiddenOnly}
          >
            {showHiddenOnly ? '查看正常订单' : `查看已隐藏(${hiddenOrderNos.length})`}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onRestoreAllOrders} disabled={!hiddenOrderNos.length}>
            恢复全部
          </button>
          <button type="button" className="btn btn-ghost" onClick={toggleSelectAllVisible} disabled={!displayRows.length}>
            {allVisibleSelected ? '取消全选' : '全选当前列表'}
          </button>
          {showHiddenOnly ? (
            <button type="button" className="btn btn-primary" onClick={onBatchRestoreSelected} disabled={!selectedOrderNos.length}>
              选中恢复({selectedOrderNos.length})
            </button>
          ) : (
            <button type="button" className="btn btn-danger" onClick={onBatchHideSelected} disabled={!selectedOrderNos.length}>
              选中隐藏({selectedOrderNos.length})
            </button>
          )}
        </div>
      </div>
      <div className="card erp-filter-card" style={{ marginBottom: '1rem' }}>
        <div className="erp-filter-title">查询条件</div>
        <div className="erp-filter-grid">
          <label className="erp-filter-field">
            <span>订单号</span>
            <input value={filterOrderNo} onChange={(e) => setFilterOrderNo(e.target.value)} placeholder="模糊匹配" />
          </label>
          <label className="erp-filter-field">
            <span>订单状态</span>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">全部</option>
              {ORDER_STATUS_OPTIONS.map((it) => (
                <option key={it.value} value={String(it.value)}>
                  {it.label}
                </option>
              ))}
            </select>
          </label>
          <label className="erp-filter-field">
            <span>用户（昵称/手机/ID）</span>
            <input value={filterUserKeyword} onChange={(e) => setFilterUserKeyword(e.target.value)} placeholder="关键字" />
          </label>
          <div className="erp-filter-actions">
            <button type="button" className="btn btn-ghost" onClick={() => { setFilterOrderNo(''); setFilterStatus(''); setFilterUserKeyword(''); }}>
              重置
            </button>
          </div>
        </div>
        <div className="erp-filter-meta">
          当前列表 <strong>{displayRows.length}</strong> 条
          {displayRows.length !== visibleRows.length ? <span>（已筛选，共 {visibleRows.length} 条）</span> : null}
        </div>
      </div>
      {err ? <div className="err-banner">{err}</div> : null}
      <div
        className="card"
        style={{ marginBottom: '1rem', position: 'sticky', top: 8, zIndex: 5, padding: '0.75rem 1rem', display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}
      >
        <span style={{ color: 'var(--muted)', fontSize: '0.86rem' }}>已选订单: <strong style={{ color: 'var(--text)' }}>{selectedOrderNos.length}</strong></span>
        <span style={{ color: 'var(--muted)', fontSize: '0.86rem' }}>
          预计动作: <strong style={{ color: 'var(--text)' }}>{showHiddenOnly ? '恢复显示' : '仅管理员隐藏'}</strong>
        </span>
        <span style={{ color: 'var(--muted)', fontSize: '0.86rem' }}>
          导入失败: <strong style={{ color: importFailCount ? 'var(--danger)' : 'var(--text)' }}>{importFailCount}</strong>
        </span>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
          disabled={!importFailCount}
          onClick={() => importResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          跳转失败明细
        </button>
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
          disabled={!importFailCount || importing}
          onClick={retryImportFailures}
        >
          重试失败项
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
          disabled={!importFailCount}
          onClick={exportImportFailures}
        >
          导出失败项Excel
        </button>
      </div>
      {importLog ? (
        <div className="card" style={{ marginBottom: '1rem' }} ref={importResultRef}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <strong>导入结果</strong>
            <button type="button" className="btn btn-ghost" onClick={() => { setImportLog(''); setImportFailures([]); }}>
              清空
            </button>
          </div>
          {importFailCount ? (
            <div style={{ marginTop: '0.45rem', color: '#fca5a5', fontSize: '0.8rem' }}>
              失败 {importFailCount} 条，可点击“重试失败项”自动重试。
            </div>
          ) : null}
          <pre style={{ margin: '0.75rem 0 0', fontSize: '0.78rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--muted)' }}>
            {importLog}
          </pre>
        </div>
      ) : null}

      <div className="card table-wrap" style={{ maxHeight: listViewportH + 80, overflow: 'auto' }} onScroll={(e) => setVirtualScrollTop((e.currentTarget as HTMLDivElement).scrollTop)}>
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
                <th style={{ width: 220 }}>操作</th>
                <th style={{ width: 90, textAlign: 'center' }}>选择</th>
              </tr>
            </thead>
            <tbody>
              {topSpacer > 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 0, borderBottom: 'none', height: topSpacer }} />
                </tr>
              ) : null}
              {windowRows.map((o) => (
                <tr
                  key={o.orderNo}
                  style={
                    focusOrderNo && o.orderNo === focusOrderNo
                      ? { outline: '2px solid var(--accent)', outlineOffset: -2, boxShadow: '0 0 0 3px rgba(61,139,253,0.18) inset' }
                      : undefined
                  }
                >
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
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: '0.35rem 0.55rem', fontSize: '0.8rem' }}
                        onClick={() => openDetail(o)}
                      >
                        详情
                      </button>
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
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedOrderNos.includes(o.orderNo)}
                      onChange={() => toggleSelectOne(o.orderNo)}
                    />
                  </td>
                </tr>
              ))}
              {bottomSpacer > 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 0, borderBottom: 'none', height: bottomSpacer }} />
                </tr>
              ) : null}
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

      {detailOrder ? (
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
            zIndex: 49,
          }}
          onClick={() => setDetailOrder(null)}
        >
          <div className="card" style={{ width: '100%', maxWidth: 720, maxHeight: '82vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>订单详情 · {detailOrder.orderNo}</h3>
              <button type="button" className="btn btn-ghost" onClick={() => setDetailOrder(null)}>关闭</button>
            </div>

            {(() => {
              const addr = formatAddress(detailOrder.address as any);
              const items = normalizeItems(detailOrder.items);
              return (
                <div style={{ display: 'grid', gap: '0.85rem' }}>
                  <div style={{ display: 'grid', gap: '0.35rem' }}>
                    <strong style={{ fontSize: '0.9rem' }}>收货信息</strong>
                    <div style={{ color: 'var(--muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                      <div>
                        {addr.name || '—'} {addr.phone ? <span style={{ marginLeft: 10, fontFamily: 'monospace' }}>{addr.phone}</span> : null}
                      </div>
                      <div>{[addr.line1, addr.line2].filter(Boolean).join(' ') || '—'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '0.45rem' }}>
                    <strong style={{ fontSize: '0.9rem' }}>购买商品</strong>
                    {items.length ? (
                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {items.map((it) => (
                          <div key={it.idx} style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 10, padding: '0.55rem 0.65rem', background: 'var(--surface)' }}>
                            <div style={{ width: 46, height: 46, borderRadius: 10, overflow: 'hidden', flex: '0 0 auto', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)' }}>
                              {it.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={it.image} alt={it.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : null}
                            </div>
                            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {it.title}
                              </div>
                              <div style={{ marginTop: 2, fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                                <span>数量：{it.qty}</span>
                                <span style={{ fontFamily: 'monospace' }}>单价：{Number.isFinite(it.price) ? it.price : 0}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>—</div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gap: '0.35rem' }}>
                    <strong style={{ fontSize: '0.9rem' }}>订单信息</strong>
                    <div style={{ color: 'var(--muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                      <div>用户：{detailOrder.nickName || detailOrder.phoneNumber || `用户 ${detailOrder.userId}`}</div>
                      <div>金额：¥{(detailOrder.paymentAmount / 100).toFixed(2)}</div>
                      <div>状态：{detailOrder.orderStatusName}</div>
                      <div>创建：{detailOrder.createdAt || '—'}</div>
                    </div>
                  </div>
                </div>
              );
            })()}
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
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.05rem', color: '#fff' }}>物流轨迹 · {traceOpen.orderNo}</h3>
            {traceLoading ? (
              <p style={{ color: 'rgba(255,255,255,0.8)' }}>查询中…</p>
            ) : traceErr ? (
              <div className="err-banner">{traceErr}</div>
            ) : (
              <div style={{ display: 'grid', gap: '0.85rem' }}>
                <div
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '0.85rem',
                    background: 'var(--surface)',
                    display: 'grid',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#fff' }}>
                    {traceData?.logisticsCompanyName || traceOpen.logisticsCompanyName || '物流公司'} ·{' '}
                    {traceData?.logisticsNo || traceOpen.logisticsNo || '-'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'center' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.15rem 0.55rem',
                        borderRadius: 999,
                        fontSize: '0.75rem',
                        background: '#e8f8ee',
                        color: '#118545',
                      }}
                    >
                      {traceData?.traces?.length ? '运输中' : '暂无状态'}
                    </span>
                    {(traceData?.logisticsNo || traceOpen.logisticsNo) ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => copyText(String(traceData?.logisticsNo || traceOpen.logisticsNo || ''))}
                      >
                        复制单号
                      </button>
                    ) : null}
                  </div>
                  {!traceData?.configured ? (
                    <div style={{ fontSize: '0.8rem', color: '#8a5a00', lineHeight: 1.5, background: '#fff8e6', border: '1px solid #f3d782', borderRadius: 10, padding: '0.65rem' }}>
                      {traceData?.hint || '请配置快递查询密钥后重试。'}
                    </div>
                  ) : null}
                </div>

                {Array.isArray(traceData?.polylinePoints) && traceData!.polylinePoints!.length > 0 ? (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', padding: '0.5rem' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.45rem' }}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                        onClick={() => traceMapRef.current?.fitAll()}
                      >
                        全程路径
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                        onClick={() => traceMapRef.current?.flyToCurrent()}
                      >
                        当前位置
                      </button>
                    </div>
                    <TraceLeafletMap ref={traceMapRef} points={traceData!.polylinePoints!} />
                    <div style={{ marginTop: '0.35rem', color: 'rgba(255,255,255,0.75)', fontSize: '0.75rem' }}>
                      OSM 地图（无需 Key）。如在中国境内访问慢/不显示，可改用国内地图服务。点击下方轨迹行可跳转到该节点（需接口返回坐标）。
                    </div>
                  </div>
                ) : null}

                <div style={{ display: 'grid', gap: '0.55rem' }}>
                  {(traceData?.traces || []).length === 0 ? (
                    <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem' }}>暂无轨迹节点（未查询到或接口未返回明细）</div>
                  ) : (
                    (traceData?.traces || []).map((row, idx) => {
                      const lat = row.latitude;
                      const lng = row.longitude;
                      const hasCoord =
                        lat != null &&
                        lng != null &&
                        Number.isFinite(lat) &&
                        Number.isFinite(lng) &&
                        Array.isArray(traceData?.polylinePoints) &&
                        traceData!.polylinePoints!.length > 0;
                      return (
                      <div
                        key={`${row.time || ''}-${idx}`}
                        role={hasCoord ? 'button' : undefined}
                        tabIndex={hasCoord ? 0 : undefined}
                        onClick={() => {
                          if (!hasCoord) return;
                          setTraceRowFocus(idx);
                          traceMapRef.current?.flyTo(lat!, lng!, 14);
                        }}
                        onKeyDown={(e) => {
                          if (!hasCoord) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setTraceRowFocus(idx);
                            traceMapRef.current?.flyTo(lat!, lng!, 14);
                          }
                        }}
                        style={{
                          border:
                            traceRowFocus === idx
                              ? '1px solid var(--accent)'
                              : idx === 0
                                ? '1px solid #c9efd8'
                                : '1px solid var(--border)',
                          background: 'var(--surface)',
                          borderRadius: 10,
                          padding: '0.65rem 0.7rem',
                          cursor: hasCoord ? 'pointer' : 'default',
                          outline: 'none',
                        }}
                      >
                        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '0.2rem' }}>{row.time || '-'}</div>
                        <div style={{ fontSize: '0.87rem', lineHeight: 1.45, color: '#fff' }}>{row.context || '-'}</div>
                        {row.areaName ? <div style={{ marginTop: '0.2rem', color: 'rgba(255,255,255,0.75)', fontSize: '0.78rem' }}>{row.areaName}</div> : null}
                      </div>
                    );
                    })
                  )}
                </div>
              </div>
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
