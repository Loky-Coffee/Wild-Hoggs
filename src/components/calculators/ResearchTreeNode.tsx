import { memo } from 'preact/compat';
import type { Technology } from '../../schemas/research';
import { getResearchImage } from '../../utils/researchImages';

interface ResearchTreeNodeProps {
  tech: Technology;
  x: number;
  y: number;
  selectedLevel: number;
  maxAvailable: number;
  unlocked: boolean;
  formatNumber: (num: number) => string;
  onLevelChange: (techId: string, level: number) => void;
  onUnlockClick: (tech: Technology) => void;
  lang: 'de' | 'en';
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 180;

// Function to generate fallback SVG with first letter of tech name
function generateFallbackSvg(letter: string): string {
  const encodedLetter = encodeURIComponent(letter.toUpperCase());
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23333' width='100' height='100'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.3em' fill='%23ffa500' font-size='50' font-weight='bold'%3E${encodedLetter}%3C/text%3E%3C/svg%3E`;
}

function ResearchTreeNode({
  tech,
  x,
  y,
  selectedLevel,
  maxAvailable,
  unlocked,
  formatNumber,
  onLevelChange,
  onUnlockClick,
  lang
}: ResearchTreeNodeProps) {
  const totalBadges = tech.badgeCosts.slice(0, selectedLevel).reduce((sum, cost) => sum + cost, 0);
  const maxBadges = tech.badgeCosts.reduce((a, b) => a + b, 0);
  const isActive = selectedLevel > 0;

  // Get optimized image or use fallback with first letter
  let iconHref: string;
  if (tech.icon) {
    // tech.icon is now "category/tech-id" format
    const [category, techId] = tech.icon.split('/');
    if (category && techId) {
      const image = getResearchImage(category, techId);
      if (image) {
        iconHref = image.src; // Vite-optimized image path
      } else {
        // Fallback: First letter of technology name
        iconHref = generateFallbackSvg(tech.name[lang].charAt(0));
      }
    } else {
      iconHref = generateFallbackSvg(tech.name[lang].charAt(0));
    }
  } else {
    iconHref = generateFallbackSvg(tech.name[lang].charAt(0));
  }

  const levelText = lang === 'de' ? 'Level' : 'Level';

  // Important: Do not clamp the slider value here.
  // Using a clamped value causes the browser to auto-adjust ("snap down")
  // when maxAvailable changes due to other node interactions.
  // We instead clamp on user change only to preserve the displayed state.

  return (
    <g transform={`translate(${x}, ${y})`} data-node-element="true">
      {!unlocked && (
        <title>{lang === 'de' ? 'Klicken um alle Prerequisites freizuschalten' : 'Click to unlock all prerequisites'}</title>
      )}

      {/* Node background */}
      <rect
        x={-NODE_WIDTH / 2}
        y={-NODE_HEIGHT / 2}
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx={8}
        fill={isActive ? 'rgba(255, 165, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)'}
        stroke={isActive ? '#ffa500' : unlocked ? 'rgba(255, 165, 0, 0.3)' : 'rgba(255, 255, 255, 0.1)'}
        strokeWidth={2}
        opacity={unlocked ? 1 : 0.5}
        data-node-element="true"
      />

      {/* Unlock button in top-right corner */}
      {!unlocked && (
        <g
          onClick={() => onUnlockClick(tech)}
          style={{ cursor: 'pointer' }}
          data-node-element="true"
          data-clickable="true"
        >
          <rect
            x={NODE_WIDTH / 2 - 45}
            y={-NODE_HEIGHT / 2 + 5}
            width={40}
            height={35}
            rx={6}
            fill="rgba(255, 165, 0, 0.2)"
            stroke="rgba(255, 165, 0, 0.5)"
            strokeWidth={1}
            data-node-element="true"
          />
          <text
            x={NODE_WIDTH / 2 - 25}
            y={-NODE_HEIGHT / 2 + 20}
            textAnchor="middle"
            fontSize="16"
            data-node-element="true"
          >
            🔒
          </text>
          <text
            x={NODE_WIDTH / 2 - 25}
            y={-NODE_HEIGHT / 2 + 33}
            textAnchor="middle"
            fontSize="7"
            fill="rgba(255, 165, 0, 0.9)"
            fontWeight="600"
            data-node-element="true"
          >
            {lang === 'de' ? 'Unlock' : 'Unlock'}
          </text>
        </g>
      )}

      {/* Technology icon - NOW WITH OPTIMIZED IMAGE */}
      <image
        href={iconHref}
        x={-25}
        y={-NODE_HEIGHT / 2 + 15}
        width={50}
        height={50}
        opacity={unlocked ? 1 : 0.3}
        data-node-element="true"
      />

      {/* Technology name */}
      <text
        x={0}
        y={-NODE_HEIGHT / 2 + 80}
        textAnchor="middle"
        fontSize="13"
        fill={unlocked ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.4)'}
        fontWeight="600"
        data-node-element="true"
      >
        {tech.name[lang].length > 20
          ? tech.name[lang].substring(0, 18) + '...'
          : tech.name[lang]}
      </text>

      {/* Level display */}
      <text
        x={0}
        y={-NODE_HEIGHT / 2 + 100}
        textAnchor="middle"
        fontSize="12"
        fill={isActive ? '#ffa500' : 'rgba(255, 255, 255, 0.6)'}
        fontWeight="600"
        data-node-element="true"
      >
        {levelText}: {selectedLevel} / {tech.maxLevel}
      </text>

      {/* Slider - Conditional rendering based on unlock status */}
      {unlocked ? (
        // Interactive HTML slider for unlocked nodes
        <foreignObject
          x={-NODE_WIDTH / 2 + 15}
          y={-NODE_HEIGHT / 2 + 110}
          width={NODE_WIDTH - 30}
          height={40}
        >
          <div style={{ width: '100%', height: '100%' }}>
            <input
              type="range"
              min="0"
              max={maxAvailable}
              value={Math.min(selectedLevel, maxAvailable)}
              onChange={(e) => {
                const newValue = parseInt((e.target as HTMLInputElement).value, 10);
                onLevelChange(tech.id, newValue);
              }}
              style={{
                width: '100%',
                height: '8px',
                cursor: 'pointer',
                accentColor: '#ffa500',
                touchAction: 'manipulation'
              }}
            />
          </div>
        </foreignObject>
      ) : (
        // Pure SVG slider visualization for locked nodes (fixes iOS bug)
        <g data-node-element="true">
          {/* Slider track */}
          <rect
            x={-NODE_WIDTH / 2 + 15}
            y={-NODE_HEIGHT / 2 + 120}
            width={NODE_WIDTH - 30}
            height={8}
            rx={4}
            fill="rgba(255, 255, 255, 0.15)"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth={1}
            opacity={0.3}
            data-node-element="true"
          />
          {/* Slider thumb - positioned based on current level */}
          {tech.maxLevel > 0 && (
            <rect
              x={-NODE_WIDTH / 2 + 15 + (selectedLevel / tech.maxLevel) * (NODE_WIDTH - 30) - 6}
              y={-NODE_HEIGHT / 2 + 116}
              width={12}
              height={16}
              rx={3}
              fill="rgba(255, 165, 0, 0.4)"
              stroke="rgba(255, 165, 0, 0.5)"
              strokeWidth={1}
              opacity={0.3}
              data-node-element="true"
            />
          )}
        </g>
      )}

      {/* Badge cost - Current / Total */}
      <text
        x={0}
        y={NODE_HEIGHT / 2 - 25}
        textAnchor="middle"
        fontSize="10"
        fill={isActive ? '#ffa500' : 'rgba(255, 255, 255, 0.5)'}
        fontWeight="600"
        data-node-element="true"
      >
        {formatNumber(totalBadges)} / {formatNumber(maxBadges)} 🎖️
      </text>

      {/* Next level cost (only show if not at max level) */}
      {selectedLevel < tech.maxLevel && (
        <text
          x={0}
          y={NODE_HEIGHT / 2 - 10}
          textAnchor="middle"
          fontSize="9"
          fill={unlocked ? 'rgba(255, 165, 0, 0.7)' : 'rgba(255, 255, 255, 0.4)'}
          fontWeight="500"
          data-node-element="true"
        >
          {lang === 'de' ? 'Nächste' : 'Next'}: {formatNumber(tech.badgeCosts[selectedLevel])} 🎖️
        </text>
      )}
    </g>
  );
}

// Memoize to prevent unnecessary re-renders
export default memo(ResearchTreeNode, (prevProps, nextProps) => {
  return (
    prevProps.tech.id === nextProps.tech.id &&
    prevProps.selectedLevel === nextProps.selectedLevel &&
    prevProps.maxAvailable === nextProps.maxAvailable &&
    prevProps.unlocked === nextProps.unlocked &&
    prevProps.x === nextProps.x &&
    prevProps.y === nextProps.y &&
    prevProps.lang === nextProps.lang
  );
});
