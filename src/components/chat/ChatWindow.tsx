import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import { useChatSocket } from '../../hooks/useChatSocket';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData } from '../../i18n/index';
import MessageList from './MessageList';
import MessageInput, { type ReplyTarget } from './MessageInput';
import type { Message, MessageStrings } from './MessageItem';
import PMPanel from './PMPanel';
import ConfirmDialog from './ConfirmDialog';
import './ChatWindow.css';

type ChatType = 'global' | 'global-lang' | 'server' | 'server-lang';

const POLL_MS = 5_000;
// Presence (last_seen-Write + Online-Liste) läuft nur bei jedem 4. Sync-Durchlauf,
// also alle 20 s. Der Server wertet Nutzer 5 Minuten lang als online — das reicht
// also mit großem Abstand.
const PRESENCE_EVERY = 4;
// Obergrenze für die im Speicher gehaltenen Nachrichten. Ohne Limit wächst die
// Liste (und damit DOM + Render-Aufwand) linear mit der Laufzeit des Tabs —
// nach ein paar Stunden friert der Tab sonst ein.
const MAX_MESSAGES = 200;

interface ChatWindowProps {
  translationData: TranslationData;
}

interface OnlineUser {
  username:     string;
  faction:      string | null;
  server:       string | null;
  language:     string | null;
  is_admin:     number;
  is_moderator: number;
}

const FACTION_COLORS: Record<string, string> = {
  'blood-rose':     '#e74c3c',
  'wings-of-dawn':  '#4a9eda',
  'guard-of-order': '#27ae60',
};

function factionColor(faction: string | null): string {
  return faction ? (FACTION_COLORS[faction] ?? 'rgba(255,255,255,0.6)') : 'rgba(255,255,255,0.6)';
}

// Flacher Vergleich der Online-Liste: verhindert einen Rerender, wenn der
// Presence-Poll dieselben Nutzer zurückgibt (nur eine neue Array-Instanz).
function sameOnlineUsers(a: OnlineUser[], b: OnlineUser[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((u, i) =>
    u.username === b[i].username
    && u.server === b[i].server
    && u.language === b[i].language
    && u.faction === b[i].faction);
}

export default function ChatWindow({ translationData }: ChatWindowProps) {
  const { user, token, isLoggedIn } = useAuth();
  const { activeProfile } = useProfile();
  const t = useTranslations(translationData);

  const [chatType,     setChatType]     = useState<ChatType>('global');
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState<string | null>(null);
  const [sending,      setSending]      = useState(false);
  const [sendError,    setSendError]    = useState<string | null>(null);
  // Zeichengrenze, wie der Server sie meldet. Sie ist im Panel einstellbar;
  // das Eingabefeld ging vorher immer von 500 aus.
  const [maxLen,       setMaxLen]       = useState<number>(500);
  const [reportedIds,  setReportedIds]  = useState<Set<string>>(new Set());
  const [replyTo,      setReplyTo]      = useState<ReplyTarget | null>(null);
  // Die Online-Liste hat zwei Quellen, und beide werden gebraucht:
  //   • dbUsers      — ALLE eingeloggten Leute (auch auf anderen Seiten als dem
  //                    Chat). Kommt vom Heartbeat, der ohnehin jede Minute läuft.
  //   • socketUsers  — wer gerade im Chat-Fenster hängt. Kommt sofort über die
  //                    Live-Verbindung, ist aber nur ein Ausschnitt.
  // Angezeigt wird die Vereinigung: vollständig UND sofort aktuell.
  const [dbUsers,     setDbUsers]     = useState<OnlineUser[]>([]);
  const [socketUsers, setSocketUsers] = useState<OnlineUser[]>([]);
  const [openPM,       setOpenPM]       = useState<string | null>(null);
  // Startwert aus dem Gerätespeicher, damit die Liste sofort dasteht. Der
  // verbindliche Stand kommt gleich darauf vom Server (siehe Effekt unten) —
  // ohne den wäre eine am Telefon begonnene Unterhaltung hier unsichtbar.
  const [pmContacts,   setPmContacts]   = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('wh-pm-contacts') ?? '[]'); }
    catch { return []; }
  });
  const [pmUnread,     setPmUnread]     = useState<Map<string, number>>(() => {
    try {
      const pending: Record<string, number> = JSON.parse(localStorage.getItem('wh-pending-dm-unreads') ?? '{}');
      return new Map(Object.entries(pending));
    } catch { return new Map<string, number>(); }
  });
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [sidebarOpen,  setSidebarOpen]  = useState(false);

  const pmInboxSince = useRef<string | null>(null);

  // ── Gesprächsliste vom Server holen ───────────────────────────────────────
  //
  // Die Liste lag bisher nur im Speicher des jeweiligen Geräts. Wer am Telefon
  // jemandem geschrieben hatte, sah die Unterhaltung am Rechner nicht — obwohl
  // die Nachrichten längst in der Datenbank standen.
  //
  // Der Serverstand gibt die Reihenfolge vor (jüngste Unterhaltung zuerst).
  // Namen, die nur lokal bekannt sind, bleiben erhalten und werden angehängt:
  // Wer gerade ein Gespräch geöffnet, aber noch nichts geschrieben hat, soll
  // es nicht verlieren.
  useEffect(() => {
    if (!isLoggedIn || !token) return;
    let abgebrochen = false;

    fetch('/api/chat/pm-contacts', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then((d: { contacts?: string[] } | null) => {
        if (abgebrochen || !Array.isArray(d?.contacts)) return;
        setPmContacts(prev => {
          const zusammen = [...d.contacts!, ...prev.filter(n => !d.contacts!.includes(n))].slice(0, 20);
          try { localStorage.setItem('wh-pm-contacts', JSON.stringify(zusammen)); } catch { /* ignore */ }
          return zusammen;
        });
      })
      .catch(() => { /* offline — die lokale Liste bleibt */ });

    return () => { abgebrochen = true; };
  }, [isLoggedIn, token]);
  const openPMRef    = useRef<string | null>(null);

  const lastCreatedAt = useRef<string | null>(null);
  const syncRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncTick      = useRef(0);
  const serverRef     = useRef<string | null>(null);
  const chatTypeRef   = useRef<ChatType>(chatType);
  const prevTypeRef   = useRef<ChatType>(chatType);

  // Per-tab "last seen" timestamps for inactive-tab background polling
  const tabSince = useRef<Partial<Record<ChatType, string>>>({});
  // Zählt die Ladevorgänge der Historie. Wer schnell zwischen den Kanälen
  // wechselt, hat mehrere gleichzeitig unterwegs — und die Antworten kommen
  // nicht in der Reihenfolge zurück, in der sie losgeschickt wurden. Ohne
  // diesen Zähler schrieb eine verspätete Antwort ihre Nachrichten in den
  // Kanal, den man inzwischen offen hatte.
  const ladeLauf = useRef(0);

  const [unreadCounts, setUnreadCounts] = useState<Map<ChatType, number>>(new Map());

  useEffect(() => {
    // Save current position for the tab we're leaving
    if (lastCreatedAt.current) {
      tabSince.current[prevTypeRef.current] = lastCreatedAt.current;
    }
    prevTypeRef.current = chatType;
    chatTypeRef.current = chatType;
    setReplyTo(null);
    // Clear unread indicator for the tab we just switched to
    setUnreadCounts(prev => {
      if (!prev.has(chatType)) return prev;
      const next = new Map(prev);
      next.delete(chatType);
      return next;
    });
  }, [chatType]);
  useEffect(() => {
    openPMRef.current = openPM;
    if (openPM) {
      // Clear unread for the now-open conversation
      setPmUnread(prev => {
        if (!prev.has(openPM)) return prev;
        const next = new Map(prev);
        next.delete(openPM);
        return next;
      });
    }
  }, [openPM]);

  const onlineUsers = useMemo(() => {
    const byName = new Map<string, OnlineUser>();
    for (const u of dbUsers)     byName.set(u.username, u);
    for (const u of socketUsers) byName.set(u.username, u);
    return [...byName.values()].sort((a, b) => a.username.localeCompare(b.username));
  }, [dbUsers, socketUsers]);

  // Vollständige Liste vom Heartbeat (siehe PresenceHeartbeat).
  useEffect(() => {
    const onPresence = (e: Event) => {
      const users = (e as CustomEvent).detail as OnlineUser[];
      if (Array.isArray(users)) setDbUsers(prev => sameOnlineUsers(prev, users) ? prev : users);
    };
    window.addEventListener('wh-presence', onPresence);
    return () => window.removeEventListener('wh-presence', onPresence);
  }, []);

  const isAdmin   = user?.is_admin === 1 || user?.is_moderator === 1;
  const hasLang   = !!(user?.language && user.language.trim());
  const hasServer = !!(isLoggedIn && activeProfile.server);
  const langCode  = user?.language?.toUpperCase() ?? '';
  const serverName = activeProfile.server;

  // ── Live-Verbindung ───────────────────────────────────────────────────────
  // Eine Verbindung deckt alles ab: Nachrichten, Ungelesen-Hinweise der anderen
  // Tabs, private Nachrichten, Löschungen und die Online-Liste. Steht sie, wird
  // gar nicht mehr gepollt. Steht sie nicht (Hub aus, Netz zickt), übernimmt
  // der Poll unverändert.
  const wsConnected = useChatSocket(chatType, serverName, token, (ev) => {
    switch (ev.type) {
      // Neue Nachricht im offenen Tab
      case 'message': {
        const msg = ev.message as Message;
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;   // gleiche Dedup wie beim Poll
          return [...prev, msg].slice(-MAX_MESSAGES);
        });
        if (msg.created_at) lastCreatedAt.current = msg.created_at;
        break;
      }

      // Nachricht in einem anderen Tab — nur der Zähler, nicht der Inhalt
      case 'unread': {
        const t = ev.channel as ChatType;
        if (t === chatTypeRef.current) break;
        setUnreadCounts(prev => {
          const next = new Map(prev);
          next.set(t, (next.get(t) ?? 0) + 1);
          return next;
        });
        break;
      }

      // Private Nachricht
      case 'pm': {
        const from = ev.from;
        setPmContacts(prev => {
          const next = [from, ...prev.filter(n => n !== from)].slice(0, 10);
          localStorage.setItem('wh-pm-contacts', JSON.stringify(next));
          return next;
        });
        // Ist das Gespräch offen, bekommt es die Nachricht direkt über die
        // Verbindung. Vorher fragte das Fenster stattdessen alle fünf Sekunden
        // nach — obwohl sie hier bereits vorlag.
        if (openPMRef.current === from) {
          try {
            window.dispatchEvent(new CustomEvent('wh:pm-message', {
              detail: { from, message: ev.message },
            }));
          } catch { /* ignore */ }
          break;
        }
        if (openPMRef.current === null) {
          setOpenPM(from);
          openPMRef.current = from;
        } else {
          setPmUnread(prev => {
            const next = new Map(prev);
            next.set(from, (prev.get(from) ?? 0) + 1);
            return next;
          });
        }
        break;
      }

      // Von einem Moderator gelöscht
      case 'delete':
        setMessages(prev => prev.filter(m => m.id !== ev.id));
        break;

      // Ankündigung des Betreibers — der Hinweisbalken zeigt sie an
      case 'announce':
        try {
          window.dispatchEvent(new CustomEvent('wh-announcement', { detail: ev.announcement }));
        } catch { /* ignore */ }
        break;

      // Online-Liste — kommt bei jedem Kommen und Gehen
      case 'presence':
        setSocketUsers(prev => sameOnlineUsers(prev, ev.users) ? prev : ev.users);
        break;
    }
  });

  // Als Ref mitführen, damit das Sync-Intervall bei einem Verbindungswechsel
  // nicht neu aufgesetzt werden muss.
  const wsConnectedRef = useRef(false);
  useEffect(() => { wsConnectedRef.current = wsConnected; }, [wsConnected]);

  // ── Ein Sync-Poll für alles ───────────────────────────────────────────────
  // Bündelt, was früher vier getrennte Requests waren: Nachrichten des aktiven
  // Kanals, Ungelesen-Zähler der anderen Tabs, PM-Inbox und Presence.
  // Werte, die sich ändern können, laufen über Refs — damit muss das Intervall
  // nicht bei jedem Kanal- oder Profilwechsel neu aufgesetzt werden.
  useEffect(() => { serverRef.current = serverName; }, [serverName]);

  useEffect(() => {
    if (!isLoggedIn || !token) return;

    const runSync = async () => {
      if (document.visibilityState === 'hidden') return;

      const tick = syncTick.current++;

      // Steht die Live-Verbindung, kommt ALLES über sie — Nachrichten,
      // Ungelesen-Zähler, private Nachrichten und die Online-Liste. Dann gibt
      // es hier nichts mehr zu holen. Bricht sie ab, läuft der Poll ab dem
      // nächsten Durchlauf automatisch wieder an.
      // Der erste Durchlauf läuft immer: er stellt den Ausgangszustand her
      // (was wurde verpasst, während die Seite zu war).
      if (wsConnectedRef.current && tick > 0) return;

      // Presence ist deutlich träger als der Nachrichten-Poll: nur bei jedem
      // n-ten Durchlauf mitschicken, sonst gäbe es alle 5 s einen D1-Write.
      const wantPresence = tick % PRESENCE_EVERY === 0;

      const tabs: Record<string, string> = {};
      (['global', 'global-lang', 'server', 'server-lang'] as ChatType[]).forEach(t => {
        if (t === chatTypeRef.current) return;
        const since = tabSince.current[t];
        if (since) tabs[t] = since;
      });

      // Womit diese Anfrage losgeschickt wurde. Bis die Antwort kommt, kann der
      // Kanal gewechselt haben — dann gehoeren ihre Nachrichten nicht mehr
      // hierher.
      const gefragterTyp    = chatTypeRef.current;
      const gefragterServer = serverRef.current;

      try {
        const res = await fetch('/api/chat/sync', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body:    JSON.stringify({
            active: { type: gefragterTyp, since: lastCreatedAt.current },
            server:   gefragterServer,
            tabs,
            pm_since: pmInboxSince.current,
            presence: wantPresence,
            limit:    50,
          }),
        });
        if (!res.ok) return;
        const data = await res.json() as {
          messages: Message[];
          unread:   Record<string, { count: number; last_ts: string | null }>;
          pm:       { senders: { sender_username: string; count: number }[] };
          online:   OnlineUser[] | null;
          server_time: string;
        };

        // 1) Neue Nachrichten im aktiven Kanal
        //
        // Nur dieser Block haengt am Kanal. Wurde inzwischen umgeschaltet,
        // wuerden hier fremde Nachrichten angehaengt — und schlimmer noch, der
        // Cursor unten auf den fremden Zeitstempel gesetzt, sodass der neue
        // Kanal ab einer falschen Stelle weiterliest. Zaehler, private
        // Nachrichten und die Online-Liste gelten dagegen kanalunabhaengig und
        // werden weiter verarbeitet.
        const nochDerselbeKanal =
          chatTypeRef.current === gefragterTyp && serverRef.current === gefragterServer;

        if (nochDerselbeKanal && data.messages?.length > 0) {
          setMessages(prev => {
            const known = new Set(prev.map(m => m.id));
            const fresh = data.messages.filter(m => !known.has(m.id));
            return fresh.length > 0 ? [...prev, ...fresh].slice(-MAX_MESSAGES) : prev;
          });
          lastCreatedAt.current = data.messages[data.messages.length - 1].created_at;
        }

        // 2) Ungelesen-Zähler der übrigen Tabs
        const unread = data.unread ?? {};
        if (Object.keys(unread).length > 0) {
          setUnreadCounts(prev => {
            const next = new Map(prev);
            Object.entries(unread).forEach(([type, info]) => {
              if (info.last_ts) tabSince.current[type as ChatType] = info.last_ts;
              next.set(type as ChatType, (next.get(type as ChatType) ?? 0) + info.count);
            });
            return next;
          });
        }

        // 3) Eingehende PMs
        data.pm?.senders?.forEach(({ sender_username, count }) => {
          setPmContacts(prev => {
            const next = [sender_username, ...prev.filter(n => n !== sender_username)].slice(0, 10);
            localStorage.setItem('wh-pm-contacts', JSON.stringify(next));
            return next;
          });
          if (openPMRef.current === sender_username) return; // offen — PMPanel pollt selbst
          if (openPMRef.current === null) {
            setOpenPM(sender_username);
            openPMRef.current = sender_username;
          } else {
            setPmUnread(prev => {
              const next = new Map(prev);
              next.set(sender_username, (prev.get(sender_username) ?? 0) + (count ?? 1));
              return next;
            });
          }
        });

        // 4) Online-Liste (nur in Presence-Durchläufen enthalten)
        if (data.online) {
          setDbUsers(prev => sameOnlineUsers(prev, data.online!) ? prev : data.online!);
        }

        if (data.server_time) pmInboxSince.current = data.server_time;
      } catch { /* transiente Fehler ignorieren */ }
    };

    runSync();
    syncRef.current = setInterval(runSync, POLL_MS);
    return () => { if (syncRef.current) clearInterval(syncRef.current); };
  }, [isLoggedIn, token]);

  // Filter online users by currently visible channel
  const visibleOnline = onlineUsers.filter(u => {
    const lang = (u.language ?? '').trim().toLowerCase();
    const myLang = (user?.language ?? '').trim().toLowerCase();
    switch (chatType) {
      case 'global':      return true;
      case 'global-lang': return lang === myLang && !!lang;
      case 'server':      return u.server === serverName;
      case 'server-lang': return u.server === serverName && lang === myLang && !!lang;
      default: return false;
    }
  });

  // ── Chat polling ──────────────────────────────────────────────────────────
  const buildUrl = useCallback((type: ChatType, extra: string = ''): string => {
    const base = (type === 'global' || type === 'global-lang')
      ? '/api/chat/global'
      : `/api/chat/server/${serverName}`;

    const langParam = (type === 'global-lang' || type === 'server-lang') && user?.language
      ? `lang=${user.language}`
      : '';

    const allParams = [langParam, extra].filter(Boolean).join('&');
    return allParams ? `${base}?${allParams}` : base;
  }, [serverName, user?.language]);

  const loadInitial = useCallback(async (type: ChatType) => {
    if (!token) return;
    const lauf = ++ladeLauf.current;
    // Überholt: inzwischen wurde ein anderer Kanal geöffnet.
    const veraltet = () => lauf !== ladeLauf.current;
    setLoading(true);
    setLoadError(null);
    setMessages([]);
    lastCreatedAt.current = null;
    try {
      const res = await fetch(buildUrl(type, 'limit=50'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (veraltet()) return;
      if (!res.ok) {
        const data = await res.json() as { error: string };
        if (veraltet()) return;
        setLoadError(data.error ?? t('chat.loading'));
        return;
      }
      const data = await res.json() as { messages: Message[]; max_length?: number; server_time?: string };
      if (veraltet()) return;
      if (data.max_length) setMaxLen(data.max_length);
      setMessages(data.messages);
      // Auch ein leerer Kanal braucht einen Cursor. Ohne ihn stellt der
      // Sync-Endpunkt gar keine Nachrichtenabfrage (sync.ts: `if (activeSince
      // && …)`), und der Cursor entsteht nur aus einer bereits geholten
      // Nachricht — ein frischer Kanal oder ein neu geoeffnetes Gespraech blieb
      // deshalb bei ausgefallener Live-Verbindung dauerhaft leer. Die Serverzeit
      // aus der Antwort ist der richtige Startpunkt: alles Aeltere ist bereits
      // in der Liste, alles Neuere kommt beim naechsten Durchlauf.
      if (data.messages.length > 0) {
        lastCreatedAt.current = data.messages[data.messages.length - 1].created_at;
      } else if (data.server_time) {
        lastCreatedAt.current = data.server_time;
      }
    } catch {
      if (veraltet()) return;
      setLoadError(t('chat.error.connection_reload'));
    } finally {
      // Der Ladehinweis gehört dem neuesten Lauf; ein überholter darf ihn nicht
      // vorzeitig abschalten und einen halb geladenen Kanal zeigen.
      if (!veraltet()) setLoading(false);
    }
  }, [token, buildUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Kanalwechsel: Historie neu laden. Das laufende Nachrichten-Update erledigt
  // der Sync-Poll weiter oben — er liest den aktiven Kanal aus chatTypeRef.
  useEffect(() => {
    if (!isLoggedIn || !token) return;
    loadInitial(chatType);
    // serverName gehoert dazu: buildUrl baut die Adresse daraus. Fehlte es,
    // blieb nach einem Wechsel des Spielprofils die Historie des alten Servers
    // stehen, und neue Nachrichten des neuen wurden daran angehaengt.
  }, [isLoggedIn, token, chatType, serverName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Init baselines for inactive tabs ──────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn || !token) return;
    const allTypes: ChatType[] = ['global', 'global-lang', 'server', 'server-lang'];
    allTypes.forEach(type => {
      if (type === chatType) return; // active tab handled by main poll
      if (type === 'global-lang' && !hasLang) return;
      if (type === 'server' && !hasServer) return;
      if (type === 'server-lang' && (!hasServer || !hasLang)) return;
      fetch(buildUrl(type, 'limit=1'), { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then((data: { messages: { created_at: string }[]; server_time?: string } | null) => {
          if (!data) return;
          tabSince.current[type] = data.messages.length > 0
            ? data.messages[data.messages.length - 1].created_at
            : (data.server_time ?? new Date().toISOString().replace('T', ' ').slice(0, 19));
        })
        .catch(() => {});
    });
  }, [isLoggedIn, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── On mount: restore unread-tab state from GlobalChatPoller (cross-page nav) ─
  useEffect(() => {
    if (!isLoggedIn) return;
    try {
      const stored: Record<string, number> = JSON.parse(localStorage.getItem('wh-unread-channels') ?? '{}');
      const urls = Object.keys(stored);
      if (urls.length === 0) return;
      localStorage.removeItem('wh-unread-channels');
      const initial = new Map<ChatType, number>();
      urls.forEach(url => {
        const isServer = url.includes('/api/chat/server/');
        const hasLang  = url.includes('lang=');
        const type: ChatType = !isServer && !hasLang ? 'global'
          : !isServer && hasLang  ? 'global-lang'
          : isServer  && !hasLang ? 'server'
          : 'server-lang';
        if (type !== chatType) initial.set(type, (initial.get(type) ?? 0) + (typeof stored[url] === 'number' ? stored[url] : 1));
      });
      if (initial.size > 0) setUnreadCounts(prev => {
        const next = new Map(prev);
        initial.forEach((count, t) => next.set(t, (next.get(t) ?? 0) + count));
        return next;
      });
    } catch { /* ignore */ }
  }, [isLoggedIn]); // eslint-disable-line

  // ── On mount: ensure pending DM contacts are visible in the sidebar ─────────
  useEffect(() => {
    if (!isLoggedIn) return;
    try {
      const pending: Record<string, number> = JSON.parse(localStorage.getItem('wh-pending-dm-unreads') ?? '{}');
      const usernames = Object.keys(pending);
      if (usernames.length === 0) return;
      // Add any new senders to the contacts list so the unread badge has something to show on
      usernames.forEach(username => {
        setPmContacts(prev => {
          if (prev.includes(username)) return prev;
          const next = [username, ...prev].slice(0, 10);
          localStorage.setItem('wh-pm-contacts', JSON.stringify(next));
          return next;
        });
      });
    } catch { /* ignore */ }
  }, [isLoggedIn]); // eslint-disable-line

  // ── Keep wh-pending-dm-unreads in sync so navigation away preserves unreads ─
  useEffect(() => {
    if (pmUnread.size > 0) {
      localStorage.setItem('wh-pending-dm-unreads', JSON.stringify(Object.fromEntries(pmUnread)));
    } else {
      localStorage.removeItem('wh-pending-dm-unreads');
    }
  }, [pmUnread]);

  // ── Dispatch global unread count to GlobalChatPoller ──────────────────────
  useEffect(() => {
    if (!isLoggedIn) return;
    const total = pmUnread.size + unreadCounts.size;
    window.dispatchEvent(new CustomEvent('wh:unread-count', { detail: { total } }));
  }, [pmUnread, unreadCounts, isLoggedIn]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text: string): Promise<boolean> => {
    if (!token) return false;
    setSending(true);
    setSendError(null);
    const currentReplyId = replyTo?.id ?? null;
    try {
      const res = await fetch(buildUrl(chatType), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ message: text, reply_to_id: currentReplyId }),
      });
      const data = await res.json() as any;
      if (!res.ok) { setSendError(data.error ?? t('chat.error.send_failed')); return false; }
      const newMsg = data as Message;
      setMessages(prev => {
        const known = new Set(prev.map(m => m.id));
        return known.has(newMsg.id) ? prev : [...prev, newMsg].slice(-MAX_MESSAGES);
      });
      lastCreatedAt.current = newMsg.created_at;
      setReplyTo(null);
      return true;
    } catch {
      setSendError(t('chat.error.connection_retry'));
      return false;
    } finally {
      setSending(false);
    }
  }, [token, chatType, buildUrl, replyTo]);

  const handleReport = useCallback(async (msgId: string, reason: string) => {
    if (!token) return;
    try {
      await fetch('/api/chat/report', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ chat_type: chatType, message_id: msgId, reason }),
      });
      setReportedIds(prev => new Set([...prev, msgId]));
    } catch { /* ignore */ }
  }, [token, chatType]);

  const handleReply = useCallback((msg: Message) => {
    setReplyTo({
      id:       msg.id,
      username: msg.username,
      text:     msg.message.length > 80 ? msg.message.slice(0, 80) + '…' : msg.message,
    });
  }, []);

  const openPMWith = useCallback((username: string) => {
    setOpenPM(username);
    setPmUnread(prev => {
      if (!prev.has(username)) return prev;
      const next = new Map(prev); next.delete(username); return next;
    });
    setPmContacts(prev => {
      const next = [username, ...prev.filter(n => n !== username)].slice(0, 10);
      localStorage.setItem('wh-pm-contacts', JSON.stringify(next));
      return next;
    });
  }, []);

  const removePMContact = useCallback((username: string, e: MouseEvent) => {
    e.stopPropagation();
    setConfirmRemove(username);
  }, []);

  const doRemovePMContact = useCallback((username: string) => {
    setConfirmRemove(null);
    if (openPM === username) setOpenPM(null);
    setPmUnread(prev => { const next = new Map(prev); next.delete(username); return next; });
    setPmContacts(prev => {
      const next = prev.filter(n => n !== username);
      localStorage.setItem('wh-pm-contacts', JSON.stringify(next));
      return next;
    });
  }, [openPM]);

  const handleDelete = useCallback(async (msgId: string) => {
    if (!token) return;
    try {
      await fetch('/api/chat/admin/message', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ chat_type: chatType, message_id: msgId }),
      });
      setMessages(prev => prev.filter(m => m.id !== msgId));
    } catch { /* ignore */ }
  }, [token, chatType]);

  // Stabile Objekt-Identität, damit das memoisierte MessageItem nicht bei jedem
  // Render neu zeichnet. Muss vor dem frühen Return stehen (Hook-Regeln).
  const ago = useMemo(() => ({
    seconds: t('chat.ago_seconds'),
    minutes: t('chat.ago_minutes'),
    hours:   t('chat.ago_hours'),
    days:    t('chat.ago_days'),
  }), [translationData]); // eslint-disable-line react-hooks/exhaustive-deps

  const messageStrings: MessageStrings = useMemo(() => ({
    reply:         t('chat.action.reply'),
    pm:            t('chat.action.pm'),
    delete:        t('chat.action.delete'),
    admin:         t('chat.role.admin'),
    mod:           t('chat.role.moderator'),
    survivor:      t('chat.role.survivor'),
    deleteTitle:   t('chat.delete.title'),
    deleteConfirm: t('chat.delete.confirm'),
    deleteButton:  t('chat.delete.button'),
    reportTitle:   t('chat.report.title'),
    reportPrompt:  t('chat.report.choose_reason'),
    report:        t('chat.report'),
    reported:      t('chat.report_sent'),
    cancel:        t('dialog.cancel'),
    reasons: [
      { value: 'spam',   icon: '📢', label: t('chat.report.reason.spam') },
      { value: 'porn',   icon: '🔞', label: t('chat.report.reason.porn') },
      { value: 'racism', icon: '🚫', label: t('chat.report.reason.racism') },
      { value: 'hate',   icon: '💢', label: t('chat.report.reason.hate') },
      { value: 'other',  icon: '⚠️', label: t('chat.report.reason.other') },
    ],
  }), [translationData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Not logged in ─────────────────────────────────────────────────────────
  if (!isLoggedIn || !user) {
    return (
      <div class="chat-login-wall">
        <div class="chat-login-icon">💬</div>
        <p class="chat-login-text">{t('chat.login_required')}</p>
        <p class="chat-login-hint">{t('chat.login_hint')}</p>
      </div>
    );
  }

  // ── Tab config ────────────────────────────────────────────────────────────
  type TabDef = { type: ChatType; label: string; disabled?: boolean; title?: string };
  const tabs: TabDef[] = [
    {
      type:  'global',
      label: `🌍 ${t('chat.global')}`,
    },
    ...(hasLang ? [{
      type:  'global-lang' as ChatType,
      label: `🌍 ${t('chat.global')} ${langCode}`,
    }] : []),
    {
      type:     'server',
      label:    hasServer ? `🏠 ${t('chat.server')} ${serverName}` : `🏠 ${t('chat.server')}`,
      disabled: !hasServer,
      title:    !hasServer ? t('chat.no_server_hint') : undefined,
    },
    ...(hasServer && hasLang ? [{
      type:  'server-lang' as ChatType,
      label: `🏠 ${t('chat.server')} ${serverName} ${langCode}`,
    }] : []),
  ];

  // Total unread DM messages across all senders (for sidebar toggle badge)
  const totalPmUnread = [...pmUnread.values()].reduce((a, b) => a + b, 0);

  // ── Chat UI ───────────────────────────────────────────────────────────────
  return (
    <div class="chat-window">

      {/* ── Sidebar backdrop (mobile only) ── */}
      {sidebarOpen && (
        <div class="chat-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Online Users Sidebar ── */}
      <div class={`chat-online-sidebar${sidebarOpen ? ' chat-sidebar-open' : ''}`}>

        {/* DM Contacts — top section, always visible */}
        {pmContacts.length > 0 && (
          <div class="chat-pm-contacts">
            <div class="chat-pm-contacts-header">{t('chat.dms')}</div>
            {pmContacts.map(name => (
              <div key={name} class="chat-pm-contact-row">
                <button
                  class={`chat-pm-contact${openPM === name ? ' chat-pm-contact-active' : ''}`}
                  onClick={() => openPMWith(name)}
                >
                  <span class="chat-pm-contact-icon">✉</span>
                  <span class="chat-pm-contact-name">{name}</span>
                  {pmUnread.has(name) && (
                    <span class="chat-pm-unread-count">
                      {(pmUnread.get(name) ?? 0) > 99 ? '99+' : pmUnread.get(name)}
                    </span>
                  )}
                </button>
                <button
                  class="chat-pm-contact-remove"
                  onClick={(e) => removePMContact(name, e as unknown as MouseEvent)}
                  title={t('chat.action.remove')}
                >×</button>
              </div>
            ))}
          </div>
        )}

        <div class="chat-online-header">
          {t('chat.online')} <span class="chat-online-count">{visibleOnline.length}</span>
        </div>
        <ul class="chat-online-list">
          {visibleOnline.length === 0 ? (
            <li class="chat-online-empty">—</li>
          ) : (
            visibleOnline.map(u => (
              <li key={u.username} class="chat-online-user">
                <span
                  class="chat-online-dot"
                  style={{ background: factionColor(u.faction) }}
                />
                <span class="chat-online-info">
                  <span class="chat-online-name-row">
                    <span
                      class="chat-online-name"
                      style={{ color: factionColor(u.faction) }}
                    >
                      {u.username}
                    </span>
                    {u.is_admin === 1 && (
                      <span class="chat-online-role">⚙</span>
                    )}
                    {u.is_moderator === 1 && (
                      <span class="chat-online-role chat-online-role-mod">🛡</span>
                    )}
                  </span>
                  {u.server && (
                    <span class="chat-online-server">{u.server}</span>
                  )}
                </span>
                {u.username !== user?.username && (
                  <button
                    class="chat-online-pm-btn"
                    onClick={() => openPMWith(u.username)}
                    title="PM"
                  >✉</button>
                )}
              </li>
            ))
          )}
        </ul>
      </div>

      {/* ── PM Panel + mobile backdrop ── */}
      {openPM && token && (
        <div class="chat-pm-backdrop" onClick={() => setOpenPM(null)} />
      )}
      {openPM && token && (
        <PMPanel
          // Eigene Instanz je Kontakt: Ohne key wird dieselbe wiederverwendet,
          // samt ihrer Refs und der bereits laufenden Anfragen.
          key={openPM}
          username={openPM}
          currentUsername={user.username}
          token={token}
          wsVerbunden={wsConnected}
          onClose={() => setOpenPM(null)}
          ago={ago}
          isAdmin={isAdmin}
          translationData={translationData}
        />
      )}

      {/* ── Main Chat Area ── */}
      <div class="chat-main">

        {/* Tab switcher */}
        <div class="chat-tabs" role="tablist">
          <button
            class={`chat-sidebar-toggle${sidebarOpen ? ' chat-sidebar-toggle-active' : ''}`}
            onClick={() => setSidebarOpen(s => !s)}
            title={t('chat.online')}
          >
            👥 {visibleOnline.length}
            {!sidebarOpen && totalPmUnread > 0 && (
              <span class="chat-sidebar-badge">
                {totalPmUnread > 99 ? '99+' : totalPmUnread}
              </span>
            )}
          </button>
          {tabs.map(tab => (
            <button
              key={tab.type}
              class={[
                'chat-tab',
                chatType === tab.type ? 'chat-tab-active' : '',
                tab.disabled ? 'chat-tab-disabled' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => !tab.disabled && setChatType(tab.type)}
              role="tab"
              aria-selected={chatType === tab.type}
              disabled={tab.disabled}
              title={tab.title}
            >
              {tab.label}
              {(unreadCounts.get(tab.type) ?? 0) > 0 && (
                <span class="chat-tab-unread-badge">
                  {(unreadCounts.get(tab.type) ?? 0) > 99 ? '99+' : unreadCounts.get(tab.type)}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Message area */}
        {loading ? (
          <div class="chat-loading">
            <span class="chat-loading-dot" />
            <span class="chat-loading-dot" />
            <span class="chat-loading-dot" />
          </div>
        ) : loadError ? (
          <div class="chat-error-box">{loadError}</div>
        ) : (
          <MessageList
            messages={messages}
            currentUsername={user.username}
            onReport={handleReport}
            reportedIds={reportedIds}
            noMessages={t('chat.no_messages')}
            ago={ago}
            isAdmin={isAdmin}
            onDelete={handleDelete}
            onReply={handleReply}
            onPM={openPMWith}
            strings={messageStrings}
          />
        )}

        {/* Input */}
        <MessageInput
          maxLen={maxLen}
          onSend={handleSend}
          sending={sending}
          sendError={sendError}
          onClearError={() => setSendError(null)}
          placeholder={t('chat.input_placeholder')}
          sendLabel={t('chat.send')}
          charsLeft={t('chat.chars_left')}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />

      </div>

      {/* ── Confirm Remove DM Dialog ── */}
      {confirmRemove && (
        <ConfirmDialog
          title={t('chat.pm.remove_title')}
          message={t('chat.pm.remove_confirm', { username: confirmRemove })}
          confirmLabel={t('chat.action.remove')}
          cancelLabel={t('dialog.cancel')}
          variant="danger"
          onConfirm={() => doRemovePMContact(confirmRemove)}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}
