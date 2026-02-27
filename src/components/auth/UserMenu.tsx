import { useState, useEffect, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { useAuth, clearAuthState } from '../../hooks/useAuth';
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
  const [showModal, setShowModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
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
        ⚔️ <span>{user?.username}</span> ▾
      </button>

      {showDropdown && (
        <div class="user-dropdown">
          <div style={{ padding: '0.5rem 1rem 0.25rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
            {user?.email}
          </div>
          <hr class="user-dropdown-divider" />
          <a href={profileHref} class="user-dropdown-item" onClick={() => setShowDropdown(false)}>
            {t('auth.myProfile')}
          </a>
          {user?.is_admin === 1 && (
            <>
              <hr class="user-dropdown-divider" />
              <a href={adminHref} class="user-dropdown-item user-dropdown-admin" onClick={() => setShowDropdown(false)}>
                ⚙ Administration
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
