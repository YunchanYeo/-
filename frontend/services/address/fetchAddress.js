import { config } from '../../config/index';
import { requestJson } from '../_utils/http';
function mockFetchDeliveryAddress(id) {
    const { delay } = require('../_utils/delay');
    const { genAddress } = require('../../model/address');
    return delay().then(() => genAddress(id));
}
export function fetchDeliveryAddress(id = 0) {
    if (config.useMock)
        return mockFetchDeliveryAddress(id);
    return requestJson(`/api/addresses/${id}`, { method: 'GET' }).then((address) => ({
        addressId: String(address.id),
        id: String(address.id),
        name: address.name || '',
        phone: address.phone || '',
        countryName: address.countryName || '',
        countryCode: address.countryCode || '',
        provinceName: address.provinceName || '',
        provinceCode: address.provinceCode || '',
        cityName: address.cityName || '',
        cityCode: address.cityCode || '',
        districtName: address.districtName || '',
        districtCode: address.districtCode || '',
        detailAddress: address.detailAddress || '',
        isDefault: address.isDefault ? 1 : 0,
        addressTag: address.addressTag || '',
        latitude: address.latitude,
        longitude: address.longitude,
    }));
}
function mockFetchDeliveryAddressList(len = 0) {
    const { delay } = require('../_utils/delay');
    const { genAddressList } = require('../../model/address');
    return delay().then(() => genAddressList(len).map((address) => ({
        ...address,
        phoneNumber: address.phone,
        address: `${address.provinceName}${address.cityName}${address.districtName}${address.detailAddress}`,
        tag: address.addressTag,
    })));
}
export function fetchDeliveryAddressList(len = 10) {
    if (config.useMock)
        return mockFetchDeliveryAddressList(len);
    return requestJson('/api/addresses', { method: 'GET' }).then((rows) => (Array.isArray(rows) ? rows : []).slice(0, len).map((address) => ({
        id: String(address.id),
        addressId: String(address.id),
        name: address.name,
        phone: address.phone,
        phoneNumber: address.phone,
        provinceName: address.provinceName,
        provinceCode: address.provinceCode,
        cityName: address.cityName,
        cityCode: address.cityCode,
        districtName: address.districtName,
        districtCode: address.districtCode,
        detailAddress: address.detailAddress,
        address: `${address.provinceName || ''}${address.cityName || ''}${address.districtName || ''}${address.detailAddress || ''}`,
        isDefault: address.isDefault ? 1 : 0,
        addressTag: address.addressTag,
        tag: address.addressTag,
        latitude: address.latitude,
        longitude: address.longitude,
        countryName: address.countryName || '',
        countryCode: address.countryCode || '',
    })));
}
export function createDeliveryAddress(payload) {
    return requestJson('/api/addresses', { method: 'POST', data: payload });
}
export function updateDeliveryAddress(id, payload) {
    return requestJson(`/api/addresses/${id}`, { method: 'PUT', data: payload });
}
export function deleteDeliveryAddress(id) {
    return requestJson(`/api/addresses/${id}`, { method: 'DELETE' });
}
