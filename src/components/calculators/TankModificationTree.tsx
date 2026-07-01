import { useMemo, useRef, useCallback, useEffect, useState } from 'preact/hooks';
import { useTreeZoom, calculateMobileZoom, TREE_ZOOM_DEFAULTS } from '../../hooks/useTreeZoom';
import TankModificationNode from './TankModificationNode';
import TankLevelSheet from './TankLevelSheet';
import TankModificationConnections from './TankModificationConnections';
import TreeControls from './TreeControls';
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
import { BREAKPOINT_MOBILE } from '../../config/game';

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

  const { zoomLevel, setZoomLevel, handleZoomIn, handleZoomOut,
    handleScrollLeft, handleScrollRight, handleScrollUp, handleScrollDown,
    resetView } = useTreeZoom(scrollContainerRef);

  const [focusedNodeLevel, setFocusedNodeLevel] = useState<number | null>(null);
  const [sheetLevel, setSheetLevel] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const formatNumber = (num: number) => sharedFormatNumber(num, lang);

  // Set mounted flag and detect mobile/desktop on mount and resize
  useEffect(() => {
    setMounted(true);

    const handleResize = () => {
      const mobile = window.innerWidth < BREAKPOINT_MOBILE;
      setIsMobile(mobile);
    };

    // Immediate check on mount
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate zigzag layout positions (responsive: 3 nodes on mobile, 5 on desktop)
  // IMPORTANT: Only use responsive layout after client-side hydration to avoid SSR mismatch
  const nodePositions = useMemo((): Map<number, NodePosition> => {
    const positions = new Map<number, NodePosition>();
    // Use responsive layout only after mounting on client
    const nodesPerRow = (mounted && isMobile) ? 3 : NODES_PER_ROW; // 3 on mobile, 5 on desktop

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
    const padding = (mounted && isMobile) ? 10 : TREE_ZOOM_DEFAULTS.SVG_PADDING;
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

      setFocusedNodeLevel(centerNodeLevel);
    }
  }, [modifications, focusedNodeLevel, nodePositions]);

  // Calculate initial zoom to fit content perfectly on mobile
  useEffect(() => {
    if (!scrollContainerRef.current || !mounted) return;
    if (isMobile) {
      setZoomLevel(calculateMobileZoom(scrollContainerRef.current, NODE_SPACING_X * 3));
    } else {
      setZoomLevel(1);
    }
  }, [svgDimensions, mounted, isMobile]);

  // Sheet-Auswahl: Sub-Level setzen + kaskadierende Auto-Entsperrung — alles in
  // EINEM State-Update (sonst würde der 2. Setter mit stale State den 1. überschreiben).
  // Regeln: dieser Level + alle vorigen werden entsperrt und vorige auf Max gesetzt;
  // liegt dieser Level unter Max, werden alle folgenden abgewählt und gesperrt.
  const handleSheetSelect = useCallback((level: number, subLevel: number) => {
    const currentIndex = modifications.findIndex(m => m.level === level);
    if (currentIndex < 0) return;
    const mod = modifications[currentIndex];

    const newSet = new Set(unlockedLevels);
    const newMap = new Map(subLevels);

    // Dieser Level + alle vorigen entsperren; vorige auf Max
    for (let i = 0; i <= currentIndex; i++) {
      newSet.add(modifications[i].level);
    }
    for (let i = 0; i < currentIndex; i++) {
      newMap.set(modifications[i].level, modifications[i].subLevels);
    }

    // Gewähltes Sub-Level setzen
    newMap.set(level, subLevel);

    // Unter Max -> alle folgenden abwählen + sperren (Kaskade nach unten)
    if (subLevel < mod.subLevels) {
      for (let i = currentIndex + 1; i < modifications.length; i++) {
        newMap.set(modifications[i].level, 0);
        newSet.delete(modifications[i].level);
      }
    }

    onSubLevelsChange(newMap);
    onUnlockedLevelsChange(newSet);
  }, [modifications, subLevels, unlockedLevels, onSubLevelsChange, onUnlockedLevelsChange]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let isDown = false;
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;
    let touchStarted = false;

    const shouldAllowScroll = (target: EventTarget | null): boolean => {
      if (!target) return true;
      const element = target as HTMLElement;
      if (
        element.tagName === 'INPUT' ||
        element.tagName === 'BUTTON' ||
        element.tagName === 'A' ||
        element.closest('input') ||
        element.closest('button') ||
        element.closest('a')
      ) return true;
      if (element.closest('[data-clickable="true"]')) return true;
      if (element.closest('[data-node-element="true"]')) return false;
      if (element.closest('foreignObject')) return false;
      return true;
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.closest('input') || target.closest('foreignObject')) return;
      if (!shouldAllowScroll(e.target)) return;
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
      container.scrollLeft = scrollLeft - (x - startX) * 1.5;
      container.scrollTop = scrollTop - (y - startY) * 1.5;
    };

    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (e.touches.length > 1) { touchStarted = false; return; }
      if (
        target.tagName === 'INPUT' ||
        (target instanceof HTMLInputElement && target.type === 'range') ||
        target.closest('input[type="range"]') ||
        target.closest('input') ||
        target.closest('foreignObject')
      ) return;
      // Knoten getippt: KEIN preventDefault (sonst kein Click -> Sheet öffnet auf Mobile nicht)
      if (!shouldAllowScroll(e.target)) { return; }
      touchStarted = true;
      const touch = e.touches[0];
      startX = touch.pageX - container.offsetLeft;
      startY = touch.pageY - container.offsetTop;
      scrollLeft = container.scrollLeft;
      scrollTop = container.scrollTop;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) { touchStarted = false; return; }
      if (!touchStarted) return;
    };

    const handleTouchEnd = () => { touchStarted = false; };

    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
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
        padding: (mounted && isMobile) ? `${TREE_ZOOM_DEFAULTS.CONTAINER_PADDING_MOBILE}rem` : `${TREE_ZOOM_DEFAULTS.CONTAINER_PADDING_DESKTOP}rem`,
        paddingBottom: (mounted && isMobile) ? '120px' : '140px',
        WebkitOverflowScrolling: 'touch' as const,
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

            const isUnlocked = unlockedLevels.has(mod.level);
            const currentSubLevel = subLevels.get(mod.level) || 0;

            return (
              <TankModificationNode
                key={`${mod.level}:${isUnlocked ? 'u' : 'l'}`}
                mod={mod}
                x={pos.x + svgDimensions.offsetX}
                y={pos.y + svgDimensions.offsetY}
                currentSubLevel={currentSubLevel}
                maxSubLevel={mod.subLevels}
                unlocked={isUnlocked}
                isTarget={targetLevel === mod.level}
                formatNumber={formatNumber}
                onOpenSheet={(m) => setSheetLevel(m.level)}
                onSetTarget={() => onTargetLevelChange(mod.level)}
                onFocus={() => setFocusedNodeLevel(mod.level)}
                lang={lang}
                translationData={translationData}
              />
            );
          })}
        </svg>

    </div>
      <TreeControls
        zoomLevel={zoomLevel}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={() => resetView((mounted && isMobile) ? () => NODE_SPACING_X * 3 : undefined)}
        onScrollUp={handleScrollUp}
        onScrollDown={handleScrollDown}
        onScrollLeft={handleScrollLeft}
        onScrollRight={handleScrollRight}
      />
      {sheetLevel !== null && (() => {
        const m = modifications.find(mm => mm.level === sheetLevel);
        if (!m) return null;
        return (
          <TankLevelSheet
            mod={m}
            currentSubLevel={subLevels.get(sheetLevel) || 0}
            unlocked={unlockedLevels.has(sheetLevel)}
            onSelect={(sl) => { handleSheetSelect(sheetLevel, sl); setSheetLevel(null); }}
            onClose={() => setSheetLevel(null)}
            lang={lang}
            translationData={translationData}
          />
        );
      })()}
    </div>
  );
}
