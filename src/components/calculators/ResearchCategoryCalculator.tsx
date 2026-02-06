import { useState, useMemo, useEffect, useRef } from 'preact/hooks';
import type { ResearchTree } from '../../schemas/research';
import ResearchTreeView from './ResearchTreeView';
import { useTranslations } from '../../i18n/utils';
import { formatNumber } from '../../utils/formatters';
import './Calculator.css';

interface ResearchCategoryCalculatorProps {
  readonly categoryData: ResearchTree;
  readonly categoryImageSrc?: string;
  readonly lang: 'de' | 'en';
}

function calculateTotalBadges(
  selectedTechnologies: Map<string, number>,
  category: ResearchTree | null
): { totalBadges: number; selectedCount: number } {
  let totalBadges = 0;
  let selectedCount = 0;

  if (!category) return { totalBadges: 0, selectedCount: 0 };

  selectedTechnologies.forEach((level, techId) => {
    const tech = category.technologies.find((t) => t.id === techId);
    if (tech && level > 0) {
      for (let i = 0; i < level && i < tech.badgeCosts.length; i++) {
        totalBadges += tech.badgeCosts[i];
      }
      selectedCount++;
    }
  });

  return {
    totalBadges,
    selectedCount,
  };
}

export default function ResearchCategoryCalculator({ categoryData, categoryImageSrc, lang }: ResearchCategoryCalculatorProps) {
  const [selectedTechnologies, setSelectedTechnologies] = useState<Map<string, number>>(new Map());

  const category = categoryData;

  const t = useTranslations(lang);

  const setTechnologyLevel = (techId: string, level: number) => {
    // Use functional update to avoid race conditions when multiple sliders change quickly
    setSelectedTechnologies((prev) => {
      const newSelected = new Map(prev);
      if (level === 0) {
        newSelected.delete(techId);
      } else {
        newSelected.set(techId, level);
      }
      return newSelected;
    });
  };

  const setMultipleTechnologyLevels = (updates: Map<string, number>) => {
    // Use functional update to merge updates safely
    setSelectedTechnologies((prev) => {
      const newSelected = new Map(prev);
      updates.forEach((level, techId) => {
        if (level === 0) {
          newSelected.delete(techId);
        } else {
          newSelected.set(techId, level);
        }
      });
      return newSelected;
    });
  };

  const selectAllToMax = () => {
    if (!category) return;
    const newSelected = new Map<string, number>();
    category.technologies.forEach((tech) => {
      newSelected.set(tech.id, tech.maxLevel);
    });
    setSelectedTechnologies(newSelected);
  };

  const handleReset = () => {
    setSelectedTechnologies(new Map());
  };

  const getInfoBoxAriaLabel = (isCollapsed: boolean): string => {
    if (isCollapsed) {
      return t('calc.research.infoExpand');
    }
    return t('calc.research.infoCollapse');
  };

  const calculatedResults = useMemo(
    () => calculateTotalBadges(selectedTechnologies, category),
    [selectedTechnologies, category]
  );

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

  const [layoutDirection, setLayoutDirection] = useState<'horizontal' | 'vertical'>('vertical');
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
                alt={t(category.nameKey)}
                style={{ width: '60px', height: '60px', objectFit: 'contain' }}
              />
            )}
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#ffa500' }}>{t(category.nameKey)}</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.8 }}>
                {category.nodeCount} {t('calc.research.nodes')} · {formatNumber(category.totalBadges, lang)} 🎖️ {t('calc.research.total')}
              </p>
            </div>
          </div>

          {/* Center: Badge Stats */}
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
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
          layoutDirection={layoutDirection}
          lang={lang}
        />
      </div>
    </div>
  );
}
