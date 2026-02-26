import ServerBadge from './ServerBadge';

export interface Message {
  id:         string;
  username:   string;
  faction:    string | null;
  server:     string | null;
  message:    string;
  created_at: string;
}

interface MessageItemProps {
  msg:             Message;
  currentUsername: string | null;
  onReport:        (id: string) => void;
  reportedIds:     Set<string>;
}

const FACTION_COLORS: Record<string, string> = {
  'blood-rose':     '#e74c3c',
  'wings-of-dawn':  '#4a9eda',
  'guard-of-order': '#27ae60',
};

function relativeTime(dateStr: string): string {
  // SQLite returns "YYYY-MM-DD HH:MM:SS" without Z — treat as UTC
  const iso = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr  / 24);

  if (diffSec < 60) return 'gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  if (diffHr  < 24) return `vor ${diffHr} Std.`;
  return `vor ${diffDay} Tag${diffDay !== 1 ? 'en' : ''}`;
}

export default function MessageItem({ msg, currentUsername, onReport, reportedIds }: MessageItemProps) {
  const factionColor  = msg.faction ? (FACTION_COLORS[msg.faction] ?? 'rgba(255,255,255,0.15)') : 'rgba(255,255,255,0.15)';
  const isOwn         = msg.username === currentUsername;
  const isReported    = reportedIds.has(msg.id);

  return (
    <div class="chat-msg" style={{ borderLeftColor: factionColor }} data-faction={msg.faction ?? 'none'}>
      <div class="chat-msg-header">
        <span class="chat-msg-username" style={{ color: factionColor }}>
          {msg.username}
        </span>
        <ServerBadge faction={msg.faction} server={msg.server} />
        <span class="chat-msg-time">{relativeTime(msg.created_at)}</span>
        {!isOwn && (
          <button
            class={`chat-msg-report${isReported ? ' chat-msg-report-done' : ''}`}
            onClick={() => !isReported && onReport(msg.id)}
            title={isReported ? 'Gemeldet' : 'Melden'}
            disabled={isReported}
          >
            {isReported ? '✓' : '⚑'}
          </button>
        )}
      </div>
      <p class="chat-msg-text">{msg.message}</p>
    </div>
  );
}
