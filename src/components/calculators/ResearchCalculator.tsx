import { useState, useMemo } from 'preact/hooks';
import researchData from '../../data/lastz-research.json';
import './Calculator.css';

interface Technology {
  id: string;
  name: {
    de: string;
    en: string;
  };
  maxLevel: number;
  badges: number[];
}

interface ResearchTree {
  id: string;
  name: {
    de: string;
    en: string;
  };
  totalBadges: number;
  nodeCount: number;
  technologies: Technology[];
}

interface ResearchCalculatorProps {
  lang: 'de' | 'en';
}

const researchTrees = researchData as ResearchTree[];

export default function ResearchCalculator({ lang }: ResearchCalculatorProps) {
  const [selectedTechnologies, setSelectedTechnologies] = useState<Map<string, number>>(new Map());

  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      de: {
        title: 'Forschungs Rechner',
        selectTechnologies: 'Technologien auswählen',
        results: 'Ergebnisse',
        totalBadges: 'Gesamt Badges',
        selectedCount: 'Ausgewählte Technologien',
        reset: 'Alle abwählen',
        selectAll: 'Alle auswählen',
        tree: 'Baum',
      },
      en: {
        title: 'Research Calculator',
        selectTechnologies: 'Select Technologies',
        results: 'Results',
        totalBadges: 'Total Badges',
        selectedCount: 'Selected Technologies',
        reset: 'Deselect All',
        selectAll: 'Select All',
        tree: 'Tree',
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

  const selectAllInTree = (treeId: string) => {
    const tree = researchTrees.find((t) => t.id === treeId);
    if (!tree) return;

    const newSelected = new Map(selectedTechnologies);
    tree.technologies.forEach((tech) => {
      newSelected.set(tech.id, tech.maxLevel);
    });
    setSelectedTechnologies(newSelected);
  };

  const deselectAllInTree = (treeId: string) => {
    const tree = researchTrees.find((t) => t.id === treeId);
    if (!tree) return;

    const newSelected = new Map(selectedTechnologies);
    tree.technologies.forEach((tech) => {
      newSelected.delete(tech.id);
    });
    setSelectedTechnologies(newSelected);
  };

  const calculatedResults = useMemo(() => {
    let totalBadges = 0;
    let selectedCount = 0;

    selectedTechnologies.forEach((level, techId) => {
      researchTrees.forEach((tree) => {
        const tech = tree.technologies.find((t) => t.id === techId);
        if (tech && level > 0) {
          // Sum badges from level 1 to selected level
          for (let i = 0; i < level && i < tech.badges.length; i++) {
            totalBadges += tech.badges[i];
          }
          selectedCount++;
        }
      });
    });

    return {
      totalBadges,
      selectedCount,
    };
  }, [selectedTechnologies]);

  const handleReset = () => {
    setSelectedTechnologies(new Map());
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US');
  };

  return (
    <div className="calculator-container">
      <div className="calculator-form">
        <h4>{t('selectTechnologies')}</h4>

        {researchTrees.map((tree) => {
          const treeSelected = tree.technologies.filter((tech) => selectedTechnologies.has(tech.id)).length;
          const allSelected = treeSelected === tree.technologies.length;

          return (
            <div key={tree.id} style={{ marginBottom: '2rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  paddingBottom: '0.5rem',
                  borderBottom: '1px solid rgba(255, 165, 0, 0.2)',
                }}
              >
                <div>
                  <h5 style={{ color: '#ffa500', margin: 0 }}>
                    {tree.name[lang]} ({treeSelected}/{tree.technologies.length})
                  </h5>
                  <p style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', margin: '0.25rem 0 0 0' }}>
                    {formatNumber(tree.totalBadges)} 🎖️ {lang === 'de' ? 'gesamt' : 'total'} · {tree.nodeCount} {lang === 'de' ? 'Technologien' : 'nodes'}
                  </p>
                </div>
                <button
                  onClick={() => (allSelected ? deselectAllInTree(tree.id) : selectAllInTree(tree.id))}
                  className="btn-secondary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                  {allSelected ? t('reset') : t('selectAll')}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {tree.technologies.map((tech) => {
                  const selectedLevel = selectedTechnologies.get(tech.id) || 0;
                  const totalBadges = tech.badges.slice(0, selectedLevel).reduce((sum, b) => sum + b, 0);

                  return (
                    <div
                      key={tech.id}
                      style={{
                        padding: '1rem',
                        background: selectedLevel > 0 ? 'rgba(255, 165, 0, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                        border: `1px solid ${selectedLevel > 0 ? 'rgba(255, 165, 0, 0.4)' : 'rgba(255, 165, 0, 0.1)'}`,
                        borderRadius: '6px',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>{tech.name[lang]}</span>
                        <span style={{ color: '#ffa500', fontWeight: 600, fontSize: '0.9rem' }}>
                          {selectedLevel > 0 ? `${formatNumber(totalBadges)} 🎖️` : `Max: ${formatNumber(tech.badges.reduce((a, b) => a + b, 0))} 🎖️`}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <label style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                          {lang === 'de' ? 'Level' : 'Level'}:
                        </label>
                        <input
                          type="range"
                          min="0"
                          max={tech.maxLevel}
                          value={selectedLevel}
                          onChange={(e) => setTechnologyLevel(tech.id, parseInt((e.target as HTMLInputElement).value))}
                          style={{
                            flex: 1,
                            height: '6px',
                            borderRadius: '3px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            outline: 'none',
                            cursor: 'pointer',
                          }}
                        />
                        <span style={{ fontSize: '0.9rem', color: '#ffa500', fontWeight: 600, minWidth: '60px', textAlign: 'right' }}>
                          {selectedLevel} / {tech.maxLevel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="button-group">
          <button onClick={handleReset} className="btn-secondary">
            {t('reset')}
          </button>
        </div>
      </div>

      {calculatedResults.selectedCount > 0 && (
        <div className="calculator-results">
          <h3>{t('results')}</h3>

          <div className="result-card highlight">
            <div className="result-label">{t('totalBadges')}</div>
            <div className="result-value">{formatNumber(calculatedResults.totalBadges)} 🎖️</div>
          </div>

          <div className="result-card">
            <div className="result-label">{t('selectedCount')}</div>
            <div className="result-value">{calculatedResults.selectedCount}</div>
          </div>
        </div>
      )}
    </div>
  );
}
