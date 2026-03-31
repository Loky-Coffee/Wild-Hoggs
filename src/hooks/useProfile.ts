import { useState, useEffect } from 'preact/hooks';
import { useAuth } from './useAuth';
import { AUTH_TOKEN_KEY } from './useAuth';

export interface GameProfile {
  id: string;
  name: string;
  server: string | null;
  faction: string | null;
  formation_power_br: number | null;
  formation_power_wd: number | null;
  formation_power_go: number | null;
}

const ACTIVE_PROFILE_KEY = 'wh-active-profile';

// Local (non-logged-in) default profile
const LOCAL_PROFILE: GameProfile = { id: 'local', name: 'Standard', server: null, faction: null, formation_power_br: null, formation_power_wd: null, formation_power_go: null };

// --- Module-level reactive active profile ---
// Shared across all hook instances via custom event
function getStoredProfileId(): string {
  return (typeof localStorage !== 'undefined' && localStorage.getItem(ACTIVE_PROFILE_KEY)) || 'local';
}

export function broadcastProfileChange(profileId: string) {
  localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
  window.dispatchEvent(new CustomEvent('wh-profile-change', { detail: { profileId } }));
}

export function useProfile() {
  const { token, isLoggedIn } = useAuth();

  const [profiles, setProfiles] = useState<GameProfile[]>([LOCAL_PROFILE]);
  const [activeProfileId, setActiveProfileId] = useState<string>(() => getStoredProfileId());
  const [loading, setLoading] = useState(false);

  // Load profiles when logged in
  useEffect(() => {
    if (!isLoggedIn) {
      setProfiles([LOCAL_PROFILE]);
      setActiveProfileId('local');
      return;
    }

    const t = token ?? localStorage.getItem(AUTH_TOKEN_KEY);
    if (!t) return;

    setLoading(true);
    fetch('/api/profiles', { headers: { 'Authorization': `Bearer ${t}` } })
      .then(r => r.ok ? r.json() as Promise<GameProfile[]> : null)
      .then(data => {
        if (!data || data.length === 0) return;
        setProfiles(data);

        // Restore previously active profile if still valid
        const stored = localStorage.getItem(ACTIVE_PROFILE_KEY);
        const valid = stored && data.some(p => p.id === stored);
        const activeId = valid ? stored! : data[0].id;
        setActiveProfileId(activeId);
        localStorage.setItem(ACTIVE_PROFILE_KEY, activeId);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isLoggedIn, token]);

  // Listen for profile changes from other components
  useEffect(() => {
    const handler = (e: Event) => {
      const { profileId } = (e as CustomEvent<{ profileId: string }>).detail;
      setActiveProfileId(profileId);
    };
    window.addEventListener('wh-profile-change', handler);
    return () => window.removeEventListener('wh-profile-change', handler);
  }, []);

  // Clear active profile on logout
  useEffect(() => {
    if (!isLoggedIn) {
      setActiveProfileId('local');
      localStorage.removeItem(ACTIVE_PROFILE_KEY);
    }
  }, [isLoggedIn]);

  const activeProfile = profiles.find(p => p.id === activeProfileId) ?? profiles[0] ?? LOCAL_PROFILE;

  function switchProfile(profileId: string) {
    broadcastProfileChange(profileId);
  }

  async function createProfile(name: string, server?: string, faction?: string): Promise<GameProfile | null> {
    const t = token ?? localStorage.getItem(AUTH_TOKEN_KEY);
    if (!t) return null;
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` },
        body: JSON.stringify({ name, server: server || null, faction: faction || null })
      });
      if (!res.ok) return null;
      const newProfile: GameProfile = await res.json();
      setProfiles(prev => [...prev, newProfile]);
      return newProfile;
    } catch { return null; }
  }

  async function updateProfile(profileId: string, patch: { name?: string; server?: string | null; faction?: string | null }): Promise<boolean> {
    const t = token ?? localStorage.getItem(AUTH_TOKEN_KEY);
    if (!t) return false;
    try {
      const res = await fetch(`/api/profiles/${profileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` },
        body: JSON.stringify(patch)
      });
      if (!res.ok) return false;
      setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, ...patch } : p));
      return true;
    } catch { return false; }
  }

  async function deleteProfile(profileId: string): Promise<boolean> {
    const t = token ?? localStorage.getItem(AUTH_TOKEN_KEY);
    if (!t) return false;
    try {
      const res = await fetch(`/api/profiles/${profileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${t}` }
      });
      if (!res.ok) return false;
      const remaining = profiles.filter(p => p.id !== profileId);
      setProfiles(remaining);
      // If deleted active profile, switch to first remaining
      if (activeProfileId === profileId && remaining.length > 0) {
        broadcastProfileChange(remaining[0].id);
      }
      return true;
    } catch { return false; }
  }

  return {
    profiles,
    activeProfile,
    loading,
    switchProfile,
    createProfile,
    updateProfile,
    deleteProfile,
  };
}
