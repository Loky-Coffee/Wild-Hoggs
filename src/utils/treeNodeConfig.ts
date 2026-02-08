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
  let minX = 0, minY = 0, maxX = 0, maxY = 0;

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

export function getResponsiveNodeDimensions(
  viewportWidth: number
): { width: number; height: number } {
  if (viewportWidth < 768) {
    const targetNodesPerRow = 3;
    const padding = 40;
    const availableWidth = viewportWidth - padding;
    const nodeWidth = Math.floor(availableWidth / targetNodesPerRow);
    const scale = Math.min(nodeWidth / NODE_WIDTH, 0.6);
    return {
      width: Math.round(NODE_WIDTH * scale),
      height: Math.round(NODE_HEIGHT * scale)
    };
  }
  return { width: NODE_WIDTH, height: NODE_HEIGHT };
}

export function getTreeSpacing(
  treeType: 'research' | 'tank',
  viewportWidth: number = typeof window !== 'undefined' ? window.innerWidth : 1024
) {
  if (treeType === 'tank') {
    const scale = viewportWidth < 768 ? 0.85 : 1;
    return {
      spacingX: Math.round(TANK_NODE_SPACING_X * scale),
      spacingY: Math.round(TANK_NODE_SPACING_Y * scale),
      nodesPerRow: TANK_NODES_PER_ROW
    };
  }

  const scale = viewportWidth < 768 ? 0.9 : 1;
  return {
    tierSpacing: Math.round(RESEARCH_TIER_SPACING * scale),
    nodeSpacing: Math.round(RESEARCH_NODE_SPACING * scale)
  };
}
