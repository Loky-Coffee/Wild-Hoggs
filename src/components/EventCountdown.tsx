import { useState, useEffect } from 'preact/hooks';
import type { Event } from '../data/events';

interface EventCountdownProps {
  event: Event;
  lang: 'de' | 'en';
}

export default function EventCountdown({ event, lang }: EventCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const eventDateTime = new Date(event.date);
      const [hours, minutes] = event.time.split(':');
      eventDateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

      const difference = eventDateTime.getTime() - now.getTime();

      if (difference <= 0) {
        return lang === 'de' ? 'Event läuft!' : 'Event ongoing!';
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hrs = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((difference % (1000 * 60)) / 1000);

      const parts = [];
      if (days > 0) parts.push(`${days}${lang === 'de' ? 'd' : 'd'}`);
      if (hrs > 0) parts.push(`${hrs}${lang === 'de' ? 'h' : 'h'}`);
      if (mins > 0) parts.push(`${mins}${lang === 'de' ? 'm' : 'm'}`);
      if (secs > 0) parts.push(`${secs}${lang === 'de' ? 's' : 's'}`);

      return parts.join(' ');
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, [event, lang]);

  return (
    <div className="countdown-container">
      <div className="countdown-header">
        <h4>{lang === 'de' ? 'Nächstes Event' : 'Next Event'}</h4>
        <span className="countdown-title">{event.title}</span>
      </div>
      <div className="countdown-display">{timeLeft}</div>
    </div>
  );
}
