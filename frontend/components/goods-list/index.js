"use strict";
Component({
    externalClasses: ['wr-class'],
    properties: {
        goodsList: {
            type: Array,
            value: [],
        },
        id: {
            type: String,
            value: '',
            observer: (id) => {
                this.genIndependentID(id);
            },
        },
        thresholds: {
            type: Array,
            value: [],
        },
        /** 2 = 两列网格（分类页）；默认 1 为原有双列大卡片换行 */
        gridColumns: {
            type: Number,
            value: 1,
        },
    },
    data: {
        independentID: '',
    },
    lifetimes: {
        ready() {
            this.init();
        },
    },
    methods: {
        onClickGoods(e) {
            const { index } = e.currentTarget.dataset;
            this.triggerEvent('click', { ...e.detail, index });
        },
        onAddCart(e) {
            const { index } = e.currentTarget.dataset;
            this.triggerEvent('addcart', { ...e.detail, index });
        },
        onClickGoodsThumb(e) {
            const { index } = e.currentTarget.dataset;
            this.triggerEvent('thumb', { ...e.detail, index });
        },
        init() {
            this.genIndependentID(this.id || '');
        },
        genIndependentID(id) {
            if (id) {
                this.setData({ independentID: id });
            }
            else {
                this.setData({
                    independentID: `goods-list-${~~(Math.random() * 10 ** 8)}`,
                });
            }
        },
    },
});
