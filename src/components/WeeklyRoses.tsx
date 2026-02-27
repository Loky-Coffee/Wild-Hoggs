import { useState, useEffect } from 'preact/hooks';
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
  const [activeNumber, setActiveNumber] = useState(10);

  const t = useTranslations(translationData);

  // Fetch active lucky rose from API
  useEffect(() => {
    fetch('/api/settings/lucky-rose')
      .then(r => r.json())
      .then((data: any) => {
        if (typeof data.active === 'number') setActiveNumber(data.active);
      })
      .catch(() => { /* keep fallback */ });
  }, []);

  // Calculate time until next Sunday 23:59:59 in Apocalypse Time (UTC-2)
  useGlobalTimer(() => {
    // Get current time in UTC-2 (Apocalypse Time)
    const apocalypseTime = getApocalypseTime();

    // Calculate this Sunday 23:59:59 in Apocalypse Time
    const nextSunday = new Date(apocalypseTime);
    const daysUntilSunday = ((7 - apocalypseTime.getDay()) % 7) || 7;
    nextSunday.setDate(apocalypseTime.getDate() + daysUntilSunday);
    nextSunday.setHours(23, 59, 59, 999);

    const diff = nextSunday.getTime() - apocalypseTime.getTime();

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
