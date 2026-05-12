import updateManager from './common/updateManager';
import { getErrorMessage } from './services/_utils/errors';

App({
    globalData: {},
    onLaunch: function () {
        // 첫 진입은 비로그인 상태 유지: 로그인은 사용자 명시 동작(마이페이지 버튼)에서만 진행
    },
    onShow: function () {
        updateManager();
    },
    onError(err) {
        try {
            // 실기기에서 네트워크/런타임 오류 원문을 빠르게 확인하기 위한 최소 표시
            const msg = typeof err === 'string' ? err : getErrorMessage(err);
            console.error('[app.onError]', err);
            wx.showToast({ title: String(msg).slice(0, 60), icon: 'none', duration: 3000 });
        }
        catch (_) {
            // ignore
        }
    },
    onUnhandledRejection(res) {
        try {
            const reason = res?.reason;
            const msg = getErrorMessage(reason);
            const url = reason?.raw?.url || reason?.raw?.request?.url || '';
            const errMsg = reason?.raw?.errMsg || reason?.raw?.message || '';
            console.error('[app.onUnhandledRejection]', res);
            wx.showToast({
                title: String(url ? `[NET] ${errMsg || msg}` : msg).slice(0, 60),
                icon: 'none',
                duration: 3000,
            });
        }
        catch (_) {
            // ignore
        }
    },
});
