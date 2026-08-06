// Unsichtbare Komponente — hält last_seen am Leben, solange jemand irgendeine
// Seite offen hat. Rendert nichts, gehört einmal ins globale Layout.
//
// Die Antwort enthält gleich die vollständige Online-Liste (alle, die in den
// letzten 5 Minuten aktiv waren — auch auf anderen Seiten als dem Chat). Die
// wird per Ereignis weitergereicht, damit der Chat sie anzeigen kann, ohne
// selbst danach zu fragen.

import { useEffect } from 'preact/hooks';
import { useAuth } from '../../hooks/useAuth';

const HEARTBEAT_MS = 60_000; // 1 minute

export default function PresenceHeartbeat() {
  const { token, isLoggedIn } = useAuth();

  useEffect(() => {
    if (!isLoggedIn || !token) return;

    const ping = async () => {
      try {
        const res = await fetch('/api/presence', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json() as { users?: unknown[] };
        if (Array.isArray(data.users)) {
          window.dispatchEvent(new CustomEvent('wh-presence', { detail: data.users }));
        }
      } catch { /* ignore */ }
    };

    ping(); // immediate on mount
    const id = setInterval(ping, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [isLoggedIn, token]);

  return null;
}
