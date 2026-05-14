import { fetchUserCenter } from '../../services/usercenter/fetchUsercenter';
import Toast from 'tdesign-miniprogram/toast/index';
import { getToken, getUser, oneClickLoginByWeChatPhoneCode, loginWithWeChat } from '../../services/auth/session';
import { extractWeChatPhoneNumberDetail } from '../../services/auth/extractWeChatPhoneNumberDetail';
import { touchRequirePrivacyAuthorizeIfSupported } from '../../services/privacy/touchRequirePrivacyAuthorize';
import { requestJson } from '../../services/_utils/http';
import { normalizeGoodsImageUrl } from '../../services/_utils/normalizeGoodsImageUrl';
import { displayNameForUserCenter } from '../../services/usercenter/displayNameForUserCenter';
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
    showPrivacyPopup: false,
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
    const phone = String(userInfo?.phoneNumber || '').trim();
    const hasRealNick = !!nick && nick !== '微信用户';
    const hasAvatar = !!avatar && !/icon-user-center-avatar/i.test(avatar);
    return hasRealNick || hasAvatar || /^1\d{10}$/.test(phone);
}
/** wx.chooseAddress 成功回调统一为「微信通讯地址」字段（勿用头像昵称兜底收件人） */
function normalizeChooseAddressPayload(res) {
    if (!res || typeof res !== 'object')
        return null;
    const r = res.detail && typeof res.detail === 'object' ? res.detail : res;
    const userName = String(r.userName ?? r.username ?? r.name ?? '').trim();
    const telNumber = String(r.telNumber ?? r.phoneNumber ?? r.mobile ?? '').replace(/\s/g, '');
    return {
        userName,
        telNumber,
        provinceName: String(r.provinceName ?? '').trim(),
        cityName: String(r.cityName ?? '').trim(),
        countyName: String(r.countyName ?? r.countryName ?? '').trim(),
        detailInfo: String(r.detailInfo ?? r.detailAddress ?? '').trim(),
        nationalCode: String(r.nationalCode ?? '').trim(),
    };
}
Page({
    data: getDefaultData(),
    onLoad() {
        this.getVersionInfo();
        this.setupNeedPrivacyAuthorization();
        touchRequirePrivacyAuthorizeIfSupported();
    },
    /** 微信隐私：getPhoneNumber 建议与 agreePrivacyAuthorization 耦合（基础库 ≥2.32.3）；未同意指引时单独 getPhoneNumber 常无 code */
    setupNeedPrivacyAuthorization() {
        if (this._needPrivacySetup || typeof wx.onNeedPrivacyAuthorization !== 'function') {
            return;
        }
        this._needPrivacySetup = true;
        wx.onNeedPrivacyAuthorization((resolve) => {
            this._privacyAuthorizeResolve = resolve;
            this.setData({ showPrivacyPopup: true });
        });
    },
    onPrivacyAgreePrivacyAuthorization(e) {
        const resolve = this._privacyAuthorizeResolve;
        this._privacyAuthorizeResolve = null;
        this.setData({ showPrivacyPopup: false });
        if (typeof resolve === 'function') {
            const btnId = (e && e.currentTarget && e.currentTarget.id) || (e && e.target && e.target.id) || 'usercenter-privacy-agree-btn';
            try {
                resolve({ buttonId: btnId, event: 'agree' });
            }
            catch (_) { /* ignore */ }
        }
    },
    onPrivacyDisagree() {
        const resolve = this._privacyAuthorizeResolve;
        this._privacyAuthorizeResolve = null;
        this.setData({ showPrivacyPopup: false });
        if (typeof resolve === 'function') {
            try {
                resolve({ event: 'disagree' });
            }
            catch (_) { /* ignore */ }
        }
    },
    noopPrivacyCatch() { },
    onShow() {
        touchRequirePrivacyAuthorizeIfSupported();
        const tabBar = this.getTabBar && this.getTabBar();
        if (tabBar && typeof tabBar.init === 'function') {
            tabBar.init();
        }
        this.init();
    },
    onPullDownRefresh() {
        this.init();
    },
    /** 个人中心顶部：从 auth.user（刚登录写入）立刻铺到界面，再等服务端 fetchUserCenter */
    applyHeaderFromStoredUser() {
        const me = getUser();
        if (!me || typeof me !== 'object' || !getToken()) {
            return;
        }
        const phone = String(me.phoneNumber || '').replace(/\s/g, '').trim();
        const nick = String(me.nickName || '').trim();
        this.setData({
            userInfo: {
                avatarUrl: normalizeGoodsImageUrl(String(me.avatarUrl || '')),
                nickName: displayNameForUserCenter(nick, phone),
                phoneNumber: phone,
            },
            currAuthStep: 3,
        });
    },
    init() {
        this.fetUseriInfoHandle();
    },
    fetUseriInfoHandle() {
        return fetchUserCenter()
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
                /** 已登录：个人中心统一用「已登录」资料卡（头像昵称以 DB+GET/me 为准，避免 step2 空白感） */
                const loggedIn = !!getToken();
                const currAuthStep = !loggedIn ? 1 : 3;
                this.setData({
                    userInfo,
                    menuData: nextMenu,
                    orderTagInfos: info,
                    customerServiceInfo,
                    currAuthStep,
                });
            })
            .catch(() => {
                if (getToken()) {
                    this.applyHeaderFromStoredUser();
                    return;
                }
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
        if (!getToken()) {
            Toast({
                context: this,
                selector: '#t-toast',
                message: '请先完成微信登录',
                icon: '',
                duration: 1400,
            });
            return;
        }
        wx.navigateTo({ url: '/pages/user/person-info/index' });
    },
    async onGetPhoneNumberLogin(e) {
        if (this._phoneLoginBusy) {
            return;
        }
        this._phoneLoginBusy = true;
        const { code: phoneCodeRaw, errMsg: errMsgRaw } = extractWeChatPhoneNumberDetail(e);
        const errMsg = String(errMsgRaw || '');
        const phoneCode = String(phoneCodeRaw || '').trim();
        if (!phoneCode) {
            const cancelled = errMsg.includes('fail user deny') || errMsg.includes('cancel');
            const privacyBlock = errMsg.includes('privacy permission') || errMsg.includes('privacy');
            const scopeUndeclared = errMsg.includes('112') || errMsg.includes('scope is not declared') || errMsg.includes('未在隐私协议');
            const devNoCode = errMsg.includes('not support') || errMsg.includes('模拟器') || errMsg.includes('devtools');
            let tip = cancelled ? '你已取消手机号授权' : '手机号授权失败';
            if (privacyBlock) {
                tip = '请先同意《小程序隐私保护指引》后再点击登录';
            }
            else if (scopeUndeclared) {
                tip = '请在微信公众平台「用户隐私保护指引」中声明收集手机号，约 5 分钟后重试';
            }
            else if (devNoCode && !cancelled) {
                tip = '当前环境可能无法返回手机号，请用真机预览或升级开发者工具';
            }
            Toast({
                context: this,
                selector: '#t-toast',
                message: tip,
                icon: '',
                duration: 1400,
            });
            this._phoneLoginBusy = false;
            return;
        }
        try {
            // 真机：在 getPhoneNumber 回调里再调 getUserProfile 常被判「非用户触摸」→ 授权失败；开发者工具较宽松故仅工具成功。
            // 本机手机号一键登录；头像昵称请到「个人资料」页用独立按钮授权（见 person-info / handleLoginWithConsent 流程）。
            await oneClickLoginByWeChatPhoneCode(phoneCode, {});
            await this.fetUseriInfoHandle();
            Toast({
                context: this,
                selector: '#t-toast',
                message: '手机号一键登录成功',
                icon: 'success',
                duration: 1200,
            });
        }
        catch (err) {
            const msg = String(err?.message || '');
            Toast({
                context: this,
                selector: '#t-toast',
                message: msg.includes('401') ? '手机号一键登录失败(401)，请确认微信后台AppID与服务器配置一致' : (err?.message || '手机号一键登录失败，请重试'),
                icon: '',
                duration: 1600,
            });
        }
        finally {
            this._phoneLoginBusy = false;
        }
    },
    /** 微信 code2session 登录（主入口） */
    async onWechatPrimaryLogin() {
        if (this._phoneLoginBusy) {
            return;
        }
        this._phoneLoginBusy = true;
        try {
            await loginWithWeChat(null);
            await this.fetUseriInfoHandle();
            Toast({
                context: this,
                selector: '#t-toast',
                message: '登录成功',
                icon: 'success',
                duration: 1200,
            });
        }
        catch (err) {
            const msg = String(err?.message || '');
            Toast({
                context: this,
                selector: '#t-toast',
                message: msg.includes('401') || msg.includes('40029') ? '微信登录失败，请检查网络与 AppID 配置' : (err?.message || '微信登录失败'),
                icon: '',
                duration: 1800,
            });
        }
        finally {
            this._phoneLoginBusy = false;
        }
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
            this.applyHeaderFromStoredUser();
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
                fallbackPhone: finalPhone,
            });
            await this.fetUseriInfoHandle();
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
    async pickWechatAddress() {
        const { getPermission } = require('../user/components/utils/getPermission');
        await getPermission({ code: 'scope.address', name: '通讯地址' });
        return new Promise((resolve, reject) => {
            wx.chooseAddress({
                success(res) {
                    const msg = String(res.errMsg || '');
                    if (msg && !msg.includes(':ok')) {
                        reject(new Error(msg));
                        return;
                    }
                    const out = normalizeChooseAddressPayload(res);
                    if (out && (out.userName || out.telNumber))
                        resolve(out);
                    else
                        reject(new Error('empty address'));
                },
                fail: reject,
            });
        });
    },
    /** 与已有地址完全重复时跳过，避免登录同步时「有任意一条就不保存」 */
    _addressFingerprintForDedupe(row) {
        const norm = (s) => String(s ?? '').trim().replace(/\s+/g, '');
        return [
            norm(row.phone),
            norm(row.provinceName),
            norm(row.cityName),
            norm(row.districtName),
            norm(row.detailAddress),
        ].join('\u001f');
    },
    /** 收件人·手机仅来自微信通讯地址；手机号绑定可用 fallbackPhone 补全 */
    async syncAddressFromWechat(address, { fallbackPhone = '' } = {}) {
        if (!address)
            return;
        const name = String(address.userName || '').trim();
        const phone = String(address.telNumber || fallbackPhone || '').replace(/\s/g, '');
        if (!name || !phone)
            return;
        const provinceName = String(address.provinceName || '');
        const cityName = String(address.cityName || '');
        const districtName = String(address.countyName || '');
        const detailAddress = String(address.detailInfo || '');
        const incomingKey = this._addressFingerprintForDedupe({
            phone,
            provinceName,
            cityName,
            districtName,
            detailAddress,
        });
        const existing = await requestJson('/api/addresses', { method: 'GET' }).catch(() => []);
        if (Array.isArray(existing) && existing.some((row) => this._addressFingerprintForDedupe(row) === incomingKey)) {
            return;
        }
        await requestJson('/api/addresses', {
            method: 'POST',
            data: {
                name,
                phone,
                countryName: '中国',
                countryCode: String(address.nationalCode || ''),
                provinceName,
                provinceCode: '',
                cityName,
                cityCode: '',
                districtName,
                districtCode: '',
                detailAddress,
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
