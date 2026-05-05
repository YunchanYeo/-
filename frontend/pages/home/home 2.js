import { fetchHome } from '../../services/home/home';
import { fetchGoodsList } from '../../services/good/fetchGoods';
import { addItemToLocalCart } from '../../services/cart/cart';
import Toast from 'tdesign-miniprogram/toast/index';
import { getProductDataVersion } from '../../services/good/productVersion';
Page({
    data: {
        imgSrcs: [],
        tabList: [],
        goodsList: [],
        goodsListLoadStatus: 0,
        pageLoading: false,
        current: 1,
        autoplay: true,
        duration: '500',
        interval: 5000,
        navigation: { type: 'dots' },
        swiperImageProps: { mode: 'scaleToFill' },
    },
    goodListPagination: {
        index: 0,
        num: 20,
    },
    privateData: {
        tabIndex: 0,
    },
    onShow() {
        this.getTabBar().init();
        const currentVersion = getProductDataVersion();
        if (this._lastProductVersion && this._lastProductVersion !== currentVersion) {
            this.loadGoodsList(true);
        }
        this._lastProductVersion = currentVersion;
    },
    onLoad() {
        this._lastProductVersion = getProductDataVersion();
        this.init();
    },
    onReachBottom() {
        if (this.data.goodsListLoadStatus === 0) {
            this.loadGoodsList();
        }
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
            const { swiper, tabList } = await fetchHome();
            this.setData({
                tabList,
                imgSrcs: swiper,
            });
        }
        catch (err) {
            // 홈 상단 데이터가 실패해도 상품 목록 로딩은 계속 진행합니다.
            this.setData({
                tabList: [],
                imgSrcs: [],
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
        this.privateData.tabIndex = e.detail;
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
        this.setData({ goodsListLoadStatus: 1 });
        const pageSize = this.goodListPagination.num;
        let pageIndex = this.privateData.tabIndex * pageSize + this.goodListPagination.index + 1;
        if (fresh) {
            pageIndex = 0;
        }
        try {
            const nextList = await fetchGoodsList(pageIndex, pageSize);
            this.setData({
                goodsList: fresh ? nextList : this.data.goodsList.concat(nextList),
                goodsListLoadStatus: 0,
            });
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
});
