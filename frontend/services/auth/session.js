import { config } from '../../config/runtime';
import { wxRequestTransportOpts } from '../_utils/wxRequestTransport';
const TOKEN_KEY = 'auth.token';
const USER_KEY = 'auth.user';
const PREFETCH_ME_KEY = 'prefetch.me';
const PREFETCH_ADDRESSES_KEY = 'prefetch.addresses';
const PREFETCH_ORDERS_KEY = 'prefetch.orders';
const PREFETCH_ORDER_COUNTS_KEY = 'prefetch.order.counts';
const PREFETCH_SUPPORT_MESSAGES_KEY = 'prefetch.support.messages';
export const getToken = () => wx.getStorageSync(TOKEN_KEY) || '';
export const setToken = (token) => wx.setStorageSync(TOKEN_KEY, token || '');
export const clearToken = () => wx.removeStorageSync(TOKEN_KEY);
export const getUser = () => wx.getStorageSync(USER_KEY) || null;
export const setUser = (user) => wx.setStorageSync(USER_KEY, user || null);
export const clearUser = () => wx.removeStorageSync(USER_KEY);
export function logout() {
    clearToken();
    clearUser();
    wx.removeStorageSync(PREFETCH_ME_KEY);
    wx.removeStorageSync(PREFETCH_ADDRESSES_KEY);
    wx.removeStorageSync(PREFETCH_ORDERS_KEY);
    wx.removeStorageSync(PREFETCH_ORDER_COUNTS_KEY);
    wx.removeStorageSync(PREFETCH_SUPPORT_MESSAGES_KEY);
}
function requestAuth(path, { method = 'GET', data, token = '' } = {}) {
    return new Promise((resolve, reject) => {
        wx.request({
            ...wxRequestTransportOpts,
            url: `${config.apiBaseUrl}${path}`,
            method,
            data,
            timeout: 10000,
            header: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            success(res) {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    const msg = res.data?.message || res.data?.errmsg || '';
                    return reject(new Error(msg ? `${msg}` : `HTTP ${res.statusCode}`));
                }
                if (!res.data?.ok)
                    return reject(new Error(res.data?.message || 'Auth API failed'));
                return resolve(res.data.data);
            },
            fail(err) {
                reject(err);
            },
        });
    });
}
async function trySyncWeChatProfileSilently(token) {
    if (!token)
        return;
    try {
        const profileRes = await new Promise((resolve, reject) => {
            wx.getUserInfo({ withCredentials: false, lang: 'zh_CN', success: resolve, fail: reject });
        });
        const userInfo = profileRes?.userInfo || {};
        if (!userInfo.nickName && !userInfo.avatarUrl)
            return;
        const me = await requestAuth('/api/me', {
            method: 'PUT',
            data: { nickName: userInfo.nickName || '', avatarUrl: userInfo.avatarUrl || '', gender: Number(userInfo.gender || 0) },
            token,
        });
        setUser(me);
    }
    catch (e) { }
}
async function prefetchUserBootstrapData(token) {
    if (!token)
        return;
    try {
        const [me, addresses, orders, orderCounts, supportMsgs] = await Promise.all([
            requestAuth('/api/me', { method: 'GET', token }),
            requestAuth('/api/addresses', { method: 'GET', token }),
            requestAuth('/api/orders', { method: 'GET', token }),
            requestAuth('/api/orders/count', { method: 'GET', token }),
            requestAuth('/api/support/messages', { method: 'GET', token }).catch(() => []),
        ]);
        wx.setStorageSync(PREFETCH_ME_KEY, me || null);
        wx.setStorageSync(PREFETCH_ADDRESSES_KEY, Array.isArray(addresses) ? addresses : []);
        wx.setStorageSync(PREFETCH_ORDERS_KEY, Array.isArray(orders) ? orders : []);
        wx.setStorageSync(PREFETCH_ORDER_COUNTS_KEY, Array.isArray(orderCounts) ? orderCounts : []);
        wx.setStorageSync(PREFETCH_SUPPORT_MESSAGES_KEY, Array.isArray(supportMsgs) ? supportMsgs : []);
    }
    catch (e) {
        console.warn('prefetch user data failed', e);
    }
}
async function checkWeChatSessionValid() {
    try {
        await new Promise((resolve, reject) => wx.checkSession({ success: resolve, fail: reject }));
        return true;
    }
    catch (e) {
        return false;
    }
}
export function getPrefetchedUserData() {
    return {
        me: wx.getStorageSync(PREFETCH_ME_KEY) || null,
        addresses: wx.getStorageSync(PREFETCH_ADDRESSES_KEY) || [],
        orders: wx.getStorageSync(PREFETCH_ORDERS_KEY) || [],
        orderCounts: wx.getStorageSync(PREFETCH_ORDER_COUNTS_KEY) || [],
    };
}
/** 在线客服 DB 消息列表（登录 prefetch 시 채움; 채팅 페이지 첫 프레임용） */
export function getPrefetchedSupportMessages() {
    const raw = wx.getStorageSync(PREFETCH_SUPPORT_MESSAGES_KEY);
    return Array.isArray(raw) ? raw : [];
}
export function setPrefetchedSupportMessages(list) {
    wx.setStorageSync(PREFETCH_SUPPORT_MESSAGES_KEY, Array.isArray(list) ? list : []);
}
export async function loginWithWeChat(userInfo = null) {
    async function doWxLoginOnce() {
        const loginRes = await new Promise((resolve, reject) => {
            wx.login({ timeout: 8000, success: resolve, fail: (err) => reject(new Error(err?.errMsg || 'wx.login failed')) });
        });
        if (!loginRes?.code)
            throw new Error('wx.login failed: missing code');
        let accountInfo = null;
        try {
            accountInfo = wx.getAccountInfoSync?.() || null;
        }
        catch (e) {
            accountInfo = null;
        }
        return requestAuth('/api/auth/wechat-login', {
            method: 'POST',
            data: {
                code: loginRes.code,
                ...(userInfo ? { userInfo } : {}),
                miniProgramInfo: accountInfo
                    ? { appId: accountInfo?.miniProgram?.appId || '', envVersion: accountInfo?.miniProgram?.envVersion || '', version: accountInfo?.miniProgram?.version || '' }
                    : undefined,
            },
        });
    }
    let data;
    try {
        data = await doWxLoginOnce();
    }
    catch (e) {
        const msg = String(e?.message || '');
        // wechat jscode2session: 40029 invalid code (간헐/중복 호출/개발자도구) → 새 code로 1회 재시도
        if (msg.includes('40029') || msg.toLowerCase().includes('invalid code')) {
            await new Promise((r) => setTimeout(r, 250));
            data = await doWxLoginOnce();
        }
        else {
            throw e;
        }
    }
    setToken(data.token);
    setUser(data.user);
    await trySyncWeChatProfileSilently(data.token);
    await prefetchUserBootstrapData(data.token);
    return data;
}
export async function bindPhoneByWeChatCode(phoneCode) {
    const code = String(phoneCode || '').trim();
    if (!code)
        throw new Error('missing phone code');
    const token = getToken();
    if (!token)
        throw new Error('AUTH_REQUIRED');
    const data = await requestAuth('/api/auth/wechat-phone', {
        method: 'POST',
        data: { code },
        token,
    });
    if (data?.user) {
        setUser(data.user);
    }
    await prefetchUserBootstrapData(token);
    return data?.user || null;
}

export async function oneClickLoginByWeChatPhoneCode(phoneCode) {
    const code = String(phoneCode || '').trim();
    if (!code)
        throw new Error('missing phone code');
    const loginRes = await new Promise((resolve, reject) => {
        wx.login({ timeout: 8000, success: resolve, fail: (err) => reject(new Error(err?.errMsg || 'wx.login failed')) });
    });
    if (!loginRes?.code)
        throw new Error('wx.login failed: missing code');
    const data = await requestAuth('/api/auth/wechat-oneclick', {
        method: 'POST',
        data: { loginCode: loginRes.code, phoneCode: code },
    });
    setToken(data.token);
    setUser(data.user);
    await trySyncWeChatProfileSilently(data.token);
    await prefetchUserBootstrapData(data.token);
    return data;
}
export async function ensureAuthSession(options = {}) {
    const { allowLogin = false } = options;
    const token = getToken();
    if (token) {
        try {
            const validWeChatSession = await checkWeChatSessionValid();
            if (!validWeChatSession) {
                logout();
                throw new Error('WECHAT_SESSION_EXPIRED');
            }
            const me = await requestAuth('/api/me', { method: 'GET', token });
            setUser(me);
            await trySyncWeChatProfileSilently(token);
            await prefetchUserBootstrapData(token);
            return me;
        }
        catch (e) {
            clearToken();
        }
    }
    if (!allowLogin)
        throw new Error('AUTH_CONSENT_REQUIRED');
    const loginData = await loginWithWeChat();
    return loginData.user;
}
export async function syncUserProfileByWeChat() {
    const profileRes = await new Promise((resolve, reject) => {
        wx.getUserProfile({ desc: '完善会员资料', success: resolve, fail: reject });
    });
    const userInfo = profileRes?.userInfo || {};
    await loginWithWeChat({ nickName: userInfo.nickName || '', avatarUrl: userInfo.avatarUrl || '', gender: Number(userInfo.gender || 0) });
    const me = await requestAuth('/api/me', {
        method: 'PUT',
        data: { nickName: userInfo.nickName || '', avatarUrl: userInfo.avatarUrl || '', gender: Number(userInfo.gender || 0) },
        token: getToken(),
    });
    setUser(me);
    await prefetchUserBootstrapData(getToken());
    return me;
}
