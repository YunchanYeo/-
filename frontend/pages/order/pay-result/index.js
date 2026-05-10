"use strict";
Page({
    data: {
        totalPaid: 0,
        orderNo: '',
        groupId: '',
        groupon: null,
        spu: null,
        adUrl: '',
        /** 支付渠道展示：与 order-confirm paySuccess 的 channel 一致 */
        payChannelLabel: '微信支付',
    },
    onLoad(options) {
        const { totalPaid = 0, orderNo = '', groupId = '' } = options;
        let channel = String(options.channel || options.payChannel || '').trim().toLowerCase();
        if (channel !== 'alipay' && channel !== 'wechat') {
            try {
                const stored = String(wx.getStorageSync('payResultChannel') || '').trim().toLowerCase();
                if (stored === 'alipay' || stored === 'wechat')
                    channel = stored;
            }
            catch (e) { }
        }
        try {
            wx.removeStorageSync('payResultChannel');
        }
        catch (e) { }
        const payChannelLabel = channel === 'alipay' ? '支付宝支付' : '微信支付';
        this.setData({
            totalPaid,
            orderNo,
            groupId,
            payChannelLabel,
        });
    },
    onTapReturn(e) {
        const target = e.currentTarget.dataset.type;
        const { orderNo } = this.data;
        if (target === 'home') {
            wx.switchTab({ url: '/pages/home/home' });
        }
        else if (target === 'orderList') {
            wx.navigateTo({
                url: `/pages/order/order-list/index?orderNo=${orderNo}`,
            });
        }
        else if (target === 'order') {
            wx.navigateTo({
                url: `/pages/order/order-detail/index?orderNo=${orderNo}`,
            });
        }
    },
    navBackHandle() {
        wx.navigateBack();
    },
});
