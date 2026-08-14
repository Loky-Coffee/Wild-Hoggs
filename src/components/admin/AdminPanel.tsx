import { useState, useEffect } from 'preact/hooks';
import { msAusZeitstempel } from '../../utils/zeit';
import { useAuth } from '../../hooks/useAuth';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData } from '../../i18n/index';
import { darf, darfEines, parseRechte, type Recht } from '../../utils/permissions';
import AdminStats from './AdminStats';
import AdminPermissions from './AdminPermissions';
import AdminSystem from './AdminSystem';
import './AdminPanel.css';

interface AdminPanelProps {
  translationData: TranslationData;
}

interface Report {
  report_id: string;
  chat_type: string;
  message_id: string;
  reason: string | null;
  report_date: string;
  reporter: string;
  msg_author: string | null;
  msg_text: string | null;
  msg_date: string | null;
}

const REASON_MAP: Record<string, { icon: string; key: string }> = {
  spam:   { icon: '📢', key: 'chat.report.reason.spam'   },
  porn:   { icon: '🔞', key: 'chat.report.reason.porn'   },
  racism: { icon: '🚫', key: 'chat.report.reason.racism' },
  hate:   { icon: '💢', key: 'chat.report.reason.hate'   },
  other:  { icon: '⚠️', key: 'chat.report.reason.other'  },
};

interface AdminUser {
  id: string;
  username: string;
  email: string | null;
  server: string | null;
  faction: string | null;
  is_admin: number;
  is_moderator: number;
  permissions: string | null;
  created_at: string;
  last_login: string | null;
  last_seen?: string | null;
  msg_global?: number;
  msg_server?: number;
}

interface RewardCode {
  id: string;
  code: string;
  image_key: string | null;
  expires_at: string | null;
  added_at: string;
}

const ROSE_DESCRIPTIONS: Record<number, string> = {
  1:  '+20% Construction Speed (2h)',
  2:  '+15% Troop Load (24h)',
  3:  '+30% Gathering Speed (24h)',
  4:  'Allied Assist +120s (24h)',
  5:  '+20% Research Speed (2h)',
  6:  'Allied Assist +120s (24h) — Double',
  7:  '+10% Troop ATK (2h)',
  8:  '+20% Construction Speed (2h)',
  9:  '+20% Research Speed (2h)',
  10: '+10% Troop ATK (2h) — Gold',
};

// Sechs Bereiche statt drei. Der frühere Sammelposten "Einstellungen" enthielt
// Glücksrose, Gift-Codes und Ankündigungen — das sind Inhalte, keine
// Einstellungen. Unter "System" bleibt nur, was das Verhalten der Seite steuert.
//
// Jeder Bereich nennt das Recht, das ihn sichtbar macht: Wer es nicht hat,
// bekommt den Reiter gar nicht erst zu sehen. Entschieden wird trotzdem am
// Server — hier geht es nur darum, niemandem Knöpfe zu zeigen, die in einem
// 403 enden.
const TABS = [
  { id: 'overview', labelKey: 'admin.tab.overview' as const, icon: '📊', rechte: [] },
  { id: 'stats',    labelKey: 'admin.tab.stats'    as const, icon: '📈', rechte: ['stats.view'] },
  { id: 'reports',  labelKey: 'admin.tab.reports'  as const, icon: '⚑',  rechte: ['reports.view'] },
  { id: 'users',    labelKey: 'admin.tab.users'    as const, icon: '👥', rechte: ['users.view'] },
  { id: 'content',  labelKey: 'admin.tab.content'  as const, icon: '🎁',
    rechte: ['codes.approve', 'codes.manage', 'content.announcement', 'content.rose'] },
  { id: 'system',   labelKey: 'admin.tab.system'   as const, icon: '⚙',  rechte: ['system.settings'] },
] as const;

type TabId = typeof TABS[number]['id'];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  // Ueber msAusZeitstempel, nicht ueber new Date(): Die Werte kommen aus
  // SQLite ("2026-08-13 14:33:00", UTC ohne Kennzeichnung), und der Browser
  // deutet sie roh als Ortszeit. Registrierungen und letzte Anmeldungen standen
  // dadurch um den Zonenversatz verschoben — in Berlin zwei Stunden zu frueh,
  // in Tokio neun.
  const ms = msAusZeitstempel(iso);
  return Number.isNaN(ms) ? iso : new Date(ms).toLocaleString();
}

export default function AdminPanel({ translationData }: AdminPanelProps) {
  const t = useTranslations(translationData);
  const { user, token, isLoggedIn } = useAuth();
  const isAdmin = user?.is_admin === 1;
  const isMod   = user?.is_moderator === 1 && !isAdmin;

  // Nur Bereiche zeigen, die dieses Konto auch nutzen darf. Die Übersicht hat
  // kein eigenes Recht — sie fasst nur zusammen, was ohnehin sichtbar ist.
  const sichtbareTabs = TABS.filter(tab =>
    tab.rechte.length === 0 || darfEines(user, ...([...tab.rechte] as Recht[])));

  // Reicht es fuer diese Seite ueberhaupt? Massgeblich ist, ob mindestens ein
  // Bereich mit eigenem Recht offensteht — die Uebersicht hat keines und waere
  // sonst fuer jeden ein Freifahrtschein.
  const hatEchtenBereich = sichtbareTabs.some(tab => tab.rechte.length > 0);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Wer den aktiven Bereich verliert (Rechte geändert), landet auf dem ersten
  // verbliebenen statt auf einer leeren Fläche.
  useEffect(() => {
    if (!sichtbareTabs.some(tab => tab.id === activeTab) && sichtbareTabs.length > 0) {
      setActiveTab(sichtbareTabs[0].id);
    }
  }, [sichtbareTabs.length, activeTab]);

  // Rechte-Dialog
  const [rechteFuer, setRechteFuer] = useState<AdminUser | null>(null);

  // Reports state
  const [reports, setReports]     = useState<Report[]>([]);
  const [rLoading, setRLoading]   = useState(true);
  const [rError, setRError]       = useState<string | null>(null);
  const [rBusy, setRBusy]         = useState<Set<string>>(new Set());

  // Report filter state
  const [rfText,   setRfText]   = useState('');
  const [rfReason, setRfReason] = useState('');
  const [rfType,   setRfType]   = useState('');

  // Users state
  const [users, setUsers]         = useState<AdminUser[]>([]);
  const [uLoading, setULoading]   = useState(false);
  const [uError, setUError]       = useState<string | null>(null);
  const [uBusy, setUBusy]         = useState<Set<string>>(new Set());

  // User filter state
  const [fText, setFText]         = useState('');
  const [fServer, setFServer]     = useState('');
  const [fRegFrom, setFRegFrom]   = useState('');
  const [fRegTo, setFRegTo]       = useState('');

  // Settings state — Ankuendigung an alle
  const [announceText,   setAnnounceText]   = useState('');
  const [announceReload, setAnnounceReload] = useState(false);
  const [announceBusy,   setAnnounceBusy]   = useState(false);
  const [announceInfo,   setAnnounceInfo]   = useState<string | null>(null);
  const [announceActive, setAnnounceActive] = useState<{ id: string; text: string } | null>(null);

  // Settings state — Lucky Rose
  const [luckyRose, setLuckyRose]         = useState(10);
  const [luckyRoseSaved, setLuckyRoseSaved] = useState(false);
  const [luckyRoseBusy, setLuckyRoseBusy]  = useState(false);

  // Settings state — Reward Codes
  const [codes, setCodes]             = useState<RewardCode[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [newCode, setNewCode]         = useState('');
  const [newExpires, setNewExpires]   = useState('');
  // Ablaufdatum je Discord-Fund. Der Bot liefert keins mit — er liest nur den
  // Code aus der Nachricht —, also wird es beim Freigeben gesetzt. Früher
  // griff das Freigeben auf newExpires zu, das Feld des Formulars darunter:
  // Stand dort etwas, erbte der Fund ein Datum, das niemand für ihn gemeint hatte.
  const [fundAblauf, setFundAblauf] = useState<Record<string, string>>({});
  const [uploadKey, setUploadKey]     = useState<string | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [addingCode, setAddingCode]   = useState(false);
  const [deletingCode, setDeletingCode] = useState<Set<string>>(new Set());

  // Funde aus dem Discord-Kanal, die noch auf eine Entscheidung warten.
  const [pending, setPending]         = useState<RewardCode[]>([]);
  const [pendingBusy, setPendingBusy] = useState<Set<string>>(new Set());

  // Load reports
  useEffect(() => {
    if (activeTab !== 'reports' && activeTab !== 'overview') return;
    if (!isLoggedIn || !token || !darf(user, 'reports.view')) return;
    setRLoading(true);
    setRError(null);
    fetch('/api/admin/reports', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then((data: any) => {
        if (data.reports) setReports(data.reports);
        else setRError(t('admin.reports.error'));
      })
      .catch(() => setRError(t('admin.reports.error')))
      .finally(() => setRLoading(false));
  }, [activeTab, isLoggedIn]);

  // Load users
  useEffect(() => {
    if (activeTab !== 'users' || !isLoggedIn || !token || !darf(user, 'users.view')) return;
    setULoading(true);
    setUError(null);
    fetch('/api/admin/users', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then((data: any) => {
        if (data.users) setUsers(data.users);
        else setUError(t('admin.users.error'));
      })
      .catch(() => setUError(t('admin.users.error')))
      .finally(() => setULoading(false));
  }, [activeTab, isLoggedIn]);

  // Inhalte laden — auch für die Übersicht, die die wartenden Codes anzeigt.
  useEffect(() => {
    if (activeTab !== 'content' && activeTab !== 'overview') return;

    // Jeder Abruf haengt an seinem eigenen Recht. Vorher lag eine einzige
    // Sperre auf 'codes.approve' vor allen vieren — der Reiter wird aber schon
    // von vier verschiedenen Rechten sichtbar (siehe TABS oben). Wer nur
    // 'content.rose' hatte, sah deshalb die Auswahl auf ihrem Anfangswert 10
    // stehen, egal was oeffentlich aktiv war, und setzte die Seite beim
    // Speichern auf 10. Drei der vier Abrufe brauchen ohnehin keine
    // Berechtigung, nur die wartenden Funde.
    if (darf(user, 'content.announcement')) {
      fetch('/api/announcement')
        .then(r => r.ok ? r.json() : null)
        .then((data: any) => { if (data?.announcement) setAnnounceActive(data.announcement); })
        .catch(() => {});
    }

    if (darf(user, 'content.rose')) {
      fetch('/api/settings/lucky-rose')
        .then(r => r.json())
        .then((data: any) => { if (typeof data.active === 'number') setLuckyRose(data.active); })
        .catch(() => {});
    }

    if (darf(user, 'codes.manage') || darf(user, 'codes.approve')) {
      setCodesLoading(true);
      fetch('/api/reward-codes')
        .then(r => r.json())
        .then((data: any) => { if (Array.isArray(data.codes)) setCodes(data.codes); })
        .catch(() => {})
        .finally(() => setCodesLoading(false));
    }

    // Wartende Funde aus dem Discord-Kanal — der einzige Abruf, der wirklich
    // eine Berechtigung verlangt.
    if (darf(user, 'codes.approve')) {
      fetch('/api/reward-codes?status=pending', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then((data: any) => { if (Array.isArray(data?.codes)) setPending(data.codes); })
        .catch(() => {});
    }
  }, [activeTab, user]);

  // Derived: reports
  const reportTypes     = Array.from(new Set(reports.map(r => r.chat_type))).sort();
  const filteredReports = reports.filter(r => {
    if (rfReason && r.reason !== rfReason) return false;
    if (rfType   && r.chat_type !== rfType) return false;
    if (rfText) {
      const q = rfText.toLowerCase();
      if (
        !(r.msg_text  ?? '').toLowerCase().includes(q) &&
        !(r.msg_author ?? '').toLowerCase().includes(q) &&
        !r.reporter.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });
  const hasRFilter = rfText || rfReason || rfType;

  // Derived: users
  const filteredUsers = users.filter(u => {
    if (fServer && u.server !== fServer) return false;
    if (fText) {
      const q = fText.toLowerCase();
      if (!u.username.toLowerCase().includes(q) && !(u.email ?? '').toLowerCase().includes(q)) return false;
    }
    if (fRegFrom && u.created_at < fRegFrom) return false;
    if (fRegTo   && u.created_at > fRegTo + 'T23:59:59') return false;
    return true;
  });
  const hasFilter = fText || fServer || fRegFrom || fRegTo;

  // Access check — AFTER all hooks
  //
  // Nach den Rechten, nicht nach der Rolle: Der Server autorisiert allein ueber
  // is_admin und die Rechteliste (functions/_lib/permissions.ts). Ein Konto mit
  // 'stats.view' und Rolle "user" wurde von der API akzeptiert, kam hier aber
  // nicht herein — die Vergabe sah gespeichert aus und war unbenutzbar.
  if (!isLoggedIn || (!isAdmin && !hatEchtenBereich)) {
    return (
      <div class="admin-access-denied">
        🔒 {t('admin.access_denied')}
      </div>
    );
  }

  // Report handlers
  const handleDelete = async (report: Report) => {
    setRBusy(prev => new Set(prev).add(report.report_id));
    try {
      const res = await fetch('/api/chat/admin/message', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ chat_type: report.chat_type, message_id: report.message_id }),
      });
      if (res.ok) setReports(prev => prev.filter(r => r.report_id !== report.report_id));
    } finally {
      setRBusy(prev => { const n = new Set(prev); n.delete(report.report_id); return n; });
    }
  };

  const handleDismiss = async (report: Report) => {
    setRBusy(prev => new Set(prev).add(report.report_id));
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ report_id: report.report_id }),
      });
      if (res.ok) setReports(prev => prev.filter(r => r.report_id !== report.report_id));
    } finally {
      setRBusy(prev => { const n = new Set(prev); n.delete(report.report_id); return n; });
    }
  };

  // Role management (admin only)
  const handleSetRole = async (u: AdminUser, role: 'user' | 'moderator' | 'admin') => {
    setUBusy(prev => new Set(prev).add(u.id));
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ user_id: u.id, role }),
      });
      if (res.ok) {
        setUsers(prev => prev.map(x => x.id === u.id ? {
          ...x,
          is_admin:     role === 'admin'     ? 1 : 0,
          is_moderator: role === 'moderator' ? 1 : 0,
        } : x));
      }
    } finally {
      setUBusy(prev => { const n = new Set(prev); n.delete(u.id); return n; });
    }
  };

  // Settings handlers
  const handleSendAnnouncement = async () => {
    const text = announceText.trim();
    if (!text) return;
    setAnnounceBusy(true);
    setAnnounceInfo(null);
    try {
      const res = await fetch('/api/announcement', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ text, reload: announceReload }),
      });
      const data = await res.json() as any;
      if (!res.ok) { setAnnounceInfo(data.error ?? 'Fehler'); return; }
      setAnnounceActive(data.announcement);
      setAnnounceText('');
      setAnnounceInfo('✓');
    } catch {
      setAnnounceInfo('Fehler');
    } finally {
      setAnnounceBusy(false);
    }
  };

  const handleClearAnnouncement = async () => {
    setAnnounceBusy(true);
    try {
      const res = await fetch('/api/announcement', {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { setAnnounceActive(null); setAnnounceInfo(null); }
    } catch { /* ignore */ } finally { setAnnounceBusy(false); }
  };

  const handleSaveLuckyRose = async () => {
    setLuckyRoseBusy(true);
    try {
      const res = await fetch('/api/settings/lucky-rose', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ active: luckyRose }),
      });
      if (res.ok) {
        setLuckyRoseSaved(true);
        setTimeout(() => setLuckyRoseSaved(false), 2000);
      }
    } finally {
      setLuckyRoseBusy(false);
    }
  };

  const handleUploadImage = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd,
      });
      if (res.ok) {
        const data = await res.json() as any;
        setUploadKey(data.key);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleAddCode = async () => {
    if (!newCode.trim()) return;
    setAddingCode(true);
    try {
      const res = await fetch('/api/reward-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          code: newCode.trim(),
          image_key: uploadKey ?? undefined,
          // Ortszeit des Eingabefelds in einen eindeutigen Zeitpunkt wandeln.
          // Roh gespeichert waere "2026-08-20T23:59" fuer jeden Betrachter
          // eine andere Uhrzeit.
          expires_at: newExpires ? new Date(newExpires).toISOString() : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json() as any;
        setCodes(prev => [data.code, ...prev]);
        setNewCode('');
        setNewExpires('');
        setUploadKey(null);
      }
    } finally {
      setAddingCode(false);
    }
  };

  const handleDeleteCode = async (code: RewardCode) => {
    setDeletingCode(prev => new Set(prev).add(code.id));
    try {
      const res = await fetch(`/api/reward-codes/${code.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) setCodes(prev => prev.filter(c => c.id !== code.id));
    } finally {
      setDeletingCode(prev => { const n = new Set(prev); n.delete(code.id); return n; });
    }
  };

  // Einen Discord-Fund freigeben oder verwerfen. Freigegebene wandern sofort in
  // die öffentliche Liste, verworfene verschwinden aus der Ansicht — sie bleiben
  // in der Datenbank stehen, damit der nächste Lauf denselben Fehltreffer nicht
  // erneut vorlegt.
  const handleReviewCode = async (code: RewardCode, status: 'approved' | 'rejected') => {
    setPendingBusy(prev => new Set(prev).add(code.id));
    try {
      const res = await fetch(`/api/reward-codes/${code.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({
          status,
          // Nur beim Freigeben relevant; beim Verwerfen wäre ein Datum sinnlos.
          expires_at: status === 'approved' && fundAblauf[code.id]
            ? new Date(fundAblauf[code.id]).toISOString()
            : null,
        }),
      });
      if (!res.ok) return;
      const data = await res.json() as any;
      setPending(prev => prev.filter(c => c.id !== code.id));
      setFundAblauf(prev => { const n = { ...prev }; delete n[code.id]; return n; });
      if (status === 'approved' && data.code) setCodes(prev => [data.code, ...prev]);
    } catch { /* Netzwerkfehler: der Eintrag bleibt stehen, erneut versuchbar */ }
    finally {
      setPendingBusy(prev => { const n = new Set(prev); n.delete(code.id); return n; });
    }
  };

  return (
    <div class="admin-panel">
      <nav class="admin-sidebar">
        {sichtbareTabs.map(tab => (
          <button
            key={tab.id}
            class={['admin-sidebar-btn', activeTab === tab.id ? 'admin-sidebar-active' : ''].filter(Boolean).join(' ')}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon} {t(tab.labelKey)}
            {tab.id === 'reports' && reports.length > 0 && (
              <span class="admin-sidebar-zahl">{reports.length}</span>
            )}
            {tab.id === 'content' && pending.length > 0 && (
              <span class="admin-sidebar-zahl admin-sidebar-zahl-warte">{pending.length}</span>
            )}
          </button>
        ))}
      </nav>

      <div class="admin-content">

        {/* ── Reports Tab ── */}
        {activeTab === 'reports' && (
          <>
            {rLoading && <p class="admin-loading">{t('admin.reports.loading')}</p>}
            {rError && <p class="admin-error">{rError}</p>}
            {!rLoading && !rError && (
              <>
                {/* Filter bar */}
                <div class="admin-filter-bar admin-filter-bar-reports">
                  <label class="admin-filter-field admin-filter-field-wide">
                    <span class="admin-filter-label">{t('admin.reports.filter.search')}</span>
                    <input
                      class="admin-filter-input"
                      type="search"
                      placeholder={t('admin.reports.filter.search')}
                      value={rfText}
                      onInput={e => setRfText((e.target as HTMLInputElement).value)}
                    />
                  </label>
                  <label class="admin-filter-field">
                    <span class="admin-filter-label">{t('admin.reports.col.reason')}</span>
                    <select
                      class="admin-filter-input"
                      value={rfReason}
                      onChange={e => setRfReason((e.target as HTMLSelectElement).value)}
                    >
                      <option value="">{t('admin.reports.filter.reason.all')}</option>
                      {Object.entries(REASON_MAP).map(([k, v]) => (
                        <option key={k} value={k}>{v.icon} {t(v.key as any)}</option>
                      ))}
                    </select>
                  </label>
                  <label class="admin-filter-field">
                    <span class="admin-filter-label">{t('admin.reports.col.type')}</span>
                    <select
                      class="admin-filter-input"
                      value={rfType}
                      onChange={e => setRfType((e.target as HTMLSelectElement).value)}
                    >
                      <option value="">{t('admin.reports.filter.type.all')}</option>
                      {reportTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </label>
                  <div class="admin-filter-actions">
                    {hasRFilter && (
                      <button class="admin-filter-reset" onClick={() => { setRfText(''); setRfReason(''); setRfType(''); }}>
                        ✕ {t('admin.users.filter.reset')}
                      </button>
                    )}
                    <span class="admin-filter-count">{filteredReports.length} / {reports.length}</span>
                  </div>
                </div>

                {filteredReports.length === 0 ? (
                  <p class="admin-empty">{t('admin.reports.empty')}</p>
                ) : (
                  <div class="admin-table-wrap">
                    <table class="admin-table admin-reports-table">
                      <thead>
                        <tr>
                          <th>{t('admin.reports.col.message')}</th>
                          <th>{t('admin.reports.col.author')}</th>
                          <th>{t('admin.reports.col.reporter')}</th>
                          <th>{t('admin.reports.col.reason')}</th>
                          <th>{t('admin.reports.col.type')}</th>
                          <th>{t('admin.reports.col.date')}</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReports.map(report => {
                          const isBusy = rBusy.has(report.report_id);
                          const reason = report.reason ? REASON_MAP[report.reason] : null;
                          return (
                            <tr key={report.report_id}>
                              <td class="admin-report-msg-cell">
                                <span class={report.msg_text ? 'admin-report-msg-text' : 'admin-report-msg-deleted'}>
                                  {report.msg_text ?? t('admin.reports.msg_deleted')}
                                </span>
                              </td>
                              <td class="admin-table-muted">{report.msg_author ?? '—'}</td>
                              <td class="admin-table-muted">{report.reporter}</td>
                              <td>
                                {reason ? (
                                  <span class="admin-report-reason">
                                    {reason.icon} {t(reason.key as any)}
                                  </span>
                                ) : '—'}
                              </td>
                              <td class="admin-table-muted">{report.chat_type}</td>
                              <td class="admin-table-muted admin-nowrap">{formatDate(report.report_date)}</td>
                              <td class="admin-table-actions">
                                <button
                                  class="admin-btn-delete admin-btn-sm"
                                  onClick={() => handleDelete(report)}
                                  disabled={isBusy || !report.msg_text}
                                  title={t('admin.reports.delete')}
                                >
                                  🗑
                                </button>
                                <button
                                  class="admin-btn-dismiss admin-btn-sm"
                                  onClick={() => handleDismiss(report)}
                                  disabled={isBusy}
                                  title={t('admin.reports.dismiss')}
                                >
                                  ✓
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── Users Tab ── */}
        {activeTab === 'users' && (
          <>
            {uLoading && <p class="admin-loading">{t('admin.users.loading')}</p>}
            {uError && <p class="admin-error">{uError}</p>}
            {!uLoading && !uError && (
              <>
                {/* Filter bar */}
                <div class="admin-filter-bar">
                  <label class="admin-filter-field">
                    <span class="admin-filter-label">{t('admin.users.filter.name')}</span>
                    <input
                      class="admin-filter-input"
                      type="search"
                      placeholder={t('admin.users.filter.search')}
                      value={fText}
                      onInput={e => setFText((e.target as HTMLInputElement).value)}
                    />
                  </label>
                  <label class="admin-filter-field">
                    <span class="admin-filter-label">{t('admin.users.filter.server')}</span>
                    <input
                      class="admin-filter-input"
                      type="text"
                      placeholder={t('admin.users.filter.server_ph')}
                      value={fServer}
                      onInput={e => setFServer((e.target as HTMLInputElement).value)}
                    />
                  </label>
                  <label class="admin-filter-field">
                    <span class="admin-filter-label">{t('admin.users.filter.from')}</span>
                    <input
                      class="admin-filter-input"
                      type="date"
                      value={fRegFrom}
                      onChange={e => setFRegFrom((e.target as HTMLInputElement).value)}
                    />
                  </label>
                  <label class="admin-filter-field">
                    <span class="admin-filter-label">{t('admin.users.filter.to')}</span>
                    <input
                      class="admin-filter-input"
                      type="date"
                      value={fRegTo}
                      onChange={e => setFRegTo((e.target as HTMLInputElement).value)}
                    />
                  </label>
                  <div class="admin-filter-actions">
                    {hasFilter && (
                      <button class="admin-filter-reset" onClick={() => { setFText(''); setFServer(''); setFRegFrom(''); setFRegTo(''); }}>
                        ✕ {t('admin.users.filter.reset')}
                      </button>
                    )}
                    <span class="admin-filter-count">{filteredUsers.length} / {users.length}</span>
                  </div>
                </div>

                {/* Table */}
                {filteredUsers.length === 0
                  ? <p class="admin-empty">{t('admin.users.empty')}</p>
                  : (
                    <div class="admin-table-wrap">
                      <table class="admin-table">
                        <thead>
                          <tr>
                            <th>{t('admin.users.col.name')}</th>
                            {isAdmin && <th>{t('admin.users.col.email')}</th>}
                            <th>{t('admin.users.col.server')}</th>
                            <th>{t('admin.users.col.registered')}</th>
                            <th>{t('admin.users.col.last_login')}</th>
                            <th>{t('admin.users.col.activity')}</th>
                            {isAdmin && <th></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredUsers.map(u => {
                            const isYou  = u.id === user?.id;
                            const isBusy = uBusy.has(u.id);
                            const rowClass = u.is_admin === 1
                              ? 'admin-table-row-admin'
                              : u.is_moderator === 1 ? 'admin-table-row-mod' : '';
                            return (
                              <tr key={u.id} class={rowClass}>
                                <td>
                                  <span class="admin-user-name">
                                    {u.username}
                                    {u.is_admin === 1     && <span class="admin-user-badge admin-badge-admin">⚙ {t('chat.role.admin')}</span>}
                                    {u.is_moderator === 1 && <span class="admin-user-badge admin-badge-mod">🛡 {t('chat.role.moderator')}</span>}
                                    {isYou && <span class="admin-user-you">{t('admin.users.you')}</span>}
                                  </span>
                                </td>
                                {isAdmin && <td class="admin-table-muted">{u.email ?? '—'}</td>}
                                <td class="admin-table-muted">{u.server ?? '—'}</td>
                                <td class="admin-table-muted admin-nowrap">{formatDate(u.created_at)}</td>
                                <td class="admin-table-muted admin-nowrap">{u.last_login ? formatDate(u.last_login) : '—'}</td>
                                <td class="admin-nowrap admin-aktivitaet">
                                  {(u.msg_global ?? 0) + (u.msg_server ?? 0) > 0
                                    ? <>💬 {(u.msg_global ?? 0) + (u.msg_server ?? 0)}</>
                                    : <span class="admin-still">—</span>}
                                </td>
                                {isAdmin && (
                                  <td class="admin-table-actions">
                                    {!isYou && (
                                      <>
                                        {u.is_admin === 0 && u.is_moderator === 0 && (
                                          <>
                                            <button class="admin-btn-promote admin-btn-sm" disabled={isBusy} onClick={() => handleSetRole(u, 'moderator')}>🛡 {t('admin.users.makeMod')}</button>
                                            <button class="admin-btn-promote admin-btn-sm" disabled={isBusy} onClick={() => handleSetRole(u, 'admin')}>⚙ {t('admin.users.makeAdmin')}</button>
                                          </>
                                        )}
                                        {u.is_moderator === 1 && (
                                          <>
                                            <button class="admin-btn-promote admin-btn-sm" disabled={isBusy} onClick={() => handleSetRole(u, 'admin')}>⚙ {t('admin.users.makeAdmin')}</button>
                                            <button class="admin-btn-delete admin-btn-sm"  disabled={isBusy} onClick={() => handleSetRole(u, 'user')}>✕ {t('admin.users.removeMod')}</button>
                                          </>
                                        )}
                                        {u.is_admin === 1 && (
                                          <>
                                            <button class="admin-btn-promote admin-btn-sm" disabled={isBusy} onClick={() => handleSetRole(u, 'moderator')}>🛡 {t('admin.users.makeMod')}</button>
                                            <button class="admin-btn-delete admin-btn-sm"  disabled={isBusy} onClick={() => handleSetRole(u, 'user')}>✕ {t('admin.users.removeAdmin')}</button>
                                          </>
                                        )}
                                        {/* Einzelne Rechte statt Alles-oder-nichts */}
                                        <button class="admin-btn-sm" disabled={isBusy}
                                                onClick={() => setRechteFuer(u)}
                                                title={t('admin.users.perm_hint')}>
                                          🔑 {t('admin.users.permissions')}
                                        </button>
                                      </>
                                    )}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                }
              </>
            )}
          </>
        )}

        {/* ── Übersicht: der Einstieg ── */}
        {activeTab === 'overview' && (
          <div class="admin-settings">
            <h2 class="admin-settings-title">📊 {t('admin.overview.title')}</h2>

            {pending.length === 0 && reports.length === 0 && (
              <p class="admin-empty">{t('admin.overview.nothing')}</p>
            )}

            {/* Wartende Discord-Funde — der häufigste Grund, hier zu sein */}
            {pending.length > 0 && darf(user, 'codes.approve') && (
              <div class="admin-pending">
                <h3 class="admin-pending-title">
                  📥 {t('admin.overview.pending')}
                  <span class="admin-pending-count">{pending.length}</span>
                </h3>
                <ul class="admin-pending-list">
                  {pending.map(c => (
                    <li class="admin-pending-item" key={c.id}>
                      <code class="admin-pending-code">{c.code}</code>
                      <div class="admin-pending-actions">
                        <button class="admin-btn-promote" disabled={pendingBusy.has(c.id)}
                                onClick={() => handleReviewCode(c, 'approved')}>
                          ✓ {t('admin.settings.approve')}
                        </button>
                        <button class="admin-btn-delete" disabled={pendingBusy.has(c.id)}
                                onClick={() => handleReviewCode(c, 'rejected')}>
                          ✕ {t('admin.settings.reject')}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {reports.length > 0 && darf(user, 'reports.view') && (
              <section class="admin-settings-section">
                <h3 class="admin-settings-title">
                  ⚑ {t('admin.overview.reports')} <span class="admin-pending-count">{reports.length}</span>
                </h3>
                <button class="admin-btn-promote" onClick={() => setActiveTab('reports')}>
                  {t('admin.tab.reports')} →
                </button>
              </section>
            )}
          </div>
        )}

        {/* ── Statistik ── */}
        {activeTab === 'stats' && token && (
          <div class="admin-settings">
            <h2 class="admin-settings-title">📈 {t('admin.stats.title')}</h2>
            <AdminStats token={token} />
          </div>
        )}

        {/* ── System: was die Seite tut ── */}
        {activeTab === 'system' && token && (
          <div class="admin-settings">
            <h2 class="admin-settings-title">⚙ {t('admin.system.title')}</h2>
            <AdminSystem token={token} />
          </div>
        )}

        {/* ── Inhalte: Ankündigung, Glücksrose, Gift-Codes ── */}
        {activeTab === 'content' && (
          <div class="admin-settings">

            {/* Ankuendigung an alle */}
            <section class="admin-settings-section">
              <h2 class="admin-settings-title">📢 {t('admin.settings.announce')}</h2>

              {announceActive && (
                <div class="admin-announce-active">
                  <span class="admin-announce-active-text">{announceActive.text}</span>
                  <button
                    class="admin-btn-demote"
                    onClick={handleClearAnnouncement}
                    disabled={announceBusy}
                  >
                    {t('admin.settings.announce_clear')}
                  </button>
                </div>
              )}

              <div class="admin-settings-row">
                <label class="admin-filter-label" for="announce-text">
                  {t('admin.settings.announce_text')}
                </label>
                <textarea
                  id="announce-text"
                  class="admin-filter-input admin-announce-input"
                  maxLength={300}
                  rows={2}
                  placeholder={t('admin.settings.announce_ph')}
                  value={announceText}
                  onInput={e => setAnnounceText((e.target as HTMLTextAreaElement).value)}
                />
                <label class="admin-announce-check">
                  <input
                    type="checkbox"
                    checked={announceReload}
                    onChange={e => setAnnounceReload((e.target as HTMLInputElement).checked)}
                  />
                  {t('admin.settings.announce_reload')}
                </label>
                <div class="admin-rose-select-row">
                  <button
                    class="admin-btn-promote admin-settings-save-btn"
                    onClick={handleSendAnnouncement}
                    disabled={announceBusy || !announceText.trim()}
                  >
                    {t('admin.settings.announce_send')}
                  </button>
                  {announceInfo && <span class="admin-upload-status">{announceInfo}</span>}
                </div>
              </div>
            </section>

            {/* Lucky Rose Section */}
            <section class="admin-settings-section">
              <h2 class="admin-settings-title">🌹 {t('admin.settings.lucky_rose')}</h2>
              <div class="admin-settings-row">
                <label class="admin-filter-label">{t('admin.settings.lucky_rose_active')}</label>
                <div class="admin-rose-select-row">
                  <select
                    class="admin-filter-input admin-rose-select"
                    value={luckyRose}
                    onChange={e => setLuckyRose(Number((e.target as HTMLSelectElement).value))}
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>
                        🌹 #{n} — {ROSE_DESCRIPTIONS[n]}
                      </option>
                    ))}
                  </select>
                  <button
                    class="admin-btn-promote admin-settings-save-btn"
                    onClick={handleSaveLuckyRose}
                    disabled={luckyRoseBusy}
                  >
                    {luckyRoseSaved ? '✓ ' + t('admin.settings.saved') : t('admin.settings.save')}
                  </button>
                </div>
              </div>
            </section>

            {/* Reward Codes Section */}
            <section class="admin-settings-section">
              <h2 class="admin-settings-title">🎁 {t('admin.settings.codes')}</h2>

              {/* Wartende Funde aus Discord — zuerst, damit sie nicht untergehen */}
              {pending.length > 0 && (
                <div class="admin-pending">
                  <h3 class="admin-pending-title">
                    📥 {t('admin.settings.pending_title')}
                    <span class="admin-pending-count">{pending.length}</span>
                  </h3>
                  <p class="admin-pending-hint">{t('admin.settings.pending_hint')}</p>

                  <ul class="admin-pending-list">
                    {pending.map(c => (
                      <li class="admin-pending-item" key={c.id}>
                        <code class="admin-pending-code">{c.code}</code>
                        <div class="admin-pending-actions">
                          <label class="admin-pending-datum">
                            <span class="admin-pending-datum-label">{t('admin.settings.expires')}</span>
                            <input
                              class="admin-filter-input"
                              type="datetime-local"
                              value={fundAblauf[c.id] ?? ''}
                              onChange={e => {
                                const v = (e.target as HTMLInputElement).value;
                                setFundAblauf(prev => ({ ...prev, [c.id]: v }));
                              }}
                            />
                          </label>
                          <button
                            class="admin-btn-promote"
                            disabled={pendingBusy.has(c.id)}
                            onClick={() => handleReviewCode(c, 'approved')}
                          >
                            ✓ {t('admin.settings.approve')}
                          </button>
                          <button
                            class="admin-btn-delete"
                            disabled={pendingBusy.has(c.id)}
                            onClick={() => handleReviewCode(c, 'rejected')}
                          >
                            ✕ {t('admin.settings.reject')}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Add code form */}
              <div class="admin-code-form">
                <div class="admin-code-form-row">
                  <div class="admin-filter-field">
                    <span class="admin-filter-label">{t('admin.settings.upload_img')}</span>
                    <div class="admin-upload-row">
                      <input
                        class="admin-filter-input"
                        type="file"
                        accept="image/webp,image/jpeg,image/png"
                        disabled={uploading}
                        onChange={e => {
                          const f = (e.target as HTMLInputElement).files?.[0];
                          if (f) handleUploadImage(f);
                        }}
                      />
                      {uploading && <span class="admin-upload-status">⏳</span>}
                      {uploadKey && <span class="admin-upload-status admin-upload-ok">✓</span>}
                    </div>
                  </div>
                  <label class="admin-filter-field">
                    <span class="admin-filter-label">{t('admin.settings.code_input')}</span>
                    <input
                      class="admin-filter-input"
                      type="text"
                      placeholder="CODE123"
                      value={newCode}
                      onInput={e => setNewCode((e.target as HTMLInputElement).value)}
                    />
                  </label>
                  <label class="admin-filter-field">
                    <span class="admin-filter-label">{t('admin.settings.expires')}</span>
                    <input
                      class="admin-filter-input"
                      type="datetime-local"
                      value={newExpires}
                      onChange={e => setNewExpires((e.target as HTMLInputElement).value)}
                    />
                  </label>
                  <div class="admin-filter-field" style="justify-content: flex-end">
                    <button
                      class="admin-btn-promote admin-settings-save-btn"
                      onClick={handleAddCode}
                      disabled={addingCode || !newCode.trim()}
                    >
                      {t('admin.settings.add_code')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Codes table */}
              {codesLoading ? (
                <p class="admin-loading">{t('admin.users.loading')}</p>
              ) : codes.length === 0 ? (
                <p class="admin-empty">{t('admin.settings.no_codes')}</p>
              ) : (
                <div class="admin-table-wrap">
                  <table class="admin-table">
                    <thead>
                      <tr>
                        <th>{t('admin.settings.code_input')}</th>
                        <th></th>
                        <th>{t('admin.settings.expires')}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {codes.map(c => (
                        <tr key={c.id}>
                          <td class="admin-table-muted" style="font-family: monospace">{c.code}</td>
                          <td>
                            {c.image_key && (
                              <img
                                src={`/api/files/${c.image_key}`}
                                alt={c.code}
                                class="admin-code-thumb"
                                loading="lazy"
                              />
                            )}
                          </td>
                          <td class="admin-table-muted admin-nowrap">
                            {c.expires_at ? new Date(msAusZeitstempel(c.expires_at)).toLocaleString() : '—'}
                          </td>
                          <td class="admin-table-actions">
                            <button
                              class="admin-btn-delete admin-btn-sm"
                              disabled={deletingCode.has(c.id)}
                              onClick={() => handleDeleteCode(c)}
                              title={t('admin.settings.delete')}
                            >
                              🗑 {t('admin.settings.delete')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

      </div>

      {/* Rechte eines Kontos — nur für Administratoren, siehe API */}
      {rechteFuer && token && (
        <AdminPermissions
          token={token}
          userId={rechteFuer.id}
          username={rechteFuer.username}
          istAdmin={rechteFuer.is_admin === 1}
          rechte={parseRechte(rechteFuer.permissions)}
          onClose={() => setRechteFuer(null)}
          onSaved={(neu) => setUsers(prev => prev.map(u =>
            u.id === rechteFuer.id ? { ...u, permissions: JSON.stringify(neu) } : u))}
        />
      )}
    </div>
  );
}
