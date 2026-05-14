import Toast from 'tdesign-miniprogram/toast/index';
import {
  listAdminSupportConversations,
  listAdminSupportMessagesByUser,
  createAdminSupportReply,
  uploadAdminSupportMedia,
  getAdminSupportPeerTyping,
  setAdminSupportTyping,
  enrichSupportMessages,
  normalizeChatMediaUrl,
} from '../services/support/chat';
import { getAdminToken } from '../../../services/admin/session';
import { notifySupportChatToast } from '../../../services/supportChatNotify';
import {
  initRecorderRuntime,
  stopAudioRuntime,
  stopRecordingRuntime,
  disposeRecorderRuntime,
  startRecordingRuntime,
  moveRecordingRuntime,
  endRecordingRuntime,
  playVoiceRuntime,
  shouldAutoScrollByAnchor,
} from '../services/support/chatPageRuntime';

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
    showEmojiPanel: false,
    emojiList: ['😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎', '🤔', '😭', '😡', '👍', '👏', '🙏', '🎉', '❤️'],
    scrollIntoView: '',
    playingVoiceId: '',
    peerTyping: false,
  },
  _timer: null,
  _recorder: null,
  _audio: null,
  _cancelVoiceSend: false,
  _recordStartY: 0,
  _recordPermissionGranted: false,
  _windowWidth: 375,
  _windowHeight: 667,
  _lastScrollAnchorId: '',
  _typingTimer: null,
  _typingActive: false,

  noop() {},

  onLoad() {
    if (!getAdminToken()) {
      wx.showToast({ title: '请先登录管理账号', icon: 'none', duration: 1800 });
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/admin/login/index' });
      }, 600);
      return;
    }
    initRecorderRuntime(this, {
      onValidStop: (tempFilePath, durationMs) => {
        const uid = this.data.activeUserId;
        if (!uid) return;
        this.sendVoiceMessage(uid, tempFilePath, durationMs);
      },
    });
  },

  onShow() {
    if (!getAdminToken()) {
      return;
    }
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._supportCustomerMsgBaselineByUid = {};
    this._supportOtherConvUnreadSnap = null;
    this.refresh();
    this._timer = setInterval(() => this.refresh(), 4000);
  },

  onHide() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this.stopRecordingIfNeeded();
    this.stopAudio();
    this.reportTyping(false);
  },

  onUnload() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this.stopRecordingIfNeeded();
    this.stopAudio();
    this.reportTyping(false);
    disposeRecorderRuntime(this);
  },

  stopAudio() {
    stopAudioRuntime(this);
  },

  stopRecordingIfNeeded() {
    stopRecordingRuntime(this);
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

  shouldAutoScroll(nextList) {
    return shouldAutoScrollByAnchor(this, nextList);
  },

  _evalOtherCustomersUnread(conversations, activeUserId) {
    const active = String(activeUserId || '');
    const snap = {};
    for (const c of conversations || []) {
      snap[String(c.userId)] = Number(c.unreadCount || 0);
    }
    if (this._supportOtherConvUnreadSnap == null) {
      this._supportOtherConvUnreadSnap = snap;
      return;
    }
    for (const c of conversations || []) {
      const uid = String(c.userId);
      if (!uid || uid === active) {
        continue;
      }
      const u = Number(c.unreadCount || 0);
      const prev = this._supportOtherConvUnreadSnap[uid] ?? 0;
      if (u > prev) {
        notifySupportChatToast('其他客户发来新消息');
        break;
      }
    }
    this._supportOtherConvUnreadSnap = snap;
  },

  _evalActiveCustomerNewMessages(rawMsgs, activeUserId) {
    const uid = String(activeUserId || '');
    if (!uid) {
      return;
    }
    const list = Array.isArray(rawMsgs) ? rawMsgs : [];
    const ids = list.map((m) => Number(m.id)).filter((n) => Number.isFinite(n));
    const maxId = ids.length ? Math.max(...ids) : 0;
    const prev = this._supportCustomerMsgBaselineByUid[uid];
    if (prev == null) {
      this._supportCustomerMsgBaselineByUid[uid] = maxId;
      return;
    }
    const hasNewUser = list.some(
      (m) => Number(m.id) > prev && String(m.fromRole || '') === 'user',
    );
    if (hasNewUser) {
      notifySupportChatToast('客户发来新消息');
    }
    this._supportCustomerMsgBaselineByUid[uid] = maxId;
  },

  async refresh() {
    if (!getAdminToken()) {
      return;
    }
    try {
      const rows = await listAdminSupportConversations();
      const conversations = Array.isArray(rows) ? rows : [];
      let activeUserId = this.data.activeUserId;
      if (!activeUserId && conversations.length > 0) activeUserId = String(conversations[0].userId);
      this._evalOtherCustomersUnread(conversations, activeUserId);
      this.setData({ conversations, activeUserId });
      if (activeUserId) {
        const msgs = await listAdminSupportMessagesByUser(activeUserId);
        const rawMsgs = Array.isArray(msgs) ? msgs : [];
        this._evalActiveCustomerNewMessages(rawMsgs, activeUserId);
        const messages = enrichSupportMessages(rawMsgs);
        const typing = await getAdminSupportPeerTyping(activeUserId);
        this.setData({ messages });
        this.setData({ peerTyping: Boolean(typing?.peerTyping) });
        if (this.shouldAutoScroll(messages)) {
          wx.nextTick(() => this.scrollToBottom(messages));
        }
      } else {
        this.setData({ messages: [], peerTyping: false });
        if (this.shouldAutoScroll([])) {
          wx.nextTick(() => this.scrollToBottom([]));
        }
      }
    } catch (e) {
      const raw = e?.message || e?.errMsg || String(e || '');
      const msg = raw && raw.length > 56 ? `${raw.slice(0, 56)}…` : (raw || '客服列表加载失败');
      Toast({ context: this, selector: '#t-toast', message: msg, icon: '', duration: 2600 });
    }
  },

  async onSelectConversation(e) {
    const userId = String(e.currentTarget.dataset.userId || '');
    if (!userId) return;
    if (this._typingActive) {
      this._typingActive = false;
      this.reportTyping(false);
    }
    if (!this._supportCustomerMsgBaselineByUid) {
      this._supportCustomerMsgBaselineByUid = {};
    }
    this._supportCustomerMsgBaselineByUid[userId] = null;
    this.setData({ activeUserId: userId });
    await this.refresh();
  },

  onInput(e) {
    const next = e.detail.value || '';
    this.setData({ inputText: next });
    this.handleTypingInput(next);
  },

  handleTypingInput(text) {
    const hasText = String(text || '').trim().length > 0;
    if (!this.data.activeUserId) return;
    if (hasText && !this._typingActive) {
      this._typingActive = true;
      this.reportTyping(true);
    } else if (!hasText && this._typingActive) {
      this._typingActive = false;
      this.reportTyping(false);
    }
    if (this._typingTimer) clearTimeout(this._typingTimer);
    if (hasText) {
      this._typingTimer = setTimeout(() => {
        if (this._typingActive) this.reportTyping(true);
      }, 3000);
    }
  },

  reportTyping(typing) {
    const uid = this.data.activeUserId;
    if (!uid) return;
    setAdminSupportTyping(uid, Boolean(typing)).catch(() => {});
  },

  toggleInputMode() {
    this.setData({
      inputMode: this.data.inputMode === 'voice' ? 'text' : 'voice',
      showEmojiPanel: false,
    });
  },

  async onSend() {
    const content = String(this.data.inputText || '').trim();
    if (!content || !this.data.activeUserId || this.data.sending) return;
    this.setData({ sending: true });
    try {
      await createAdminSupportReply(this.data.activeUserId, content);
      this.setData({ inputText: '' });
      this._typingActive = false;
      this.reportTyping(false);
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
    this.setData({ showEmojiPanel: false });
    wx.showActionSheet({
      itemList: ['拍照', '从相册选择'],
      success: (res) => {
        const sourceType = res.tapIndex === 0 ? ['camera'] : ['album'];
        this.chooseImageBySource(sourceType);
      },
    });
  },

  onEmojiTap() {
    if (!this.data.activeUserId) {
      wx.showToast({ title: '请先选择用户', icon: 'none' });
      return;
    }
    if (this.data.inputMode === 'voice') {
      this.setData({ inputMode: 'text' });
    }
    this.setData({ showEmojiPanel: !this.data.showEmojiPanel });
  },

  onPickEmoji(e) {
    const emoji = String(e.currentTarget.dataset.emoji || '');
    if (!emoji) return;
    const next = `${this.data.inputText || ''}${emoji}`;
    this.setData({ inputText: next });
    this.handleTypingInput(next);
  },

  onRecordStart(e) {
    startRecordingRuntime(this, e, {
      beforeStart: () => {
        if (!this.data.activeUserId) {
          wx.showToast({ title: '请先选择用户', icon: 'none' });
          return false;
        }
        return true;
      },
    });
  },

  onRecordMove(e) {
    moveRecordingRuntime(this, e);
  },

  onRecordEnd() {
    endRecordingRuntime(this);
  },

  onRecordCancel() {
    endRecordingRuntime(this, { cancel: true });
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
    playVoiceRuntime(this, { url, id });
  },

  onPreviewImage(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.previewImage({ urls: [url], current: url });
  },

  onCopyOrderNo(e) {
    const orderNo = String(e.currentTarget.dataset.orderno || '').trim();
    if (!orderNo) return;
    wx.setClipboardData({ data: orderNo });
  },
});
