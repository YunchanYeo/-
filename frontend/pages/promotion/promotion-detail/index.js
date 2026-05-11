import Toast from 'tdesign-miniprogram/toast/index';
import { fetchPromotion } from '../../../services/promotion/detail';
Page({
    data: {
        list: [],
        banner: '',
        time: 0,
        showBannerDesc: false,
        statusTag: '',
        description: '',
        title: '营销详情',
    },
    onLoad(query) {
        const promotionID = parseInt(query.promotion_id);
        this.getGoodsList(promotionID);
    },
    getGoodsList(promotionID) {
        fetchPromotion(promotionID).then(({ list, banner, time, showBannerDesc, statusTag, description = '', title = '营销详情' }) => {
            const goods = list.map((item) => ({
                ...item,
                tags: (item.tags || []).map((v) => v.title),
            }));
            this.setData({
                list: goods,
                banner,
                time,
                showBannerDesc,
                statusTag,
                description,
                title,
            });
            wx.setNavigationBarTitle({ title });
        });
    },
    goodClickHandle(e) {
        const { index } = e.detail;
        const { spuId } = this.data.list[index];
        wx.navigateTo({ url: `/pages/goods/details/index?spuId=${spuId}` });
    },
    cardClickHandle() {
        Toast({
            context: this,
            selector: '#t-toast',
            message: '点击加购',
        });
    },
    bannerClickHandle() {
        wx.showModal({
            title: this.data.title || '营销详情',
            content: this.data.description || '暂无活动说明',
            showCancel: false,
            confirmText: '知道了',
        });
    },
});
