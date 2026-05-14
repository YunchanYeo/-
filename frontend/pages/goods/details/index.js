import Toast from 'tdesign-miniprogram/toast/index';
import { fetchGood } from '../services/fetchGood';
import { fetchActivityList } from '../../../services/activity/fetchActivityList';
import { addItemToLocalCart } from '../../../services/cart/cart';
import { getGoodsDetailsCommentList, getGoodsDetailsCommentsCount, } from '../services/fetchGoodsDetailsComments';
import { getProductDataVersion } from '../../../services/good/productVersion';
import { cdnBase } from '../../../config/runtime';
import { normalizeGoodsImageUrl } from '../../../services/_utils/normalizeGoodsImageUrl';
const imgPrefix = `${cdnBase}/`;
const recLeftImg = `${imgPrefix}common/rec-left.png`;
const recRightImg = `${imgPrefix}common/rec-right.png`;
const defaultAnonCommentAvatar = 'https://tdesign.gtimg.com/mobile/demos/avatar1.jpeg';
const obj2Params = (obj = {}, encode = false) => {
    const result = [];
    Object.keys(obj).forEach((key) => result.push(`${key}=${encode ? encodeURIComponent(obj[key]) : obj[key]}`));
    return result.join('&');
};
function isDefaultSpecValue(value) {
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === '默认' || normalized === 'default' || normalized === '默认规格';
}
Page({
    data: {
        commentsList: [],
        commentsStatistics: {
            badCount: 0,
            commentCount: 0,
            goodCount: 0,
            goodRate: 0,
            hasImageCount: 0,
            middleCount: 0,
        },
        isShowPromotionPop: false,
        activityList: [],
        recLeftImg,
        recRightImg,
        details: {},
        goodsTabArray: [
            {
                name: '商品',
                value: '', // 空字符串代表置顶
            },
            {
                name: '详情',
                value: 'goods-page',
            },
        ],
        storeLogo: `${imgPrefix}common/store-logo.png`,
        storeName: '云mall标准版旗舰店',
        jumpArray: [
            {
                title: '首页',
                url: '/pages/home/home',
                iconName: 'home',
            },
            {
                title: '购物车',
                url: '/pages/cart/index',
                iconName: 'cart',
                showCartNum: true,
            },
        ],
        isStock: true,
        cartNum: 0,
        soldout: false,
        buttonType: 1,
        buyNum: 1,
        selectedAttrStr: '',
        skuArray: [],
        primaryImage: '',
        specImg: '',
        isSpuSelectPopupShow: false,
        isAllSelectedSku: false,
        buyType: 0,
        outOperateStatus: false, // 是否外层加入购物车
        operateType: 0,
        selectSkuSellsPrice: 0,
        maxLinePrice: 0,
        minSalePrice: 0,
        maxSalePrice: 0,
        list: [],
        spuId: '',
        navigation: { type: 'fraction' },
        current: 0,
        autoplay: true,
        duration: 500,
        interval: 5000,
        soldNum: 0, // 已售数量
        intro: '',
        hasVisibleSpec: false,
    },
    handlePopupHide() {
        this.setData({
            isSpuSelectPopupShow: false,
        });
    },
    showSkuSelectPopup(type) {
        this.setData({
            buyType: type || 0,
            outOperateStatus: type >= 1,
            isSpuSelectPopupShow: true,
        });
    },
    buyItNow() {
        if (!this.data.hasVisibleSpec) {
            this.gotoBuy(1);
            return;
        }
        this.showSkuSelectPopup(1);
    },
    toAddCart() {
        if (!this.data.hasVisibleSpec) {
            this.addCart();
            return;
        }
        this.showSkuSelectPopup(2);
    },
    toNav(e) {
        const { url } = e.detail;
        wx.switchTab({
            url: url,
        });
    },
    showCurImg(e) {
        const { index } = e.detail;
        const { images } = this.data.details;
        wx.previewImage({
            current: images[index],
            urls: images, // 需要预览的图片http链接列表
        });
    },
    onPageScroll({ scrollTop }) {
        const goodsTab = this.selectComponent('#goodsTab');
        goodsTab && goodsTab.onScroll(scrollTop);
    },
    chooseSpecItem(e) {
        const { specList } = this.data.details;
        const { selectedSku, isAllSelectedSku } = e.detail;
        if (!isAllSelectedSku) {
            this.setData({
                selectSkuSellsPrice: 0,
            });
        }
        this.setData({
            isAllSelectedSku,
        });
        this.getSkuItem(specList, selectedSku);
    },
    getSkuItem(specList, selectedSku) {
        const { skuArray, primaryImage } = this.data;
        const selectedSkuValues = this.getSelectedSkuValues(specList, selectedSku);
        let selectedAttrStr = ` 件  `;
        selectedSkuValues.forEach((item) => {
            selectedAttrStr += `，${item.specValue}  `;
        });
        // eslint-disable-next-line array-callback-return
        const skuItem = skuArray.filter((item) => {
            let status = true;
            (item.specInfo || []).forEach((subItem) => {
                if (!selectedSku[subItem.specId] || selectedSku[subItem.specId] !== subItem.specValueId) {
                    status = false;
                }
            });
            if (status)
                return item;
        });
        this.selectSpecsName(selectedSkuValues.length > 0 ? selectedAttrStr : '');
        if (skuItem) {
            this.setData({
                selectItem: skuItem,
                selectSkuSellsPrice: skuItem.price || 0,
            });
        }
        else {
            this.setData({
                selectItem: null,
                selectSkuSellsPrice: 0,
            });
        }
        this.setData({
            specImg: skuItem && skuItem.skuImage ? skuItem.skuImage : primaryImage,
        });
    },
    // 获取已选择的sku名称
    getSelectedSkuValues(skuTree, selectedSku) {
        const normalizedTree = this.normalizeSkuTree(skuTree);
        return Object.keys(selectedSku).reduce((selectedValues, skuKeyStr) => {
            const skuValues = normalizedTree[skuKeyStr];
            const skuValueId = selectedSku[skuKeyStr];
            if (skuValueId !== '') {
                const skuValue = skuValues.filter((value) => {
                    return value.specValueId === skuValueId;
                })[0];
                skuValue && selectedValues.push(skuValue);
            }
            return selectedValues;
        }, []);
    },
    normalizeSkuTree(skuTree) {
        const normalizedTree = {};
        skuTree.forEach((treeItem) => {
            normalizedTree[treeItem.specId] = treeItem.specValueList;
        });
        return normalizedTree;
    },
    selectSpecsName(selectSpecsName) {
        if (selectSpecsName) {
            this.setData({
                selectedAttrStr: selectSpecsName,
            });
        }
        else {
            this.setData({
                selectedAttrStr: '',
            });
        }
    },
    addCart() {
        const { isAllSelectedSku, buyNum, details, selectItem } = this.data;
        const hasSpec = Array.isArray(details.specList) && details.specList.length > 0;
        if (hasSpec && !isAllSelectedSku) {
            Toast({
                context: this,
                selector: '#t-toast',
                message: '请选择规格',
                icon: '',
                duration: 1000,
            });
            return;
        }
        const fallbackSku = (this.data.skuArray || [])[0] || null;
        const finalSku = selectItem || fallbackSku;
        const qty = Math.max(1, Number(buyNum || 1));
        for (let i = 0; i < qty; i += 1) {
            addItemToLocalCart({
                spuId: details.spuId || this.data.spuId,
                skuId: finalSku?.skuId || details.spuId || this.data.spuId,
                storeId: '1',
                storeName: '默认门店',
                title: details.title,
                thumb: details.primaryImage,
                price: details.minSalePrice || this.data.minSalePrice || 0,
                stock: details.spuStockQuantity || 9999,
                specInfo: finalSku?.specInfo || [],
            });
        }
        this.handlePopupHide();
        Toast({
            context: this,
            selector: '#t-toast',
            message: '已加入购物车，正在返回首页',
            icon: '',
            duration: 800,
        });
        setTimeout(() => {
            wx.switchTab({ url: '/pages/home/home' });
        }, 500);
    },
    gotoBuy(type) {
        const { isAllSelectedSku, buyNum, hasVisibleSpec, skuArray, selectItem } = this.data;
        if (hasVisibleSpec && !isAllSelectedSku) {
            Toast({
                context: this,
                selector: '#t-toast',
                message: '请选择规格',
                icon: '',
                duration: 1000,
            });
            return;
        }
        this.handlePopupHide();
        const fallbackSku = (skuArray || [])[0] || null;
        const finalSku = type === 1 ? fallbackSku || selectItem : selectItem || fallbackSku;
        const query = {
            quantity: buyNum,
            storeId: '1',
            spuId: this.data.spuId,
            goodsName: this.data.details.title,
            skuId: finalSku?.skuId || this.data.spuId,
            available: this.data.details.available,
            price: this.data.details.minSalePrice,
            specInfo: this.data.details.specList?.map((item) => ({
                specTitle: item.title,
                specValue: item.specValueList[0].specValue,
            })),
            primaryImage: this.data.details.primaryImage,
            spuId: this.data.details.spuId,
            thumb: this.data.details.primaryImage,
            title: this.data.details.title,
        };
        let urlQueryStr = obj2Params({
            goodsRequestList: JSON.stringify([query]),
        });
        urlQueryStr = urlQueryStr ? `?${urlQueryStr}` : '';
        const path = `/pages/order/order-confirm/index${urlQueryStr}`;
        wx.navigateTo({
            url: path,
        });
    },
    specsConfirm() {
        const { buyType } = this.data;
        if (buyType === 1) {
            this.gotoBuy();
        }
        else {
            this.addCart();
        }
        // this.handlePopupHide();
    },
    changeNum(e) {
        this.setData({
            buyNum: e.detail.buyNum,
        });
    },
    closePromotionPopup() {
        this.setData({
            isShowPromotionPop: false,
        });
    },
    promotionChange(e) {
        const { index } = e.detail;
        wx.navigateTo({
            url: `/pages/promotion/promotion-detail/index?promotion_id=${index}`,
        });
    },
    showPromotionPopup() {
        this.setData({
            isShowPromotionPop: true,
        });
    },
    getDetail(spuId) {
        Promise.all([fetchGood(spuId), fetchActivityList()]).then((res) => {
            const [rawDetails, rawActivityList] = res;
            const details = {
                ...rawDetails,
            };
            details.specList = (rawDetails.specList || [])
                .map((spec) => ({
                ...spec,
                specValueList: (spec.specValueList || []).filter((valueItem) => !isDefaultSpecValue(valueItem.specValue)),
            }))
                .filter((spec) => (spec.specValueList || []).length > 0);
            const activityList = Array.isArray(rawActivityList) ? rawActivityList : [];
            const skuArray = [];
            const { skuList, primaryImage, isPutOnSale, minSalePrice, maxSalePrice, maxLinePrice, soldNum } = details;
            const visibleSpecIdSet = new Set((details.specList || []).map((spec) => spec.specId));
            skuList.forEach((item) => {
                skuArray.push({
                    skuId: item.skuId,
                    quantity: item.stockInfo ? item.stockInfo.stockQuantity : 0,
                    specInfo: (item.specInfo || []).filter((specItem) => visibleSpecIdSet.has(specItem.specId)),
                });
            });
            const promotionArray = [];
            activityList.forEach((item) => {
                promotionArray.push({
                    tag: item.promotionSubCode === 'MYJ' ? '满减' : '满折',
                    label: '满100元减99.9元',
                });
            });
            this.setData({
                details,
                intro: details.intro || details.description || `${details.brand || ''} ${details.company || ''}`.trim(),
                activityList,
                isStock: details.spuStockQuantity > 0,
                maxSalePrice: maxSalePrice ? parseInt(maxSalePrice) : 0,
                maxLinePrice: maxLinePrice ? parseInt(maxLinePrice) : 0,
                minSalePrice: minSalePrice ? parseInt(minSalePrice) : 0,
                list: promotionArray,
                skuArray: skuArray,
                primaryImage,
                soldout: isPutOnSale === 0,
                soldNum,
                hasVisibleSpec: details.specList.length > 0,
                selectItem: details.specList.length > 0 ? null : skuArray[0] || null,
                isAllSelectedSku: details.specList.length > 0 ? false : true,
            });
        });
    },
    async getCommentsList(spuId) {
        const sid = String(spuId ?? this.data.spuId ?? '').trim();
        if (!sid)
            return;
        try {
            const data = await getGoodsDetailsCommentList(sid);
            const homePageComments = Array.isArray(data?.homePageComments) ? data.homePageComments : [];
            const nextState = {
                commentsList: homePageComments.map((item) => {
                    const head = item.isAnonymity
                        ? defaultAnonCommentAvatar
                        : (normalizeGoodsImageUrl(item.userHeadUrl) || defaultAnonCommentAvatar);
                    return {
                        reviewId: item.id,
                        goodsSpu: item.spuId,
                        userName: item.userName || '',
                        commentScore: item.commentScore,
                        commentContent: item.commentContent || '用户未填写评价',
                        userHeadUrl: head,
                    };
                }),
            };
            this.setData(nextState);
        }
        catch (error) {
            console.error('comments error:', error);
        }
    },
    onShareAppMessage() {
        // 自定义的返回信息
        const { selectedAttrStr } = this.data;
        let shareSubTitle = '';
        if (selectedAttrStr.indexOf('件') > -1) {
            const count = selectedAttrStr.indexOf('件');
            shareSubTitle = selectedAttrStr.slice(count + 1, selectedAttrStr.length);
        }
        const customInfo = {
            imageUrl: this.data.details.primaryImage,
            title: this.data.details.title + shareSubTitle,
            path: `/pages/goods/details/index?spuId=${this.data.spuId}`,
        };
        return customInfo;
    },
    /** 获取评价统计 */
    async getCommentsStatistics(spuId) {
        const sid = String(spuId ?? this.data.spuId ?? '').trim();
        if (!sid)
            return;
        try {
            const data = await getGoodsDetailsCommentsCount(sid);
            const { badCount, commentCount, goodCount, goodRate, hasImageCount, middleCount } = data || {};
            const nextState = {
                commentsStatistics: {
                    badCount: parseInt(`${badCount ?? 0}`, 10),
                    commentCount: parseInt(`${commentCount ?? 0}`, 10),
                    goodCount: parseInt(`${goodCount ?? 0}`, 10),
                    goodRate: Math.floor(Number(goodRate || 0) * 10) / 10,
                    hasImageCount: parseInt(`${hasImageCount ?? 0}`, 10),
                    middleCount: parseInt(`${middleCount ?? 0}`, 10),
                },
            };
            this.setData(nextState);
        }
        catch (error) {
            console.error('comments statiistics error:', error);
        }
    },
    /** 跳转到评价列表 */
    navToCommentsListPage() {
        wx.navigateTo({
            url: `/pages/goods/comments/index?spuId=${this.data.spuId}`,
        });
    },
    onLoad(query) {
        const { spuId } = query;
        this.setData({
            spuId: spuId,
        });
        this._lastProductVersion = getProductDataVersion();
        this.getDetail(spuId);
        this.getCommentsList(spuId);
        this.getCommentsStatistics(spuId);
    },
    onShow() {
        const currentVersion = getProductDataVersion();
        if (this.data.spuId && this._lastProductVersion && this._lastProductVersion !== currentVersion) {
            this.getDetail(this.data.spuId);
        }
        this._lastProductVersion = currentVersion;
    },
});
