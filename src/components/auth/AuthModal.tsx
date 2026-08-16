import { useState, useEffect } from 'preact/hooks';
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

/**
 * Sprachkürzel aus dem Pfad. Wird an den Endpunkt gegeben, damit die Mail in
 * der Sprache ankommt, in der jemand gerade auf der Seite ist. Englisch hat
 * kein Präfix, deshalb der Umweg über die Liste.
 */
function spracheAusUrl(): string {
  const [, erstes] = window.location.pathname.split('/');
  const sprachen = ['de','fr','ko','th','ja','pt','es','tr','id','zh-TW','zh-CN','it','ar','vi'];
  return sprachen.includes(erstes) ? erstes : 'en';
}

export default function AuthModal({ onClose, initialTab = 'login', translationData }: AuthModalProps) {
  const t = useTranslations(translationData);
  // 'forgot' ist kein Reiter, sondern ein Abzweig aus der Anmeldung — deshalb
  // steht er nicht in der Reiterleiste, sondern wird über den Link darunter
  // erreicht und über "zurück" wieder verlassen.
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape schliesst den Dialog. Ohne das kam man mit der Tastatur nur ueber
  // den Schliessen-Knopf wieder heraus — der Klick auf den Hintergrund
  // funktionierte, aber genau darauf kann sich niemand verlassen, der nicht
  // sieht, wo der Hintergrund aufhoert.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regServer, setRegServer] = useState('');

  // Passwort vergessen
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const handleForgot = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, lang: spracheAusUrl() }),
      });
      // Die Bestätigung kommt unabhängig davon, was der Server sagt. Er
      // antwortet ohnehin immer gleich — würde die Oberfläche unterscheiden,
      // wäre die Mühe im Endpunkt umsonst gewesen.
      setForgotSent(true);
    } catch {
      setError(t('auth.errorConnection'));
    } finally {
      setLoading(false);
    }
  };

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
      <div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
        <div class="auth-modal-header">
          <span class="auth-modal-title" id="auth-modal-title">Wild Hoggs</span>
          <button class="auth-close" onClick={onClose} aria-label={t('auth.close')}>✕</button>
        </div>

        {tab !== 'forgot' && (
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
        )}

        {error && <div class="auth-error">{error}</div>}

        {tab === 'forgot' ? (
          forgotSent ? (
            <div class="auth-form">
              <p class="auth-hinweis auth-hinweis-ok">{t('auth.forgotSent')}</p>
              <button
                type="button"
                class="auth-submit"
                onClick={() => { setTab('login'); setForgotSent(false); setError(null); }}
              >{t('auth.forgotBack')}</button>
            </div>
          ) : (
            <form class="auth-form" onSubmit={handleForgot}>
              <p class="auth-hinweis">{t('auth.forgotIntro')}</p>
              <div class="auth-field">
                <label htmlFor="forgot-email">{t('auth.email')}</label>
                <input
                  id="forgot-email"
                  type="email"
                  autocomplete="email"
                  placeholder={t('auth.emailPlaceholder')}
                  value={forgotEmail}
                  onInput={e => setForgotEmail((e.target as HTMLInputElement).value)}
                  required
                />
              </div>
              <button type="submit" class="auth-submit" disabled={loading}>
                {loading ? t('auth.forgotSending') : t('auth.forgotSubmit')}
              </button>
              <button
                type="button"
                class="auth-textlink"
                onClick={() => { setTab('login'); setError(null); }}
              >{t('auth.forgotBack')}</button>
            </form>
          )
        ) : tab === 'login' ? (
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
            <button
              type="button"
              class="auth-textlink"
              onClick={() => { setTab('forgot'); setError(null); setForgotEmail(loginEmail); }}
            >{t('auth.forgotLink')}</button>
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
