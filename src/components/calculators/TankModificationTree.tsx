import { useMemo, useRef, useCallback, useEffect } from 'preact/hooks';
import TankModificationNode from './TankModificationNode';
import TankModificationConnections from './TankModificationConnections';
import { formatNumber as sharedFormatNumber } from '../../utils/formatters';
import type { TranslationData } from '../../i18n/index';

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
  readonly lang: 'de' | 'en';
  readonly translationData: TranslationData;
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 180;
const NODE_SPACING_X = 280;
const NODE_SPACING_Y = 300;
const NODES_PER_ROW = 5;

export default function TankModificationTree({
  modifications,
  unlockedLevels,
  subLevels,
  onUnlockedLevelsChange,
  onSubLevelsChange,
  lang,
  translationData
}: TankModificationTreeProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const formatNumber = (num: number) => sharedFormatNumber(num, lang);

  // Calculate zigzag layout positions
  const nodePositions = useMemo((): Map<number, NodePosition> => {
    const positions = new Map<number, NodePosition>();

    modifications.forEach((mod, index) => {
      const row = Math.floor(index / NODES_PER_ROW);
      const isEvenRow = row % 2 === 0;

      let col: number;
      if (isEvenRow) {
        col = index % NODES_PER_ROW;
      } else {
        col = (NODES_PER_ROW - 1) - (index % NODES_PER_ROW);
      }

      const x = col * NODE_SPACING_X;
      const y = row * NODE_SPACING_Y;

      positions.set(mod.level, { x, y, row, col });
    });

    return positions;
  }, [modifications]);

  // Calculate SVG dimensions with proper padding (EXACT copy from ResearchTreeView)
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

  // Handle sub-level change with dependency logic
  const handleSubLevelChange = useCallback((level: number, subLevel: number) => {
    onSubLevelsChange((prev) => {
      const newMap = new Map(prev);
      const currentMod = modifications.find(m => m.level === level);
      if (!currentMod) return prev;

      newMap.set(level, subLevel);

      const wasMax = prev.get(level) === currentMod.subLevels;
      const isNowLessThanMax = subLevel < currentMod.subLevels;

      if (wasMax && isNowLessThanMax) {
        const currentIndex = modifications.findIndex(m => m.level === level);
        for (let i = currentIndex + 1; i < modifications.length; i++) {
          newMap.set(modifications[i].level, 0);
        }
      }

      return newMap;
    });

    onUnlockedLevelsChange((prev) => {
      const newSet = new Set(prev);
      const currentMod = modifications.find(m => m.level === level);
      if (!currentMod) return prev;

      const isNowLessThanMax = subLevel < currentMod.subLevels;

      if (isNowLessThanMax) {
        const currentIndex = modifications.findIndex(m => m.level === level);
        for (let i = currentIndex + 1; i < modifications.length; i++) {
          newSet.delete(modifications[i].level);
        }
      }

      return newSet;
    });
  }, [modifications, onSubLevelsChange, onUnlockedLevelsChange]);

  // Handle unlock - set all previous to MAX
  const handleUnlock = useCallback((mod: TankModification) => {
    const currentIndex = modifications.findIndex(m => m.level === mod.level);

    onUnlockedLevelsChange((prev) => {
      const newSet = new Set(prev);
      newSet.add(mod.level);
      for (let i = 0; i <= currentIndex; i++) {
        newSet.add(modifications[i].level);
      }
      return newSet;
    });

    onSubLevelsChange((prev) => {
      const newMap = new Map(prev);
      for (let i = 0; i < currentIndex; i++) {
        const prevMod = modifications[i];
        newMap.set(prevMod.level, prevMod.subLevels);
      }
      newMap.set(mod.level, 0);
      return newMap;
    });
  }, [modifications, onUnlockedLevelsChange, onSubLevelsChange]);

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
        padding: '1rem',
        WebkitOverflowScrolling: 'touch' as any,
        touchAction: 'pan-x pan-y pinch-zoom',
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
          ref={svgRef}
          width={svgDimensions.width}
          height={svgDimensions.height}
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
          {modifications.map((mod) => {
            const pos = nodePositions.get(mod.level);
            if (!pos) return null;

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
                formatNumber={formatNumber}
                onSubLevelChange={handleSubLevelChange}
                onUnlockClick={handleUnlock}
                lang={lang}
                translationData={translationData}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
