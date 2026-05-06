import Toast from 'tdesign-miniprogram/toast/index';
import {
  listAdminSupportConversations,
  listAdminSupportMessagesByUser,
  createAdminSupportReply,
  uploadAdminSupportMedia,
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
    conversations: [],
    activeUserId: '',
    messages: [],
    inputText: '',
    sending: false,
    recording: false,
    recordWillCancel: false,
    inputMode: 'text',
    scrollIntoView: '',
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
      const uid = this.data.activeUserId;
      if (!uid) return;
      this.sendVoiceMessage(uid, res.tempFilePath, durationMs);
    });
    recorder.onError(() => {
      wx.showToast({ title: '录音失败', icon: 'none' });
      this.setData({ recording: false, recordWillCancel: false });
    });
  },

  onShow() {
    this.refresh();
    this._timer = setInterval(() => this.refresh(), 4000);
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

  async refresh() {
    try {
      const rows = await listAdminSupportConversations();
      const conversations = Array.isArray(rows) ? rows : [];
      let activeUserId = this.data.activeUserId;
      if (!activeUserId && conversations.length > 0) activeUserId = String(conversations[0].userId);
      this.setData({ conversations, activeUserId });
      if (activeUserId) {
        const msgs = await listAdminSupportMessagesByUser(activeUserId);
        const messages = enrichSupportMessages(Array.isArray(msgs) ? msgs : []);
        this.setData({ messages });
        wx.nextTick(() => this.scrollToBottom(messages));
      } else {
        this.setData({ messages: [] });
        wx.nextTick(() => this.scrollToBottom([]));
      }
    } catch (e) {}
  },

  async onSelectConversation(e) {
    const userId = String(e.currentTarget.dataset.userId || '');
    if (!userId) return;
    this.setData({ activeUserId: userId });
    await this.refresh();
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value || '' });
  },

  toggleInputMode() {
    this.setData({ inputMode: this.data.inputMode === 'voice' ? 'text' : 'voice' });
  },

  async onSend() {
    const content = String(this.data.inputText || '').trim();
    if (!content || !this.data.activeUserId || this.data.sending) return;
    this.setData({ sending: true });
    try {
      await createAdminSupportReply(this.data.activeUserId, content);
      this.setData({ inputText: '' });
      await this.refresh();
    } catch (e) {
      Toast({ context: this, selector: '#t-toast', message: e?.message || '发送失败' });
    } finally {
      this.setData({ sending: false });
    }
  },

  chooseImageBySource(sourceType) {
    const uid = this.data.activeUserId;
    if (!uid) {
      wx.showToast({ title: '请先选择用户', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType,
      success: async (res) => {
        const f = res.tempFiles[0];
        if (!f?.tempFilePath) return;
        wx.showLoading({ title: '发送中', mask: true });
        try {
          const url = await uploadAdminSupportMedia({
            kind: 'image',
            filePath: f.tempFilePath,
            mimeType: 'image/jpeg',
            fileName: 'chat.jpg',
          });
          await createAdminSupportReply(uid, { msgType: 'image', content: url });
          await this.refresh();
        } catch (e) {
          Toast({ context: this, selector: '#t-toast', message: e?.message || '图片发送失败' });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },

  openMoreActions() {
    if (!this.data.activeUserId) {
      wx.showToast({ title: '请先选择用户', icon: 'none' });
      return;
    }
    wx.showActionSheet({
      itemList: ['拍照', '从相册选择'],
      success: (res) => {
        const sourceType = res.tapIndex === 0 ? ['camera'] : ['album'];
        this.chooseImageBySource(sourceType);
      },
    });
  },

  onRecordStart(e) {
    if (!this.data.activeUserId) {
      wx.showToast({ title: '请先选择用户', icon: 'none' });
      return;
    }
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

  async sendVoiceMessage(userId, tempFilePath, durationMs) {
    wx.showLoading({ title: '发送中', mask: true });
    try {
      const url = await uploadAdminSupportMedia({
        kind: 'voice',
        filePath: tempFilePath,
        mimeType: 'audio/mp4',
        fileName: 'voice.m4a',
      });
      await createAdminSupportReply(userId, {
        msgType: 'voice',
        content: url,
        meta: { durationMs },
      });
      await this.refresh();
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
