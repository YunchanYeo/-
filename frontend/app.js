import updateManager from './common/updateManager';

App({
    globalData: {},
    onLaunch: function () {
        // 첫 진입은 비로그인 상태 유지: 로그인은 사용자 명시 동작(마이페이지 버튼)에서만 진행
    },
    onShow: function () {
        updateManager();
    },
});
