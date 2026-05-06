import { config } from '../../config/index';
import { requestJson } from '../_utils/http';
function mockFetchPerson() {
    const { delay } = require('../_utils/delay');
    const { genSimpleUserInfo } = require('../../model/usercenter');
    const { genAddress } = require('../../model/address');
    const address = genAddress();
    return delay().then(() => ({
        ...genSimpleUserInfo(),
        address: {
            provinceName: address.provinceName,
            provinceCode: address.provinceCode,
            cityName: address.cityName,
            cityCode: address.cityCode,
        },
    }));
}
export function fetchPerson() {
    if (config.useMock)
        return mockFetchPerson();
    return requestJson('/api/me', { method: 'GET' }).then((me) => ({
        avatarUrl: me.avatarUrl || '',
        nickName: me.nickName || '微信用户',
        gender: me.gender || 0,
        phoneNumber: me.phoneNumber || '',
        points: Number(me.points ?? 0),
        address: { provinceName: '', provinceCode: '', cityName: '', cityCode: '' },
    }));
}
