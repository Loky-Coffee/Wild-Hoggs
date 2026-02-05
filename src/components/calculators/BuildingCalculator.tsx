import { useState, useMemo } from 'preact/hooks';
import { validatedBuildings as buildingsData } from '../../data/validated/buildings';
import { useTranslations } from '../../i18n/utils';
import { formatNumber } from '../../utils/formatters';
import './Calculator.css';

interface BuildingCost {
  level: number;
  wood: number;
  food: number;
  steel: number;
  zinc: number;
  time: number;
  requiredBuildings?: string;
  heroLevelCap?: number;
  power?: number;
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
  readonly lang: 'de' | 'en';
}

const buildings = buildingsData;

export default function BuildingCalculator({ lang }: BuildingCalculatorProps) {
  const [selectedBuilding, setSelectedBuilding] = useState<string>(buildings[0].id);
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [targetLevel, setTargetLevel] = useState<number>(5);

  const t = useTranslations(lang);

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
    let totalPower = 0;
    const breakdown: BuildingCost[] = [];

    for (let level = currentLevel; level < targetLevel; level++) {
      const cost = selectedBuildingData.costs[level];
      if (cost) {
        totalWood += cost.wood;
        totalFood += cost.food;
        totalSteel += cost.steel;
        totalZinc += cost.zinc;
        totalTime += cost.time;
        if (cost.power) totalPower += cost.power;
        breakdown.push(cost);
      }
    }

    // Get target level data for required buildings and hero cap
    const targetLevelData = selectedBuildingData.costs[targetLevel - 1];

    return {
      totalWood,
      totalFood,
      totalSteel,
      totalZinc,
      totalTime,
      totalPower,
      breakdown,
      targetRequiredBuildings: targetLevelData?.requiredBuildings,
      targetHeroLevelCap: targetLevelData?.heroLevelCap,
    };
  }, [selectedBuilding, currentLevel, targetLevel, selectedBuildingData, maxLevel]);

  const handleReset = () => {
    setCurrentLevel(1);
    setTargetLevel(5);
  };

  return (
    <div className="calculator-container">
      <div className="calculator-form">
        <div className="form-group">
          <label htmlFor="building-select">{t('calc.building.selectBuilding')}:</label>
          <select
            id="building-select"
            value={selectedBuilding}
            onChange={(e) => setSelectedBuilding((e.target as HTMLSelectElement).value)}
          >
            {buildings.map((building) => (
              <option key={building.id} value={building.id}>
                {t(building.nameKey)}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="current-level">{t('calc.building.currentLevel')}:</label>
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
            <label htmlFor="target-level">{t('calc.building.targetLevel')}:</label>
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

        <div className="button-group">
          <button onClick={handleReset} className="btn-secondary">
            {t('calc.building.reset')}
          </button>
        </div>
      </div>

      {calculatedResults && (
        <div className="calculator-results">
          <h3>{t('calc.building.results')}</h3>

          <div className="resource-grid">
            {calculatedResults.totalWood > 0 && (
              <div className="resource-card">
                <div className="resource-label">{t('calc.building.wood')}</div>
                <div className="resource-value">{formatNumber(calculatedResults.totalWood, lang)}</div>
              </div>
            )}
            {calculatedResults.totalFood > 0 && (
              <div className="resource-card">
                <div className="resource-label">{t('calc.building.food')}</div>
                <div className="resource-value">{formatNumber(calculatedResults.totalFood, lang)}</div>
              </div>
            )}
            {calculatedResults.totalSteel > 0 && (
              <div className="resource-card">
                <div className="resource-label">{t('calc.building.steel')}</div>
                <div className="resource-value">{formatNumber(calculatedResults.totalSteel, lang)}</div>
              </div>
            )}
            {calculatedResults.totalZinc > 0 && (
              <div className="resource-card">
                <div className="resource-label">{t('calc.building.zinc')}</div>
                <div className="resource-value">{formatNumber(calculatedResults.totalZinc, lang)}</div>
              </div>
            )}
          </div>

          {calculatedResults.totalPower > 0 && (
            <div className="result-card highlight">
              <div className="result-label">{t('calc.building.powerGain')}</div>
              <div className="result-value">{formatNumber(calculatedResults.totalPower, lang)}</div>
            </div>
          )}

          {calculatedResults.targetHeroLevelCap && (
            <div className="result-card">
              <div className="result-label">{t('calc.building.heroLevelCap')}</div>
              <div className="result-value">{calculatedResults.targetHeroLevelCap}</div>
            </div>
          )}

          {calculatedResults.targetRequiredBuildings && calculatedResults.targetRequiredBuildings !== 'None' && (
            <div className="result-card">
              <div className="result-label">{t('calc.building.requiredBuildings')}</div>
              <div className="result-value" style={{ fontSize: '0.9rem' }}>{calculatedResults.targetRequiredBuildings}</div>
            </div>
          )}

          <div className="breakdown">
            <h4>{t('calc.building.perLevel')}</h4>
            <div className="breakdown-list">
              {calculatedResults.breakdown.map((item) => (
                <div key={item.level} className="breakdown-item">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span className="breakdown-level">Level {item.level}</span>
                    {item.power && (
                      <span style={{ fontSize: '0.85rem', color: '#ffa500' }}>
                        ⭐ +{formatNumber(item.power, lang)} Power
                      </span>
                    )}
                    {item.heroLevelCap && (
                      <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                        Hero Cap: {item.heroLevelCap}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem' }}>
                      {item.wood > 0 && <span>🪵 {formatNumber(item.wood, lang)}</span>}
                      {item.food > 0 && <span>🌾 {formatNumber(item.food, lang)}</span>}
                      {item.steel > 0 && <span>⚙️ {formatNumber(item.steel, lang)}</span>}
                      {item.zinc > 0 && <span>⚡ {formatNumber(item.zinc, lang)}</span>}
                    </div>
                    {item.requiredBuildings && item.requiredBuildings !== 'None' && (
                      <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', textAlign: 'right' }}>
                        {item.requiredBuildings}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!calculatedResults && currentLevel >= targetLevel && (
        <div className="calculator-error">
          {t('calc.building.errorTargetLevel')}
        </div>
      )}
    </div>
  );
}
