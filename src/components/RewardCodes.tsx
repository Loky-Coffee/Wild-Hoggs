import { useState } from 'preact/hooks';
import './RewardCodes.css';

interface RewardCode {
  code: string;
  description: string;
  validUntil?: string;
  isActive: boolean;
}

interface RewardCodesProps {
  lang: 'de' | 'en';
  codes: RewardCode[];
}

export default function RewardCodes({ lang, codes }: RewardCodesProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      de: {
        copy: 'Kopieren',
        copied: 'Kopiert!',
        active: 'Aktive Codes',
        expired: 'Abgelaufen',
        validUntil: 'Gültig bis',
      },
      en: {
        copy: 'Copy',
        copied: 'Copied!',
        active: 'Active Codes',
        expired: 'Expired',
        validUntil: 'Valid until',
      },
    };
    return translations[lang][key] || key;
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const activeCodes = codes.filter((c) => c.isActive);
  const expiredCodes = codes.filter((c) => !c.isActive);

  return (
    <div className="reward-codes-container">
      <div className="codes-section">
        <h3 className="section-title">
          🎁 {t('active')} ({activeCodes.length})
        </h3>
        <div className="codes-grid">
          {activeCodes.map((item) => (
            <div key={item.code} className="code-card active">
              <div className="code-header">
                <span className="code-text">{item.code}</span>
                <button
                  className="copy-btn"
                  onClick={() => copyToClipboard(item.code)}
                  aria-label={`${t('copy')} ${item.code}`}
                >
                  {copiedCode === item.code ? '✓ ' + t('copied') : t('copy')}
                </button>
              </div>
              <p className="code-description">{item.description}</p>
            </div>
          ))}
        </div>
      </div>

      {expiredCodes.length > 0 && (
        <div className="codes-section">
          <h3 className="section-title expired-title">
            ⏰ {t('expired')} ({expiredCodes.length})
          </h3>
          <div className="codes-grid">
            {expiredCodes.map((item) => (
              <div key={item.code} className="code-card expired">
                <div className="code-header">
                  <span className="code-text">{item.code}</span>
                  {item.validUntil && (
                    <span className="valid-until">
                      {t('validUntil')} {item.validUntil}
                    </span>
                  )}
                </div>
                <p className="code-description">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
