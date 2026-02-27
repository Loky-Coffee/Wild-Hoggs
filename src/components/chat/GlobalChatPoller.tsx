// Invisible component — runs on every page via Navigation.astro.
// When NOT on the community page: polls PM inbox + ALL accessible chat channels
// every 20 s and updates the nav badge (#community-badge) + document.title.
// When ON the community page: ChatWindow handles polling and dispatches
// 'wh:unread-count' events — this component just applies those counts.

import { useEffect, useRef, useCallback } from 'preact/hooks';
import { useAuth } from '../../hooks/useAuth';

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880,  ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.8, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
    // AudioContext auto-closes after sound ends (no leak)
    osc.onended = () => ctx.close();
  } catch { /* browser may block autoplay */ }
}

const POLL_MS = 20_000; // 20 s when not on community page

function isOnCommunity(): boolean {
  const p = window.location.pathname;
  return p === '/community/' || p.endsWith('/community/');
}

// All channel URLs the current user has access to
function buildChannelUrls(user: { language?: string | null; server?: string | null } | null): string[] {
  if (!user) return [];
  const lang   = user.language?.trim() || null;
  const server = user.server?.trim()   || null;
  const urls: string[] = ['/api/chat/global'];
  if (lang)          urls.push(`/api/chat/global?lang=${encodeURIComponent(lang)}`);
  if (server)        urls.push(`/api/chat/server/${encodeURIComponent(server)}`);
  if (server && lang) urls.push(`/api/chat/server/${encodeURIComponent(server)}?lang=${encodeURIComponent(lang)}`);
  return urls;
}

export default function GlobalChatPoller() {
  const { token, isLoggedIn, user } = useAuth();
  const notifSoundRef = useRef(user?.notification_sound ?? 1);
  useEffect(() => { notifSoundRef.current = user?.notification_sound ?? 1; }, [user?.notification_sound]);

  const pmSince    = useRef<string | null>(null);
  // Per-channel since timestamps keyed by base URL (without since/limit params)
  const chanSince  = useRef<Record<string, string>>({});
  const countRef   = useRef(0);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Apply count to DOM + document.title ───────────────────────────────────
  const applyCount = useCallback((n: number) => {
    if (n > countRef.current && notifSoundRef.current === 1) {
      playNotificationSound();
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

  // ── Background polling when NOT on community page ─────────────────────────
  useEffect(() => {
    if (!isLoggedIn || !token) return;

    const poll = async () => {
      if (isOnCommunity()) return; // ChatWindow is handling it

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
      const channelUrls = buildChannelUrls(user);
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
              const data = await res.json() as { messages: { created_at: string }[] };
              chanSince.current[baseUrl] = data.messages.length > 0
                ? data.messages[data.messages.length - 1].created_at
                : new Date().toISOString();
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
  }, [isLoggedIn, token, user, applyCount]);

  return null;
}
