import { useState, useMemo } from 'preact/hooks';
import { validatedHeroExpTable } from '../../data/validated/hero-exp';
import { useTranslations } from '../../i18n/utils';
import { formatNumber } from '../../utils/formatters';
import type { TranslationData } from '../../i18n/index';
import './Calculator.css';

interface HeroExpCalculatorProps {
  readonly lang: 'de' | 'en';
  readonly translationData: TranslationData;
}

// Hero exp table is already an array of exp values (index = level)
const heroExpTable = validatedHeroExpTable;

export default function HeroExpCalculator({ lang, translationData }: HeroExpCalculatorProps) {
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [targetLevel, setTargetLevel] = useState<number>(10);
  const [calculated, setCalculated] = useState(false);

  const t = useTranslations(translationData);

  const maxLevel = 175; // Last-Z max hero level

  const calculatedResults = useMemo(() => {
    if (currentLevel > maxLevel || targetLevel > maxLevel) {
      return { error: 'maxLevel' } as const;
    }
    if (currentLevel >= targetLevel || currentLevel < 1) {
      return null;
    }

    let totalExp = 0;
    const breakdown: { level: number; exp: number }[] = [];

    for (let level = currentLevel; level < targetLevel; level++) {
      if (level >= heroExpTable.length) break;
      const expNeeded = heroExpTable[level];
      totalExp += expNeeded;
      breakdown.push({ level: level + 1, exp: expNeeded });
    }

    return { totalExp, breakdown };
  }, [currentLevel, targetLevel]);

  const handleReset = () => {
    setCurrentLevel(1);
    setTargetLevel(10);
    setCalculated(false);
  };

  return (
    <div className={`calc-split${calculated ? ' has-results' : ''}`}>
      <div className="calc-controls">

        {/* Info */}
        <div className="info-box">
          <p>{t('calc.hero.infoText')}</p>
        </div>

        {/* Level Range */}
        <div className="calc-step">
          <div className="calc-step-label">{t('calc.hero.levelRange')}</div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="current-level">{t('calc.hero.currentLevel')}:</label>
              <input
                id="current-level"
                type="number"
                min="1"
                max={maxLevel - 1}
                value={currentLevel}
                onChange={(e) => setCurrentLevel(Number.parseInt((e.target as HTMLInputElement).value, 10) || 1)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="target-level">{t('calc.hero.targetLevel')}:</label>
              <input
                id="target-level"
                type="number"
                min={currentLevel + 1}
                max={maxLevel}
                value={targetLevel}
                onChange={(e) => setTargetLevel(Number.parseInt((e.target as HTMLInputElement).value, 10) || currentLevel + 1)}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleReset} className="btn-secondary">
              {t('calc.hero.reset')}
            </button>
          </div>
        </div>

        {/* Calculate Button */}
        <button
          type="button"
          className={`calc-btn${calculated ? ' done' : ''}`}
          onClick={() => setCalculated(true)}
          disabled={calculated}
        >
          {calculated ? `✓ ${t('calc.hero.calculate')}` : t('calc.hero.calculate')}
        </button>

      </div>

      <div className="calc-results">
        {calculated && (
          calculatedResults && !('error' in calculatedResults) ? (
            <>
              <div className="result-card highlight">
                <div className="result-label">{t('calc.hero.totalExp')}</div>
                <div className="result-value">{formatNumber(calculatedResults.totalExp, lang)}</div>
              </div>

              <div className="breakdown">
                <h4>{t('calc.hero.expPerLevel')}</h4>
                <div className="breakdown-list">
                  {calculatedResults.breakdown.map((item) => (
                    <div key={item.level} className="breakdown-item">
                      <span className="breakdown-level">Level {item.level}</span>
                      <span className="breakdown-exp">{formatNumber(item.exp, lang)} EXP</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div
              className="calculator-error"
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
            >
              {calculatedResults?.error === 'maxLevel'
                ? t('calc.hero.errorMaxLevel')
                : t('calc.hero.errorTargetLevel')}
            </div>
          )
        )}
      </div>
    </div>
  );
}
