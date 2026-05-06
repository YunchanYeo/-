import { config } from '../../config/index';
import { requestJson } from '../_utils/http';

function formatDate(ts) {
    const n = Number(ts || 0);
    if (!Number.isFinite(n) || n <= 0)
        return '';
    const d = new Date(n);
    if (Number.isNaN(d.getTime()))
        return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function normalizeCouponRow(row) {
    const id = Number(row?.id || 0);
    const couponId = Number(row?.couponId || row?.id || 0);
    const type = row?.type === 'discount' || Number(row?.type) === 1 ? 2 : 1; // ui-coupon-card: 1=满减,2=折扣
    const value = Number(row?.value || 0);
    const base = Number(row?.base || 0);
    const start = Number(row?.startTime || 0);
    const end = Number(row?.endTime || 0);
    const timeLimit = start && end ? `${formatDate(start)}-${formatDate(end)}` : '';
    const statusRaw = String(row?.status || 'default');
    const status = statusRaw === 'useless' || statusRaw === 'disabled' ? statusRaw : 'default';
    const desc = type === 1
        ? `满${base > 0 ? base / 100 : 0}元减${value / 100}元`
        : `${value / 10}折${base > 0 ? `（满${base / 100}元可用）` : ''}`;
    return {
        ...row,
        id,
        key: id,
        couponId,
        title: row?.title || row?.name || '优惠券',
        type,
        value: String(type === 1 ? (value / 100).toFixed(2) : value / 10),
        desc: row?.desc || desc,
        timeLimit,
        currency: '¥',
        status,
    };
}
function mockFetchCoupon(status) {
    const { delay } = require('../_utils/delay');
    const { getCouponList } = require('../../model/coupon');
    return delay().then(() => getCouponList(status));
}
export function fetchCouponList(status = 'default') {
    if (config.useMock)
        return mockFetchCoupon(status);
    return requestJson(`/api/coupons?status=${encodeURIComponent(status)}`, { method: 'GET' })
        .then((rows) => (Array.isArray(rows) ? rows.map(normalizeCouponRow) : []));
}
function mockFetchCouponDetail(id, status) {
    const { delay } = require('../_utils/delay');
    const { getCoupon } = require('../../model/coupon');
    const { genAddressList } = require('../../model/address');
    return delay().then(() => {
        const result = { detail: getCoupon(id, status), storeInfoList: genAddressList() };
        result.detail.useNotes = `1个订单限用1张，除运费券外，不能与其它类型的优惠券叠加使用（运费券除外）\n2.仅适用于各区域正常售卖商品，不支持团购、抢购、预售类商品`;
        result.detail.storeAdapt = `商城通用`;
        if (result.detail.type === 'price') {
            result.detail.desc = `减免 ${result.detail.value / 100} 元`;
            if (result.detail.base)
                result.detail.desc += `，满${result.detail.base / 100}元可用`;
            result.detail.desc += '。';
        }
        else if (result.detail.type === 'discount') {
            result.detail.desc = `${result.detail.value}折`;
            if (result.detail.base)
                result.detail.desc += `，满${result.detail.base / 100}元可用`;
            result.detail.desc += '。';
        }
        return result;
    });
}
export function fetchCouponDetail(id, status = 'default') {
    if (config.useMock)
        return mockFetchCouponDetail(id, status);
    return requestJson(`/api/coupons/${id}`, { method: 'GET' }).then((res) => {
        const detail = normalizeCouponRow(res?.detail || {});
        const withDetail = {
            ...res,
            detail: {
                ...detail,
                useNotes: detail.useNotes ||
                    '1个订单限用1张，除运费券外，不能与其它类型的优惠券叠加使用（运费券除外）',
                storeAdapt: detail.storeAdapt || '商城通用',
            },
        };
        return withDetail;
    });
}
