import { useState, useEffect } from 'preact/hooks';
import { useTranslation } from '../hooks/useTranslation';
import './RewardCodes.css';

interface RewardCode {
  code: string;
  description?: string;
  validUntil?: string;
  isActive?: boolean;
  timestamp?: number;
}

interface RewardCodesProps {
  lang: 'de' | 'en';
  codes?: RewardCode[]; // Optional, wird von API geladen
}

export default function RewardCodes({ lang, codes: initialCodes = [] }: RewardCodesProps) {
  const [codes, setCodes] = useState<RewardCode[]>(initialCodes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Load codes from Cloudflare Pages Function API
  useEffect(() => {
    const loadCodes = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/reward-codes');

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();

        // Transform API response to RewardCode format
        const apiCodes = data.codes.map((item: any) => ({
          code: item.code,
          description: item.description || (lang === 'de' ? 'Belohnung einlösen' : 'Redeem reward'),
          isActive: true,
          timestamp: item.timestamp
        }));

        setCodes(apiCodes.length > 0 ? apiCodes : initialCodes);
      } catch (err) {
        console.error('[RewardCodes] Failed to load from API:', err);
        setError(err instanceof Error ? err.message : 'Failed to load codes');
        // Fallback to initial codes
        if (initialCodes.length > 0) {
          setCodes(initialCodes);
        }
      } finally {
        setLoading(false);
      }
    };

    loadCodes();
  }, [lang]);

  const t = useTranslation(lang, {
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
  });

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const activeCodes = codes.filter((c) => c.isActive !== false);
  const expiredCodes = codes.filter((c) => c.isActive === false);

  return (
    <div className="reward-codes-container">
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>{lang === 'de' ? 'Lade Reward Codes...' : 'Loading reward codes...'}</p>
        </div>
      )}

      {error && !loading && codes.length === 0 && (
        <div className="error-state">
          <p>⚠️ {lang === 'de' ? 'Codes konnten nicht geladen werden' : 'Failed to load codes'}</p>
          <p className="error-detail">{error}</p>
        </div>
      )}

      {!loading && codes.length === 0 && !error && (
        <div className="empty-state">
          <p>📭 {lang === 'de' ? 'Keine Codes verfügbar' : 'No codes available'}</p>
        </div>
      )}

      {!loading && codes.length > 0 && (
        <>
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
      </>
      )}
    </div>
  );
}
