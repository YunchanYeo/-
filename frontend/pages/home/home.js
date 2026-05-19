import { fetchHome } from '../../services/home/home';
import { fetchGoodsList } from '../../services/good/fetchGoods';
import Toast from 'tdesign-miniprogram/toast/index';
import { getProductDataVersion } from '../../services/good/productVersion';
import { addItemToLocalCart } from '../../services/cart/cart';

const PENDING_CATEGORY_STORAGE_KEY = 'PENDING_CATEGORY_NAME';

function buildCategoryNav(tabList) {
    const tabs = Array.isArray(tabList) ? tabList : [];
    return tabs.slice(0, 10).map((tab, idx) => {
        const text = String(tab?.text || tab?.categoryName || '').trim() || '分类';
        return {
            key: tab?.key ?? idx,
            text,
            categoryName: String(tab?.categoryName || tab?.text || '').trim(),
            thumb: String(tab?.thumb || '').trim(),
        };
    });
}

Page({
    data: {
        imgSrcs: [],
        bannerItems: [],
        categoryNav: [],
        hotProducts: [],
        viewportClass: 'viewport-normal',
        goodsList: [],
        goodsListLoadStatus: 0,
        pageLoading: false,
        current: 0,
        searchPlaceholder: '搜索',
        autoplay: true,
        duration: '500',
        interval: 5000,
        scrollTop: 0,
    },
    goodListPagination: {
        index: 0,
        num: 20,
    },
    onShow() {
        const tabBar = this.getTabBar && this.getTabBar();
        if (tabBar && typeof tabBar.init === 'function') {
            tabBar.init();
        }
        // 分类图标可能由后台（Web 管理端）更新：该流程不会写入小程序本地 version，
        // 因此每次回到首页时都刷新顶部数据，确保首页分类图标及时生效。
        void this.refreshHomeMarketingStrip();
        const currentVersion = getProductDataVersion();
        if (this._lastProductVersion && this._lastProductVersion !== currentVersion) {
            void this.loadGoodsList(true, { softRefresh: true });
        }
        this._lastProductVersion = currentVersion;
    },
    onLoad() {
        this._lastProductVersion = getProductDataVersion();
        this.resolveViewportClass();
        this.init();
    },
    resolveViewportClass() {
        try {
            let w = 0;
            let h = 0;
            if (typeof wx.getWindowInfo === 'function') {
                const win = wx.getWindowInfo();
                w = Number(win?.windowWidth || 0);
                h = Number(win?.windowHeight || 0);
            }
            else if (typeof wx.getSystemInfoSync === 'function') {
                const info = wx.getSystemInfoSync();
                w = Number(info?.windowWidth || 0);
                h = Number(info?.windowHeight || 0);
            }
            const ratio = w > 0 ? h / w : 0;
            const viewportClass = ratio > 0 && ratio < 1.8 ? 'viewport-compact' : 'viewport-normal';
            this.setData({ viewportClass });
        }
        catch (e) {
            this.setData({ viewportClass: 'viewport-normal' });
        }
    },
    onReachBottom() {
        if (this.data.goodsListLoadStatus === 0) {
            void this.loadGoodsList();
        }
        if (this.data.goodsListLoadStatus === 2) {
            this.setData({ goodsListLoadStatus: 2 });
            clearTimeout(this._noMoreTimer);
            this._noMoreTimer = setTimeout(() => {
                this.setData({ goodsListLoadStatus: 0 });
                const target = Math.max(0, Number(this.data.scrollTop || 0) - 80);
                wx.pageScrollTo({ scrollTop: target, duration: 260 });
            }, 900);
        }
    },
    onPageScroll(e) {
        this.setData({ scrollTop: Number(e?.scrollTop || 0) });
    },
    onPullDownRefresh() {
        void this.loadHomePage();
    },
    init() {
        void this.loadHomePage();
    },
    goToCategoryPage(categoryName) {
        const name = String(categoryName || '').trim();
        if (name) {
            try {
                wx.setStorageSync(PENDING_CATEGORY_STORAGE_KEY, name);
            }
            catch (_) { /* ignore */ }
        }
        wx.switchTab({ url: '/pages/category/index' });
    },
    async refreshHomeMarketingStrip() {
        try {
            const { swiper, bannerItems = [], hotProducts = [], tabList = [] } = await fetchHome();
            const hotTitle = hotProducts[0]?.title || '';
            this.setData({
                imgSrcs: swiper,
                bannerItems,
                hotProducts,
                categoryNav: buildCategoryNav(tabList),
                searchPlaceholder: hotTitle ? `热销：${hotTitle}` : '搜索',
            });
        }
        catch (_) { /* 失败时保留旧轮播，避免闪空 */ }
    },
    async loadHomePage() {
        if (this._homeReloadLock) {
            wx.stopPullDownRefresh();
            return;
        }
        this._homeReloadLock = true;
        this.setData({ pageLoading: true });
        try {
            const { swiper, bannerItems = [], tabList, hotProducts = [] } = await fetchHome();
            const hotTitle = hotProducts[0]?.title || '';
            this.setData({
                imgSrcs: swiper,
                bannerItems,
                categoryNav: buildCategoryNav(tabList),
                hotProducts,
                searchPlaceholder: hotTitle ? `热销：${hotTitle}` : '搜索',
            });
        }
        catch (err) {
            this.setData({
                imgSrcs: [],
                bannerItems: [],
                categoryNav: [],
                hotProducts: [],
                searchPlaceholder: '搜索',
            });
        }
        finally {
            this.setData({ pageLoading: false });
        }
        try {
            await this.loadGoodsList(true, { softRefresh: true });
        }
        finally {
            this._homeReloadLock = false;
            wx.stopPullDownRefresh();
        }
    },
    onReTry() {
        void this.loadGoodsList();
    },
    async loadGoodsList(fresh = false, options = {}) {
        const { softRefresh = false } = options;
        const prevGoods = fresh && softRefresh ? (this.data.goodsList || []).slice() : null;
        this.setData({
            goodsListLoadStatus: 1,
            ...(fresh && !softRefresh ? { goodsList: [] } : {}),
        });
        const pageSize = this.goodListPagination.num;
        const pageIndex = fresh ? 0 : this.goodListPagination.index + 1;
        try {
            const nextList = await fetchGoodsList(pageIndex, pageSize);
            const merged = fresh ? nextList : this.data.goodsList.concat(nextList);
            const uniq = [];
            const seen = new Set();
            for (let i = 0; i < merged.length; i++) {
                const it = merged[i];
                const k = String(it?.spuId ?? it?.id ?? '').trim() || `_row_${i}`;
                if (seen.has(k))
                    continue;
                seen.add(k);
                uniq.push(it);
            }
            this.setData({
                goodsList: uniq,
                goodsListLoadStatus: nextList.length < pageSize ? 2 : 0,
            });
            if (nextList.length < pageSize) {
                clearTimeout(this._noMoreTimer);
                this._noMoreTimer = setTimeout(() => {
                    this.setData({ goodsListLoadStatus: 0 });
                }, 900);
            }
            this.goodListPagination.index = pageIndex;
            this.goodListPagination.num = pageSize;
        }
        catch (err) {
            const keepQuiet = softRefresh && prevGoods && prevGoods.length;
            this.setData({
                goodsListLoadStatus: keepQuiet ? 0 : 3,
                ...(prevGoods && prevGoods.length ? { goodsList: prevGoods } : {}),
            });
        }
    },
    goodListClickHandle(e) {
        const { index } = e.detail;
        const { spuId } = this.data.goodsList[index];
        wx.navigateTo({
            url: `/pages/goods/details/index?spuId=${spuId}`,
        });
    },
    goodListAddCartHandle(e) {
        const index = e?.detail?.index;
        const goodsFromEvent = e?.detail?.goods;
        const goods = goodsFromEvent || (typeof index === 'number' ? this.data.goodsList[index] : null);
        if (!goods) {
            Toast({
                context: this,
                selector: '#t-toast',
                message: '加入购物车失败，请重试',
            });
            return;
        }
        addItemToLocalCart({
            spuId: goods.spuId,
            skuId: goods.skuId || goods.spuId,
            storeId: goods.storeId || '1',
            storeName: goods.storeName || '默认门店',
            title: goods.title,
            thumb: goods.thumb || goods.primaryImage || goods.image || '',
            price: Number(goods.price || 0),
            stock: Number(goods.stock || goods.stockQuantity || 9999),
        });
        Toast({
            context: this,
            selector: '#t-toast',
            message: '已加入购物车',
        });
    },
    navToSearchPage() {
        wx.navigateTo({ url: '/pages/goods/search/index' });
    },
    navToCategoryPage() {
        this.goToCategoryPage('');
    },
    onCategoryNavTap(e) {
        const categoryName = String(e?.currentTarget?.dataset?.name || '').trim();
        if (!categoryName)
            return;
        this.goToCategoryPage(categoryName);
    },
    onBannerChange(e) {
        this.setData({ current: Number(e?.detail?.current || 0) });
    },
    onBannerClick(e) {
        const idx = Number(e?.currentTarget?.dataset?.index ?? e?.detail?.index ?? e?.detail?.current ?? 0);
        const items = this.data.bannerItems || [];
        const spuId = String(items[idx]?.spuId || '').trim();
        if (spuId) {
            wx.navigateTo({ url: `/pages/goods/details/index?spuId=${spuId}` });
            return;
        }
        const hot = this.data.hotProducts?.[0];
        if (hot?.spuId) {
            wx.navigateTo({ url: `/pages/goods/details/index?spuId=${hot.spuId}` });
        }
    },
    navToMarketingDetail(e) {
        const spuId = String(e?.currentTarget?.dataset?.spuid || '').trim();
        const promotionId = String(e?.currentTarget?.dataset?.promotionid || '').trim();
        if (spuId) {
            wx.navigateTo({ url: `/pages/goods/details/index?spuId=${spuId}` });
            return;
        }
        if (promotionId) {
            wx.navigateTo({ url: `/pages/promotion/promotion-detail/index?promotion_id=${promotionId}` });
            return;
        }
        Toast({
            context: this,
            selector: '#t-toast',
            message: '该活动暂不可用',
            duration: 1200,
        });
    },
    onUnload() {
        clearTimeout(this._noMoreTimer);
        this._noMoreTimer = null;
    },
});
