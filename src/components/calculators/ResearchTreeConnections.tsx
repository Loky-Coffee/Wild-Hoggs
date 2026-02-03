import { memo } from 'preact/compat';
import type { VNode } from 'preact';
import type { Technology } from '../../schemas/research';

interface TreeNodePosition {
  x: number;
  y: number;
  tier: number;
}

interface ResearchTreeConnectionsProps {
  technologies: Technology[];
  nodePositions: Map<string, TreeNodePosition>;
  selectedLevels: Map<string, number>;
  svgDimensions: {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  };
  layoutDirection: 'horizontal' | 'vertical';
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 180;

function ResearchTreeConnections({
  technologies,
  nodePositions,
  selectedLevels,
  svgDimensions,
  layoutDirection
}: ResearchTreeConnectionsProps) {
  const connections: VNode[] = [];

  // Direct Parent-Child Connections (klassische Baumstruktur)
  // Für jede Technology, zeichne direkte Linien zu allen Prerequisites
  technologies.forEach(tech => {
    const techPos = nodePositions.get(tech.id);
    if (!techPos) return;

    // End point (am Kind-Knoten)
    let endX, endY;
    if (layoutDirection === 'horizontal') {
      endX = techPos.x - NODE_WIDTH / 2 + svgDimensions.offsetX;
      endY = techPos.y + svgDimensions.offsetY;
    } else {
      endX = techPos.x + svgDimensions.offsetX;
      endY = techPos.y - NODE_HEIGHT / 2 + svgDimensions.offsetY;
    }

    // Zeichne eine direkte Linie zu jedem Prerequisite
    tech.prerequisites.forEach(prereq => {
      const prereqId = typeof prereq === 'string' ? prereq : prereq.id;
      const prereqPos = nodePositions.get(prereqId);
      if (!prereqPos) return;

      // Start point (am Parent-Knoten)
      let startX, startY;
      if (layoutDirection === 'horizontal') {
        startX = prereqPos.x + NODE_WIDTH / 2 + svgDimensions.offsetX;
        startY = prereqPos.y + svgDimensions.offsetY;
      } else {
        startX = prereqPos.x + svgDimensions.offsetX;
        startY = prereqPos.y + NODE_HEIGHT / 2 + svgDimensions.offsetY;
      }

      // Zeichne direkte Linie vom Parent zum Child
      connections.push(
        <line
          key={`${prereqId}-${tech.id}`}
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke="#00bcd4"
          strokeWidth={2}
        />
      );
    });
  });

  return <>{connections}</>;
}

// Memoize to prevent unnecessary re-renders
export default memo(ResearchTreeConnections, (prevProps, nextProps) => {
  // Check if selectedLevels changed
  if (prevProps.selectedLevels.size !== nextProps.selectedLevels.size) return false;
  for (const [key, value] of prevProps.selectedLevels) {
    if (nextProps.selectedLevels.get(key) !== value) return false;
  }

  return (
    prevProps.technologies === nextProps.technologies &&
    prevProps.nodePositions === nextProps.nodePositions &&
    prevProps.layoutDirection === nextProps.layoutDirection &&
    prevProps.svgDimensions === nextProps.svgDimensions
  );
});
