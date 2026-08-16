import { useState, useEffect } from 'preact/hooks';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData } from '../../i18n/index';
import { setAuthState, AUTH_TOKEN_KEY, AUTH_USER_KEY } from '../../hooks/useAuth';
import type { AuthUser } from '../../hooks/useAuth';
import './AuthModal.css';
import './ResetPasswordForm.css';

interface Props {
  translationData: TranslationData;
  homeHref: string;
}

/**
 * Ziel des Bestätigungslinks.
 *
 * Löst den Token beim Laden ein — hier gibt es nichts auszufüllen, der Klick
 * in der Mail war die Handlung. Wer angemeldet ist, sieht danach den
 * Hinweisbalken nicht mehr; dafür wird das gespeicherte Nutzerobjekt
 * mitgezogen, ohne dass jemand neu laden muss.
 */
export default function VerifyPage({ translationData, homeHref }: Props) {
  const t = useTranslations(translationData);
  const [zustand, setZustand] = useState<'laeuft' | 'ok' | 'ungueltig' | 'geaendert' | 'fehler' | 'kein'>('laeuft');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');

    if (!token || !/^[0-9a-f]{64}$/.test(token)) {
      setZustand('kein');
      return;
    }

    // Aus der Adresszeile nehmen: Der Token gehört nicht in den Verlauf und
    // nicht in einen geteilten Link.
    window.history.replaceState({}, '', window.location.pathname);

    (async () => {
      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const daten = await res.json().catch(() => ({}));

        if (res.ok) {
          setZustand('ok');
          // Wer in diesem Browser angemeldet ist, soll den Balken sofort los
          // sein. Ohne das bliebe er bis zum nächsten Abgleich mit dem Server
          // stehen, obwohl die Sache erledigt ist.
          try {
            const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
            const roh = localStorage.getItem(AUTH_USER_KEY);
            if (authToken && roh) {
              const gespeichert = JSON.parse(roh) as AuthUser;
              setAuthState({ ...gespeichert, email_verified: 1 }, authToken);
            }
          } catch { /* Kein gespeichertes Konto — der Link wurde in einem
                       anderen Browser geöffnet. Bestätigt ist trotzdem. */ }
          return;
        }

        setZustand(
          daten?.error === 'adresse_geaendert' ? 'geaendert'
          : daten?.error === 'invalid_token'   ? 'ungueltig'
          : 'fehler',
        );
      } catch {
        setZustand('fehler');
      }
    })();
  }, []);

  if (zustand === 'laeuft') {
    return <div class="reset-karte"><p class="auth-hinweis">{t('verify.checking')}</p></div>;
  }

  const meldung =
    zustand === 'ok'        ? t('verify.success')
    : zustand === 'kein'      ? t('verify.noToken')
    : zustand === 'geaendert' ? t('verify.addressChanged')
    : zustand === 'ungueltig' ? t('verify.invalidToken')
    : t('verify.error');

  return (
    <div class="reset-karte">
      <p class={`auth-hinweis${zustand === 'ok' ? ' auth-hinweis-ok' : ''}`}>{meldung}</p>
      {zustand !== 'ok' && <div class="auth-error">{t('verify.retryHint')}</div>}
      <a class="auth-submit reset-knopf-link" href={homeHref}>{t('verify.toHome')}</a>
    </div>
  );
}
