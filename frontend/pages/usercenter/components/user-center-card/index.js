"use strict";
const AuthStepType = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
};
Component({
    options: {
        multipleSlots: true,
    },
    properties: {
        currAuthStep: {
            type: Number,
            value: AuthStepType.ONE,
        },
        userInfo: {
            type: Object,
            value: {},
        },
        isNeedGetUserInfo: {
            type: Boolean,
            value: false,
        },
    },
    data: {
        AuthStepType,
        /** 父页面 setData 后强刷头像（部分基础库下 t-avatar 对同 prop 不触发重绘） */
        _cardAvatar: '',
        _cardNick: '',
    },
    observers: {
        userInfo(u) {
            if (!u || typeof u !== 'object') {
                this.setData({ _cardAvatar: '', _cardNick: '' });
                return;
            }
            this.setData({
                _cardAvatar: u.avatarUrl || '',
                _cardNick: u.nickName || '',
            });
        },
    },
    lifetimes: {
        attached() {
            const u = this.properties.userInfo || {};
            this.setData({
                _cardAvatar: u.avatarUrl || '',
                _cardNick: u.nickName || '',
            });
        },
    },
    methods: {
        gotoUserEditPage() {
            this.triggerEvent('gotoUserEditPage');
        },
        onGetPhoneNumber(e) {
            this.triggerEvent('getPhoneNumberLogin', e?.detail || {});
        },
    },
});
