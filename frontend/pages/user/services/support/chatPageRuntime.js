export const RECORDER_OPTIONS = {
  duration: 60000,
  sampleRate: 44100,
  numberOfChannels: 1,
  encodeBitRate: 96000,
  format: 'aac',
};

export function initRecorderRuntime(page, { onValidStop }) {
  const sys = wx.getSystemInfoSync();
  page._windowWidth = Number(sys.windowWidth || 375);
  page._windowHeight = Number(sys.windowHeight || 667);
  const recorder = wx.getRecorderManager();
  page._recorder = recorder;
  try {
    recorder.offStart();
    recorder.offStop();
    recorder.offError();
  } catch (_) { }
  recorder.onStart(() => {
    page.setData({ recordWillCancel: false });
  });
  recorder.onStop((res) => {
    if (page._cancelVoiceSend) {
      page._cancelVoiceSend = false;
      page.setData({ recording: false, recordWillCancel: false });
      return;
    }
    const durationMs = typeof res.duration === 'number' ? res.duration : 0;
    if (durationMs < 500) {
      wx.showToast({ title: '录音太短', icon: 'none' });
      page.setData({ recording: false, recordWillCancel: false });
      return;
    }
    page.setData({ recording: false, recordWillCancel: false });
    onValidStop(res.tempFilePath, durationMs);
  });
  recorder.onError(() => {
    wx.showToast({ title: '录音失败', icon: 'none' });
    page.setData({ recording: false, recordWillCancel: false });
  });
}

export function stopAudioRuntime(page) {
  if (page._audio) {
    try {
      page._audio.stop();
      page._audio.destroy();
    } catch (_) { }
    page._audio = null;
  }
  page.setData({ playingVoiceId: '' });
}

export function stopRecordingRuntime(page) {
  if (!page._recorder) return;
  page._cancelVoiceSend = true;
  page.setData({ recording: false, recordWillCancel: false });
  try {
    page._recorder.stop();
  } catch (_) { }
}

export function disposeRecorderRuntime(page) {
  if (!page?._recorder) return;
  try {
    page._recorder.stop();
  } catch (_) { }
  try {
    page._recorder.offStart();
    page._recorder.offStop();
    page._recorder.offError();
  } catch (_) { }
  page._recorder = null;
}

export function ensureRecordPermission(page) {
  if (page._recordPermissionGranted) return Promise.resolve(true);
  return new Promise((resolve) => {
    wx.getSetting({
      success: (settingRes) => {
        const granted = !!settingRes?.authSetting?.['scope.record'];
        if (granted) {
          page._recordPermissionGranted = true;
          resolve(true);
          return;
        }
        wx.authorize({
          scope: 'scope.record',
          success: () => {
            page._recordPermissionGranted = true;
            resolve(true);
          },
          fail: () => {
            wx.showModal({
              title: '需要录音权限',
              content: '请开启麦克风权限后再发送语音消息',
              confirmText: '去开启',
              cancelText: '取消',
              success: (modalRes) => {
                if (!modalRes.confirm) {
                  resolve(false);
                  return;
                }
                wx.openSetting({
                  success: (openRes) => {
                    const ok = !!openRes?.authSetting?.['scope.record'];
                    page._recordPermissionGranted = ok;
                    if (!ok) {
                      wx.showToast({ title: '未开启录音权限', icon: 'none' });
                    }
                    resolve(ok);
                  },
                  fail: () => resolve(false),
                });
              },
              fail: () => resolve(false),
            });
          },
        });
      },
      fail: () => resolve(false),
    });
  });
}

export async function startRecordingRuntime(page, e, { beforeStart } = {}) {
  if (page.data.recording) return;
  if (!page._recorder) {
    wx.showToast({ title: '录音组件不可用', icon: 'none' });
    return;
  }
  if (typeof beforeStart === 'function') {
    const ok = beforeStart();
    if (!ok) return;
  }
  if (!e.touches || !e.touches[0]) return;
  page._recordStartY = e.touches[0].clientY;
  const granted = await ensureRecordPermission(page);
  if (!granted) return;
  page._cancelVoiceSend = false;
  page.setData({ recording: true, recordWillCancel: false });
  try {
    page._recorder.start(RECORDER_OPTIONS);
  } catch (_) {
    page.setData({ recording: false, recordWillCancel: false });
    wx.showToast({ title: '录音启动失败', icon: 'none' });
  }
}

export function moveRecordingRuntime(page, e) {
  if (!page.data.recording || !e.touches || !e.touches[0]) return;
  const touch = e.touches[0];
  const cancel = isInCancelZone(page, touch.clientX, touch.clientY);
  if (cancel !== page.data.recordWillCancel) {
    page.setData({ recordWillCancel: cancel });
  }
}

export function endRecordingRuntime(page, { cancel = false } = {}) {
  if (!page.data.recording || !page._recorder) return;
  page._cancelVoiceSend = cancel ? true : page.data.recordWillCancel;
  page.setData({ recording: false, recordWillCancel: false });
  page._recorder.stop();
}

function isInCancelZone(page, x, y) {
  const cx = page._windowWidth / 2;
  const cy = page._windowHeight - 96;
  const halfW = 68;
  const halfH = 40;
  return x >= cx - halfW && x <= cx + halfW && y >= cy - halfH && y <= cy + halfH;
}

export function playVoiceRuntime(page, { url, id }) {
  if (!url) return;
  stopAudioRuntime(page);
  page.setData({ playingVoiceId: id != null && id !== '' ? id : '' });
  const audio = wx.createInnerAudioContext();
  page._audio = audio;
  audio.obeyMuteSwitch = false;
  audio.src = url;
  audio.onError((err) => {
    console.warn('voice play', err);
    wx.showToast({ title: '无法播放语音', icon: 'none' });
    stopAudioRuntime(page);
  });
  audio.play();
  audio.onEnded(() => stopAudioRuntime(page));
}

export function shouldAutoScrollByAnchor(page, list) {
  const arr = Array.isArray(list) ? list : [];
  const last = arr.length > 0 ? arr[arr.length - 1] : null;
  const anchor = last && last.id != null ? `msg-${last.id}` : 'msg-bottom';
  const changed = anchor !== page._lastScrollAnchorId;
  page._lastScrollAnchorId = anchor;
  return changed;
}

