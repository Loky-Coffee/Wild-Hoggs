import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { useAuth } from '../../hooks/useAuth';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData } from '../../i18n/index';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import type { Message } from './MessageItem';
import './ChatWindow.css';

type ChatType = 'global' | 'server';

const POLL_MS = 5_000;

interface ChatWindowProps {
  translationData: TranslationData;
}

export default function ChatWindow({ translationData }: ChatWindowProps) {
  const { user, token, isLoggedIn } = useAuth();
  const t = useTranslations(translationData);

  const [chatType,    setChatType]    = useState<ChatType>('global');
  const [messages,    setMessages]    = useState<Message[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [sending,     setSending]     = useState(false);
  const [sendError,   setSendError]   = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  const lastCreatedAt = useRef<string | null>(null);
  const pollRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatTypeRef   = useRef<ChatType>(chatType);

  // Keep ref in sync so poll callback always has the current chatType
  useEffect(() => { chatTypeRef.current = chatType; }, [chatType]);

  const getEndpoint = useCallback((type: ChatType) =>
    type === 'global' ? '/api/chat/global' : `/api/chat/server/${user?.server}`,
  [user?.server]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // Load initial 50 messages when chat type or auth changes
  const loadInitial = useCallback(async (type: ChatType) => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    setMessages([]);
    lastCreatedAt.current = null;
    try {
      const res = await fetch(`${getEndpoint(type)}?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json() as { error: string };
        setLoadError(data.error ?? t('chat.loading'));
        return;
      }
      const data = await res.json() as { messages: Message[] };
      setMessages(data.messages);
      if (data.messages.length > 0) {
        lastCreatedAt.current = data.messages[data.messages.length - 1].created_at;
      }
    } catch {
      setLoadError('Verbindungsfehler. Bitte Seite neu laden.');
    } finally {
      setLoading(false);
    }
  }, [token, getEndpoint]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for new messages every POLL_MS, paused when tab is hidden
  const poll = useCallback(async () => {
    if (!token || !lastCreatedAt.current) return;
    try {
      const since = encodeURIComponent(lastCreatedAt.current);
      const res = await fetch(`${getEndpoint(chatTypeRef.current)}?since=${since}&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json() as { messages: Message[] };
      if (data.messages.length > 0) {
        setMessages(prev => {
          const known = new Set(prev.map(m => m.id));
          const fresh = data.messages.filter(m => !known.has(m.id));
          return fresh.length > 0 ? [...prev, ...fresh] : prev;
        });
        lastCreatedAt.current = data.messages[data.messages.length - 1].created_at;
      }
    } catch { /* ignore transient errors */ }
  }, [token, getEndpoint]);

  useEffect(() => {
    if (!isLoggedIn || !token) return;
    loadInitial(chatType);
    stopPolling();
    pollRef.current = setInterval(() => {
      if (document.visibilityState !== 'hidden') poll();
    }, POLL_MS);
    return stopPolling;
  }, [isLoggedIn, token, chatType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Send a message
  const handleSend = useCallback(async (text: string) => {
    if (!token) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(getEndpoint(chatType), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ message: text }),
      });
      const data = await res.json() as any;
      if (!res.ok) { setSendError(data.error ?? 'Senden fehlgeschlagen.'); return; }
      const newMsg = data as Message;
      setMessages(prev => {
        const known = new Set(prev.map(m => m.id));
        return known.has(newMsg.id) ? prev : [...prev, newMsg];
      });
      lastCreatedAt.current = newMsg.created_at;
    } catch {
      setSendError('Verbindungsfehler. Bitte versuche es erneut.');
    } finally {
      setSending(false);
    }
  }, [token, chatType, getEndpoint]);

  // Report a message
  const handleReport = useCallback(async (msgId: string) => {
    if (!token) return;
    try {
      await fetch('/api/chat/report', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ chat_type: chatType, message_id: msgId }),
      });
      setReportedIds(prev => new Set([...prev, msgId]));
    } catch { /* ignore */ }
  }, [token, chatType]);

  // ── Not logged in ────────────────────────────────────────────────────────────
  if (!isLoggedIn || !user) {
    return (
      <div class="chat-login-wall">
        <div class="chat-login-icon">💬</div>
        <p class="chat-login-text">{t('chat.login_required')}</p>
        <p class="chat-login-hint">{t('chat.login_hint')}</p>
      </div>
    );
  }

  const canUseServer = !!user.server;

  const ago = {
    seconds: t('chat.ago_seconds'),
    minutes: t('chat.ago_minutes'),
    hours:   t('chat.ago_hours'),
    days:    t('chat.ago_days'),
  };

  // ── Chat UI ──────────────────────────────────────────────────────────────────
  return (
    <div class="chat-window">

      {/* Tab switcher */}
      <div class="chat-tabs" role="tablist">
        <button
          class={`chat-tab${chatType === 'global' ? ' chat-tab-active' : ''}`}
          onClick={() => setChatType('global')}
          role="tab"
          aria-selected={chatType === 'global'}
        >
          🌍 {t('chat.global')}
        </button>
        <button
          class={`chat-tab${chatType === 'server' ? ' chat-tab-active' : ''}${!canUseServer ? ' chat-tab-disabled' : ''}`}
          onClick={() => canUseServer ? setChatType('server') : undefined}
          role="tab"
          aria-selected={chatType === 'server'}
          disabled={!canUseServer}
          title={!canUseServer ? t('chat.no_server_hint') : undefined}
        >
          🏠 {user.server ? `${t('chat.server')} ${user.server}` : t('chat.server')}
        </button>
      </div>

      {/* Message area */}
      {loading ? (
        <div class="chat-loading">
          <span class="chat-loading-dot" />
          <span class="chat-loading-dot" />
          <span class="chat-loading-dot" />
        </div>
      ) : loadError ? (
        <div class="chat-error-box">{loadError}</div>
      ) : (
        <MessageList
          messages={messages}
          currentUsername={user.username}
          onReport={handleReport}
          reportedIds={reportedIds}
          noMessages={t('chat.no_messages')}
          reportLabel={t('chat.report')}
          reportedLabel={t('chat.report_sent')}
          ago={ago}
        />
      )}

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        sending={sending}
        sendError={sendError}
        onClearError={() => setSendError(null)}
        placeholder={t('chat.input_placeholder')}
        sendLabel={t('chat.send')}
        charsLeft={t('chat.chars_left')}
      />
    </div>
  );
}
