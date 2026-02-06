import { useState } from 'preact/hooks';
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
  isActive: boolean;
}

interface WeeklyRosesProps {
  lang: 'de' | 'en';
  roses: Rose[];
  translationData: TranslationData;
}

export default function WeeklyRoses({ lang, roses, translationData }: WeeklyRosesProps) {
  const [timeLeft, setTimeLeft] = useState('');

  const t = useTranslations(translationData);

  // Calculate time until next Sunday 23:59:59 in Apocalypse Time (UTC-2)
  useGlobalTimer(() => {
    // Get current time in UTC-2 (Apocalypse Time)
    const apocalypseTime = getApocalypseTime();

    // Calculate next Sunday 23:59:59 in Apocalypse Time
    const nextSunday = new Date(apocalypseTime);
    const daysUntilSunday = 7 - apocalypseTime.getDay();
    nextSunday.setDate(apocalypseTime.getDate() + (daysUntilSunday === 0 ? 7 : daysUntilSunday));
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
        {roses.map((rose) => (
          <div key={rose.luckyNumber} className={`rose-card ${rose.isActive ? 'active' : 'inactive'}`}>
            <div className="rose-icon">{rose.isActive ? '🌹' : '🥀'}</div>

            {rose.isActive && (
              <div className="active-badge">{t('roses.activeThisWeek')}</div>
            )}

            <h3 className="rose-name">{rose.name}</h3>
            <div className="rose-buff">{rose.buff}</div>
            <div className="rose-duration">{t('roses.duration')}: {rose.duration}</div>
            <p className="rose-description">{rose.description}</p>

            {rose.isActive && (
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

            {!rose.isActive && (
              <div className="inactive-badge">{t('roses.inactive')}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
