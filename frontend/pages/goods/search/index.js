import { getSearchHistory, getSearchPopular, } from '../services/fetchSearchHistory';
const popularImageMap = [
    { keywords: ['面', '粉', '米线'], image: 'https://img.icons8.com/color/160/noodles.png' },
    { keywords: ['饼', '蛋糕', '面包'], image: 'https://img.icons8.com/color/160/cupcake.png' },
    { keywords: ['坚果', '瓜子', '花生'], image: 'https://img.icons8.com/color/160/almond.png' },
    { keywords: ['糖', '巧克力'], image: 'https://img.icons8.com/color/160/chocolate-bar.png' },
    { keywords: ['肉', '卤味'], image: 'https://img.icons8.com/color/160/steak.png' },
];
const fallbackPopularImage = 'https://img.icons8.com/color/160/search--v1.png';
function resolvePopularImage(word) {
    const text = String(word || '');
    const matched = popularImageMap.find((item) => item.keywords.some((keyword) => text.includes(keyword)));
    return matched?.image || fallbackPopularImage;
}
Page({
    data: {
        historyWords: [],
        popularWords: [],
        searchValue: '',
        dialog: {
            title: '确认删除当前历史记录',
            showCancelButton: true,
            message: '',
        },
        dialogShow: false,
    },
    deleteType: 0,
    deleteIndex: '',
    _searchTimer: null,
    onShow() {
        this.queryHistory();
        this.queryPopular();
    },
    onPullDownRefresh() {
        Promise.allSettled([this.queryHistory(), this.queryPopular()]).finally(() => {
            wx.stopPullDownRefresh();
        });
    },
    async queryHistory() {
        try {
            const data = await getSearchHistory();
            const code = 'Success';
            if (String(code).toUpperCase() === 'SUCCESS') {
                const { historyWords = [] } = data;
                this.setData({
                    historyWords,
                });
            }
        }
        catch (error) {
            console.error(error);
        }
    },
    async queryPopular() {
        try {
            const data = await getSearchPopular();
            const code = 'Success';
            if (String(code).toUpperCase() === 'SUCCESS') {
                const { popularWords = [] } = data;
                this.setData({
                    popularWords: popularWords.map((word) => ({
                        text: word,
                        image: resolvePopularImage(word),
                    })),
                });
            }
        }
        catch (error) {
            console.error(error);
        }
    },
    confirm() {
        const { historyWords } = this.data;
        const { deleteType, deleteIndex } = this;
        historyWords.splice(deleteIndex, 1);
        if (deleteType === 0) {
            this.setData({
                historyWords,
                dialogShow: false,
            });
        }
        else {
            this.setData({ historyWords: [], dialogShow: false });
        }
    },
    close() {
        this.setData({ dialogShow: false });
    },
    handleClearHistory() {
        const { dialog } = this.data;
        this.deleteType = 1;
        this.setData({
            dialog: {
                ...dialog,
                message: '确认删除所有历史记录',
            },
            dialogShow: true,
        });
    },
    deleteCurr(e) {
        const { index } = e.currentTarget.dataset;
        const { dialog } = this.data;
        this.deleteIndex = index;
        this.setData({
            dialog: {
                ...dialog,
                message: '确认删除当前历史记录',
                deleteType: 0,
            },
            dialogShow: true,
        });
    },
    handleHistoryTap(e) {
        const { historyWords } = this.data;
        const { dataset } = e.currentTarget;
        const _searchValue = historyWords[dataset.index || 0] || '';
        if (_searchValue) {
            wx.navigateTo({
                url: `/pages/goods/result/index?searchValue=${_searchValue}`,
            });
        }
    },
    handlePopularTap(e) {
        const { popularWords } = this.data;
        const { dataset } = e.currentTarget;
        const item = popularWords[dataset.index || 0];
        const searchValue = item?.text || '';
        if (searchValue) {
            wx.navigateTo({
                url: `/pages/goods/result/index?searchValue=${searchValue}`,
            });
        }
    },
    handleSubmit(e) {
        const value = String(e?.detail?.value || '').trim();
        if (value.length === 0)
            return;
        wx.navigateTo({
            url: `/pages/goods/result/index?searchValue=${value}`,
        });
    },
    handleSearchChange(e) {
        const value = String(e?.detail?.value || '').trim();
        this.setData({ searchValue: value });
        if (this._searchTimer) {
            clearTimeout(this._searchTimer);
        }
        if (!value) {
            return;
        }
        this._searchTimer = setTimeout(() => {
            wx.redirectTo({
                url: `/pages/goods/result/index?searchValue=${value}`,
            });
        }, 220);
    },
    onUnload() {
        if (this._searchTimer) {
            clearTimeout(this._searchTimer);
            this._searchTimer = null;
        }
    },
});
