import { useState, useEffect } from 'preact/hooks';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData } from '../../i18n/index';
import './AuthModal.css';
import './ResetPasswordForm.css';

interface Props {
  translationData: TranslationData;
  /** Pfad zur Startseite in der aktuellen Sprache — für den Weg zurück. */
  homeHref: string;
}

/**
 * Formular hinter dem Link aus der Reset-Mail.
 *
 * Der Token steht in der Adresszeile. Er wird beim ersten Rendern ausgelesen
 * und danach aus der Adresszeile entfernt: Sonst steht er im Verlauf des
 * Browsers, wird beim Teilen des Links mitkopiert und landet im Referrer, wenn
 * die Seite etwas nachlädt. Er lebt danach nur noch im Zustand dieser
 * Komponente.
 */
export default function ResetPasswordForm({ translationData, homeHref }: Props) {
  const t = useTranslations(translationData);

  const [token, setToken] = useState<string | null>(null);
  const [geprueft, setGeprueft] = useState(false);
  const [passwort, setPasswort] = useState('');
  const [wiederholung, setWiederholung] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fertig, setFertig] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('token');
    if (p && /^[0-9a-f]{64}$/.test(p)) {
      setToken(p);
      // Aus der Adresszeile nehmen, ohne einen neuen Verlaufseintrag zu
      // erzeugen — der "Zurück"-Knopf soll dorthin führen, wo man herkam.
      window.history.replaceState({}, '', window.location.pathname);
    }
    setGeprueft(true);
  }, []);

  const absenden = async (e: Event) => {
    e.preventDefault();
    setFehler(null);

    if (passwort.length < 8) { setFehler(t('reset.tooShort')); return; }
    if (passwort !== wiederholung) { setFehler(t('reset.mismatch')); return; }

    setLaeuft(true);
    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: passwort }),
      });
      const daten = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFehler(
          daten?.error === 'invalid_token' ? t('reset.invalidToken')
          : daten?.error === 'password_too_short' ? t('reset.tooShort')
          : t('reset.error'),
        );
        return;
      }
      setFertig(true);
    } catch {
      setFehler(t('reset.error'));
    } finally {
      setLaeuft(false);
    }
  };

  // Bis der Token gelesen ist, nichts zeigen — sonst blitzt für einen
  // Sekundenbruchteil "Kein Link erkannt" auf, obwohl alles stimmt.
  if (!geprueft) return null;

  if (!token) {
    return (
      <div class="reset-karte">
        <p class="auth-hinweis">{t('reset.noToken')}</p>
        <a class="auth-submit reset-knopf-link" href={homeHref}>{t('reset.toHome')}</a>
      </div>
    );
  }

  if (fertig) {
    return (
      <div class="reset-karte">
        <p class="auth-hinweis auth-hinweis-ok">{t('reset.success')}</p>
        <a class="auth-submit reset-knopf-link" href={homeHref}>{t('reset.toLogin')}</a>
      </div>
    );
  }

  return (
    <form class="reset-karte" onSubmit={absenden}>
      <p class="auth-hinweis">{t('reset.intro')}</p>

      {fehler && <div class="auth-error">{fehler}</div>}

      <div class="auth-field">
        <label htmlFor="reset-pw">{t('reset.password')}</label>
        <input
          id="reset-pw"
          type="password"
          autocomplete="new-password"
          placeholder={t('auth.passwordMinLength')}
          value={passwort}
          onInput={e => setPasswort((e.target as HTMLInputElement).value)}
          required
          minLength={8}
        />
      </div>

      <div class="auth-field">
        <label htmlFor="reset-pw2">{t('reset.confirm')}</label>
        <input
          id="reset-pw2"
          type="password"
          autocomplete="new-password"
          value={wiederholung}
          onInput={e => setWiederholung((e.target as HTMLInputElement).value)}
          required
        />
      </div>

      <button type="submit" class="auth-submit" disabled={laeuft}>
        {laeuft ? t('reset.saving') : t('reset.submit')}
      </button>
    </form>
  );
}
