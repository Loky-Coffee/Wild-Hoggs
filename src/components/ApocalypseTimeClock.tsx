import { useState } from 'preact/hooks';
import { useGlobalTimer } from '../hooks/useGlobalTimer';
import { formatApocalypseTime } from '../utils/time';
import './ApocalypseTimeClock.css';

/**
 * Displays the current Apocalypse Time (UTC-2) in the header
 * Updates every second using the global timer for optimal performance
 */
export default function ApocalypseTimeClock() {
  const [time, setTime] = useState(formatApocalypseTime(true));

  useGlobalTimer(() => {
    setTime(formatApocalypseTime(true));
  });

  return (
    <div
      className="apocalypse-clock"
      role="timer"
      aria-label="Apocalypse Time - Current UTC-2 game time"
      aria-atomic="true"
      title="Last-Z Game Time (UTC-2)"
    >
      <span className="clock-label">Apocalypse Time</span>
      <div className="clock-time" suppressHydrationWarning>{time}</div>
    </div>
  );
}
