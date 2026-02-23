import { memo } from 'preact/compat';
import { useRef, useEffect, useState } from 'preact/hooks';
import type { Technology } from '../../schemas/research';
import { getResearchImage } from '../../utils/researchImages';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData, TranslationKey } from '../../i18n/index';
import RangeTouch from 'rangetouch';
import { NODE_WIDTH, NODE_HEIGHT } from '../../utils/treeNodeConfig';

interface ResearchTreeNodeProps {
  readonly tech: Technology;
  readonly x: number;
  readonly y: number;
  readonly selectedLevel: number;
  readonly maxAvailable: number;
  readonly unlocked: boolean;
  readonly isTarget?: boolean;
  readonly formatNumber: (num: number) => string;
  readonly onLevelChange: (techId: string, level: number) => void;
  readonly onUnlockClick: (tech: Technology) => void;
  readonly onSetTarget?: () => void;
  readonly onFocus?: () => void;
  readonly lang: 'de' | 'en';
  readonly translationData: TranslationData;
}

function generateFallbackSvg(letter: string): string {
  const encodedLetter = encodeURIComponent(letter.toUpperCase());
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23333' width='100' height='100'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.3em' fill='%23ffa500' font-size='50' font-weight='bold'%3E${encodedLetter}%3C/text%3E%3C/svg%3E`;
}

// Helper function to get technology icon href
function getTechIconHref(tech: Technology, techName: string): string {
  if (!tech.icon) {
    return generateFallbackSvg(techName.charAt(0));
  }

  const [category, techId] = tech.icon.split('/');
  if (!category || !techId) {
    return generateFallbackSvg(techName.charAt(0));
  }

  const image = getResearchImage(category, techId);
  return image ? image.src : generateFallbackSvg(techName.charAt(0));
}

// Helper function to determine node stroke color
function getNodeStrokeColor(isActive: boolean, unlocked: boolean): string {
  if (isActive) return '#ffa500';
  return unlocked ? 'rgba(255, 165, 0, 0.3)' : 'rgba(255, 255, 255, 0.1)';
}

function ResearchTreeNode({
  tech,
  x,
  y,
  selectedLevel,
  maxAvailable,
  unlocked,
  isTarget = false,
  formatNumber,
  onLevelChange,
  onUnlockClick,
  onSetTarget,
  onFocus,
  lang,
  translationData
}: ResearchTreeNodeProps) {
  const t = useTranslations(translationData);
  const techName = t(tech.nameKey as TranslationKey) || tech.nameKey || 'Unknown';
  const totalBadges = tech.badgeCosts.slice(0, selectedLevel).reduce((sum, cost) => sum + cost, 0);
  const maxBadges = tech.badgeCosts.reduce((a, b) => a + b, 0);
  const isActive = selectedLevel > 0;

  // RangeTouch for iOS touch support
  const rangeInputRef = useRef<HTMLInputElement>(null);
  const rangeTouchInstanceRef = useRef<RangeTouch | null>(null);
  // Ref for the node group element to programmatically focus it
  const nodeGroupRef = useRef<SVGGElement>(null);

  // State to control focus indicator visibility (React state for reliable SVG styling)
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    // Clean up any existing instance first to prevent memory leaks
    if (rangeTouchInstanceRef.current) {
      rangeTouchInstanceRef.current.destroy();
      rangeTouchInstanceRef.current = null;
    }

    // Initialize RangeTouch only for unlocked nodes
    if (rangeInputRef.current && unlocked) {
      rangeTouchInstanceRef.current = new RangeTouch(rangeInputRef.current, {
        addCSS: true,
        thumbWidth: 15,
        watch: true
      });
    }

    return () => {
      // Cleanup on unmount or when unlocked changes
      if (rangeTouchInstanceRef.current) {
        rangeTouchInstanceRef.current.destroy();
        rangeTouchInstanceRef.current = null;
      }
    };
  }, [unlocked]);

  const iconHref = getTechIconHref(tech, techName);
  const nodeStrokeColor = getNodeStrokeColor(isActive, unlocked);

  // Important: Do not clamp the slider value here.
  // Using a clamped value causes the browser to auto-adjust ("snap down")
  // when maxAvailable changes due to other node interactions.
  // We instead clamp on user change only to preserve the displayed state.

  const handleNodeKeyDown = (e: React.KeyboardEvent<Element>) => {
    // When node is focused and Enter/Space pressed
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();

      // If locked, trigger unlock
      if (!unlocked) {
        onUnlockClick(tech);
      } else {
        // If unlocked and has slider, focus the slider input
        if (rangeInputRef.current) {
          rangeInputRef.current.focus();
        }
      }
    }
  };

  return (
    <g
      ref={nodeGroupRef}
      transform={`translate(${x}, ${y})`}
      data-node-element="true"
      tabIndex={0}
      role="group"
      aria-label={`${techName}: Level ${selectedLevel} of ${tech.maxLevel}${unlocked ? '' : ' (locked)'}`}
      className="research-tree-node"
      data-tech-id={tech.id}
      data-unlocked={unlocked}
      onKeyDown={handleNodeKeyDown}
      onFocus={() => {
        setIsFocused(true);
        onFocus?.();
      }}
      onBlur={() => {
        setIsFocused(false);
      }}
      onClick={(e) => {
        const target = e.target as any;
        if (!target.closest('input') && !target.closest('[data-clickable="true"]')) {
          setIsFocused(true);
          onFocus?.();
          // Programmatically focus the node element to trigger :focus CSS
          if (nodeGroupRef.current) {
            nodeGroupRef.current.focus();
          }
        }
      }}
    >
      {!unlocked && (
        <title>{t('calc.research.unlockPrerequisites')}</title>
      )}

      {/* Focus indicator ring - shows when node is focused */}
      <rect
        x={-NODE_WIDTH / 2 - 4}
        y={-NODE_HEIGHT / 2 - 4}
        width={NODE_WIDTH + 8}
        height={NODE_HEIGHT + 8}
        rx={10}
        fill="none"
        stroke="rgba(255, 165, 0, 0.8)"
        strokeWidth={3}
        opacity={isFocused ? 1 : 0}
        className="node-focus-indicator"
        data-node-element="true"
        pointerEvents="none"
        style={{
          transition: 'opacity 0.2s ease-out'
        }}
      />

      {/* Node background */}
      <rect
        x={-NODE_WIDTH / 2}
        y={-NODE_HEIGHT / 2}
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx={8}
        fill={isActive ? '#3d2a00' : '#1e1e1e'}
        stroke={isTarget ? '#e74c3c' : nodeStrokeColor}
        strokeWidth={isTarget ? 3 : 2}
        opacity={unlocked ? 1 : 0.5}
        data-node-element="true"
        className="node-background"
        style={{
          filter: isFocused ? 'brightness(1.3)' : 'brightness(1)',
          transition: 'filter 0.2s ease-out'
        }}
      />

      {/* Target button (top-left corner) */}
      {onSetTarget && (
        <g
          onClick={onSetTarget}
          onKeyDown={(e: React.KeyboardEvent<Element>) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSetTarget();
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={`Set ${techName} as target`}
          style={{ cursor: 'pointer', outline: 'none' }}
          data-node-element="true"
          data-clickable="true"
          data-target-button="true"
        >
          <rect
            x={-NODE_WIDTH / 2 + 3}
            y={-NODE_HEIGHT / 2 + 3}
            width={44}
            height={39}
            rx={6}
            fill="none"
            stroke="rgba(231, 76, 60, 0.8)"
            strokeWidth={2}
            opacity={0}
            className="target-button-focus-indicator"
            data-node-element="true"
          />
          <rect
            x={-NODE_WIDTH / 2 + 5}
            y={-NODE_HEIGHT / 2 + 5}
            width={40}
            height={35}
            rx={6}
            fill={isTarget ? 'rgba(231, 76, 60, 0.4)' : 'rgba(231, 76, 60, 0.2)'}
            stroke={isTarget ? 'rgba(231, 76, 60, 0.8)' : 'rgba(231, 76, 60, 0.5)'}
            strokeWidth={isTarget ? 2 : 1}
            className="target-button-bg"
            data-node-element="true"
          />
          <text
            x={-NODE_WIDTH / 2 + 25}
            y={-NODE_HEIGHT / 2 + 20}
            textAnchor="middle"
            fontSize="16"
            data-node-element="true"
          >
            🎯
          </text>
          <text
            x={-NODE_WIDTH / 2 + 25}
            y={-NODE_HEIGHT / 2 + 33}
            textAnchor="middle"
            fontSize="11"
            fill="#e74c3c"
            fontWeight="600"
            data-node-element="true"
          >
            {isTarget ? t('tank.targetSet') : t('tank.setTarget')}
          </text>
        </g>
      )}

      {/* Unlock button in top-right corner - KEYBOARD ACCESSIBLE */}
      {!unlocked && (
        <g
          onClick={() => onUnlockClick(tech)}
          onKeyDown={(e: React.KeyboardEvent<Element>) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onUnlockClick(tech);
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={`Unlock ${techName}`}
          style={{ cursor: 'pointer', outline: 'none' }}
          data-node-element="true"
          data-clickable="true"
          data-unlock-button="true"
        >
          {/* Focus indicator rectangle */}
          <rect
            x={NODE_WIDTH / 2 - 47}
            y={-NODE_HEIGHT / 2 + 3}
            width={44}
            height={39}
            rx={6}
            fill="none"
            stroke="rgba(255, 165, 0, 0.8)"
            strokeWidth={2}
            opacity={0}
            className="unlock-button-focus-indicator"
            data-node-element="true"
          />
          {/* Main unlock button background */}
          <rect
            x={NODE_WIDTH / 2 - 45}
            y={-NODE_HEIGHT / 2 + 5}
            width={40}
            height={35}
            rx={6}
            fill="rgba(255, 165, 0, 0.2)"
            stroke="rgba(255, 165, 0, 0.5)"
            strokeWidth={1}
            className="unlock-button-bg"
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
            fontSize="11"
            fill="rgba(255, 165, 0, 0.9)"
            fontWeight="600"
            data-node-element="true"
          >
            Unlock
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
        {techName.length > 20
          ? techName.substring(0, 18) + '...'
          : techName}
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
        Level: {selectedLevel} / {tech.maxLevel}
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
              ref={rangeInputRef}
              type="range"
              min="0"
              max={maxAvailable}
              value={Math.min(selectedLevel, maxAvailable)}
              onChange={(e) => {
                const newValue = Number.parseInt((e.target as HTMLInputElement).value, 10);
                onLevelChange(tech.id, newValue);
              }}
              aria-label={`${techName} level`}
              aria-valuemin={0}
              aria-valuemax={maxAvailable}
              aria-valuenow={Math.min(selectedLevel, maxAvailable)}
              aria-valuetext={`Level ${Math.min(selectedLevel, maxAvailable)} of ${maxAvailable}`}
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
          {t('calc.research.next')}: {formatNumber(tech.badgeCosts[selectedLevel])} 🎖️
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
