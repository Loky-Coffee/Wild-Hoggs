import { useState, useRef, useEffect } from 'preact/hooks';
import { useAuth, setAuthState, clearAuthState } from '../../hooks/useAuth';
import type { AuthUser } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData } from '../../i18n/index';
import { StatsOverview, AccountTab, ProfilesList, type UserStats } from './ProfileTabs';
import './ProfilePage.css';

interface ProfilePageProps {
  translationData: TranslationData;
}

type Tab = 'overview' | 'profiles' | 'settings' | 'account';

// ── Calculator state reader — profile-aware ──────────────────────────────────
function readCalcState<T>(profileId: string, calcType: string, calcKey = 'main'): T | null {
  try {
    // Key format must match useCalculatorState's cacheKey():
    // wh-calc-{profileId}-{calcType}[-{calcKey}]  (calcKey omitted when === 'main')
    const key = `wh-calc-${profileId}-${calcType}${calcKey !== 'main' ? `-${calcKey}` : ''}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'state' in parsed) {
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

function parseFormationPower(input: string): number | null {
  let s = input.trim().toLowerCase().replace(/\s/g, '');
  if (!s) return null;
  let multiplier = 1;
  if (s.endsWith('m')) { multiplier = 1_000_000; s = s.slice(0, -1); }
  else if (s.endsWith('k')) { multiplier = 1_000; s = s.slice(0, -1); }
  const n = parseFloat(s.replace(',', '.'));
  if (isNaN(n) || n <= 0) return null;
  return Math.round(n * multiplier);
}

const FACTION_IMG: Record<string, string> = {
  'blood-rose':     '/images/heroes/symbols/blood-rose.webp',
  'wings-of-dawn':  '/images/heroes/symbols/wings-of-dawn.webp',
  'guard-of-order': '/images/heroes/symbols/guard-of-order.webp',
};

function getLangFromPath(): string {
  const [, first] = window.location.pathname.split('/');
  const langs = ['de','fr','ko','th','ja','pt','es','tr','id','zh-TW','zh-CN','it','ar','vi'];
  return langs.includes(first) ? first : 'en';
}

export default function ProfilePage({ translationData }: ProfilePageProps) {
  const t = useTranslations(translationData);
  const { user, token, isLoggedIn } = useAuth();
  const { profiles, activeProfile, updateProfile, createProfile, deleteProfile, switchProfile } = useProfile();

  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<UserStats | null>(null);

  // Kennzahlen fuer die Uebersicht — einmal beim Oeffnen.
  useEffect(() => {
    if (!token) return;
    fetch('/api/user/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStats(d as UserStats); })
      .catch(() => {});
  }, [token]);

  // ── Account form state ─────────────────────────────────────────────────────
  const [username, setUsername]           = useState('');
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameMsg, setUsernameMsg]     = useState<{ type: 'error' | 'ok'; text: string } | null>(null);

  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [pwSaving, setPwSaving]     = useState(false);
  const [pwMsg, setPwMsg]           = useState<{ type: 'error' | 'ok'; text: string } | null>(null);

  const [notifSound,        setNotifSound]        = useState(1);
  const [notifSoundSaving,  setNotifSoundSaving]  = useState(false);
  const [notifVolume,       setNotifVolume]       = useState(1.5);
  const [notifVolumeSaving, setNotifVolumeSaving] = useState(false);

  // ── Profile form state (per active profile) ────────────────────────────────
  const [server, setServer]           = useState('');
  const [serverSaving, setServerSaving] = useState(false);
  const [serverMsg, setServerMsg]     = useState<{ type: 'error' | 'ok'; text: string } | null>(null);

  const [selectedFaction, setSelectedFaction] = useState<string | null>(null);
  const [formationBr, setFormationBr] = useState('');
  const [formationWd, setFormationWd] = useState('');
  const [formationGo, setFormationGo] = useState('');
  const [factionSaving, setFactionSaving] = useState(false);
  const [factionMsg, setFactionMsg] = useState<{ type: 'error' | 'ok'; text: string } | null>(null);

  // Sync account fields from user
  useEffect(() => {
    if (user?.username) setUsername(user.username);
    setNotifSound(user?.notification_sound ?? 1);
    setNotifVolume(user?.notification_volume ?? 1.5);
  }, [user?.username, user?.notification_sound, user?.notification_volume]);

  // Sync profile fields from active profile
  useEffect(() => {
    setServer(activeProfile.server ?? '');
    setSelectedFaction(activeProfile.faction ?? null);
    setFormationBr(activeProfile.formation_power_br ? String(activeProfile.formation_power_br) : '');
    setFormationWd(activeProfile.formation_power_wd ? String(activeProfile.formation_power_wd) : '');
    setFormationGo(activeProfile.formation_power_go ? String(activeProfile.formation_power_go) : '');
  }, [activeProfile.id, activeProfile.server, activeProfile.faction, activeProfile.formation_power_br, activeProfile.formation_power_wd, activeProfile.formation_power_go]);

  // ── Calculator stats — read from active profile's localStorage ─────────────
  interface TankState   { unlockedLevels: number[]; subLevels: Record<string,number> }
  interface BuildState  { selectedBuilding: string | null; currentLevel: number; targetLevel: number }
  interface CaravanSt   { powerInput: string; yourFaction: string | null }
  interface HeroExpSt   { currentLevel: number; targetLevel: number }
  interface ResearchSt  { selectedTechnologies: Record<string, number> }

  const pid = activeProfile.id;
  const tankState     = readCalcState<TankState>(pid, 'tank');
  const buildingState = readCalcState<BuildState>(pid, 'building');
  const caravanState  = readCalcState<CaravanSt>(pid, 'caravan');
  const heroExpState  = readCalcState<HeroExpSt>(pid, 'hero-exp');

  const researchStats = RESEARCH_IDS.reduce(
    (acc, id) => {
      const s = readCalcState<ResearchSt>(pid, 'research', id);
      if (s?.selectedTechnologies) {
        const count = Object.values(s.selectedTechnologies).filter(v => v > 0).length;
        if (count > 0) { acc.categories++; acc.technologies += count; }
      }
      return acc;
    },
    { categories: 0, technologies: 0 }
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
  const patchAccount = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? t('profile.errorGeneric'));
    setAuthState(data as AuthUser, token!);
    return data as AuthUser;
  };

  const handleSaveServer = async () => {
    setServerSaving(true); setServerMsg(null);
    const ok = await updateProfile(activeProfile.id, { server: server.trim() || null });
    if (ok) {
      setServerMsg({ type: 'ok', text: t('profile.saved') });
      setTimeout(() => setServerMsg(null), 3000);
    } else {
      setServerMsg({ type: 'error', text: t('profile.errorGeneric') });
    }
    setServerSaving(false);
  };

  const handleToggleNotifSound = async () => {
    if (!token) return;
    const next = notifSound === 1 ? 0 : 1;
    setNotifSoundSaving(true);
    try {
      await patchAccount({ notification_sound: next });
      setNotifSound(next);
    } catch { /* ignore */ } finally { setNotifSoundSaving(false); }
  };

  // Der Zeitgeber muss einen Render ueberleben. Als einfache Variable im
  // Komponentenrumpf entstand er bei jedem Render neu mit null, sodass das
  // clearTimeout unten nie etwas fand — ein Zug ueber den Regler schickte fuer
  // jeden Zwischenwert ein eigenes PATCH, und deren Antworten konnten sich
  // ueberholen.
  const volumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleVolumeChange = (val: number) => {
    setNotifVolume(val);
    if (volumeTimer.current) clearTimeout(volumeTimer.current);
    volumeTimer.current = setTimeout(async () => {
      if (!token) return;
      setNotifVolumeSaving(true);
      try { await patchAccount({ notification_volume: val }); }
      catch { /* ignore */ } finally { setNotifVolumeSaving(false); }
    }, 500);
  };

  const handleSaveUsername = async () => {
    if (!token || username.trim() === user?.username) return;
    setUsernameSaving(true); setUsernameMsg(null);
    try {
      await patchAccount({ username: username.trim() });
      setUsernameMsg({ type: 'ok', text: t('profile.saved') });
      setTimeout(() => setUsernameMsg(null), 3000);
    } catch (e: any) {
      setUsernameMsg({ type: 'error', text: e.message });
    } finally { setUsernameSaving(false); }
  };

  const handleSaveFactions = async () => {
    setFactionSaving(true); setFactionMsg(null);
    try {
      const parseField = (s: string): number | null => {
        if (!s.trim()) return null;
        const n = parseFormationPower(s);
        if (n === null) throw new Error('Ungültiger Wert: ' + s.trim());
        return n;
      };
      const ok = await updateProfile(activeProfile.id, {
        faction: selectedFaction,
        formation_power_br: parseField(formationBr),
        formation_power_wd: parseField(formationWd),
        formation_power_go: parseField(formationGo),
      });
      if (ok) {
        setFactionMsg({ type: 'ok', text: t('profile.saved') });
        setTimeout(() => setFactionMsg(null), 3000);
      } else {
        setFactionMsg({ type: 'error', text: t('profile.errorGeneric') });
      }
    } catch (e: any) {
      setFactionMsg({ type: 'error', text: e.message });
    } finally { setFactionSaving(false); }
  };

  const handleChangePassword = async (e: Event) => {
    e.preventDefault();
    if (!token) return;
    if (newPw !== confirmPw) { setPwMsg({ type: 'error', text: t('profile.passwordMismatch') }); return; }
    setPwSaving(true); setPwMsg(null);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) { setPwMsg({ type: 'error', text: data.error ?? t('profile.errorGeneric') }); return; }
      // Beim Ändern werden alle anderen Anmeldungen beendet. Wie viele es
      // waren, gehört in die Rückmeldung: Wer eine unerwartete Zahl sieht,
      // weiss, dass jemand anderes eingeloggt war.
      const abgemeldet = Number(data?.signedOutDevices ?? 0);
      setPwMsg({
        type: 'ok',
        text: abgemeldet > 0
          ? `${t('profile.passwordChanged')} ${t('profile.devicesSignedOut', { n: String(abgemeldet) })}`
          : t('profile.passwordChanged'),
      });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => setPwMsg(null), 6000);
    } catch { setPwMsg({ type: 'error', text: t('profile.errorConnection') }); }
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
        <p>{t('auth.notLoggedIn')}</p>
      </div>
    );
  }

  // ── Profile UI ─────────────────────────────────────────────────────────────
  return (
    <div class="pp-wrap">

      {/* ── User Card ── */}
      <div class="pp-card pp-user-card">
        <div class="pp-user-info">
          <h1 class="pp-username">{user.username}</h1>
          <p class="pp-email">{user.email}</p>
          <div class="pp-user-tags">
            {activeProfile.server && (
              <span class="pp-server-tag">🖥️ {t('profile.serverTag', { server: activeProfile.server })}</span>
            )}
            {activeProfile.faction && (
              <span class={`pp-faction-tag pp-faction-${activeProfile.faction}`}>
                <img src={FACTION_IMG[activeProfile.faction]} alt={`${FACTION_LABELS[activeProfile.faction]?.label} faction`} class="pp-faction-tag-img" />
                {FACTION_LABELS[activeProfile.faction]?.label}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div class="pp-tabs" role="tablist">
        {([
          { id: 'overview', label: t('profile.tab.overview'), icon: '📊' },
          { id: 'profiles', label: t('profile.tab.profiles'), icon: '🎮' },
          { id: 'settings', label: t('profile.tab.settings'), icon: '⚙️' },
          { id: 'account',  label: t('profile.tab.account'),  icon: '🔐' },
        ] as const).map(x => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={tab === x.id}
            class={`pp-tab${tab === x.id ? ' pp-tab-on' : ''}`}
            onClick={() => setTab(x.id)}
          >
            <span aria-hidden="true">{x.icon}</span> {x.label}
          </button>
        ))}
      </div>

      {/* ── Übersicht ── */}
      {tab === 'overview' && (
        <>
          <div class="pp-card">
            <h2 class="pp-section-title">{t('profile.tab.overview')}</h2>
            <StatsOverview stats={stats} lang={getLangFromPath()} translationData={translationData} />
          </div>
      {/* ── Calculator Progress ── */}
      <div class="pp-card">
        <h2 class="pp-section-title">{t('profile.progress')}</h2>
        <div class="pp-stats-grid">
          <div class="pp-stat">
            <span class="pp-stat-icon">🔧</span>
            <div>
              <div class="pp-stat-label">{t('profile.stat.tank')}</div>
              <div class="pp-stat-val">
                {tankState?.unlockedLevels?.length
                  ? t('profile.stat.tankLevels', { level: String(Math.max(...tankState.unlockedLevels)) })
                  : '—'}
              </div>
            </div>
          </div>
          <div class="pp-stat">
            <span class="pp-stat-icon">🎖️</span>
            <div>
              <div class="pp-stat-label">{t('profile.stat.research')}</div>
              <div class="pp-stat-val">
                {researchStats.categories > 0
                  ? t('profile.stat.researchStats', {
                      categories: String(researchStats.categories),
                      technologies: String(researchStats.technologies),
                    })
                  : '—'}
              </div>
            </div>
          </div>
          <div class="pp-stat">
            <span class="pp-stat-icon">🏗️</span>
            <div>
              <div class="pp-stat-label">{t('profile.stat.building')}</div>
              <div class="pp-stat-val">
                {buildingState?.selectedBuilding
                  ? t('profile.stat.buildingLevel', {
                      current: String(buildingState.currentLevel),
                      target: String(buildingState.targetLevel),
                    })
                  : '—'}
              </div>
            </div>
          </div>
          <div class="pp-stat">
            <span class="pp-stat-icon">🐪</span>
            <div>
              <div class="pp-stat-label">{t('profile.stat.caravan')}</div>
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
              <div class="pp-stat-label">{t('profile.stat.heroExp')}</div>
              <div class="pp-stat-val">
                {heroExpState?.currentLevel
                  ? t('profile.stat.heroLevel', {
                      current: String(heroExpState.currentLevel),
                      target: String(heroExpState.targetLevel),
                    })
                  : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>

        </>
      )}

      {/* ── Spielprofile ── */}
      {tab === 'profiles' && (
        <>
          <div class="pp-card">
            <h2 class="pp-section-title">{t('profile.tab.profiles')}</h2>
            <p class="pp-hint">{t('profile.profiles.hint')}</p>
            <ProfilesList
              profiles={profiles}
              activeId={activeProfile.id}
              translationData={translationData}
              onSwitch={switchProfile}
              onCreate={async (name, srv) => { await createProfile(name, srv || undefined); }}
              onDelete={async (id) => { await deleteProfile(id); }}
            />
          </div>

          <div class="pp-card">
            <h2 class="pp-section-title">{t('profile.serverLabel')}</h2>
        {/* Server */}
        <div class="pp-setting-block">
          <label class="pp-setting-label">{t('profile.serverLabel')}</label>
          <div class="pp-input-row">
            <input
              class="pp-input"
              type="text"
              placeholder={t('profile.serverPlaceholder')}
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
              {serverSaving ? t('profile.saving') : t('profile.save')}
            </button>
          </div>
          {serverMsg && <p class={`pp-msg pp-msg-${serverMsg.type}`}>{serverMsg.text}</p>}
        </div>

          </div>

      {/* ── Fraktion & Formations-Stärke ──
          Kompakt gehalten: Das trägt man einmal ein, danach liest es nur noch
          der Karawanen-Rechner aus. Früher nahmen drei bildschirmbreite Karten
          dafür fast den halben Bildschirm ein. */}
      <div class="pp-card">
        <h2 class="pp-section-title">{t('profile.faction')}</h2>

        <div class="pp-setting-block">
          <label class="pp-setting-label">{t('profile.faction.setMain')}</label>
          <div class="pp-faction-pick">
            {(['blood-rose', 'wings-of-dawn', 'guard-of-order'] as const).map(key => (
              <button
                key={key}
                type="button"
                class={`pp-fpick pp-fpick-${key}${selectedFaction === key ? ' pp-fpick-on' : ''}`}
                onClick={() => setSelectedFaction(selectedFaction === key ? null : key)}
                disabled={factionSaving}
                aria-pressed={selectedFaction === key}
              >
                <img src={FACTION_IMG[key]} alt="" class="pp-fpick-img" width={28} height={28} />
                <span>{FACTION_LABELS[key].label}</span>
              </button>
            ))}
          </div>
        </div>

        <div class="pp-setting-block">
          <label class="pp-setting-label">{t('profile.formations')}</label>
          <p class="pp-hint">{t('profile.formations.hint')}</p>
          <div class="pp-fpower-row">
            {([
              { key: 'blood-rose',     field: formationBr, setter: setFormationBr },
              { key: 'wings-of-dawn',  field: formationWd, setter: setFormationWd },
              { key: 'guard-of-order', field: formationGo, setter: setFormationGo },
            ] as const).map(({ key, field, setter }) => (
              <label key={key} class="pp-fpower">
                <img src={FACTION_IMG[key]} alt={FACTION_LABELS[key].label} width={20} height={20} />
                <input
                  class="pp-input"
                  type="text"
                  placeholder={t('profile.formations.placeholder')}
                  value={field}
                  onInput={e => setter((e.target as HTMLInputElement).value)}
                />
              </label>
            ))}
          </div>
        </div>

        <div class="pp-formations-footer">
          {factionMsg && <p class={`pp-msg pp-msg-${factionMsg.type}`}>{factionMsg.text}</p>}
          <button class="pp-btn-save" onClick={handleSaveFactions} disabled={factionSaving}>
            {factionSaving ? t('profile.saving') : t('profile.save')}
          </button>
        </div>
      </div>

        </>
      )}

      {/* ── Einstellungen ── */}
      {tab === 'settings' && (
        <div class="pp-card">
        <h2 class="pp-section-title">{t('profile.settings')}</h2>

        {/* Username */}
        <div class="pp-setting-block">
          <label class="pp-setting-label">{t('profile.usernameLabel')}</label>
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
              {usernameSaving ? t('profile.saving') : t('profile.save')}
            </button>
          </div>
          {usernameMsg && <p class={`pp-msg pp-msg-${usernameMsg.type}`}>{usernameMsg.text}</p>}
        </div>

        {/* Notification Sound */}
        <div class="pp-setting-block">
          <label class="pp-setting-label">{t('profile.notificationSound')}</label>
          <button
            class={`pp-notif-toggle${notifSound === 1 ? ' pp-notif-toggle-on' : ''}`}
            onClick={handleToggleNotifSound}
            disabled={notifSoundSaving}
          >
            <span class="pp-notif-toggle-dot" />
            <span class="pp-notif-toggle-label">
              {notifSound === 1 ? t('profile.notificationSoundOn') : t('profile.notificationSoundOff')}
            </span>
          </button>
        </div>

        {/* Notification Volume */}
        <div class={`pp-setting-block${notifSound === 0 ? ' pp-setting-block-muted' : ''}`}>
          <label class="pp-setting-label">{t('profile.notificationVolume')} — {notifVolume.toFixed(1)}</label>
          <input
            type="range"
            class="pp-notif-volume-slider"
            min="0.1"
            max="2.0"
            step="0.1"
            value={notifVolume}
            onInput={e => handleVolumeChange(parseFloat((e.target as HTMLInputElement).value))}
            disabled={notifVolumeSaving}
          />
        </div>

        {/* Password */}
        <div class="pp-setting-block">
          <label class="pp-setting-label">{t('profile.changePassword')}</label>
          <form class="pp-pw-form" onSubmit={handleChangePassword}>
            {/* Hidden username — required by browsers/password managers for autocomplete */}
            <input type="text" name="username" autocomplete="username" value={user.username} style="display:none" aria-hidden="true" readOnly />
            <input
              class="pp-input"
              type="password"
              placeholder={t('profile.currentPassword')}
              value={currentPw}
              onInput={e => setCurrentPw((e.target as HTMLInputElement).value)}
              required
              autocomplete="current-password"
            />
            <input
              class="pp-input"
              type="password"
              placeholder={t('profile.newPassword')}
              value={newPw}
              onInput={e => setNewPw((e.target as HTMLInputElement).value)}
              required
              minLength={8}
              autocomplete="new-password"
            />
            <input
              class="pp-input"
              type="password"
              placeholder={t('profile.confirmPassword')}
              value={confirmPw}
              onInput={e => setConfirmPw((e.target as HTMLInputElement).value)}
              required
              autocomplete="new-password"
            />
            {pwMsg && <p class={`pp-msg pp-msg-${pwMsg.type}`}>{pwMsg.text}</p>}
            <button class="pp-btn-save" type="submit" disabled={pwSaving}>
              {pwSaving ? t('profile.saving') : t('profile.changePassword')}
            </button>
          </form>
        </div>
      </div>

      )}

      {/* ── Konto ── */}
      {tab === 'account' && (
        <div class="pp-card">
          <h2 class="pp-section-title">{t('profile.tab.account')}</h2>
          <AccountTab
            token={token!}
            username={user.username}
            translationData={translationData}
            onDeleted={() => { clearAuthState(); const l = getLangFromPath(); window.location.href = l === 'en' ? '/' : `/${l}/`; }}
          />

          <div class="pp-logout-row">
            <button class="pp-btn-logout" onClick={handleLogout}>
              {t('auth.logout')}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
