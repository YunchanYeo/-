import dayjs from 'dayjs';
import { fetchCouponList } from '../../../../services/coupon/index';
const emptyCouponImg = `https://tdesign.gtimg.com/miniprogram/template/retail/coupon/ordersure-coupon-newempty.png`;
Component({
    properties: {
        storeId: String,
        promotionGoodsList: {
            type: Array,
            value: [],
        },
        orderSureCouponList: {
            type: Array,
            value: [],
        },
        couponsShow: {
            type: Boolean,
            value: false,
            observer(couponsShow) {
                if (couponsShow) {
                    const { promotionGoodsList, orderSureCouponList, storeId } = this.data;
                    const products = promotionGoodsList &&
                        promotionGoodsList.map((goods) => {
                            this.storeId = goods.storeId;
                            return {
                                skuId: goods.skuId,
                                spuId: goods.spuId,
                                storeId: goods.storeId,
                                selected: true,
                                quantity: goods.num,
                                prices: {
                                    sale: goods.settlePrice,
                                },
                            };
                        });
                    const selectedCoupons = orderSureCouponList &&
                        orderSureCouponList.map((ele) => {
                            return {
                                promotionId: ele.promotionId,
                                storeId: ele.storeId,
                                couponId: ele.couponId,
                            };
                        });
                    this.setData({
                        products,
                    });
                    this.coupons({ products, selectedCoupons, storeId }).then((res) => {
                        this.initData(res);
                    });
                }
            },
        },
    },
    data: {
        emptyCouponImg,
        goodsList: [],
        selectedList: [],
        couponsList: [],
        orderSureCouponList: [],
        promotionGoodsList: [],
    },
    methods: {
        initData(data = {}) {
            const { couponResultList = [], reduce = 0 } = data;
            const selectedList = [];
            let selectedNum = 0;
            const couponsList = couponResultList &&
                couponResultList.map((coupon) => {
                    const { status, couponVO } = coupon;
                    const { couponId, condition = '', endTime = 0, name = '', startTime = 0, value, type } = couponVO;
                    if (status === 1) {
                        selectedNum++;
                        selectedList.push({
                            couponId,
                            promotionId: String(couponId),
                            storeId: this.storeId,
                        });
                    }
                    const val = type === 2 ? value / 100 : value / 10;
                    return {
                        key: couponId,
                        title: name,
                        isSelected: status === 1,
                        timeLimit: `${dayjs(+startTime).format('YYYY-MM-DD')}-${dayjs(+endTime).format('YYYY-MM-DD')}`,
                        value: val,
                        status: status === -1 ? 'useless' : 'default',
                        desc: condition,
                        type,
                        tag: '',
                    };
                });
            this.setData({
                selectedList,
                couponsList,
                reduce,
                selectedNum,
            });
        },
        selectCoupon(e) {
            const { key } = e.currentTarget.dataset;
            const { couponsList, selectedList } = this.data;
            couponsList.forEach((coupon) => {
                if (coupon.key === key) {
                    coupon.isSelected = !coupon.isSelected;
                }
            });
            const couponSelected = couponsList
                .filter((coupon) => coupon.isSelected === true)
                .map((c) => ({ couponId: c.key, promotionId: String(c.key), storeId: this.storeId }));
            this.setData({
                selectedList: couponSelected,
                couponsList: [...couponsList],
            });
            this.triggerEvent('sure', {
                selectedList: couponSelected,
            });
        },
        hide() {
            this.setData({
                couponsShow: false,
            });
        },
        coupons(coupon = {}) {
            const selectedIds = new Set((coupon?.selectedCoupons || []).map((c) => Number(c.couponId)));
            return fetchCouponList('default').then((rows) => {
                const list = (Array.isArray(rows) ? rows : []).map((c) => ({
                    status: selectedIds.has(Number(c.couponId || c.id)) ? 1 : 0,
                    couponVO: {
                        couponId: Number(c.couponId || c.id),
                        condition: c.base ? `满${Number(c.base) / 100}元可用` : '无门槛',
                        endTime: Number(c.endTime || 0),
                        name: c.title || c.name || '优惠券',
                        startTime: Number(c.startTime || 0),
                        value: Number(c.value || 0),
                        type: c.type === 'discount' ? 1 : 2,
                    },
                }));
                const reduce = list
                    .filter((x) => x.status === 1 && x.couponVO.type === 2)
                    .reduce((sum, x) => sum + Number(x.couponVO.value || 0), 0);
                return { couponResultList: list, reduce };
            });
        },
    },
});
