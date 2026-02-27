import { useState } from 'preact/hooks';
import ServerBadge from './ServerBadge';

export interface Message {
  id:         string;
  username:   string;
  faction:    string | null;
  server:     string | null;
  message:    string;
  created_at: string;
}

export interface AgoStrings {
  seconds: string; // e.g. "just now"
  minutes: string; // e.g. "{n} min ago"
  hours:   string; // e.g. "{n} hr ago"
  days:    string; // e.g. "{n} day(s) ago"
}

interface MessageItemProps {
  msg:             Message;
  currentUsername: string | null;
  onReport:        (id: string) => void;
  reportedIds:     Set<string>;
  reportLabel:     string;
  reportedLabel:   string;
  ago:             AgoStrings;
  isAdmin:         boolean;
  onDelete:        (id: string) => void;
}

const FACTION_COLORS: Record<string, string> = {
  'blood-rose':     '#e74c3c',
  'wings-of-dawn':  '#4a9eda',
  'guard-of-order': '#27ae60',
};

function relativeTime(dateStr: string, ago: AgoStrings): string {
  // SQLite returns "YYYY-MM-DD HH:MM:SS" (UTC) — append Z for correct parsing
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

export default function MessageItem({
  msg, currentUsername, onReport, reportedIds,
  reportLabel, reportedLabel, ago, isAdmin, onDelete,
}: MessageItemProps) {
  const [deleting, setDeleting] = useState(false);

  const factionColor = msg.faction
    ? (FACTION_COLORS[msg.faction] ?? 'rgba(255,255,255,0.7)')
    : 'rgba(255,255,255,0.7)';
  const isOwn      = msg.username === currentUsername;
  const isReported = reportedIds.has(msg.id);

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(msg.id);
    setDeleting(false);
  };

  return (
    <div class={`chat-msg-row${isOwn ? ' chat-msg-row-own' : ' chat-msg-row-other'}`}>
      <div class={`chat-bubble${isOwn ? ' chat-bubble-own' : ' chat-bubble-other'}`}>
        {!isOwn && (
          <div class="chat-bubble-header">
            <span class="chat-msg-username" style={{ color: factionColor }}>
              {msg.username}
            </span>
            <ServerBadge faction={msg.faction} server={msg.server} />
          </div>
        )}
        <p class="chat-msg-text">{msg.message}</p>
        <div class={`chat-bubble-footer${isOwn ? ' chat-bubble-footer-own' : ''}`}>
          <span class="chat-msg-time">{relativeTime(msg.created_at, ago)}</span>
          {!isOwn && (
            <button
              class={`chat-msg-report${isReported ? ' chat-msg-report-done' : ''}`}
              onClick={() => !isReported && onReport(msg.id)}
              title={isReported ? reportedLabel : reportLabel}
              disabled={isReported}
            >
              {isReported ? '✓' : '⚑'}
            </button>
          )}
          {isAdmin && (
            <button
              class="chat-msg-delete"
              onClick={handleDelete}
              title="Nachricht löschen"
              disabled={deleting}
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
