// Invisible component — just keeps the user's last_seen alive while on any page.
// Renders nothing; add once to the global layout.

import { useEffect } from 'preact/hooks';
import { useAuth } from '../../hooks/useAuth';

const HEARTBEAT_MS = 60_000; // 1 minute

export default function PresenceHeartbeat() {
  const { token, isLoggedIn } = useAuth();

  useEffect(() => {
    if (!isLoggedIn || !token) return;

    const ping = () => {
      fetch('/api/presence', {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    };

    ping(); // immediate on mount
    const id = setInterval(ping, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [isLoggedIn, token]);

  return null;
}
