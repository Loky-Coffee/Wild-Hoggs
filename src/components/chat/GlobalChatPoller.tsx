// Invisible component — runs on every page via Navigation.astro.
// When NOT on the community page: polls PM inbox + global chat every 20 s and
// updates the nav badge (#community-badge) + document.title.
// When ON the community page: ChatWindow handles polling and dispatches
// 'wh:unread-count' events — this component just applies those counts.

import { useEffect, useRef, useCallback } from 'preact/hooks';
import { useAuth } from '../../hooks/useAuth';

const POLL_MS = 20_000; // 20 s when not on community page

function isOnCommunity(): boolean {
  const p = window.location.pathname;
  return p === '/community/' || p.endsWith('/community/');
}

export default function GlobalChatPoller() {
  const { token, isLoggedIn } = useAuth();

  const pmSince   = useRef<string | null>(null);
  const chatSince = useRef<string | null>(null);
  const countRef  = useRef(0);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Apply count to DOM + document.title ───────────────────────────────────
  const applyCount = useCallback((n: number) => {
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
        // Reset since refs so GlobalChatPoller re-baselines after leaving
        pmSince.current   = null;
        chatSince.current = null;
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
            senders: { sender_username: string }[];
            server_time: string;
          };
          if (data.server_time) pmSince.current = data.server_time;
          // First call (no params) = baseline only, don't count
          if (params) added += data.senders.length;
        }
      } catch { /* ignore */ }

      // ── Global Chat ────────────────────────────────────────────────────────
      try {
        if (!chatSince.current) {
          // First call: get latest message as baseline
          const res = await fetch('/api/chat/global?limit=1', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json() as { messages: { created_at: string }[] };
            chatSince.current = data.messages.length > 0
              ? data.messages[data.messages.length - 1].created_at
              : new Date().toISOString();
          }
        } else {
          const since = encodeURIComponent(chatSince.current);
          const res = await fetch(`/api/chat/global?since=${since}&limit=50`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json() as { messages: { created_at: string }[] };
            if (data.messages.length > 0) {
              chatSince.current = data.messages[data.messages.length - 1].created_at;
              added += data.messages.length;
            }
          }
        }
      } catch { /* ignore */ }

      if (added > 0) applyCount(countRef.current + added);
    };

    poll();
    pollRef.current = setInterval(poll, POLL_MS);
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [isLoggedIn, token, applyCount]);

  return null;
}
