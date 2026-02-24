import { useState, useMemo } from 'preact/hooks';
import { validatedBuildings as buildingsData } from '../../data/validated/buildings';
import { useTranslations } from '../../i18n/utils';
import { formatNumber } from '../../utils/formatters';
import type { TranslationData, TranslationKey } from '../../i18n/index';
import CustomSelect from './CustomSelect';
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
  readonly translationData: TranslationData;
}

const buildings = buildingsData;

export default function BuildingCalculator({ lang, translationData }: BuildingCalculatorProps) {
  const [selectedBuilding, setSelectedBuilding] = useState<string>(buildings[0].id);
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [targetLevel, setTargetLevel] = useState<number>(5);
  const [calculated, setCalculated] = useState(false);

  const t = useTranslations(translationData);

  const selectedBuildingData = useMemo(() => {
    return buildings.find((b) => b.id === selectedBuilding) || buildings[0];
  }, [selectedBuilding]);

  const maxLevel = selectedBuildingData.maxLevel;

  const calculatedResults = useMemo(() => {
    if (currentLevel >= targetLevel || currentLevel < 1 || currentLevel > maxLevel || targetLevel > maxLevel) {
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
      const cost = selectedBuildingData.costs[level - 1];
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
    setCalculated(false);
  };

  return (
    <div className={`calc-split${calculated ? ' has-results' : ''}`}>
      <div className="calc-controls">

        {/* Step 1: Building Selection */}
        <div className="calc-step">
          <div className="calc-step-label">{t('calc.building.selectBuilding')}</div>
          <div className="form-group">
            <CustomSelect
              id="building-select"
              value={selectedBuilding}
              options={buildings.map((b) => ({ value: b.id, label: t(b.nameKey as TranslationKey) }))}
              onChange={setSelectedBuilding}
              label={t('calc.building.selectBuilding')}
            />
          </div>
        </div>

        {/* Step 2: Level Range */}
        <div className="calc-step">
          <div className="calc-step-label">{t('calc.building.levelRange')}</div>
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
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleReset} className="btn-secondary">
              {t('calc.building.reset')}
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
          {calculated ? `✓ ${t('calc.building.calculate')}` : t('calc.building.calculate')}
        </button>

      </div>

      <div className="calc-results">
        {calculated && (
          calculatedResults ? (
            <>
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

              {(calculatedResults.totalPower > 0 || calculatedResults.targetHeroLevelCap || (calculatedResults.targetRequiredBuildings && calculatedResults.targetRequiredBuildings !== 'None')) && (
                <div className="meta-row">
                  {calculatedResults.totalPower > 0 && (
                    <div className="meta-card highlight">
                      <span className="meta-label">{t('calc.building.powerGain')}</span>
                      <span className="meta-value">{formatNumber(calculatedResults.totalPower, lang)}</span>
                    </div>
                  )}
                  {calculatedResults.targetHeroLevelCap && (
                    <div className="meta-card">
                      <span className="meta-label">{t('calc.building.heroLevelCap')}</span>
                      <span className="meta-value">{calculatedResults.targetHeroLevelCap}</span>
                    </div>
                  )}
                  {calculatedResults.targetRequiredBuildings && calculatedResults.targetRequiredBuildings !== 'None' && (
                    <div className="meta-card">
                      <span className="meta-label">{t('calc.building.requiredBuildings')}</span>
                      <span className="meta-value" style={{ fontSize: '0.85rem' }}>{calculatedResults.targetRequiredBuildings}</span>
                    </div>
                  )}
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
            </>
          ) : (
            <div
              className="calculator-error"
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
            >
              {t('calc.building.errorTargetLevel')}
            </div>
          )
        )}
      </div>
    </div>
  );
}
