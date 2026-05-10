import Dialog from 'tdesign-miniprogram/dialog/index';
import Toast from 'tdesign-miniprogram/toast/index';
import { dispatchCommitPay } from '../../../services/order/orderConfirm';
import { requestJson } from '../../../services/_utils/http';
import { removePurchasedFromLocalCart } from '../../../services/cart/cart';
// 真实的提交支付
export const commitPay = (params) => {
    return dispatchCommitPay({
        goodsRequestList: params.goodsRequestList, // 待结算的商品集合
        invoiceRequest: params.invoiceRequest, // 发票信息
        // isIgnore: params.isIgnore || false, // 删掉 是否忽视库存不足和商品失效,继续结算,true=继续结算 购物车请赋值false
        userAddressReq: params.userAddressReq, // 地址信息(用户在购物选择更换地址)
        currency: params.currency || 'CNY', // 支付货币: 人民币=CNY，美元=USD
        logisticsType: params.logisticsType || 1, // 配送方式 0=无需配送 1=快递 2=商家 3=同城 4=自提
        // orderMark: params.orderMark, // 下单备注
        orderType: params.orderType || 0, // 订单类型 0=普通订单 1=虚拟订单
        payType: params.payType || 1, // 支付类型(0=线上、1=线下)
        totalAmount: params.totalAmount, // 新增字段"totalAmount"总的支付金额
        userName: params.userName, // 用户名
        payWay: 1,
        authorizationCode: '', //loginCode, // 登录凭证
        storeInfoList: params.storeInfoList, //备注信息列表
        couponList: params.couponList,
        groupInfo: params.groupInfo,
        payChannel: params.payChannel || 'wechat',
    });
};
export const paySuccess = (payOrderInfo) => {
    const { payAmt, tradeNo, groupId, promotionId, goodsRequestList } = payOrderInfo;
    requestJson(`/api/orders/${encodeURIComponent(tradeNo)}/paid`, { method: 'POST' }).catch(() => { });
    removePurchasedFromLocalCart(Array.isArray(goodsRequestList) ? goodsRequestList : []);
    // 支付成功
    Toast({
        context: this,
        selector: '#t-toast',
        message: '支付成功',
        duration: 2000,
        icon: 'check-circle',
    });
    const params = {
        totalPaid: payAmt,
        orderNo: tradeNo,
    };
    if (groupId) {
        params.groupId = groupId;
    }
    if (promotionId) {
        params.promotionId = promotionId;
    }
    const paramsStr = Object.keys(params)
        .map((k) => `${k}=${params[k]}`)
        .join('&');
    // 跳转支付结果页面
    wx.redirectTo({ url: `/pages/order/pay-result/index?${paramsStr}` });
};
export const payFail = (payOrderInfo, resultMsg) => {
    if (resultMsg === 'requestPayment:fail cancel' || resultMsg === 'requestVirtualPayment:fail cancel') {
        if (payOrderInfo.dialogOnCancel) {
            //结算页，取消付款，dialog提示
            Dialog.confirm({
                title: '是否放弃付款',
                content: '商品可能很快就会被抢空哦，是否放弃付款？',
                confirmBtn: '放弃',
                cancelBtn: '继续付款',
            }).then(() => {
                wx.redirectTo({ url: '/pages/order/order-list/index' });
            });
        }
        else {
            //订单列表页，订单详情页，取消付款，toast提示
            Toast({
                context: this,
                selector: '#t-toast',
                message: '支付取消',
                duration: 2000,
                icon: 'close-circle',
            });
        }
    }
    else {
        Toast({
            context: this,
            selector: '#t-toast',
            message: `支付失败：${resultMsg}`,
            duration: 2000,
            icon: 'close-circle',
        });
        setTimeout(() => {
            wx.redirectTo({ url: '/pages/order/order-list/index' });
        }, 2000);
    }
};
function requestWechatPay(payOrderInfo) {
    const payInfo = (() => {
        try {
            return typeof payOrderInfo.payInfo === 'string' ? JSON.parse(payOrderInfo.payInfo) : payOrderInfo.payInfo || {};
        }
        catch (e) {
            return {};
        }
    })();
    const { timeStamp, nonceStr, signType, paySign } = payInfo;
    return new Promise((resolve) => {
        wx.requestPayment({
            // 文档必填
            timeStamp: String(timeStamp || ''),
            nonceStr: String(nonceStr || ''),
            package: String(payInfo.package || ''),
            paySign: String(paySign || ''),
            // 文档默认 MD5，后端如果给 RSA 则以服务端为准
            signType: signType || 'MD5',
            success: function () {
                paySuccess(payOrderInfo);
                resolve();
            },
            fail: function (err) {
                payFail(payOrderInfo, err.errMsg);
            },
        });
    });
}
function requestVirtualPay(payOrderInfo) {
    const virtualPayInfo = (() => {
        try {
            return typeof payOrderInfo.virtualPayInfo === 'string'
                ? JSON.parse(payOrderInfo.virtualPayInfo)
                : payOrderInfo.virtualPayInfo || {};
        }
        catch (e) {
            return {};
        }
    })();
    const mode = virtualPayInfo.mode || 'game';
    const signDataObject = virtualPayInfo.signData || {};
    const signData = typeof signDataObject === 'string' ? signDataObject : JSON.stringify(signDataObject);
    return new Promise((resolve) => {
        if (!wx.canIUse || !wx.canIUse('requestVirtualPayment')) {
            payFail(payOrderInfo, '当前微信版本不支持虚拟支付');
            return resolve();
        }
        wx.requestVirtualPayment({
            mode,
            signData,
            success: function () {
                paySuccess(payOrderInfo);
                resolve();
            },
            fail: function (err) {
                payFail(payOrderInfo, err.errMsg);
            },
        });
    });
}
function requestPluginPay(payOrderInfo) {
    const pluginPaymentData = payOrderInfo.pluginPaymentData || {};
    return new Promise((resolve) => {
        if (!wx.canIUse || !wx.canIUse('requestPluginPayment')) {
            payFail(payOrderInfo, '当前微信版本不支持插件支付');
            return resolve();
        }
        wx.requestPluginPayment({
            data: pluginPaymentData,
            success: function () {
                paySuccess(payOrderInfo);
                resolve();
            },
            fail: function (err) {
                payFail(payOrderInfo, err.errMsg);
            },
        });
    });
}
function requestCommonPay(payOrderInfo) {
    const commonPayInfo = payOrderInfo.commonPayInfo || {};
    return new Promise((resolve) => {
        if (!wx.canIUse || !wx.canIUse('requestCommonPayment')) {
            payFail(payOrderInfo, '当前微信版本不支持通用支付');
            return resolve();
        }
        wx.requestCommonPayment({
            signData: typeof commonPayInfo.signData === 'string' ? commonPayInfo.signData : JSON.stringify(commonPayInfo.signData || {}),
            success: function () {
                paySuccess(payOrderInfo);
                resolve();
            },
            fail: function (err) {
                payFail(payOrderInfo, err.errMsg);
            },
        });
    });
}
function requestGlobalPay(payOrderInfo) {
    const globalPayInfo = payOrderInfo.globalPayInfo || {};
    if (!wx.createGlobalPayment) {
        return Promise.resolve(payFail(payOrderInfo, '当前微信版本不支持全球支付'));
    }
    const payment = wx.createGlobalPayment({
        isSandbox: !!globalPayInfo.isSandbox,
    });
    return new Promise((resolve) => {
        // 先弹支付方式选择器，再发起请求
        payment.openMethodPicker({
            success: () => {
                payment.requestGlobalPayment({
                    ...globalPayInfo.requestData,
                    success: function () {
                        paySuccess(payOrderInfo);
                        resolve();
                    },
                    fail: function (err) {
                        payFail(payOrderInfo, err.errMsg);
                    },
                });
            },
            fail: (err) => {
                payFail(payOrderInfo, err.errMsg);
            },
        });
    });
}
// 微信支付方式
export const wechatPayOrder = (payOrderInfo) => {
    return new Promise((resolve) => {
        // mock 결제 모드(개발용)면 바로 성공 처리
        if (payOrderInfo.isMockPay) {
            wx.showModal({
                title: '模拟支付',
                content: '当前是开发环境（mock）支付模式，是否直接标记为支付成功？',
                confirmText: '完成支付',
                cancelText: '取消',
                success: ({ confirm }) => {
                    if (confirm) {
                        paySuccess(payOrderInfo);
                    }
                    else {
                        payFail(payOrderInfo, 'requestPayment:fail cancel');
                    }
                    resolve();
                },
                fail: () => {
                    payFail(payOrderInfo, 'requestPayment:fail cancel');
                    resolve();
                },
            });
            return;
        }
        // 결제채널 라우팅 (문서별 API)
        const method = payOrderInfo.paymentMethod || 'requestPayment';
        if (method === 'requestVirtualPayment' || payOrderInfo.channel === 'virtual' || payOrderInfo.virtualPayInfo) {
            requestVirtualPay(payOrderInfo).then(resolve);
            return;
        }
        if (method === 'requestPluginPayment') {
            requestPluginPay(payOrderInfo).then(resolve);
            return;
        }
        if (method === 'requestCommonPayment') {
            requestCommonPay(payOrderInfo).then(resolve);
            return;
        }
        if (method === 'requestGlobalPayment') {
            requestGlobalPay(payOrderInfo).then(resolve);
            return;
        }
        // 기본값: 실물상품 결제는 wx.requestPayment
        requestWechatPay(payOrderInfo).then(resolve);
    });
};

/** 支付宝（手机网站支付）：web-view 打开服务端 wap-launch 返回的 HTML 表单 */
export const alipayPayOrder = (payOrderInfo) => {
    return new Promise((resolve) => {
        if (payOrderInfo.isMockPay) {
            wx.showModal({
                title: '模拟支付（支付宝）',
                content: '当前为开发环境 mock，是否直接标记为支付成功？',
                confirmText: '完成支付',
                cancelText: '取消',
                success: ({ confirm }) => {
                    if (confirm) {
                        paySuccess(payOrderInfo);
                    }
                    else {
                        payFail(payOrderInfo, 'requestPayment:fail cancel');
                    }
                    resolve();
                },
                fail: () => {
                    payFail(payOrderInfo, 'requestPayment:fail cancel');
                    resolve();
                },
            });
            return;
        }
        const url = payOrderInfo.alipayWebViewUrl;
        if (!url || typeof url !== 'string') {
            payFail(payOrderInfo, '缺少 alipayWebViewUrl，请配置 API_PUBLIC_BASE_URL 与支付宝参数');
            resolve();
            return;
        }
        wx.navigateTo({
            url: `/pages/order/alipay-webview/index?src=${encodeURIComponent(url)}`,
            fail: (err) => {
                payFail(payOrderInfo, err.errMsg || '无法打开支付页');
                resolve();
            },
            success: () => resolve(),
        });
    });
};
