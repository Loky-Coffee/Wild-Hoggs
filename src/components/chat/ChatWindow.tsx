import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { useAuth } from '../../hooks/useAuth';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData } from '../../i18n/index';
import MessageList from './MessageList';
import MessageInput, { type ReplyTarget } from './MessageInput';
import type { Message } from './MessageItem';
import './ChatWindow.css';

type ChatType = 'global' | 'global-lang' | 'server' | 'server-lang';

const POLL_MS     = 5_000;
const PRESENCE_MS = 5_000;

interface ChatWindowProps {
  translationData: TranslationData;
}

interface OnlineUser {
  username:     string;
  faction:      string | null;
  server:       string | null;
  language:     string | null;
  is_admin:     number;
  is_moderator: number;
}

const FACTION_COLORS: Record<string, string> = {
  'blood-rose':     '#e74c3c',
  'wings-of-dawn':  '#4a9eda',
  'guard-of-order': '#27ae60',
};

function factionColor(faction: string | null): string {
  return faction ? (FACTION_COLORS[faction] ?? 'rgba(255,255,255,0.6)') : 'rgba(255,255,255,0.6)';
}

export default function ChatWindow({ translationData }: ChatWindowProps) {
  const { user, token, isLoggedIn } = useAuth();
  const t = useTranslations(translationData);

  const [chatType,     setChatType]     = useState<ChatType>('global');
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState<string | null>(null);
  const [sending,      setSending]      = useState(false);
  const [sendError,    setSendError]    = useState<string | null>(null);
  const [reportedIds,  setReportedIds]  = useState<Set<string>>(new Set());
  const [replyTo,      setReplyTo]      = useState<ReplyTarget | null>(null);
  const [onlineUsers,  setOnlineUsers]  = useState<OnlineUser[]>([]);

  const lastCreatedAt = useRef<string | null>(null);
  const pollRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const presenceRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatTypeRef   = useRef<ChatType>(chatType);

  useEffect(() => { chatTypeRef.current = chatType; setReplyTo(null); }, [chatType]);

  const isAdmin   = user?.is_admin === 1 || user?.is_moderator === 1;
  const hasLang   = !!(user?.language && user.language.trim());
  const hasServer = !!user?.server;
  const langCode  = user?.language?.toUpperCase() ?? '';

  // ── Presence polling ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn || !token) return;

    const fetchPresence = async () => {
      try {
        const res = await fetch('/api/presence', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json() as { users: OnlineUser[] };
          setOnlineUsers(data.users);
        }
      } catch { /* ignore */ }
    };

    fetchPresence();
    presenceRef.current = setInterval(fetchPresence, PRESENCE_MS);
    return () => {
      if (presenceRef.current) clearInterval(presenceRef.current);
    };
  }, [isLoggedIn, token]);

  // Filter online users by currently visible channel
  const visibleOnline = onlineUsers.filter(u => {
    const lang = (u.language ?? '').trim().toLowerCase();
    const myLang = (user?.language ?? '').trim().toLowerCase();
    switch (chatType) {
      case 'global':      return true;
      case 'global-lang': return lang === myLang && !!lang;
      case 'server':      return u.server === user?.server;
      case 'server-lang': return u.server === user?.server && lang === myLang && !!lang;
      default: return false;
    }
  });

  // ── Chat polling ──────────────────────────────────────────────────────────
  const buildUrl = useCallback((type: ChatType, extra: string = ''): string => {
    const base = (type === 'global' || type === 'global-lang')
      ? '/api/chat/global'
      : `/api/chat/server/${user?.server}`;

    const langParam = (type === 'global-lang' || type === 'server-lang') && user?.language
      ? `lang=${user.language}`
      : '';

    const allParams = [langParam, extra].filter(Boolean).join('&');
    return allParams ? `${base}?${allParams}` : base;
  }, [user?.server, user?.language]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const loadInitial = useCallback(async (type: ChatType) => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    setMessages([]);
    lastCreatedAt.current = null;
    try {
      const res = await fetch(buildUrl(type, 'limit=50'), {
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
  }, [token, buildUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const poll = useCallback(async () => {
    if (!token || !lastCreatedAt.current) return;
    try {
      const since = encodeURIComponent(lastCreatedAt.current);
      const res = await fetch(buildUrl(chatTypeRef.current, `since=${since}&limit=50`), {
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
  }, [token, buildUrl]);

  useEffect(() => {
    if (!isLoggedIn || !token) return;
    loadInitial(chatType);
    stopPolling();
    pollRef.current = setInterval(() => {
      if (document.visibilityState !== 'hidden') poll();
    }, POLL_MS);
    return stopPolling;
  }, [isLoggedIn, token, chatType]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text: string) => {
    if (!token) return;
    setSending(true);
    setSendError(null);
    const currentReplyId = replyTo?.id ?? null;
    try {
      const res = await fetch(buildUrl(chatType), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ message: text, reply_to_id: currentReplyId }),
      });
      const data = await res.json() as any;
      if (!res.ok) { setSendError(data.error ?? 'Senden fehlgeschlagen.'); return; }
      const newMsg = data as Message;
      setMessages(prev => {
        const known = new Set(prev.map(m => m.id));
        return known.has(newMsg.id) ? prev : [...prev, newMsg];
      });
      lastCreatedAt.current = newMsg.created_at;
      setReplyTo(null);
    } catch {
      setSendError('Verbindungsfehler. Bitte versuche es erneut.');
    } finally {
      setSending(false);
    }
  }, [token, chatType, buildUrl, replyTo]);

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

  const handleReply = useCallback((msg: Message) => {
    setReplyTo({
      id:       msg.id,
      username: msg.username,
      text:     msg.message.length > 80 ? msg.message.slice(0, 80) + '…' : msg.message,
    });
  }, []);

  const handleDelete = useCallback(async (msgId: string) => {
    if (!token) return;
    try {
      await fetch('/api/chat/admin/message', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ chat_type: chatType, message_id: msgId }),
      });
      setMessages(prev => prev.filter(m => m.id !== msgId));
    } catch { /* ignore */ }
  }, [token, chatType]);

  // ── Not logged in ─────────────────────────────────────────────────────────
  if (!isLoggedIn || !user) {
    return (
      <div class="chat-login-wall">
        <div class="chat-login-icon">💬</div>
        <p class="chat-login-text">{t('chat.login_required')}</p>
        <p class="chat-login-hint">{t('chat.login_hint')}</p>
      </div>
    );
  }

  const ago = {
    seconds: t('chat.ago_seconds'),
    minutes: t('chat.ago_minutes'),
    hours:   t('chat.ago_hours'),
    days:    t('chat.ago_days'),
  };

  // ── Tab config ────────────────────────────────────────────────────────────
  type TabDef = { type: ChatType; label: string; disabled?: boolean; title?: string };
  const tabs: TabDef[] = [
    {
      type:  'global',
      label: `🌍 ${t('chat.global')}`,
    },
    ...(hasLang ? [{
      type:  'global-lang' as ChatType,
      label: `🌍 ${t('chat.global')} ${langCode}`,
    }] : []),
    {
      type:     'server',
      label:    hasServer ? `🏠 ${t('chat.server')} ${user.server}` : `🏠 ${t('chat.server')}`,
      disabled: !hasServer,
      title:    !hasServer ? t('chat.no_server_hint') : undefined,
    },
    ...(hasServer && hasLang ? [{
      type:  'server-lang' as ChatType,
      label: `🏠 ${t('chat.server')} ${user.server} ${langCode}`,
    }] : []),
  ];

  // ── Chat UI ───────────────────────────────────────────────────────────────
  return (
    <div class="chat-window">

      {/* ── Online Users Sidebar ── */}
      <div class="chat-online-sidebar">
        <div class="chat-online-header">
          Online <span class="chat-online-count">{visibleOnline.length}</span>
        </div>
        <ul class="chat-online-list">
          {visibleOnline.length === 0 ? (
            <li class="chat-online-empty">—</li>
          ) : (
            visibleOnline.map(u => (
              <li key={u.username} class="chat-online-user">
                <span
                  class="chat-online-dot"
                  style={{ background: factionColor(u.faction) }}
                />
                <span class="chat-online-info">
                  <span class="chat-online-name-row">
                    <span
                      class="chat-online-name"
                      style={{ color: factionColor(u.faction) }}
                    >
                      {u.username}
                    </span>
                    {u.is_admin === 1 && (
                      <span class="chat-online-role">⚙</span>
                    )}
                    {u.is_moderator === 1 && (
                      <span class="chat-online-role chat-online-role-mod">🛡</span>
                    )}
                  </span>
                  {u.server && (
                    <span class="chat-online-server">{u.server}</span>
                  )}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* ── Main Chat Area ── */}
      <div class="chat-main">

        {/* Tab switcher */}
        <div class="chat-tabs" role="tablist">
          {tabs.map(tab => (
            <button
              key={tab.type}
              class={[
                'chat-tab',
                chatType === tab.type ? 'chat-tab-active' : '',
                tab.disabled ? 'chat-tab-disabled' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => !tab.disabled && setChatType(tab.type)}
              role="tab"
              aria-selected={chatType === tab.type}
              disabled={tab.disabled}
              title={tab.title}
            >
              {tab.label}
            </button>
          ))}
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
            isAdmin={isAdmin}
            onDelete={handleDelete}
            onReply={handleReply}
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
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />

      </div>
    </div>
  );
}
