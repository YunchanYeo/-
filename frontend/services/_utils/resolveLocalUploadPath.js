/**
 * wx.uploadFile 의 filePath 는 **로컬 경로**만 허용(공식 문서).
 * chooseAvatar 가 개발자 도구에서 주는 `http://tmp/...` 는 URL이라 그대로 upload 하면 빈 multipart → 서버 400 Invalid upload body.
 * getImageInfo 가 해당 src 에 대해 **로컬 path** 를 돌려주는 경우가 많아, 우선 이걸로 정규화한다.
 */

function isHttpUrl(s) {
  return /^https?:\/\//i.test(String(s || '').trim());
}

function isWechatTmpStyleUrl(url) {
  const u = String(url || '').trim();
  if (!isHttpUrl(u)) return false;
  try {
    if (new URL(u).hostname === 'tmp') return true;
  } catch (_) {
    /* ignore */
  }
  return /^https?:\/\/tmp\//i.test(u);
}

/**
 * @param {string} filePath chooseAvatar / chooseMedia 등에서 온 경로
 * @returns {Promise<string>} wx.uploadFile·readFile 에 쓸 로컬 temp 경로
 */
export function resolveLocalUploadPath(filePath) {
  const fp = String(filePath || '').trim();
  if (!fp) return Promise.reject(new Error('empty filePath'));
  if (!isHttpUrl(fp)) return Promise.resolve(fp);

  if (isWechatTmpStyleUrl(fp)) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: fp,
        success: (res) => {
          const p = res && typeof res.path === 'string' ? res.path.trim() : '';
          if (p && !isHttpUrl(p)) {
            resolve(p);
            return;
          }
          wx.compressImage({
            src: fp,
            quality: 85,
            success: (c) => {
              const t = c && typeof c.tempFilePath === 'string' ? c.tempFilePath.trim() : '';
              if (t) resolve(t);
              else reject(new Error('compressImage empty path'));
            },
            fail: (e) => reject(new Error(e?.errMsg || 'compressImage failed')),
          });
        },
        fail: () => {
          wx.compressImage({
            src: fp,
            quality: 85,
            success: (c) => {
              const t = c && typeof c.tempFilePath === 'string' ? c.tempFilePath.trim() : '';
              if (t) resolve(t);
              else reject(new Error('compressImage empty path'));
            },
            fail: (e) => reject(new Error(e?.errMsg || 'tmp avatar to local failed')),
          });
        },
      });
    });
  }

  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url: fp,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.tempFilePath) resolve(res.tempFilePath);
        else reject(new Error(`downloadFile HTTP ${res.statusCode || '?'}`));
      },
      fail: (e) => reject(new Error(e?.errMsg || 'downloadFile failed')),
    });
  });
}
