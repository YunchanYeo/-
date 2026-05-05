import { config } from '../../config/index';
import { requestJson } from '../_utils/http';
import { getPrefetchedUserData, getToken } from '../auth/session';
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
    const prefetched = getPrefetchedUserData();
    const meReq = prefetched.me ? Promise.resolve(prefetched.me) : requestJson('/api/me', { method: 'GET' });
    const addrReq = Array.isArray(prefetched.addresses) && prefetched.addresses.length > 0
        ? Promise.resolve(prefetched.addresses)
        : requestJson('/api/addresses', { method: 'GET' });
    return Promise.all([meReq, addrReq]).then(([me, addressList]) => ({
        userInfo: {
            avatarUrl: me.avatarUrl || '',
            nickName: me.nickName || '微信用户',
            phoneNumber: me.phoneNumber || '',
        },
        countsData: [
            { type: 'address', num: String(addressList.length) },
            { type: 'coupon', num: '0' },
            { type: 'point', num: '0' },
        ],
        orderTagInfos: [{ orderNum: 0 }, { orderNum: 0 }, { orderNum: 0 }, { orderNum: 0 }, { orderNum: 0 }],
        customerServiceInfo: { servicePhone: '400-000-0000' },
    }));
}
