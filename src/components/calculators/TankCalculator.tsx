import { useState, useMemo, useEffect, useRef } from 'preact/hooks';
import TankModificationTree from './TankModificationTree';
import TankModificationList from './TankModificationList';
import tankData from '../../data/tank-modifications.json';
import { useTranslations } from '../../i18n/utils';
import { formatNumber } from '../../utils/formatters';
import type { TranslationData, TranslationKey } from '../../i18n/index';
import { useCalculatorState } from '../../hooks/useCalculatorState';
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

// Super Upgrade Tiers — cumulative key thresholds per form
// Destroyer EX uses the full calculator total (70,700) since upgrades continue past L195
const SUPER_UPGRADES: Array<{ nameKey: TranslationKey; maxKeys: number }> = [
  { nameKey: 'tank.vehicle.cheetah'         as TranslationKey, maxKeys: 150   },
  { nameKey: 'tank.vehicle.hercules'         as TranslationKey, maxKeys: 1730  },
  { nameKey: 'tank.vehicle.double_barrelled' as TranslationKey, maxKeys: 3730  },
  { nameKey: 'tank.vehicle.destroyer'        as TranslationKey, maxKeys: 10440 },
  { nameKey: 'tank.vehicle.destroyer_ex'     as TranslationKey, maxKeys: 35300 },
  { nameKey: 'tank.vehicle.max_level'        as TranslationKey, maxKeys: 70700 },
];

// Persistierter State — Set/Map als Array/Record für JSON-Serialisierung
interface TankState {
  unlockedLevels: number[];
  subLevels: Record<string, number>;
  viewMode: 'tree' | 'list';
  targetLevel: number | null;
}

const TANK_DEFAULT: TankState = {
  unlockedLevels: [0],
  subLevels: { '0': 0 },
  viewMode: 'tree',
  targetLevel: null,
};

// Hilfsfunktionen: JSON-typen ↔ Runtime-typen
function toSet(arr: number[]): Set<number> {
  return new Set(arr);
}
function fromSet(s: Set<number>): number[] {
  return [...s];
}
function toMap(obj: Record<string, number>): Map<number, number> {
  return new Map(Object.entries(obj).map(([k, v]) => [Number(k), v]));
}
function fromMap(m: Map<number, number>): Record<string, number> {
  return Object.fromEntries([...m].map(([k, v]) => [String(k), v]));
}

export default function TankCalculator({ lang, translationData }: TankCalculatorProps) {
  const t = useTranslations(translationData);

  const [stored, setStored] = useCalculatorState<TankState>('tank', 'main', TANK_DEFAULT);

  // Runtime-Typen aus gespeichertem State rekonstruieren
  const unlockedLevels = toSet(stored.unlockedLevels);
  const subLevels      = toMap(stored.subLevels);
  const viewMode       = stored.viewMode;
  const targetLevel    = stored.targetLevel;

  // Wrapper-Setter die die ursprüngliche API nachbilden
  const setUnlockedLevels = (updater: Set<number> | ((prev: Set<number>) => Set<number>)) => {
    setStored(prev => {
      const current = toSet(prev.unlockedLevels);
      const next    = typeof updater === 'function' ? updater(current) : updater;
      return { ...prev, unlockedLevels: fromSet(next) };
    });
  };

  const setSubLevels = (updater: Map<number, number> | ((prev: Map<number, number>) => Map<number, number>)) => {
    setStored(prev => {
      const current = toMap(prev.subLevels);
      const next    = typeof updater === 'function' ? updater(current) : updater;
      return { ...prev, subLevels: fromMap(next) };
    });
  };

  const setViewMode    = (v: 'tree' | 'list')   => setStored(s => ({ ...s, viewMode: v }));
  const setTargetLevel = (v: number | null)      => setStored(s => ({ ...s, targetLevel: v }));

  const treeContainerRef = useRef<HTMLDivElement>(null);

  const totalWrenchesUsed = useMemo(() => {
    let total = 0;
    modifications.forEach(mod => {
      const currentSub = subLevels.get(mod.level) || 0;
      total += currentSub * mod.wrenchesPerSub;
    });
    return total;
  }, [subLevels]);

  const remainingTotal  = maxWrenches - totalWrenchesUsed;
  const completionPct   = maxWrenches > 0 ? Math.round((totalWrenchesUsed / maxWrenches) * 1000) / 10 : 0;
  const totalMods       = modifications.length;

  const unlockedCount = useMemo(() => unlockedLevels.size, [unlockedLevels]);

  const maxedCount = useMemo(() =>
    modifications.filter(m => (subLevels.get(m.level) || 0) >= m.subLevels).length,
    [subLevels]
  );

  const completedTiers = useMemo(() =>
    SUPER_UPGRADES.filter(t => totalWrenchesUsed >= t.maxKeys).length,
    [totalWrenchesUsed]
  );

  const nextModToMax = useMemo(() => {
    const mod = modifications.find(m =>
      unlockedLevels.has(m.level) && (subLevels.get(m.level) || 0) < m.subLevels
    );
    if (!mod) return null;
    const needed = (mod.subLevels - (subLevels.get(mod.level) || 0)) * mod.wrenchesPerSub;
    return { mod, needed };
  }, [unlockedLevels, subLevels]);

  const handleReset = () => {
    setStored(TANK_DEFAULT);
  };

  const handleMaxAll = () => {
    const newSubLevels: Record<string, number> = {};
    const newUnlocked: number[] = [];
    modifications.forEach(mod => {
      newUnlocked.push(mod.level);
      newSubLevels[String(mod.level)] = mod.subLevels;
    });
    setStored(s => ({ ...s, unlockedLevels: newUnlocked, subLevels: newSubLevels }));
  };

  return (
    <div className="tank-layout">

      {/* ── Super Upgrade Widget + Buttons ── */}
      <div className="tank-widget-box">

        {/* ── Header ── */}
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,165,0,0.55)', marginBottom: '0.35rem', borderBottom: '1px solid rgba(255,165,0,0.12)', paddingBottom: '0.25rem' }}>
          🔧 Super Upgrades
        </div>

        {/* ── Gesamt-Schlüssel ── */}
        <div style={{ fontSize: '0.95rem', marginBottom: '0.4rem' }}>
          <span style={{ color: '#ffa500', fontWeight: 700 }}>{formatNumber(totalWrenchesUsed, lang)}</span>
          <span style={{ color: 'rgba(255,255,255,0.35)' }}> / {formatNumber(maxWrenches, lang)} 🔧</span>
        </div>

        {/* ── Tier-Zeilen ── */}
        {SUPER_UPGRADES.map((tier, i) => {
          const used      = Math.min(totalWrenchesUsed, tier.maxKeys);
          const remaining = tier.maxKeys - used;
          const done      = remaining <= 0;
          return (
            <div key={tier.nameKey} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              gap: '0.5rem', padding: '0.22rem 0',
              borderBottom: i < SUPER_UPGRADES.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              opacity: done ? 0.5 : 1,
            }}>
              <span style={{ fontSize: '0.78rem', color: done ? '#52be80' : 'rgba(255,255,255,0.85)', fontWeight: 600, flexShrink: 0 }}>
                {done ? '✓ ' : ''}{t(tier.nameKey)}
              </span>
              <span style={{ fontSize: '0.78rem', textAlign: 'right', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {done ? (
                  <span style={{ color: '#52be80' }}>{formatNumber(tier.maxKeys, lang)}</span>
                ) : (
                  <>
                    <span style={{ color: '#ffa500', fontWeight: 700 }}>{formatNumber(used, lang)}</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}> / {formatNumber(tier.maxKeys, lang)}</span>
                    <span style={{ color: 'rgba(231, 76, 60, 0.85)', marginLeft: '0.3rem' }}>-{formatNumber(remaining, lang)}</span>
                  </>
                )}
              </span>
            </div>
          );
        })}

        {/* ── Desktop-only Stats (in Gruppen) ── */}
        <div className="tank-widget-desktop-stats">

          {/* Gruppe: Gesamtfortschritt */}
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,165,0,0.45)', margin: '0.6rem 0 0.2rem' }}>
            {t('tank.widget.overall')}
          </div>
          {[
            { label: t('tank.widget.completion'),  value: `${completionPct}%` },
            { label: t('tank.widget.remaining'),    value: `${formatNumber(remainingTotal, lang)} 🔧` },
            { label: t('tank.widget.tiers_done'),   value: `${completedTiers} / ${SUPER_UPGRADES.length}` },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', padding: '0.18rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>{label}</span>
              <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.9)', fontWeight: 600, textAlign: 'right' }}>{value}</span>
            </div>
          ))}

          {/* Gruppe: Modifikationen */}
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,165,0,0.45)', margin: '0.6rem 0 0.2rem' }}>
            {t('tank.widget.mods')}
          </div>
          {[
            { label: t('tank.widget.unlocked'), value: `${unlockedCount} / ${totalMods}` },
            { label: t('tank.widget.maxed'),    value: `${maxedCount} / ${totalMods}` },
            ...(nextModToMax ? [{ label: t('tank.widget.next'), value: `${t(nextModToMax.mod.nameKey as TranslationKey)} (${formatNumber(nextModToMax.needed, lang)} 🔧)` }] : []),
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', padding: '0.18rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>{label}</span>
              <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.9)', fontWeight: 600, textAlign: 'right' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* ── Buttons (immer ganz unten) ── */}
        <div style={{ borderTop: '1px solid rgba(255,165,0,0.1)', marginTop: '0.6rem', paddingTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <button
            onClick={() => setViewMode(viewMode === 'tree' ? 'list' : 'tree')}
            className="btn-secondary"
            style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', whiteSpace: 'nowrap', textAlign: 'left' }}
          >
            {viewMode === 'tree' ? '📋 ' + t('tank.listView') : '🗺️ ' + t('tank.treeView')}
          </button>
          <button onClick={handleMaxAll} className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', textAlign: 'left' }}>
            {t('tank.maxAll')}
          </button>
          <button onClick={handleReset} className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem', textAlign: 'left' }}>
            {t('tank.resetAll')}
          </button>
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
            targetLevel={targetLevel}
            onTargetLevelChange={setTargetLevel}
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
