/**
 * 客服会话内：对方新消息时的轻量提醒（真机振动 + Toast）
 * @param {string} title
 */
export function notifySupportChatToast(title) {
    const t = String(title || '新消息').slice(0, 32);
    try {
        if (typeof wx.vibrateShort === 'function') {
            wx.vibrateShort({
                type: 'medium',
                fail() {
                    try {
                        wx.vibrateShort({});
                    }
                    catch (_) { /* ignore */ }
                },
            });
        }
    }
    catch (_) { /* ignore */ }
    wx.showToast({ title: t, icon: 'none', duration: 2200 });
}
