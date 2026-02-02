import { useState, useEffect } from 'preact/hooks';
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
}

export default function WeeklyRoses({ lang, roses }: WeeklyRosesProps) {
  const [timeLeft, setTimeLeft] = useState('');

  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      de: {
        activeThisWeek: 'Aktiv diese Woche',
        inactive: 'Inaktiv',
        endsIn: 'Endet in',
        duration: 'Dauer',
        noRoses: 'Keine Rosen verfügbar',
      },
      en: {
        activeThisWeek: 'Active this week',
        inactive: 'Inactive',
        endsIn: 'Ends in',
        duration: 'Duration',
        noRoses: 'No roses available',
      },
    };
    return translations[lang][key] || key;
  };

  // Calculate time until next Sunday 23:59:59 in Apocalypse Time (UTC-2)
  useEffect(() => {
    const updateCountdown = () => {
      // Get current time in UTC-2 (Apocalypse Time)
      const now = new Date();
      const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
      const apocalypseTime = new Date(utcTime + (-2 * 3600000)); // UTC-2

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
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, []);

  if (roses.length === 0) {
    return (
      <div className="roses-empty">
        <p>{t('noRoses')}</p>
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
              <div className="active-badge">{t('activeThisWeek')}</div>
            )}

            <h3 className="rose-name">{rose.name}</h3>
            <div className="rose-buff">{rose.buff}</div>
            <div className="rose-duration">{t('duration')}: {rose.duration}</div>
            <p className="rose-description">{rose.description}</p>

            {rose.isActive && (
              <div className="rose-countdown">
                <div className="countdown-label">{t('endsIn')}:</div>
                <div className="countdown-timer">{timeLeft}</div>
              </div>
            )}

            {!rose.isActive && (
              <div className="inactive-badge">{t('inactive')}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
