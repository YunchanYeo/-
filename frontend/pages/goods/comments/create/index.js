// import { getCommentDetail } from '../../../../services/good/comments/fetchCommentDetail';
import Toast from 'tdesign-miniprogram/toast/index';
import { submitOrderReview } from '../../../order/services/submitReview';

function parseProductIdFromSpuParam(spuIdRaw) {
    if (typeof spuIdRaw === 'number' && Number.isFinite(spuIdRaw) && spuIdRaw > 0)
        return spuIdRaw;
    const s = String(spuIdRaw ?? '').trim();
    if (!s)
        return NaN;
    const legacy = /^spu_(\d+)$/i.exec(s);
    if (legacy?.[1]) {
        const n = parseInt(legacy[1], 10);
        return Number.isFinite(n) && n > 0 ? n : NaN;
    }
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n > 0 ? n : NaN;
}
Page({
    data: {
        serviceRateValue: 1,
        goodRateValue: 5,
        conveyRateValue: 1,
        isAnonymous: false,
        uploadFiles: [],
        gridConfig: {
            width: 218,
            height: 218,
            column: 3,
        },
        isAllowedSubmit: false,
        imgUrl: '',
        title: '',
        goodsDetail: '',
        imageProps: {
            mode: 'aspectFit',
        },
        orderNo: '',
        spuId: '',
        skuId: '',
    },
    onLoad(options) {
        const orderNo = String(options.orderNo || '').trim();
        const spuId = String(options.spuId || '').trim();
        const skuId = String(options.skuId || '').trim();
        this.setData({
            imgUrl: decodeURIComponent(String(options.imgUrl || '')),
            title: decodeURIComponent(String(options.title || '')),
            goodsDetail: decodeURIComponent(String(options.specs || '')),
            orderNo,
            spuId,
            skuId,
        });
        this.textAreaValue = '';
    },
    onRateChange(e) {
        const { value } = e?.detail;
        const item = e?.currentTarget?.dataset?.item;
        this.setData({ [item]: value }, () => {
            this.updateButtonStatus();
        });
    },
    onAnonymousChange(e) {
        const status = !!e?.detail?.checked;
        this.setData({ isAnonymous: status });
    },
    handleSuccess(e) {
        const { files } = e.detail;
        this.setData({
            uploadFiles: files,
        });
    },
    handleRemove(e) {
        const { index } = e.detail;
        const { uploadFiles } = this.data;
        uploadFiles.splice(index, 1);
        this.setData({
            uploadFiles,
        });
    },
    onTextAreaChange(e) {
        const value = e?.detail?.value;
        this.textAreaValue = value;
        this.updateButtonStatus();
    },
    updateButtonStatus() {
        const { goodRateValue, isAllowedSubmit } = this.data;
        const text = String(this.textAreaValue || '').trim();
        const temp = goodRateValue >= 1 && text.length > 0;
        if (temp !== isAllowedSubmit)
            this.setData({ isAllowedSubmit: temp });
    },
    async onSubmitBtnClick() {
        const { isAllowedSubmit, orderNo, spuId, skuId, goodRateValue, isAnonymous } = this.data;
        if (!isAllowedSubmit)
            return;
        const productId = parseProductIdFromSpuParam(spuId);
        if (!orderNo || !Number.isFinite(productId)) {
            Toast({
                context: this,
                selector: '#t-toast',
                message: '缺少订单或商品，请从订单页进入评价',
                icon: '',
            });
            return;
        }
        try {
            await submitOrderReview(orderNo, {
                productId,
                score: goodRateValue,
                content: String(this.textAreaValue || '').trim(),
                isAnonymous: Boolean(isAnonymous),
                skuId: skuId || undefined,
            });
            Toast({
                context: this,
                selector: '#t-toast',
                message: '评价提交成功',
                icon: 'check-circle',
            });
            wx.navigateBack();
        }
        catch (e) {
            Toast({
                context: this,
                selector: '#t-toast',
                message: e?.message || '提交失败，请稍后重试',
                icon: '',
            });
        }
    },
});
