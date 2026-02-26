import { useState, useEffect } from 'preact/hooks';
import { useAuth, setAuthState, clearAuthState } from '../../hooks/useAuth';
import type { AuthUser } from '../../hooks/useAuth';
import './ProfilePage.css';

// ── Calculator state reader (Phase 1 + Phase 2 format) ──────────────────────
function readCalcState<T>(calcType: string, calcKey = 'main'): T | null {
  try {
    const key = `wh-calc-${calcType}${calcKey !== 'main' ? `-${calcKey}` : ''}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'state' in parsed && 'lastSyncedAt' in parsed) {
      return parsed.state as T;
    }
    return parsed as T;
  } catch { return null; }
}

const RESEARCH_IDS = [
  'alliance_recognition', 'unit_special_training', 'fully_armed_alliance',
  'field', 'hero_training', 'military_strategies',
  'peace_shield', 'siege_to_seize', 'army_building',
];

const FACTION_LABELS: Record<string, { label: string; icon: string }> = {
  'blood-rose':     { label: 'Blood Rose',     icon: '🩸' },
  'wings-of-dawn':  { label: 'Wings of Dawn',  icon: '🦅' },
  'guard-of-order': { label: 'Guard of Order', icon: '⚖️' },
};

function getLangFromPath(): string {
  const [, first] = window.location.pathname.split('/');
  const langs = ['de','fr','ko','th','ja','pt','es','tr','id','zh-TW','zh-CN','it','ar','vi'];
  return langs.includes(first) ? first : 'en';
}

export default function ProfilePage() {
  const { user, token, isLoggedIn } = useAuth();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [username, setUsername]           = useState('');
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameMsg, setUsernameMsg]     = useState<{ type: 'error' | 'ok'; text: string } | null>(null);

  const [server, setServer]               = useState('');
  const [serverSaving, setServerSaving]   = useState(false);
  const [serverMsg, setServerMsg]         = useState<{ type: 'error' | 'ok'; text: string } | null>(null);

  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [pwSaving, setPwSaving]     = useState(false);
  const [pwMsg, setPwMsg]           = useState<{ type: 'error' | 'ok'; text: string } | null>(null);

  const [factionSaving, setFactionSaving] = useState(false);

  useEffect(() => {
    if (user?.username) setUsername(user.username);
    if (user?.server !== undefined) setServer(user.server ?? '');
  }, [user?.username, user?.server]);

  // ── Calculator stats ───────────────────────────────────────────────────────
  interface TankState   { unlockedLevels: number[]; subLevels: Record<string,number> }
  interface BuildState  { selectedBuilding: string | null; currentLevel: number; targetLevel: number }
  interface CaravanSt   { powerInput: string; yourFaction: string | null }
  interface HeroExpSt   { currentLevel: number; targetLevel: number }
  interface ResearchSt  { selectedTechnologies: Record<string, number> }

  const tankState     = readCalcState<TankState>('tank');
  const buildingState = readCalcState<BuildState>('building');
  const caravanState  = readCalcState<CaravanSt>('caravan');
  const heroExpState  = readCalcState<HeroExpSt>('hero-exp');

  const researchStats = RESEARCH_IDS.reduce(
    (acc, id) => {
      const s = readCalcState<ResearchSt>('research', id);
      if (s?.selectedTechnologies) {
        const count = Object.values(s.selectedTechnologies).filter(v => v > 0).length;
        if (count > 0) { acc.categories++; acc.technologies += count; }
      }
      return acc;
    },
    { categories: 0, technologies: 0 }
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
  const patchProfile = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Fehler');
    setAuthState(data as AuthUser, token!);
    return data as AuthUser;
  };

  const handleSaveServer = async () => {
    if (!token) return;
    setServerSaving(true); setServerMsg(null);
    try {
      await patchProfile({ server: server.trim() || null });
      setServerMsg({ type: 'ok', text: '✓ Gespeichert' });
      setTimeout(() => setServerMsg(null), 3000);
    } catch (e: any) {
      setServerMsg({ type: 'error', text: e.message });
    } finally { setServerSaving(false); }
  };

  const handleSaveUsername = async () => {
    if (!token || username.trim() === user?.username) return;
    setUsernameSaving(true); setUsernameMsg(null);
    try {
      await patchProfile({ username: username.trim() });
      setUsernameMsg({ type: 'ok', text: '✓ Gespeichert' });
      setTimeout(() => setUsernameMsg(null), 3000);
    } catch (e: any) {
      setUsernameMsg({ type: 'error', text: e.message });
    } finally { setUsernameSaving(false); }
  };

  const handleFactionChange = async (faction: string | null) => {
    if (!token) return;
    setFactionSaving(true);
    try { await patchProfile({ faction }); }
    catch { /* ignore */ }
    finally { setFactionSaving(false); }
  };

  const handleChangePassword = async (e: Event) => {
    e.preventDefault();
    if (!token) return;
    if (newPw !== confirmPw) { setPwMsg({ type: 'error', text: 'Passwörter stimmen nicht überein' }); return; }
    setPwSaving(true); setPwMsg(null);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) { setPwMsg({ type: 'error', text: data.error ?? 'Fehler' }); return; }
      setPwMsg({ type: 'ok', text: '✓ Passwort geändert' });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => setPwMsg(null), 4000);
    } catch { setPwMsg({ type: 'error', text: 'Verbindungsfehler' }); }
    finally { setPwSaving(false); }
  };

  const handleLogout = async () => {
    try {
      if (token) await fetch('/api/auth/logout', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    } catch { /* ignore */ }
    clearAuthState();
    const lang = getLangFromPath();
    window.location.href = lang === 'en' ? '/' : `/${lang}/`;
  };

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!isLoggedIn || !user) {
    return (
      <div class="pp-not-logged-in">
        <div class="pp-lock">🔒</div>
        <p>Du bist nicht eingeloggt. Bitte melde dich an.</p>
      </div>
    );
  }

  // ── Profile UI ─────────────────────────────────────────────────────────────
  return (
    <div class="pp-wrap">

      {/* ── User Card ── */}
      <div class="pp-card pp-user-card">
        <div class="pp-avatar">⚔️</div>
        <div class="pp-user-info">
          <h1 class="pp-username">{user.username}</h1>
          <p class="pp-email">{user.email}</p>
          <div class="pp-user-tags">
            {user.server && (
              <span class="pp-server-tag">🖥️ Server {user.server}</span>
            )}
            {user.faction && (
              <span class={`pp-faction-tag pp-faction-${user.faction}`}>
                {FACTION_LABELS[user.faction]?.icon} {FACTION_LABELS[user.faction]?.label}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Faction ── */}
      <div class="pp-card">
        <h2 class="pp-section-title">Faction</h2>
        <div class="pp-faction-row">
          {Object.entries(FACTION_LABELS).map(([key, { label, icon }]) => (
            <button
              key={key}
              class={`pp-faction-btn pp-faction-${key}${user.faction === key ? ' active' : ''}`}
              onClick={() => handleFactionChange(user.faction === key ? null : key)}
              disabled={factionSaving}
            >
              <span class="pp-faction-icon">{icon}</span>
              <span class="pp-faction-name">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Calculator Progress ── */}
      <div class="pp-card">
        <h2 class="pp-section-title">Calculator-Fortschritt</h2>
        <div class="pp-stats-grid">
          <div class="pp-stat">
            <span class="pp-stat-icon">🔧</span>
            <div>
              <div class="pp-stat-label">Tank</div>
              <div class="pp-stat-val">
                {tankState ? `${tankState.unlockedLevels.length} Levels freigeschaltet` : '—'}
              </div>
            </div>
          </div>
          <div class="pp-stat">
            <span class="pp-stat-icon">🎖️</span>
            <div>
              <div class="pp-stat-label">Research</div>
              <div class="pp-stat-val">
                {researchStats.categories > 0
                  ? `${researchStats.categories} Kategorien · ${researchStats.technologies} Technologien`
                  : '—'}
              </div>
            </div>
          </div>
          <div class="pp-stat">
            <span class="pp-stat-icon">🏗️</span>
            <div>
              <div class="pp-stat-label">Building</div>
              <div class="pp-stat-val">
                {buildingState?.selectedBuilding
                  ? `Level ${buildingState.currentLevel} → ${buildingState.targetLevel}`
                  : '—'}
              </div>
            </div>
          </div>
          <div class="pp-stat">
            <span class="pp-stat-icon">🐪</span>
            <div>
              <div class="pp-stat-label">Caravan</div>
              <div class="pp-stat-val">
                {caravanState?.yourFaction
                  ? `${FACTION_LABELS[caravanState.yourFaction]?.icon ?? ''} ${caravanState.powerInput || '—'}`
                  : '—'}
              </div>
            </div>
          </div>
          <div class="pp-stat">
            <span class="pp-stat-icon">🦸</span>
            <div>
              <div class="pp-stat-label">Hero EXP</div>
              <div class="pp-stat-val">
                {heroExpState?.currentLevel
                  ? `Lvl ${heroExpState.currentLevel} → ${heroExpState.targetLevel}`
                  : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Settings ── */}
      <div class="pp-card">
        <h2 class="pp-section-title">Einstellungen</h2>

        {/* Server */}
        <div class="pp-setting-block">
          <label class="pp-setting-label">Server</label>
          <div class="pp-input-row">
            <input
              class="pp-input"
              type="text"
              placeholder="z.B. 395"
              value={server}
              onInput={e => setServer((e.target as HTMLInputElement).value)}
              maxLength={10}
              autocomplete="off"
            />
            <button
              class="pp-btn-save"
              onClick={handleSaveServer}
              disabled={serverSaving || server.trim() === (user.server ?? '')}
            >
              {serverSaving ? '…' : 'Speichern'}
            </button>
          </div>
          {serverMsg && <p class={`pp-msg pp-msg-${serverMsg.type}`}>{serverMsg.text}</p>}
        </div>

        {/* Username */}
        <div class="pp-setting-block">
          <label class="pp-setting-label">Username</label>
          <div class="pp-input-row">
            <input
              class="pp-input"
              type="text"
              value={username}
              onInput={e => setUsername((e.target as HTMLInputElement).value)}
              minLength={3}
              maxLength={20}
              autocomplete="username"
            />
            <button
              class="pp-btn-save"
              onClick={handleSaveUsername}
              disabled={usernameSaving || username.trim() === user.username || username.trim().length < 3}
            >
              {usernameSaving ? '…' : 'Speichern'}
            </button>
          </div>
          {usernameMsg && <p class={`pp-msg pp-msg-${usernameMsg.type}`}>{usernameMsg.text}</p>}
        </div>

        {/* Password */}
        <div class="pp-setting-block">
          <label class="pp-setting-label">Passwort ändern</label>
          <form class="pp-pw-form" onSubmit={handleChangePassword}>
            <input
              class="pp-input"
              type="password"
              placeholder="Aktuelles Passwort"
              value={currentPw}
              onInput={e => setCurrentPw((e.target as HTMLInputElement).value)}
              required
              autocomplete="current-password"
            />
            <input
              class="pp-input"
              type="password"
              placeholder="Neues Passwort (min. 8 Zeichen)"
              value={newPw}
              onInput={e => setNewPw((e.target as HTMLInputElement).value)}
              required
              minLength={8}
              autocomplete="new-password"
            />
            <input
              class="pp-input"
              type="password"
              placeholder="Neues Passwort bestätigen"
              value={confirmPw}
              onInput={e => setConfirmPw((e.target as HTMLInputElement).value)}
              required
              autocomplete="new-password"
            />
            {pwMsg && <p class={`pp-msg pp-msg-${pwMsg.type}`}>{pwMsg.text}</p>}
            <button class="pp-btn-save" type="submit" disabled={pwSaving}>
              {pwSaving ? '…' : 'Passwort ändern'}
            </button>
          </form>
        </div>
      </div>

      {/* ── Logout ── */}
      <div class="pp-card pp-logout-card">
        <button class="pp-btn-logout" onClick={handleLogout}>
          Abmelden
        </button>
      </div>

    </div>
  );
}
