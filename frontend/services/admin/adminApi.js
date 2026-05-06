import { config } from '../../config/index';
import { getAdminToken } from './session';
function requestAdminJson(path, { method = 'GET', data, timeout = 10000 } = {}) {
    const token = getAdminToken();
    return new Promise((resolve, reject) => {
        wx.request({
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
                reject(err);
            },
        });
    });
}
export const fetchAdminOrders = () => requestAdminJson('/api/admin/orders', { method: 'GET' });
export const updateAdminOrderShipping = (orderNo, payload) => requestAdminJson(`/api/admin/orders/${orderNo}/shipping`, { method: 'POST', data: payload });
export const fetchAdminLogisticsTrace = (orderNo) => requestAdminJson(`/api/admin/orders/${encodeURIComponent(orderNo)}/logistics-trace`, {
    method: 'GET',
    timeout: 25000,
});
export const fetchAdminProducts = () => requestAdminJson('/api/admin/products', { method: 'GET' });
export const createAdminProduct = (payload) => requestAdminJson('/api/admin/products', { method: 'POST', data: payload });
export const uploadAdminImage = ({ fileName, mimeType, base64Data }) => requestAdminJson('/api/admin/upload-image', { method: 'POST', data: { fileName, mimeType, base64Data } });
export const fetchAdminMe = () => requestAdminJson('/api/admin/me', { method: 'GET' });
export const updateAdminPassword = ({ currentPassword, newPassword }) => requestAdminJson('/api/admin/me/password', { method: 'PUT', data: { currentPassword, newPassword } });
export const updateAdminUsername = ({ currentPassword, newUsername }) => requestAdminJson('/api/admin/me/username', { method: 'PUT', data: { currentPassword, newUsername } });
export const fetchAdminProduct = (productId) => requestAdminJson(`/api/admin/products/${productId}`, { method: 'GET' });
export const updateAdminProduct = (productId, payload) => requestAdminJson(`/api/admin/products/${productId}`, { method: 'PUT', data: payload });
export const updateAdminProductStock = (productId, stock) => requestAdminJson(`/api/admin/products/${productId}/stock`, { method: 'PUT', data: { stock: Number(stock) } });

export const fetchAdminCategories = () => requestAdminJson('/api/admin/categories', { method: 'GET' });
export const createAdminCategory = (payload) => requestAdminJson('/api/admin/categories', { method: 'POST', data: payload });
export const updateAdminCategory = (id, payload) => requestAdminJson(`/api/admin/categories/${id}`, { method: 'PUT', data: payload });
export const deleteAdminCategory = (id) => requestAdminJson(`/api/admin/categories/${id}`, { method: 'DELETE' });
