import { fetchGoodsList } from '../../../services/good/fetchGoodsList';
import { addItemToLocalCart } from '../../../services/cart/cart';
import Toast from 'tdesign-miniprogram/toast/index';
import { getProductDataVersion } from '../../../services/good/productVersion';
const initFilters = {
    overall: 1,
    sorts: '',
    layout: 0,
};
Page({
    data: {
        goodsList: [],
        category: '',
        layout: 0,
        sorts: '',
        overall: 1,
        show: false,
        minVal: '',
        maxVal: '',
        filter: initFilters,
        hasLoaded: false,
        loadMoreStatus: 0,
        loading: true,
    },
    pageNum: 1,
    pageSize: 30,
    total: 0,
    handleFilterChange(e) {
        const { layout, overall, sorts } = e.detail;
        this.pageNum = 1;
        this.setData({
            layout,
            sorts,
            overall,
            loadMoreStatus: 0,
        });
        this.init(true);
    },
    generalQueryData(reset = false) {
        const { filter, keywords, minVal, maxVal, category } = this.data;
        const { pageNum, pageSize } = this;
        const { sorts, overall } = filter;
        const params = {
            sort: 0, // 0 综合，1 价格
            pageNum: 1,
            pageSize: 30,
            keyword: keywords,
        };
        if (category) {
            params.category = category;
        }
        if (sorts) {
            params.sort = 1;
            params.sortType = sorts === 'desc' ? 1 : 0;
        }
        if (overall) {
            params.sort = 0;
        }
        else {
            params.sort = 1;
        }
        params.minPrice = minVal ? minVal * 100 : 0;
        params.maxPrice = maxVal ? maxVal * 100 : undefined;
        if (reset)
            return params;
        return {
            ...params,
            pageNum: pageNum + 1,
            pageSize,
        };
    },
    async init(reset = true) {
        const { loadMoreStatus, goodsList = [] } = this.data;
        const params = this.generalQueryData(reset);
        if (loadMoreStatus !== 0)
            return;
        this.setData({
            loadMoreStatus: 1,
            loading: true,
        });
        try {
            const result = await fetchGoodsList(params);
            const code = 'Success';
            const data = result;
            if (code.toUpperCase() === 'SUCCESS') {
                const { spuList, totalCount = 0 } = data;
                if (totalCount === 0 && reset) {
                    this.total = totalCount;
                    this.setData({
                        emptyInfo: {
                            tip: '抱歉，未找到相关商品',
                        },
                        hasLoaded: true,
                        loadMoreStatus: 0,
                        loading: false,
                        goodsList: [],
                    });
                    return;
                }
                const _goodsList = reset ? spuList : goodsList.concat(spuList);
                const _loadMoreStatus = _goodsList.length === totalCount ? 2 : 0;
                this.pageNum = params.pageNum || 1;
                this.total = totalCount;
                this.setData({
                    goodsList: _goodsList,
                    loadMoreStatus: _loadMoreStatus,
                });
            }
            else {
                this.setData({
                    loading: false,
                });
                wx.showToast({
                    title: '查询失败，请稍候重试',
                });
            }
        }
        catch (error) {
            this.setData({
                loading: false,
            });
        }
        this.setData({
            hasLoaded: true,
            loading: false,
        });
    },
    onLoad() {
        const opts = this.options || {};
        const category = opts?.category ? decodeURIComponent(opts.category) : '';
        this.setData({ category });
        this._lastProductVersion = getProductDataVersion();
        this.init(true);
    },
    onShow() {
        const currentVersion = getProductDataVersion();
        if (this.data.hasLoaded && this._lastProductVersion && this._lastProductVersion !== currentVersion) {
            this.pageNum = 1;
            this.setData({ loadMoreStatus: 0 });
            this.init(true);
        }
        this._lastProductVersion = currentVersion;
    },
    onPullDownRefresh() {
        this.pageNum = 1;
        this.setData({ loadMoreStatus: 0 }, async () => {
            try {
                await this.init(true);
            }
            finally {
                wx.stopPullDownRefresh();
            }
        });
    },
    onReachBottom() {
        const { goodsList } = this.data;
        const { total = 0 } = this;
        if (goodsList.length === total) {
            this.setData({
                loadMoreStatus: 2,
            });
            return;
        }
        this.init(false);
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
        addItemToLocalCart({
            spuId: goods.spuId,
            skuId: goods.spuId,
            storeId: goods.storeId || '1',
            storeName: goods.storeName || '默认门店',
            title: goods.title,
            thumb: goods.thumb,
            price: goods.price,
            stock: 9999,
        });
        Toast({
            context: this,
            selector: '#t-toast',
            message: '已加入购物车',
        });
    },
    tagClickHandle() {
        Toast({
            context: this,
            selector: '#t-toast',
            message: '点击标签',
        });
    },
    gotoGoodsDetail(e) {
        const { index } = e.detail;
        const { spuId } = this.data.goodsList[index];
        wx.navigateTo({
            url: `/pages/goods/details/index?spuId=${spuId}`,
        });
    },
    showFilterPopup() {
        this.setData({
            show: true,
        });
    },
    showFilterPopupClose() {
        this.setData({
            show: false,
        });
    },
    onMinValAction(e) {
        const { value } = e.detail;
        this.setData({ minVal: value });
    },
    onMaxValAction(e) {
        const { value } = e.detail;
        this.setData({ maxVal: value });
    },
    reset() {
        this.setData({ minVal: '', maxVal: '' });
    },
    confirm() {
        const { minVal, maxVal } = this.data;
        let message = '';
        if (minVal && !maxVal) {
            message = `价格最小是${minVal}`;
        }
        else if (!minVal && maxVal) {
            message = `价格范围是0-${minVal}`;
        }
        else if (minVal && maxVal && minVal <= maxVal) {
            message = `价格范围${minVal}-${this.data.maxVal}`;
        }
        else {
            message = '请输入正确范围';
        }
        if (message) {
            Toast({
                context: this,
                selector: '#t-toast',
                message,
            });
        }
        this.pageNum = 1;
        this.setData({
            show: false,
            minVal: '',
            goodsList: [],
            loadMoreStatus: 0,
            maxVal: '',
        }, () => {
            this.init();
        });
    },
});
