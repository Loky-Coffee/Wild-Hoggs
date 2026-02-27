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
  email: string;
  server: string | null;
  faction: string | null;
  is_admin: number;
  created_at: string;
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

  // Access check
  if (!isLoggedIn || user?.is_admin !== 1) {
    return (
      <div class="admin-access-denied">
        🔒 {t('admin.access_denied')}
      </div>
    );
  }

  // Load reports
  useEffect(() => {
    if (activeTab !== 'reports') return;
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
  }, [activeTab]);

  // Load users
  useEffect(() => {
    if (activeTab !== 'users') return;
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
  }, [activeTab]);

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

  // User admin toggle
  const handleToggleAdmin = async (u: AdminUser) => {
    setUBusy(prev => new Set(prev).add(u.id));
    try {
      const newVal = u.is_admin === 1 ? 0 : 1;
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ user_id: u.id, is_admin: newVal }),
      });
      if (res.ok) {
        setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_admin: newVal } : x));
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
            {!uLoading && !uError && users.length === 0 && (
              <p class="admin-empty">{t('admin.users.empty')}</p>
            )}
            {!uLoading && !uError && users.length > 0 && (
              <div class="admin-user-list">
                {users.map(u => {
                  const isYou  = u.id === user?.id;
                  const isBusy = uBusy.has(u.id);
                  return (
                    <div key={u.id} class={['admin-user-card', u.is_admin === 1 ? 'admin-user-card-admin' : ''].filter(Boolean).join(' ')}>
                      <div class="admin-user-info">
                        <span class="admin-user-name">
                          {u.username}
                          {u.is_admin === 1 && <span class="admin-user-badge">⚙ Admin</span>}
                          {isYou && <span class="admin-user-you">{t('admin.users.you')}</span>}
                        </span>
                        <span class="admin-user-meta">{u.email}</span>
                        <span class="admin-user-meta">
                          {u.server ? `🖥 ${u.server}` : ''}
                          {u.faction ? ` · ${u.faction}` : ''}
                          {` · ${formatDate(u.created_at)}`}
                        </span>
                      </div>
                      <button
                        class={u.is_admin === 1 ? 'admin-btn-delete' : 'admin-btn-promote'}
                        onClick={() => handleToggleAdmin(u)}
                        disabled={isBusy || isYou}
                        title={isYou ? 'Eigenen Status nicht änderbar' : undefined}
                      >
                        {u.is_admin === 1 ? `✕ ${t('admin.users.removeAdmin')}` : `★ ${t('admin.users.makeAdmin')}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
