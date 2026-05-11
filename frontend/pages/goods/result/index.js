/* eslint-disable no-param-reassign */
import { getSearchResult } from '../services/fetchSearchResult';
import Toast from 'tdesign-miniprogram/toast/index';
const initFilters = {
    overall: 1,
    sorts: '',
};
Page({
    data: {
        goodsList: [],
        sorts: '',
        overall: 1,
        show: false,
        minVal: '',
        maxVal: '',
        minSalePriceFocus: false,
        maxSalePriceFocus: false,
        filter: initFilters,
        hasLoaded: false,
        keywords: '',
        loadMoreStatus: 0,
        loading: true,
    },
    total: 0,
    pageNum: 1,
    pageSize: 30,
    _searchDebounceTimer: null,
    onLoad(options) {
        const { searchValue = '' } = options || {};
        this.setData({
            keywords: searchValue,
        }, () => {
            this.init(true);
        });
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
    generalQueryData(reset = false) {
        const { filter, keywords, minVal, maxVal } = this.data;
        const { pageNum, pageSize } = this;
        const { sorts, overall } = filter;
        const params = {
            sort: 0, // 0 综合，1 价格
            pageNum: 1,
            pageSize: 30,
            keyword: keywords,
        };
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
            const result = await getSearchResult(params);
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
                _goodsList.forEach((v) => {
                    v.tags = v.spuTagList.map((u) => u.title);
                    v.hideKey = { desc: true };
                });
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
    handleCartTap() {
        wx.switchTab({
            url: '/pages/cart/index',
        });
    },
    handleSubmit(e) {
        const nextKeywords = String(e?.detail?.value || this.data.keywords || '').trim();
        this.pageNum = 1;
        this.setData({
            keywords: nextKeywords,
            goodsList: [],
            loadMoreStatus: 0,
        }, () => {
            this.init(true);
        });
    },
    handleSearchChange(e) {
        const raw = e?.detail?.value ?? e?.detail ?? '';
        const nextKeywords = String(raw || '');
        this.setData({ keywords: nextKeywords });
        if (this._searchDebounceTimer) {
            clearTimeout(this._searchDebounceTimer);
        }
        // 1글자 입력부터 즉시 매칭되게(검색 UX 개선)
        this._searchDebounceTimer = setTimeout(() => {
            this.pageNum = 1;
            this.setData({
                goodsList: [],
                loadMoreStatus: 0,
            }, () => {
                this.init(true);
            });
        }, 80);
    },
    onUnload() {
        if (this._searchDebounceTimer) {
            clearTimeout(this._searchDebounceTimer);
            this._searchDebounceTimer = null;
        }
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
    handleAddCart() {
        Toast({
            context: this,
            selector: '#t-toast',
            message: '点击加购',
        });
    },
    gotoGoodsDetail(e) {
        const { index } = e.detail;
        const { spuId } = this.data.goodsList[index];
        wx.navigateTo({
            url: `/pages/goods/details/index?spuId=${spuId}`,
        });
    },
    handleFilterChange(e) {
        const { overall, sorts } = e.detail;
        const _filter = {
            sorts,
            overall,
        };
        this.setData({
            filter: _filter,
            sorts,
            overall,
        });
        this.pageNum = 1;
        this.setData({
            goodsList: [],
            loadMoreStatus: 0,
        }, () => {
            this.init(true);
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
        const minN = minVal === '' ? null : Number(minVal);
        const maxN = maxVal === '' ? null : Number(maxVal);
        if ((minN != null && !Number.isFinite(minN)) || (maxN != null && !Number.isFinite(maxN)) || (minN != null && maxN != null && minN > maxN)) {
            Toast({ context: this, selector: '#t-toast', message: '请输入正确价格范围' });
            return;
        }
        this.pageNum = 1;
        this.setData({
            show: false,
            goodsList: [],
            loadMoreStatus: 0,
        }, () => {
            this.init(true);
        });
    },
});
