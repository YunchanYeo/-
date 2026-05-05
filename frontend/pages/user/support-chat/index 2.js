import Toast from 'tdesign-miniprogram/toast/index';
import {
  listMySupportMessages,
  createMySupportMessage,
  uploadSupportMedia,
  enrichSupportMessages,
} from '../../../services/support/chat';

Page({
  data: {
    messages: [],
    inputText: '',
    sending: false,
    recording: false,
    inputMode: 'text',
  },
  _timer: null,
  _recorder: null,
  _audio: null,
  _cancelVoiceSend: false,

  onLoad() {
    const recorder = wx.getRecorderManager();
    this._recorder = recorder;
    recorder.onStop((res) => {
      if (this._cancelVoiceSend) {
        this._cancelVoiceSend = false;
        return;
      }
      const duration = typeof res.duration === 'number' ? res.duration : 0;
      if (duration < 400) {
        wx.showToast({ title: '录音太短', icon: 'none' });
        return;
      }
      this.sendVoiceMessage(res.tempFilePath, duration);
    });
    recorder.onError(() => {
      wx.showToast({ title: '录音失败', icon: 'none' });
      this.setData({ recording: false });
    });
  },

  onShow() {
    this.fetchMessages();
    this._timer = setInterval(() => this.fetchMessages(), 3000);
  },

  onUnload() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    if (this._audio) {
      try {
        this._audio.stop();
        this._audio.destroy();
      } catch (_) {}
      this._audio = null;
    }
  },

  async fetchMessages() {
    try {
      const rows = await listMySupportMessages();
      const messages = enrichSupportMessages(Array.isArray(rows) ? rows : []);
      this.setData({ messages });
    } catch (e) {}
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value || '' });
  },

  /**
   * 切换输入模式（微信风格：语音/键盘）。
   */
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

  async chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const f = res.tempFiles[0];
        if (!f?.tempFilePath) return;
        wx.showLoading({ title: '发送中', mask: true });
        try {
          const mime = f.fileType === 'image' ? 'image/jpeg' : 'image/jpeg';
          const url = await uploadSupportMedia({
            kind: 'image',
            filePath: f.tempFilePath,
            mimeType: mime,
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

  /**
   * 点击“+”打开图片来源菜单。
   */
  openMoreActions() {
    wx.showActionSheet({
      itemList: ['拍照', '从相册选择'],
      success: (res) => {
        const sourceType = res.tapIndex === 0 ? ['camera'] : ['album'];
        this.chooseImageBySource(sourceType);
      },
    });
  },

  /**
   * 按指定来源选择并发送图片。
   * @param {Array<'camera'|'album'>} sourceType
   */
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

  onRecordStart() {
    wx.authorize({
      scope: 'scope.record',
      success: () => {
        this._cancelVoiceSend = false;
        this.setData({ recording: true });
        this._recorder.start({
          duration: 60000,
          format: 'mp3',
          sampleRate: 16000,
        });
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

  onRecordEnd() {
    if (!this.data.recording) return;
    this.setData({ recording: false });
    this._recorder.stop();
  },

  onRecordCancel() {
    if (!this.data.recording) return;
    this._cancelVoiceSend = true;
    this.setData({ recording: false });
    this._recorder.stop();
  },

  async sendVoiceMessage(tempFilePath, durationMs) {
    wx.showLoading({ title: '发送中', mask: true });
    try {
      const url = await uploadSupportMedia({
        kind: 'voice',
        filePath: tempFilePath,
        mimeType: 'audio/mpeg',
        fileName: 'voice.mp3',
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
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    if (this._audio) {
      try {
        this._audio.stop();
        this._audio.destroy();
      } catch (_) {}
    }
    const audio = wx.createInnerAudioContext();
    this._audio = audio;
    audio.src = url;
    audio.play();
    audio.onEnded(() => {
      try {
        audio.destroy();
      } catch (_) {}
      if (this._audio === audio) this._audio = null;
    });
  },

  onPreviewImage(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.previewImage({ urls: [url], current: url });
  },
});
