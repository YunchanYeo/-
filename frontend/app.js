import updateManager from './common/updateManager';
import { getToken, syncUserProfileByWeChat } from './services/auth/session';
App({
    globalData: {
        hasAskedLoginThisLaunch: false,
    },
    onLaunch: function () {
        // 동의 기반 로그인: 앱 시작 시 자동 로그인하지 않음
    },
    onShow: function () {
        updateManager();
        if (this.globalData.hasAskedLoginThisLaunch)
            return;
        if (getToken())
            return;
        this.globalData.hasAskedLoginThisLaunch = true;
        wx.showModal({
            title: '微信登录',
            content: '请登录您的微信账号',
            confirmText: '登陆',
            cancelText: '取消',
            success: async (res) => {
                if (!res.confirm)
                    return;
                try {
                    await syncUserProfileByWeChat();
                    wx.showToast({
                        title: '登陆成功',
                        icon: 'success',
                    });
                }
                catch (e) {
                    const msg = e?.errMsg || e?.message || '';
                    if (String(msg).includes('cancel'))
                        return;
                    wx.showToast({
                        title: '登陆失败',
                        icon: 'none',
                    });
                }
            },
        });
    },
});
