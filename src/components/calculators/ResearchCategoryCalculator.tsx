import { useState, useMemo, useEffect, useRef } from 'preact/hooks';
import type { ResearchTree, Technology } from '../../schemas/research';
import ResearchTreeView from './ResearchTreeView';
import { useTranslations } from '../../i18n/utils';
import { formatNumber } from '../../utils/formatters';
import type { TranslationData, TranslationKey } from '../../i18n/index';
import { useCalculatorState } from '../../hooks/useCalculatorState';
import './Calculator.css';

interface ResearchCategoryCalculatorProps {
  readonly categoryData: ResearchTree;
  readonly categoryImageSrc?: string;
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

function calculateTotalBadges(
  selectedTechnologies: Map<string, number>,
  category: ResearchTree | null
): { totalBadges: number; selectedCount: number } {
  let totalBadges = 0;
  let selectedCount = 0;

  if (!category) return { totalBadges: 0, selectedCount: 0 };

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

      for (let i = 0; i < effectiveLevel && i < tech.badgeCosts.length; i++) {
        totalBadges += tech.badgeCosts[i];
      }

      if (effectiveLevel > 0) {
        selectedCount++;
      }
    }
  });

  return {
    totalBadges,
    selectedCount,
  };
}

export default function ResearchCategoryCalculator({ categoryData, categoryImageSrc, lang, translationData }: ResearchCategoryCalculatorProps) {
  const category = categoryData;

  // Jede Kategorie bekommt einen eigenen localStorage Key
  const [stored, setStored] = useCalculatorState<ResearchState>('research', category.id, RESEARCH_DEFAULT);

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
      return { ...prev, selectedTechnologies: next };
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
      // Update required level for this tech (use max if already set)
      const existingLevel = requiredLevels.get(tech.id) || 0;
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

          {/* Center: Badge Stats */}
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.25rem' }}>
                {t('calc.research.used')}
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: calculatedResults.totalBadges > 0 ? '#ffa500' : 'rgba(255,255,255,0.5)' }}>
                {formatNumber(calculatedResults.totalBadges, lang)} 🎖️
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.25rem' }}>
                {t('calc.research.remaining')}
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: remainingBadges > 0 ? 'rgba(255,255,255,0.7)' : '#52be80' }}>
                {formatNumber(remainingBadges, lang)} 🎖️
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
          lang={lang}
          translationData={translationData}
        />
      </div>
    </div>
  );
}
