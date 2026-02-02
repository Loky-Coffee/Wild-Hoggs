import { useState, useMemo } from 'preact/hooks';
import expTable from '../../data/hero-exp-table.json';
import './Calculator.css';

interface HeroExpCalculatorProps {
  lang: 'de' | 'en';
}

const heroExpTable = expTable as number[];

export default function HeroExpCalculator({ lang }: HeroExpCalculatorProps) {
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [targetLevel, setTargetLevel] = useState<number>(10);

  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      de: {
        title: 'Hero EXP Rechner',
        currentLevel: 'Aktuelles Level',
        targetLevel: 'Ziel Level',
        calculate: 'Berechnen',
        results: 'Ergebnisse',
        totalExp: 'Benötigte EXP',
        expPerLevel: 'EXP pro Level',
        levelProgress: 'Level-Fortschritt',
        reset: 'Zurücksetzen',
      },
      en: {
        title: 'Hero EXP Calculator',
        currentLevel: 'Current Level',
        targetLevel: 'Target Level',
        calculate: 'Calculate',
        results: 'Results',
        totalExp: 'Required EXP',
        expPerLevel: 'EXP per Level',
        levelProgress: 'Level Progress',
        reset: 'Reset',
      },
    };
    return translations[lang][key] || key;
  };

  const maxLevel = 175; // Last-Z max hero level

  const calculatedResults = useMemo(() => {
    if (currentLevel >= targetLevel || currentLevel < 1 || targetLevel > maxLevel) {
      return null;
    }

    let totalExp = 0;
    const breakdown: { level: number; exp: number }[] = [];

    for (let level = currentLevel; level < targetLevel; level++) {
      const expNeeded = heroExpTable[level];
      totalExp += expNeeded;
      breakdown.push({ level: level + 1, exp: expNeeded });
    }

    return { totalExp, breakdown };
  }, [currentLevel, targetLevel]);

  const handleReset = () => {
    setCurrentLevel(1);
    setTargetLevel(10);
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US');
  };

  return (
    <div className="calculator-container">
      <div className="info-box">
        <p>
          {lang === 'de'
            ? 'Alle Heroes in Last-Z verwenden die gleiche EXP-Kurve. Berechne die benötigte EXP für jedes Level-Upgrade.'
            : 'All heroes in Last-Z use the same EXP curve. Calculate the required EXP for any level upgrade.'}
        </p>
      </div>

      <div className="calculator-form compact">
        <div className="form-row compact-row centered">
          <div className="form-group compact">
            <label htmlFor="current-level">{t('currentLevel')}:</label>
            <input
              id="current-level"
              type="number"
              min="1"
              max={maxLevel - 1}
              value={currentLevel}
              onChange={(e) => setCurrentLevel(parseInt((e.target as HTMLInputElement).value) || 1)}
            />
          </div>

          <div className="form-group compact">
            <label htmlFor="target-level">{t('targetLevel')}:</label>
            <input
              id="target-level"
              type="number"
              min={currentLevel + 1}
              max={maxLevel}
              value={targetLevel}
              onChange={(e) => setTargetLevel(parseInt((e.target as HTMLInputElement).value) || currentLevel + 1)}
            />
          </div>

          <button onClick={handleReset} className="btn-secondary compact">
            {t('reset')}
          </button>
        </div>
      </div>

      {calculatedResults && (
        <div className="calculator-results">
          <div className="result-card highlight">
            <div className="result-label">{t('totalExp')}</div>
            <div className="result-value">{formatNumber(calculatedResults.totalExp)}</div>
          </div>

          <div className="breakdown">
            <h4>{t('expPerLevel')}</h4>
            <div className="breakdown-list">
              {calculatedResults.breakdown.map((item, index) => (
                <div key={index} className="breakdown-item">
                  <span className="breakdown-level">Level {item.level}</span>
                  <span className="breakdown-exp">{formatNumber(item.exp)} EXP</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!calculatedResults && currentLevel >= targetLevel && (
        <div className="calculator-error">
          {lang === 'de'
            ? 'Das Ziel-Level muss höher sein als das aktuelle Level.'
            : 'Target level must be higher than current level.'}
        </div>
      )}
    </div>
  );
}
