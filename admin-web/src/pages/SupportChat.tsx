import { type ChangeEvent, type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import {
  fetchSupportConversations,
  fetchSupportMessages,
  fetchSupportPeerTyping,
  postSupportReply,
  updateSupportTyping,
  uploadAdminSupportMedia,
  type SupportConversationRow,
  type SupportMessageRow,
} from '../api/admin';
import { normalizeSupportMediaUrl } from '../api/client';

const EMOJI_LIST = ['😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎', '🤔', '😭', '😡', '👍', '👏', '🙏', '🎉', '❤️'];

function formatTime(iso: string): string {
  try {
    const d = new Date(iso.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

function fileToBase64Parts(file: File): Promise<{ mime: string; b64: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || '');
      const m = s.match(/^data:([^;]+);base64,(.+)$/);
      if (m) resolve({ mime: m[1], b64: m[2] });
      else reject(new Error('无法读取文件'));
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function safeOrderNo(m: SupportMessageRow): string {
  const raw = m?.meta && typeof (m.meta as any).orderNo === 'string' ? String((m.meta as any).orderNo || '').trim() : '';
  return raw;
}

export default function SupportChatPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<SupportConversationRow[]>([]);
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  const [messages, setMessages] = useState<SupportMessageRow[]>([]);
  const [input, setInput] = useState('');
  const [err, setErr] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    if (!token) return;
    setErr('');
    try {
      const rows = await fetchSupportConversations(token);
      setConversations(rows);
      setActiveUserId((prev) => {
        if (prev != null && rows.some((r) => r.userId === prev)) return prev;
        return rows.length ? rows[0].userId : null;
      });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '加载会话失败');
    } finally {
      setLoadingList(false);
    }
  }, [token]);

  const loadMessages = useCallback(
    async (userId: number) => {
      if (!token) return;
      setLoadingMsgs(true);
      setErr('');
      try {
        const rows = await fetchSupportMessages(token, userId);
        setMessages(rows);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : '加载消息失败');
      } finally {
        setLoadingMsgs(false);
      }
    },
    [token],
  );

  useEffect(() => {
    setLoadingList(true);
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (activeUserId == null) {
      setMessages([]);
      return;
    }
    loadMessages(activeUserId);
  }, [activeUserId, loadMessages]);

  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      loadConversations();
      if (activeUserId != null) {
        loadMessages(activeUserId);
        fetchSupportPeerTyping(token, activeUserId)
          .then((v) => setPeerTyping(Boolean(v?.peerTyping)))
          .catch(() => {});
      }
    }, 4000);
    return () => clearInterval(id);
  }, [token, activeUserId, loadConversations, loadMessages]);

  useEffect(() => {
    if (!token || activeUserId == null) {
      setPeerTyping(false);
      return;
    }
    fetchSupportPeerTyping(token, activeUserId)
      .then((v) => setPeerTyping(Boolean(v?.peerTyping)))
      .catch(() => {});
  }, [token, activeUserId]);

  useEffect(() => {
    return () => {
      if (token && activeUserId != null) {
        updateSupportTyping(token, activeUserId, false).catch(() => {});
      }
    };
  }, [token, activeUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendTextMessage() {
    if (!token || activeUserId == null || sending) return;
    const t = input.trim();
    if (!t) return;
    setSending(true);
    setErr('');
    try {
      await postSupportReply(token, activeUserId, { msgType: 'text', content: t });
      await updateSupportTyping(token, activeUserId, false);
      setInput('');
      setShowEmojiPanel(false);
      await loadMessages(activeUserId);
      await loadConversations();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : '发送失败');
    } finally {
      setSending(false);
    }
  }

  function onSendText(e: FormEvent) {
    e.preventDefault();
    void sendTextMessage();
  }

  function reportTyping(nextText: string) {
    if (!token || activeUserId == null) return;
    const typing = nextText.trim().length > 0;
    updateSupportTyping(token, activeUserId, typing).catch(() => {});
  }

  async function onPickImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !token || activeUserId == null || sending) return;
    if (!file.type.startsWith('image/')) {
      setErr('请选择图片文件');
      return;
    }
    setSending(true);
    setErr('');
    try {
      const { mime, b64 } = await fileToBase64Parts(file);
      const { url } = await uploadAdminSupportMedia(token, {
        kind: 'image',
        fileName: file.name,
        mimeType: mime,
        base64Data: b64,
      });
      await postSupportReply(token, activeUserId, { msgType: 'image', content: url });
      await loadMessages(activeUserId);
      await loadConversations();
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : '图片发送失败');
    } finally {
      setSending(false);
    }
  }

  const activeConv = conversations.find((c) => c.userId === activeUserId);

  return (
    <div className="support-chat-root">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>客服会话</h2>
        <button type="button" className="btn btn-ghost" onClick={() => loadConversations()} disabled={loadingList}>
          刷新列表
        </button>
      </div>
      {err ? <div className="err-banner">{err}</div> : null}

      <div className="card support-chat-split">
        {/* 左侧会话 */}
        <aside className="support-chat-aside">
          {loadingList && conversations.length === 0 ? (
            <p style={{ padding: '1rem', color: 'var(--muted)', margin: 0 }}>加载中…</p>
          ) : conversations.length === 0 ? (
            <p style={{ padding: '1rem', color: 'var(--muted)', margin: 0 }}>暂无会话</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.userId}
                type="button"
                onClick={() => setActiveUserId(c.userId)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.75rem 1rem',
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  background: activeUserId === c.userId ? 'rgba(61,139,253,0.15)' : 'transparent',
                  color: 'var(--text)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {c.avatarUrl ? (
                    <img
                      alt=""
                      src={normalizeSupportMediaUrl(c.avatarUrl)}
                      style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        color: 'var(--muted)',
                      }}
                    >
                      用户
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.nickName || `用户 #${c.userId}`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>ID {c.userId}</div>
                  </div>
                  {c.unreadCount > 0 ? (
                    <span
                      style={{
                        background: 'var(--danger)',
                        color: '#fff',
                        fontSize: '0.7rem',
                        minWidth: 20,
                        height: 20,
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 6px',
                      }}
                    >
                      {c.unreadCount > 99 ? '99+' : c.unreadCount}
                    </span>
                  ) : null}
                </div>
              </button>
            ))
          )}
        </aside>

        {/* 右侧消息 */}
        <div className="support-chat-main">
          <div
            style={{
              padding: '0.65rem 1rem',
              borderBottom: '1px solid var(--border)',
              fontSize: '0.9rem',
              fontWeight: 600,
            }}
          >
            {activeConv ? `${activeConv.nickName || '用户'} · ID ${activeConv.userId}` : '请选择左侧会话'}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {loadingMsgs && messages.length === 0 && activeUserId != null ? (
              <p style={{ color: 'var(--muted)' }}>加载消息…</p>
            ) : null}
            {messages.map((m) => {
              const isAdmin = m.fromRole === 'admin';
              const msgType = (m.msgType || 'text') as 'text' | 'image' | 'voice';
              const mediaSrc = msgType === 'image' || msgType === 'voice' ? normalizeSupportMediaUrl(m.content) : '';
              const orderNo = safeOrderNo(m);
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    justifyContent: isAdmin ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '78%',
                      borderRadius: 12,
                      padding: msgType === 'text' ? '0.5rem 0.75rem' : '0.35rem',
                      background: isAdmin ? 'rgba(61,139,253,0.25)' : 'var(--surface2)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {orderNo ? (
                      <div style={{ marginBottom: 6 }}>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{
                            padding: '0.15rem 0.5rem',
                            fontSize: '0.72rem',
                            borderRadius: 999,
                            border: '1px solid rgba(25,135,84,0.35)',
                            background: 'rgba(25,135,84,0.12)',
                            color: 'rgba(25,135,84,0.95)',
                          }}
                          onClick={() => navigate(`/orders?orderNo=${encodeURIComponent(orderNo)}`)}
                          title="点击查看该订单"
                        >
                          订单 {orderNo}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem', marginLeft: 6 }}
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(orderNo);
                              window.alert('已复制订单号');
                            } catch {
                              window.alert('复制失败');
                            }
                          }}
                          title="复制订单号"
                        >
                          复制
                        </button>
                      </div>
                    ) : null}
                    {msgType === 'text' ? (
                      <div style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</div>
                    ) : null}
                    {msgType === 'image' ? (
                      <a href={mediaSrc} target="_blank" rel="noreferrer">
                        <img alt="" src={mediaSrc} style={{ maxWidth: 220, maxHeight: 220, borderRadius: 8, display: 'block' }} />
                      </a>
                    ) : null}
                    {msgType === 'voice' ? (
                      <div className="support-chat-voice-wrap">
                        <audio src={mediaSrc} controls style={{ width: '100%', height: 32 }} />
                        {m.meta?.durationMs != null ? (
                          <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                            {Math.max(1, Math.round(m.meta.durationMs / 1000))}″
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: 4, textAlign: isAdmin ? 'right' : 'left' }}>
                      {isAdmin ? '管理员' : '用户'} · {formatTime(m.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={onSendText}
            style={{
              borderTop: '1px solid var(--border)',
              padding: '0.75rem 1rem',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
            }}
          >
            {peerTyping ? <div style={{ width: '100%', fontSize: '0.8rem', color: 'var(--muted)' }}>对方正在输入…</div> : null}
            <textarea
              value={input}
              onChange={(e) => {
                const next = e.target.value;
                setInput(next);
                reportTyping(next);
                if (showEmojiPanel) setShowEmojiPanel(false);
              }}
              placeholder={activeUserId == null ? '请先选择用户' : '输入回复，Enter 发送（Shift+Enter 换行）'}
              disabled={activeUserId == null || sending}
              rows={2}
              className="support-chat-input"
              style={{ resize: 'vertical', maxHeight: 120 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim() && !sending && activeUserId != null) {
                    void sendTextMessage();
                  }
                }
              }}
            />
            <button
              type="button"
              className="btn btn-ghost"
              disabled={activeUserId == null || sending}
              onClick={() => setShowEmojiPanel((prev) => !prev)}
              title="表情"
            >
              😀
            </button>
            <label className="btn btn-ghost" style={{ cursor: activeUserId && !sending ? 'pointer' : 'not-allowed', opacity: activeUserId ? 1 : 0.5 }}>
              图片
              <input type="file" accept="image/*" hidden disabled={activeUserId == null || sending} onChange={onPickImage} />
            </label>
            <button type="submit" className="btn btn-primary" disabled={activeUserId == null || sending || !input.trim()}>
              {sending ? '发送中…' : '发送'}
            </button>
            {showEmojiPanel && activeUserId != null ? (
              <div
                style={{
                  width: '100%',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'var(--surface2)',
                  padding: '0.5rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
                  gap: '0.35rem',
                }}
              >
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="btn btn-ghost"
                    style={{ minWidth: 0, padding: '0.25rem 0.35rem', fontSize: '1.2rem' }}
                    onClick={() => {
                      setInput((prev) => {
                        const next = `${prev}${emoji}`;
                        reportTyping(next);
                        return next;
                      });
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}
          </form>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
        数据来自数据库表 <code style={{ fontSize: '0.75rem' }}>support_messages</code>，约每 4 秒自动同步；用户侧语音消息可在此播放。
      </p>
    </div>
  );
}
