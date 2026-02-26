import { useState } from 'preact/hooks';
import { setAuthState } from '../../hooks/useAuth';
import type { AuthUser } from '../../hooks/useAuth';
import { syncAllOnLogin as syncCalcs } from '../../hooks/useCalculatorState';
import './AuthModal.css';

interface AuthModalProps {
  onClose: () => void;
  initialTab?: 'login' | 'register';
}

export default function AuthModal({ onClose, initialTab = 'login' }: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'register'>(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const handleLogin = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Anmeldung fehlgeschlagen'); return; }
      setAuthState(data.user as AuthUser, data.token);
      await syncCalcs(data.token);
      onClose();
    } catch {
      setError('Verbindungsfehler — bitte versuche es erneut');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail, username: regUsername, password: regPassword })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Registrierung fehlgeschlagen'); return; }
      setAuthState(data.user as AuthUser, data.token);
      await syncCalcs(data.token);
      onClose();
    } catch {
      setError('Verbindungsfehler — bitte versuche es erneut');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="auth-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="auth-modal" role="dialog" aria-modal="true">
        <div class="auth-modal-header">
          <span class="auth-modal-title">Wild Hoggs</span>
          <button class="auth-close" onClick={onClose} aria-label="Schließen">✕</button>
        </div>

        <div class="auth-tabs">
          <button
            class={`auth-tab${tab === 'login' ? ' active' : ''}`}
            onClick={() => { setTab('login'); setError(null); }}
          >Anmelden</button>
          <button
            class={`auth-tab${tab === 'register' ? ' active' : ''}`}
            onClick={() => { setTab('register'); setError(null); }}
          >Registrieren</button>
        </div>

        {error && <div class="auth-error">{error}</div>}

        {tab === 'login' ? (
          <form class="auth-form" onSubmit={handleLogin}>
            <div class="auth-field">
              <label htmlFor="login-email">E-Mail</label>
              <input
                id="login-email"
                type="email"
                autocomplete="email"
                placeholder="deine@email.com"
                value={loginEmail}
                onInput={e => setLoginEmail((e.target as HTMLInputElement).value)}
                required
              />
            </div>
            <div class="auth-field">
              <label htmlFor="login-pw">Passwort</label>
              <input
                id="login-pw"
                type="password"
                autocomplete="current-password"
                placeholder="••••••••"
                value={loginPassword}
                onInput={e => setLoginPassword((e.target as HTMLInputElement).value)}
                required
              />
            </div>
            <button type="submit" class="auth-submit" disabled={loading}>
              {loading ? 'Anmelden…' : 'Anmelden'}
            </button>
          </form>
        ) : (
          <form class="auth-form" onSubmit={handleRegister}>
            <div class="auth-field">
              <label htmlFor="reg-email">E-Mail</label>
              <input
                id="reg-email"
                type="email"
                autocomplete="email"
                placeholder="deine@email.com"
                value={regEmail}
                onInput={e => setRegEmail((e.target as HTMLInputElement).value)}
                required
              />
            </div>
            <div class="auth-field">
              <label htmlFor="reg-username">Username</label>
              <input
                id="reg-username"
                type="text"
                autocomplete="username"
                placeholder="z.B. WildHogg42"
                value={regUsername}
                onInput={e => setRegUsername((e.target as HTMLInputElement).value)}
                required
                minLength={3}
                maxLength={20}
              />
            </div>
            <div class="auth-field">
              <label htmlFor="reg-pw">Passwort</label>
              <input
                id="reg-pw"
                type="password"
                autocomplete="new-password"
                placeholder="Mind. 8 Zeichen"
                value={regPassword}
                onInput={e => setRegPassword((e.target as HTMLInputElement).value)}
                required
                minLength={8}
              />
            </div>
            <button type="submit" class="auth-submit" disabled={loading}>
              {loading ? 'Registrieren…' : 'Account erstellen'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
