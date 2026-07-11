import { memo } from 'preact/compat';
import type { VNode } from 'preact';
import { NODE_WIDTH, NODE_HEIGHT, type SVGDimensions } from '../../utils/treeNodeConfig';

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

interface TankModificationConnectionsProps {
  readonly modifications: TankModification[];
  readonly nodePositions: Map<number, NodePosition>;
  readonly unlockedLevels: Set<number>;
  readonly subLevels: Map<number, number>;
  readonly targetLevel: number | null;
  readonly svgDimensions: SVGDimensions;
}

function TankModificationConnections({
  modifications,
  nodePositions,
  unlockedLevels,
  subLevels,
  targetLevel,
  svgDimensions
}: TankModificationConnectionsProps) {
  const connections: VNode[] = [];
  const RED_OFF = 8; // Versatz der roten Ziel-Linie (blaue Linie ist 7px breit)

  // Connect each modification to the next one in sequence
  for (let i = 0; i < modifications.length - 1; i++) {
    const currentMod = modifications[i];
    const nextMod = modifications[i + 1];

    const currentPos = nodePositions.get(currentMod.level);
    const nextPos = nodePositions.get(nextMod.level);

    if (!currentPos || !nextPos) continue;

    // Check if connection is unlocked (current mod is unlocked)
    const isUnlocked = unlockedLevels.has(currentMod.level);

    // Rote Ziel-Linie: Kante auf dem Pfad zum Ziel (nächster Mod <= Ziel-Level) und BEIDE Enden
    // noch NICHT fertig -> keine rote Linie an/aus einem bereits fertigen Knoten.
    const onTargetPath = targetLevel !== null
      && nextMod.level <= targetLevel
      && (subLevels.get(currentMod.level) || 0) < currentMod.subLevels
      && (subLevels.get(nextMod.level) || 0) < nextMod.subLevels;

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

      if (onTargetPath) {
        connections.push(
          <path
            key={`target-${currentMod.level}-${nextMod.level}`}
            d={`M ${startX} ${startY + RED_OFF} L ${endX} ${endY + RED_OFF}`}
            stroke="#e74c3c"
            strokeWidth={4}
            fill="none"
            opacity={0.9}
          />
        );
      }
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

      if (onTargetPath) {
        const sx = endX < startX ? RED_OFF : -RED_OFF; // Seite (links/rechts)
        connections.push(
          <path
            key={`target-${currentMod.level}-${nextMod.level}`}
            d={`M ${startX + sx} ${startY} L ${startX + sx} ${midY + RED_OFF} L ${endX + sx} ${midY + RED_OFF} L ${endX + sx} ${endY}`}
            stroke="#e74c3c"
            strokeWidth={4}
            fill="none"
            opacity={0.9}
          />
        );
      }
    }
  }

  return <>{connections}</>;
}

export default memo(TankModificationConnections, (prevProps, nextProps) => {
  if (prevProps.unlockedLevels.size !== nextProps.unlockedLevels.size) return false;

  for (const level of prevProps.unlockedLevels) {
    if (!nextProps.unlockedLevels.has(level)) return false;
  }

  // Ziel-Linie: bei Ziel- oder Sub-Level-Änderung neu zeichnen
  if (prevProps.targetLevel !== nextProps.targetLevel) return false;
  if (prevProps.subLevels.size !== nextProps.subLevels.size) return false;
  for (const [level, sub] of prevProps.subLevels) {
    if (nextProps.subLevels.get(level) !== sub) return false;
  }

  return (
    prevProps.modifications === nextProps.modifications &&
    prevProps.nodePositions === nextProps.nodePositions &&
    prevProps.svgDimensions === nextProps.svgDimensions
  );
});
