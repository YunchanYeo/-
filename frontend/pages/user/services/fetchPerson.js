import { config } from '../../../config/runtime';
import { requestJson } from '../../../services/_utils/http';
import { normalizeGoodsImageUrl } from '../../../services/_utils/normalizeGoodsImageUrl';
import { getUser } from '../../../services/auth/session';
import { displayNameForUserCenter } from '../../../services/usercenter/displayNameForUserCenter';
function mockFetchPerson() {
    const { delay } = require('../../../services/_utils/delay');
    const { genSimpleUserInfo } = require('../../../model/usercenter');
    const { genAddress } = require('../../../model/address');
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
    return requestJson('/api/me', { method: 'GET' }).then((me) => {
        const stored = getUser() || {};
        const apiMe = me && typeof me === 'object' ? me : {};
        const pickStr = (fromApi, fromStore) => {
            const a = String(fromApi ?? '').trim();
            if (a)
                return a;
            const b = String(fromStore ?? '').trim();
            return b || '';
        };
        const nickRaw = pickStr(apiMe.nickName, stored.nickName);
        const phoneRaw = pickStr(apiMe.phoneNumber, stored.phoneNumber);
        const nickName = displayNameForUserCenter(nickRaw, phoneRaw);
        const avatarUrl = normalizeGoodsImageUrl(pickStr(apiMe.avatarUrl, stored.avatarUrl) || '');
        return {
            avatarUrl,
            nickName,
            gender: apiMe.gender ?? stored.gender ?? 0,
            phoneNumber: pickStr(apiMe.phoneNumber, stored.phoneNumber) || '',
            points: Number(apiMe.points ?? stored.points ?? 0),
            address: { provinceName: '', provinceCode: '', cityName: '', cityCode: '' },
        };
    });
}

