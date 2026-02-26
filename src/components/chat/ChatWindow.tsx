import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { useAuth } from '../../hooks/useAuth';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import type { Message } from './MessageItem';
import './ChatWindow.css';

type ChatType = 'global' | 'server';

const POLL_MS = 5_000;

export default function ChatWindow() {
  const { user, token, isLoggedIn } = useAuth();

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

  // Keep ref in sync so poll callback always has current chatType
  useEffect(() => { chatTypeRef.current = chatType; }, [chatType]);

  const getEndpoint = useCallback((type: ChatType) => {
    return type === 'global'
      ? '/api/chat/global'
      : `/api/chat/server/${user?.server}`;
  }, [user?.server]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Load initial messages for given chat type
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
        setLoadError(data.error ?? 'Fehler beim Laden.');
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
  }, [token, getEndpoint]);

  // Poll for new messages (called every POLL_MS, paused when tab hidden)
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
          const knownIds = new Set(prev.map(m => m.id));
          const fresh    = data.messages.filter(m => !knownIds.has(m.id));
          return fresh.length > 0 ? [...prev, ...fresh] : prev;
        });
        lastCreatedAt.current = data.messages[data.messages.length - 1].created_at;
      }
    } catch { /* ignore transient errors */ }
  }, [token, getEndpoint]);

  // (Re-)start polling whenever chat type or auth changes
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
      if (!res.ok) {
        setSendError(data.error ?? 'Senden fehlgeschlagen.');
        return;
      }
      const newMsg = data as Message;
      setMessages(prev => {
        const knownIds = new Set(prev.map(m => m.id));
        return knownIds.has(newMsg.id) ? prev : [...prev, newMsg];
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
        <p class="chat-login-text">Melde dich an um am Chat teilzunehmen.</p>
        <p class="chat-login-hint">Klicke auf "Einloggen" oben in der Navigation.</p>
      </div>
    );
  }

  const canUseServer = !!user.server;

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
          🌍 Global
        </button>
        <button
          class={`chat-tab${chatType === 'server' ? ' chat-tab-active' : ''}${!canUseServer ? ' chat-tab-disabled' : ''}`}
          onClick={() => canUseServer ? setChatType('server') : undefined}
          role="tab"
          aria-selected={chatType === 'server'}
          disabled={!canUseServer}
          title={!canUseServer ? 'Trage deine Server-Nummer im Profil ein um den Server-Chat zu nutzen.' : undefined}
        >
          🏠 {user.server ? `Server ${user.server}` : 'Server'}
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
        />
      )}

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        sending={sending}
        sendError={sendError}
        onClearError={() => setSendError(null)}
      />
    </div>
  );
}
