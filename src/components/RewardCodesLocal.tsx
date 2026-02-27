import { useState, useEffect, useRef } from 'preact/hooks';
import { useTranslations } from '../i18n/utils';
import type { Language, TranslationData } from '../i18n/index';
import { getApocalypseTime } from '../utils/time';
import './RewardCodes.css';

interface RewardCode {
  id: string;
  code: string;
  image_key: string | null;
  expires_at: string | null;
  added_at: string;
}

interface RewardCodesLocalProps {
  lang: Language;
  translationData: TranslationData;
}

function getTimeRemaining(expiresAt: string | null) {
  if (!expiresAt) return { expired: false, days: 0, hours: 0, minutes: 0, noExpiry: true };

  // Get current time in UTC-2 (Apocalypse Time / Last-Z Time)
  const apocalypseTime = getApocalypseTime();

  const expiry = new Date(expiresAt).getTime();
  const diff = expiry - apocalypseTime.getTime();

  if (diff <= 0) {
    return { expired: true, days: 0, hours: 0, minutes: 0, noExpiry: false };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return { expired: false, days, hours, minutes, noExpiry: false };
}

export default function RewardCodesLocal({ lang, translationData }: RewardCodesLocalProps) {
  const [codes, setCodes] = useState<RewardCode[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const t = useTranslations(translationData);

  // Fetch codes from API on mount
  useEffect(() => {
    fetch('/api/reward-codes')
      .then(r => r.json())
      .then((data: any) => {
        if (Array.isArray(data.codes)) setCodes(data.codes);
      })
      .catch(() => { /* keep empty state */ });
  }, []);

  // Update time every minute for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Clear pending timeouts on unmount to prevent setState on unmounted component
  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, []);

  // clearTimeout steht bewusst NACH setCopiedCode — State-Updates in Preact sind asynchron
  // (gebatcht), der Control-Flow erreicht clearTimeout sofort ohne auf ein Re-Render zu warten.
  // clearTimeout vor setTimeout = Mutex: Ein vorheriger Timeout wird immer gekündigt bevor
  // ein neuer gesetzt wird → kein doppeltes Feuern möglich, auch bei schnellen Mehrfachklicks.
  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setErrorCode(code);
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = setTimeout(() => setErrorCode(null), 2000);
    }
  };

  // Filter and sort codes
  const activeCodes = codes
    .filter((c) => {
      const timeRemaining = getTimeRemaining(c.expires_at);
      return !timeRemaining.expired;
    })
    .sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime());

  const expiredCodes = codes
    .filter((c) => {
      const timeRemaining = getTimeRemaining(c.expires_at);
      return timeRemaining.expired;
    })
    .sort((a, b) => {
      const aExp = a.expires_at ? new Date(a.expires_at).getTime() : 0;
      const bExp = b.expires_at ? new Date(b.expires_at).getTime() : 0;
      return bExp - aExp;
    });

  return (
    <div className="reward-codes-container">
      {codes.length === 0 && (
        <div className="empty-state">
          <p>📭 {t('codes.noCodes')}</p>
        </div>
      )}

      {activeCodes.length > 0 && (
        <div className="codes-section">
          <h3 className="section-title">
            🎁 {t('codes.active')} ({activeCodes.length})
          </h3>
          <div className="codes-grid">
            {activeCodes.map((item) => {
              const timeRemaining = getTimeRemaining(item.expires_at);
              return (
                <div key={item.code} className="code-card active">
                  {item.image_key && (
                    <div className="code-image">
                      <img
                        src={`/api/files/${item.image_key}`}
                        alt={item.code}
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="code-header">
                    <span className="code-text">{item.code}</span>
                    <button
                      className="copy-btn"
                      onClick={() => copyToClipboard(item.code)}
                      aria-label={`${t('codes.copy')} ${item.code}`}
                    >
                      {copiedCode === item.code ? '✓ ' + t('codes.copied') : errorCode === item.code ? '✗ ' + t('codes.copyError') : t('codes.copy')}
                    </button>
                  </div>
                  {!timeRemaining.expired && !timeRemaining.noExpiry && (
                    <div
                      className="code-timer"
                      role="timer"
                      aria-label={`Expires in ${timeRemaining.days > 0 ? `${timeRemaining.days} days ` : ''}${timeRemaining.hours} hours ${timeRemaining.minutes} minutes`}
                      aria-atomic="true"
                    >
                      ⏰ {t('codes.expiresIn')}:{' '}
                      {timeRemaining.days > 0 && `${timeRemaining.days}${t('codes.days')} `}
                      {timeRemaining.hours}{t('codes.hours')} {timeRemaining.minutes}{t('codes.minutes')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {expiredCodes.length > 0 && (
        <div className="codes-section">
          <h3 className="section-title expired-title">
            ⏰ {t('codes.expired')} ({expiredCodes.length})
          </h3>
          <div className="codes-grid">
            {expiredCodes.map((item) => (
              <div key={item.code} className="code-card expired">
                {item.image_key && (
                  <div className="code-image expired-image">
                    <img
                      src={`/api/files/${item.image_key}`}
                      alt={item.code}
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="code-header">
                  <span className="code-text">{item.code}</span>
                  <span className="expired-badge">{t('codes.expired')}</span>
                </div>
                {item.expires_at && (
                  <div className="code-expired-date">
                    {t('codes.expiredOn')}: {new Date(item.expires_at).toLocaleDateString(lang)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
