import { useState, useEffect } from 'preact/hooks';
import { useAuth } from '../../hooks/useAuth';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData } from '../../i18n/index';
import './AdminPanel.css';

interface AdminPanelProps {
  translationData: TranslationData;
}

interface Report {
  report_id: string;
  chat_type: string;
  message_id: string;
  report_date: string;
  reporter: string;
  msg_author: string | null;
  msg_text: string | null;
  msg_date: string | null;
}

interface AdminUser {
  id: string;
  username: string;
  email: string | null;
  server: string | null;
  faction: string | null;
  is_admin: number;
  is_moderator: number;
  created_at: string;
  last_login: string | null;
}

const TABS = [
  { id: 'reports', labelKey: 'admin.tab.reports' as const, icon: '⚑' },
  { id: 'users',   labelKey: 'admin.tab.users'   as const, icon: '👥' },
] as const;

type TabId = typeof TABS[number]['id'];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function AdminPanel({ translationData }: AdminPanelProps) {
  const t = useTranslations(translationData);
  const { user, token, isLoggedIn } = useAuth();
  const isAdmin = user?.is_admin === 1;
  const isMod   = user?.is_moderator === 1 && !isAdmin;

  const [activeTab, setActiveTab] = useState<TabId>('reports');

  // Reports state
  const [reports, setReports]     = useState<Report[]>([]);
  const [rLoading, setRLoading]   = useState(true);
  const [rError, setRError]       = useState<string | null>(null);
  const [rBusy, setRBusy]         = useState<Set<string>>(new Set());

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

  // Load reports — hooks must be called unconditionally (Rules of Hooks)
  useEffect(() => {
    if (activeTab !== 'reports' || !isLoggedIn || (!isAdmin && !isMod) || !token) return;
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

  // Load users — same pattern
  useEffect(() => {
    if (activeTab !== 'users' || !isLoggedIn || (!isAdmin && !isMod) || !token) return;
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

  // Derived: unique server list + filtered users (client-side, no extra API call)
  const serverOptions = Array.from(new Set(users.map(u => u.server).filter(Boolean))).sort() as string[];
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
  if (!isLoggedIn || (!isAdmin && !isMod)) {
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

  return (
    <div class="admin-panel">
      <nav class="admin-sidebar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            class={['admin-sidebar-btn', activeTab === tab.id ? 'admin-sidebar-active' : ''].filter(Boolean).join(' ')}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon} {t(tab.labelKey)}
          </button>
        ))}
      </nav>

      <div class="admin-content">

        {/* ── Reports Tab ── */}
        {activeTab === 'reports' && (
          <>
            {rLoading && <p class="admin-loading">{t('admin.reports.loading')}</p>}
            {rError && <p class="admin-error">{rError}</p>}
            {!rLoading && !rError && reports.length === 0 && (
              <p class="admin-empty">{t('admin.reports.empty')}</p>
            )}
            {!rLoading && !rError && reports.length > 0 && (
              <div class="admin-reports-list">
                {reports.map(report => {
                  const isBusy = rBusy.has(report.report_id);
                  return (
                    <div key={report.report_id} class="admin-report-card">
                      <p class={['admin-report-text', !report.msg_text ? 'deleted' : ''].filter(Boolean).join(' ')}>
                        {report.msg_text ?? '[Nachricht gelöscht]'}
                      </p>
                      <div class="admin-report-meta">
                        <span>✍ {report.msg_author ?? '—'}</span>
                        <span>🚩 {report.reporter}</span>
                        <span>💬 {report.chat_type}</span>
                        <span>📅 {formatDate(report.report_date)}</span>
                      </div>
                      <div class="admin-report-actions">
                        <button class="admin-btn-delete" onClick={() => handleDelete(report)} disabled={isBusy || !report.msg_text}>
                          🗑 {t('admin.reports.delete')}
                        </button>
                        <button class="admin-btn-dismiss" onClick={() => handleDismiss(report)} disabled={isBusy}>
                          ✓ {t('admin.reports.dismiss')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
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
                    <span class="admin-filter-label">Name / E-Mail</span>
                    <input
                      class="admin-filter-input"
                      type="search"
                      placeholder="Suchen…"
                      value={fText}
                      onInput={e => setFText((e.target as HTMLInputElement).value)}
                    />
                  </label>
                  <label class="admin-filter-field">
                    <span class="admin-filter-label">Server</span>
                    <input
                      class="admin-filter-input"
                      type="text"
                      placeholder="z. B. 395"
                      value={fServer}
                      onInput={e => setFServer((e.target as HTMLInputElement).value)}
                    />
                  </label>
                  <label class="admin-filter-field">
                    <span class="admin-filter-label">Registriert ab</span>
                    <input
                      class="admin-filter-input"
                      type="date"
                      value={fRegFrom}
                      onChange={e => setFRegFrom((e.target as HTMLInputElement).value)}
                    />
                  </label>
                  <label class="admin-filter-field">
                    <span class="admin-filter-label">Registriert bis</span>
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
                        ✕ Reset
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
                            <th>Name</th>
                            {isAdmin && <th>E-Mail</th>}
                            <th>Server</th>
                            <th>Registriert</th>
                            <th>Letzter Login</th>
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
                                    {u.is_admin === 1     && <span class="admin-user-badge admin-badge-admin">⚙ Admin</span>}
                                    {u.is_moderator === 1 && <span class="admin-user-badge admin-badge-mod">🛡 Mod</span>}
                                    {isYou && <span class="admin-user-you">{t('admin.users.you')}</span>}
                                  </span>
                                </td>
                                {isAdmin && <td class="admin-table-muted">{u.email ?? '—'}</td>}
                                <td class="admin-table-muted">{u.server ?? '—'}</td>
                                <td class="admin-table-muted">{formatDate(u.created_at)}</td>
                                <td class="admin-table-muted">{u.last_login ? formatDate(u.last_login) : '—'}</td>
                                {isAdmin && (
                                  <td class="admin-table-actions">
                                    {!isYou && (
                                      <>
                                        {/* Regular user → promote to mod or admin */}
                                        {u.is_admin === 0 && u.is_moderator === 0 && (
                                          <>
                                            <button class="admin-btn-promote admin-btn-sm" disabled={isBusy} onClick={() => handleSetRole(u, 'moderator')}>🛡 Mod</button>
                                            <button class="admin-btn-promote admin-btn-sm" disabled={isBusy} onClick={() => handleSetRole(u, 'admin')}>⚙ Admin</button>
                                          </>
                                        )}
                                        {/* Moderator → promote to admin or remove role */}
                                        {u.is_moderator === 1 && (
                                          <>
                                            <button class="admin-btn-promote admin-btn-sm" disabled={isBusy} onClick={() => handleSetRole(u, 'admin')}>⚙ Admin</button>
                                            <button class="admin-btn-delete admin-btn-sm"  disabled={isBusy} onClick={() => handleSetRole(u, 'user')}>✕</button>
                                          </>
                                        )}
                                        {/* Admin → demote to mod or remove */}
                                        {u.is_admin === 1 && (
                                          <>
                                            <button class="admin-btn-promote admin-btn-sm" disabled={isBusy} onClick={() => handleSetRole(u, 'moderator')}>🛡 Mod</button>
                                            <button class="admin-btn-delete admin-btn-sm"  disabled={isBusy} onClick={() => handleSetRole(u, 'user')}>✕</button>
                                          </>
                                        )}
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

      </div>
    </div>
  );
}
