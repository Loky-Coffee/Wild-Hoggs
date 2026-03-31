import { useState, useEffect, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { useAuth, clearAuthState } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import type { GameProfile } from '../../hooks/useProfile';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData } from '../../i18n/index';
import AuthModal from './AuthModal';
import './UserMenu.css';

interface UserMenuProps {
  translationData: TranslationData;
}

export default function UserMenu({ translationData }: UserMenuProps) {
  const t = useTranslations(translationData);
  const { user, token, isLoggedIn } = useAuth();
  const { profiles, activeProfile, switchProfile, createProfile, updateProfile, deleteProfile } = useProfile();

  const [showModal, setShowModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Profile editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editServer, setEditServer] = useState('');
  const [editFaction, setEditFaction] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newServer, setNewServer] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setEditingId(null);
        setShowNewForm(false);
        setConfirmDeleteId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setShowDropdown(false);
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    } catch { /* ignore */ }
    clearAuthState();
  };

  const startEdit = (p: GameProfile) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditServer(p.server ?? '');
    setEditFaction(p.faction ?? '');
    setShowNewForm(false);
    setConfirmDeleteId(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setProfileError(null);
    const ok = await updateProfile(editingId, {
      name: editName.trim(),
      server: editServer.trim() || null,
      faction: editFaction.trim() || null,
    });
    if (ok) { setEditingId(null); } else { setProfileError('❌ Fehler beim Speichern'); }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setProfileError(null);
    const created = await createProfile(newName.trim(), newServer.trim() || undefined);
    if (created) {
      setShowNewForm(false);
      setNewName('');
      setNewServer('');
      switchProfile(created.id);
    } else {
      setProfileError('❌ Fehler beim Erstellen');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    await deleteProfile(id);
    setConfirmDeleteId(null);
  };

  if (!isLoggedIn) {
    return (
      <div class="user-menu">
        <button class="user-btn-login" onClick={() => setShowModal(true)}>
          {t('auth.login')}
        </button>
        {showModal && createPortal(
          <AuthModal onClose={() => setShowModal(false)} translationData={translationData} />,
          document.body
        )}
      </div>
    );
  }

  const getLocalizedHref = (page: string) => {
    const [, first] = window.location.pathname.split('/');
    const langs = ['de','fr','ko','th','ja','pt','es','tr','id','zh-TW','zh-CN','it','ar','vi'];
    const lang = langs.includes(first) ? first : 'en';
    return lang === 'en' ? `/${page}/` : `/${lang}/${page}/`;
  };

  const profileHref = getLocalizedHref('profile');
  const adminHref   = getLocalizedHref('admin');

  return (
    <div class="user-menu" ref={dropdownRef}>
      <button
        class="user-btn-avatar"
        onClick={() => setShowDropdown(v => !v)}
        title={user?.username}
      >
        ⚔️ <span>{user?.username}</span>
        {activeProfile.id !== 'local' && activeProfile.name !== user?.username && (
          <span class="user-btn-profile-name"> ({activeProfile.name})</span>
        )}
        {' '}▾
      </button>

      {showDropdown && (
        <div class="user-dropdown">
          <div style={{ padding: '0.5rem 1rem 0.25rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
            {user?.email}
          </div>

          <hr class="user-dropdown-divider" />

          {/* Profile switcher */}
          <div class="profile-section-label">{t('profile.myProfiles')}</div>

          {profiles.map(p => (
            <div key={p.id} class={`profile-item ${p.id === activeProfile.id ? 'active' : ''}`}>
              {editingId === p.id ? (
                <div class="profile-edit-form">
                  <input
                    class="profile-input"
                    value={editName}
                    onInput={e => setEditName((e.target as HTMLInputElement).value)}
                    placeholder={t('profile.namePlaceholder')}
                    maxLength={40}
                  />
                  <input
                    class="profile-input"
                    value={editServer}
                    onInput={e => setEditServer((e.target as HTMLInputElement).value)}
                    placeholder={t('profile.server')}
                    maxLength={20}
                  />
                  <div class="profile-edit-actions">
                    <button class="profile-btn-save" onClick={saveEdit}>{t('profile.save')}</button>
                    <button class="profile-btn-cancel" onClick={() => setEditingId(null)}>{t('profile.cancel') ?? '✕'}</button>
                  </div>
                </div>
              ) : (
                <div class="profile-row">
                  <button
                    class="profile-name-btn"
                    onClick={() => { switchProfile(p.id); setShowDropdown(false); }}
                  >
                    <span class="profile-dot">{p.id === activeProfile.id ? '●' : '○'}</span>
                    <span class="profile-name">{p.name}</span>
                    {p.server && <span class="profile-server">S.{p.server}</span>}
                  </button>
                  <div class="profile-actions">
                    <button class="profile-action-btn" onClick={() => startEdit(p)} title={t('profile.rename')}>✎</button>
                    {profiles.length > 1 && (
                      <button
                        class={`profile-action-btn ${confirmDeleteId === p.id ? 'danger' : ''}`}
                        onClick={() => handleDelete(p.id)}
                        title={confirmDeleteId === p.id ? t('profile.deleteConfirm') : t('profile.delete')}
                      >
                        {confirmDeleteId === p.id ? '✓?' : '✕'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {profileError && (
            <div style={{ padding: '0.25rem 0.75rem', fontSize: '0.78rem', color: '#e74c3c' }}>{profileError}</div>
          )}

          {showNewForm ? (
            <div class="profile-new-form">
              <input
                class="profile-input"
                value={newName}
                onInput={e => setNewName((e.target as HTMLInputElement).value)}
                placeholder={t('profile.namePlaceholder')}
                maxLength={40}
                autoFocus
              />
              <input
                class="profile-input"
                value={newServer}
                onInput={e => setNewServer((e.target as HTMLInputElement).value)}
                placeholder={t('profile.server')}
                maxLength={20}
              />
              <div class="profile-edit-actions">
                <button class="profile-btn-save" onClick={handleCreate}>{t('profile.save')}</button>
                <button class="profile-btn-cancel" onClick={() => { setShowNewForm(false); setNewName(''); setNewServer(''); }}>✕</button>
              </div>
            </div>
          ) : (
            <button class="profile-add-btn" onClick={() => { setShowNewForm(true); setEditingId(null); }}>
              + {t('profile.addProfile')}
            </button>
          )}

          <hr class="user-dropdown-divider" />
          <a href={profileHref} class="user-dropdown-item" onClick={() => setShowDropdown(false)}>
            {t('auth.myAccount')}
          </a>
          {(user?.is_admin === 1 || user?.is_moderator === 1) && (
            <>
              <hr class="user-dropdown-divider" />
              <a href={adminHref} class="user-dropdown-item user-dropdown-admin" onClick={() => setShowDropdown(false)}>
                {user?.is_admin === 1 ? '⚙' : '🛡'} Administration
              </a>
            </>
          )}
          <hr class="user-dropdown-divider" />
          <button class="user-dropdown-item danger" onClick={handleLogout}>
            {t('auth.logout')}
          </button>
        </div>
      )}
    </div>
  );
}
