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

const TABS = [
  { id: 'reports', label: 'Chat Reports', icon: '⚑' },
] as const;

type TabId = typeof TABS[number]['id'];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AdminPanel({ translationData }: AdminPanelProps) {
  const t = useTranslations(translationData);
  const { user, token, isLoggedIn } = useAuth();

  const [activeTab, setActiveTab] = useState<TabId>('reports');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  // Access check
  if (!isLoggedIn || user?.is_admin !== 1) {
    return (
      <div class="admin-access-denied">
        🔒 {t('admin.access_denied')}
      </div>
    );
  }

  useEffect(() => {
    if (activeTab !== 'reports') return;
    setLoading(true);
    setError(null);
    fetch('/api/admin/reports', {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((data: any) => {
        if (data.reports) {
          setReports(data.reports);
        } else {
          setError(t('admin.reports.error'));
        }
      })
      .catch(() => setError(t('admin.reports.error')))
      .finally(() => setLoading(false));
  }, [activeTab]);

  const handleDelete = async (report: Report) => {
    setBusy(prev => new Set(prev).add(report.report_id));
    try {
      const res = await fetch('/api/chat/admin/message', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ chat_type: report.chat_type, message_id: report.message_id }),
      });
      if (res.ok) {
        setReports(prev => prev.filter(r => r.report_id !== report.report_id));
      }
    } finally {
      setBusy(prev => {
        const next = new Set(prev);
        next.delete(report.report_id);
        return next;
      });
    }
  };

  const handleDismiss = async (report: Report) => {
    setBusy(prev => new Set(prev).add(report.report_id));
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ report_id: report.report_id }),
      });
      if (res.ok) {
        setReports(prev => prev.filter(r => r.report_id !== report.report_id));
      }
    } finally {
      setBusy(prev => {
        const next = new Set(prev);
        next.delete(report.report_id);
        return next;
      });
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
            {tab.icon} {t('admin.tab.reports')}
          </button>
        ))}
      </nav>

      <div class="admin-content">
        {activeTab === 'reports' && (
          <>
            {loading && <p class="admin-loading">{t('admin.reports.loading')}</p>}
            {error && <p class="admin-error">{error}</p>}
            {!loading && !error && reports.length === 0 && (
              <p class="admin-empty">{t('admin.reports.empty')}</p>
            )}
            {!loading && !error && reports.length > 0 && (
              <div class="admin-reports-list">
                {reports.map(report => {
                  const isBusy = busy.has(report.report_id);
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
                        <button
                          class="admin-btn-delete"
                          onClick={() => handleDelete(report)}
                          disabled={isBusy || !report.msg_text}
                          title={t('admin.reports.delete')}
                        >
                          🗑 {t('admin.reports.delete')}
                        </button>
                        <button
                          class="admin-btn-dismiss"
                          onClick={() => handleDismiss(report)}
                          disabled={isBusy}
                          title={t('admin.reports.dismiss')}
                        >
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
      </div>
    </div>
  );
}
