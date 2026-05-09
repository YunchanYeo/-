import { config } from '../../config/index';
import { wxRequestTransportOpts } from '../_utils/wxRequestTransport';
import { getAdminToken } from './session';
function requestAdminJson(path, { method = 'GET', data, timeout = 10000 } = {}) {
    const token = getAdminToken();
    return new Promise((resolve, reject) => {
        wx.request({
            ...wxRequestTransportOpts,
            url: `${config.apiBaseUrl}${path}`,
            method,
            data,
            timeout,
            header: {
                'content-type': 'application/json',
                ...(token ? { 'x-admin-token': token } : {}),
            },
            success(res) {
                if (res.statusCode < 200 || res.statusCode >= 300)
                    return reject(new Error(res.data?.message || `HTTP ${res.statusCode}`));
                if (!res.data?.ok)
                    return reject(new Error(res.data?.message || 'Admin API failed'));
                return resolve(res.data.data);
            },
            fail(err) {
                reject(new Error(err?.errMsg || err?.message || '请求失败'));
            },
        });
    });
}
export const fetchAdminOrders = () =>
    requestAdminJson('/api/admin/orders', { method: 'GET', timeout: 60000 });
export const updateAdminOrderShipping = (orderNo, payload) => requestAdminJson(`/api/admin/orders/${orderNo}/shipping`, { method: 'POST', data: payload });
export const updateAdminOrderStatus = (orderNo, payload) => requestAdminJson(`/api/admin/orders/${encodeURIComponent(orderNo)}/status`, { method: 'PUT', data: payload });
export const deleteAdminOrder = (orderNo) => requestAdminJson(`/api/admin/orders/${encodeURIComponent(orderNo)}`, { method: 'DELETE' });
export const fetchAdminLogisticsTrace = (orderNo) => requestAdminJson(`/api/admin/orders/${encodeURIComponent(orderNo)}/logistics-trace`, {
    method: 'GET',
    timeout: 25000,
});
export const fetchAdminProducts = () =>
    requestAdminJson('/api/admin/products', { method: 'GET', timeout: 60000 });
export const createAdminProduct = (payload) => requestAdminJson('/api/admin/products', { method: 'POST', data: payload });
export const uploadAdminImage = ({ fileName, mimeType, base64Data }) =>
    requestAdminJson('/api/admin/upload-image', {
        method: 'POST',
        data: { fileName, mimeType, base64Data },
        timeout: 120000,
    });
export const fetchAdminMe = () => requestAdminJson('/api/admin/me', { method: 'GET' });
export const updateAdminPassword = ({ currentPassword, newPassword }) => requestAdminJson('/api/admin/me/password', { method: 'PUT', data: { currentPassword, newPassword } });
export const updateAdminUsername = ({ currentPassword, newUsername }) => requestAdminJson('/api/admin/me/username', { method: 'PUT', data: { currentPassword, newUsername } });
export const fetchAdminPointPolicy = () => requestAdminJson('/api/admin/point-policy', { method: 'GET' });
export const updateAdminPointPolicy = (payload) => requestAdminJson('/api/admin/point-policy', { method: 'PUT', data: payload });
export const fetchAdminProduct = (productId) => requestAdminJson(`/api/admin/products/${productId}`, { method: 'GET' });
export const updateAdminProduct = (productId, payload) => requestAdminJson(`/api/admin/products/${productId}`, { method: 'PUT', data: payload });
export const deleteAdminProduct = (productId) => requestAdminJson(`/api/admin/products/${productId}`, { method: 'DELETE' });
export const updateAdminProductStock = (productId, stock) => requestAdminJson(`/api/admin/products/${productId}/stock`, { method: 'PUT', data: { stock: Number(stock) } });

export const fetchAdminCategories = () => requestAdminJson('/api/admin/categories', { method: 'GET' });
export const createAdminCategory = (payload) => requestAdminJson('/api/admin/categories', { method: 'POST', data: payload });
export const updateAdminCategory = (id, payload) => requestAdminJson(`/api/admin/categories/${id}`, { method: 'PUT', data: payload });
export const deleteAdminCategory = (id) => requestAdminJson(`/api/admin/categories/${id}`, { method: 'DELETE' });
export const fetchAdminCoupons = () => requestAdminJson('/api/admin/coupons', { method: 'GET' });
export const createAdminCoupon = (payload) => requestAdminJson('/api/admin/coupons', { method: 'POST', data: payload });
export const grantAdminCoupon = (id, payload = { grantAllUsers: true }) => requestAdminJson(`/api/admin/coupons/${id}/grant`, { method: 'POST', data: payload });
export const updateAdminCoupon = (id, payload) => requestAdminJson(`/api/admin/coupons/${id}`, { method: 'PUT', data: payload });
export const deleteAdminCoupon = (id) => requestAdminJson(`/api/admin/coupons/${id}`, { method: 'DELETE' });
