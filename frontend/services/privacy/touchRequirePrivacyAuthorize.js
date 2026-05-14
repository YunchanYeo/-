/**
 * 在展示隐私能力（如 getPhoneNumber）前调用，可触发已注册的 wx.onNeedPrivacyAuthorization 流程。
 * 无监听时调用为安全空操作。
 */
export function touchRequirePrivacyAuthorizeIfSupported() {
    if (typeof wx.requirePrivacyAuthorize !== 'function') {
        return;
    }
    try {
        wx.requirePrivacyAuthorize({
            success: () => {},
            fail: () => {},
        });
    }
    catch (_) { /* ignore */ }
}
