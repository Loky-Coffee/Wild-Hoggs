import { useMemo, useCallback, useState, useEffect, useRef } from 'preact/hooks';
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
  // NO auto-correction - rely on slider clamping and maxAvailable to prevent invalid states

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

    // First check if tech is unlocked at all
    if (!isUnlocked(tech)) return 0;

    // Categorize prerequisites as HARD or PROGRESSIVE
    // Hard: requiredLevel === prerequisite's maxLevel (must be fully met to unlock)
    // Progressive: requiredLevel < prerequisite's maxLevel (can level incrementally)
    const progressiveDeps = tech.prerequisites.filter(prereq => {
      const prereqTech = technologies.find(t =>
        t.id === (typeof prereq === 'string' ? prereq : prereq.id)
      );
      const reqLevel = typeof prereq === 'string' ? 1 : (prereq.requiredLevel || 1);
      // Progressive: requiredLevel < prerequisite's maxLevel
      return reqLevel < (prereqTech?.maxLevel || 1);
    });

    // If ANY prerequisite is progressive, cap at maximum current level of progressives
    // BUT: If a progressive prerequisite is at max level, don't limit based on it
    if (progressiveDeps.length > 0) {
      const progressiveLevels = progressiveDeps.map(prereq => {
        const prereqId = typeof prereq === 'string' ? prereq : prereq.id;
        const prereqTech = technologies.find(t => t.id === prereqId);
        const prereqCurrentLevel = selectedLevels.get(prereqId) || 0;
        const prereqMaxLevel = prereqTech?.maxLevel || 1;

        // If prerequisite is at max level, it doesn't limit us (return Infinity)
        if (prereqCurrentLevel >= prereqMaxLevel) {
          return Infinity;
        }

        return prereqCurrentLevel;
      });

      const maxProgressiveLevel = Math.max(...progressiveLevels);

      // If all progressive prerequisites are at max (maxProgressiveLevel is Infinity), no limit
      if (maxProgressiveLevel === Infinity) {
        return tech.maxLevel;
      }

      return Math.min(tech.maxLevel, maxProgressiveLevel);
    }

    // All prerequisites are hard: once unlocked, tech can level independently
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

  // Detect if we're on desktop (PC) or mobile
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth > 768);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Set initial state

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Drag-to-scroll functionality for both mouse and touch
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let isDown = false;
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;

    // Helper function to check if element should allow scrolling
    const shouldAllowScroll = (target: EventTarget | null): boolean => {
      if (!target) return true;
      const element = target as HTMLElement;

      // Allow scrolling on interactive elements
      if (
        element.tagName === 'INPUT' ||
        element.tagName === 'BUTTON' ||
        element.tagName === 'A' ||
        element.closest('input') ||
        element.closest('button') ||
        element.closest('a')
      ) {
        return true;
      }

      // Block scrolling on nodes (marked with data-node-element)
      if (element.closest('[data-node-element="true"]')) {
        return false;
      }

      // Block scrolling on foreignObject (contains sliders)
      if (element.closest('foreignObject')) {
        return false;
      }

      // Allow scrolling on empty space
      return true;
    };

    // Mouse event handlers
    const handleMouseDown = (e: MouseEvent) => {
      if (!shouldAllowScroll(e.target)) {
        return;
      }

      // Prevent text selection while dragging
      e.preventDefault();

      isDown = true;
      container.style.cursor = 'grabbing';
      startX = e.pageX - container.offsetLeft;
      startY = e.pageY - container.offsetTop;
      scrollLeft = container.scrollLeft;
      scrollTop = container.scrollTop;
    };

    const handleMouseLeave = () => {
      isDown = false;
      container.style.cursor = 'grab';
    };

    const handleMouseUp = () => {
      isDown = false;
      container.style.cursor = 'grab';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      const y = e.pageY - container.offsetTop;
      const walkX = (x - startX) * 1.5; // Scroll speed multiplier
      const walkY = (y - startY) * 1.5;
      container.scrollLeft = scrollLeft - walkX;
      container.scrollTop = scrollTop - walkY;
    };

    // Touch event handlers
    let touchStarted = false;

    const handleTouchStart = (e: TouchEvent) => {
      // Check if touch started on a node or interactive element
      if (!shouldAllowScroll(e.target)) {
        // Prevent scrolling when touching nodes
        e.preventDefault();
        return;
      }

      // Allow native scrolling on empty space
      touchStarted = true;
      const touch = e.touches[0];
      startX = touch.pageX - container.offsetLeft;
      startY = touch.pageY - container.offsetTop;
      scrollLeft = container.scrollLeft;
      scrollTop = container.scrollTop;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStarted) return;

      // Let browser handle native scrolling
      // We don't prevent default here to allow smooth native touch scrolling
    };

    const handleTouchEnd = () => {
      touchStarted = false;
    };

    // Add mouse event listeners
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mousemove', handleMouseMove);

    // Add touch event listeners
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      // Remove mouse listeners
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mousemove', handleMouseMove);

      // Remove touch listeners
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

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
    <div
      ref={scrollContainerRef}
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        overflow: 'auto',
        background: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '12px',
        padding: '1rem',
        WebkitOverflowScrolling: 'touch' as 'touch',
        touchAction: 'pan-x pan-y',
        cursor: 'grab',
        display: 'flex',
        justifyContent: isDesktop && layoutDirection === 'vertical' ? 'center' : 'flex-start',
        alignItems: 'flex-start',
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}
    >
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
  );
}
