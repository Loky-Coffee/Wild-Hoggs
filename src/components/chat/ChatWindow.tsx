import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { useAuth } from '../../hooks/useAuth';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData } from '../../i18n/index';
import MessageList from './MessageList';
import MessageInput, { type ReplyTarget } from './MessageInput';
import type { Message, MessageStrings } from './MessageItem';
import PMPanel from './PMPanel';
import ConfirmDialog from './ConfirmDialog';
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
  const [openPM,       setOpenPM]       = useState<string | null>(null);
  const [pmContacts,   setPmContacts]   = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('wh-pm-contacts') ?? '[]'); }
    catch { return []; }
  });
  const [pmUnread,     setPmUnread]     = useState<Set<string>>(new Set());
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [sidebarOpen,  setSidebarOpen]  = useState(false);

  const pmInboxSince = useRef<string | null>(null);
  const inboxRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const openPMRef    = useRef<string | null>(null);

  const lastCreatedAt = useRef<string | null>(null);
  const pollRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const presenceRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const bgPollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatTypeRef   = useRef<ChatType>(chatType);
  const prevTypeRef   = useRef<ChatType>(chatType);

  // Per-tab "last seen" timestamps for inactive-tab background polling
  const tabSince = useRef<Partial<Record<ChatType, string>>>({});

  const [unreadTabs, setUnreadTabs] = useState<Set<ChatType>>(new Set());

  useEffect(() => {
    // Save current position for the tab we're leaving
    if (lastCreatedAt.current) {
      tabSince.current[prevTypeRef.current] = lastCreatedAt.current;
    }
    prevTypeRef.current = chatType;
    chatTypeRef.current = chatType;
    setReplyTo(null);
    // Clear unread indicator for the tab we just switched to
    setUnreadTabs(prev => {
      if (!prev.has(chatType)) return prev;
      const next = new Set(prev);
      next.delete(chatType);
      return next;
    });
  }, [chatType]);
  useEffect(() => {
    openPMRef.current = openPM;
    if (openPM) {
      // Clear unread for the now-open conversation
      setPmUnread(prev => {
        if (!prev.has(openPM)) return prev;
        const next = new Set(prev);
        next.delete(openPM);
        return next;
      });
    }
  }, [openPM]);

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

  // ── PM Inbox polling (detect incoming PMs) ───────────────────────────────
  useEffect(() => {
    if (!isLoggedIn || !token) return;

    const pollInbox = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const params = pmInboxSince.current
          ? `?since=${encodeURIComponent(pmInboxSince.current)}`
          : '';
        const res = await fetch(`/api/chat/pm-inbox${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json() as { senders: { sender_username: string; last_created_at: string }[]; server_time: string };

        if (data.server_time) pmInboxSince.current = data.server_time;

        if (data.senders.length > 0) {
          data.senders.forEach(({ sender_username }) => {
            // Add to DM contacts list
            setPmContacts(prev => {
              const next = [sender_username, ...prev.filter(n => n !== sender_username)].slice(0, 10);
              localStorage.setItem('wh-pm-contacts', JSON.stringify(next));
              return next;
            });
            if (openPMRef.current === sender_username) return; // already open, PMPanel polls itself
            // Auto-open if no panel is currently open
            if (openPMRef.current === null) {
              setOpenPM(sender_username);
              openPMRef.current = sender_username;
            } else {
              // Another panel is open — just show unread dot
              setPmUnread(prev => new Set([...prev, sender_username]));
            }
          });
        }
      } catch { /* ignore */ }
    };

    // Kick off immediately to get server_time baseline, then poll
    pollInbox();
    inboxRef.current = setInterval(pollInbox, POLL_MS);
    return () => { if (inboxRef.current) clearInterval(inboxRef.current); };
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
      setLoadError(t('chat.error.connection_reload'));
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

  // ── Init baselines for inactive tabs ──────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn || !token) return;
    const allTypes: ChatType[] = ['global', 'global-lang', 'server', 'server-lang'];
    allTypes.forEach(type => {
      if (type === chatType) return; // active tab handled by main poll
      if (type === 'global-lang' && !hasLang) return;
      if (type === 'server' && !hasServer) return;
      if (type === 'server-lang' && (!hasServer || !hasLang)) return;
      fetch(buildUrl(type, 'limit=1'), { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then((data: { messages: { created_at: string }[] } | null) => {
          if (data?.messages.length) {
            tabSince.current[type] = data.messages[data.messages.length - 1].created_at;
          }
        })
        .catch(() => {});
    });
  }, [isLoggedIn, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Background poll for inactive tabs (10 s) ──────────────────────────────
  useEffect(() => {
    if (!isLoggedIn || !token) return;

    const bgPoll = async () => {
      if (document.visibilityState === 'hidden') return;
      const allTypes: ChatType[] = ['global', 'global-lang', 'server', 'server-lang'];
      const inactive = allTypes.filter(t => {
        if (t === chatTypeRef.current) return false;
        if (t === 'global-lang' && !hasLang) return false;
        if (t === 'server' && !hasServer) return false;
        if (t === 'server-lang' && (!hasServer || !hasLang)) return false;
        return true;
      });
      await Promise.all(inactive.map(async type => {
        const since = tabSince.current[type];
        if (!since) return;
        try {
          const res = await fetch(
            buildUrl(type, `since=${encodeURIComponent(since)}&limit=1`),
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (!res.ok) return;
          const data = await res.json() as { messages: { created_at: string }[] };
          if (data.messages.length > 0) {
            tabSince.current[type] = data.messages[data.messages.length - 1].created_at;
            setUnreadTabs(prev => prev.has(type) ? prev : new Set([...prev, type]));
          }
        } catch { /* ignore */ }
      }));
    };

    bgPollRef.current = setInterval(bgPoll, 10_000);
    return () => { if (bgPollRef.current) { clearInterval(bgPollRef.current); bgPollRef.current = null; } };
  }, [isLoggedIn, token, buildUrl, hasLang, hasServer]);

  // ── Dispatch global unread count to GlobalChatPoller ──────────────────────
  useEffect(() => {
    if (!isLoggedIn) return;
    const total = pmUnread.size + unreadTabs.size;
    window.dispatchEvent(new CustomEvent('wh:unread-count', { detail: { total } }));
  }, [pmUnread, unreadTabs, isLoggedIn]);

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
      if (!res.ok) { setSendError(data.error ?? t('chat.error.send_failed')); return; }
      const newMsg = data as Message;
      setMessages(prev => {
        const known = new Set(prev.map(m => m.id));
        return known.has(newMsg.id) ? prev : [...prev, newMsg];
      });
      lastCreatedAt.current = newMsg.created_at;
      setReplyTo(null);
    } catch {
      setSendError(t('chat.error.connection_retry'));
    } finally {
      setSending(false);
    }
  }, [token, chatType, buildUrl, replyTo]);

  const handleReport = useCallback(async (msgId: string, reason: string) => {
    if (!token) return;
    try {
      await fetch('/api/chat/report', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ chat_type: chatType, message_id: msgId, reason }),
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

  const openPMWith = useCallback((username: string) => {
    setOpenPM(username);
    setPmUnread(prev => {
      if (!prev.has(username)) return prev;
      const next = new Set(prev); next.delete(username); return next;
    });
    setPmContacts(prev => {
      const next = [username, ...prev.filter(n => n !== username)].slice(0, 10);
      localStorage.setItem('wh-pm-contacts', JSON.stringify(next));
      return next;
    });
  }, []);

  const removePMContact = useCallback((username: string, e: MouseEvent) => {
    e.stopPropagation();
    setConfirmRemove(username);
  }, []);

  const doRemovePMContact = useCallback((username: string) => {
    setConfirmRemove(null);
    if (openPM === username) setOpenPM(null);
    setPmUnread(prev => { const next = new Set(prev); next.delete(username); return next; });
    setPmContacts(prev => {
      const next = prev.filter(n => n !== username);
      localStorage.setItem('wh-pm-contacts', JSON.stringify(next));
      return next;
    });
  }, [openPM]);

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

  const messageStrings: MessageStrings = {
    reply:         t('chat.action.reply'),
    pm:            t('chat.action.pm'),
    delete:        t('chat.action.delete'),
    admin:         t('chat.role.admin'),
    mod:           t('chat.role.moderator'),
    survivor:      t('chat.role.survivor'),
    deleteTitle:   t('chat.delete.title'),
    deleteConfirm: t('chat.delete.confirm'),
    deleteButton:  t('chat.delete.button'),
    reportTitle:   t('chat.report.title'),
    reportPrompt:  t('chat.report.choose_reason'),
    report:        t('chat.report'),
    reported:      t('chat.report_sent'),
    cancel:        t('dialog.cancel'),
    reasons: [
      { value: 'spam',   icon: '📢', label: t('chat.report.reason.spam') },
      { value: 'porn',   icon: '🔞', label: t('chat.report.reason.porn') },
      { value: 'racism', icon: '🚫', label: t('chat.report.reason.racism') },
      { value: 'hate',   icon: '💢', label: t('chat.report.reason.hate') },
      { value: 'other',  icon: '⚠️', label: t('chat.report.reason.other') },
    ],
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

      {/* ── Sidebar backdrop (mobile only) ── */}
      {sidebarOpen && (
        <div class="chat-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Online Users Sidebar ── */}
      <div class={`chat-online-sidebar${sidebarOpen ? ' chat-sidebar-open' : ''}`}>

        {/* DM Contacts — top section, always visible */}
        {pmContacts.length > 0 && (
          <div class="chat-pm-contacts">
            <div class="chat-pm-contacts-header">{t('chat.dms')}</div>
            {pmContacts.map(name => (
              <div key={name} class="chat-pm-contact-row">
                <button
                  class={`chat-pm-contact${openPM === name ? ' chat-pm-contact-active' : ''}`}
                  onClick={() => openPMWith(name)}
                >
                  <span class="chat-pm-contact-icon">✉</span>
                  <span class="chat-pm-contact-name">{name}</span>
                  {pmUnread.has(name) && <span class="chat-pm-unread-dot" />}
                </button>
                <button
                  class="chat-pm-contact-remove"
                  onClick={(e) => removePMContact(name, e as unknown as MouseEvent)}
                  title={t('chat.action.remove')}
                >×</button>
              </div>
            ))}
          </div>
        )}

        <div class="chat-online-header">
          {t('chat.online')} <span class="chat-online-count">{visibleOnline.length}</span>
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
                {u.username !== user?.username && (
                  <button
                    class="chat-online-pm-btn"
                    onClick={() => openPMWith(u.username)}
                    title="PM"
                  >✉</button>
                )}
              </li>
            ))
          )}
        </ul>
      </div>

      {/* ── PM Panel + mobile backdrop ── */}
      {openPM && token && (
        <div class="chat-pm-backdrop" onClick={() => setOpenPM(null)} />
      )}
      {openPM && token && (
        <PMPanel
          username={openPM}
          currentUsername={user.username}
          token={token}
          onClose={() => setOpenPM(null)}
          ago={ago}
          isAdmin={isAdmin}
          translationData={translationData}
        />
      )}

      {/* ── Main Chat Area ── */}
      <div class="chat-main">

        {/* Tab switcher */}
        <div class="chat-tabs" role="tablist">
          <button
            class={`chat-sidebar-toggle${sidebarOpen ? ' chat-sidebar-toggle-active' : ''}`}
            onClick={() => setSidebarOpen(s => !s)}
            title={t('chat.online')}
          >
            👥 {visibleOnline.length}
          </button>
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
              {unreadTabs.has(tab.type) && <span class="chat-tab-dot" />}
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
            ago={ago}
            isAdmin={isAdmin}
            onDelete={handleDelete}
            onReply={handleReply}
            onPM={openPMWith}
            strings={messageStrings}
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

      {/* ── Confirm Remove DM Dialog ── */}
      {confirmRemove && (
        <ConfirmDialog
          title={t('chat.pm.remove_title')}
          message={t('chat.pm.remove_confirm', { username: confirmRemove })}
          confirmLabel={t('chat.action.remove')}
          cancelLabel={t('dialog.cancel')}
          variant="danger"
          onConfirm={() => doRemovePMContact(confirmRemove)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}
