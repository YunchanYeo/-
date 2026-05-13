import { config } from '../../config/runtime';
import { requestJson } from '../_utils/http';
import { fetchCustomerServicePhone } from '../_utils/customerServicePhone';
import { getToken, getUser } from '../auth/session';
import { fetchCouponList } from '../coupon/index';
import { normalizeGoodsImageUrl } from '../_utils/normalizeGoodsImageUrl';
import { displayNameForUserCenter } from './displayNameForUserCenter';
function mockFetchUserCenter() {
    const { delay } = require('../_utils/delay');
    const { genUsercenter } = require('../../model/usercenter');
    return delay(200).then(() => genUsercenter());
}
function hasRealWechatProfile(me) {
    const nick = String(me?.nickName || '').trim();
    const avatar = String(me?.avatarUrl || '').trim();
    const phone = String(me?.phoneNumber || '').trim();
    const hasRealNick = !!nick && nick !== '微信用户';
    const hasAvatar = !!avatar && !/icon-user-center-avatar/i.test(avatar);
    /** 一键登录后仅有手机号也视为已登录资料卡可展示（个人中心与「资料待完善」分流） */
    return hasRealNick || hasAvatar || /^1\d{10}$/.test(phone);
}
export function fetchUserCenter() {
    if (config.useMock)
        return mockFetchUserCenter();
    const loadAuthed = () =>
        /** 로그인 후 마이페이지는 매번 DB(백엔드 API)에서 최신 값 조회 — 로컬 prefetch 만으로 오래된 표시 방지 */
        Promise.allSettled([
            fetchCustomerServicePhone(),
            requestJson('/api/me', { method: 'GET' }),
            requestJson('/api/addresses', { method: 'GET' }),
            requestJson('/api/orders/count', { method: 'GET' }),
            fetchCouponList('default').catch(() => []),
        ]).then((results) => {
        const servicePhone = results[0].status === 'fulfilled' ? results[0].value : config.customerServicePhone;
        const me = results[1].status === 'fulfilled' ? results[1].value : null;
        const addressList = results[2].status === 'fulfilled' && Array.isArray(results[2].value) ? results[2].value : [];
        const tabsCount = results[3].status === 'fulfilled' && Array.isArray(results[3].value) ? results[3].value : [];
        const couponList = results[4].status === 'fulfilled' && Array.isArray(results[4].value) ? results[4].value : [];
        const rows = Array.isArray(tabsCount) ? tabsCount : [];
        const numOf = (tabType) => {
            const hit = rows.find((x) => x.tabType === tabType);
            return Number(hit?.orderNum ?? 0);
        };
        const stored = getUser() || {};
        const apiMe = me && typeof me === 'object' ? me : {};
        const pickStr = (fromApi, fromStore) => {
            const a = String(fromApi ?? '').trim();
            if (a)
                return a;
            const b = String(fromStore ?? '').trim();
            return b || '';
        };
        const nickNameRaw = pickStr(apiMe.nickName, stored.nickName);
        const avatarRaw = pickStr(apiMe.avatarUrl, stored.avatarUrl);
        const phoneNumber = pickStr(apiMe.phoneNumber, stored.phoneNumber);
        const mergedForProfile = {
            nickName: nickNameRaw,
            avatarUrl: avatarRaw,
            phoneNumber,
        };
        /** 与 person-info 一致：相对路径·localhost·旧云地址统一到当前 apiBaseUrl；微信 CDN 由服务端 GET /me 转存为 /api/media/user-avatar/:id */
        const avatarUrl = normalizeGoodsImageUrl(avatarRaw || '');
        return {
            userInfo: {
                avatarUrl,
                nickName: displayNameForUserCenter(nickNameRaw, phoneNumber),
                phoneNumber,
            },
            hasWechatProfile: hasRealWechatProfile(mergedForProfile),
            countsData: [
                { type: 'address', num: String(Array.isArray(addressList) ? addressList.length : 0) },
                { type: 'coupon', num: String(Array.isArray(couponList) ? couponList.length : 0) },
                { type: 'point', num: String(Number(apiMe.points ?? stored.points ?? 0)) },
            ],
            orderTagInfos: [
                { orderNum: numOf(5) },
                { orderNum: numOf(10) },
                { orderNum: numOf(40) },
                { orderNum: numOf(50) },
                { orderNum: numOf(0) },
            ],
            customerServiceInfo: { servicePhone },
        };
    });

    if (!getToken()) {
        return fetchCustomerServicePhone().then((servicePhone) => ({
            userInfo: {
                avatarUrl: '',
                nickName: '',
                phoneNumber: '',
            },
            hasWechatProfile: false,
            countsData: [
                { type: 'address', num: '0' },
                { type: 'coupon', num: '0' },
                { type: 'point', num: '0' },
            ],
            orderTagInfos: [{ orderNum: 0 }, { orderNum: 0 }, { orderNum: 0 }, { orderNum: 0 }, { orderNum: 0 }],
            customerServiceInfo: { servicePhone },
        }));
    }

    return loadAuthed();
}
