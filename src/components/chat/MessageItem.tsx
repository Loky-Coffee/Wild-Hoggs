import { useState, useEffect, useRef } from 'preact/hooks';
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
  survivor:      string;
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

// Radial positions: angles (degrees) per button count, right-side origin
// R=68, 40° spacing → arc gap ≈ button diameter → buttons nearly touch
const RADIAL_R = 68;
const RADIAL_ANGLES: Record<number, number[]> = {
  1: [0],
  2: [-20, 20],
  3: [-40,  0, 40],
  4: [-60, -20, 20, 60],
};
function radialPos(side: 'left' | 'right', idx: number, total: number) {
  const angles = RADIAL_ANGLES[Math.min(total, 4)] ?? RADIAL_ANGLES[4];
  const deg    = angles[idx] ?? 0;
  const rad    = deg * Math.PI / 180;
  const x      = Math.round(RADIAL_R * Math.cos(rad));
  const y      = Math.round(RADIAL_R * Math.sin(rad));
  // Mirror x for left side so arc opens in the correct direction
  return { x: side === 'right' ? x : -x, y };
}

export default function MessageItem({
  msg, currentUsername, onReport, reportedIds,
  ago, isAdmin, onDelete, onReply, onPM, strings,
}: MessageItemProps) {
  const [deleting,          setDeleting]          = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReportDialog,  setShowReportDialog]  = useState(false);
  const [reportReason,      setReportReason]      = useState<string>(strings.reasons[0]?.value ?? 'spam');
  const [menuOpen,          setMenuOpen]          = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  const factionColor = msg.faction
    ? (FACTION_COLORS[msg.faction] ?? 'rgba(255,255,255,0.7)')
    : 'rgba(255,255,255,0.7)';
  const isOwn      = msg.username === currentUsername;
  const isReported = reportedIds.has(msg.id);
  const isAdminMsg = msg.is_admin === 1;
  const isModMsg   = msg.is_moderator === 1 && !isAdminMsg;
  const isUserMsg  = !isAdminMsg && !isModMsg;

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

  const side = isOwn ? 'left' : 'right';

  // Build the list of radial action buttons
  type RBtn = { key: string; icon: string; title: string; cls?: string; disabled?: boolean; action: () => void };
  const btns: RBtn[] = [];
  btns.push({ key: 'reply', icon: '↩', title: strings.reply, action: () => onReply(msg) });
  if (!isOwn && onPM)
    btns.push({ key: 'pm', icon: '✉', title: strings.pm, action: () => onPM(msg.username) });
  if (!isOwn)
    btns.push({
      key:      'report',
      icon:     isReported ? '✓' : '⚑',
      title:    isReported ? strings.reported : strings.report,
      cls:      isReported ? 'chat-radial-reported' : '',
      disabled: isReported,
      action:   () => { if (!isReported) setShowReportDialog(true); },
    });
  if (isAdmin)
    btns.push({ key: 'delete', icon: '🗑', title: strings.delete, cls: 'chat-radial-delete', disabled: deleting, action: () => setShowDeleteConfirm(true) });

  const actionMenu = (
    <div ref={menuRef} class="chat-radial-menu">
      <button
        class={`chat-radial-toggle${menuOpen ? ' chat-radial-toggle-open' : ''}`}
        onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
        title="Actions"
        aria-label="Actions"
      >
        ···
      </button>
      {btns.map((btn, i) => {
        const pos = radialPos(side, i, btns.length);
        return (
          <button
            key={btn.key}
            class={`chat-radial-btn${menuOpen ? ' open' : ''}${btn.cls ? ' ' + btn.cls : ''}`}
            style={{
              '--tx': `${pos.x}px`,
              '--ty': `${pos.y}px`,
              transitionDelay: menuOpen
                ? `${i * 0.045}s`
                : `${(btns.length - 1 - i) * 0.03}s`,
            } as any}
            onClick={e => { e.stopPropagation(); btn.action(); setMenuOpen(false); }}
            title={btn.title}
            disabled={btn.disabled}
          >
            {btn.icon}
          </button>
        );
      })}
    </div>
  );

  return (
    <div class={`chat-msg-row${isOwn ? ' chat-msg-row-own' : ' chat-msg-row-other'}`}>
      {isOwn && actionMenu}

      <div class={[
        'chat-bubble',
        isOwn ? 'chat-bubble-own' : 'chat-bubble-other',
        isAdminMsg ? 'chat-bubble-admin' : '',
        isModMsg   ? 'chat-bubble-mod'   : '',
        isUserMsg  ? 'chat-bubble-user'  : '',
      ].filter(Boolean).join(' ')}>
        {!isOwn && (
          <div class="chat-bubble-header">
            {isAdminMsg && <span class="chat-admin-label">⚙ {strings.admin}</span>}
            {isModMsg   && <span class="chat-mod-label">🛡 {strings.mod}</span>}
            {isUserMsg  && <span class="chat-user-label">⚔ {strings.survivor}</span>}
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
        {isOwn && isUserMsg && (
          <span class="chat-user-label chat-user-label-own">{strings.survivor} ⚔</span>
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

      {!isOwn && actionMenu}

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
