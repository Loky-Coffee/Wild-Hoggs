import { useState, useEffect } from 'preact/hooks';
import { useTranslations } from '../i18n/utils';
import type { Language, TranslationData } from '../i18n/index';
import rewardCodesData from '../data/reward-codes.json';
import { getApocalypseTime } from '../utils/time';
import './RewardCodes.css';

interface RewardCode {
  id: string;
  code: string;
  rewardImage: string;
  expiresAt: string;
  addedAt: string;
}

interface RewardCodesLocalProps {
  lang: Language;
  translationData: TranslationData;
}

function getTimeRemaining(expiresAt: string) {
  // Get current time in UTC-2 (Apocalypse Time / Last-Z Time)
  const apocalypseTime = getApocalypseTime();

  const expiry = new Date(expiresAt).getTime();
  const diff = expiry - apocalypseTime.getTime();

  if (diff <= 0) {
    return { expired: true, days: 0, hours: 0, minutes: 0 };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return { expired: false, days, hours, minutes };
}

export default function RewardCodesLocal({ lang, translationData }: RewardCodesLocalProps) {
  const [codes, setCodes] = useState<RewardCode[]>(rewardCodesData.codes as RewardCode[]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const t = useTranslations(translationData);

  // Update time every minute for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Filter and sort codes
  const activeCodes = codes
    .filter((c) => {
      const timeRemaining = getTimeRemaining(c.expiresAt);
      return !timeRemaining.expired;
    })
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());

  const expiredCodes = codes
    .filter((c) => {
      const timeRemaining = getTimeRemaining(c.expiresAt);
      return timeRemaining.expired;
    })
    .sort((a, b) => new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime());

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
            🎁 {t('active')} ({activeCodes.length})
          </h3>
          <div className="codes-grid">
            {activeCodes.map((item) => {
              const timeRemaining = getTimeRemaining(item.expiresAt);
              return (
                <div key={item.code} className="code-card active">
                  {item.rewardImage && (
                    <div className="code-image">
                      <img src={item.rewardImage} alt={item.code} loading="lazy" />
                    </div>
                  )}
                  <div className="code-header">
                    <span className="code-text">{item.code}</span>
                    <button
                      className="copy-btn"
                      onClick={() => copyToClipboard(item.code)}
                      aria-label={`${t('codes.copy')} ${item.code}`}
                    >
                      {copiedCode === item.code ? '✓ ' + t('codes.copied') : t('codes.copy')}
                    </button>
                  </div>
                  {!timeRemaining.expired && (
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
            ⏰ {t('expired')} ({expiredCodes.length})
          </h3>
          <div className="codes-grid">
            {expiredCodes.map((item) => (
              <div key={item.code} className="code-card expired">
                {item.rewardImage && (
                  <div className="code-image expired-image">
                    <img src={item.rewardImage} alt={item.code} loading="lazy" />
                  </div>
                )}
                <div className="code-header">
                  <span className="code-text">{item.code}</span>
                  <span className="expired-badge">{t('expired')}</span>
                </div>
                <div className="code-expired-date">
                  {t('codes.expiredOn')}: {new Date(item.expiresAt).toLocaleDateString(lang)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
