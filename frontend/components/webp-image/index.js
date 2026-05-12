"use strict";
Component({
    externalClasses: ['t-class', 't-class-load'],
    properties: {
        loadFailed: {
            type: String,
            value: 'default',
        },
        loading: {
            type: String,
            value: 'default',
        },
        src: {
            type: String,
            value: '',
        },
        mode: {
            type: String,
            value: 'aspectFill',
        },
        webp: {
            type: Boolean,
            value: true,
        },
        lazyLoad: {
            type: Boolean,
            value: false,
        },
        showMenuByLongpress: {
            type: Boolean,
            value: false,
        },
    },
    data: {
        thumbHeight: 375,
        thumbWidth: 375,
        systemInfo: {},
    },
    lifetimes: {
        attached() {
            let systemInfo = {};
            try {
                if (typeof wx.getDeviceInfo === 'function')
                    systemInfo = wx.getDeviceInfo() || {};
                else if (typeof wx.getSystemInfoSync === 'function')
                    systemInfo = wx.getSystemInfoSync() || {};
            }
            catch (_) {
                systemInfo = {};
            }
            this.setData({ systemInfo });
        },
        ready() {
            const { mode } = this.properties;
            this.getRect('.J-image').then((res) => {
                if (res) {
                    const { width, height } = res;
                    this.setData(mode === 'heightFix'
                        ? {
                            thumbHeight: this.px2rpx(height) || 375,
                        }
                        : {
                            thumbWidth: this.px2rpx(width) || 375,
                        });
                }
            });
        },
    },
    methods: {
        px2rpx(px) {
            const sys = this.data.systemInfo || {};
            return (750 / (sys.screenWidth || 375)) * px;
        },
        getRect(selector) {
            return new Promise((resolve) => {
                if (!this.selectorQuery) {
                    this.selectorQuery = this.createSelectorQuery();
                }
                this.selectorQuery.select(selector).boundingClientRect(resolve).exec();
            });
        },
        onImageError(e) {
            this.triggerEvent('error', e.detail);
        },
        onLoad(e) {
            this.triggerEvent('load', e.detail);
        },
    },
});
