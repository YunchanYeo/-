import Toast from 'tdesign-miniprogram/toast/index';
import { fetchDeliveryAddress, createDeliveryAddress, updateDeliveryAddress } from '../../../../services/address/fetchAddress';
import { areaData } from '../../../../config/index';
import { resolveAddress, rejectAddress } from '../../../../services/address/edit';
import { getErrorMessage } from '../../../../services/_utils/errors';
import { ensureAuthSession } from '../../../../services/auth/session';
const innerPhoneReg = '^1(?:3\\d|4[4-9]|5[0-35-9]|6[67]|7[0-8]|8\\d|9\\d)\\d{8}$';
const innerNameReg = '^[a-zA-Z\\d\\u4e00-\\u9fa5]+$';
const labelsOptions = [
    { id: 0, name: '家' },
    { id: 1, name: '公司' },
];
Page({
    options: {
        multipleSlots: true,
    },
    externalClasses: ['theme-wrapper-class'],
    data: {
        locationState: {
            labelIndex: null,
            addressId: '',
            addressTag: '',
            cityCode: '',
            cityName: '',
            countryCode: '',
            countryName: '',
            detailAddress: '',
            districtCode: '',
            districtName: '',
            isDefault: false,
            name: '',
            phone: '',
            provinceCode: '',
            provinceName: '',
            isEdit: false,
            isOrderDetail: false,
            isOrderSure: false,
        },
        areaData: areaData,
        labels: labelsOptions,
        areaPickerVisible: false,
        submitActive: false,
        visible: false,
        labelValue: '',
        columns: 3,
    },
    privateData: {
        verifyTips: '',
    },
    /** 从列表/订单进来时的 query，用于 navigateBack 失败时 redirect 回列表 */
    _addressListQuery: {},
    onLoad(options) {
        void this.bootstrap(options);
    },
    async bootstrap(options) {
        try {
            await ensureAuthSession({ allowLogin: true });
        }
        catch (e) {
            Toast({
                context: this,
                selector: '#t-toast',
                message: e?.message || '请先登录后再管理地址',
                icon: '',
                duration: 2000,
            });
            return;
        }
        this._addressListQuery = options && typeof options === 'object' ? { ...options } : {};
        const { id } = options || {};
        this.init(id);
    },
    onUnload() {
        if (!this.hasSava) {
            rejectAddress();
        }
    },
    hasSava: false,
    init(id) {
        if (id) {
            this.getAddressDetail(Number(id));
        }
    },
    getAddressDetail(id) {
        fetchDeliveryAddress(id).then((detail) => {
            this.setData({
                locationState: { ...this.data.locationState, ...detail, isEdit: true },
            }, () => {
                const { isLegal, tips } = this.onVerifyInputLegal();
                this.setData({
                    submitActive: isLegal,
                });
                this.privateData.verifyTips = tips;
            });
        });
    },
    onInputValue(e) {
        const { item } = e.currentTarget.dataset;
        if (item === 'address') {
            const { selectedOptions = [] } = e.detail;
            this.setData({
                'locationState.provinceCode': selectedOptions[0].value,
                'locationState.provinceName': selectedOptions[0].label,
                'locationState.cityName': selectedOptions[1].label,
                'locationState.cityCode': selectedOptions[1].value,
                'locationState.districtCode': selectedOptions[2].value,
                'locationState.districtName': selectedOptions[2].label,
                areaPickerVisible: false,
            }, () => {
                const { isLegal, tips } = this.onVerifyInputLegal();
                this.setData({
                    submitActive: isLegal,
                });
                this.privateData.verifyTips = tips;
            });
        }
        else {
            let { value = '' } = e.detail;
            if (item === 'phone') {
                value = String(value ?? '').replace(/\s/g, '');
            }
            else if (item === 'name') {
                value = String(value ?? '').trim();
            }
            this.setData({
                [`locationState.${item}`]: value,
            }, () => {
                const { isLegal, tips } = this.onVerifyInputLegal();
                this.setData({
                    submitActive: isLegal,
                });
                this.privateData.verifyTips = tips;
            });
        }
    },
    onPickArea() {
        this.setData({ areaPickerVisible: true });
    },
    onPickLabels(e) {
        const { item } = e.currentTarget.dataset;
        const { locationState: { labelIndex = undefined }, labels = [], } = this.data;
        let payload = {
            labelIndex: item,
            addressTag: labels[item].name,
        };
        if (item === labelIndex) {
            payload = { labelIndex: null, addressTag: '' };
        }
        this.setData({
            'locationState.labelIndex': payload.labelIndex,
        });
        this.triggerEvent('triggerUpdateValue', payload);
    },
    addLabels() {
        this.setData({
            visible: true,
        });
    },
    confirmHandle() {
        const { labels, labelValue } = this.data;
        this.setData({
            visible: false,
            labels: [...labels, { id: labels[labels.length - 1].id + 1, name: labelValue }],
            labelValue: '',
        });
    },
    cancelHandle() {
        this.setData({
            visible: false,
            labelValue: '',
        });
    },
    onCheckDefaultAddress({ detail }) {
        const { value } = detail;
        this.setData({
            'locationState.isDefault': value,
        });
    },
    onVerifyInputLegal() {
        const { name, phone, detailAddress, districtName } = this.data.locationState;
        const prefixPhoneReg = String(this.properties.phoneReg || innerPhoneReg);
        const prefixNameReg = String(this.properties.nameReg || innerNameReg);
        const nameRegExp = new RegExp(prefixNameReg);
        const phoneRegExp = new RegExp(prefixPhoneReg);
        if (!name || !name.trim()) {
            return {
                isLegal: false,
                tips: '请填写收货人',
            };
        }
        if (!nameRegExp.test(name)) {
            return {
                isLegal: false,
                tips: '收货人仅支持输入中文、英文（区分大小写）、数字',
            };
        }
        if (!phone || !phone.trim()) {
            return {
                isLegal: false,
                tips: '请填写手机号',
            };
        }
        if (!phoneRegExp.test(phone)) {
            return {
                isLegal: false,
                tips: '请填写正确的手机号',
            };
        }
        if (!districtName || !districtName.trim()) {
            return {
                isLegal: false,
                tips: '请选择省市区信息',
            };
        }
        if (!detailAddress || !detailAddress.trim()) {
            return {
                isLegal: false,
                tips: '请完善详细地址',
            };
        }
        if (detailAddress && detailAddress.trim().length > 50) {
            return {
                isLegal: false,
                tips: '详细地址不能超过50个字符',
            };
        }
        return {
            isLegal: true,
            tips: '添加成功',
        };
    },
    builtInSearch({ code, name }) {
        return new Promise((resolve, reject) => {
            wx.getSetting({
                success: (res) => {
                    if (res.authSetting[code] === false) {
                        wx.showModal({
                            title: `获取${name}失败`,
                            content: `获取${name}失败，请在【右上角】-小程序【设置】项中，将【${name}】开启。`,
                            confirmText: '去设置',
                            confirmColor: '#FA550F',
                            cancelColor: '取消',
                            success(res) {
                                if (res.confirm) {
                                    wx.openSetting({
                                        success(settingRes) {
                                            if (settingRes.authSetting[code] === true) {
                                                resolve();
                                            }
                                            else {
                                                console.warn('用户未打开权限', name, code);
                                                reject();
                                            }
                                        },
                                    });
                                }
                                else {
                                    reject();
                                }
                            },
                            fail() {
                                reject();
                            },
                        });
                    }
                    else {
                        resolve();
                    }
                },
                fail() {
                    reject();
                },
            });
        });
    },
    onSearchAddress() {
        this.builtInSearch({ code: 'scope.userLocation', name: '地址位置' }).then(() => {
            wx.chooseLocation({
                success: (res) => {
                    if (res.name) {
                        const parsed = this.parseRegionFromText(res.address || '');
                        const detailAddress = `${res.name}${res.address ? ` ${res.address}` : ''}`.trim();
                        this.setData({
                            'locationState.provinceName': parsed.provinceName || this.data.locationState.provinceName,
                            'locationState.provinceCode': parsed.provinceCode || this.data.locationState.provinceCode,
                            'locationState.cityName': parsed.cityName || this.data.locationState.cityName,
                            'locationState.cityCode': parsed.cityCode || this.data.locationState.cityCode,
                            'locationState.districtName': parsed.districtName || this.data.locationState.districtName,
                            'locationState.districtCode': parsed.districtCode || this.data.locationState.districtCode,
                            'locationState.detailAddress': detailAddress || this.data.locationState.detailAddress,
                            'locationState.latitude': res.latitude,
                            'locationState.longitude': res.longitude,
                        }, () => {
                            const { isLegal, tips } = this.onVerifyInputLegal();
                            this.setData({ submitActive: isLegal });
                            this.privateData.verifyTips = tips;
                        });
                    }
                    else {
                        Toast({
                            context: this,
                            selector: '#t-toast',
                            message: '地点为空，请重新选择',
                            icon: '',
                            duration: 1000,
                        });
                    }
                },
                fail: function (res) {
                    console.warn(`wx.chooseLocation fail: ${JSON.stringify(res)}`);
                    if (res.errMsg !== 'chooseLocation:fail cancel') {
                        Toast({
                            context: this,
                            selector: '#t-toast',
                            message: '地点错误，请重新选择',
                            icon: '',
                            duration: 1000,
                        });
                    }
                },
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
    async formSubmit() {
        const { submitActive } = this.data;
        if (!submitActive) {
            Toast({
                context: this,
                selector: '#t-toast',
                message: this.privateData.verifyTips,
                icon: '',
                duration: 1000,
            });
            return;
        }
        const { locationState } = this.data;
        const payload = {
            name: String(locationState.name ?? '').trim(),
            phone: String(locationState.phone ?? '').replace(/\s/g, ''),
            countryName: String(locationState.countryName ?? ''),
            countryCode: String(locationState.countryCode ?? ''),
            provinceName: String(locationState.provinceName ?? ''),
            provinceCode: String(locationState.provinceCode ?? ''),
            cityName: String(locationState.cityName ?? ''),
            cityCode: String(locationState.cityCode ?? ''),
            districtName: String(locationState.districtName ?? ''),
            districtCode: String(locationState.districtCode ?? ''),
            detailAddress: String(locationState.detailAddress ?? ''),
            addressTag: String(locationState.addressTag ?? ''),
            isDefault: locationState.isDefault === 1 || locationState.isDefault === true ? 1 : 0,
            latitude: locationState.latitude,
            longitude: locationState.longitude,
        };
        let saved;
        try {
            await ensureAuthSession({ allowLogin: true });
            if (locationState.addressId) {
                saved = await updateDeliveryAddress(locationState.addressId, payload);
            }
            else {
                saved = await createDeliveryAddress(payload);
            }
        }
        catch (e) {
            const hint = getErrorMessage(e);
            const msg = hint && hint.length > 0 && hint !== 'Unknown error'
                ? (hint.length > 72 ? `${hint.slice(0, 72)}…` : hint)
                : '地址保存失败，请稍后重试';
            Toast({
                context: this,
                selector: '#t-toast',
                message: msg,
                icon: '',
                duration: 2200,
            });
            return;
        }
        this.hasSava = true;
        resolveAddress({
            saasId: '88888888',
            uid: `88888888205500`,
            authToken: null,
            id: String(saved.id),
            addressId: String(saved.id),
            phone: saved.phone,
            name: saved.name,
            countryName: saved.countryName,
            countryCode: saved.countryCode,
            provinceName: saved.provinceName,
            provinceCode: saved.provinceCode,
            cityName: saved.cityName,
            cityCode: saved.cityCode,
            districtName: saved.districtName,
            districtCode: saved.districtCode,
            detailAddress: saved.detailAddress,
            isDefault: saved.isDefault === 1 ? 1 : 0,
            addressTag: saved.addressTag,
            latitude: saved.latitude,
            longitude: saved.longitude,
            storeId: null,
        });
        const q = this._addressListQuery || {};
        const parts = [];
        if (q.selectMode)
            parts.push(`selectMode=${encodeURIComponent(String(q.selectMode))}`);
        if (q.isOrderSure)
            parts.push(`isOrderSure=${encodeURIComponent(String(q.isOrderSure))}`);
        if (q.id)
            parts.push(`id=${encodeURIComponent(String(q.id))}`);
        const listSuffix = parts.length > 0 ? `?${parts.join('&')}` : '';
        const listUrl = `/pages/user/address/list/index${listSuffix}`;
        wx.navigateBack({
            delta: 1,
            success: () => {
                const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
                const top = pages[pages.length - 1];
                const route = top && top.route ? String(top.route) : '';
                if (route.includes('address/list') && typeof top.getAddressList === 'function') {
                    top.getAddressList();
                }
            },
            fail: () => {
                wx.redirectTo({ url: listUrl });
            },
        });
    },
    getWeixinAddress(e) {
        const { locationState } = this.data;
        const weixinAddress = e.detail;
        this.setData({
            locationState: { ...locationState, ...weixinAddress },
        }, () => {
            const { isLegal, tips } = this.onVerifyInputLegal();
            this.setData({
                submitActive: isLegal,
            });
            this.privateData.verifyTips = tips;
        });
    },
});
