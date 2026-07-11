import { useState, useMemo, useEffect, useRef } from 'preact/hooks';
import type { ResearchTree, Technology } from '../../schemas/research';
import ResearchTreeView from './ResearchTreeView';
import { LAB_SPEED_DEFAULT, effectiveLabSpeed, type LabSpeed } from '../../utils/labSpeed';
import LabSpeedModal from './LabSpeedModal';
import labSpeedHelp from '../../data/lab-speed-help.json';

const LABHELP = labSpeedHelp as Record<string, Record<string, string>>;
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
  targetLevel: number | null; // Ziel-Level (null = bis Max)
  layoutDirection: 'horizontal' | 'vertical';
}

const RESEARCH_DEFAULT: ResearchState = {
  selectedTechnologies: {},
  targetTechId: null,
  targetLevel: null,
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

// Grobe Zeit ohne Sekunden -> "Xd HH:MM"
function fmtDurationShort(sec: number): string {
  sec = Math.max(0, Math.round(sec));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const p = (n: number) => String(n).padStart(2, '0');
  return (d > 0 ? `${d}d ` : '') + `${p(h)}:${p(m)}`;
}

// Kompakte grobe Zahl -> "2,86 Mrd" / "2.86B"
function fcCompact(n: number, lang: string): string {
  try {
    return new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n);
  } catch {
    return String(n);
  }
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
  const targetLevel          = stored.targetLevel;

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
    setStored(s => ({ ...s, selectedTechnologies: {}, targetTechId: null, targetLevel: null }));
  };

  // Ziel löschen (id=null) räumt auch das Ziel-Level auf
  const setTargetTechId = (id: string | null) =>
    setStored(s => ({ ...s, targetTechId: id, targetLevel: id === null ? null : s.targetLevel }));
  // Ziel mit konkretem Level setzen (aus dem Ziel-Level-Modal)
  const setTarget = (id: string, level: number) =>
    setStored(s => ({ ...s, targetTechId: id, targetLevel: level }));

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

  const targetTotals = useMemo(() => {
    if (!targetTech || !category) return { badges: 0, strom: 0, zent: 0, timeSec: 0 };

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

    // Collect all required levels starting from target (bis zum gewählten Ziel-Level, sonst Max)
    collectRequiredLevels(targetTech, Math.min(targetLevel ?? targetTech.maxLevel, targetTech.maxLevel));

    // Summiere alle 4 Ressourcen bis zum Ziel (jede Tech nur einmal, ab aktuellem Level)
    let nBadges = 0;
    let nStrom = 0;
    let nZent = 0;
    let nTimeSec = 0;
    requiredLevels.forEach((neededLevel, techId) => {
      const tech = category.technologies.find(t => t.id === techId);
      if (!tech) return;

      const currentLevel = selectedTechnologies.get(techId) || 0;
      if (currentLevel < neededLevel) {
        for (let i = currentLevel; i < neededLevel; i++) {
          nBadges += tech.badgeCosts[i] ?? 0;
          nStrom += tech.stromCosts?.[i] ?? 0;
          nZent += tech.zentCosts?.[i] ?? 0;
          nTimeSec += tech.times?.[i] ?? 0;
        }
      }
    });

    return { badges: nBadges, strom: nStrom, zent: nZent, timeSec: nTimeSec };
  }, [targetTech, targetLevel, selectedTechnologies, category]);

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
  const H = LABHELP[lang] || LABHELP.en;
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

  // Mobil: Info-Panel standardmäßig eingeklappt (nach Mount -> kein Hydration-Mismatch)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) setIsInfoBoxCollapsed(true);
  }, []);

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
    <div className="research-layout">
      {/* Panel: oben (mobile) / links (desktop) */}
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
                  🎯 {t(targetTech.nameKey as TranslationKey)}: {formatNumber(targetTotals.badges, lang)}
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
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: '0.8rem'
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

          {/* Stats: Lab-Speed-Bonus (Button) + ausgerichtete kompakte Tabelle + Target */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.5rem 0.7rem' }}>
            {hasTime && (
              <button
                type="button"
                onClick={() => setShowLabSpeed(true)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', width: '100%', marginBottom: '0.5rem', padding: '0.4rem', background: 'rgba(124,197,255,0.12)', border: '1px solid rgba(124,197,255,0.4)', borderRadius: '8px', color: '#7cc5ff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
              >
                ⏱ {H.title}: <span style={{ color: '#6ee7a0' }}>{eff}%</span> ⚙️
              </button>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', columnGap: '0.7rem', alignItems: 'baseline', fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ paddingBottom: '0.2rem' }} />
              <span style={{ fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(255,255,255,0.4)', textAlign: 'right', paddingBottom: '0.2rem' }}>{t('calc.research.used')}</span>
              <span style={{ fontSize: '0.64rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(255,255,255,0.4)', textAlign: 'right', paddingBottom: '0.2rem' }}>{t('calc.research.remaining')}</span>
              {[
                { k: 'badges', ic: '🎖️', label: 'Badges', used: fcCompact(calculatedResults.totalBadges, lang), rem: fcCompact(remainingBadges, lang), show: true },
                { k: 'strom', img: '/images/research-icons/strom.webp', label: lang === 'de' ? 'Strom' : 'Electricity', used: fcCompact(calculatedResults.totalStrom, lang), rem: fcCompact(remainingStrom, lang), show: hasStrom },
                { k: 'zent', img: '/images/research-icons/zent.webp', label: 'Zent', used: fcCompact(calculatedResults.totalZent, lang), rem: fcCompact(remainingZent, lang), show: hasZent },
                { k: 'time', ic: '⏱', label: lang === 'de' ? 'Zeit' : 'Time', used: '–', rem: fmtDurationShort(applySpeed(remainingTimeSec)), show: hasTime },
              ].filter((r) => r.show).flatMap((r) => [
                <span key={r.k + 'l'} style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.24rem 0', borderTop: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>
                  {r.img ? <img src={r.img} width="15" height="15" alt="" /> : <span>{r.ic}</span>} {r.label}
                </span>,
                <span key={r.k + 'u'} style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffa500', textAlign: 'right', padding: '0.24rem 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>{r.used}</span>,
                <span key={r.k + 'r'} style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.55)', textAlign: 'right', padding: '0.24rem 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>{r.rem}</span>,
              ])}
            </div>
            {targetTech && (
              <div style={{ marginTop: '0.5rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '0.64rem', opacity: 0.55, marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  🎯 {t('tank.target')}
                  <button onClick={() => setTargetTechId(null)} style={{ marginLeft: 'auto', padding: '0.05rem 0.35rem', fontSize: '0.72rem', background: 'rgba(231,76,60,0.2)', border: '1px solid rgba(231,76,60,0.5)', borderRadius: '4px', color: '#e74c3c', cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e74c3c', marginBottom: '0.25rem' }}>{t(targetTech.nameKey as TranslationKey)} · Lv {targetLevel ?? targetTech.maxLevel}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: '0.7rem', fontVariantNumeric: 'tabular-nums' }}>
                  {[
                    { k: 'badges', ic: '🎖️', label: 'Badges', val: fcCompact(targetTotals.badges, lang), show: true },
                    { k: 'strom', img: '/images/research-icons/strom.webp', label: lang === 'de' ? 'Strom' : 'Electricity', val: fcCompact(targetTotals.strom, lang), show: hasStrom },
                    { k: 'zent', img: '/images/research-icons/zent.webp', label: 'Zent', val: fcCompact(targetTotals.zent, lang), show: hasZent },
                    { k: 'time', ic: '⏱', label: lang === 'de' ? 'Zeit' : 'Time', val: fmtDurationShort(applySpeed(targetTotals.timeSec)), show: hasTime },
                  ].filter((r) => r.show).flatMap((r) => [
                    <span key={r.k + 'l'} style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.18rem 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {r.img ? <img src={r.img} width="14" height="14" alt="" /> : <span>{r.ic}</span>} {r.label}
                    </span>,
                    <span key={r.k + 'v'} style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e74c3c', textAlign: 'right', padding: '0.18rem 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>{r.val}</span>,
                  ])}
                </div>
              </div>
            )}
          </div>

          {/* Right: Controls — gestapelt + full-width wie beim Tank */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <button
              onClick={() => setLayoutDirection(layoutDirection === 'horizontal' ? 'vertical' : 'horizontal')}
              className="btn-secondary layout-toggle-btn"
              style={{ padding: '0.6rem 1rem', fontSize: '0.9rem', width: '100%', textAlign: 'left' }}
            >
              {layoutDirection === 'horizontal' ? '⇅' : '⇄'} Layout
            </button>
            <button onClick={selectAllToMax} className="btn-secondary" style={{ padding: '0.6rem 1rem', fontSize: '0.9rem', width: '100%', textAlign: 'left' }}>
              {t('calc.research.selectAll')}
            </button>
            <button onClick={handleReset} className="btn-secondary" style={{ padding: '0.6rem 1rem', fontSize: '0.9rem', width: '100%', textAlign: 'left' }}>
              {t('calc.research.reset')}
            </button>
          </div>
        </div>
      </div>

      {/* Tree taking remaining space */}
      <div ref={treeContainerRef} style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
        <ResearchTreeView
          technologies={category.technologies}
          selectedLevels={selectedTechnologies}
          onLevelChange={setTechnologyLevel}
          onBatchLevelChange={setMultipleTechnologyLevels}
          targetTechId={targetTechId}
          targetLevel={targetLevel}
          onTargetChange={setTarget}
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
