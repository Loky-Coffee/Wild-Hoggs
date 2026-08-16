import { useState } from 'preact/hooks';
import { useAuth } from '../../hooks/useAuth';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData } from '../../i18n/index';
import './VerifyBanner.css';

interface Props {
  translationData: TranslationData;
}

function spracheAusUrl(): string {
  const [, erstes] = window.location.pathname.split('/');
  const sprachen = ['de','fr','ko','th','ja','pt','es','tr','id','zh-TW','zh-CN','it','ar','vi'];
  return sprachen.includes(erstes) ? erstes : 'en';
}

/**
 * Hinweis für angemeldete Konten mit unbestätigter Adresse.
 *
 * Warum überhaupt hier und nicht nur per Mail: Die Absenderdomain hat erst
 * vor Kurzem angefangen zu senden, und 200 der 303 Adressen liegen bei Gmail.
 * Ein Teil der Bestätigungsmails wird anfangs im Spam landen — nicht wegen
 * eines Fehlers, sondern weil ein unbekannter Absender plötzlich viele
 * Nachrichten verschickt. Wer die Seite benutzt, sieht diesen Balken
 * unabhängig davon.
 *
 * Der Balken lässt sich für die laufende Browsersitzung wegklicken, aber nicht
 * dauerhaft: Beim nächsten Besuch ist er wieder da, solange nicht bestätigt
 * wurde. Dauerhaft verschwindet er nur durch den Klick in der Mail.
 */
export default function VerifyBanner({ translationData }: Props) {
  const t = useTranslations(translationData);
  const { user } = useAuth();

  const [zu, setZu] = useState(false);
  const [zustand, setZustand] = useState<'ruhe' | 'sendet' | 'gesendet' | 'fehler' | 'zuOft'>('ruhe');

  // Nur bei ausdruecklichem 0. Ein Nutzerobjekt aus dem Browserspeicher, das
  // vor dieser Aenderung entstanden ist, hat das Feld gar nicht — dort waere
  // der Balken falsch. Beim naechsten Aufruf von /api/auth/me kommt der echte
  // Wert nach.
  if (!user || user.email_verified !== 0 || zu) return null;

  const erneutSenden = async () => {
    setZustand('sendet');
    try {
      const token = localStorage.getItem('wh-auth-token');
      const res = await fetch('/api/auth/verify-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lang: spracheAusUrl() }),
      });
      if (res.status === 429) { setZustand('zuOft'); return; }
      setZustand(res.ok ? 'gesendet' : 'fehler');
    } catch {
      setZustand('fehler');
    }
  };

  return (
    <div class="verify-banner" role="status">
      <div class="verify-banner-inhalt">
        <span class="verify-banner-text">
          {zustand === 'gesendet' ? t('verify.bannerSent')
            : zustand === 'zuOft'  ? t('verify.bannerTooOften')
            : zustand === 'fehler' ? t('verify.bannerFailed')
            : t('verify.bannerText')}
        </span>

        {zustand !== 'gesendet' && (
          <button
            type="button"
            class="verify-banner-knopf"
            onClick={erneutSenden}
            disabled={zustand === 'sendet'}
          >
            {zustand === 'sendet' ? t('verify.bannerSending') : t('verify.bannerResend')}
          </button>
        )}
      </div>

      <button
        type="button"
        class="verify-banner-zu"
        onClick={() => setZu(true)}
        aria-label={t('verify.bannerDismiss')}
      >✕</button>
    </div>
  );
}
