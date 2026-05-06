import { config } from '../../config/index';
import { requestJson } from '../_utils/http';
import { getToken } from '../auth/session';
function mockFetchUserCenter() {
    const { delay } = require('../_utils/delay');
    const { genUsercenter } = require('../../model/usercenter');
    return delay(200).then(() => genUsercenter());
}
export function fetchUserCenter() {
    if (config.useMock)
        return mockFetchUserCenter();
    if (!getToken()) {
        return Promise.resolve({
            userInfo: {
                avatarUrl: '',
                nickName: '',
                phoneNumber: '',
            },
            countsData: [
                { type: 'address', num: '0' },
                { type: 'coupon', num: '0' },
                { type: 'point', num: '0' },
            ],
            orderTagInfos: [{ orderNum: 0 }, { orderNum: 0 }, { orderNum: 0 }, { orderNum: 0 }, { orderNum: 0 }],
            customerServiceInfo: { servicePhone: '400-000-0000' },
        });
    }
    /** 로그인 후 마이페이지는 매번 DB(백엔드 API)에서 최신 값 조회 — 로컬 prefetch 만으로 오래된 표시 방지 */
    return Promise.all([
        requestJson('/api/me', { method: 'GET' }),
        requestJson('/api/addresses', { method: 'GET' }),
        requestJson('/api/orders/count', { method: 'GET' }),
    ]).then(([me, addressList, tabsCount]) => {
        const rows = Array.isArray(tabsCount) ? tabsCount : [];
        const numOf = (tabType) => {
            const hit = rows.find((x) => x.tabType === tabType);
            return Number(hit?.orderNum ?? 0);
        };
        return {
            userInfo: {
                avatarUrl: me.avatarUrl || '',
                nickName: me.nickName || '微信用户',
                phoneNumber: me.phoneNumber || '',
            },
            countsData: [
                { type: 'address', num: String(Array.isArray(addressList) ? addressList.length : 0) },
                { type: 'coupon', num: '0' },
                { type: 'point', num: String(Number(me.points ?? 0)) },
            ],
            orderTagInfos: [
                { orderNum: numOf(5) },
                { orderNum: numOf(10) },
                { orderNum: numOf(40) },
                { orderNum: numOf(50) },
                { orderNum: numOf(0) },
            ],
            customerServiceInfo: { servicePhone: '400-000-0000' },
        };
    });
}
