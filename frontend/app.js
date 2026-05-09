import updateManager from './common/updateManager';
import { getToken, loginWithWeChat } from './services/auth/session';

App({
    globalData: {},
    onLaunch: function () {
        if (getToken()) {
            return;
        }
        // 조용한 로그인: wx.login 코드만 서버로 보냄(getUserProfile 불필요). 실패해도 홈 등 공개 API는 계속 시도 가능.
        loginWithWeChat().catch(() => {});
    },
    onShow: function () {
        updateManager();
    },
});
