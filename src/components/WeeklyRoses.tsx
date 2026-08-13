import { useState, useEffect } from 'preact/hooks';
import { msBisWochenende } from '../utils/zeit';
import { useTranslations } from '../i18n/utils';
import { useGlobalTimer } from '../hooks/useGlobalTimer';
import { getApocalypseTime } from '../utils/time';
import type { TranslationData } from '../i18n/index';
import './WeeklyRoses.css';

interface Rose {
  luckyNumber: number;
  name: string;
  buff: string;
  duration: string;
  description: string;
}

interface WeeklyRosesProps {
  lang: 'de' | 'en';
  roses: Rose[];
  translationData: TranslationData;
}

export default function WeeklyRoses({ lang, roses, translationData }: WeeklyRosesProps) {
  const [timeLeft, setTimeLeft] = useState('');
  // Welche Rose aktiv ist, steht in der Datenbank und kann erst nach dem Laden
  // geholt werden. Vorher stand hier fest eine 10 — dadurch leuchtete beim
  // Seitenaufbau kurz die FALSCHE Rose auf, bis die Antwort kam.
  // Jetzt: null bis die Antwort da ist. Lieber kurz keine hervorgehoben als
  // eine falsche. Bewusst auch kein zwischengespeicherter Wert — der waere
  // nach einem Wochenwechsel veraltet und wuerde genau denselben Fehler zeigen.
  const [activeNumber, setActiveNumber] = useState<number | null>(null);

  const t = useTranslations(translationData);

  // Fetch active lucky rose from API
  useEffect(() => {
    fetch('/api/settings/lucky-rose')
      .then(r => r.json())
      .then((data: any) => {
        if (typeof data.active === 'number') setActiveNumber(data.active);
      })
      .catch(() => { /* keine Antwort -> keine Rose hervorheben */ });
  }, []);

  // Calculate time until next Sunday 23:59:59 in Apocalypse Time (UTC-2)
  useGlobalTimer(() => {
    // Get current time in UTC-2 (Apocalypse Time)
    const apocalypseTime = getApocalypseTime();

    const diff = msBisWochenende(apocalypseTime);

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
  });

  if (roses.length === 0) {
    return (
      <div className="roses-empty">
        <p>{t('roses.noRoses')}</p>
      </div>
    );
  }

  return (
    <div className="roses-container">
      <div className="roses-grid">
        {roses.map((rose) => {
          const isActive = rose.luckyNumber === activeNumber;
          return (
            <div key={rose.luckyNumber} className={`rose-card ${isActive ? 'active' : 'inactive'}`}>
              <div className="rose-icon">{isActive ? '🌹' : '🥀'}</div>

              {isActive && (
                <div className="active-badge">{t('roses.activeThisWeek')}</div>
              )}

              <h3 className="rose-name">{rose.name}</h3>
              <div className="rose-buff">{rose.buff}</div>
              <div className="rose-duration">{t('roses.duration')}: {rose.duration}</div>
              <p className="rose-description">{rose.description}</p>

              {isActive && (
                <div
                  className="rose-countdown"
                  role="timer"
                  aria-label="Time remaining until next Sunday 23:59:59 UTC-2"
                  aria-atomic="true"
                >
                  <div className="countdown-label">{t('roses.endsIn')}:</div>
                  <div className="countdown-timer">{timeLeft}</div>
                </div>
              )}

              {!isActive && (
                <div className="inactive-badge">{t('roses.inactive')}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
