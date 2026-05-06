"use strict";
const statusMap = {
    default: { text: '去使用', theme: 'primary' },
    useless: { text: '已使用', theme: 'default' },
    disabled: { text: '已过期', theme: 'default' },
};
Component({
    options: {
        addGlobalClass: true,
        multipleSlots: true, // 在组件定义时的选项中启用多slot支持
    },
    externalClasses: ['coupon-class'],
    properties: {
        couponDTO: {
            type: Object,
            value: {}, // 优惠券数据
        },
    },
    data: {
        btnText: '',
        btnTheme: '',
    },
    observers: {
        couponDTO: function (couponDTO) {
            if (!couponDTO) {
                return;
            }
            const statusInfo = statusMap[couponDTO.status] || statusMap.default;
            this.setData({
                btnText: statusInfo.text,
                btnTheme: statusInfo.theme,
            });
        },
    },
    attached() { },
    methods: {
        // 跳转到详情页
        gotoDetail() {
            const id = this.data.couponDTO?.id || this.data.couponDTO?.key;
            if (!id)
                return;
            wx.navigateTo({
                url: `/pages/coupon/coupon-detail/index?id=${id}`,
            });
        },
        // 跳转到商品列表
        gotoGoodsList() {
            const id = this.data.couponDTO?.couponId || this.data.couponDTO?.id || this.data.couponDTO?.key;
            if (!id)
                return;
            wx.navigateTo({
                url: `/pages/coupon/coupon-activity-goods/index?id=${id}`,
            });
        },
    },
});
