/**
 * 일부 회선·Caddy 조합에서 위챗 WebView 가 HTTP/2·QUIC 만 쓰다 RST 나는 사례가 있어 기본 끔.
 * wx.request 옵션으로 그대로 스프레드하면 됨.
 */
export const wxRequestTransportOpts = Object.freeze({
    enableHttp2: false,
    enableQuic: false,
});
