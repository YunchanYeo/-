/* eslint-disable no-param-reassign */
import { fetchDeliveryAddressList, deleteDeliveryAddress } from '../../../../services/address/fetchAddress';
import Toast from 'tdesign-miniprogram/toast/index';
import { resolveAddress, rejectAddress } from '../../../../services/address/list';
import { getAddressPromise } from '../../../../services/address/edit';
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
        this.init();
    },
    init() {
        this.getAddressList();
    },
    onUnload() {
        if (this.selectMode && !this.hasSelect) {
            rejectAddress();
        }
    },
    getAddressList() {
        const { id } = this.data;
        fetchDeliveryAddressList().then((addressList) => {
            addressList.forEach((address) => {
                if (address.id === id) {
                    address.checked = true;
                }
            });
            this.setData({ addressList });
        });
    },
    getWXAddressHandle() {
        wx.chooseAddress({
            success: (res) => {
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
                Toast({
                    context: this,
                    selector: '#t-toast',
                    message: '添加成功',
                    icon: '',
                    duration: 1000,
                });
                const { length: len } = this.data.addressList;
                this.setData({
                    [`addressList[${len}]`]: {
                        name: res.userName,
                        phoneNumber: res.telNumber,
                        address: `${res.provinceName}${res.cityName}${res.countryName}${res.detailInfo}`,
                        isDefault: 0,
                        tag: '微信地址',
                        id: len,
                    },
                });
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
            addressList: this.data.addressList.filter((address) => address.id !== id),
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
            newAddress.phoneNumber = newAddress.phone;
            newAddress.address = `${newAddress.provinceName}${newAddress.cityName}${newAddress.districtName}${newAddress.detailAddress}`;
            newAddress.tag = newAddress.addressTag;
            if (!newAddress.addressId) {
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
                addressList = addressList.map((address) => {
                    if (address.addressId === newAddress.addressId) {
                        return newAddress;
                    }
                    return address;
                });
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
