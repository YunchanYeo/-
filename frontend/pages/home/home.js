import { fetchHome } from '../../services/home/home';
import { fetchGoodsList } from '../../services/good/fetchGoods';
import Toast from 'tdesign-miniprogram/toast/index';
import { getProductDataVersion } from '../../services/good/productVersion';
import { addItemToLocalCart } from '../../services/cart/cart';
Page({
    data: {
        imgSrcs: [],
        tabList: [],
        hotProducts: [],
        viewportClass: 'viewport-normal',
        goodsList: [],
        goodsListLoadStatus: 0,
        pageLoading: false,
        current: 1,
        marketingCurrent: 0,
        searchPlaceholder: '搜索',
        autoplay: true,
        duration: '500',
        interval: 5000,
        navigation: { type: 'dots' },
        swiperImageProps: { mode: 'scaleToFill' },
        scrollTop: 0,
    },
    goodListPagination: {
        index: 0,
        num: 20,
    },
    privateData: {
        tabIndex: 0,
    },
    resolveSelectedTab(changeDetail) {
        const tabs = this.data.tabList || [];
        if (!tabs.length)
            return null;
        const raw = changeDetail && typeof changeDetail === 'object' && changeDetail.value !== undefined
            ? changeDetail.value
            : changeDetail;
        const keyAsNumber = Number(raw);
        const byKey = tabs.find((t) => Number(t?.key) === keyAsNumber || String(t?.key) === String(raw));
        if (byKey)
            return byKey;
        const idx = Number(raw);
        if (Number.isInteger(idx) && idx >= 0 && idx < tabs.length)
            return tabs[idx];
        return tabs[0] || null;
    },
    onShow() {
        const tabBar = this.getTabBar && this.getTabBar();
        if (tabBar && typeof tabBar.init === 'function') {
            tabBar.init();
        }
        const currentVersion = getProductDataVersion();
        if (this._lastProductVersion && this._lastProductVersion !== currentVersion) {
            this.loadGoodsList(true);
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
            const info = wx.getSystemInfoSync();
            const w = Number(info?.windowWidth || 0);
            const h = Number(info?.windowHeight || 0);
            const ratio = w > 0 ? h / w : 0;
            const viewportClass = ratio > 0 && ratio < 1.8 ? 'viewport-compact' : 'viewport-normal';
            this.setData({ viewportClass });
        }
        catch (e) {
            this.setData({ viewportClass: 'viewport-normal' });
        }
    },
    onReachBottom() {
        if (this.data.goodsListLoadStatus === 0)
            return void this.loadGoodsList();
        if (this.data.goodsListLoadStatus === 2) {
            // "没有更多了"는 잠깐만 보여주고, 살짝 위로 당겨 탄성처럼 보이게 처리
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
        this.init();
    },
    init() {
        this.loadHomePage();
    },
    async loadHomePage() {
        wx.stopPullDownRefresh();
        this.setData({
            pageLoading: true,
        });
        try {
            const { swiper, tabList, hotProducts = [] } = await fetchHome();
            const hotTitle = hotProducts[0]?.title || '';
            this.setData({
                tabList,
                imgSrcs: swiper,
                hotProducts,
                searchPlaceholder: hotTitle ? `热销：${hotTitle}` : '搜索',
            });
            const firstTab = (tabList || [])[0] || null;
            this.privateData.tabIndex = 0;
            this.privateData.tabKey = firstTab?.key ?? 0;
        }
        catch (err) {
            // 홈 상단 데이터가 실패해도 상품 목록 로딩은 계속 진행합니다.
            this.setData({
                tabList: [],
                imgSrcs: [],
                hotProducts: [],
                searchPlaceholder: '搜索',
            });
        }
        finally {
            this.setData({
                pageLoading: false,
            });
            this.loadGoodsList(true);
        }
    },
    tabChangeHandle(e) {
        const selected = this.resolveSelectedTab(e?.detail);
        const tabs = this.data.tabList || [];
        const selectedIndex = Math.max(0, tabs.findIndex((t) => t?.key === selected?.key));
        this.privateData.tabIndex = selectedIndex;
        this.privateData.tabKey = selected?.key;
        // 탭 변경 시 빈 상태/없음 안내가 남지 않게 리스트와 상태를 즉시 리셋
        this.setData({ goodsList: [], goodsListLoadStatus: 0 });
        this.goodListPagination.index = 0;
        this.loadGoodsList(true);
    },
    onReTry() {
        this.loadGoodsList();
    },
    async loadGoodsList(fresh = false) {
        if (fresh) {
            wx.pageScrollTo({
                scrollTop: 0,
            });
        }
        this.setData({ goodsListLoadStatus: 1, ...(fresh ? { goodsList: [] } : {}) });
        const pageSize = this.goodListPagination.num;
        const pageIndex = fresh ? 0 : this.goodListPagination.index + 1;
        try {
            const tabs = this.data.tabList || [];
            const tab = tabs.find((t) => t?.key === this.privateData.tabKey) || tabs[this.privateData.tabIndex] || null;
            const nextList = await fetchGoodsList(pageIndex, pageSize, {
                categoryId: tab?.categoryId ?? null,
                categoryName: String(tab?.categoryName || '').trim(),
            });
            const merged = fresh ? nextList : this.data.goodsList.concat(nextList);
            // 防御性去重：避免后端/缓存返回重复商品
            const uniq = [];
            const seen = new Set();
            for (const it of merged) {
                const k = String(it?.spuId ?? '');
                if (!k || seen.has(k))
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
            this.setData({ goodsListLoadStatus: 3 });
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
    navToActivityDetail({ detail }) {
        const { index: promotionID = 0 } = detail || {};
        wx.navigateTo({
            url: `/pages/promotion/promotion-detail/index?promotion_id=${promotionID}`,
        });
    },
    onMarketingChange(e) {
        this.setData({ marketingCurrent: Number(e?.detail?.current || 0) });
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
