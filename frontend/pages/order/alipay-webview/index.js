'use strict';
Page({
    data: {
        src: '',
    },
    onLoad(options) {
        const raw = options.src ? decodeURIComponent(options.src) : '';
        this.setData({ src: raw });
    },
});
