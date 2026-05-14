import type { OrderRow } from '../api/admin';

type Xlsx = typeof import('xlsx');

function pickStr(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

/** 订单行 JSON → 销售单行（尽量兼容多种字段名） */
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

/**
 * 按「销售单」样式追加一张工作表（与示例图字段对齐）
 */
export function appendSalesSlipSheet(XLSX: Xlsx, wb: import('xlsx').WorkBook, order: OrderRow, sheetIndex: number) {
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

  const rows: (string | number)[][] = [
    ['销售单'],
    ['状态', '未审核'],
    ['客户', customerLabel(order)],
    ['制单人', '管理员'],
    ['单据编号', order.orderNo],
    ['仓库', '电商配送中心'],
    ['备注', ''],
    ['制单日期', order.createdAt || ''],
    [],
    ['序号', '国际条码', '商品名称', '规格', '单位', '销售数量', '单价', '金额', '备注'],
  ];

  for (const L of lines) {
    rows.push([
      L.idx,
      L.barcode,
      L.title,
      L.spec,
      L.unit,
      L.qty,
      Number(L.unitPriceYuan.toFixed(2)),
      Number(L.lineAmountYuan.toFixed(2)),
      L.remark,
    ]);
  }

  if (!lines.length) {
    rows.push([1, '-', '（无明细）', '—', '件', 1, Number((order.paymentAmount / 100).toFixed(2)), Number((order.paymentAmount / 100).toFixed(2)), '']);
  }

  rows.push(['合计', '', '', '', '', sumQty, '', Number(sumAmount.toFixed(2)), '']);
  rows.push([]);
  rows.push(['页码', `第1/1页`]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const colWidths = [{ wch: 6 }, { wch: 16 }, { wch: 28 }, { wch: 18 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
  (ws as { '!cols'?: { wch: number }[] })['!cols'] = colWidths;
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(order.orderNo, sheetIndex));
}

export async function exportOrdersAsSalesSlips(XLSX: Xlsx, orders: OrderRow[], filePrefix = '销售单导出') {
  const wb = XLSX.utils.book_new();
  let i = 0;
  for (const o of orders) {
    appendSalesSlipSheet(XLSX, wb, o, i++);
  }
  if (!orders.length) {
    const ws = XLSX.utils.aoa_to_sheet([['无订单数据']]);
    XLSX.utils.book_append_sheet(wb, ws, 'empty');
  }
  const name = `${filePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, name);
}
