import { useState, useEffect, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { useAuth, clearAuthState } from '../../hooks/useAuth';
import AuthModal from './AuthModal';
import './UserMenu.css';

export default function UserMenu() {
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
          Anmelden
        </button>
        {showModal && createPortal(<AuthModal onClose={() => setShowModal(false)} />, document.body)}
      </div>
    );
  }

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
          <button class="user-dropdown-item danger" onClick={handleLogout}>
            Abmelden
          </button>
        </div>
      )}
    </div>
  );
}
