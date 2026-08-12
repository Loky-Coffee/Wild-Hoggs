// Unsichtbare Komponente — läuft über Navigation.astro auf jeder Seite und
// pflegt den Zähler an "Community" sowie den Titel des Browser-Tabs.
//
// Zuerst die Live-Verbindung, Abfragen nur als Rückfall:
//
//   verbunden      → keine Abfragen; Hinweise kommen in dem Moment, in dem
//                    jemand schreibt
//   nicht verbunden→ alle 20 Sekunden abfragen, wie zuvor
//
// Vorher lief ausschliesslich die Abfrage — bis zu fünf Anfragen alle zwanzig
// Sekunden je angemeldeter Person (Postfach plus bis zu vier Kanäle), also
// rund 900 in der Stunde. Die Verbindung gab es zwar schon, aber nur im
// Community-Bereich; auf den übrigen Seiten wusste diese Komponente nichts
// von ihr.
//
// Ohne Anmeldung wird nicht verbunden — useChatSocket steigt ohne Token
// sofort aus, und ohne Anmeldung gibt es auch nichts zu melden.
//
// Im Community-Bereich hält das Chat-Fenster die Verbindung. Diese Komponente
// baut dort bewusst keine zweite auf und übernimmt nur dessen Zählung über
// das Ereignis 'wh:unread-count'.

import { useEffect, useRef, useCallback, useState } from 'preact/hooks';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import { useChatSocket, type ChatSocketEvent } from '../../hooks/useChatSocket';

// Ein einziger, wiederverwendeter AudioContext. Vorher wurde pro Ton ein neuer
// erzeugt und über osc.onended geschlossen — das greift aber nur, wenn der Ton
// tatsächlich läuft. Blockiert der Browser die Autoplay-Policy, bleibt der
// Context in 'suspended', onended feuert nie und der Context bleibt offen
// (Chrome erlaubt nur ~6 gleichzeitig, danach schlägt jeder Ton fehl).
let sharedAudioCtx: AudioContext | null = null;

function playNotificationSound(volume: number) {
  try {
    if (!sharedAudioCtx) sharedAudioCtx = new AudioContext();
    const ctx = sharedAudioCtx;
    if (ctx.state === 'suspended') { ctx.resume().catch(() => {}); }
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880,  ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
    // Nur die Nodes trennen — der Context selbst bleibt für den nächsten Ton bestehen.
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  } catch { /* browser may block autoplay */ }
}

const POLL_MS = 20_000; // 20 s when not on community page

function isOnCommunity(): boolean {
  const p = window.location.pathname;
  return p === '/community/' || p.endsWith('/community/');
}

// All channel URLs the current user has access to
function buildChannelUrls(
  user: { language?: string | null } | null,
  server: string | null,
): string[] {
  if (!user) return [];
  const lang = user.language?.trim() || null;
  const urls: string[] = ['/api/chat/global'];
  if (lang)          urls.push(`/api/chat/global?lang=${encodeURIComponent(lang)}`);
  if (server)        urls.push(`/api/chat/server/${encodeURIComponent(server)}`);
  if (server && lang) urls.push(`/api/chat/server/${encodeURIComponent(server)}?lang=${encodeURIComponent(lang)}`);
  return urls;
}

export default function GlobalChatPoller() {
  const { token, isLoggedIn, user } = useAuth();
  const { activeProfile } = useProfile();
  const notifSoundRef   = useRef(user?.notification_sound ?? 1);
  const notifVolumeRef  = useRef(user?.notification_volume ?? 1.5);
  useEffect(() => { notifSoundRef.current  = user?.notification_sound  ?? 1;   }, [user?.notification_sound]);
  useEffect(() => { notifVolumeRef.current = user?.notification_volume ?? 1.5; }, [user?.notification_volume]);

  const pmSince    = useRef<string | null>(null);
  // Per-channel since timestamps keyed by base URL (without since/limit params)
  const chanSince  = useRef<Record<string, string>>({});
  const countRef   = useRef(0);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Apply count to DOM + document.title ───────────────────────────────────
  const applyCount = useCallback((n: number) => {
    if (n > countRef.current && notifSoundRef.current === 1) {
      playNotificationSound(notifVolumeRef.current);
    }
    countRef.current = n;

    // Nav badge
    const badge = document.getElementById('community-badge') as HTMLElement | null;
    if (badge) {
      if (n > 0) {
        badge.textContent = n > 99 ? '99+' : String(n);
        badge.style.display = 'inline-flex';
      } else {
        badge.textContent = '';
        badge.style.display = 'none';
      }
    }

    // Mobile hamburger dot — data attribute drives ::after pseudo-element
    const toggle = document.querySelector('.nav-toggle') as HTMLElement | null;
    if (toggle) {
      if (n > 0) toggle.setAttribute('data-badge', '1');
      else toggle.removeAttribute('data-badge');
    }

    // Browser tab title — strip any existing badge prefix first
    const clean = document.title.replace(/^\(\d+\+?\)\s*/, '');
    document.title = n > 0 ? `(${n > 99 ? '99+' : n}) ${clean}` : clean;
  }, []);

  // ── Listen for ChatWindow's unread count (when on community page) ──────────
  useEffect(() => {
    const onUnread = (e: Event) => {
      applyCount((e as CustomEvent<{ total: number }>).detail.total);
    };
    window.addEventListener('wh:unread-count', onUnread);
    return () => window.removeEventListener('wh:unread-count', onUnread);
  }, [applyCount]);

  // ── Reset when navigating TO community page ────────────────────────────────
  useEffect(() => {
    const onNav = () => {
      if (isOnCommunity()) {
        applyCount(0);
        pmSince.current  = null;
        chanSince.current = {};
      }
    };
    onNav(); // check on mount
    document.addEventListener('astro:page-load', onNav);
    return () => document.removeEventListener('astro:page-load', onNav);
  }, [applyCount]);

  // ── Live-Verbindung ───────────────────────────────────────────────────────
  //
  // Der Hub meldet neue Nachrichten in dem Moment, in dem sie geschrieben
  // werden. Ob sie als 'message' oder 'unread' ankommen, hängt davon ab,
  // welchen Tab er für diese Person vermerkt hat — hier zählt beides gleich,
  // denn wer nicht im Community-Bereich ist, hat ohnehin nichts offen.
  //
  // Im Community-Bereich wird kein Token durchgereicht: Dort hält das
  // Chat-Fenster die Verbindung, eine zweite wäre überflüssig.
  // Muss auf den Seitenwechsel reagieren: Die Komponente überlebt ihn dank
  // transition:persist, rendert dabei aber nicht von selbst neu. Ohne diesen
  // Zustand behielte sie ihre Verbindung auch im Community-Bereich — dort
  // baut das Chat-Fenster eine eigene auf, und es liefen zwei pro Person.
  const [aufCommunity, setAufCommunity] = useState(() => isOnCommunity());
  useEffect(() => {
    const pruefen = () => setAufCommunity(isOnCommunity());
    document.addEventListener('astro:page-load', pruefen);
    return () => document.removeEventListener('astro:page-load', pruefen);
  }, []);

  const socketToken = aufCommunity ? null : token;

  const beiEreignis = useCallback((ev: ChatSocketEvent) => {
    if (isOnCommunity()) return;              // das Chat-Fenster übernimmt
    if (ev.type === 'message' || ev.type === 'unread' || ev.type === 'pm') {
      applyCount(countRef.current + 1);
    }
  }, [applyCount]);

  const wsVerbunden = useChatSocket(
    'global',                          // gemeldeter Tab — siehe Kommentar oben
    activeProfile.server ?? null,
    socketToken,
    beiEreignis,
  );

  // ── Abfragen als Rückfall, wenn die Verbindung nicht steht ────────────────
  useEffect(() => {
    if (!isLoggedIn || !token) return;
    // Steht die Verbindung, wird nicht abgefragt. Genau dafür liefert
    // useChatSocket seinen Rückgabewert.
    if (wsVerbunden) return;

    const poll = async () => {
      if (isOnCommunity()) return; // ChatWindow is handling it
      if (document.visibilityState === 'hidden') return; // Tab im Hintergrund — nichts zu aktualisieren

      let added = 0;

      // ── PM Inbox ───────────────────────────────────────────────────────────
      try {
        const params = pmSince.current
          ? `?since=${encodeURIComponent(pmSince.current)}`
          : '';
        const res = await fetch(`/api/chat/pm-inbox${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json() as {
            senders: { sender_username: string; count?: number }[];
            server_time: string;
          };
          if (data.server_time) pmSince.current = data.server_time;
          if (params && data.senders.length > 0) {
            try {
              const existing: Record<string, number> = JSON.parse(localStorage.getItem('wh-pending-dm-unreads') ?? '{}');
              data.senders.forEach(s => {
                existing[s.sender_username] = (existing[s.sender_username] ?? 0) + (s.count ?? 1);
              });
              localStorage.setItem('wh-pending-dm-unreads', JSON.stringify(existing));
            } catch { /* ignore */ }
            added += data.senders.length;
          }
        }
      } catch { /* ignore */ }

      // ── All accessible chat channels ────────────────────────────────────────
      const channelUrls = buildChannelUrls(user, activeProfile.server ?? null);
      await Promise.all(channelUrls.map(async baseUrl => {
        try {
          const since = chanSince.current[baseUrl];
          if (!since) {
            // First call: establish baseline (don't count)
            const sep = baseUrl.includes('?') ? '&' : '?';
            const res = await fetch(`${baseUrl}${sep}limit=1`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const data = await res.json() as { messages: { created_at: string }[]; server_time?: string };
              chanSince.current[baseUrl] = data.messages.length > 0
                ? data.messages[data.messages.length - 1].created_at
                : (data.server_time ?? new Date().toISOString().replace('T', ' ').slice(0, 19));
            }
          } else {
            const sep = baseUrl.includes('?') ? '&' : '?';
            const res = await fetch(
              `${baseUrl}${sep}since=${encodeURIComponent(since)}&limit=50`,
              { headers: { Authorization: `Bearer ${token}` } },
            );
            if (res.ok) {
              const data = await res.json() as { messages: { created_at: string }[] };
              if (data.messages.length > 0) {
                chanSince.current[baseUrl] = data.messages[data.messages.length - 1].created_at;
                added += data.messages.length;
                // Record which channel has unread so ChatWindow can show the right tab dot
                try {
                  const unreads: Record<string, number> = JSON.parse(localStorage.getItem('wh-unread-channels') ?? '{}');
                  unreads[baseUrl] = (unreads[baseUrl] ?? 0) + data.messages.length;
                  localStorage.setItem('wh-unread-channels', JSON.stringify(unreads));
                } catch { /* ignore */ }
              }
            }
          }
        } catch { /* ignore */ }
      }));

      if (added > 0) applyCount(countRef.current + added);
    };

    poll();
    pollRef.current = setInterval(poll, POLL_MS);
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [isLoggedIn, token, user, activeProfile.server, applyCount, wsVerbunden]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
