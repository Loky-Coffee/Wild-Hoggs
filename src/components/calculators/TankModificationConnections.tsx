import { memo } from 'preact/compat';
import type { VNode } from 'preact';
import { NODE_WIDTH, NODE_HEIGHT, type SVGDimensions } from '../../utils/treeNodeConfig';

interface TankModification {
  level: number;
  name: string;
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

interface TankModificationConnectionsProps {
  readonly modifications: TankModification[];
  readonly nodePositions: Map<number, NodePosition>;
  readonly unlockedLevels: Set<number>;
  readonly svgDimensions: SVGDimensions;
}

function TankModificationConnections({
  modifications,
  nodePositions,
  unlockedLevels,
  svgDimensions
}: TankModificationConnectionsProps) {
  const connections: VNode[] = [];

  // Connect each modification to the next one in sequence
  for (let i = 0; i < modifications.length - 1; i++) {
    const currentMod = modifications[i];
    const nextMod = modifications[i + 1];

    const currentPos = nodePositions.get(currentMod.level);
    const nextPos = nodePositions.get(nextMod.level);

    if (!currentPos || !nextPos) continue;

    // Check if connection is unlocked (current mod is unlocked)
    const isUnlocked = unlockedLevels.has(currentMod.level);

    // Determine if we're on the same row or different rows
    const sameRow = currentPos.row === nextPos.row;

    let startX, startY, endX, endY;

    if (sameRow) {
      // Horizontal connection (same row)
      const isLeftToRight = currentPos.col < nextPos.col;

      if (isLeftToRight) {
        // Left to Right: connect from right side of current to left side of next
        startX = currentPos.x + NODE_WIDTH / 2 + svgDimensions.offsetX;
        startY = currentPos.y + svgDimensions.offsetY;
        endX = nextPos.x - NODE_WIDTH / 2 + svgDimensions.offsetX;
        endY = nextPos.y + svgDimensions.offsetY;
      } else {
        // Right to Left: connect from left side of current to right side of next
        startX = currentPos.x - NODE_WIDTH / 2 + svgDimensions.offsetX;
        startY = currentPos.y + svgDimensions.offsetY;
        endX = nextPos.x + NODE_WIDTH / 2 + svgDimensions.offsetX;
        endY = nextPos.y + svgDimensions.offsetY;
      }

      // Simple horizontal line
      const pathData = `M ${startX} ${startY} L ${endX} ${endY}`;

      connections.push(
        <path
          key={`${currentMod.level}-${nextMod.level}`}
          d={pathData}
          stroke={isUnlocked ? '#00bcd4' : 'rgba(0, 188, 212, 0.3)'}
          strokeWidth={7}
          fill="none"
        />
      );
    } else {
      // Vertical connection (row change - zigzag turn)
      // Connect from bottom of current to top of next
      startX = currentPos.x + svgDimensions.offsetX;
      startY = currentPos.y + NODE_HEIGHT / 2 + svgDimensions.offsetY;
      endX = nextPos.x + svgDimensions.offsetX;
      endY = nextPos.y - NODE_HEIGHT / 2 + svgDimensions.offsetY;

      // Orthogonal path: down from current, across, then up to next
      const midY = (startY + endY) / 2;
      const pathData = `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;

      connections.push(
        <path
          key={`${currentMod.level}-${nextMod.level}`}
          d={pathData}
          stroke={isUnlocked ? '#00bcd4' : 'rgba(0, 188, 212, 0.3)'}
          strokeWidth={7}
          fill="none"
        />
      );
    }
  }

  return <>{connections}</>;
}

export default memo(TankModificationConnections, (prevProps, nextProps) => {
  if (prevProps.unlockedLevels.size !== nextProps.unlockedLevels.size) return false;

  for (const level of prevProps.unlockedLevels) {
    if (!nextProps.unlockedLevels.has(level)) return false;
  }

  return (
    prevProps.modifications === nextProps.modifications &&
    prevProps.nodePositions === nextProps.nodePositions &&
    prevProps.svgDimensions === nextProps.svgDimensions
  );
});
