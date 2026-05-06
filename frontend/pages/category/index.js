import { getCategoryList } from '../../services/good/fetchCategoryList';
import { fetchGoodsList } from '../../services/good/fetchGoodsList';
import { addItemToLocalCart } from '../../services/cart/cart';
import Toast from 'tdesign-miniprogram/toast/index';
Page({
    data: {
        list: [],
        activeIndex: 0,
        goodsList: [],
        hasLoaded: false,
        goodsLoading: false,
        currentCategory: '',
        categoryScrollPx: 500,
    },
    async init() {
        try {
            const result = await getCategoryList();
            const list = Array.isArray(result) ? result : [];
            this.setData({
                list,
                activeIndex: 0,
            });
            if (list.length > 0) {
                const firstName = list[0]?.name;
                if (firstName) {
                    await this.loadCategoryGoods(firstName);
                }
            }
            else {
                this.setData({ hasLoaded: true, goodsList: [] });
            }
        }
        catch (error) {
            console.error('err:', error);
            this.setData({ hasLoaded: true, goodsList: [] });
        }
        finally {
            this._categoryReady = true;
        }
    },
    /** 再次进入分类 Tab 时拉取最新分类（含管理端新增项）并刷新商品 */
    async refreshCategoriesFromApi() {
        try {
            const result = await getCategoryList();
            const list = Array.isArray(result) ? result : [];
            let activeIndex = this.data.activeIndex;
            if (activeIndex >= list.length) {
                activeIndex = Math.max(0, list.length - 1);
            }
            const { currentCategory } = this.data;
            const nameStill = list.some((c) => c.name === currentCategory);
            const targetName = nameStill ? currentCategory : list[activeIndex]?.name;
            this.setData({ list, activeIndex });
            if (targetName) {
                await this.loadCategoryGoods(targetName);
            }
            else {
                this.setData({ hasLoaded: true, goodsList: [] });
            }
        }
        catch (e) {
            console.warn('refreshCategoriesFromApi', e);
        }
    },
    onPickCategory(e) {
        const index = Number(e.currentTarget.dataset.index);
        if (!Number.isFinite(index)) {
            return;
        }
        const { list } = this.data;
        if (!Array.isArray(list) || !list[index]) {
            return;
        }
        const name = list[index].name;
        this.setData({ activeIndex: index });
        this.loadCategoryGoods(name);
    },
    async loadCategoryGoods(categoryName) {
        if (!categoryName) {
            return;
        }
        this.setData({ goodsLoading: true, currentCategory: categoryName });
        try {
            const result = await fetchGoodsList({ category: categoryName });
            const spuList = result?.spuList || [];
            this.setData({
                goodsList: spuList,
                hasLoaded: true,
            });
        }
        catch (e) {
            console.error(e);
            this.setData({
                goodsList: [],
                hasLoaded: true,
            });
            Toast({
                context: this,
                selector: '#t-toast',
                message: e?.message || '加载商品失败',
            });
        }
        finally {
            this.setData({ goodsLoading: false });
        }
    },
    onShow() {
        const tabBar = this.getTabBar && this.getTabBar();
        if (tabBar && typeof tabBar.init === 'function') {
            tabBar.init();
        }
        if (this._categoryReady) {
            this.refreshCategoriesFromApi();
        }
    },
    onPullDownRefresh() {
        Promise.resolve(this.refreshCategoriesFromApi()).finally(() => {
            wx.stopPullDownRefresh();
        });
    },
    gotoGoodsDetail(e) {
        const { index } = e.detail;
        const item = this.data.goodsList[index];
        if (!item?.spuId) {
            return;
        }
        wx.navigateTo({
            url: `/pages/goods/details/index?spuId=${item.spuId}`,
        });
    },
    handleAddCart(e) {
        const index = e?.detail?.index;
        const goods = typeof index === 'number' ? this.data.goodsList[index] : null;
        if (!goods) {
            Toast({
                context: this,
                selector: '#t-toast',
                message: '加购失败，请重试',
            });
            return;
        }
        const stock = Number(goods.stock ?? 0);
        addItemToLocalCart({
            spuId: goods.spuId,
            skuId: goods.spuId,
            storeId: goods.storeId || '1',
            storeName: goods.storeName || '默认门店',
            title: goods.title,
            thumb: goods.thumb,
            price: goods.price,
            stock: stock > 0 ? stock : 9999,
        });
        Toast({
            context: this,
            selector: '#t-toast',
            message: '已加入购物车',
        });
    },
    onLoad() {
        try {
            const sys = wx.getSystemInfoSync();
            const h = Number(sys.windowHeight) || 500;
            this.setData({ categoryScrollPx: h });
        }
        catch (_) {
            /* ignore */
        }
        this.init();
    },
});
