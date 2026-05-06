import Toast from 'tdesign-miniprogram/toast/index';
import Dialog from 'tdesign-miniprogram/dialog/index';
import { OrderButtonTypes } from '../../config';
import { cancelOrder, confirmOrder, deleteOrder, payOrder } from '../../../../services/order/orderActions';
Component({
    options: {
        addGlobalClass: true,
    },
    properties: {
        order: {
            type: Object,
            observer(order) {
                // 判定有传goodsIndex ，则认为是商品button bar, 仅显示申请售后按钮
                if (this.properties?.goodsIndex !== null) {
                    const goods = order.goodsList[Number(this.properties.goodsIndex)];
                    this.setData({
                        buttons: {
                            left: [],
                            right: (goods.buttons || []).filter((b) => b.type == OrderButtonTypes.APPLY_REFUND),
                        },
                    });
                    return;
                }
                // 订单的button bar 不显示申请售后按钮
                const buttonsRight = (order.buttons || [])
                    // .filter((b) => b.type !== OrderButtonTypes.APPLY_REFUND)
                    .map((button) => {
                    //邀请好友拼团按钮
                    if (button.type === OrderButtonTypes.INVITE_GROUPON && order.groupInfoVo) {
                        const { groupInfoVo: { groupId, promotionId, remainMember, groupPrice }, goodsList, } = order;
                        const goodsImg = goodsList[0] && goodsList[0].imgUrl;
                        const goodsName = goodsList[0] && goodsList[0].name;
                        return {
                            ...button,
                            openType: 'share',
                            dataShare: {
                                goodsImg,
                                goodsName,
                                groupId,
                                promotionId,
                                remainMember,
                                groupPrice,
                                storeId: order.storeId,
                            },
                        };
                    }
                    return button;
                });
                // 删除订单按钮单独挪到左侧
                const deleteBtnIndex = buttonsRight.findIndex((b) => b.type === OrderButtonTypes.DELETE);
                let buttonsLeft = [];
                if (deleteBtnIndex > -1) {
                    buttonsLeft = buttonsRight.splice(deleteBtnIndex, 1);
                }
                this.setData({
                    buttons: {
                        left: buttonsLeft,
                        right: buttonsRight,
                    },
                });
            },
        },
        goodsIndex: {
            type: Number,
            value: null,
        },
        isBtnMax: {
            type: Boolean,
            value: false,
        },
    },
    data: {
        order: {},
        buttons: {
            left: [],
            right: [],
        },
    },
    methods: {
        // 点击【订单操作】按钮，根据按钮类型分发
        onOrderBtnTap(e) {
            const { type } = e.currentTarget.dataset;
            switch (type) {
                case OrderButtonTypes.DELETE:
                    this.onDelete(this.data.order);
                    break;
                case OrderButtonTypes.CANCEL:
                    this.onCancel(this.data.order);
                    break;
                case OrderButtonTypes.CONFIRM:
                    this.onConfirm(this.data.order);
                    break;
                case OrderButtonTypes.PAY:
                    this.onPay(this.data.order);
                    break;
                case OrderButtonTypes.APPLY_REFUND:
                    this.onApplyRefund(this.data.order);
                    break;
                case OrderButtonTypes.VIEW_REFUND:
                    this.onViewRefund(this.data.order);
                    break;
                case OrderButtonTypes.COMMENT:
                    this.onAddComment(this.data.order);
                    break;
                case OrderButtonTypes.INVITE_GROUPON:
                    //分享邀请好友拼团
                    break;
                case OrderButtonTypes.REBUY:
                    this.onBuyAgain(this.data.order);
                    break;
                case OrderButtonTypes.DELIVERY:
                    this.onDelivery(this.data.order);
                    break;
            }
        },
        onCancel(order) {
            const orderNo = order?.orderNo;
            if (!orderNo)
                return;
            Dialog.confirm({
                title: '确认取消订单？',
                content: '取消后可在已取消订单中查看',
                confirmBtn: '确认取消',
                cancelBtn: '我再想想',
            })
                .then(async () => {
                await cancelOrder(orderNo);
                Toast({
                    context: this,
                    selector: '#t-toast',
                    message: '订单已取消',
                    icon: 'check-circle',
                });
                this.triggerEvent('refresh');
            })
                .catch(() => { });
        },
        onConfirm(order) {
            const orderNo = order?.orderNo;
            if (!orderNo)
                return;
            Dialog.confirm({
                title: '确认是否已经收到货？',
                content: '',
                confirmBtn: '确认收货',
                cancelBtn: '取消',
            })
                .then(async () => {
                await confirmOrder(orderNo);
                Toast({
                    context: this,
                    selector: '#t-toast',
                    message: '确认收货成功',
                    icon: 'check-circle',
                });
                this.triggerEvent('refresh');
            })
                .catch((e) => {
                Toast({
                    context: this,
                    selector: '#t-toast',
                    message: e?.message || '操作已取消',
                    icon: '',
                });
            });
        },
        async onPay(order) {
            const orderNo = order?.orderNo;
            if (!orderNo)
                return;
            try {
                await payOrder(orderNo);
                Toast({
                    context: this,
                    selector: '#t-toast',
                    message: '支付成功（开发模式）',
                    icon: 'check-circle',
                });
                this.triggerEvent('refresh');
            }
            catch (e) {
                Toast({
                    context: this,
                    selector: '#t-toast',
                    message: e?.message || '支付失败',
                    icon: '',
                });
            }
        },
        onBuyAgain(order) {
            const first = order?.goodsList?.[0];
            if (first?.spuId) {
                wx.navigateTo({
                    url: `/pages/goods/details/index?spuId=${first.spuId}`,
                });
                return;
            }
            Toast({
                context: this,
                selector: '#t-toast',
                message: '暂无可购买商品',
                icon: '',
            });
        },
        async onDelete(order) {
            const orderNo = order?.orderNo;
            if (!orderNo)
                return;
            Dialog.confirm({
                title: '确认删除订单？',
                content: '',
                confirmBtn: '删除',
                cancelBtn: '取消',
            })
                .then(async () => {
                await deleteOrder(orderNo);
                Toast({
                    context: this,
                    selector: '#t-toast',
                    message: '订单已删除',
                    icon: 'check-circle',
                });
                this.triggerEvent('refresh');
            })
                .catch(() => { });
        },
        onApplyRefund(order) {
            const goods = order.goodsList[this.properties.goodsIndex];
            const params = {
                orderNo: order.orderNo,
                skuId: goods?.skuId ?? '19384938948343',
                spuId: goods?.spuId ?? '28373847384343',
                orderStatus: order.status,
                logisticsNo: order.logisticsNo,
                price: goods?.price ?? 89,
                num: goods?.num ?? 89,
                createTime: order.createTime,
                orderAmt: order.totalAmount,
                payAmt: order.amount,
                canApplyReturn: true,
            };
            const paramsStr = Object.keys(params)
                .map((k) => `${k}=${params[k]}`)
                .join('&');
            wx.navigateTo({ url: `/pages/order/apply-service/index?${paramsStr}` });
        },
        onViewRefund() {
            const { order } = this.data;
            if (!order?.orderNo) {
                return;
            }
            wx.navigateTo({
                url: `/pages/order/after-service-detail/index?rightsNo=${encodeURIComponent(`refund_${order.orderNo}`)}`,
            });
        },
        onDelivery(order) {
            if (!order?.orderNo)
                return;
            wx.navigateTo({
                url: `/pages/order/order-detail/index?orderNo=${encodeURIComponent(order.orderNo)}`,
            });
        },
        /** 添加订单评论 */
        onAddComment(order) {
            const imgUrl = order?.goodsList?.[0]?.thumb;
            const title = order?.goodsList?.[0]?.title;
            const specs = order?.goodsList?.[0]?.specs;
            wx.navigateTo({
                url: `/pages/goods/comments/create/index?specs=${specs}&title=${title}&orderNo=${order?.orderNo}&imgUrl=${imgUrl}`,
            });
        },
    },
});
