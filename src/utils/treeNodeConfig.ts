export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 180;

export const RESEARCH_TIER_SPACING = 250;
export const RESEARCH_NODE_SPACING = 240;

export const TANK_NODE_SPACING_X = 280;
export const TANK_NODE_SPACING_Y = 300;
export const TANK_NODES_PER_ROW = 5;

export interface TreeNodePosition {
  x: number;
  y: number;
  tier?: number;
  row?: number;
  col?: number;
}

export interface SVGDimensions {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export function calculateSVGDimensions(
  nodePositions: Map<string | number, TreeNodePosition>,
  padding: number = 100
): SVGDimensions {
  if (nodePositions.size === 0) {
    return { width: 0, height: 0, offsetX: 0, offsetY: 0 };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  nodePositions.forEach((pos) => {
    minX = Math.min(minX, pos.x - NODE_WIDTH / 2);
    minY = Math.min(minY, pos.y - NODE_HEIGHT / 2);
    maxX = Math.max(maxX, pos.x + NODE_WIDTH / 2);
    maxY = Math.max(maxY, pos.y + NODE_HEIGHT / 2);
  });

  const offsetX = -minX + padding;
  const offsetY = -minY + padding;

  return {
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
    offsetX,
    offsetY
  };
}

