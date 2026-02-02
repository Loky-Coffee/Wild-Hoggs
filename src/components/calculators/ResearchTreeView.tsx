import { useMemo, useCallback } from 'preact/hooks';
import type { Technology } from '../../schemas/research';
import { formatNumber as sharedFormatNumber } from '../../utils/formatters';
import { useTranslation } from '../../hooks/useTranslation';
import ResearchTreeNode from './ResearchTreeNode';
import ResearchTreeConnections from './ResearchTreeConnections';

interface TreeNodePosition {
  x: number;
  y: number;
  tier: number;
}

interface ResearchTreeViewProps {
  technologies: Technology[];
  selectedLevels: Map<string, number>;
  onLevelChange: (techId: string, level: number) => void;
  onBatchLevelChange: (updates: Map<string, number>) => void;
  layoutDirection: 'horizontal' | 'vertical';
  lang: 'de' | 'en';
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 180;
const TIER_SPACING = 320;
const NODE_SPACING = 240;

type LayoutDirection = 'horizontal' | 'vertical';

export default function ResearchTreeView({
  technologies,
  selectedLevels,
  onLevelChange,
  onBatchLevelChange,
  layoutDirection,
  lang
}: ResearchTreeViewProps) {

  // Calculate tier for each technology (depth in dependency tree)
  const calculateTiers = (): Map<string, number> => {
    const tiers = new Map<string, number>();
    const visited = new Set<string>();

    const calculateTier = (techId: string): number => {
      if (tiers.has(techId)) return tiers.get(techId)!;
      if (visited.has(techId)) return 0;

      visited.add(techId);
      const tech = technologies.find(t => t.id === techId);
      if (!tech || tech.prerequisites.length === 0) {
        tiers.set(techId, 0);
        return 0;
      }

      const maxPrereqTier = Math.max(...tech.prerequisites.map(prereq => {
        const prereqId = typeof prereq === 'string' ? prereq : prereq.id;
        return calculateTier(prereqId);
      }));
      const tier = maxPrereqTier + 1;
      tiers.set(techId, tier);
      return tier;
    };

    technologies.forEach(tech => calculateTier(tech.id));
    return tiers;
  };

  // Calculate positions for all nodes
  const nodePositions = useMemo((): Map<string, TreeNodePosition> => {
    const positions = new Map<string, TreeNodePosition>();
    const tiers = calculateTiers();

    const tierGroups = new Map<number, string[]>();
    tiers.forEach((tier, techId) => {
      if (!tierGroups.has(tier)) tierGroups.set(tier, []);
      tierGroups.get(tier)!.push(techId);
    });

    tierGroups.forEach((techIds, tier) => {
      const tierSize = techIds.length * NODE_SPACING;
      const startPos = -tierSize / 2;

      techIds.forEach((techId, index) => {
        const primaryPos = tier * TIER_SPACING;
        const secondaryPos = startPos + index * NODE_SPACING;

        positions.set(techId, {
          x: layoutDirection === 'horizontal' ? primaryPos : secondaryPos,
          y: layoutDirection === 'horizontal' ? secondaryPos : primaryPos,
          tier
        });
      });
    });

    return positions;
  }, [technologies, layoutDirection]);

  const isUnlocked = (tech: Technology): boolean => {
    if (tech.prerequisites.length === 0) return true;
    return tech.prerequisites.every(prereq => {
      const prereqId = typeof prereq === 'string' ? prereq : prereq.id;
      const requiredLevel = typeof prereq === 'string' ? 1 : (prereq.requiredLevel || 1);
      const currentLevel = selectedLevels.get(prereqId) || 0;
      return currentLevel >= requiredLevel;
    });
  };

  const getMaxAvailableLevel = (tech: Technology): number => {
    if (tech.prerequisites.length === 0) return tech.maxLevel;

    // Check if any prerequisite has a low requiredLevel (progressive leveling)
    const hasProgressivePrereq = tech.prerequisites.some(prereq => {
      if (typeof prereq === 'string') return true; // String prerequisites default to progressive
      const prereqTech = technologies.find(t => t.id === prereq.id);
      const reqLevel = prereq.requiredLevel || 1;
      // If requiredLevel is less than the prerequisite's maxLevel, it's progressive
      return reqLevel < (prereqTech?.maxLevel || 1);
    });

    if (hasProgressivePrereq) {
      // Progressive: level capped by minimum current level of prerequisites
      const minPrereqLevel = Math.min(...tech.prerequisites.map(prereq => {
        const prereqId = typeof prereq === 'string' ? prereq : prereq.id;
        return selectedLevels.get(prereqId) || 0;
      }));
      return Math.min(tech.maxLevel, minPrereqLevel);
    }

    // All prerequisites require maxLevel: independent leveling once unlocked
    return tech.maxLevel;
  };

  const unlockWithPrerequisites = (tech: Technology) => {
    const newLevels = new Map(selectedLevels);

    // Recursive function to unlock all prerequisites to MAX level
    const unlockPrereqs = (t: Technology) => {
      t.prerequisites.forEach(prereq => {
        const prereqId = typeof prereq === 'string' ? prereq : prereq.id;
        const prereqTech = technologies.find(tech => tech.id === prereqId);

        if (prereqTech) {
          // First unlock the prerequisites of this prerequisite
          unlockPrereqs(prereqTech);

          // Then set this prerequisite to MAX level
          newLevels.set(prereqId, prereqTech.maxLevel);
        }
      });
    };

    // Unlock all prerequisites to max
    unlockPrereqs(tech);

    // Apply all changes at once using batch update
    onBatchLevelChange(newLevels);
  };

  // Use shared formatNumber utility
  const formatNumber = useCallback((num: number) => sharedFormatNumber(num, lang), [lang]);

  const svgDimensions = useMemo(() => {
    let minX = 0, minY = 0, maxX = 0, maxY = 0;

    nodePositions.forEach((pos) => {
      minX = Math.min(minX, pos.x - NODE_WIDTH / 2);
      minY = Math.min(minY, pos.y - NODE_HEIGHT / 2);
      maxX = Math.max(maxX, pos.x + NODE_WIDTH / 2);
      maxY = Math.max(maxY, pos.y + NODE_HEIGHT / 2);
    });

    const padding = 100;
    const offsetX = -minX + padding;
    const offsetY = -minY + padding;

    return {
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
      offsetX,
      offsetY
    };
  }, [nodePositions]);

  // Use shared translation hook
  const t = useTranslation(lang, {
    de: {
      horizontal: 'Horizontal (Links→Rechts)',
      vertical: 'Vertikal (Oben→Unten)',
      layout: 'Layout',
      level: 'Level'
    },
    en: {
      horizontal: 'Horizontal (Left→Right)',
      vertical: 'Vertical (Top→Bottom)',
      layout: 'Layout',
      level: 'Level'
    }
  });

  // Render tree with connections and nodes using extracted components
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        background: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '12px',
        padding: '1rem',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-x pan-y',
        cursor: 'grab',
        display: 'flex',
        justifyContent: layoutDirection === 'vertical' ? 'center' : 'flex-start',
        alignItems: 'flex-start'
      } as any}>
        <div style={{
          minWidth: 'min-content',
          minHeight: 'min-content'
        }}>
          <svg
            width={svgDimensions.width}
            height={svgDimensions.height}
            style={{ display: 'block' }}
          >
            {/* Connection lines - extracted to separate component */}
            <ResearchTreeConnections
              technologies={technologies}
              nodePositions={nodePositions}
              selectedLevels={selectedLevels}
              svgDimensions={svgDimensions}
              layoutDirection={layoutDirection}
            />

            {/* Nodes - extracted to separate component with memoization */}
            {technologies.map(tech => {
              const pos = nodePositions.get(tech.id);
              if (!pos) return null;

              const unlocked = isUnlocked(tech);
              const maxAvailable = getMaxAvailableLevel(tech);
              const selectedLevel = selectedLevels.get(tech.id) || 0;

              return (
                <ResearchTreeNode
                  key={tech.id}
                  tech={tech}
                  x={pos.x + svgDimensions.offsetX}
                  y={pos.y + svgDimensions.offsetY}
                  selectedLevel={selectedLevel}
                  maxAvailable={maxAvailable}
                  unlocked={unlocked}
                  formatNumber={formatNumber}
                  onLevelChange={onLevelChange}
                  onUnlockClick={unlockWithPrerequisites}
                  lang={lang}
                />
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
