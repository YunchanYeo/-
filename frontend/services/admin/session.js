import { config } from '../../config/runtime';
import { wxRequestTransportOpts } from '../_utils/wxRequestTransport';
const ADMIN_TOKEN_KEY = 'admin.token';
const ADMIN_USER_KEY = 'admin.user';
function requestAdmin(path, { method = 'GET', data, token = '' } = {}) {
    return new Promise((resolve, reject) => {
        wx.request({
            ...wxRequestTransportOpts,
            url: `${config.apiBaseUrl}${path}`,
            method,
            data,
            timeout: 10000,
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
export function getAdminToken() {
    return wx.getStorageSync(ADMIN_TOKEN_KEY) || '';
}
export function getAdminUser() {
    return wx.getStorageSync(ADMIN_USER_KEY) || null;
}
export function clearAdminSession() {
    wx.removeStorageSync(ADMIN_TOKEN_KEY);
    wx.removeStorageSync(ADMIN_USER_KEY);
}
export async function adminLogin(username, password) {
    const data = await requestAdmin('/api/admin/login', {
        method: 'POST',
        data: { username, password },
    });
    wx.setStorageSync(ADMIN_TOKEN_KEY, data.token || '');
    wx.setStorageSync(ADMIN_USER_KEY, data.admin || null);
    return data;
}
