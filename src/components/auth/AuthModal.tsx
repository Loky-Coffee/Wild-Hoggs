import { useState } from 'preact/hooks';
import { setAuthState } from '../../hooks/useAuth';
import type { AuthUser } from '../../hooks/useAuth';
import { syncAllOnLogin as syncCalcs } from '../../hooks/useCalculatorState';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData } from '../../i18n/index';
import './AuthModal.css';

interface AuthModalProps {
  onClose: () => void;
  initialTab?: 'login' | 'register';
  translationData: TranslationData;
}

export default function AuthModal({ onClose, initialTab = 'login', translationData }: AuthModalProps) {
  const t = useTranslations(translationData);
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
  const [regServer, setRegServer] = useState('');

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
      if (!res.ok) { setError(data.error ?? t('auth.errorLogin')); return; }
      setAuthState(data.user as AuthUser, data.token);
      await syncCalcs(data.token);
      onClose();
    } catch {
      setError(t('auth.errorConnection'));
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
        body: JSON.stringify({ email: regEmail, username: regUsername, password: regPassword, server: regServer || undefined })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? t('auth.errorRegister')); return; }
      setAuthState(data.user as AuthUser, data.token);
      await syncCalcs(data.token);
      onClose();
    } catch {
      setError(t('auth.errorConnection'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="auth-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="auth-modal" role="dialog" aria-modal="true">
        <div class="auth-modal-header">
          <span class="auth-modal-title">Wild Hoggs</span>
          <button class="auth-close" onClick={onClose} aria-label={t('auth.close')}>✕</button>
        </div>

        <div class="auth-tabs">
          <button
            class={`auth-tab${tab === 'login' ? ' active' : ''}`}
            onClick={() => { setTab('login'); setError(null); }}
          >{t('auth.login')}</button>
          <button
            class={`auth-tab${tab === 'register' ? ' active' : ''}`}
            onClick={() => { setTab('register'); setError(null); }}
          >{t('auth.register')}</button>
        </div>

        {error && <div class="auth-error">{error}</div>}

        {tab === 'login' ? (
          <form class="auth-form" onSubmit={handleLogin}>
            <div class="auth-field">
              <label htmlFor="login-email">{t('auth.email')}</label>
              <input
                id="login-email"
                type="email"
                autocomplete="email"
                placeholder={t('auth.emailPlaceholder')}
                value={loginEmail}
                onInput={e => setLoginEmail((e.target as HTMLInputElement).value)}
                required
              />
            </div>
            <div class="auth-field">
              <label htmlFor="login-pw">{t('auth.password')}</label>
              <input
                id="login-pw"
                type="password"
                autocomplete="current-password"
                placeholder={t('auth.passwordPlaceholder')}
                value={loginPassword}
                onInput={e => setLoginPassword((e.target as HTMLInputElement).value)}
                required
              />
            </div>
            <button type="submit" class="auth-submit" disabled={loading}>
              {loading ? t('auth.loginLoading') : t('auth.login')}
            </button>
          </form>
        ) : (
          <form class="auth-form" onSubmit={handleRegister}>
            <div class="auth-field">
              <label htmlFor="reg-email">{t('auth.email')}</label>
              <input
                id="reg-email"
                type="email"
                autocomplete="email"
                placeholder={t('auth.emailPlaceholder')}
                value={regEmail}
                onInput={e => setRegEmail((e.target as HTMLInputElement).value)}
                required
              />
            </div>
            <div class="auth-field">
              <label htmlFor="reg-username">{t('auth.username')}</label>
              <input
                id="reg-username"
                type="text"
                autocomplete="username"
                placeholder={t('auth.usernamePlaceholder')}
                value={regUsername}
                onInput={e => setRegUsername((e.target as HTMLInputElement).value)}
                required
                minLength={3}
                maxLength={20}
              />
            </div>
            <div class="auth-field">
              <label htmlFor="reg-server">{t('auth.server')} <span style={{ opacity: 0.5, fontSize: '0.8em' }}>{t('auth.optional')}</span></label>
              <input
                id="reg-server"
                type="text"
                autocomplete="off"
                placeholder={t('auth.serverPlaceholder')}
                value={regServer}
                onInput={e => setRegServer((e.target as HTMLInputElement).value)}
                maxLength={10}
              />
            </div>
            <div class="auth-field">
              <label htmlFor="reg-pw">{t('auth.password')}</label>
              <input
                id="reg-pw"
                type="password"
                autocomplete="new-password"
                placeholder={t('auth.passwordMinLength')}
                value={regPassword}
                onInput={e => setRegPassword((e.target as HTMLInputElement).value)}
                required
                minLength={8}
              />
            </div>
            <button type="submit" class="auth-submit" disabled={loading}>
              {loading ? t('auth.registerLoading') : t('auth.createAccount')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
