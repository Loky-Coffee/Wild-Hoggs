import { useMemo } from 'preact/hooks';
import type { ResearchTree } from '../schemas/research';
import { useTranslations } from '../i18n/utils';

interface CategoryNode {
  id: string;
  name: { en: string; de: string };
  icon: string;
  totalBadges: number;
  nodeCount: number;
  isEnabled: boolean;
  requires: Array<{
    category?: string;
    progress?: number;
    type?: string;
    level?: number;
    description: { en: string; de: string };
  }>;
}

interface ResearchCategoryTreeProps {
  categories: CategoryNode[];
  lang: 'de' | 'en';
}

const NODE_WIDTH = 200;
const NODE_HEIGHT = 140;
const HORIZONTAL_SPACING = 300;
const VERTICAL_SPACING = 200;

export default function ResearchCategoryTree({ categories, lang }: ResearchCategoryTreeProps) {
  const t = useTranslations(lang);

  // Calculate positions based on dependencies
  const nodePositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number; depth: number }>();
    const depths = new Map<string, number>();

    // Calculate depth for each category (based on dependencies)
    const calculateDepth = (catId: string, visited = new Set<string>()): number => {
      if (depths.has(catId)) return depths.get(catId)!;
      if (visited.has(catId)) return 0;

      visited.add(catId);
      const cat = categories.find(c => c.id === catId);
      if (!cat || !cat.requires || cat.requires.length === 0) {
        depths.set(catId, 0);
        return 0;
      }

      const maxDepth = Math.max(...cat.requires
        .filter(r => r.category)
        .map(r => calculateDepth(r.category!, visited))
      );
      const depth = maxDepth + 1;
      depths.set(catId, depth);
      return depth;
    };

    categories.forEach(cat => calculateDepth(cat.id));

    // Group by depth
    const depthGroups = new Map<number, string[]>();
    depths.forEach((depth, catId) => {
      if (!depthGroups.has(depth)) depthGroups.set(depth, []);
      depthGroups.get(depth)!.push(catId);
    });

    // Position nodes
    depthGroups.forEach((catIds, depth) => {
      const groupHeight = catIds.length * VERTICAL_SPACING;
      const startY = -groupHeight / 2;

      catIds.forEach((catId, index) => {
        positions.set(catId, {
          x: depth * HORIZONTAL_SPACING,
          y: startY + index * VERTICAL_SPACING,
          depth
        });
      });
    });

    return positions;
  }, [categories]);

  // Calculate SVG dimensions
  const svgDimensions = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    nodePositions.forEach((pos) => {
      minX = Math.min(minX, pos.x - NODE_WIDTH / 2);
      minY = Math.min(minY, pos.y - NODE_HEIGHT / 2);
      maxX = Math.max(maxX, pos.x + NODE_WIDTH / 2);
      maxY = Math.max(maxY, pos.y + NODE_HEIGHT / 2);
    });

    // Ensure we have valid dimensions
    if (minX === Infinity) minX = 0;
    if (minY === Infinity) minY = 0;
    if (maxX === -Infinity) maxX = 800;
    if (maxY === -Infinity) maxY = 600;

    const padding = 150;
    return {
      width: Math.max(1200, maxX - minX + padding * 2),
      height: Math.max(600, maxY - minY + padding * 2),
      offsetX: -minX + padding,
      offsetY: -minY + padding
    };
  }, [nodePositions]);

  return (
    <div style={{
      width: '100%',
      height: '800px',
      overflow: 'auto',
      background: `
        radial-gradient(circle, rgba(255, 165, 0, 0.15) 1.5px, transparent 1.5px),
        rgba(0, 0, 0, 0.3)
      `,
      backgroundSize: '30px 30px',
      borderRadius: '12px',
      padding: '1rem',
      cursor: 'grab',
      display: 'flex',
      justifyContent: 'flex-start',
      alignItems: 'flex-start'
    }}>
      <svg
        width={svgDimensions.width}
        height={svgDimensions.height}
        style={{ display: 'block', minWidth: svgDimensions.width, minHeight: svgDimensions.height }}
      >
        {/* Connection lines */}
        {categories.map(cat => {
          const catPos = nodePositions.get(cat.id);
          if (!catPos || !cat.requires) return null;

          return cat.requires
            .filter(req => req.category)
            .map(req => {
              const reqPos = nodePositions.get(req.category!);
              if (!reqPos) return null;

              const startX = reqPos.x + NODE_WIDTH / 2 + svgDimensions.offsetX;
              const startY = reqPos.y + svgDimensions.offsetY;
              const endX = catPos.x - NODE_WIDTH / 2 + svgDimensions.offsetX;
              const endY = catPos.y + svgDimensions.offsetY;
              const midX = (startX + endX) / 2;

              return (
                <path
                  key={`${req.category}-${cat.id}`}
                  d={`M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`}
                  stroke="rgba(0, 188, 212, 0.5)"
                  strokeWidth={2}
                  fill="none"
                />
              );
            });
        })}

        {/* Category nodes */}
        {categories.map(cat => {
          const pos = nodePositions.get(cat.id);
          if (!pos) return null;

          const x = pos.x + svgDimensions.offsetX;
          const y = pos.y + svgDimensions.offsetY;

          return (
            <g key={cat.id} transform={`translate(${x}, ${y})`}>
              <a href={cat.isEnabled ? `/${lang}/tools/research/${cat.id}` : undefined}>
                {/* Node background */}
                <rect
                  x={-NODE_WIDTH / 2}
                  y={-NODE_HEIGHT / 2}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={8}
                  fill={cat.isEnabled ? 'rgba(255, 165, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)'}
                  stroke={cat.isEnabled ? '#ffa500' : 'rgba(255, 165, 0, 0.2)'}
                  strokeWidth={2}
                  opacity={cat.isEnabled ? 1 : 0.6}
                  style={{ cursor: cat.isEnabled ? 'pointer' : 'not-allowed' }}
                />

                {/* Icon */}
                <text
                  x={0}
                  y={-NODE_HEIGHT / 2 + 40}
                  textAnchor="middle"
                  fontSize="32"
                >
                  {cat.icon}
                </text>

                {/* Name */}
                <text
                  x={0}
                  y={-NODE_HEIGHT / 2 + 70}
                  textAnchor="middle"
                  fontSize="12"
                  fill="rgba(255, 255, 255, 0.9)"
                  fontWeight="600"
                >
                  {cat.name[lang].length > 18
                    ? cat.name[lang].substring(0, 16) + '...'
                    : cat.name[lang]}
                </text>

                {/* Stats */}
                <text
                  x={0}
                  y={NODE_HEIGHT / 2 - 30}
                  textAnchor="middle"
                  fontSize="10"
                  fill={cat.totalBadges > 0 ? '#ffa500' : 'rgba(255, 255, 255, 0.5)'}
                >
                  {cat.totalBadges > 0 ? `${cat.totalBadges.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US')} 🎖️` : t('research.comingSoon')}
                </text>

                {/* Requirements indicator */}
                {cat.requires && cat.requires.length > 0 && (
                  <text
                    x={0}
                    y={NODE_HEIGHT / 2 - 10}
                    textAnchor="middle"
                    fontSize="9"
                    fill="rgba(255, 165, 0, 0.7)"
                  >
                    {cat.requires.map(r => {
                      if (r.type === 'hq_level') return `HQ ${r.level}`;
                      if (r.type === 'lab_level') return `Lab ${r.level}`;
                      if (r.progress) return `${r.progress}%`;
                      return '';
                    }).join(' + ')}
                  </text>
                )}
              </a>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
