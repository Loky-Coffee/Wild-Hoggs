import { useMemo, useCallback, useEffect, useRef } from 'preact/hooks';
import type { Technology } from '../../schemas/research';
import { formatNumber as sharedFormatNumber } from '../../utils/formatters';
import ResearchTreeNode from './ResearchTreeNode';
import ResearchTreeConnections from './ResearchTreeConnections';

interface TreeNodePosition {
  x: number;
  y: number;
  tier: number;
}

interface ResearchTreeViewProps {
  readonly technologies: Technology[];
  readonly selectedLevels: Map<string, number>;
  readonly onLevelChange: (techId: string, level: number) => void;
  readonly onBatchLevelChange: (updates: Map<string, number>) => void;
  readonly layoutDirection: 'horizontal' | 'vertical';
  readonly lang: 'de' | 'en';
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 180;
const TIER_SPACING = 320;
const NODE_SPACING = 240;

export default function ResearchTreeView({
  technologies,
  selectedLevels,
  onLevelChange,
  onBatchLevelChange,
  layoutDirection,
  lang
}: ResearchTreeViewProps) {

  // Calculate tier for each technology (depth in dependency tree)
  // Memoized separately so tiers are only recalculated when technologies change
  const tiers = useMemo((): Map<string, number> => {
    const tiersMap = new Map<string, number>();
    const visited = new Set<string>();

    const calculateTier = (techId: string): number => {
      if (tiersMap.has(techId)) {
        const tier = tiersMap.get(techId);
        return tier !== undefined ? tier : 0;
      }
      if (visited.has(techId)) return 0;

      visited.add(techId);
      const tech = technologies.find(t => t.id === techId);
      if (!tech || tech.prerequisites.length === 0) {
        tiersMap.set(techId, 0);
        return 0;
      }

      const maxPrereqTier = Math.max(...tech.prerequisites.map(prereq => {
        const prereqId = typeof prereq === 'string' ? prereq : prereq.id;
        return calculateTier(prereqId);
      }));
      const tier = maxPrereqTier + 1;
      tiersMap.set(techId, tier);
      return tier;
    };

    technologies.forEach(tech => calculateTier(tech.id));
    return tiersMap;
  }, [technologies]);

  // Calculate positions for all nodes
  // NO auto-correction - rely on slider clamping and maxAvailable to prevent invalid states

  const nodePositions = useMemo((): Map<string, TreeNodePosition> => {
    const positions = new Map<string, TreeNodePosition>();

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
  }, [tiers, layoutDirection]);

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
    // Only track NEW updates (deltas), not full state - prevents race conditions
    const updates = new Map<string, number>();

    // Helper to process a single prerequisite
    const processPrerequisite = (prereq: string | { id: string; requiredLevel?: number }) => {
      const prereqId = typeof prereq === 'string' ? prereq : prereq.id;
      const prereqTech = technologies.find(tech => tech.id === prereqId);

      if (!prereqTech) return;

      // First unlock the prerequisites of this prerequisite
      unlockPrereqs(prereqTech);

      // Then set this prerequisite to MAX level (only new updates)
      updates.set(prereqId, prereqTech.maxLevel);
    };

    // Recursive function to unlock all prerequisites to MAX level
    const unlockPrereqs = (t: Technology) => {
      t.prerequisites.forEach(processPrerequisite);
    };

    // Unlock all prerequisites to max
    unlockPrereqs(tech);

    // Apply only the new changes (deltas) - prevents race condition state loss
    onBatchLevelChange(updates);
  };

  // Use shared formatNumber utility
  const formatNumber = useCallback((num: number) => sharedFormatNumber(num, lang), [lang]);

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

      // Allow clicks on clickable elements (like unlock button)
      if (element.closest('[data-clickable="true"]')) {
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
      const target = e.target as HTMLElement;

      // Block drag-to-scroll on inputs and interactive elements
      if (
        target.tagName === 'INPUT' ||
        target.closest('input') ||
        target.closest('foreignObject')
      ) {
        return;
      }

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
      const target = e.target as HTMLElement;

      // Allow pinch-zoom: If more than one touch point, don't interfere
      if (e.touches.length > 1) {
        touchStarted = false;
        return;
      }

      // Allow input interaction without scrolling or preventDefault
      // CRITICAL: Let iOS Safari handle range inputs completely natively
      if (
        target.tagName === 'INPUT' ||
        (target instanceof HTMLInputElement && target.type === 'range') ||
        target.closest('input[type="range"]') ||
        target.closest('input') ||
        target.closest('foreignObject')
      ) {
        // Don't preventDefault - let input work normally
        // Don't set touchStarted - don't trigger scrolling
        return;
      }

      // Check if touch started on a node
      if (!shouldAllowScroll(e.target)) {
        // Prevent scrolling when touching nodes (but not inputs)
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
      // Allow pinch-zoom: If more than one touch point, stop drag-scroll
      if (e.touches.length > 1) {
        touchStarted = false;
        return;
      }

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

  // Render tree with connections and nodes using extracted components
  return (
    <div
      ref={scrollContainerRef}
      className={`research-tree-container ${layoutDirection === 'vertical' ? 'layout-vertical' : 'layout-horizontal'}`}
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        overflow: 'auto',
        background: `
          radial-gradient(circle, rgba(255, 165, 0, 0.15) 1.5px, transparent 1.5px),
          rgba(0, 0, 0, 0.3)
        `,
        backgroundSize: '30px 30px',
        borderRadius: '12px',
        padding: '1rem',
        WebkitOverflowScrolling: 'touch' as const,
        touchAction: 'manipulation',
        cursor: 'grab',
        display: 'flex',
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
