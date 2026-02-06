import { useState, useMemo, useEffect, useRef } from 'preact/hooks';
import TankModificationTree from './TankModificationTree';
import TankModificationList from './TankModificationList';
import tankData from '../../data/tank-modifications.json';
import { useTranslations } from '../../i18n/utils';
import { formatNumber } from '../../utils/formatters';
import type { TranslationData } from '../../i18n/index';
import './Calculator.css';

interface TankModification {
  level: number;
  nameKey: string;
  wrenchesPerSub: number;
  subLevels: number;
  totalWrenches: number;
  cumulativeTotal: number;
  isVehicle?: boolean;
}

interface TankCalculatorProps {
  readonly lang: 'de' | 'en';
  readonly translationData: TranslationData;
}

const modifications = tankData.modifications as TankModification[];
const milestones = tankData.milestones;
const maxWrenches = tankData.totalWrenches;

export default function TankCalculator({ lang, translationData }: TankCalculatorProps) {
  const t = useTranslations(translationData);

  const [unlockedLevels, setUnlockedLevels] = useState<Set<number>>(new Set([0]));
  const [subLevels, setSubLevels] = useState<Map<number, number>>(new Map([[0, 0]]));
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');
  const [isInfoBoxCollapsed, setIsInfoBoxCollapsed] = useState(false);

  const treeContainerRef = useRef<HTMLDivElement>(null);
  const isInfoBoxCollapsedRef = useRef(isInfoBoxCollapsed);

  const totalWrenchesUsed = useMemo(() => {
    let total = 0;
    modifications.forEach(mod => {
      const currentSub = subLevels.get(mod.level) || 0;
      total += currentSub * mod.wrenchesPerSub;
    });
    return total;
  }, [subLevels]);

  const remainingWrenches = maxWrenches - totalWrenchesUsed;

  // Sync ref with state to avoid event listener thrashing
  useEffect(() => {
    isInfoBoxCollapsedRef.current = isInfoBoxCollapsed;
  }, [isInfoBoxCollapsed]);

  // Auto-collapse info box when user interacts with tree (mobile only)
  useEffect(() => {
    const treeContainer = treeContainerRef.current;
    if (!treeContainer) return;

    const handleTreeInteraction = () => {
      // Only auto-collapse on mobile screens
      if (window.innerWidth <= 768 && !isInfoBoxCollapsedRef.current) {
        setIsInfoBoxCollapsed(true);
      }
    };

    // Listen for touch/click on tree
    treeContainer.addEventListener('touchstart', handleTreeInteraction, { passive: true });
    treeContainer.addEventListener('mousedown', handleTreeInteraction);

    return () => {
      treeContainer.removeEventListener('touchstart', handleTreeInteraction);
      treeContainer.removeEventListener('mousedown', handleTreeInteraction);
    };
  }, []); // Empty dependency array - listeners only added once

  const lastVehicle = useMemo(() => {
    const unlocked = milestones.filter(ms => totalWrenchesUsed >= ms.cumulativeWrenches);
    return unlocked.length > 0 ? unlocked[unlocked.length - 1] : null;
  }, [totalWrenchesUsed]);

  const handleReset = () => {
    setUnlockedLevels(new Set([0]));
    setSubLevels(new Map([[0, 0]]));
  };

  const handleMaxAll = () => {
    const newSubLevels = new Map<number, number>();
    const newUnlocked = new Set<number>();
    modifications.forEach(mod => {
      newUnlocked.add(mod.level);
      newSubLevels.set(mod.level, mod.subLevels);
    });
    setUnlockedLevels(newUnlocked);
    setSubLevels(newSubLevels);
  };

  const getInfoBoxAriaLabel = (collapsed: boolean) => {
    return collapsed ? t('calc.research.expandInfo') || 'Expand info' : t('calc.research.collapseInfo') || 'Collapse info';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem', minHeight: 0 }}>
      {/* INFO BOX - Mobile Responsive with Collapse */}
      <div className={`info-box ${isInfoBoxCollapsed ? 'collapsed' : ''}`} style={{ flexShrink: 0 }}>
        {/* Mobile Toggle Button */}
        <button
          className="info-box-toggle"
          onClick={() => setIsInfoBoxCollapsed(!isInfoBoxCollapsed)}
          aria-label={getInfoBoxAriaLabel(isInfoBoxCollapsed)}
        >
          {isInfoBoxCollapsed ? '▼' : '▲'}
          {isInfoBoxCollapsed && (
            <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>
              🔧 {formatNumber(totalWrenchesUsed, lang)} / {formatNumber(remainingWrenches, lang)}
            </span>
          )}
        </button>

        {/* Main Info Content */}
        <div
          className="info-box-content"
          style={{
            display: isInfoBoxCollapsed ? 'none' : 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
            fontSize: '0.95rem'
          }}
        >
          <div style={{ fontWeight: 'bold', color: '#ffa500', whiteSpace: 'nowrap' }}>
            {t('calc.tank.title')}
          </div>
          <div style={{ whiteSpace: 'nowrap' }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>{t('tank.used')}:</span>{' '}
            <span style={{ fontWeight: 'bold', color: '#ffa500' }}>🔧 {formatNumber(totalWrenchesUsed, lang)}</span>
          </div>
          <div style={{ whiteSpace: 'nowrap' }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>{t('tank.remaining')}:</span>{' '}
            <span style={{ fontWeight: 'bold', color: remainingWrenches < 0 ? '#e74c3c' : '#52be80' }}>🔧 {formatNumber(remainingWrenches, lang)}</span>
          </div>
          <div style={{ whiteSpace: 'nowrap' }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>{t('tank.unlocked')}:</span>{' '}
            <span style={{ fontWeight: 'bold', color: '#00bcd4' }}>{unlockedLevels.size}/{modifications.length}</span>
          </div>
          {lastVehicle && (
            <div style={{ whiteSpace: 'nowrap' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>{t('tank.vehicle')}:</span>{' '}
              <span style={{ fontWeight: 'bold', color: '#3498db' }}>{t(lastVehicle.nameKey)}</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginLeft: 'auto', minWidth: 'fit-content' }}>
            <button
              onClick={() => setViewMode(viewMode === 'tree' ? 'list' : 'tree')}
              className="btn-secondary"
              style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
            >
              {viewMode === 'tree' ? '📋 ' + t('tank.listView') : '🗺️ ' + t('tank.treeView')}
            </button>
            <button onClick={handleMaxAll} className="btn-secondary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
              {t('tank.maxAll')}
            </button>
            <button onClick={handleReset} className="btn-secondary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
              {t('tank.resetAll')}
            </button>
          </div>
        </div>
      </div>

      {/* View Container */}
      <div ref={treeContainerRef} style={{ flex: 1, minHeight: 0 }}>
        {viewMode === 'tree' ? (
          <TankModificationTree
            modifications={modifications}
            unlockedLevels={unlockedLevels}
            subLevels={subLevels}
            onUnlockedLevelsChange={setUnlockedLevels}
            onSubLevelsChange={setSubLevels}
            lang={lang}
            translationData={translationData}
          />
        ) : (
          <TankModificationList
            modifications={modifications}
            unlockedLevels={unlockedLevels}
            subLevels={subLevels}
            onSubLevelChange={(level, subLevel) => {
              // Use same logic as tree
              const currentMod = modifications.find(m => m.level === level);
              if (!currentMod) return;

              setSubLevels((prev) => {
                const newMap = new Map(prev);
                newMap.set(level, subLevel);

                const wasMax = prev.get(level) === currentMod.subLevels;
                const isNowLessThanMax = subLevel < currentMod.subLevels;

                if (wasMax && isNowLessThanMax) {
                  const currentIndex = modifications.findIndex(m => m.level === level);
                  for (let i = currentIndex + 1; i < modifications.length; i++) {
                    newMap.set(modifications[i].level, 0);
                  }
                }

                return newMap;
              });

              setUnlockedLevels((prev) => {
                const newSet = new Set(prev);
                const isNowLessThanMax = subLevel < currentMod.subLevels;

                if (isNowLessThanMax) {
                  const currentIndex = modifications.findIndex(m => m.level === level);
                  for (let i = currentIndex + 1; i < modifications.length; i++) {
                    newSet.delete(modifications[i].level);
                  }
                }

                return newSet;
              });
            }}
            onUnlockClick={(mod) => {
              const currentIndex = modifications.findIndex(m => m.level === mod.level);

              setUnlockedLevels((prev) => {
                const newSet = new Set(prev);
                newSet.add(mod.level);
                for (let i = 0; i <= currentIndex; i++) {
                  newSet.add(modifications[i].level);
                }
                return newSet;
              });

              setSubLevels((prev) => {
                const newMap = new Map(prev);
                for (let i = 0; i < currentIndex; i++) {
                  const prevMod = modifications[i];
                  newMap.set(prevMod.level, prevMod.subLevels);
                }
                newMap.set(mod.level, 0);
                return newMap;
              });
            }}
            lang={lang}
            translationData={translationData}
          />
        )}
      </div>
    </div>
  );
}
