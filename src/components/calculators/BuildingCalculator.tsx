import { useState, useMemo } from 'preact/hooks';
import buildingsData from '../../data/buildings.json';
import './Calculator.css';

interface BuildingCost {
  level: number;
  wood: number;
  food: number;
  steel: number;
  zinc: number;
  time: number;
}

interface Building {
  id: string;
  name: {
    de: string;
    en: string;
  };
  maxLevel: number;
  costs: BuildingCost[];
}

interface BuildingCalculatorProps {
  lang: 'de' | 'en';
}

const buildings = buildingsData as Building[];

export default function BuildingCalculator({ lang }: BuildingCalculatorProps) {
  const [selectedBuilding, setSelectedBuilding] = useState<string>(buildings[0].id);
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [targetLevel, setTargetLevel] = useState<number>(5);

  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      de: {
        title: 'Gebäude Rechner',
        selectBuilding: 'Gebäude auswählen',
        currentLevel: 'Aktuelles Level',
        targetLevel: 'Ziel Level',
        results: 'Ergebnisse',
        totalResources: 'Gesamte Ressourcen',
        totalTime: 'Gesamte Bauzeit',
        wood: 'Holz',
        food: 'Nahrung',
        steel: 'Stahl',
        zinc: 'Zink',
        perLevel: 'Pro Level',
        reset: 'Zurücksetzen',
        days: 'Tage',
        hours: 'Stunden',
        minutes: 'Minuten',
        seconds: 'Sekunden',
      },
      en: {
        title: 'Building Calculator',
        selectBuilding: 'Select Building',
        currentLevel: 'Current Level',
        targetLevel: 'Target Level',
        results: 'Results',
        totalResources: 'Total Resources',
        totalTime: 'Total Build Time',
        wood: 'Wood',
        food: 'Food',
        steel: 'Steel',
        zinc: 'Zinc',
        perLevel: 'Per Level',
        reset: 'Reset',
        days: 'days',
        hours: 'hours',
        minutes: 'minutes',
        seconds: 'seconds',
      },
    };
    return translations[lang][key] || key;
  };

  const selectedBuildingData = useMemo(() => {
    return buildings.find((b) => b.id === selectedBuilding) || buildings[0];
  }, [selectedBuilding]);

  const maxLevel = selectedBuildingData.maxLevel;

  const calculatedResults = useMemo(() => {
    if (currentLevel >= targetLevel || currentLevel < 1 || targetLevel > maxLevel) {
      return null;
    }

    let totalWood = 0;
    let totalFood = 0;
    let totalSteel = 0;
    let totalZinc = 0;
    let totalTime = 0;
    const breakdown: BuildingCost[] = [];

    for (let level = currentLevel; level < targetLevel; level++) {
      const cost = selectedBuildingData.costs[level];
      if (cost) {
        totalWood += cost.wood;
        totalFood += cost.food;
        totalSteel += cost.steel;
        totalZinc += cost.zinc;
        totalTime += cost.time;
        breakdown.push(cost);
      }
    }

    return {
      totalWood,
      totalFood,
      totalSteel,
      totalZinc,
      totalTime,
      breakdown,
    };
  }, [selectedBuilding, currentLevel, targetLevel, selectedBuildingData, maxLevel]);

  const formatNumber = (num: number) => {
    return num.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US');
  };

  const formatTime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}${lang === 'de' ? 'd' : 'd'}`);
    if (hours > 0) parts.push(`${hours}${lang === 'de' ? 'h' : 'h'}`);
    if (minutes > 0) parts.push(`${minutes}${lang === 'de' ? 'm' : 'm'}`);
    if (secs > 0) parts.push(`${secs}${lang === 'de' ? 's' : 's'}`);

    return parts.join(' ') || '0s';
  };

  const handleReset = () => {
    setCurrentLevel(1);
    setTargetLevel(5);
  };

  return (
    <div className="calculator-container">
      <div className="calculator-form">
        <div className="form-group">
          <label htmlFor="building-select">{t('selectBuilding')}:</label>
          <select
            id="building-select"
            value={selectedBuilding}
            onChange={(e) => setSelectedBuilding((e.target as HTMLSelectElement).value)}
          >
            {buildings.map((building) => (
              <option key={building.id} value={building.id}>
                {building.name[lang]}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
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

          <div className="form-group">
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
        </div>

        <div className="button-group">
          <button onClick={handleReset} className="btn-secondary">
            {t('reset')}
          </button>
        </div>
      </div>

      {calculatedResults && (
        <div className="calculator-results">
          <h3>{t('results')}</h3>

          <div className="resource-grid">
            <div className="resource-card">
              <div className="resource-label">{t('wood')}</div>
              <div className="resource-value">{formatNumber(calculatedResults.totalWood)}</div>
            </div>
            <div className="resource-card">
              <div className="resource-label">{t('food')}</div>
              <div className="resource-value">{formatNumber(calculatedResults.totalFood)}</div>
            </div>
            <div className="resource-card">
              <div className="resource-label">{t('steel')}</div>
              <div className="resource-value">{formatNumber(calculatedResults.totalSteel)}</div>
            </div>
            <div className="resource-card">
              <div className="resource-label">{t('zinc')}</div>
              <div className="resource-value">{formatNumber(calculatedResults.totalZinc)}</div>
            </div>
          </div>

          <div className="result-card highlight">
            <div className="result-label">{t('totalTime')}</div>
            <div className="result-value">{formatTime(calculatedResults.totalTime)}</div>
          </div>

          <div className="breakdown">
            <h4>{t('perLevel')}</h4>
            <div className="breakdown-list">
              {calculatedResults.breakdown.map((item, index) => (
                <div key={index} className="breakdown-item">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span className="breakdown-level">Level {item.level}</span>
                    <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                      {formatTime(item.time)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem' }}>
                    {item.wood > 0 && <span>🪵 {formatNumber(item.wood)}</span>}
                    {item.food > 0 && <span>🌾 {formatNumber(item.food)}</span>}
                    {item.steel > 0 && <span>⚙️ {formatNumber(item.steel)}</span>}
                    {item.zinc > 0 && <span>⚡ {formatNumber(item.zinc)}</span>}
                  </div>
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
