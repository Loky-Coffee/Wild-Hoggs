import { useState, useEffect } from 'preact/hooks';
import { msAusZeitstempel } from '../../utils/zeit';
import { useAuth } from '../../hooks/useAuth';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData } from '../../i18n/index';
import { darf, darfEines, parseRechte, type Recht } from '../../utils/permissions';
import { SPERRGRUENDE } from '../../config/sperrgruende';
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
  /** 1, sobald die Adresse ueber den Link aus der Mail bestaetigt wurde. */
  email_verified?: number;
  email_verified_at?: string | null;
  /** Ab wann die Bestaetigungsfrist laeuft — Registrierung oder Stichtag. */
  frist_beginn?: string | null;
  profile?: number;
  rechnerstaende?: number;
  /** Zeitpunkt der Sperre; null = nicht gesperrt. */
  banned_at?: string | null;
  banned_by?: string | null;
  ban_grund?: string | null;
}

/** Spalten der Nutzertabelle, nach denen sich sortieren laesst. */
type SortSpalte =
  | 'username' | 'email' | 'server' | 'created_at'
  | 'last_login' | 'email_verified' | 'aktivitaet'
  | null;

/** Ein Konto, das die Bedingungen fuers Aufraeumen erfuellt. */
interface Kandidat {
  id: string;
  username: string;
  email: string | null;
  created_at: string;
  last_seen: string | null;
  email_verified: number;
  frist_beginn: string;
  msg_global: number;
  msg_server: number;
  profile: number;
  rechnerstaende: number;
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

// Einen Code vorn in die Liste stellen — und ihn dabei nicht doppeln.
//
// Traegt jemand einen bereits freigegebenen Code erneut ein (etwa um ein Bild
// nachzureichen oder das Ablaufdatum zu berichtigen), aktualisiert der Server
// die vorhandene Zeile und gibt sie zurueck — dieselbe id. Vorn angehaengt
// stand derselbe Code dann zweimal in der Tabelle, beide Male mit derselben id.
function vornAnstellen<T extends { id: string }>(liste: T[], neu: T): T[] {
  return [neu, ...liste.filter(c => c.id !== neu.id)];
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

  // Sperren und Loeschen
  const [sperrFuer, setSperrFuer]   = useState<AdminUser | null>(null);
  const [sperrGrund, setSperrGrund] = useState('');
  const [sperrText, setSperrText]   = useState('');
  const [loeschFuerEinzeln, setLoeschFuerEinzeln] = useState<AdminUser | null>(null);
  const [aktionLaeuft, setAktionLaeuft] = useState(false);
  const [aktionFehler, setAktionFehler] = useState<string | null>(null);

  // Adresse berichtigen
  const [mailFuer, setMailFuer]     = useState<AdminUser | null>(null);
  const [mailNeu, setMailNeu]       = useState('');
  const [mailLaeuft, setMailLaeuft] = useState(false);
  const [mailFehler, setMailFehler] = useState<string | null>(null);

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
  /** '' = alle, 'ja' = nur bestaetigte, 'nein' = nur unbestaetigte */
  const [fVerified, setFVerified] = useState('');

  // Sortierung der Nutzertabelle. null = Reihenfolge aus der Datenbank
  // (Administratoren, Moderatoren, dann Name).
  const [sortSpalte, setSortSpalte] = useState<SortSpalte>(null);
  const [sortAuf, setSortAuf]       = useState(true);

  // Aufraeumen verwaister Konten
  const [kandidaten, setKandidaten]   = useState<Kandidat[]>([]);
  const [aufraeumZahlen, setAufraeumZahlen] = useState<{ gesamt: number; bestaetigt: number; unbestaetigt_aber_aktiv: number } | null>(null);
  const [aufraeumRegeln, setAufraeumRegeln] = useState<{ frist_tage: number; still_tage: number } | null>(null);
  const [aufraeumOffen, setAufraeumOffen]   = useState(false);
  const [aufraeumLaedt, setAufraeumLaedt]   = useState(false);
  const [aufraeumFehler, setAufraeumFehler] = useState<string | null>(null);
  const [gewaehlt, setGewaehlt]             = useState<Set<string>>(new Set());
  const [loeschtGerade, setLoeschtGerade]   = useState(false);
  /** Sicherheitsabfrage: erst nach einer zweiten Bestaetigung wird geloescht. */
  const [loeschFrage, setLoeschFrage]       = useState(false);

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

  // Nutzerliste holen. Herausgezogen, weil sie nach dem Aufraeumen erneut
  // gebraucht wird — geloeschte Konten muessen aus der Tabelle verschwinden.
  const ladeNutzer = async () => {
    if (!token) return;
    setULoading(true);
    setUError(null);
    try {
      const res = await fetch('/api/admin/users', { headers: { 'Authorization': `Bearer ${token}` } });
      const data: any = await res.json();
      if (data.users) setUsers(data.users);
      else setUError(t('admin.users.error'));
    } catch {
      setUError(t('admin.users.error'));
    } finally {
      setULoading(false);
    }
  };

  // Load users
  useEffect(() => {
    if (activeTab !== 'users' || !isLoggedIn || !token || !darf(user, 'users.view')) return;
    ladeNutzer();
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
    if (fVerified === 'ja'   && (u.email_verified ?? 0) !== 1) return false;
    if (fVerified === 'nein' && (u.email_verified ?? 0) === 1) return false;
    if (fServer && u.server !== fServer) return false;
    if (fText) {
      const q = fText.toLowerCase();
      if (!u.username.toLowerCase().includes(q) && !(u.email ?? '').toLowerCase().includes(q)) return false;
    }
    if (fRegFrom && u.created_at < fRegFrom) return false;
    if (fRegTo   && u.created_at > fRegTo + 'T23:59:59') return false;
    return true;
  });
  const hasFilter = fText || fServer || fRegFrom || fRegTo || fVerified;

  /**
   * Sortierte Ansicht der gefilterten Liste.
   *
   * Im Browser sortiert, nicht in der Datenbank: Bei gut dreihundert Zeilen
   * kostet das nichts und spart je Klick eine Abfrage. Die Reihenfolge aus dem
   * SQL (Administratoren, dann Moderatoren, dann Name) bleibt erhalten,
   * solange niemand eine Spalte gewaehlt hat.
   */
  const sortierteUsers = (() => {
    if (!sortSpalte) return filteredUsers;

    // Was verglichen wird, haengt von der Spalte ab: Text der Reihe nach,
    // Zeitstempel als Zahl (die Werte kommen als "2026-08-13 14:33:00" und
    // liessen sich als Text nur zufaellig richtig ordnen), Zaehler numerisch.
    const wert = (u: AdminUser): string | number => {
      switch (sortSpalte) {
        case 'username':       return u.username.toLowerCase();
        case 'email':          return (u.email ?? '').toLowerCase();
        case 'server':         return u.server ?? '';
        case 'created_at':     return msAusZeitstempel(u.created_at) || 0;
        case 'last_login':     return u.last_login ? (msAusZeitstempel(u.last_login) || 0) : 0;
        case 'email_verified': return u.email_verified ?? 0;
        case 'aktivitaet':     return (u.msg_global ?? 0) + (u.msg_server ?? 0);
        default:               return '';
      }
    };

    const richtung = sortAuf ? 1 : -1;

    return [...filteredUsers].sort((a, b) => {
      const wa = wert(a), wb = wert(b);

      // Leere Werte immer ans Ende, unabhaengig von der Richtung. Wer nach
      // "letzter Login" sortiert, sucht die aeltesten oder neuesten Anmeldungen
      // — nicht die dreissig Konten, die sich nie angemeldet haben.
      const aLeer = wa === '' || wa === 0;
      const bLeer = wb === '' || wb === 0;
      if (aLeer !== bLeer) return aLeer ? 1 : -1;

      if (typeof wa === 'number' && typeof wb === 'number') {
        return (wa - wb) * richtung;
      }
      // localeCompare, damit Umlaute und Akzente dort einsortiert werden, wo
      // man sie sucht — sonst landet "Ödland" hinter "Zulu".
      return String(wa).localeCompare(String(wb), undefined, { numeric: true }) * richtung;
    });
  })();

  /** Kopfzeile anklicken: gleiche Spalte kehrt die Richtung um, neue Spalte
   *  beginnt mit der Richtung, die man dort meist erwartet. */
  const sortiereNach = (spalte: Exclude<SortSpalte, null>) => {
    if (sortSpalte === spalte) { setSortAuf(!sortAuf); return; }
    setSortSpalte(spalte);
    // Zeiten und Zaehler absteigend (neueste, hoechste zuerst), Text aufsteigend.
    setSortAuf(!['created_at', 'last_login', 'aktivitaet', 'email_verified'].includes(spalte));
  };

  /** Ein anklickbarer Spaltenkopf. */
  const SortKopf = ({ spalte, label }: { spalte: Exclude<SortSpalte, null>; label: string }) => {
    const aktiv = sortSpalte === spalte;
    return (
      <th aria-sort={aktiv ? (sortAuf ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          class={`admin-sort-kopf${aktiv ? ' aktiv' : ''}`}
          onClick={() => sortiereNach(spalte)}
        >
          {label}
          <span class="admin-sort-pfeil" aria-hidden="true">
            {aktiv ? (sortAuf ? '▲' : '▼') : '⇅'}
          </span>
        </button>
      </th>
    );
  };

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


  /**
   * Konto sperren oder entsperren.
   *
   * Der Grund wird als Code gespeichert, nicht als Satz — nur so sieht der
   * Gesperrte ihn beim Anmeldeversuch in seiner eigenen Sprache. Bei
   * "sonstiges" haengt ein Freitext hinter einem senkrechten Strich.
   */
  const sperreSetzen = async (u: AdminUser, sperren: boolean, code?: string, freitext?: string) => {
    setAktionLaeuft(true);
    setAktionFehler(null);
    try {
      const grund = sperren
        ? (code === 'sonstiges' && freitext?.trim() ? `sonstiges|${freitext.trim()}` : (code ?? ''))
        : '';
      const res = await fetch('/api/admin/user-ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: u.id, sperren, grund }),
      });
      const daten = await res.json().catch(() => ({}));
      if (!res.ok) { setAktionFehler(daten?.error ?? t('admin.users.error')); return; }
      setSperrFuer(null);
      setSperrGrund('');
      setSperrText('');
      await ladeNutzer();
    } catch {
      setAktionFehler(t('admin.users.error'));
    } finally {
      setAktionLaeuft(false);
    }
  };

  /** Konto endgueltig loeschen. */
  const kontoLoeschen = async (u: AdminUser) => {
    setAktionLaeuft(true);
    setAktionFehler(null);
    try {
      const res = await fetch('/api/admin/user-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: u.id }),
      });
      const daten = await res.json().catch(() => ({}));
      if (!res.ok) { setAktionFehler(daten?.error ?? t('admin.users.error')); return; }
      setLoeschFuerEinzeln(null);
      await ladeNutzer();
    } catch {
      setAktionFehler(t('admin.users.error'));
    } finally {
      setAktionLaeuft(false);
    }
  };

  /**
   * Adresse eines fremden Kontos berichtigen.
   *
   * Die neue Adresse gilt sofort, aber als unbestaetigt — der Betroffene sieht
   * den Hinweisbalken und bestaetigt selbst. So laesst sich niemandem eine
   * fertig bestaetigte Adresse unterschieben.
   */
  const adresseBerichtigen = async () => {
    if (!mailFuer || !mailNeu.trim()) return;
    setMailLaeuft(true);
    setMailFehler(null);
    try {
      const res = await fetch('/api/admin/user-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: mailFuer.id, email: mailNeu.trim() }),
      });
      const daten = await res.json().catch(() => ({}));
      if (!res.ok) {
        const f = String(daten?.error ?? '');
        setMailFehler(
          f === 'adresse_belegt'     ? t('admin.users.emailTaken')
          : f === 'ungueltige_adresse' ? t('admin.users.emailInvalid')
          : f === 'gleiche_adresse'    ? t('admin.users.emailSame')
          : daten?.error ?? t('admin.users.error'),
        );
        return;
      }
      setMailFuer(null);
      setMailNeu('');
      await ladeNutzer();
    } catch {
      setMailFehler(t('admin.users.error'));
    } finally {
      setMailLaeuft(false);
    }
  };

  // ── Aufraeumen verwaister Konten (nur Administratoren) ────────────────────

  const ladeKandidaten = async () => {
    setAufraeumLaedt(true);
    setAufraeumFehler(null);
    try {
      const res = await fetch('/api/admin/cleanup', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const daten = await res.json();
      if (!res.ok) { setAufraeumFehler(daten?.error ?? t('admin.cleanup.loadError')); return; }
      setKandidaten(daten.kandidaten ?? []);
      setAufraeumZahlen(daten.zahlen ?? null);
      setAufraeumRegeln(daten.regeln ?? null);
      // Nichts ist vorausgewaehlt. Wer loeschen will, waehlt bewusst aus.
      setGewaehlt(new Set());
    } catch {
      setAufraeumFehler(t('admin.cleanup.loadError'));
    } finally {
      setAufraeumLaedt(false);
    }
  };

  const loescheGewaehlte = async () => {
    if (gewaehlt.size === 0) return;
    setLoeschtGerade(true);
    setAufraeumFehler(null);
    try {
      const res = await fetch('/api/admin/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: [...gewaehlt] }),
      });
      const daten = await res.json();
      if (!res.ok) { setAufraeumFehler(daten?.error ?? t('admin.cleanup.deleteError')); return; }
      setLoeschFrage(false);
      // Liste und Nutzertabelle neu holen — beide haben sich geaendert.
      await ladeKandidaten();
      await ladeNutzer();
    } catch {
      setAufraeumFehler(t('admin.cleanup.deleteError'));
    } finally {
      setLoeschtGerade(false);
    }
  };

  const umschalten = (id: string) => {
    setGewaehlt(vorher => {
      const neu = new Set(vorher);
      if (neu.has(id)) neu.delete(id); else neu.add(id);
      return neu;
    });
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
        setCodes(prev => vornAnstellen(prev, data.code));
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
      if (status === 'approved' && data.code) setCodes(prev => vornAnstellen(prev, data.code));
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
                {/* Aufraeumen verwaister Konten. Nur fuer Administratoren:
                    Der Endpunkt verlangt dasselbe, ein Moderator saehe hier
                    sonst einen Kasten, der bei jedem Klick 403 liefert. */}
                {isAdmin && (
                  <div class="admin-aufraeum">
                    <button
                      type="button"
                      class="admin-aufraeum-kopf"
                      onClick={() => {
                        const auf = !aufraeumOffen;
                        setAufraeumOffen(auf);
                        if (auf && kandidaten.length === 0 && !aufraeumLaedt) ladeKandidaten();
                      }}
                      aria-expanded={aufraeumOffen}
                    >
                      <span>🧹 {t('admin.cleanup.title')}</span>
                      <span class="admin-aufraeum-pfeil">{aufraeumOffen ? '▾' : '▸'}</span>
                    </button>

                    {aufraeumOffen && (
                      <div class="admin-aufraeum-inhalt">
                        {aufraeumLaedt && <p class="admin-loading">{t('admin.cleanup.loading')}</p>}
                        {aufraeumFehler && <p class="admin-error">{aufraeumFehler}</p>}

                        {!aufraeumLaedt && !aufraeumFehler && (
                          <>
                            {/* Einordnung zuerst. Eine Kandidatenliste ohne
                                Bezugsgroesse sieht nach mehr aus, als sie ist. */}
                            {aufraeumZahlen && (
                              <p class="admin-aufraeum-zahlen">
                                {t('admin.cleanup.summary')
                                  .replace('{gesamt}', String(aufraeumZahlen.gesamt))
                                  .replace('{bestaetigt}', String(aufraeumZahlen.bestaetigt))
                                  .replace('{aktiv}', String(aufraeumZahlen.unbestaetigt_aber_aktiv))}
                              </p>
                            )}

                            {aufraeumRegeln && (
                              <p class="admin-aufraeum-regel">
                                {t('admin.cleanup.rule')
                                  .replace('{frist}', String(aufraeumRegeln.frist_tage))
                                  .replace('{still}', String(aufraeumRegeln.still_tage))}
                              </p>
                            )}

                            {kandidaten.length === 0 ? (
                              <p class="admin-aufraeum-leer">{t('admin.cleanup.none')}</p>
                            ) : (
                              <>
                                <div class="admin-aufraeum-aktionen">
                                  <button
                                    type="button"
                                    class="admin-btn-sm"
                                    onClick={() => setGewaehlt(
                                      gewaehlt.size === kandidaten.length
                                        ? new Set()
                                        : new Set(kandidaten.map(k => k.id))
                                    )}
                                  >
                                    {gewaehlt.size === kandidaten.length
                                      ? t('admin.cleanup.selectNone')
                                      : t('admin.cleanup.selectAll')}
                                  </button>
                                  <span class="admin-aufraeum-gewaehlt">
                                    {t('admin.cleanup.selected').replace('{n}', String(gewaehlt.size))}
                                  </span>
                                </div>

                                <div class="admin-table-wrap">
                                  <table class="admin-table admin-aufraeum-tabelle">
                                    <thead>
                                      <tr>
                                        <th></th>
                                        <th>{t('admin.users.col.name')}</th>
                                        <th>{t('admin.users.col.email')}</th>
                                        <th>{t('admin.cleanup.col.lastSeen')}</th>
                                        <th>{t('admin.cleanup.col.since')}</th>
                                        <th>{t('admin.cleanup.col.leaves')}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {kandidaten.map(k => {
                                        const spuren = (k.msg_global ?? 0) + (k.msg_server ?? 0);
                                        return (
                                          <tr key={k.id} class={gewaehlt.has(k.id) ? 'admin-aufraeum-markiert' : ''}>
                                            <td>
                                              <input
                                                type="checkbox"
                                                checked={gewaehlt.has(k.id)}
                                                onChange={() => umschalten(k.id)}
                                                aria-label={k.username}
                                              />
                                            </td>
                                            <td>{k.username}</td>
                                            <td class="admin-table-muted">{k.email ?? '—'}</td>
                                            <td class="admin-table-muted admin-nowrap">
                                              {k.last_seen ? formatDate(k.last_seen) : t('admin.cleanup.never')}
                                            </td>
                                            <td class="admin-table-muted admin-nowrap">{formatDate(k.frist_beginn)}</td>
                                            <td class="admin-table-muted">
                                              {/* Was verloren geht. Ein Konto mit
                                                  Nachrichten und Profilen loescht
                                                  sich anders als eine leere Huelle. */}
                                              {spuren === 0 && (k.profile ?? 0) === 0 && (k.rechnerstaende ?? 0) === 0
                                                ? <span class="admin-still">{t('admin.cleanup.nothing')}</span>
                                                : <>
                                                    {spuren > 0 && <span class="admin-aufraeum-spur">💬 {spuren}</span>}
                                                    {(k.profile ?? 0) > 0 && <span class="admin-aufraeum-spur">🎖 {k.profile}</span>}
                                                    {(k.rechnerstaende ?? 0) > 0 && <span class="admin-aufraeum-spur">🧮 {k.rechnerstaende}</span>}
                                                  </>}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Zwei Schritte bis zur Loeschung. Der erste
                                    Klick fragt nur nach. */}
                                {!loeschFrage ? (
                                  <button
                                    type="button"
                                    class="admin-btn-danger"
                                    disabled={gewaehlt.size === 0}
                                    onClick={() => setLoeschFrage(true)}
                                  >
                                    {t('admin.cleanup.delete').replace('{n}', String(gewaehlt.size))}
                                  </button>
                                ) : (
                                  <div class="admin-aufraeum-frage">
                                    <p>{t('admin.cleanup.confirm').replace('{n}', String(gewaehlt.size))}</p>
                                    <div class="admin-aufraeum-frage-knoepfe">
                                      <button
                                        type="button"
                                        class="admin-btn-danger"
                                        disabled={loeschtGerade}
                                        onClick={loescheGewaehlte}
                                      >
                                        {loeschtGerade ? t('admin.cleanup.deleting') : t('admin.cleanup.confirmYes')}
                                      </button>
                                      <button
                                        type="button"
                                        class="admin-btn-sm"
                                        disabled={loeschtGerade}
                                        onClick={() => setLoeschFrage(false)}
                                      >
                                        {t('admin.cleanup.confirmNo')}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Filter bar */}
                <div class="admin-filter-bar">
                  {isAdmin && (
                    <label class="admin-filter-field">
                      <span class="admin-filter-label">{t('admin.users.col.verified')}</span>
                      <select
                        class="admin-filter-input"
                        value={fVerified}
                        onChange={e => setFVerified((e.target as HTMLSelectElement).value)}
                      >
                        <option value="">{t('admin.cleanup.filterAll')}</option>
                        <option value="ja">{t('admin.cleanup.filterVerified')}</option>
                        <option value="nein">{t('admin.cleanup.filterUnverified')}</option>
                      </select>
                    </label>
                  )}
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
                      <button class="admin-filter-reset" onClick={() => { setFText(''); setFServer(''); setFRegFrom(''); setFRegTo(''); setFVerified(''); }}>
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
                            {/* Klickbare Koepfe. Als <button> im <th>, nicht als
                                th mit onClick: Sonst waere die Sortierung mit der
                                Tastatur nicht erreichbar. aria-sort sagt
                                Vorleseprogrammen, wonach gerade geordnet ist. */}
                            <SortKopf spalte="username" label={t('admin.users.col.name')} />
                            {isAdmin && <SortKopf spalte="email" label={t('admin.users.col.email')} />}
                            <SortKopf spalte="server" label={t('admin.users.col.server')} />
                            <SortKopf spalte="created_at" label={t('admin.users.col.registered')} />
                            <SortKopf spalte="last_login" label={t('admin.users.col.last_login')} />
                            {isAdmin && <SortKopf spalte="email_verified" label={t('admin.users.col.verified')} />}
                            <SortKopf spalte="aktivitaet" label={t('admin.users.col.activity')} />
                            {isAdmin && <th></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {sortierteUsers.map(u => {
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
                                    {u.banned_at && (
                                      <span class="admin-user-badge admin-badge-gesperrt"
                                            title={`${t('ban.since')} ${formatDate(u.banned_at)}${u.banned_by ? ' — ' + u.banned_by : ''}`}>
                                        🚫 {t('admin.users.banned')}
                                      </span>
                                    )}
                                  </span>
                                </td>
                                {isAdmin && <td class="admin-table-muted">{u.email ?? '—'}</td>}
                                <td class="admin-table-muted">{u.server ?? '—'}</td>
                                <td class="admin-table-muted admin-nowrap">{formatDate(u.created_at)}</td>
                                <td class="admin-table-muted admin-nowrap">{u.last_login ? formatDate(u.last_login) : '—'}</td>
                                {isAdmin && (
                                  <td class="admin-nowrap">
                                    {(u.email_verified ?? 0) === 1
                                      ? <span class="admin-verif-ja" title={u.email_verified_at ? formatDate(u.email_verified_at) : ''}>✓</span>
                                      : <span class="admin-verif-nein" title={t('admin.users.notVerified')}>○</span>}
                                  </td>
                                )}
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
                                        {/* Adresse berichtigen. Fuer die Faelle, in denen
                                            jemand sich vertippt hat und deshalb weder
                                            Bestaetigung noch Passwort-Reset empfangen kann. */}
                                        <button class="admin-btn-sm" disabled={isBusy}
                                                onClick={() => { setMailFuer(u); setMailNeu(''); setMailFehler(null); }}
                                                title={t('admin.users.emailFixHint')}>
                                          ✉ {t('admin.users.emailFix')}
                                        </button>
                                        {/* Sperren statt loeschen ist bei Aerger im Chat die
                                            richtige Antwort: umkehrbar, und die Nachrichten
                                            bleiben zuordenbar. */}
                                        {darf(user, 'users.ban') && (
                                          u.banned_at ? (
                                            <button class="admin-btn-promote admin-btn-sm" disabled={isBusy || aktionLaeuft}
                                                    onClick={() => sperreSetzen(u, false)}>
                                              🔓 {t('admin.users.unban')}
                                            </button>
                                          ) : (
                                            <button class="admin-btn-sm" disabled={isBusy}
                                                    onClick={() => { setSperrFuer(u); setSperrGrund(''); setSperrText(''); setAktionFehler(null); }}>
                                              🚫 {t('admin.users.ban')}
                                            </button>
                                          )
                                        )}
                                        {isAdmin && (
                                          <button class="admin-btn-delete admin-btn-sm" disabled={isBusy}
                                                  onClick={() => { setLoeschFuerEinzeln(u); setAktionFehler(null); }}>
                                            🗑 {t('admin.users.delete')}
                                          </button>
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


      {/* Sperren — mit Grund, den der Gesperrte spaeter in seiner Sprache sieht */}
      {sperrFuer && (
        <div class="admin-dialog-hinter" onClick={e => { if (e.target === e.currentTarget) setSperrFuer(null); }}>
          <div class="admin-dialog" role="dialog" aria-modal="true">
            <h3 class="admin-dialog-titel">🚫 {t('admin.users.ban')} — {sperrFuer.username}</h3>
            <p class="admin-dialog-text">{t('admin.users.banIntro')}</p>

            <select
              class="admin-filter-input admin-dialog-feld"
              value={sperrGrund}
              onChange={e => setSperrGrund((e.target as HTMLSelectElement).value)}
            >
              <option value="">{t('admin.users.banPickReason')}</option>
              {SPERRGRUENDE.map(code => (
                <option key={code} value={code}>{t(`ban.reason.${code}` as any)}</option>
              ))}
            </select>

            {sperrGrund === 'sonstiges' && (
              <input
                class="admin-filter-input admin-dialog-feld"
                type="text"
                maxLength={200}
                placeholder={t('admin.users.banFreeText')}
                value={sperrText}
                onInput={e => setSperrText((e.target as HTMLInputElement).value)}
              />
            )}

            {aktionFehler && <p class="admin-error">{aktionFehler}</p>}
            <p class="admin-dialog-hinweis">{t('admin.users.banNote')}</p>

            <div class="admin-dialog-knoepfe">
              <button class="admin-btn-danger" disabled={aktionLaeuft || !sperrGrund}
                      onClick={() => sperreSetzen(sperrFuer, true, sperrGrund, sperrText)}>
                {aktionLaeuft ? t('admin.cleanup.deleting') : t('admin.users.ban')}
              </button>
              <button class="admin-btn-sm" disabled={aktionLaeuft} onClick={() => setSperrFuer(null)}>
                {t('admin.cleanup.confirmNo')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loeschen — endgueltig, deshalb mit ausdruecklicher Nachfrage */}
      {loeschFuerEinzeln && (
        <div class="admin-dialog-hinter" onClick={e => { if (e.target === e.currentTarget) setLoeschFuerEinzeln(null); }}>
          <div class="admin-dialog" role="dialog" aria-modal="true">
            <h3 class="admin-dialog-titel">🗑 {t('admin.users.delete')} — {loeschFuerEinzeln.username}</h3>
            <p class="admin-dialog-text">{t('admin.users.deleteWarn')}</p>

            <p class="admin-dialog-alt">
              {(loeschFuerEinzeln.msg_global ?? 0) + (loeschFuerEinzeln.msg_server ?? 0) > 0 && (
                <span class="admin-aufraeum-spur">💬 {(loeschFuerEinzeln.msg_global ?? 0) + (loeschFuerEinzeln.msg_server ?? 0)}</span>
              )}
              {(loeschFuerEinzeln.profile ?? 0) > 0 && <span class="admin-aufraeum-spur">🎖 {loeschFuerEinzeln.profile}</span>}
              {(loeschFuerEinzeln.rechnerstaende ?? 0) > 0 && <span class="admin-aufraeum-spur">🧮 {loeschFuerEinzeln.rechnerstaende}</span>}
            </p>

            {aktionFehler && <p class="admin-error">{aktionFehler}</p>}
            <p class="admin-dialog-hinweis">{t('admin.users.deleteNote')}</p>

            <div class="admin-dialog-knoepfe">
              <button class="admin-btn-danger" disabled={aktionLaeuft}
                      onClick={() => kontoLoeschen(loeschFuerEinzeln)}>
                {aktionLaeuft ? t('admin.cleanup.deleting') : t('admin.cleanup.confirmYes')}
              </button>
              <button class="admin-btn-sm" disabled={aktionLaeuft} onClick={() => setLoeschFuerEinzeln(null)}>
                {t('admin.cleanup.confirmNo')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adresse berichtigen */}
      {mailFuer && (
        <div class="admin-dialog-hinter" onClick={e => { if (e.target === e.currentTarget) setMailFuer(null); }}>
          <div class="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="mail-titel">
            <h3 id="mail-titel" class="admin-dialog-titel">
              ✉ {t('admin.users.emailFix')} — {mailFuer.username}
            </h3>

            <p class="admin-dialog-text">
              {t('admin.users.emailFixIntro')}
            </p>

            <p class="admin-dialog-alt">
              {t('admin.users.emailOld')} <bdi dir="ltr">{mailFuer.email ?? '—'}</bdi>
            </p>

            <input
              class="admin-filter-input admin-dialog-feld"
              type="email"
              placeholder={t('admin.users.emailNew')}
              value={mailNeu}
              onInput={e => setMailNeu((e.target as HTMLInputElement).value)}
              autocomplete="off"
            />

            {mailFehler && <p class="admin-error">{mailFehler}</p>}

            <p class="admin-dialog-hinweis">{t('admin.users.emailFixNote')}</p>

            <div class="admin-dialog-knoepfe">
              <button
                class="admin-btn-promote"
                disabled={mailLaeuft || !mailNeu.trim()}
                onClick={adresseBerichtigen}
              >
                {mailLaeuft ? t('admin.cleanup.deleting') : t('admin.users.emailSave')}
              </button>
              <button class="admin-btn-sm" disabled={mailLaeuft} onClick={() => setMailFuer(null)}>
                {t('admin.cleanup.confirmNo')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
