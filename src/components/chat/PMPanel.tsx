import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData } from '../../i18n/index';
import MessageList from './MessageList';
import type { Message, AgoStrings, MessageStrings } from './MessageItem';
import './PMPanel.css';

interface PMPanelProps {
  username:        string;
  currentUsername: string;
  token:           string;
  onClose:         () => void;
  ago:             AgoStrings;
  isAdmin:         boolean;
  translationData: TranslationData;
}

const POLL_MS = 5_000;

export default function PMPanel({ username, currentUsername, token, onClose, ago, isAdmin, translationData }: PMPanelProps) {
  const t = useTranslations(translationData);

  const [messages,    setMessages]    = useState<Message[]>([]);
  const [text,        setText]        = useState('');
  const [sending,     setSending]     = useState(false);
  const [sendError,   setSendError]   = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  const lastCreatedAt = useRef<string | null>(null);
  const pollRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  const strings: MessageStrings = {
    reply:         t('chat.action.reply'),
    pm:            t('chat.action.pm'),
    delete:        t('chat.action.delete'),
    admin:         t('chat.role.admin'),
    mod:           t('chat.role.moderator'),
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
      if (!res.ok) { setSendError(data.error ?? t('chat.error.send_failed')); return; }
      const newMsg = data as Message;
      setMessages(prev => {
        const known = new Set(prev.map(m => m.id));
        return known.has(newMsg.id) ? prev : [...prev, newMsg];
      });
      lastCreatedAt.current = newMsg.created_at;
      setText('');
    } catch {
      setSendError(t('chat.error.connection'));
    } finally {
      setSending(false);
    }
  }, [text, sending, username, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReport = useCallback(async (msgId: string, reason: string) => {
    try {
      await fetch('/api/chat/report', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ chat_type: 'pm', message_id: msgId, reason }),
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
        <button class="chat-pm-close" onClick={onClose} title={t('chat.action.close')}>×</button>
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
          noMessages={t('chat.pm.no_messages')}
          ago={ago}
          isAdmin={isAdmin}
          onDelete={() => Promise.resolve()}
          onReply={() => {}}
          onPM={() => {}}
          strings={strings}
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
            placeholder={t('chat.pm.placeholder', { username })}
            maxLength={500}
            disabled={sending}
            rows={1}
          />
          <button
            class="chat-pm-send-btn"
            onClick={handleSend}
            disabled={sending || !text.trim()}
            title={t('chat.action.send')}
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
