import { getCategoryList } from '../../services/good/fetchCategoryList';
Page({
    data: {
        list: [],
    },
    async init() {
        try {
            const result = await getCategoryList();
            this.setData({
                list: result,
            });
        }
        catch (error) {
            console.error('err:', error);
        }
    },
    onShow() {
        const tabBar = this.getTabBar && this.getTabBar();
        if (tabBar && typeof tabBar.init === 'function') {
            tabBar.init();
        }
    },
    onChange(e) {
        const item = e?.detail?.item;
        if (!item) {
            wx.navigateTo({
                url: '/pages/goods/list/index',
            });
            return;
        }
        wx.navigateTo({
            url: `/pages/goods/list/index?category=${encodeURIComponent(item.id || item.name || '')}`,
        });
    },
    onLoad() {
        this.init(true);
    },
});
