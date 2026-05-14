/**
 * getPhoneNumber 回调：页面 / 组件 / 二次 triggerEvent 可能导致 detail 套一层
 * @param {{ detail?: Record<string, unknown> }} event
 * @returns {{ code: string, errMsg: string }}
 */
export function extractWeChatPhoneNumberDetail(event) {
    if (!event || typeof event !== 'object') {
        return { code: '', errMsg: '' };
    }
    let d = event.detail;
    if (!d || typeof d !== 'object') {
        return { code: '', errMsg: '' };
    }
    if (d.detail && typeof d.detail === 'object' && (d.detail.code != null || d.detail.errMsg != null)) {
        d = d.detail;
    }
    return {
        code: String(d.code != null ? d.code : '').trim(),
        errMsg: String(d.errMsg != null ? d.errMsg : '').trim(),
    };
}
