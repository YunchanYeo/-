import Toast from 'tdesign-miniprogram/toast/index';
import { fetchPerson } from '../../../services/usercenter/fetchPerson';
import { getPrefetchedSupportMessages, setPrefetchedSupportMessages } from '../../../services/auth/session';
import {
  listMySupportMessages,
  createMySupportMessage,
  uploadSupportMedia,
  enrichSupportMessages,
  normalizeChatMediaUrl,
} from '../../../services/support/chat';

/** 与微信文档示例一致：https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/RecorderManager.html */
const RECORDER_OPTIONS = {
  duration: 60000,
  sampleRate: 44100,
  numberOfChannels: 1,
  encodeBitRate: 96000,
  format: 'aac',
};

Page({
  data: {
    messages: [],
    inputText: '',
    sending: false,
    recording: false,
    recordWillCancel: false,
    inputMode: 'text',
    scrollIntoView: '',
    myAvatarUrl: '',
    playingVoiceId: '',
  },
  _timer: null,
  _recorder: null,
  _audio: null,
  _cancelVoiceSend: false,
  _recordStartY: 0,

  noop() {},

  onLoad() {
    const recorder = wx.getRecorderManager();
    this._recorder = recorder;
    recorder.onStart(() => {
      this.setData({ recordWillCancel: false });
    });
    recorder.onStop((res) => {
      if (this._cancelVoiceSend) {
        this._cancelVoiceSend = false;
        this.setData({ recording: false, recordWillCancel: false });
        return;
      }
      const durationMs = typeof res.duration === 'number' ? res.duration : 0;
      if (durationMs < 500) {
        wx.showToast({ title: '录音太短', icon: 'none' });
        this.setData({ recording: false, recordWillCancel: false });
        return;
      }
      this.setData({ recording: false, recordWillCancel: false });
      this.sendVoiceMessage(res.tempFilePath, durationMs);
    });
    recorder.onError(() => {
      wx.showToast({ title: '录音失败', icon: 'none' });
      this.setData({ recording: false, recordWillCancel: false });
    });
  },

  async loadMyProfile() {
    try {
      const p = await fetchPerson();
      const url = normalizeChatMediaUrl(String(p.avatarUrl || ''));
      this.setData({ myAvatarUrl: url || '' });
    } catch (_) {}
  },

  onShow() {
    this.loadMyProfile();
    const boot = getPrefetchedSupportMessages();
    if (boot.length > 0) {
      this.setData({ messages: enrichSupportMessages(boot) });
      wx.nextTick(() => this.scrollToBottom(enrichSupportMessages(boot)));
    }
    this.fetchMessages();
    this._timer = setInterval(() => this.fetchMessages(), 4000);
  },

  onUnload() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this.stopAudio();
  },

  stopAudio() {
    if (this._audio) {
      try {
        this._audio.stop();
        this._audio.destroy();
      } catch (_) {}
      this._audio = null;
    }
    this.setData({ playingVoiceId: '' });
  },

  scrollToBottom(list) {
    const arr = Array.isArray(list) ? list : [];
    if (arr.length === 0) {
      this.setData({ scrollIntoView: 'msg-bottom' });
      return;
    }
    const last = arr[arr.length - 1];
    const id = last && last.id != null ? `msg-${last.id}` : 'msg-bottom';
    this.setData({ scrollIntoView: id });
  },

  async fetchMessages() {
    try {
      const rows = await listMySupportMessages();
      const rawList = Array.isArray(rows) ? rows : [];
      setPrefetchedSupportMessages(rawList);
      const messages = enrichSupportMessages(rawList);
      this.setData({ messages });
      wx.nextTick(() => this.scrollToBottom(messages));
    } catch (e) {}
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value || '' });
  },

  toggleInputMode() {
    this.setData({ inputMode: this.data.inputMode === 'voice' ? 'text' : 'voice' });
  },

  async onSend() {
    const content = String(this.data.inputText || '').trim();
    if (!content) return;
    if (this.data.sending) return;
    this.setData({ sending: true });
    try {
      await createMySupportMessage(content);
      this.setData({ inputText: '' });
      await this.fetchMessages();
    } catch (e) {
      Toast({ context: this, selector: '#t-toast', message: e?.message || '发送失败' });
    } finally {
      this.setData({ sending: false });
    }
  },

  chooseImageBySource(sourceType) {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType,
      success: async (res) => {
        const f = res.tempFiles[0];
        if (!f?.tempFilePath) return;
        wx.showLoading({ title: '发送中', mask: true });
        try {
          const url = await uploadSupportMedia({
            kind: 'image',
            filePath: f.tempFilePath,
            mimeType: 'image/jpeg',
            fileName: 'chat.jpg',
          });
          await createMySupportMessage({ msgType: 'image', content: url });
          await this.fetchMessages();
        } catch (e) {
          Toast({ context: this, selector: '#t-toast', message: e?.message || '图片发送失败' });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },

  openMoreActions() {
    wx.showActionSheet({
      itemList: ['拍照', '从相册选择'],
      success: (res) => {
        const sourceType = res.tapIndex === 0 ? ['camera'] : ['album'];
        this.chooseImageBySource(sourceType);
      },
    });
  },

  onRecordStart(e) {
    if (!e.touches || !e.touches[0]) return;
    this._recordStartY = e.touches[0].clientY;
    wx.authorize({
      scope: 'scope.record',
      success: () => {
        this._cancelVoiceSend = false;
        this.setData({ recording: true, recordWillCancel: false });
        this._recorder.start(RECORDER_OPTIONS);
      },
      fail: () => {
        wx.showModal({
          title: '需要录音权限',
          content: '请在设置中开启麦克风权限后再试。',
          showCancel: false,
        });
      },
    });
  },

  onRecordMove(e) {
    if (!this.data.recording || !e.touches || !e.touches[0]) return;
    const dy = this._recordStartY - e.touches[0].clientY;
    const cancel = dy > 70;
    if (cancel !== this.data.recordWillCancel) {
      this.setData({ recordWillCancel: cancel });
    }
  },

  onRecordEnd() {
    if (!this.data.recording) return;
    this._cancelVoiceSend = this.data.recordWillCancel;
    this.setData({ recording: false, recordWillCancel: false });
    this._recorder.stop();
  },

  onRecordCancel() {
    if (!this.data.recording) return;
    this._cancelVoiceSend = true;
    this.setData({ recording: false, recordWillCancel: false });
    this._recorder.stop();
  },

  async sendVoiceMessage(tempFilePath, durationMs) {
    wx.showLoading({ title: '发送中', mask: true });
    try {
      const url = await uploadSupportMedia({
        kind: 'voice',
        filePath: tempFilePath,
        mimeType: 'audio/mp4',
        fileName: 'voice.m4a',
      });
      await createMySupportMessage({
        msgType: 'voice',
        content: url,
        meta: { durationMs },
      });
      await this.fetchMessages();
    } catch (e) {
      Toast({ context: this, selector: '#t-toast', message: e?.message || '语音发送失败' });
    } finally {
      wx.hideLoading();
    }
  },

  onPlayVoice(e) {
    const url = normalizeChatMediaUrl(e.currentTarget.dataset.url || '');
    const id = e.currentTarget.dataset.id;
    if (!url) return;
    this.stopAudio();
    this.setData({ playingVoiceId: id != null && id !== '' ? id : '' });
    const audio = wx.createInnerAudioContext();
    this._audio = audio;
    audio.obeyMuteSwitch = false;
    audio.src = url;
    audio.onError((err) => {
      console.warn('voice play', err);
      wx.showToast({ title: '无法播放语音', icon: 'none' });
      this.stopAudio();
    });
    audio.play();
    audio.onEnded(() => this.stopAudio());
  },

  onPreviewImage(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.previewImage({ urls: [url], current: url });
  },
});
