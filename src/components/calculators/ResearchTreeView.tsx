import { useMemo, useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { Technology } from '../../schemas/research';
import { formatNumber as sharedFormatNumber } from '../../utils/formatters';
import type { TranslationData } from '../../i18n/index';
import ResearchTreeNode from './ResearchTreeNode';
import ResearchTreeConnections from './ResearchTreeConnections';
import {
  NODE_WIDTH,
  NODE_HEIGHT,
  RESEARCH_TIER_SPACING as TIER_SPACING,
  RESEARCH_NODE_SPACING as NODE_SPACING,
  calculateSVGDimensions,
  type TreeNodePosition,
  type SVGDimensions
} from '../../utils/treeNodeConfig';
import { BREAKPOINT_MOBILE } from '../../config/game';

interface ResearchTreeViewProps {
  readonly technologies: Technology[];
  readonly selectedLevels: Map<string, number>;
  readonly onLevelChange: (techId: string, level: number) => void;
  readonly onBatchLevelChange: (updates: Map<string, number>) => void;
  readonly targetTechId: string | null;
  readonly onTargetTechIdChange: (techId: string | null) => void;
  readonly layoutDirection: 'horizontal' | 'vertical';
  readonly lang: 'de' | 'en';
  readonly translationData: TranslationData;
}


export default function ResearchTreeView({
  technologies,
  selectedLevels,
  onLevelChange,
  onBatchLevelChange,
  targetTechId,
  onTargetTechIdChange,
  layoutDirection,
  lang,
  translationData
}: ResearchTreeViewProps) {

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [zoomLevel, setZoomLevel] = useState(1);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const MIN_ZOOM = 0.3;
  const MAX_ZOOM = 2.0;
  const ZOOM_STEP = 0.2;
  const SVG_PADDING = 5;
  const CONTAINER_PADDING_MOBILE = 0.5; // rem
  const CONTAINER_PADDING_DESKTOP = 1; // rem

  const tiers = useMemo((): Map<string, number> => {
    const tiersMap = new Map<string, number>();
    const visited = new Set<string>();

    const calculateTier = (techId: string): number => {
      if (tiersMap.has(techId)) {
        return tiersMap.get(techId) ?? 0;
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

  const svgDimensions = useMemo(() => {
    return calculateSVGDimensions(nodePositions, SVG_PADDING);
  }, [nodePositions]);

  // Calculate initial zoom to fit content perfectly on mobile
  useEffect(() => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const containerWidth = container.clientWidth;
    const viewportWidth = window.innerWidth;
    const isMobile = viewportWidth < BREAKPOINT_MOBILE;

    if (isMobile) {
      // Get actual computed padding to calculate available space
      const computedStyle = window.getComputedStyle(container);
      const paddingLeft = parseFloat(computedStyle.paddingLeft);
      const paddingRight = parseFloat(computedStyle.paddingRight);
      const containerPadding = paddingLeft + paddingRight;
      const availableWidth = containerWidth - containerPadding;

      // Target: show 3 nodes side-by-side in vertical layout
      const targetContentWidth = layoutDirection === 'vertical'
        ? NODE_SPACING * 3  // Width for 3 nodes
        : svgDimensions.width * 0.95;

      // Calculate zoom to fit content perfectly in available space
      const calculatedZoom = availableWidth / targetContentWidth;
      const finalZoom = Math.max(Math.min(calculatedZoom, 1), MIN_ZOOM);

      setZoomLevel(finalZoom);
    } else {
      setZoomLevel(1);
    }
  }, [svgDimensions, layoutDirection]);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  };

  const handleResetView = () => {
    // Reset zoom to initial mobile zoom or 1 for desktop
    const viewportWidth = window.innerWidth;
    const isMobile = viewportWidth < BREAKPOINT_MOBILE;

    if (isMobile && scrollContainerRef.current) {
      // Recalculate initial mobile zoom
      const container = scrollContainerRef.current;
      const containerWidth = container.clientWidth;
      const computedStyle = window.getComputedStyle(container);
      const paddingLeft = parseFloat(computedStyle.paddingLeft);
      const paddingRight = parseFloat(computedStyle.paddingRight);
      const containerPadding = paddingLeft + paddingRight;
      const availableWidth = containerWidth - containerPadding;
      const targetContentWidth = layoutDirection === 'vertical' ? NODE_SPACING * 3 : svgDimensions.width * 0.95;
      const calculatedZoom = availableWidth / targetContentWidth;
      const finalZoom = Math.max(Math.min(calculatedZoom, 1), MIN_ZOOM);
      setZoomLevel(finalZoom);
    } else {
      setZoomLevel(1);
    }

    // Scroll to center
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      container.scrollTo({
        left: (container.scrollWidth - container.clientWidth) / 2,
        top: (container.scrollHeight - container.clientHeight) / 2,
        behavior: 'smooth'
      });
    }
  };

  // Navigation scroll handlers - scroll by 80% of viewport (20% overlap)
  const handleScrollLeft = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  };

  const handleScrollRight = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  const handleScrollUp = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollAmount = container.clientHeight * 0.8;
    container.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
  };

  const handleScrollDown = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollAmount = container.clientHeight * 0.8;
    container.scrollBy({ top: scrollAmount, behavior: 'smooth' });
  };

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

  const formatNumber = useCallback((num: number) => sharedFormatNumber(num, lang), [lang]);

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
        padding: typeof window !== 'undefined' && window.innerWidth < BREAKPOINT_MOBILE ? `${CONTAINER_PADDING_MOBILE}rem` : `${CONTAINER_PADDING_DESKTOP}rem`,
        paddingBottom: typeof window !== 'undefined' && window.innerWidth < BREAKPOINT_MOBILE ? '120px' : '140px',
        WebkitOverflowScrolling: 'touch' as const,
        touchAction: 'pan-x pan-y pinch-zoom',
        cursor: 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}
    >
          <svg
            width={svgDimensions.width * zoomLevel}
            height={svgDimensions.height * zoomLevel}
            viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
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
                  isTarget={targetTechId === tech.id}
                  formatNumber={formatNumber}
                  onLevelChange={onLevelChange}
                  onUnlockClick={unlockWithPrerequisites}
                  onSetTarget={() => onTargetTechIdChange(tech.id)}
                  onFocus={() => {
                    setFocusedNodeId(tech.id);
                  }}
                  lang={lang}
                  translationData={translationData}
                />
              );
            })}
          </svg>

      <div
        className="zoom-controls"
        style={{
          position: 'fixed',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          zIndex: 1000
        }}
      >
        <style>{`
          .zoom-controls {
            bottom: 1rem;
            right: 1rem;
          }
          @media (min-width: 769px) {
            .zoom-controls {
              bottom: 2rem;
              right: 2rem;
            }
          }
          .research-tree-node:focus .node-focus-indicator {
            opacity: 1 !important;
          }
          .research-tree-node:focus {
            outline: none;
          }
        `}</style>
        <button
          onClick={handleZoomIn}
          disabled={zoomLevel >= MAX_ZOOM}
          style={{
            background: 'rgba(0, 0, 0, 0.8)',
            border: '1px solid rgba(255, 165, 0, 0.6)',
            borderRadius: '4px',
            padding: '0.25rem',
            cursor: zoomLevel >= MAX_ZOOM ? 'not-allowed' : 'pointer',
            fontSize: '1.2rem',
            color: '#ffa500',
            fontWeight: 'bold',
            opacity: zoomLevel >= MAX_ZOOM ? 0.4 : 1,
            transition: 'all 0.2s',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          aria-label="Zoom in"
        >
          +
        </button>

        <button
          onClick={handleResetView}
          style={{
            background: 'rgba(0, 0, 0, 0.8)',
            border: '1px solid rgba(255, 165, 0, 0.6)',
            borderRadius: '4px',
            padding: '0.25rem',
            cursor: 'pointer',
            fontSize: '1rem',
            color: '#ffa500',
            fontWeight: 'bold',
            transition: 'all 0.2s',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          aria-label="Reset view"
          title="Reset view"
        >
          ⊙
        </button>

        <button
          onClick={handleZoomOut}
          disabled={zoomLevel <= MIN_ZOOM}
          style={{
            background: 'rgba(0, 0, 0, 0.8)',
            border: '1px solid rgba(255, 165, 0, 0.6)',
            borderRadius: '4px',
            padding: '0.25rem',
            cursor: zoomLevel <= MIN_ZOOM ? 'not-allowed' : 'pointer',
            fontSize: '1.2rem',
            color: '#ffa500',
            fontWeight: 'bold',
            opacity: zoomLevel <= MIN_ZOOM ? 0.4 : 1,
            transition: 'all 0.2s',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          aria-label="Zoom out"
        >
          −
        </button>
      </div>

      {/* Navigation Controls */}
      <div
        className="navigation-controls"
        style={{
          position: 'fixed',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 32px)',
          gridTemplateRows: 'repeat(3, 32px)',
          gap: '0.25rem',
          zIndex: 1000
        }}
      >
        <style>{`
          .navigation-controls {
            bottom: 1rem;
            left: 1rem;
          }
          @media (min-width: 769px) {
            .navigation-controls {
              bottom: 2rem;
              left: 2rem;
            }
          }
        `}</style>

        {/* Up arrow - top center */}
        <button
          onClick={handleScrollUp}
          style={{
            gridColumn: '2',
            gridRow: '1',
            background: 'rgba(0, 0, 0, 0.8)',
            border: '1px solid rgba(255, 165, 0, 0.6)',
            borderRadius: '4px',
            padding: '0.25rem',
            cursor: 'pointer',
            fontSize: '1rem',
            color: '#ffa500',
            fontWeight: 'bold',
            transition: 'all 0.2s',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          aria-label="Scroll up"
        >
          ▲
        </button>

        {/* Left arrow - middle left */}
        <button
          onClick={handleScrollLeft}
          style={{
            gridColumn: '1',
            gridRow: '2',
            background: 'rgba(0, 0, 0, 0.8)',
            border: '1px solid rgba(255, 165, 0, 0.6)',
            borderRadius: '4px',
            padding: '0.25rem',
            cursor: 'pointer',
            fontSize: '1rem',
            color: '#ffa500',
            fontWeight: 'bold',
            transition: 'all 0.2s',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          aria-label="Scroll left"
        >
          ◄
        </button>

        {/* Right arrow - middle right */}
        <button
          onClick={handleScrollRight}
          style={{
            gridColumn: '3',
            gridRow: '2',
            background: 'rgba(0, 0, 0, 0.8)',
            border: '1px solid rgba(255, 165, 0, 0.6)',
            borderRadius: '4px',
            padding: '0.25rem',
            cursor: 'pointer',
            fontSize: '1rem',
            color: '#ffa500',
            fontWeight: 'bold',
            transition: 'all 0.2s',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          aria-label="Scroll right"
        >
          ►
        </button>

        {/* Down arrow - bottom center */}
        <button
          onClick={handleScrollDown}
          style={{
            gridColumn: '2',
            gridRow: '3',
            background: 'rgba(0, 0, 0, 0.8)',
            border: '1px solid rgba(255, 165, 0, 0.6)',
            borderRadius: '4px',
            padding: '0.25rem',
            cursor: 'pointer',
            fontSize: '1rem',
            color: '#ffa500',
            fontWeight: 'bold',
            transition: 'all 0.2s',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          aria-label="Scroll down"
        >
          ▼
        </button>
      </div>
    </div>
  );
}
