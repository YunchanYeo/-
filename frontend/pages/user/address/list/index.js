/* eslint-disable no-param-reassign */
import { fetchDeliveryAddressList, deleteDeliveryAddress, createDeliveryAddress } from '../../../../services/address/fetchAddress';
import Toast from 'tdesign-miniprogram/toast/index';
import { resolveAddress, rejectAddress } from '../../../../services/address/list';
import { getAddressPromise } from '../../../../services/address/edit';
import { ensureAuthSession } from '../../../../services/auth/session';
import { areaData } from '../../../../config/index';
import { phoneRegCheck } from '../../utils/util';
const { addressParse } = require('../../components/utils/addressParse');
function addressImportDedupeKey(row) {
    const norm = (s) => String(s ?? '').trim().replace(/\s+/g, '');
    return [
        norm(row.phone),
        norm(row.provinceName),
        norm(row.cityName),
        norm(row.districtName),
        norm(row.detailAddress),
    ].join('\u001f');
}
Page({
    data: {
        addressList: [],
        deleteID: '',
        showDeleteConfirm: false,
        isOrderSure: false,
    },
    /** 选择模式 */
    selectMode: false,
    /** 是否已经选择地址，不置为true的话页面离开时会触发取消选择行为 */
    hasSelect: false,
    onLoad(query) {
        const { selectMode = '', isOrderSure = '', id = '' } = query;
        this.setData({
            isOrderSure: !!isOrderSure,
            id,
        });
        this.selectMode = !!selectMode;
        void this.init();
    },
    async init() {
        try {
            await ensureAuthSession({ allowLogin: true });
        }
        catch (e) {
            Toast({
                context: this,
                selector: '#t-toast',
                message: e?.message || '请先登录后再查看地址',
                icon: '',
                duration: 2000,
            });
            return;
        }
        this.getAddressList();
    },
    onUnload() {
        if (this.selectMode && !this.hasSelect) {
            rejectAddress();
        }
    },
    getAddressList() {
        const { id } = this.data;
        return fetchDeliveryAddressList()
            .then((addressList) => {
                addressList.forEach((address) => {
                    if (String(address.id) === String(id)) {
                        address.checked = true;
                    }
                });
                this.setData({ addressList });
                return addressList;
            })
            .catch(() => {
                Toast({
                    context: this,
                    selector: '#t-toast',
                    message: '加载地址列表失败',
                    icon: '',
                    duration: 2000,
                });
            });
    },
    parseRegionFromText(rawAddress) {
        if (!rawAddress) {
            return {};
        }
        const province = (areaData || []).find((p) => rawAddress.includes(p.label));
        if (!province) {
            return {};
        }
        const city = (province.children || []).find((c) => rawAddress.includes(c.label));
        const district = (city?.children || []).find((d) => rawAddress.includes(d.label));
        return {
            provinceName: province.label,
            provinceCode: province.value,
            cityName: city?.label || '',
            cityCode: city?.value || '',
            districtName: district?.label || '',
            districtCode: district?.value || '',
        };
    },
    /** 列表页「微信地址导入」：不跳转编辑页，校验通过后直接 POST */
    async onWeixinAddressImported(e) {
        const d = e.detail || {};
        const phone = String(d.phone || '').replace(/\s/g, '');
        if (!phoneRegCheck(phone)) {
            Toast({
                context: this,
                selector: '#t-toast',
                message: '请填写正确的手机号',
                icon: '',
                duration: 1600,
            });
            return;
        }
        const name = String(d.name || '').trim();
        const provinceName = String(d.provinceName || '').trim();
        const cityName = String(d.cityName || '').trim();
        const districtName = String(d.districtName || '').trim();
        const detailAddress = String(d.detailAddress || '').trim();
        if (!name || !districtName || !detailAddress) {
            Toast({
                context: this,
                selector: '#t-toast',
                message: '地址信息不完整，请使用「新建收货地址」手动填写',
                icon: '',
                duration: 2000,
            });
            return;
        }
        let provinceCode = String(d.provinceCode || '').trim();
        let cityCode = String(d.cityCode || '').trim();
        let districtCode = String(d.districtCode || '').trim();
        const regionHint = [provinceName, cityName, districtName].filter(Boolean).join('');
        if (!provinceCode || !cityCode || !districtCode) {
            const parsed = regionHint ? this.parseRegionFromText(regionHint) : {};
            provinceCode = provinceCode || parsed.provinceCode || '';
            cityCode = cityCode || parsed.cityCode || '';
            districtCode = districtCode || parsed.districtCode || '';
        }
        if (!provinceCode || !cityCode || !districtCode) {
            try {
                const codes = await addressParse(provinceName, cityName, districtName);
                provinceCode = codes.provinceCode;
                cityCode = codes.cityCode;
                districtCode = codes.districtCode;
            }
            catch (_) {
                Toast({
                    context: this,
                    selector: '#t-toast',
                    message: '省市区未能自动匹配，请点「新建收货地址」选择地区后保存',
                    icon: '',
                    duration: 2400,
                });
                return;
            }
        }
        const incomingKey = addressImportDedupeKey({
            phone,
            provinceName,
            cityName,
            districtName,
            detailAddress,
        });
        const dup = (this.data.addressList || []).some((row) => addressImportDedupeKey({
            phone: row.phone,
            provinceName: row.provinceName,
            cityName: row.cityName,
            districtName: row.districtName,
            detailAddress: row.detailAddress,
        }) === incomingKey);
        if (dup) {
            Toast({
                context: this,
                selector: '#t-toast',
                message: '该地址已存在',
                icon: '',
                duration: 1600,
            });
            return;
        }
        const isFirst = !(this.data.addressList && this.data.addressList.length);
        const payload = {
            name,
            phone,
            countryName: String(d.countryName || '中国').trim() || '中国',
            countryCode: String(d.countryCode || '').trim(),
            provinceName,
            provinceCode,
            cityName,
            cityCode,
            districtName,
            districtCode,
            detailAddress,
            addressTag: '微信地址',
            isDefault: isFirst ? 1 : 0,
        };
        try {
            await createDeliveryAddress(payload);
            Toast({
                context: this,
                selector: '#t-toast',
                message: '添加成功',
                icon: '',
                duration: 1200,
            });
            await this.getAddressList();
        }
        catch (err) {
            Toast({
                context: this,
                selector: '#t-toast',
                message: '地址保存失败，请稍后重试',
                icon: '',
                duration: 2000,
            });
        }
    },
    getWXAddressHandle() {
        wx.chooseAddress({
            success: async (res) => {
                if (res.errMsg.indexOf('ok') === -1) {
                    Toast({
                        context: this,
                        selector: '#t-toast',
                        message: res.errMsg,
                        icon: '',
                        duration: 1000,
                    });
                    return;
                }
                const district = res.countyName || res.countryName || '';
                const phone = String(res.telNumber || '').replace(/\s/g, '');
                const payload = {
                    name: res.userName || '',
                    phone,
                    countryName: '',
                    countryCode: res.nationalCode || '',
                    provinceName: res.provinceName || '',
                    provinceCode: '',
                    cityName: res.cityName || '',
                    cityCode: '',
                    districtName: district,
                    districtCode: '',
                    detailAddress: res.detailInfo || '',
                    addressTag: '微信地址',
                    isDefault: 0,
                };
                try {
                    await createDeliveryAddress(payload);
                    Toast({
                        context: this,
                        selector: '#t-toast',
                        message: '添加成功',
                        icon: '',
                        duration: 1000,
                    });
                    await this.getAddressList();
                }
                catch (e) {
                    Toast({
                        context: this,
                        selector: '#t-toast',
                        message: '地址保存失败，请稍后重试',
                        icon: '',
                        duration: 2000,
                    });
                }
            },
        });
    },
    confirmDeleteHandle({ detail }) {
        const { id } = detail || {};
        if (id !== undefined) {
            this.setData({ deleteID: id, showDeleteConfirm: true });
            Toast({
                context: this,
                selector: '#t-toast',
                message: '地址删除成功',
                theme: 'success',
                duration: 1000,
            });
        }
        else {
            Toast({
                context: this,
                selector: '#t-toast',
                message: '需要组件库发新版才能拿到地址ID',
                icon: '',
                duration: 1000,
            });
        }
    },
    async deleteAddressHandle(e) {
        const { id } = e.currentTarget.dataset;
        try {
            await deleteDeliveryAddress(id);
        }
        catch (err) {
            Toast({
                context: this,
                selector: '#t-toast',
                message: '地址删除失败',
                icon: '',
                duration: 1000,
            });
            return;
        }
        this.setData({
            addressList: this.data.addressList.filter((address) => String(address.id) !== String(id)),
            deleteID: '',
            showDeleteConfirm: false,
        });
    },
    editAddressHandle({ detail }) {
        this.waitForNewAddress();
        const { id } = detail || {};
        const { isOrderSure } = this.data;
        const selectMode = this.selectMode ? 1 : 0;
        const orderSure = isOrderSure ? 1 : 0;
        wx.navigateTo({ url: `/pages/user/address/edit/index?id=${id}&selectMode=${selectMode}&isOrderSure=${orderSure}` });
    },
    selectHandle({ detail }) {
        if (this.selectMode) {
            this.hasSelect = true;
            resolveAddress(detail);
            wx.navigateBack({ delta: 1 });
        }
        else {
            this.editAddressHandle({ detail });
        }
    },
    createHandle() {
        this.waitForNewAddress();
        const { isOrderSure } = this.data;
        const selectMode = this.selectMode ? 1 : 0;
        const orderSure = isOrderSure ? 1 : 0;
        wx.navigateTo({ url: `/pages/user/address/edit/index?selectMode=${selectMode}&isOrderSure=${orderSure}` });
    },
    waitForNewAddress() {
        getAddressPromise()
            .then((newAddress) => {
            let addressList = [...this.data.addressList];
            const aid = String(newAddress.addressId ?? newAddress.id ?? '').trim();
            newAddress.phoneNumber = newAddress.phone;
            newAddress.address = `${newAddress.provinceName}${newAddress.cityName}${newAddress.districtName}${newAddress.detailAddress}`;
            newAddress.tag = newAddress.addressTag;
            if (!aid) {
                newAddress.id = `${addressList.length}`;
                newAddress.addressId = `${addressList.length}`;
                if (newAddress.isDefault === 1) {
                    addressList = addressList.map((address) => {
                        address.isDefault = 0;
                        return address;
                    });
                }
                else {
                    newAddress.isDefault = 0;
                }
                addressList.push(newAddress);
            }
            else {
                let matched = false;
                addressList = addressList.map((address) => {
                    const rid = String(address.addressId ?? address.id ?? '');
                    if (rid === aid) {
                        matched = true;
                        return { ...address, ...newAddress, id: aid, addressId: aid };
                    }
                    return address;
                });
                if (!matched) {
                    const row = { ...newAddress, id: aid, addressId: aid };
                    if (row.isDefault === 1) {
                        addressList = addressList.map((address) => ({ ...address, isDefault: 0 }));
                    }
                    addressList.push(row);
                }
            }
            addressList.sort((prevAddress, nextAddress) => {
                if (prevAddress.isDefault && !nextAddress.isDefault) {
                    return -1;
                }
                if (!prevAddress.isDefault && nextAddress.isDefault) {
                    return 1;
                }
                return 0;
            });
            this.setData({
                addressList: addressList,
            });
            if (this.selectMode) {
                this.hasSelect = true;
                resolveAddress({ ...newAddress, checked: true });
                wx.navigateBack({ delta: 1 });
            }
        })
            .catch((e) => {
            if (e.message !== 'cancel') {
                Toast({
                    context: this,
                    selector: '#t-toast',
                    message: '地址编辑发生错误',
                    icon: '',
                    duration: 1000,
                });
            }
        });
    },
});
