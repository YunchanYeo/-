import { fetchUserCenter } from '../../services/usercenter/fetchUsercenter';
import Toast from 'tdesign-miniprogram/toast/index';
import { syncUserProfileByWeChat } from '../../services/auth/session';
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
        tabType: 60,
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
Page({
    data: getDefaultData(),
    onLoad() {
        this.getVersionInfo();
    },
    onShow() {
        this.getTabBar().init();
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
            .then(({ userInfo, countsData, orderTagInfos: orderInfo, customerServiceInfo }) => {
                // eslint-disable-next-line no-unused-expressions
                menuData?.[0].forEach((v) => {
                    countsData.forEach((counts) => {
                        if (counts.type === v.type) {
                            // eslint-disable-next-line no-param-reassign
                            v.tit = counts.num;
                        }
                    });
                });
                const info = orderTagInfos.map((v, index) => ({
                    ...v,
                    ...orderInfo[index],
                }));
                const hasWechatProfile = !!(userInfo?.nickName || userInfo?.avatarUrl);
                this.setData({
                    userInfo,
                    menuData,
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
                Toast({
                    context: this,
                    selector: '#t-toast',
                    message: '你点击了帮助中心',
                    icon: '',
                    duration: 1000,
                });
                break;
            }
            case 'point': {
                Toast({
                    context: this,
                    selector: '#t-toast',
                    message: '你点击了积分菜单',
                    icon: '',
                    duration: 1000,
                });
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
        try {
            await syncUserProfileByWeChat();
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
