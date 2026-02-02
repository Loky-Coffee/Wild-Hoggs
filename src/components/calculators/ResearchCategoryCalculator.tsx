import { useState, useMemo } from 'preact/hooks';
import ResearchTreeView from './ResearchTreeView';
import './Calculator.css';

interface Prerequisite {
  id: string;
  requiredLevel?: number;
}

interface Technology {
  id: string;
  name: {
    de: string;
    en: string;
  };
  maxLevel: number;
  badgeCosts: number[];
  icon?: string;
  prerequisites?: (string | Prerequisite)[];
}

interface ResearchTree {
  id: string;
  name: {
    de: string;
    en: string;
  };
  totalBadges: number;
  nodeCount: number;
  image?: string;
  technologies: Technology[];
}

interface ResearchCategoryCalculatorProps {
  categoryData: ResearchTree;
  lang: 'de' | 'en';
}

export default function ResearchCategoryCalculator({ categoryData, lang }: ResearchCategoryCalculatorProps) {
  const [selectedTechnologies, setSelectedTechnologies] = useState<Map<string, number>>(new Map());

  const category = categoryData;

  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      de: {
        results: 'Ergebnisse',
        totalBadges: 'Gesamt Badges',
        selectedCount: 'Ausgewählte Technologien',
        reset: 'Alle zurücksetzen',
        selectAll: 'Alle auf Maximum',
        level: 'Level',
        max: 'Max',
        total: 'gesamt',
        nodes: 'Technologien',
      },
      en: {
        results: 'Results',
        totalBadges: 'Total Badges',
        selectedCount: 'Selected Technologies',
        reset: 'Reset All',
        selectAll: 'Select All to Max',
        level: 'Level',
        max: 'Max',
        total: 'total',
        nodes: 'nodes',
      },
    };
    return translations[lang][key] || key;
  };

  const setTechnologyLevel = (techId: string, level: number) => {
    const newSelected = new Map(selectedTechnologies);
    if (level === 0) {
      newSelected.delete(techId);
    } else {
      newSelected.set(techId, level);
    }
    setSelectedTechnologies(newSelected);
  };

  const setMultipleTechnologyLevels = (updates: Map<string, number>) => {
    const newSelected = new Map(selectedTechnologies);
    updates.forEach((level, techId) => {
      if (level === 0) {
        newSelected.delete(techId);
      } else {
        newSelected.set(techId, level);
      }
    });
    setSelectedTechnologies(newSelected);
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

  const calculatedResults = useMemo(() => {
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
  }, [selectedTechnologies, category]);

  const formatNumber = (num: number) => {
    return num.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US');
  };

  if (!category) {
    return (
      <div className="calculator-container">
        <div className="calculator-error">
          {lang === 'de' ? 'Kategorie nicht gefunden' : 'Category not found'}
        </div>
      </div>
    );
  }

  const [layoutDirection, setLayoutDirection] = useState<'horizontal' | 'vertical'>('horizontal');

  const remainingBadges = category.totalBadges - calculatedResults.totalBadges;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
      {/* Header with all controls and info */}
      <div className="info-box" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '2rem', flexWrap: 'wrap' }}>
          {/* Left: Category Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {category.image && (
              <img
                src={category.image}
                alt={category.name[lang]}
                style={{ width: '60px', height: '60px', objectFit: 'contain' }}
              />
            )}
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#ffa500' }}>{category.name[lang]}</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.8 }}>
                {category.nodeCount} {t('nodes')} · {formatNumber(category.totalBadges)} 🎖️ {t('total')}
              </p>
            </div>
          </div>

          {/* Center: Badge Stats */}
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.25rem' }}>
                {lang === 'de' ? 'Benutzt' : 'Used'}
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: calculatedResults.totalBadges > 0 ? '#ffa500' : 'rgba(255,255,255,0.5)' }}>
                {formatNumber(calculatedResults.totalBadges)} 🎖️
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.25rem' }}>
                {lang === 'de' ? 'Verbleibend' : 'Remaining'}
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: remainingBadges > 0 ? 'rgba(255,255,255,0.7)' : '#52be80' }}>
                {formatNumber(remainingBadges)} 🎖️
              </div>
            </div>
          </div>

          {/* Right: Controls */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => setLayoutDirection(layoutDirection === 'horizontal' ? 'vertical' : 'horizontal')}
              className="btn-secondary"
              style={{ padding: '0.6rem 1rem', fontSize: '0.9rem' }}
            >
              {layoutDirection === 'horizontal' ? '⇅' : '⇄'} {lang === 'de' ? 'Layout' : 'Layout'}
            </button>
            <button onClick={selectAllToMax} className="btn-secondary" style={{ padding: '0.6rem 1rem', fontSize: '0.9rem' }}>
              {t('selectAll')}
            </button>
            <button onClick={handleReset} className="btn-secondary" style={{ padding: '0.6rem 1rem', fontSize: '0.9rem' }}>
              {t('reset')}
            </button>
          </div>
        </div>
      </div>

      {/* Tree taking remaining space */}
      <div style={{ flex: 1, minHeight: 0 }}>
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
