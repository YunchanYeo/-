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

const COL_LAST = 8;

function applySheetLayout(ws: XLSX.WorkSheet, lastRow: number) {
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
    e: { r: lastRow, c: COL_LAST },
  });
}

/**
 * 在 `baseRow` 起笔写入一张销售单（标题「销售单」水平垂直居中；表内九列均为默认细线框）。
 * 返回合并区域与占用到的最后一行行号（含页码行）。
 */
function writeSalesSlipBlock(
  ws: XLSX.WorkSheet,
  baseRow: number,
  order: OrderRow,
): { merges: XLSX.Range[]; lastRow: number } {
  const B = baseRow;
  const merges: XLSX.Range[] = [];

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

  // r0 标题：销售单（合并区水平垂直居中）+ 未审核
  setCell(
    ws,
    B + 0,
    0,
    cell('销售单', { bold: true, sz: 16, align: 'center', valign: 'center', border: true }),
  );
  merges.push({ s: { r: B + 0, c: 0 }, e: { r: B + 0, c: 6 } });
  setCell(
    ws,
    B + 0,
    7,
    cell('未审核', { align: 'center', valign: 'center', border: true, fill: { fgColor: { rgb: 'FFF5F5F5' } } }),
  );
  merges.push({ s: { r: B + 0, c: 7 }, e: { r: B + 0, c: 8 } });

  setCell(ws, B + 1, 0, cell('客户', { bold: true, border: true, align: 'center', valign: 'center' }));
  setCell(ws, B + 1, 1, cell(customerLabel(order), { border: true, valign: 'center' }));
  merges.push({ s: { r: B + 1, c: 1 }, e: { r: B + 1, c: 2 } });
  setCell(ws, B + 1, 3, cell('制单人', { bold: true, border: true, align: 'center', valign: 'center' }));
  setCell(ws, B + 1, 4, cell('[5002]5002', { border: true, valign: 'center' }));
  setCell(ws, B + 1, 5, cell('单据编号', { bold: true, border: true, align: 'center', valign: 'center' }));
  setCell(ws, B + 1, 6, cell(documentNo(order.orderNo), { border: true, valign: 'center' }));
  merges.push({ s: { r: B + 1, c: 6 }, e: { r: B + 1, c: 8 } });

  setCell(ws, B + 2, 0, cell('仓库', { bold: true, border: true, align: 'center', valign: 'center' }));
  setCell(ws, B + 2, 1, cell('[2401]津维配送中心', { border: true, valign: 'center' }));
  merges.push({ s: { r: B + 2, c: 1 }, e: { r: B + 2, c: 2 } });
  setCell(ws, B + 2, 3, cell('备注', { bold: true, border: true, align: 'center', valign: 'center' }));
  const remarkText = `由小程序订单:${order.orderNo}生成`;
  setCell(ws, B + 2, 4, cell(remarkText, { border: true, valign: 'center' }));
  merges.push({ s: { r: B + 2, c: 4 }, e: { r: B + 2, c: 6 } });
  setCell(ws, B + 2, 7, cell('制单日期', { bold: true, border: true, align: 'center', valign: 'center' }));
  setCell(ws, B + 2, 8, cell(order.createdAt || '', { border: true, valign: 'center' }));

  // 空行：九列全部带边框（与表一体）
  for (let c = 0; c <= COL_LAST; c++) {
    setCell(ws, B + 3, c, cell('', { border: true, align: 'center', valign: 'center' }));
  }

  const headerRow = B + 4;
  const headers = ['序号', '国际条码', '商品名称', '规格', '单位', '销售数量', '单价', '金额', '备注'];
  headers.forEach((h, c) => {
    setCell(ws, headerRow, c, cell(h, { bold: true, align: 'center', valign: 'center', border: true, fill: { fgColor: { rgb: 'FFE8E8E8' } } }));
  });

  let r = headerRow + 1;
  if (lines.length === 0) {
    setCell(ws, r, 0, cell(1, { t: 'n', border: true, align: 'center', valign: 'center' }));
    setCell(ws, r, 1, cell('-', { border: true, valign: 'center' }));
    setCell(ws, r, 2, cell('（无明细）', { border: true, valign: 'center' }));
    setCell(ws, r, 3, cell('—', { border: true, valign: 'center' }));
    setCell(ws, r, 4, cell('件', { border: true, align: 'center', valign: 'center' }));
    setCell(ws, r, 5, cell(1, { t: 'n', border: true, align: 'right', valign: 'center' }));
    const py = Number((order.paymentAmount / 100).toFixed(2));
    setCell(ws, r, 6, cell(py, { t: 'n', border: true, align: 'right', valign: 'center', numFmt: '0.00' }));
    setCell(ws, r, 7, cell(py, { t: 'n', border: true, align: 'right', valign: 'center', numFmt: '0.00' }));
    setCell(ws, r, 8, cell('', { border: true, valign: 'center' }));
    r += 1;
  } else {
    for (const L of lines) {
      setCell(ws, r, 0, cell(L.idx, { t: 'n', border: true, align: 'center', valign: 'center' }));
      setCell(ws, r, 1, cell(L.barcode, { border: true, align: 'left', valign: 'center' }));
      setCell(ws, r, 2, cell(L.title, { border: true, align: 'left', valign: 'center' }));
      setCell(ws, r, 3, cell(L.spec, { border: true, align: 'left', valign: 'center' }));
      setCell(ws, r, 4, cell(L.unit, { border: true, align: 'center', valign: 'center' }));
      setCell(ws, r, 5, cell(L.qty, { t: 'n', border: true, align: 'right', valign: 'center' }));
      setCell(ws, r, 6, cell(Number(L.unitPriceYuan.toFixed(2)), { t: 'n', border: true, align: 'right', valign: 'center', numFmt: '0.00' }));
      setCell(ws, r, 7, cell(Number(L.lineAmountYuan.toFixed(2)), { t: 'n', border: true, align: 'right', valign: 'center', numFmt: '0.00' }));
      setCell(ws, r, 8, cell(L.remark, { border: true, align: 'left', valign: 'center' }));
      r += 1;
    }
  }

  const totalRow = r;
  setCell(ws, totalRow, 0, cell('合计', { bold: true, align: 'center', valign: 'center', border: true }));
  merges.push({ s: { r: totalRow, c: 0 }, e: { r: totalRow, c: 4 } });
  setCell(ws, totalRow, 5, cell(sumQty, { t: 'n', bold: true, border: true, align: 'right', valign: 'center' }));
  setCell(ws, totalRow, 6, cell('', { border: true, valign: 'center' }));
  setCell(ws, totalRow, 7, cell(Number(sumAmount.toFixed(2)), { t: 'n', bold: true, border: true, align: 'right', valign: 'center', numFmt: '0.00' }));
  setCell(ws, totalRow, 8, cell('', { border: true, valign: 'center' }));

  const pageRow = totalRow + 1;
  for (let c = 0; c < 7; c++) {
    setCell(ws, pageRow, c, cell('', { border: true, valign: 'center' }));
  }
  setCell(ws, pageRow, 7, cell('页码 : 第1/1页', { align: 'right', valign: 'center', border: true }));
  merges.push({ s: { r: pageRow, c: 7 }, e: { r: pageRow, c: 8 } });
  setCell(ws, pageRow, 8, cell('', { border: true, valign: 'center' }));

  return { merges, lastRow: pageRow };
}

/**
 * 单张工作表上的一张销售单（兼容旧逻辑：单订单单表时仍可用）。
 */
export function buildSalesSlipWorksheet(order: OrderRow): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const { merges, lastRow } = writeSalesSlipBlock(ws, 0, order);
  (ws as { '!merges'?: XLSX.Range[] })['!merges'] = merges;
  applySheetLayout(ws, lastRow);
  return ws;
}

/** 向已有工作簿追加一张销售单工作表 */
export function appendSalesSlipSheet(wb: XLSX.WorkBook, order: OrderRow, sheetIndex: number) {
  const ws = buildSalesSlipWorksheet(order);
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(order.orderNo, sheetIndex));
}

/** 多订单同一工作表：每个销售单之间插入 N 个完整空行（九列全细线边框） */
const BLANK_ROWS_BETWEEN_SALES_SLIPS = 2;

export function exportOrdersAsSalesSlips(orders: OrderRow[], filePrefix = '销售单导出') {
  const wb = XLSX.utils.book_new();
  if (!orders.length) {
    const ws = XLSX.utils.aoa_to_sheet([['无订单数据']]);
    XLSX.utils.book_append_sheet(wb, ws, 'empty');
    const name = `${filePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, name);
    return;
  }

  const ws: XLSX.WorkSheet = {};
  const allMerges: XLSX.Range[] = [];
  let baseRow = 0;
  let lastRow = 0;

  for (let i = 0; i < orders.length; i++) {
    const { merges, lastRow: blockEnd } = writeSalesSlipBlock(ws, baseRow, orders[i]);
    allMerges.push(...merges);
    lastRow = blockEnd;
    if (i < orders.length - 1) {
      const gapStart = blockEnd + 1;
      for (let g = 0; g < BLANK_ROWS_BETWEEN_SALES_SLIPS; g++) {
        for (let c = 0; c <= COL_LAST; c++) {
          setCell(ws, gapStart + g, c, cell('', { border: true, valign: 'center' }));
        }
      }
      baseRow = gapStart + BLANK_ROWS_BETWEEN_SALES_SLIPS;
    }
  }

  (ws as { '!merges'?: XLSX.Range[] })['!merges'] = allMerges;
  applySheetLayout(ws, lastRow);
  XLSX.utils.book_append_sheet(wb, ws, '销售单');
  const name = `${filePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, name);
}
