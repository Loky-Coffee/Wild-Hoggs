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

export interface MessageStrings {
  reply:         string;
  pm:            string;
  delete:        string;
  admin:         string;
  mod:           string;
  deleteTitle:   string;
  deleteConfirm: string;
  deleteButton:  string;
  reportTitle:   string;
  reportPrompt:  string;
  report:        string;
  reported:      string;
  cancel:        string;
  reasons: Array<{ value: string; icon: string; label: string }>;
}

interface MessageItemProps {
  msg:             Message;
  currentUsername: string | null;
  onReport:        (id: string, reason: string) => void;
  reportedIds:     Set<string>;
  ago:             AgoStrings;
  isAdmin:         boolean;
  onDelete:        (id: string) => Promise<void>;
  onReply:         (msg: Message) => void;
  onPM?:           (username: string) => void;
  strings:         MessageStrings;
}

const FACTION_COLORS: Record<string, string> = {
  'blood-rose':     '#e74c3c',
  'wings-of-dawn':  '#4a9eda',
  'guard-of-order': '#27ae60',
};

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
  ago, isAdmin, onDelete, onReply, onPM, strings,
}: MessageItemProps) {
  const [deleting,          setDeleting]          = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReportDialog,  setShowReportDialog]  = useState(false);
  const [reportReason,      setReportReason]      = useState<string>(strings.reasons[0]?.value ?? 'spam');

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
      <button class="chat-action-btn" onClick={() => onReply(msg)} title={strings.reply}>↩</button>
      {!isOwn && onPM && (
        <button class="chat-action-btn" onClick={() => onPM(msg.username)} title={strings.pm}>✉</button>
      )}
      {!isOwn && (
        <button
          class={`chat-action-btn${isReported ? ' chat-action-reported' : ''}`}
          onClick={() => !isReported && setShowReportDialog(true)}
          title={isReported ? strings.reported : strings.report}
          disabled={isReported}
        >
          {isReported ? '✓' : '⚑'}
        </button>
      )}
      {isAdmin && (
        <button
          class="chat-action-btn chat-action-delete"
          onClick={() => setShowDeleteConfirm(true)}
          title={strings.delete}
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
            {isAdminMsg && <span class="chat-admin-label">⚙ {strings.admin}</span>}
            {isModMsg   && <span class="chat-mod-label">🛡 {strings.mod}</span>}
            <span class="chat-msg-username" style={{ color: factionColor }}>
              {msg.username}
            </span>
            <ServerBadge faction={msg.faction} server={msg.server} />
          </div>
        )}
        {isOwn && isAdminMsg && (
          <span class="chat-admin-label chat-admin-label-own">{strings.admin} ⚙</span>
        )}
        {isOwn && isModMsg && (
          <span class="chat-mod-label chat-mod-label-own">{strings.mod} 🛡</span>
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
          title={strings.deleteTitle}
          message={strings.deleteConfirm}
          confirmLabel={strings.deleteButton}
          cancelLabel={strings.cancel}
          variant="danger"
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* ── Report Dialog ── */}
      {showReportDialog && (
        <ConfirmDialog
          title={strings.reportTitle}
          message={strings.reportPrompt}
          confirmLabel={strings.report}
          cancelLabel={strings.cancel}
          variant="primary"
          onConfirm={handleReportConfirmed}
          onCancel={() => setShowReportDialog(false)}
        >
          <div class="cd-report-reasons">
            {strings.reasons.map(r => (
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
