import { fetchUserCenter } from '../../services/usercenter/fetchUsercenter';
import Toast from 'tdesign-miniprogram/toast/index';
import { getToken, loginWithWeChat } from '../../services/auth/session';
import { requestJson } from '../../services/_utils/http';
const menuData = [
    [
        {
            title: '收货地址',
            tit: '',
            url: '',
            type: 'address',
        },
        {
            title: '优惠券',
            tit: '',
            url: '',
            type: 'coupon',
        },
        {
            title: '积分',
            tit: '',
            url: '',
            type: 'point',
        },
    ],
    [
        {
            title: '帮助中心',
            tit: '',
            url: '',
            type: 'help-center',
        },
        {
            title: '客服热线',
            tit: '',
            url: '',
            type: 'service',
            icon: 'service',
        },
    ],
];
const orderTagInfos = [
    {
        title: '待付款',
        iconName: 'wallet',
        orderNum: 0,
        tabType: 5,
        status: 1,
    },
    {
        title: '待发货',
        iconName: 'deliver',
        orderNum: 0,
        tabType: 10,
        status: 1,
    },
    {
        title: '待收货',
        iconName: 'package',
        orderNum: 0,
        tabType: 40,
        status: 1,
    },
    {
        title: '待评价',
        iconName: 'comment',
        orderNum: 0,
        tabType: 50,
        status: 1,
    },
    {
        title: '退款/售后',
        iconName: 'exchang',
        orderNum: 0,
        tabType: 0,
        status: 1,
    },
];
const getDefaultData = () => ({
    showMakePhone: false,
    userInfo: {
        avatarUrl: '',
        nickName: '正在登录...',
        phoneNumber: '',
    },
    menuData,
    orderTagInfos,
    customerServiceInfo: {},
    currAuthStep: 1,
    showKefu: true,
    versionNo: '',
});
function hasRealProfile(userInfo) {
    const nick = String(userInfo?.nickName || '').trim();
    const avatar = String(userInfo?.avatarUrl || '').trim();
    const hasRealNick = !!nick && nick !== '微信用户';
    const hasAvatar = !!avatar && !/icon-user-center-avatar/i.test(avatar);
    return hasRealNick || hasAvatar;
}
Page({
    data: getDefaultData(),
    onLoad() {
        this.getVersionInfo();
    },
    onShow() {
        const tabBar = this.getTabBar && this.getTabBar();
        if (tabBar && typeof tabBar.init === 'function') {
            tabBar.init();
        }
        this.init();
    },
    onPullDownRefresh() {
        this.init();
    },
    init() {
        this.fetUseriInfoHandle();
    },
    fetUseriInfoHandle() {
        fetchUserCenter()
            .then(({ userInfo, countsData, orderTagInfos: orderInfo, customerServiceInfo, hasWechatProfile = false }) => {
                // eslint-disable-next-line no-unused-expressions
                menuData?.[0].forEach((v) => {
                    countsData.forEach((counts) => {
                        if (counts.type === v.type) {
                            // eslint-disable-next-line no-param-reassign
                            v.tit = counts.num;
                        }
                    });
                });
                const couponCount = Number((countsData.find((c) => c.type === 'coupon') || {}).num || 0);
                const nextMenu = menuData.map((group, gi) => {
                    if (gi !== 0)
                        return group;
                    return group.filter((item) => item.type !== 'coupon' || couponCount > 0);
                });
                const info = orderTagInfos.map((v, index) => ({
                    ...v,
                    ...orderInfo[index],
                }));
                this.setData({
                    userInfo,
                    menuData: nextMenu,
                    orderTagInfos: info,
                    customerServiceInfo,
                    currAuthStep: hasWechatProfile ? 3 : 1,
                });
            })
            .catch(() => {
                const resetData = getDefaultData();
                resetData.userInfo = { avatarUrl: '', nickName: '', phoneNumber: '' };
                resetData.currAuthStep = 1;
                this.setData(resetData);
            })
            .finally(() => {
                wx.stopPullDownRefresh();
            });
    },
    onClickCell({ currentTarget }) {
        const { type } = currentTarget.dataset;
        switch (type) {
            case 'address': {
                wx.navigateTo({ url: '/pages/user/address/list/index' });
                break;
            }
            case 'service': {
                this.openServiceSelector();
                break;
            }
            case 'help-center': {
                wx.navigateTo({ url: '/pages/user/help-center/index' });
                break;
            }
            case 'point': {
                wx.navigateTo({ url: '/pages/user/points/index' });
                break;
            }
            case 'coupon': {
                wx.navigateTo({ url: '/pages/coupon/coupon-list/index' });
                break;
            }
            case 'admin': {
                wx.navigateTo({ url: '/pages/admin/login/index' });
                break;
            }
            default: {
                Toast({
                    context: this,
                    selector: '#t-toast',
                    message: '未知跳转',
                    icon: '',
                    duration: 1000,
                });
                break;
            }
        }
    },
    jumpNav(e) {
        const status = e.detail.tabType;
        if (status === 0) {
            wx.navigateTo({ url: '/pages/order/after-service-list/index' });
        }
        else {
            wx.navigateTo({ url: `/pages/order/order-list/index?status=${status}` });
        }
    },
    jumpAllOrder() {
        wx.navigateTo({ url: '/pages/order/order-list/index' });
    },
    openMakePhone() {
        this.setData({ showMakePhone: true });
    },
    openServiceSelector() {
        wx.showActionSheet({
            itemList: ['电话客服', '在线客服'],
            success: (res) => {
                if (res.tapIndex === 0) {
                    this.call();
                    return;
                }
                this.openCustomerService();
            },
            fail: () => { },
        });
    },
    openCustomerService() {
        const extInfoUrl = this.data.customerServiceInfo?.chatUrl || '';
        if (typeof wx.openCustomerServiceChat === 'function' && extInfoUrl) {
            wx.openCustomerServiceChat({
                extInfo: { url: extInfoUrl },
                corpId: this.data.customerServiceInfo?.corpId || '',
                success: () => { },
                fail: () => {
                    wx.navigateTo({ url: '/pages/user/support-chat/index' });
                },
            });
            return;
        }
        wx.navigateTo({ url: '/pages/user/support-chat/index' });
    },
    closeMakePhone() {
        this.setData({ showMakePhone: false });
    },
    call() {
        const phoneNumber = this.data.customerServiceInfo?.servicePhone;
        if (!phoneNumber) {
            Toast({
                context: this,
                selector: '#t-toast',
                message: '暂未配置客服电话',
                icon: '',
                duration: 1200,
            });
            return;
        }
        wx.makePhoneCall({
            phoneNumber,
        });
    },
    async gotoUserEditPage() {
        if (!getToken() || !hasRealProfile(this.data.userInfo)) {
            await this.handleLoginWithConsent();
            return;
        }
        wx.navigateTo({ url: '/pages/user/person-info/index' });
    },
    async handleLoginWithConsent() {
        try {
            const profileRes = await new Promise((resolve, reject) => {
                wx.getUserProfile({ desc: '用于展示头像昵称并完善会员资料', success: resolve, fail: reject });
            });
            const userInfo = profileRes?.userInfo || {};
            const loginData = await loginWithWeChat({
                nickName: userInfo.nickName || '',
                avatarUrl: userInfo.avatarUrl || '',
                gender: Number(userInfo.gender || 0),
            });
            if (!hasRealProfile(userInfo) && !hasRealProfile(loginData?.user || {})) {
                Toast({
                    context: this,
                    selector: '#t-toast',
                    message: '微信未返回头像昵称，请在个人资料页补充',
                    icon: '',
                    duration: 1600,
                });
            }
            const wechatAddress = await this.pickWechatAddress().catch(() => null);
            const addressPhone = String(wechatAddress?.telNumber || '').trim();
            let finalPhone = String(loginData?.user?.phoneNumber || '').trim() || addressPhone;
            if (!finalPhone) {
                finalPhone = await this.promptPhoneNumber();
            }
            if (finalPhone) {
                await requestJson('/api/me', { method: 'PUT', data: { phoneNumber: finalPhone } });
            }
            await this.syncAddressFromWechat(wechatAddress, {
                fallbackName: userInfo.nickName || '微信用户',
                fallbackPhone: finalPhone,
            });
            this.fetUseriInfoHandle();
            wx.navigateTo({ url: '/pages/user/person-info/index' });
        }
        catch (e) {
            const msg = e?.message || '';
            if (msg.includes('cancel')) {
                Toast({
                    context: this,
                    selector: '#t-toast',
                    message: '你已取消授权个人资料',
                    icon: '',
                    duration: 1200,
                });
                return;
            }
            Toast({
                context: this,
                selector: '#t-toast',
                message: '微信资料授权登录失败',
                icon: '',
                duration: 1200,
            });
        }
    },
    pickWechatAddress() {
        return new Promise((resolve, reject) => {
            wx.chooseAddress({
                success: resolve,
                fail: reject,
            });
        });
    },
    async syncAddressFromWechat(address, { fallbackName = '', fallbackPhone = '' } = {}) {
        if (!address)
            return;
        const name = String(address.userName || fallbackName || '').trim();
        const phone = String(address.telNumber || fallbackPhone || '').trim();
        if (!name || !phone)
            return;
        const existing = await requestJson('/api/addresses', { method: 'GET' }).catch(() => []);
        if (Array.isArray(existing) && existing.length > 0)
            return;
        await requestJson('/api/addresses', {
            method: 'POST',
            data: {
                name,
                phone,
                countryName: '中国',
                countryCode: String(address.nationalCode || ''),
                provinceName: String(address.provinceName || ''),
                provinceCode: '',
                cityName: String(address.cityName || ''),
                cityCode: '',
                districtName: String(address.countyName || ''),
                districtCode: '',
                detailAddress: String(address.detailInfo || ''),
                addressTag: '微信导入',
                isDefault: 1,
            },
        }).catch(() => { });
    },
    promptPhoneNumber() {
        return new Promise((resolve, reject) => {
            wx.showModal({
                title: '绑定手机号',
                content: '',
                editable: true,
                placeholderText: '11位手机号',
                confirmText: '保存',
                cancelText: '跳过',
                success: (res) => {
                    if (!res.confirm)
                        return resolve('');
                    const phone = String(res.content || '').trim();
                    if (!/^1\d{10}$/.test(phone)) {
                        return reject(new Error('手机号格式不正确'));
                    }
                    return resolve(phone);
                },
                fail: () => resolve(''),
            });
        });
    },
    getVersionInfo() {
        const versionInfo = wx.getAccountInfoSync();
        const { version, envVersion = __wxConfig } = versionInfo.miniProgram;
        this.setData({
            versionNo: envVersion === 'release' ? version : envVersion,
        });
    },
    gotoAdminLogin() {
        wx.navigateTo({ url: '/pages/admin/login/index' });
    },
});
