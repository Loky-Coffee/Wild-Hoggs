import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import type { AgoStrings } from './MessageItem';
import './PMPanel.css';

interface PMMessage {
  id:              string;
  sender_username: string;
  message:         string;
  created_at:      string;
}

interface PMPanelProps {
  username:        string;
  currentUsername: string;
  token:           string;
  onClose:         () => void;
  ago:             AgoStrings;
}

function relativeTime(dateStr: string, ago: AgoStrings): string {
  const iso     = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr  / 24);

  if (diffSec < 60) return ago.seconds;
  if (diffMin < 60) return ago.minutes.replace('{n}', String(diffMin));
  if (diffHr  < 24) return ago.hours.replace('{n}', String(diffHr));
  return ago.days.replace('{n}', String(diffDay));
}

const POLL_MS = 5_000;

export default function PMPanel({ username, currentUsername, token, onClose, ago }: PMPanelProps) {
  const [messages,  setMessages]  = useState<PMMessage[]>([]);
  const [text,      setText]      = useState('');
  const [sending,   setSending]   = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);

  const listRef       = useRef<HTMLDivElement>(null);
  const atBottomRef   = useRef(true);
  const lastCreatedAt = useRef<string | null>(null);
  const pollRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track scroll position
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Auto-scroll on new messages — only if already at bottom
  useEffect(() => {
    if (atBottomRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Initial load
  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/pm/${encodeURIComponent(username)}?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json() as { messages: PMMessage[] };
      setMessages(data.messages);
      if (data.messages.length > 0) {
        lastCreatedAt.current = data.messages[data.messages.length - 1].created_at;
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
      // Scroll to bottom after initial load
      requestAnimationFrame(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
      });
    }
  }, [username, token]);

  // Polling
  const poll = useCallback(async () => {
    if (!lastCreatedAt.current) return;
    try {
      const since = encodeURIComponent(lastCreatedAt.current);
      const res = await fetch(`/api/chat/pm/${encodeURIComponent(username)}?since=${since}&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json() as { messages: PMMessage[] };
      if (data.messages.length > 0) {
        setMessages(prev => {
          const known = new Set(prev.map(m => m.id));
          const fresh = data.messages.filter(m => !known.has(m.id));
          return fresh.length > 0 ? [...prev, ...fresh] : prev;
        });
        lastCreatedAt.current = data.messages[data.messages.length - 1].created_at;
      }
    } catch { /* ignore */ }
  }, [username, token]);

  useEffect(() => {
    setMessages([]);
    lastCreatedAt.current = null;
    loadInitial();
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (document.visibilityState !== 'hidden') poll();
    }, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [username, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = useCallback(async () => {
    const msg = text.trim();
    if (!msg || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/chat/pm/${encodeURIComponent(username)}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ message: msg }),
      });
      const data = await res.json() as any;
      if (!res.ok) { setSendError(data.error ?? 'Senden fehlgeschlagen.'); return; }
      const newMsg = data as PMMessage;
      setMessages(prev => {
        const known = new Set(prev.map(m => m.id));
        return known.has(newMsg.id) ? prev : [...prev, newMsg];
      });
      lastCreatedAt.current = newMsg.created_at;
      setText('');
      // Force scroll to bottom after sending
      atBottomRef.current = true;
    } catch {
      setSendError('Verbindungsfehler.');
    } finally {
      setSending(false);
    }
  }, [text, sending, username, token]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div class="chat-pm-panel">
      <div class="chat-pm-header">
        <span class="chat-pm-title">✉ {username}</span>
        <button class="chat-pm-close" onClick={onClose} title="Schließen">×</button>
      </div>

      <div class="chat-pm-messages" ref={listRef}>
        {loading ? (
          <div class="chat-pm-loading">…</div>
        ) : messages.length === 0 ? (
          <p class="chat-pm-empty">Noch keine Nachrichten</p>
        ) : (
          messages.map(m => {
            const isOwn = m.sender_username === currentUsername;
            return (
              <div key={m.id} class={`chat-pm-msg-row${isOwn ? ' chat-pm-msg-own' : ' chat-pm-msg-other'}`}>
                <div class={`chat-bubble${isOwn ? ' chat-bubble-own' : ' chat-bubble-other'} chat-pm-bubble`}>
                  {!isOwn && (
                    <div class="chat-pm-sender">{m.sender_username}</div>
                  )}
                  <p class="chat-msg-text">{m.message}</p>
                  <div class={`chat-bubble-footer${isOwn ? ' chat-bubble-footer-own' : ''}`}>
                    <span class="chat-msg-time">{relativeTime(m.created_at, ago)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div class="chat-pm-input-area">
        {sendError && <div class="chat-send-error">{sendError}</div>}
        <div class="chat-pm-input-row">
          <textarea
            class="chat-pm-textarea"
            value={text}
            onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
            onKeyDown={handleKeyDown}
            placeholder={`Nachricht an ${username}…`}
            maxLength={500}
            disabled={sending}
            rows={1}
          />
          <button
            class="chat-pm-send-btn"
            onClick={handleSend}
            disabled={sending || !text.trim()}
            title="Senden"
          >
            ➤
          </button>
        </div>
        <div class="chat-input-footer">
          <span class={`chat-char-count${text.length > 450 ? ' chat-char-warn' : ''}`}>
            {500 - text.length}
          </span>
        </div>
      </div>
    </div>
  );
}
