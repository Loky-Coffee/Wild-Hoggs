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
  const processedConnections = new Set<string>();

  // Handle branching: multiple prerequisites → one dependent
  technologies.forEach(tech => {
    if (tech.prerequisites.length <= 1) return;

    const techPos = nodePositions.get(tech.id);
    if (!techPos) return;

    // Get all prerequisite positions
    const prereqPositions = tech.prerequisites
      .map(prereq => {
        const prereqId = typeof prereq === 'string' ? prereq : prereq.id;
        return { id: prereqId, pos: nodePositions.get(prereqId), prereq };
      })
      .filter(p => p.pos);

    if (prereqPositions.length === 0) return;

    // Calculate merge point
    const avgY = prereqPositions.reduce((sum, p) => sum + p.pos!.y, 0) / prereqPositions.length;
    const avgX = prereqPositions.reduce((sum, p) => sum + p.pos!.x, 0) / prereqPositions.length;

    let mergeX, mergeY;
    let endX, endY;

    if (layoutDirection === 'horizontal') {
      endX = techPos.x - NODE_WIDTH / 2 + svgDimensions.offsetX;
      endY = techPos.y + svgDimensions.offsetY;
      mergeX = (avgX + NODE_WIDTH / 2 + svgDimensions.offsetX + endX) / 2;
      mergeY = avgY + svgDimensions.offsetY;
    } else {
      endX = techPos.x + svgDimensions.offsetX;
      endY = techPos.y - NODE_HEIGHT / 2 + svgDimensions.offsetY;
      mergeX = avgX + svgDimensions.offsetX;
      mergeY = (avgY + NODE_HEIGHT / 2 + svgDimensions.offsetY + endY) / 2;
    }

    // Check if all prerequisites are met
    const allPrereqsMet = tech.prerequisites.every(prereq => {
      const prereqId = typeof prereq === 'string' ? prereq : prereq.id;
      const requiredLevel = typeof prereq === 'string' ? 1 : (prereq.requiredLevel || 1);
      const currentLevel = selectedLevels.get(prereqId) || 0;
      return currentLevel >= requiredLevel;
    });

    // Lines from each prerequisite to merge point
    prereqPositions.forEach(({ id: prereqId, pos, prereq }) => {
      let startX, startY;
      if (layoutDirection === 'horizontal') {
        startX = pos!.x + NODE_WIDTH / 2 + svgDimensions.offsetX;
        startY = pos!.y + svgDimensions.offsetY;
      } else {
        startX = pos!.x + svgDimensions.offsetX;
        startY = pos!.y + NODE_HEIGHT / 2 + svgDimensions.offsetY;
      }

      const requiredLevel = typeof prereq === 'string' ? 1 : (prereq.requiredLevel || 1);
      const currentLevel = selectedLevels.get(prereqId) || 0;
      const isMet = currentLevel >= requiredLevel;

      connections.push(
        <line
          key={`${prereqId}-${tech.id}-to-merge`}
          x1={startX}
          y1={startY}
          x2={mergeX}
          y2={mergeY}
          stroke={isMet ? '#ffa500' : 'rgba(255, 255, 255, 0.2)'}
          strokeWidth={isMet ? 3 : 2}
          strokeDasharray={isMet ? '0' : '5,5'}
        />
      );

      processedConnections.add(`${prereqId}-${tech.id}`);
    });

    // Merge point indicator
    connections.push(
      <circle
        key={`merge-${tech.id}`}
        cx={mergeX}
        cy={mergeY}
        r={4}
        fill={allPrereqsMet ? '#ffa500' : 'rgba(255, 255, 255, 0.3)'}
      />
    );

    // Line from merge point to dependent
    connections.push(
      <line
        key={`merge-${tech.id}-to-tech`}
        x1={mergeX}
        y1={mergeY}
        x2={endX}
        y2={endY}
        stroke={allPrereqsMet ? '#ffa500' : 'rgba(255, 255, 255, 0.2)'}
        strokeWidth={allPrereqsMet ? 3 : 2}
        strokeDasharray={allPrereqsMet ? '0' : '5,5'}
      />
    );
  });

  // Handle branching: one prerequisite → multiple dependents
  const processedPrereqs = new Set<string>();

  technologies.forEach(prereqTech => {
    // Find all technologies that depend on this prerequisite
    const dependents = technologies.filter(tech =>
      tech.prerequisites.some(p => {
        const pId = typeof p === 'string' ? p : p.id;
        return pId === prereqTech.id;
      }) && tech.prerequisites.length === 1 // Only handle single prerequisite here
    );

    if (dependents.length === 0 || processedPrereqs.has(prereqTech.id)) return;
    processedPrereqs.add(prereqTech.id);

    const prereqPos = nodePositions.get(prereqTech.id);
    if (!prereqPos) return;

    // Calculate branching point
    const dependentPositions = dependents.map(d => nodePositions.get(d.id)).filter(Boolean);
    if (dependentPositions.length === 0) return;

    // Start point (from prerequisite)
    let startX, startY;
    if (layoutDirection === 'horizontal') {
      startX = prereqPos.x + NODE_WIDTH / 2 + svgDimensions.offsetX;
      startY = prereqPos.y + svgDimensions.offsetY;
    } else {
      startX = prereqPos.x + svgDimensions.offsetX;
      startY = prereqPos.y + NODE_HEIGHT / 2 + svgDimensions.offsetY;
    }

    if (dependents.length === 1) {
      // Single connection - direct line (only if not already processed by merge logic)
      const connectionKey = `${prereqTech.id}-${dependents[0].id}`;
      if (processedConnections.has(connectionKey)) return;

      const depPos = dependentPositions[0]!;
      let endX, endY;
      if (layoutDirection === 'horizontal') {
        endX = depPos.x - NODE_WIDTH / 2 + svgDimensions.offsetX;
        endY = depPos.y + svgDimensions.offsetY;
      } else {
        endX = depPos.x + svgDimensions.offsetX;
        endY = depPos.y - NODE_HEIGHT / 2 + svgDimensions.offsetY;
      }

      const prereq = dependents[0].prerequisites.find(p => {
        const pId = typeof p === 'string' ? p : p.id;
        return pId === prereqTech.id;
      });
      const requiredLevel = typeof prereq === 'string' ? 1 : (prereq?.requiredLevel || 1);
      const currentLevel = selectedLevels.get(prereqTech.id) || 0;
      const isMet = currentLevel >= requiredLevel;

      connections.push(
        <line
          key={connectionKey}
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke={isMet ? '#ffa500' : 'rgba(255, 255, 255, 0.2)'}
          strokeWidth={isMet ? 3 : 2}
          strokeDasharray={isMet ? '0' : '5,5'}
        />
      );
    } else {
      // Multiple connections - create branching
      // Calculate average position of dependents
      const avgY = dependentPositions.reduce((sum, p) => sum + p!.y, 0) / dependentPositions.length;
      const avgX = dependentPositions.reduce((sum, p) => sum + p!.x, 0) / dependentPositions.length;

      let branchX, branchY;
      if (layoutDirection === 'horizontal') {
        branchX = (startX + (avgX + svgDimensions.offsetX - NODE_WIDTH / 2)) / 2;
        branchY = avgY + svgDimensions.offsetY;
      } else {
        branchX = avgX + svgDimensions.offsetX;
        branchY = (startY + (avgY + svgDimensions.offsetY - NODE_HEIGHT / 2)) / 2;
      }

      const currentLevel = selectedLevels.get(prereqTech.id) || 0;

      // Main line to branch point
      connections.push(
        <line
          key={`${prereqTech.id}-branch`}
          x1={startX}
          y1={startY}
          x2={branchX}
          y2={branchY}
          stroke={currentLevel > 0 ? '#ffa500' : 'rgba(255, 255, 255, 0.2)'}
          strokeWidth={currentLevel > 0 ? 3 : 2}
          strokeDasharray={currentLevel > 0 ? '0' : '5,5'}
        />
      );

      // Branch point indicator
      connections.push(
        <circle
          key={`${prereqTech.id}-branch-point`}
          cx={branchX}
          cy={branchY}
          r={4}
          fill={currentLevel > 0 ? '#ffa500' : 'rgba(255, 255, 255, 0.3)'}
        />
      );

      // Lines from branch point to each dependent
      dependents.forEach((dep, idx) => {
        const depPos = nodePositions.get(dep.id);
        if (!depPos) return;

        let endX, endY;
        if (layoutDirection === 'horizontal') {
          endX = depPos.x - NODE_WIDTH / 2 + svgDimensions.offsetX;
          endY = depPos.y + svgDimensions.offsetY;
        } else {
          endX = depPos.x + svgDimensions.offsetX;
          endY = depPos.y - NODE_HEIGHT / 2 + svgDimensions.offsetY;
        }

        const prereq = dep.prerequisites.find(p => {
          const pId = typeof p === 'string' ? p : p.id;
          return pId === prereqTech.id;
        });
        const requiredLevel = typeof prereq === 'string' ? 1 : (prereq?.requiredLevel || 1);
        const isMet = currentLevel >= requiredLevel;

        connections.push(
          <line
            key={`${prereqTech.id}-${dep.id}-${idx}`}
            x1={branchX}
            y1={branchY}
            x2={endX}
            y2={endY}
            stroke={isMet ? '#ffa500' : 'rgba(255, 255, 255, 0.2)'}
            strokeWidth={isMet ? 3 : 2}
            strokeDasharray={isMet ? '0' : '5,5'}
          />
        );
      });
    }
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
