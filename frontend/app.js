import updateManager from './common/updateManager';
import { ensureAuthSession, getToken } from './services/auth/session';

App({
    globalData: {},
    onLaunch: function () {
        // 토큰이 있으면 유효성만 확인하고, 없거나 만료면 앱 진입 시 조용히 wx.login으로 로그인(code 교환)
        // (wx.login 자체는 팝업이 없고, 프로필 팝업은 getUserProfile 경로에서만 발생)
        if (getToken()) {
            ensureAuthSession({ allowLogin: false }).catch(() => {});
            return;
        }
        ensureAuthSession({ allowLogin: true }).catch(() => {});
    },
    onShow: function () {
        updateManager();
    },
});
