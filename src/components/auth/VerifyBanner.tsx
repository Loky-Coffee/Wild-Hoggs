import { useState, useEffect } from 'preact/hooks';
import { useAuth, setAuthState, AUTH_TOKEN_KEY, AUTH_USER_KEY } from '../../hooks/useAuth';
import type { AuthUser } from '../../hooks/useAuth';

/**
 * Merker, dass in dieser Tab-Sitzung schon beim Server nachgefragt wurde.
 *
 * Eigener Schluessel statt 'wh-ok': Jener steuert den Abgleich in useAuth, und
 * ihn hier mitzubenutzen wuerde entweder dessen Abgleich unterdruecken oder
 * einen zusaetzlichen ausloesen.
 */
const GEPRUEFT_KEY = 'wh-verify-geprueft';
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

  /**
   * Stand mit dem Server abgleichen, solange dieses Konto als unbestaetigt
   * gilt — egal ob das Feld fehlt oder auf 0 steht.
   *
   * Der Grund, warum "fehlt" allein nicht reicht: Bestaetigt wird oft in einem
   * ANDEREN Browser als dem, in dem die Seite offen ist — Mail auf dem Handy,
   * Rechner am Schreibtisch. Der Rechner behaelt dann seine gespeicherte 0 und
   * erfaehrt nie davon. useAuth hilft nicht, es gleicht nur einmal je
   * Browsersitzung ab (sessionStorage-Merker 'wh-ok') und ueberspringt danach
   * jeden weiteren Aufruf.
   *
   * Einmal je Tab-Sitzung, gemerkt unter eigenem Schluessel — nicht 'wh-ok',
   * damit der Abgleich von useAuth davon unberuehrt bleibt. Eine Abfrage je
   * Tab ist vertretbar; sie faellt nur bei unbestaetigten Konten an und hoert
   * mit der Bestaetigung auf.
   */
  useEffect(() => {
    if (!user) return;
    // Bestaetigt — nichts zu holen.
    if (user.email_verified === 1) return;
    // In dieser Tab-Sitzung schon nachgefragt.
    if (sessionStorage.getItem(GEPRUEFT_KEY) === '1') return;

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) return;

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() as Promise<AuthUser> : null))
      .then(frisch => {
        if (!frisch) return;
        sessionStorage.setItem(GEPRUEFT_KEY, '1');
        setAuthState(frisch, token);
      })
      .catch(() => {}); // Netzfehler — beim naechsten Seitenaufruf erneut
  }, [user?.email_verified]);

  /**
   * Ein anderer Tab im selben Browser hat bestaetigt.
   *
   * setAuthState schreibt in localStorage und meldet es per Ereignis — aber
   * nur innerhalb des eigenen Tabs. Fuer die uebrigen Tabs gibt es das
   * storage-Ereignis, das genau dann feuert, wenn ein anderer Tab derselben
   * Herkunft den Speicher aendert. Damit verschwindet der Balken dort sofort,
   * ohne Neuladen.
   */
  useEffect(() => {
    const beiSpeicherwechsel = (e: StorageEvent) => {
      if (e.key !== AUTH_USER_KEY || !e.newValue) return;
      try {
        const frisch = JSON.parse(e.newValue) as AuthUser;
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        if (frisch.email_verified === 1 && token) setAuthState(frisch, token);
      } catch { /* unlesbarer Eintrag — ignorieren */ }
    };
    window.addEventListener('storage', beiSpeicherwechsel);
    return () => window.removeEventListener('storage', beiSpeicherwechsel);
  }, []);

  // Nur bei ausdruecklichem 0. Bei fehlendem Feld bleibt der Balken aus, bis
  // der Abgleich oben den echten Wert geliefert hat — sonst saehe ihn auch
  // jemand, der laengst bestaetigt hat.
  if (!user || user.email_verified !== 0 || zu) return null;

  const erneutSenden = async () => {
    setZustand('sendet');
    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      const res = await fetch('/api/auth/verify-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lang: spracheAusUrl() }),
      });
      if (res.status === 429) { setZustand('zuOft'); return; }

      const daten = await res.json().catch(() => ({}));

      // Der Server sagt: laengst bestaetigt. Dann ist der eigene Stand
      // veraltet — etwa weil in einem anderen Browser bestaetigt wurde. Keine
      // Erfolgsmeldung ueber eine Mail, die nie verschickt wurde: Stand
      // richtigstellen, Balken verschwindet.
      if (res.ok && (daten as { bereits?: boolean }).bereits && user && token) {
        setAuthState({ ...user, email_verified: 1 }, token);
        return;
      }

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
