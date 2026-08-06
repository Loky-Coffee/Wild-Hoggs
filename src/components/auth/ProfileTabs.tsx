import { useState, useEffect } from 'preact/hooks';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData } from '../../i18n/index';

// ── Übersicht: Kennzahlen zur eigenen Nutzung ───────────────────────────────
// Bisher stand auf der Profilseite nichts darüber, was man hier eigentlich tut.

export interface UserStats {
  mitglied_seit:      string | null;
  zuletzt_gesehen:    string | null;
  nachrichten_global: number;
  nachrichten_server: number;
  pm_gesendet:        number;
  pm_erhalten:        number;
  spielprofile:       number;
  genutzte_rechner:   number;
  rolle:              'admin' | 'moderator' | 'user';
}

function formatDate(iso: string | null, lang: string): string {
  if (!iso) return '—';
  // Die Datenbank liefert "YYYY-MM-DD HH:MM:SS" (UTC) — für Date brauchbar machen.
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return '—';
  try {
    return d.toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return d.toISOString().slice(0, 10); }
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

export function StatsOverview({ stats, lang, translationData }: {
  readonly stats: UserStats | null;
  readonly lang: string;
  readonly translationData: TranslationData;
}) {
  const t = useTranslations(translationData);

  if (!stats) {
    return <p class="pp-muted">{t('profile.loading')}</p>;
  }

  const tage = daysSince(stats.mitglied_seit);
  const nachrichten = stats.nachrichten_global + stats.nachrichten_server;

  const kacheln = [
    { icon: '📅', label: t('profile.stats.memberSince'), wert: formatDate(stats.mitglied_seit, lang),
      zusatz: tage !== null ? t('profile.stats.days', { days: String(tage) }) : null },
    { icon: '💬', label: t('profile.stats.messages'), wert: String(nachrichten),
      zusatz: `${stats.nachrichten_global} · ${stats.nachrichten_server}` },
    { icon: '✉️', label: t('profile.stats.pm'), wert: String(stats.pm_gesendet + stats.pm_erhalten),
      zusatz: `↑ ${stats.pm_gesendet} · ↓ ${stats.pm_erhalten}` },
    { icon: '🎮', label: t('profile.stats.profiles'), wert: String(stats.spielprofile), zusatz: null },
  ];

  return (
    <div class="pp-stats-grid">
      {kacheln.map(k => (
        <div class="pp-stat" key={k.label}>
          <span class="pp-stat-icon">{k.icon}</span>
          <div>
            <div class="pp-stat-label">{k.label}</div>
            <div class="pp-stat-val">{k.wert}</div>
            {k.zusatz && <div class="pp-stat-sub">{k.zusatz}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Konto: Daten mitnehmen oder Konto löschen ───────────────────────────────

export function AccountTab({ token, username, translationData, onDeleted }: {
  readonly token: string;
  readonly username: string;
  readonly translationData: TranslationData;
  readonly onDeleted: () => void;
}) {
  const t = useTranslations(translationData);

  const [exporting, setExporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/user/export', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const blob = await res.blob();
      // Über einen kurzlebigen Link herunterladen — so bleibt der Dateiname erhalten.
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wild-hoggs-daten-${username}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ } finally { setExporting(false); }
  };

  const handleDelete = async (e: Event) => {
    e.preventDefault();
    setDeleting(true); setError(null);
    try {
      const res = await fetch('/api/user/account', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ password }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? t('profile.errorGeneric')); return; }
      onDeleted();
    } catch {
      setError(t('profile.errorConnection'));
    } finally { setDeleting(false); }
  };

  return (
    <>
      {/* Daten mitnehmen */}
      <div class="pp-setting-block">
        <label class="pp-setting-label">{t('profile.export.title')}</label>
        <p class="pp-hint">{t('profile.export.hint')}</p>
        <button class="pp-btn-save" onClick={handleExport} disabled={exporting}>
          {exporting ? t('profile.saving') : t('profile.export.button')}
        </button>
      </div>

      {/* Konto löschen — bewusst abgesetzt und zuletzt */}
      <div class="pp-danger-zone">
        <h3 class="pp-danger-title">{t('profile.delete.title')}</h3>
        <p class="pp-hint">{t('profile.delete.hint')}</p>

        {!confirmOpen ? (
          <button class="pp-btn-danger" onClick={() => setConfirmOpen(true)}>
            {t('profile.delete.button')}
          </button>
        ) : (
          <form class="pp-pw-form" onSubmit={handleDelete}>
            <p class="pp-danger-warn">{t('profile.delete.warn')}</p>
            <input type="text" name="username" autocomplete="username" value={username}
                   style="display:none" aria-hidden="true" readOnly />
            <input
              class="pp-input"
              type="password"
              placeholder={t('profile.delete.password')}
              value={password}
              onInput={e => setPassword((e.target as HTMLInputElement).value)}
              required
              autocomplete="current-password"
            />
            {error && <p class="pp-msg pp-msg-error">{error}</p>}
            <div class="pp-danger-actions">
              <button type="button" class="pp-btn-ghost"
                      onClick={() => { setConfirmOpen(false); setPassword(''); setError(null); }}>
                {t('profile.delete.cancel')}
              </button>
              <button type="submit" class="pp-btn-danger" disabled={deleting || !password}>
                {deleting ? t('profile.saving') : t('profile.delete.confirm')}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}

// ── Spielprofile: anlegen, wechseln, entfernen ──────────────────────────────

export interface GameProfileLite {
  id: string;
  name: string;
  server: string | null;
  faction: string | null;
}

export function ProfilesList({ profiles, activeId, translationData, onSwitch, onCreate, onDelete }: {
  readonly profiles: GameProfileLite[];
  readonly activeId: string;
  readonly translationData: TranslationData;
  readonly onSwitch: (id: string) => void;
  readonly onCreate: (name: string, server: string) => Promise<void>;
  readonly onDelete: (id: string) => Promise<void>;
}) {
  const t = useTranslations(translationData);
  const [newName, setNewName] = useState('');
  const [newServer, setNewServer] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const create = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    await onCreate(newName.trim(), newServer.trim());
    setNewName(''); setNewServer('');
    setBusy(false);
  };

  return (
    <>
      <div class="pp-profiles">
        {profiles.map(p => (
          <div key={p.id} class={`pp-profile-row${p.id === activeId ? ' pp-profile-row-active' : ''}`}>
            <button
              type="button"
              class="pp-profile-pick"
              onClick={() => onSwitch(p.id)}
              aria-current={p.id === activeId}
            >
              <span class="pp-profile-name">{p.name}</span>
              {p.server && <span class="pp-profile-server">🖥️ {p.server}</span>}
              {p.id === activeId && <span class="pp-profile-badge">{t('profile.profiles.active')}</span>}
            </button>

            {/* Das letzte Profil muss bleiben — ohne eines funktionieren die Rechner nicht. */}
            {profiles.length > 1 && (
              confirmId === p.id ? (
                <span class="pp-profile-confirm">
                  <button type="button" class="pp-btn-danger-sm"
                          onClick={async () => { setConfirmId(null); await onDelete(p.id); }}>
                    {t('profile.profiles.reallyDelete')}
                  </button>
                  <button type="button" class="pp-btn-ghost-sm" onClick={() => setConfirmId(null)}>
                    {t('profile.delete.cancel')}
                  </button>
                </span>
              ) : (
                <button type="button" class="pp-profile-del" onClick={() => setConfirmId(p.id)}
                        aria-label={t('profile.profiles.delete')}>✕</button>
              )
            )}
          </div>
        ))}
      </div>

      <div class="pp-setting-block">
        <label class="pp-setting-label">{t('profile.profiles.new')}</label>
        <div class="pp-input-row">
          <input class="pp-input" type="text" placeholder={t('profile.profiles.namePlaceholder')}
                 value={newName} maxLength={24}
                 onInput={e => setNewName((e.target as HTMLInputElement).value)} />
          <input class="pp-input pp-input-sm" type="text" placeholder={t('profile.serverPlaceholder')}
                 value={newServer} maxLength={10}
                 onInput={e => setNewServer((e.target as HTMLInputElement).value)} />
          <button class="pp-btn-save" onClick={create} disabled={busy || !newName.trim()}>
            {busy ? t('profile.saving') : t('profile.profiles.add')}
          </button>
        </div>
      </div>
    </>
  );
}
