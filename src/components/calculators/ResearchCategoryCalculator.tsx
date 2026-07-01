import { useState, useMemo, useEffect, useRef } from 'preact/hooks';
import type { ResearchTree, Technology } from '../../schemas/research';
import ResearchTreeView from './ResearchTreeView';
import { LAB_SPEED_DEFAULT, effectiveLabSpeed, type LabSpeed } from '../../utils/labSpeed';
import LabSpeedModal from './LabSpeedModal';
import { useTranslations } from '../../i18n/utils';
import { formatNumber } from '../../utils/formatters';
import type { TranslationData, TranslationKey } from '../../i18n/index';
import { useCalculatorState } from '../../hooks/useCalculatorState';
import { useProfile } from '../../hooks/useProfile';
import './Calculator.css';

interface ResearchCategoryCalculatorProps {
  readonly categoryData: ResearchTree;
  readonly categoryImageSrc?: string;
  readonly iconMap?: Record<string, string>;
  readonly lang: 'de' | 'en';
  readonly translationData: TranslationData;
}

interface ResearchState {
  selectedTechnologies: Record<string, number>;
  targetTechId: string | null;
  layoutDirection: 'horizontal' | 'vertical';
}

const RESEARCH_DEFAULT: ResearchState = {
  selectedTechnologies: {},
  targetTechId: null,
  layoutDirection: 'vertical',
};

// Sekunden -> "Xd HH:MM:SS"
function fmtDuration(sec: number): string {
  sec = Math.max(0, Math.round(sec));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return (d > 0 ? `${d}d ` : '') + `${p(h)}:${p(m)}:${p(s)}`;
}

function calculateTotalBadges(
  selectedTechnologies: Map<string, number>,
  category: ResearchTree | null
): { totalBadges: number; totalStrom: number; totalZent: number; totalTimeSec: number; selectedCount: number } {
  let totalBadges = 0;
  let totalStrom = 0;
  let totalZent = 0;
  let totalTimeSec = 0;
  let selectedCount = 0;

  if (!category) return { totalBadges: 0, totalStrom: 0, totalZent: 0, totalTimeSec: 0, selectedCount: 0 };

  // Helper to check if a technology is unlocked
  const isUnlocked = (tech: Technology): boolean => {
    if (tech.prerequisites.length === 0) return true;
    return tech.prerequisites.every(prereq => {
      const prereqId = typeof prereq === 'string' ? prereq : prereq.id;
      const requiredLevel = typeof prereq === 'string' ? 1 : (prereq.requiredLevel || 1);
      const currentLevel = selectedTechnologies.get(prereqId) || 0;
      return currentLevel >= requiredLevel;
    });
  };

  // Helper to get max available level for a technology
  const getMaxAvailableLevel = (tech: Technology): number => {
    if (tech.prerequisites.length === 0) return tech.maxLevel;

    // First check if tech is unlocked at all
    if (!isUnlocked(tech)) return 0;

    // Find progressive dependencies (requiredLevel < prerequisite's maxLevel)
    const progressiveDeps = tech.prerequisites.filter(prereq => {
      const prereqTech = category.technologies.find(t =>
        t.id === (typeof prereq === 'string' ? prereq : prereq.id)
      );
      const reqLevel = typeof prereq === 'string' ? 1 : (prereq.requiredLevel || 1);
      return reqLevel < (prereqTech?.maxLevel || 1);
    });

    // If ANY prerequisite is progressive, cap at maximum current level of progressives
    if (progressiveDeps.length > 0) {
      const progressiveLevels = progressiveDeps.map(prereq => {
        const prereqId = typeof prereq === 'string' ? prereq : prereq.id;
        const prereqTech = category.technologies.find(t => t.id === prereqId);
        const prereqCurrentLevel = selectedTechnologies.get(prereqId) || 0;
        const prereqMaxLevel = prereqTech?.maxLevel || 1;

        // If prerequisite is at max level, it doesn't limit us
        if (prereqCurrentLevel >= prereqMaxLevel) {
          return Infinity;
        }

        return prereqCurrentLevel;
      });

      const maxProgressiveLevel = Math.max(...progressiveLevels);

      // If all progressive prerequisites are at max, no limit
      if (maxProgressiveLevel === Infinity) {
        return tech.maxLevel;
      }

      return Math.min(tech.maxLevel, maxProgressiveLevel);
    }

    // All prerequisites are hard: once unlocked, tech can level independently
    return tech.maxLevel;
  };

  selectedTechnologies.forEach((level, techId) => {
    const tech = category.technologies.find((t) => t.id === techId);
    if (tech && level > 0) {
      // Calculate maxAvailable for this tech based on current dependencies
      const maxAvailable = getMaxAvailableLevel(tech);

      // Only count badges up to the maximum available level
      const effectiveLevel = Math.min(level, maxAvailable);

      for (let i = 0; i < effectiveLevel; i++) {
        totalBadges += tech.badgeCosts[i] ?? 0;
        totalStrom += tech.stromCosts?.[i] ?? 0;
        totalZent += tech.zentCosts?.[i] ?? 0;
        totalTimeSec += tech.times?.[i] ?? 0;
      }

      if (effectiveLevel > 0) {
        selectedCount++;
      }
    }
  });

  return {
    totalBadges,
    totalStrom,
    totalZent,
    totalTimeSec,
    selectedCount,
  };
}

/**
 * GEZIELTE Kaskade beim Reduzieren/Abwählen eines Knotens: es werden NUR die Knoten
 * entfernt, die (direkt oder transitiv) von `changedId` abhängen und deren
 * Voraussetzung dadurch nicht mehr erfüllt ist. Unbeteiligte Knoten — auch alte,
 * inkonsistente Stände (z.B. aus der DB eingeloggter User) — bleiben unangetastet.
 * Level werden NIE global "bereinigt" -> keine ungewollten Datenverluste.
 */
function cascadeReset(
  selected: Record<string, number>,
  changedId: string,
  category: ResearchTree | null,
): Record<string, number> {
  if (!category) return { ...selected };
  const result: Record<string, number> = { ...selected };
  const queue: string[] = [changedId];
  const visited = new Set<string>();

  while (queue.length) {
    const id = queue.shift() as string;
    if (visited.has(id)) continue;
    visited.add(id);
    const curLevel = result[id] || 0;

    for (const tech of category.technologies) {
      if ((result[tech.id] || 0) <= 0) continue;
      const req = tech.prerequisites.find((p) => (typeof p === 'string' ? p : p.id) === id);
      if (!req) continue;
      const reqLevel = typeof req === 'string' ? 1 : (req.requiredLevel || 1);
      if (curLevel < reqLevel) {
        delete result[tech.id]; // Voraussetzung auf `id` nicht mehr erfüllt -> abwählen
        queue.push(tech.id);    // weiter nach unten kaskadieren
      }
    }
  }
  return result;
}

export default function ResearchCategoryCalculator({ categoryData, categoryImageSrc, iconMap, lang, translationData }: ResearchCategoryCalculatorProps) {
  const category = categoryData;

  const { activeProfile } = useProfile();

  // Jede Kategorie bekommt einen eigenen localStorage Key
  const [stored, setStored] = useCalculatorState<ResearchState>('research', category.id, RESEARCH_DEFAULT, activeProfile.id);
  // Lab-Speed global pro Profil (Server-Sync bei Login, localStorage sonst) — wie alle Rechner-Werte
  const [labSpeed, setLabSpeed] = useCalculatorState<LabSpeed>('labspeed', 'main', LAB_SPEED_DEFAULT, activeProfile.id);
  const [showLabSpeed, setShowLabSpeed] = useState(false);

  // Runtime Map aus gespeichertem Record rekonstruieren
  const selectedTechnologies = new Map(Object.entries(stored.selectedTechnologies));
  const targetTechId         = stored.targetTechId;

  const t = useTranslations(translationData);

  const setTechnologyLevel = (techId: string, level: number) => {
    setStored(prev => {
      const next = { ...prev.selectedTechnologies };
      if (level === 0) {
        delete next[techId];
      } else {
        next[techId] = level;
      }
      // gezielte Kaskade nur von diesem Knoten aus — löscht keine unbeteiligten Level
      return { ...prev, selectedTechnologies: cascadeReset(next, techId, category) };
    });
  };

  const setMultipleTechnologyLevels = (updates: Map<string, number>) => {
    setStored(prev => {
      const next = { ...prev.selectedTechnologies };
      updates.forEach((level, techId) => {
        if (level === 0) {
          delete next[techId];
        } else {
          next[techId] = level;
        }
      });
      // Batch (Auto-Entsperrung) setzt Voraussetzungen -> keine Kaskade nötig, nur speichern
      return { ...prev, selectedTechnologies: next };
    });
  };

  const selectAllToMax = () => {
    if (!category) return;
    const next: Record<string, number> = {};
    category.technologies.forEach(tech => { next[tech.id] = tech.maxLevel; });
    setStored(s => ({ ...s, selectedTechnologies: next }));
  };

  const handleReset = () => {
    setStored(s => ({ ...s, selectedTechnologies: {}, targetTechId: null }));
  };

  const setTargetTechId = (id: string | null) => setStored(s => ({ ...s, targetTechId: id }));

  const getInfoBoxAriaLabel = (collapsed: boolean): string =>
    collapsed ? t('calc.research.infoExpand') : t('calc.research.infoCollapse');

  const calculatedResults = useMemo(
    () => calculateTotalBadges(selectedTechnologies, category),
    [selectedTechnologies, category]
  );

  const targetTech = useMemo(() => {
    if (!targetTechId || !category) return null;
    return category.technologies.find(t => t.id === targetTechId) || null;
  }, [targetTechId, category]);

  const badgesToTarget = useMemo(() => {
    if (!targetTech || !category) return 0;

    // Map to track required levels for each tech (prevents double counting)
    const requiredLevels = new Map<string, number>();

    // Recursively collect required levels for a tech and its prerequisites
    const collectRequiredLevels = (tech: Technology, targetLevel: number) => {
      // Zyklus-/Redundanz-Schutz: schon mit >= diesem Level erfasst -> stop
      const existingLevel = requiredLevels.get(tech.id) || 0;
      if (requiredLevels.has(tech.id) && existingLevel >= targetLevel) return;
      requiredLevels.set(tech.id, Math.max(existingLevel, targetLevel));

      // Process prerequisites
      tech.prerequisites.forEach(prereq => {
        const prereqId = typeof prereq === 'string' ? prereq : prereq.id;
        const prereqTech = category.technologies.find(t => t.id === prereqId);
        if (!prereqTech) return;

        const requiredLevel = typeof prereq === 'string' ? 1 : (prereq.requiredLevel || 1);

        // Check if this is a progressive dependency
        const isProgressive = requiredLevel < prereqTech.maxLevel;

        if (isProgressive) {
          // Progressive: prerequisite must match the target level
          const neededPrereqLevel = Math.min(targetLevel, prereqTech.maxLevel);
          collectRequiredLevels(prereqTech, neededPrereqLevel);
        } else {
          // Hard dependency: prerequisite must be at max level
          collectRequiredLevels(prereqTech, prereqTech.maxLevel);
        }
      });
    };

    // Collect all required levels starting from target
    collectRequiredLevels(targetTech, targetTech.maxLevel);

    // Calculate total badges needed (only count each tech once)
    let totalNeededBadges = 0;
    requiredLevels.forEach((neededLevel, techId) => {
      const tech = category.technologies.find(t => t.id === techId);
      if (!tech) return;

      const currentLevel = selectedTechnologies.get(techId) || 0;
      if (currentLevel < neededLevel) {
        for (let i = currentLevel; i < neededLevel && i < tech.badgeCosts.length; i++) {
          totalNeededBadges += tech.badgeCosts[i];
        }
      }
    });

    return totalNeededBadges;
  }, [targetTech, selectedTechnologies, category]);

  if (!category) {
    return (
      <div className="calculator-container">
        <div
          className="calculator-error"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          {t('calc.research.categoryNotFound')}
        </div>
      </div>
    );
  }

  const layoutDirection    = stored.layoutDirection;
  const setLayoutDirection = (v: 'horizontal' | 'vertical') => setStored(s => ({ ...s, layoutDirection: v }));

  const [isInfoBoxCollapsed, setIsInfoBoxCollapsed] = useState(false);
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const isInfoBoxCollapsedRef = useRef(isInfoBoxCollapsed);

  const remainingBadges = category.totalBadges - calculatedResults.totalBadges;
  // Strom / Zent / Zeit (verbraucht + verbleibend) für den Header
  const eff = effectiveLabSpeed(labSpeed);
  const totalTreeTimeSec = category.technologies.reduce((s, tt) => s + (tt.times?.reduce((a, b) => a + b, 0) ?? 0), 0);
  const applySpeed = (sec: number) => sec / (1 + eff / 100);
  const remainingStrom = Math.max(0, (category.totalStrom || 0) - calculatedResults.totalStrom);
  const remainingZent = Math.max(0, (category.totalZent || 0) - calculatedResults.totalZent);
  const remainingTimeSec = Math.max(0, totalTreeTimeSec - calculatedResults.totalTimeSec);
  const hasStrom = (category.totalStrom || 0) > 0;
  const hasZent = (category.totalZent || 0) > 0;
  const hasTime = totalTreeTimeSec > 0;

  // Sync ref with state to avoid event listener thrashing
  useEffect(() => {
    isInfoBoxCollapsedRef.current = isInfoBoxCollapsed;
  }, [isInfoBoxCollapsed]);

  // Auto-collapse info box when user interacts with tree (mobile only)
  useEffect(() => {
    const treeContainer = treeContainerRef.current;
    if (!treeContainer) return;

    const handleTreeInteraction = () => {
      // Only auto-collapse on mobile screens, using ref to avoid re-registering listeners
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem', minHeight: 0 }}>
      {/* Header with all controls and info */}
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
              {formatNumber(calculatedResults.totalBadges, lang)} / {formatNumber(category.totalBadges, lang)} 🎖️
              {targetTech && (
                <span style={{ marginLeft: '0.5rem', color: '#e74c3c' }}>
                  🎯 {t(targetTech.nameKey as TranslationKey)}: {formatNumber(badgesToTarget, lang)}
                </span>
              )}
            </span>
          )}
        </button>

        {/* Main Info Content */}
        <div
          className="info-box-content"
          style={{
            display: isInfoBoxCollapsed ? 'none' : 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '2rem',
            flexWrap: 'wrap'
          }}
        >
          {/* Left: Category Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {categoryImageSrc && (
              <img
                src={categoryImageSrc}
                alt={t(category.nameKey as TranslationKey)}
                width={60}
                height={60}
                style={{ objectFit: 'contain' }}
              />
            )}
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#ffa500' }}>{t(category.nameKey as TranslationKey)}</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.8 }}>
                {category.nodeCount} {t('calc.research.nodes')} · {formatNumber(category.totalBadges, lang)} 🎖️ {t('calc.research.total')}
              </p>
            </div>
          </div>

          {/* Center: Stats (Badges / Strom / Zent / Zeit) */}
          <div style={{ display: 'flex', gap: '1.6rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.25rem' }}>
                {t('calc.research.used')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.12rem', fontSize: '0.95rem', fontWeight: 700 }}>
                <span style={{ color: calculatedResults.totalBadges > 0 ? '#ffa500' : 'rgba(255,255,255,0.45)' }}>{formatNumber(calculatedResults.totalBadges, lang)} 🎖️</span>
                {hasStrom && <span><img src="/images/research-icons/strom.webp" width="15" height="15" alt="" style={{ verticalAlign: '-3px' }} /> {formatNumber(calculatedResults.totalStrom, lang)}</span>}
                {hasZent && <span><img src="/images/research-icons/zent.webp" width="15" height="15" alt="" style={{ verticalAlign: '-3px' }} /> {formatNumber(calculatedResults.totalZent, lang)}</span>}
                {hasTime && <span style={{ color: '#9db4d0' }}>⏱ {fmtDuration(applySpeed(calculatedResults.totalTimeSec))}</span>}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.25rem' }}>
                {t('calc.research.remaining')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.12rem', fontSize: '0.95rem', fontWeight: 700 }}>
                <span style={{ color: remainingBadges > 0 ? 'rgba(255,255,255,0.7)' : '#52be80' }}>{formatNumber(remainingBadges, lang)} 🎖️</span>
                {hasStrom && <span style={{ opacity: 0.85 }}><img src="/images/research-icons/strom.webp" width="15" height="15" alt="" style={{ verticalAlign: '-3px' }} /> {formatNumber(remainingStrom, lang)}</span>}
                {hasZent && <span style={{ opacity: 0.85 }}><img src="/images/research-icons/zent.webp" width="15" height="15" alt="" style={{ verticalAlign: '-3px' }} /> {formatNumber(remainingZent, lang)}</span>}
                {hasTime && <span style={{ color: '#9db4d0', opacity: 0.85 }}>⏱ {fmtDuration(applySpeed(remainingTimeSec))}</span>}
              </div>
            </div>
            {targetTech && (
              <div>
                <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.25rem' }}>
                  {t('tank.target')}
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#e74c3c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {t(targetTech.nameKey as TranslationKey)} · {formatNumber(badgesToTarget, lang)} 🎖️
                  <button
                    onClick={() => setTargetTechId(null)}
                    style={{
                      padding: '0.2rem 0.4rem',
                      fontSize: '0.75rem',
                      background: 'rgba(231, 76, 60, 0.2)',
                      border: '1px solid rgba(231, 76, 60, 0.5)',
                      borderRadius: '4px',
                      color: '#e74c3c',
                      cursor: 'pointer'
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Controls */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => setLayoutDirection(layoutDirection === 'horizontal' ? 'vertical' : 'horizontal')}
              className="btn-secondary layout-toggle-btn"
              style={{ padding: '0.6rem 1rem', fontSize: '0.9rem' }}
            >
              {layoutDirection === 'horizontal' ? '⇅' : '⇄'} Layout
            </button>
            <button onClick={selectAllToMax} className="btn-secondary" style={{ padding: '0.6rem 1rem', fontSize: '0.9rem' }}>
              {t('calc.research.selectAll')}
            </button>
            <button onClick={handleReset} className="btn-secondary" style={{ padding: '0.6rem 1rem', fontSize: '0.9rem' }}>
              {t('calc.research.reset')}
            </button>
          </div>
        </div>
      </div>

      {/* Tree taking remaining space */}
      <div ref={treeContainerRef} style={{ flex: 1, minHeight: 0 }}>
        <ResearchTreeView
          technologies={category.technologies}
          selectedLevels={selectedTechnologies}
          onLevelChange={setTechnologyLevel}
          onBatchLevelChange={setMultipleTechnologyLevels}
          targetTechId={targetTechId}
          onTargetTechIdChange={setTargetTechId}
          layoutDirection={layoutDirection}
          iconMap={iconMap}
          labSpeed={labSpeed}
          onOpenLabSpeed={() => setShowLabSpeed(true)}
          lang={lang}
          translationData={translationData}
        />
      </div>
      {showLabSpeed && (
        <LabSpeedModal labSpeed={labSpeed} onChange={setLabSpeed} onClose={() => setShowLabSpeed(false)} lang={lang} />
      )}
    </div>
  );
}
