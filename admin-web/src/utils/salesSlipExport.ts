import * as XLSX from 'xlsx-js-style';
import type { OrderRow } from '../api/admin';

function pickStr(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

const RGB_BORDER = 'FF000000';
const thin = { style: 'thin' as const, color: { rgb: RGB_BORDER } };
const borderAll = {
  top: thin,
  bottom: thin,
  left: thin,
  right: thin,
};

function cell(
  v: string | number | null | undefined,
  opts: {
    t?: 's' | 'n';
    bold?: boolean;
    sz?: number;
    align?: 'left' | 'center' | 'right';
    valign?: 'top' | 'center' | 'bottom';
    numFmt?: string;
    fill?: { fgColor: { rgb: string } };
    border?: boolean;
  } = {},
): XLSX.CellObject {
  const t = opts.t ?? (typeof v === 'number' ? 'n' : 's');
  const style: Record<string, unknown> = {
    font: { name: '宋体', sz: opts.sz ?? 11, bold: opts.bold ?? false },
    alignment: {
      horizontal: opts.align ?? (t === 'n' ? 'right' : 'left'),
      vertical: opts.valign ?? 'center',
      wrapText: true,
    },
  };
  if (opts.border !== false) {
    style.border = borderAll;
  }
  if (opts.fill) {
    style.fill = { patternType: 'solid', fgColor: opts.fill.fgColor };
  }
  const o: XLSX.CellObject = {
    v: v == null ? '' : v,
    t,
    s: style as XLSX.CellObject['s'],
  };
  if (opts.numFmt && t === 'n') {
    o.z = opts.numFmt;
  }
  return o;
}

function setCell(ws: XLSX.WorkSheet, r: number, c: number, co: XLSX.CellObject) {
  const addr = XLSX.utils.encode_cell({ r, c });
  (ws as Record<string, XLSX.CellObject>)[addr] = co;
}

function normalizeOrderLines(items: unknown): Array<{
  idx: number;
  barcode: string;
  title: string;
  spec: string;
  unit: string;
  qty: number;
  unitPriceYuan: number;
  lineAmountYuan: number;
  remark: string;
}> {
  const arr = Array.isArray(items) ? items : [];
  return arr.map((raw: Record<string, unknown>, i: number) => {
    const title = pickStr(raw.goodsName ?? raw.title ?? raw.name ?? '商品');
    const qty = Math.max(1, Number(raw.quantity ?? raw.buyQuantity ?? 1) || 1);
    const unit = pickStr(raw.unit ?? raw.unitName) || '件';
    const barcode =
      pickStr(raw.barCode ?? raw.barcode ?? raw.ean ?? raw.upc ?? raw.gtin) ||
      (raw.spuId != null ? `SPU${pickStr(raw.spuId)}` : '') ||
      '-';
    const specParts: string[] = [];
    if (Array.isArray(raw.specifications)) {
      for (const s of raw.specifications as unknown[]) {
        if (s && typeof s === 'object') {
          const o = s as Record<string, unknown>;
          const pv = pickStr(o.specValue ?? o.value ?? o.name);
          if (pv) specParts.push(pv);
        }
      }
    }
    const spec =
      specParts.length > 0
        ? specParts.join(' ')
        : pickStr(raw.spec ?? raw.skuSpec ?? raw.specText ?? raw.skuName);
    let unitPriceYuan = Number(raw.price ?? raw.actualPrice ?? raw.settlePrice ?? raw.payPrice ?? 0);
    if (!Number.isFinite(unitPriceYuan)) unitPriceYuan = 0;
    let lineAmountYuan = unitPriceYuan * qty;
    if (unitPriceYuan <= 0 && Number.isFinite(Number(raw.lineAmount))) {
      lineAmountYuan = Number(raw.lineAmount);
      unitPriceYuan = qty > 0 ? lineAmountYuan / qty : 0;
    }
    return {
      idx: i + 1,
      barcode,
      title,
      spec: spec || '—',
      unit,
      qty,
      unitPriceYuan,
      lineAmountYuan,
      remark: pickStr(raw.remark ?? raw.note),
    };
  });
}

function customerLabel(order: OrderRow): string {
  const id = String(order.userId ?? '').padStart(10, '0');
  const name = pickStr(order.nickName) || pickStr(order.phoneNumber) || '客户';
  return `[${id}]${name}`;
}

function safeSheetName(orderNo: string, index: number): string {
  const base = pickStr(orderNo) || `ORDER${index}`;
  const combined = `${base}_${index + 1}`;
  return combined.replace(/[[\]:*?/\\]/g, '-').slice(0, 31);
}

/** 单据编号：与示例一致可用 SI 前缀；若已是长单号则保持 */
function documentNo(orderNo: string): string {
  const s = pickStr(orderNo);
  if (!s) return '';
  if (/^SI/i.test(s)) return s;
  return `SI${s}`;
}

/**
 * 销售单：版式与示例图一致（标题行、未审核、两行抬头、九列表格、合计、页码），带边框与合并单元格。
 */
export function buildSalesSlipWorksheet(order: OrderRow): XLSX.WorkSheet {
  const lines = normalizeOrderLines(order.items);
  let sumQty = 0;
  let sumAmount = 0;
  for (const L of lines) {
    sumQty += L.qty;
    sumAmount += L.lineAmountYuan;
  }
  if (lines.length === 0) {
    sumQty = 0;
    sumAmount = order.paymentAmount / 100;
  } else if (sumAmount < 1e-6 && order.paymentAmount > 0) {
    sumAmount = order.paymentAmount / 100;
  }

  const ws: XLSX.WorkSheet = {};
  const merges: XLSX.Range[] = [];

  // r0 标题：销售单（左大合并）+ 未审核（右）
  setCell(ws, 0, 0, cell('销售单', { bold: true, sz: 16, align: 'center', border: true }));
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } });
  setCell(ws, 0, 7, cell('未审核', { align: 'center', border: true, fill: { fgColor: { rgb: 'FFF5F5F5' } } }));
  merges.push({ s: { r: 0, c: 7 }, e: { r: 0, c: 8 } });

  // r1 第一行抬头：客户 | 值 | 制单人 | 值 | 单据编号 | 值(跨3列)
  setCell(ws, 1, 0, cell('客户', { bold: true, border: true }));
  setCell(ws, 1, 1, cell(customerLabel(order), { border: true }));
  merges.push({ s: { r: 1, c: 1 }, e: { r: 1, c: 2 } });
  setCell(ws, 1, 3, cell('制单人', { bold: true, border: true }));
  setCell(ws, 1, 4, cell('[5002]5002', { border: true }));
  setCell(ws, 1, 5, cell('单据编号', { bold: true, border: true }));
  setCell(ws, 1, 6, cell(documentNo(order.orderNo), { border: true }));
  merges.push({ s: { r: 1, c: 6 }, e: { r: 1, c: 8 } });

  // r2 第二行抬头：仓库 | 值 | 备注 | 值 | 制单日期 | 值
  setCell(ws, 2, 0, cell('仓库', { bold: true, border: true }));
  setCell(ws, 2, 1, cell('[2401]津维配送中心', { border: true }));
  merges.push({ s: { r: 2, c: 1 }, e: { r: 2, c: 2 } });
  setCell(ws, 2, 3, cell('备注', { bold: true, border: true }));
  const remarkText = `由小程序订单:${order.orderNo}生成`;
  setCell(ws, 2, 4, cell(remarkText, { border: true }));
  merges.push({ s: { r: 2, c: 4 }, e: { r: 2, c: 6 } });
  setCell(ws, 2, 7, cell('制单日期', { bold: true, border: true }));
  setCell(ws, 2, 8, cell(order.createdAt || '', { border: true }));

  const headerRow = 4;
  const headers = ['序号', '国际条码', '商品名称', '规格', '单位', '销售数量', '单价', '金额', '备注'];
  headers.forEach((h, c) => {
    setCell(ws, headerRow, c, cell(h, { bold: true, align: 'center', border: true, fill: { fgColor: { rgb: 'FFE8E8E8' } } }));
  });

  let r = headerRow + 1;
  if (lines.length === 0) {
    setCell(ws, r, 0, cell(1, { t: 'n', border: true, align: 'center' }));
    setCell(ws, r, 1, cell('-', { border: true }));
    setCell(ws, r, 2, cell('（无明细）', { border: true }));
    setCell(ws, r, 3, cell('—', { border: true }));
    setCell(ws, r, 4, cell('件', { border: true, align: 'center' }));
    setCell(ws, r, 5, cell(1, { t: 'n', border: true, align: 'right' }));
    const py = Number((order.paymentAmount / 100).toFixed(2));
    setCell(ws, r, 6, cell(py, { t: 'n', border: true, align: 'right', numFmt: '0.00' }));
    setCell(ws, r, 7, cell(py, { t: 'n', border: true, align: 'right', numFmt: '0.00' }));
    setCell(ws, r, 8, cell('', { border: true }));
    r += 1;
  } else {
    for (const L of lines) {
      setCell(ws, r, 0, cell(L.idx, { t: 'n', border: true, align: 'center' }));
      setCell(ws, r, 1, cell(L.barcode, { border: true, align: 'left' }));
      setCell(ws, r, 2, cell(L.title, { border: true, align: 'left' }));
      setCell(ws, r, 3, cell(L.spec, { border: true, align: 'left' }));
      setCell(ws, r, 4, cell(L.unit, { border: true, align: 'center' }));
      setCell(ws, r, 5, cell(L.qty, { t: 'n', border: true, align: 'right' }));
      setCell(ws, r, 6, cell(Number(L.unitPriceYuan.toFixed(2)), { t: 'n', border: true, align: 'right', numFmt: '0.00' }));
      setCell(ws, r, 7, cell(Number(L.lineAmountYuan.toFixed(2)), { t: 'n', border: true, align: 'right', numFmt: '0.00' }));
      setCell(ws, r, 8, cell(L.remark, { border: true, align: 'left' }));
      r += 1;
    }
  }

  // 合计行：合并 A~E 显示「合计」，数量列、金额列
  const totalRow = r;
  setCell(ws, totalRow, 0, cell('合计', { bold: true, align: 'center', border: true }));
  merges.push({ s: { r: totalRow, c: 0 }, e: { r: totalRow, c: 4 } });
  setCell(ws, totalRow, 5, cell(sumQty, { t: 'n', bold: true, border: true, align: 'right' }));
  setCell(ws, totalRow, 6, cell('', { border: true }));
  setCell(ws, totalRow, 7, cell(Number(sumAmount.toFixed(2)), { t: 'n', bold: true, border: true, align: 'right', numFmt: '0.00' }));
  setCell(ws, totalRow, 8, cell('', { border: true }));

  const pageRow = totalRow + 1;
  for (let c = 0; c < 7; c++) {
    setCell(ws, pageRow, c, cell('', { border: false }));
  }
  setCell(ws, pageRow, 7, cell('页码 : 第1/1页', { align: 'right', border: false }));
  merges.push({ s: { r: pageRow, c: 7 }, e: { r: pageRow, c: 8 } });
  setCell(ws, pageRow, 8, cell('', { border: false }));

  (ws as { '!merges'?: XLSX.Range[] })['!merges'] = merges;
  (ws as { '!cols'?: { wch: number }[] })['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 28 },
    { wch: 18 },
    { wch: 8 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
  ];
  (ws as { '!rows'?: { hpt?: number }[] })['!rows'] = [{ hpt: 22 }];
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: pageRow, c: 8 },
  });

  return ws;
}

/** 向已有工作簿追加一张销售单工作表（与 exportOrdersAsSalesSlips 使用相同版式） */
export function appendSalesSlipSheet(wb: XLSX.WorkBook, order: OrderRow, sheetIndex: number) {
  const ws = buildSalesSlipWorksheet(order);
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(order.orderNo, sheetIndex));
}

export function exportOrdersAsSalesSlips(orders: OrderRow[], filePrefix = '销售单导出') {
  const wb = XLSX.utils.book_new();
  let i = 0;
  for (const o of orders) {
    const ws = buildSalesSlipWorksheet(o);
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(o.orderNo, i++));
  }
  if (!orders.length) {
    const ws = XLSX.utils.aoa_to_sheet([['无订单数据']]);
    XLSX.utils.book_append_sheet(wb, ws, 'empty');
  }
  const name = `${filePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, name);
}
