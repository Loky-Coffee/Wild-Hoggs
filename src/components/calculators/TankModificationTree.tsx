import { useMemo, useRef, useCallback, useEffect, useState } from 'preact/hooks';
import TankModificationNode from './TankModificationNode';
import TankModificationConnections from './TankModificationConnections';
import { formatNumber as sharedFormatNumber } from '../../utils/formatters';
import type { TranslationData } from '../../i18n/index';
import {
  NODE_WIDTH,
  NODE_HEIGHT,
  TANK_NODE_SPACING_X as NODE_SPACING_X,
  TANK_NODE_SPACING_Y as NODE_SPACING_Y,
  TANK_NODES_PER_ROW as NODES_PER_ROW,
  calculateSVGDimensions
} from '../../utils/treeNodeConfig';

interface TankModification {
  level: number;
  nameKey: string;
  wrenchesPerSub: number;
  subLevels: number;
  totalWrenches: number;
  cumulativeTotal: number;
  isVehicle?: boolean;
}

interface NodePosition {
  x: number;
  y: number;
  row: number;
  col: number;
}

interface TankModificationTreeProps {
  readonly modifications: TankModification[];
  readonly unlockedLevels: Set<number>;
  readonly subLevels: Map<number, number>;
  readonly onUnlockedLevelsChange: (levels: Set<number>) => void;
  readonly onSubLevelsChange: (levels: Map<number, number>) => void;
  readonly targetLevel: number | null;
  readonly onTargetLevelChange: (level: number | null) => void;
  readonly lang: 'de' | 'en';
  readonly translationData: TranslationData;
}


export default function TankModificationTree({
  modifications,
  unlockedLevels,
  subLevels,
  onUnlockedLevelsChange,
  onSubLevelsChange,
  targetLevel,
  onTargetLevelChange,
  lang,
  translationData
}: TankModificationTreeProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const [zoomLevel, setZoomLevel] = useState(1);
  const [focusedNodeLevel, setFocusedNodeLevel] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const MIN_ZOOM = 0.3;
  const MAX_ZOOM = 2.0;
  const ZOOM_STEP = 0.2;
  const SVG_PADDING = 5;
  const CONTAINER_PADDING_MOBILE = 0.5; // rem
  const CONTAINER_PADDING_DESKTOP = 1; // rem

  const formatNumber = (num: number) => sharedFormatNumber(num, lang);

  // Set mounted flag and detect mobile/desktop on mount and resize
  useEffect(() => {
    console.log('[TankTree] Mount effect running...');
    setMounted(true);

    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      console.log('[TankTree] handleResize called:', { innerWidth: window.innerWidth, mobile });
      setIsMobile(mobile);
    };

    // Immediate check on mount
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Log state changes
  useEffect(() => {
    console.log('[TankTree] State changed:', { mounted, isMobile });
  }, [mounted, isMobile]);

  // Calculate zigzag layout positions (responsive: 3 nodes on mobile, 5 on desktop)
  // IMPORTANT: Only use responsive layout after client-side hydration to avoid SSR mismatch
  const nodePositions = useMemo((): Map<number, NodePosition> => {
    const positions = new Map<number, NodePosition>();
    // Use responsive layout only after mounting on client
    const nodesPerRow = (mounted && isMobile) ? 3 : NODES_PER_ROW; // 3 on mobile, 5 on desktop

    // Log first 10 modifications to see their levels
    const firstMods = modifications.slice(0, 10).map(m => m.level);
    console.log('[TankTree] Calculating nodePositions:', {
      mounted,
      isMobile,
      nodesPerRow,
      windowWidth: typeof window !== 'undefined' ? window.innerWidth : 'unknown',
      modificationsCount: modifications.length,
      firstModLevels: firstMods
    });

    // Log all nodes in first row
    const firstRowNodes = modifications.slice(0, nodesPerRow).map((m, idx) => ({
      index: idx,
      level: m.level,
      row: Math.floor(idx / nodesPerRow),
      col: Math.floor(idx / nodesPerRow) % 2 === 0 ? idx % nodesPerRow : (nodesPerRow - 1) - (idx % nodesPerRow)
    }));
    console.log('[TankTree] First row nodes:', firstRowNodes);

    modifications.forEach((mod, index) => {
      const row = Math.floor(index / nodesPerRow);
      const isEvenRow = row % 2 === 0;

      let col: number;
      if (isEvenRow) {
        col = index % nodesPerRow;
      } else {
        col = (nodesPerRow - 1) - (index % nodesPerRow);
      }

      const x = col * NODE_SPACING_X;
      const y = row * NODE_SPACING_Y;

      positions.set(mod.level, { x, y, row, col });
    });

    return positions;
  }, [modifications, mounted, isMobile]);

  const svgDimensions = useMemo(() => {
    const padding = (mounted && isMobile) ? 10 : SVG_PADDING;
    return calculateSVGDimensions(nodePositions, padding);
  }, [nodePositions, mounted, isMobile]);

  useEffect(() => {
    if (focusedNodeLevel === null && modifications.length > 0 && nodePositions.size > 0) {
      let centerNodeLevel = modifications[0].level;
      let minDistanceToCenter = Infinity;

      nodePositions.forEach((pos, level) => {
        const distanceToCenter = Math.abs(pos.x);
        if (distanceToCenter < minDistanceToCenter) {
          minDistanceToCenter = distanceToCenter;
          centerNodeLevel = level;
        }
      });

      console.log('Auto-focusing center node level:', centerNodeLevel);
      setFocusedNodeLevel(centerNodeLevel);
    }
  }, [modifications, focusedNodeLevel, nodePositions]);

  // Calculate initial zoom to fit content perfectly on mobile
  useEffect(() => {
    if (!scrollContainerRef.current || !mounted) return;

    const container = scrollContainerRef.current;
    const containerWidth = container.clientWidth;

    if (isMobile) {
      // Get actual computed padding to calculate available space
      const computedStyle = window.getComputedStyle(container);
      const paddingLeft = parseFloat(computedStyle.paddingLeft);
      const paddingRight = parseFloat(computedStyle.paddingRight);
      const containerPadding = paddingLeft + paddingRight;
      const availableWidth = containerWidth - containerPadding;

      // Target: show 3 nodes side-by-side (exact width calculation like ResearchTree)
      const targetContentWidth = NODE_SPACING_X * 3;

      // Calculate zoom to fit content perfectly in available space
      const calculatedZoom = availableWidth / targetContentWidth;
      const finalZoom = Math.max(Math.min(calculatedZoom, 1), MIN_ZOOM);

      console.log('[TankModificationTree] Initial mobile zoom:', {
        containerWidth,
        containerPadding,
        availableWidth,
        targetContentWidth,
        svgWidth: svgDimensions.width,
        svgHeight: svgDimensions.height,
        scaledWidth: svgDimensions.width * finalZoom,
        scaledHeight: svgDimensions.height * finalZoom,
        calculatedZoom,
        finalZoom
      });

      setZoomLevel(finalZoom);
    } else {
      setZoomLevel(1);
    }
  }, [svgDimensions, mounted, isMobile]);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  };

  const handleResetView = () => {
    // Reset zoom to initial mobile zoom or 1 for desktop
    if (mounted && isMobile && scrollContainerRef.current) {
      // Recalculate initial mobile zoom
      const container = scrollContainerRef.current;
      const containerWidth = container.clientWidth;
      const computedStyle = window.getComputedStyle(container);
      const paddingLeft = parseFloat(computedStyle.paddingLeft);
      const paddingRight = parseFloat(computedStyle.paddingRight);
      const containerPadding = paddingLeft + paddingRight;
      const availableWidth = containerWidth - containerPadding;
      const targetContentWidth = NODE_SPACING_X * 3;
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

  // Handle sub-level change with dependency logic
  const handleSubLevelChange = useCallback((level: number, subLevel: number) => {
    const newMap = new Map(subLevels);
    const currentMod = modifications.find(m => m.level === level);
    if (!currentMod) return;

    newMap.set(level, subLevel);

    const wasMax = subLevels.get(level) === currentMod.subLevels;
    const isNowLessThanMax = subLevel < currentMod.subLevels;

    if (wasMax && isNowLessThanMax) {
      const currentIndex = modifications.findIndex(m => m.level === level);
      for (let i = currentIndex + 1; i < modifications.length; i++) {
        newMap.set(modifications[i].level, 0);
      }
    }

    onSubLevelsChange(newMap);

    const newSet = new Set(unlockedLevels);

    if (isNowLessThanMax) {
      const currentIndex = modifications.findIndex(m => m.level === level);
      for (let i = currentIndex + 1; i < modifications.length; i++) {
        newSet.delete(modifications[i].level);
      }
    }

    onUnlockedLevelsChange(newSet);
  }, [modifications, subLevels, unlockedLevels, onSubLevelsChange, onUnlockedLevelsChange]);

  // Handle unlock - set all previous to MAX
  const handleUnlock = useCallback((mod: TankModification) => {
    const currentIndex = modifications.findIndex(m => m.level === mod.level);

    const newSet = new Set(unlockedLevels);
    newSet.add(mod.level);
    for (let i = 0; i <= currentIndex; i++) {
      newSet.add(modifications[i].level);
    }
    onUnlockedLevelsChange(newSet);

    const newMap = new Map(subLevels);
    for (let i = 0; i < currentIndex; i++) {
      const prevMod = modifications[i];
      newMap.set(prevMod.level, prevMod.subLevels);
    }
    newMap.set(mod.level, 0);
    onSubLevelsChange(newMap);
  }, [modifications, subLevels, unlockedLevels, onUnlockedLevelsChange, onSubLevelsChange]);

  // Drag-to-scroll (EXACT copy from ResearchTreeView)
  const handleMouseDown = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-node-element="true"]') || target.tagName === 'INPUT') {
      return;
    }

    isDraggingRef.current = true;
    const container = scrollContainerRef.current;
    if (container) {
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop
      };
      container.style.cursor = 'grabbing';
      container.style.userSelect = 'none';
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return;

    const container = scrollContainerRef.current;
    if (container) {
      const dx = (e.clientX - dragStartRef.current.x) * 1.5;
      const dy = (e.clientY - dragStartRef.current.y) * 1.5;
      container.scrollLeft = dragStartRef.current.scrollLeft - dx;
      container.scrollTop = dragStartRef.current.scrollTop - dy;
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    const container = scrollContainerRef.current;
    if (container) {
      container.style.cursor = 'grab';
      container.style.userSelect = '';
    }
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('mousedown', handleMouseDown as any);
    document.addEventListener('mousemove', handleMouseMove as any);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown as any);
      document.removeEventListener('mousemove', handleMouseMove as any);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={scrollContainerRef}
      className="research-tree-container layout-vertical"
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
        padding: (mounted && isMobile) ? `${CONTAINER_PADDING_MOBILE}rem` : `${CONTAINER_PADDING_DESKTOP}rem`,
        paddingBottom: (mounted && isMobile) ? '120px' : '140px',
        WebkitOverflowScrolling: 'touch' as any,
        touchAction: 'pan-x pan-y pinch-zoom',
        cursor: 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}
    >
        <svg
          ref={svgRef}
          width={svgDimensions.width * zoomLevel}
          height={svgDimensions.height * zoomLevel}
          viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
          style={{ display: 'block' }}
        >
          {/* Connections */}
          <TankModificationConnections
            modifications={modifications}
            nodePositions={nodePositions}
            unlockedLevels={unlockedLevels}
            svgDimensions={svgDimensions}
          />

          {/* Nodes */}
          {modifications.map((mod, index) => {
            const pos = nodePositions.get(mod.level);
            if (!pos) return null;

            // Debug: log first 5 node positions
            if (index < 5) {
              console.log(`[TankTree] Rendering node ${index}:`, {
                level: mod.level,
                x: pos.x,
                y: pos.y,
                row: pos.row,
                col: pos.col
              });
            }

            const isUnlocked = unlockedLevels.has(mod.level);
            const currentSubLevel = subLevels.get(mod.level) || 0;

            return (
              <TankModificationNode
                key={mod.level}
                mod={mod}
                x={pos.x + svgDimensions.offsetX}
                y={pos.y + svgDimensions.offsetY}
                currentSubLevel={currentSubLevel}
                maxSubLevel={mod.subLevels}
                unlocked={isUnlocked}
                isTarget={targetLevel === mod.level}
                formatNumber={formatNumber}
                onSubLevelChange={handleSubLevelChange}
                onUnlockClick={handleUnlock}
                onSetTarget={() => onTargetLevelChange(mod.level)}
                onFocus={() => setFocusedNodeLevel(mod.level)}
                lang={lang}
                translationData={translationData}
              />
            );
          })}
        </svg>

      {/* Zoom Controls */}
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
