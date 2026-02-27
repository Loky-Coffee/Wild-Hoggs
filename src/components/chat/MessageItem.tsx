import { useState } from 'preact/hooks';
import ServerBadge from './ServerBadge';
import ConfirmDialog from './ConfirmDialog';

export interface Message {
  id:         string;
  username:   string;
  faction:    string | null;
  server:     string | null;
  message:    string;
  created_at: string;
  is_admin:     number;
  is_moderator: number;
  reply_to_id?:       string | null;
  reply_to_username?: string | null;
  reply_to_text?:     string | null;
}

export interface AgoStrings {
  seconds: string;
  minutes: string;
  hours:   string;
  days:    string;
}

interface MessageItemProps {
  msg:             Message;
  currentUsername: string | null;
  onReport:        (id: string, reason: string) => void;
  reportedIds:     Set<string>;
  reportLabel:     string;
  reportedLabel:   string;
  ago:             AgoStrings;
  isAdmin:         boolean;
  onDelete:        (id: string) => Promise<void>;
  onReply:         (msg: Message) => void;
  onPM?:           (username: string) => void;
}

const FACTION_COLORS: Record<string, string> = {
  'blood-rose':     '#e74c3c',
  'wings-of-dawn':  '#4a9eda',
  'guard-of-order': '#27ae60',
};

const REPORT_REASONS = [
  { value: 'spam',    icon: '📢', label: 'Spam / Werbung' },
  { value: 'porn',    icon: '🔞', label: 'Pornografische Inhalte' },
  { value: 'racism',  icon: '🚫', label: 'Rassismus / Diskriminierung' },
  { value: 'hate',    icon: '💢', label: 'Beleidigung / Hassrede' },
  { value: 'other',   icon: '⚠️', label: 'Sonstiges' },
] as const;

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

export default function MessageItem({
  msg, currentUsername, onReport, reportedIds,
  reportLabel, reportedLabel, ago, isAdmin, onDelete, onReply, onPM,
}: MessageItemProps) {
  const [deleting,          setDeleting]          = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReportDialog,  setShowReportDialog]  = useState(false);
  const [reportReason,      setReportReason]      = useState<string>(REPORT_REASONS[0].value);

  const factionColor = msg.faction
    ? (FACTION_COLORS[msg.faction] ?? 'rgba(255,255,255,0.7)')
    : 'rgba(255,255,255,0.7)';
  const isOwn      = msg.username === currentUsername;
  const isReported = reportedIds.has(msg.id);
  const isAdminMsg = msg.is_admin === 1;
  const isModMsg   = msg.is_moderator === 1 && !isAdminMsg;

  const handleDeleteConfirmed = async () => {
    setShowDeleteConfirm(false);
    setDeleting(true);
    await onDelete(msg.id);
    setDeleting(false);
  };

  const handleReportConfirmed = () => {
    setShowReportDialog(false);
    onReport(msg.id, reportReason);
  };

  const actions = (
    <div class={`chat-msg-actions${isOwn ? ' chat-msg-actions-own' : ' chat-msg-actions-other'}`}>
      <button class="chat-action-btn" onClick={() => onReply(msg)} title="Antworten">↩</button>
      {!isOwn && onPM && (
        <button class="chat-action-btn" onClick={() => onPM(msg.username)} title="Private Nachricht">✉</button>
      )}
      {!isOwn && (
        <button
          class={`chat-action-btn${isReported ? ' chat-action-reported' : ''}`}
          onClick={() => !isReported && setShowReportDialog(true)}
          title={isReported ? reportedLabel : reportLabel}
          disabled={isReported}
        >
          {isReported ? '✓' : '⚑'}
        </button>
      )}
      {isAdmin && (
        <button
          class="chat-action-btn chat-action-delete"
          onClick={() => setShowDeleteConfirm(true)}
          title="Nachricht löschen"
          disabled={deleting}
        >
          🗑
        </button>
      )}
    </div>
  );

  return (
    <div class={`chat-msg-row${isOwn ? ' chat-msg-row-own' : ' chat-msg-row-other'}`}>
      {isOwn && actions}

      <div class={[
        'chat-bubble',
        isOwn ? 'chat-bubble-own' : 'chat-bubble-other',
        isAdminMsg ? 'chat-bubble-admin' : '',
        isModMsg   ? 'chat-bubble-mod'   : '',
      ].filter(Boolean).join(' ')}>
        {!isOwn && (
          <div class="chat-bubble-header">
            {isAdminMsg && <span class="chat-admin-label">⚙ Administrator</span>}
            {isModMsg   && <span class="chat-mod-label">🛡 Moderator</span>}
            <span class="chat-msg-username" style={{ color: factionColor }}>
              {msg.username}
            </span>
            <ServerBadge faction={msg.faction} server={msg.server} />
          </div>
        )}
        {isOwn && isAdminMsg && (
          <span class="chat-admin-label chat-admin-label-own">Administrator ⚙</span>
        )}
        {isOwn && isModMsg && (
          <span class="chat-mod-label chat-mod-label-own">Moderator 🛡</span>
        )}
        {msg.reply_to_id && (
          <div class={`chat-reply-quote${isOwn ? ' chat-reply-quote-own' : ''}`}>
            <span class="chat-reply-author">{msg.reply_to_username ?? '—'}</span>
            <span class="chat-reply-text">{msg.reply_to_text ?? '…'}</span>
          </div>
        )}
        <p class="chat-msg-text">{msg.message}</p>
        <div class={`chat-bubble-footer${isOwn ? ' chat-bubble-footer-own' : ''}`}>
          <span class="chat-msg-time">{relativeTime(msg.created_at, ago)}</span>
        </div>
      </div>

      {!isOwn && actions}

      {/* ── Delete Confirm ── */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="Nachricht löschen"
          message="Diese Nachricht wirklich löschen?"
          confirmLabel="Löschen"
          variant="danger"
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* ── Report Dialog ── */}
      {showReportDialog && (
        <ConfirmDialog
          title="Nachricht melden"
          message="Wähle einen Grund für die Meldung:"
          confirmLabel="Melden"
          variant="primary"
          onConfirm={handleReportConfirmed}
          onCancel={() => setShowReportDialog(false)}
        >
          <div class="cd-report-reasons">
            {REPORT_REASONS.map(r => (
              <label
                key={r.value}
                class={`cd-report-reason${reportReason === r.value ? ' cd-report-reason-active' : ''}`}
              >
                <input
                  type="radio"
                  name={`report-reason-${msg.id}`}
                  value={r.value}
                  checked={reportReason === r.value}
                  onChange={() => setReportReason(r.value)}
                />
                <span class="cd-report-reason-icon">{r.icon}</span>
                <span class="cd-report-reason-label">{r.label}</span>
              </label>
            ))}
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
