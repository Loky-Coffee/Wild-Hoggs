import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import MessageList from './MessageList';
import type { Message, AgoStrings } from './MessageItem';
import './PMPanel.css';

interface PMPanelProps {
  username:        string;
  currentUsername: string;
  token:           string;
  onClose:         () => void;
  ago:             AgoStrings;
  isAdmin:         boolean;
}

const POLL_MS = 5_000;

export default function PMPanel({ username, currentUsername, token, onClose, ago, isAdmin }: PMPanelProps) {
  const [messages,    setMessages]    = useState<Message[]>([]);
  const [text,        setText]        = useState('');
  const [sending,     setSending]     = useState(false);
  const [sendError,   setSendError]   = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  const lastCreatedAt = useRef<string | null>(null);
  const pollRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initial load
  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/pm/${encodeURIComponent(username)}?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json() as { messages: Message[] };
      setMessages(data.messages);
      if (data.messages.length > 0) {
        lastCreatedAt.current = data.messages[data.messages.length - 1].created_at;
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
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
      const data = await res.json() as { messages: Message[] };
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
    setReportedIds(new Set());
    lastCreatedAt.current = null;
    loadInitial();
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (document.visibilityState !== 'hidden') poll();
    }, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
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
      const newMsg = data as Message;
      setMessages(prev => {
        const known = new Set(prev.map(m => m.id));
        return known.has(newMsg.id) ? prev : [...prev, newMsg];
      });
      lastCreatedAt.current = newMsg.created_at;
      setText('');
    } catch {
      setSendError('Verbindungsfehler.');
    } finally {
      setSending(false);
    }
  }, [text, sending, username, token]);

  const handleReport = useCallback(async (msgId: string) => {
    try {
      await fetch('/api/chat/report', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ chat_type: 'pm', message_id: msgId }),
      });
      setReportedIds(prev => new Set([...prev, msgId]));
    } catch { /* ignore */ }
  }, [token]);

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

      {loading ? (
        <div class="chat-pm-loading-wrap">
          <span class="chat-loading-dot" />
          <span class="chat-loading-dot" />
          <span class="chat-loading-dot" />
        </div>
      ) : (
        <MessageList
          messages={messages}
          currentUsername={currentUsername}
          onReport={handleReport}
          reportedIds={reportedIds}
          noMessages="Noch keine Nachrichten"
          reportLabel="Melden"
          reportedLabel="Gemeldet"
          ago={ago}
          isAdmin={isAdmin}
          onDelete={() => Promise.resolve()}
          onReply={() => {}}
          onPM={() => {}}
        />
      )}

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
