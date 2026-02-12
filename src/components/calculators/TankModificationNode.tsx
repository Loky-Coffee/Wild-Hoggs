import { memo, useRef, useEffect } from 'preact/compat';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData } from '../../i18n/index';
import RangeTouch from 'rangetouch';
import { NODE_WIDTH, NODE_HEIGHT } from '../../utils/treeNodeConfig';

interface TankModification {
  level: number;
  nameKey: string;
  wrenchesPerSub: number;
  subLevels: number;
  totalWrenches: number;
  cumulativeTotal: number;
  isVehicle?: boolean;
}

interface TankModificationNodeProps {
  readonly mod: TankModification;
  readonly x: number;
  readonly y: number;
  readonly currentSubLevel: number;
  readonly maxSubLevel: number;
  readonly unlocked: boolean;
  readonly isTarget?: boolean;
  readonly formatNumber: (num: number) => string;
  readonly onSubLevelChange: (level: number, subLevel: number) => void;
  readonly onUnlockClick: (mod: TankModification) => void;
  readonly onSetTarget?: () => void;
  readonly onFocus?: () => void;
  readonly lang: 'de' | 'en';
  readonly translationData: TranslationData;
}

function TankModificationNode({
  mod,
  x,
  y,
  currentSubLevel,
  maxSubLevel,
  unlocked,
  isTarget = false,
  formatNumber,
  onSubLevelChange,
  onUnlockClick,
  onSetTarget,
  onFocus,
  lang,
  translationData
}: TankModificationNodeProps) {
  const t = useTranslations(translationData);
  const isVehicle = mod.isVehicle === true;
  const isActive = currentSubLevel > 0;

  const rangeInputRef = useRef<HTMLInputElement>(null);
  const rangeTouchInstanceRef = useRef<RangeTouch | null>(null);

  // RangeTouch for iOS support
  useEffect(() => {
    if (rangeTouchInstanceRef.current) {
      rangeTouchInstanceRef.current.destroy();
      rangeTouchInstanceRef.current = null;
    }

    if (rangeInputRef.current && unlocked) {
      rangeTouchInstanceRef.current = new RangeTouch(rangeInputRef.current, {
        addCSS: true,
        thumbWidth: 15,
        watch: true
      });
    }

    return () => {
      if (rangeTouchInstanceRef.current) {
        rangeTouchInstanceRef.current.destroy();
        rangeTouchInstanceRef.current = null;
      }
    };
  }, [unlocked]);

  const nodeStrokeColor = isActive
    ? '#ffa500'
    : unlocked
      ? 'rgba(255, 165, 0, 0.3)'
      : 'rgba(255, 255, 255, 0.1)';

  const totalWrenchesForSubLevel = currentSubLevel * mod.wrenchesPerSub;

  const handleNodeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!unlocked) {
        onUnlockClick(mod);
      } else if (rangeInputRef.current) {
        rangeInputRef.current.focus();
      }
    }
  };

  return (
    <g
      transform={`translate(${x}, ${y})`}
      data-node-element="true"
      tabIndex={0}
      role="group"
      aria-label={`Level ${mod.level}: ${t(mod.nameKey)} - Sub-Level ${currentSubLevel} of ${maxSubLevel}${unlocked ? '' : ' (locked)'}`}
      className="research-tree-node"
      data-mod-level={mod.level}
      data-unlocked={unlocked}
      onKeyDown={handleNodeKeyDown}
      onFocus={onFocus}
    >
      {!unlocked && (
        <title>Click to unlock this modification</title>
      )}

      {/* Focus indicator */}
      <rect
        x={-NODE_WIDTH / 2 - 4}
        y={-NODE_HEIGHT / 2 - 4}
        width={NODE_WIDTH + 8}
        height={NODE_HEIGHT + 8}
        rx={10}
        fill="none"
        stroke="rgba(255, 165, 0, 0.8)"
        strokeWidth={3}
        opacity={0}
        className="node-focus-indicator"
        data-node-element="true"
        pointerEvents="none"
      />

      {/* Node background */}
      <rect
        x={-NODE_WIDTH / 2}
        y={-NODE_HEIGHT / 2}
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx={8}
        fill={isVehicle ? '#1a2a3d' : isActive ? '#3d2a00' : '#1e1e1e'}
        stroke={isTarget ? '#e74c3c' : isVehicle ? '#3498db' : nodeStrokeColor}
        strokeWidth={isTarget ? 3 : isVehicle ? 3 : 2}
        opacity={unlocked ? 1 : 0.5}
        data-node-element="true"
        className="node-background"
      />

      {/* Target button (top-left corner) */}
      {onSetTarget && (
        <g
          onClick={onSetTarget}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSetTarget();
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={`Set Level ${mod.level} as target`}
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
            stroke={isTarget ? 'rgba(231, 76, 60, 0.8)' : 'rgba(231, 76, 60, 0.8)'}
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
            fontSize="10"
            fill={isTarget ? '#e74c3c' : '#e74c3c'}
            fontWeight="600"
            data-node-element="true"
          >
            {isTarget ? t('tank.targetSet') : t('tank.setTarget')}
          </text>
        </g>
      )}

      {/* Unlock button */}
      {!unlocked && (
        <g
          onClick={() => onUnlockClick(mod)}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onUnlockClick(mod);
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={`Unlock Level ${mod.level}`}
          style={{ cursor: 'pointer', outline: 'none' }}
          data-node-element="true"
          data-clickable="true"
          data-unlock-button="true"
        >
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
            fontSize="10"
            fill="#ffa500"
            fontWeight="600"
            data-node-element="true"
          >
            {t('tank.unlock')}
          </text>
        </g>
      )}

      {/* Vehicle name */}
      {isVehicle && (
        <text
          x={0}
          y={-NODE_HEIGHT / 2 + 30}
          textAnchor="middle"
          fill="#3498db"
          fontSize="16"
          fontWeight="bold"
          data-node-element="true"
        >
          {t(mod.nameKey)}
        </text>
      )}

      {/* Level number */}
      <text
        x={0}
        y={-NODE_HEIGHT / 2 + (isVehicle ? 55 : 35)}
        textAnchor="middle"
        fontSize="18"
        fill="#ffa500"
        fontWeight="bold"
        data-node-element="true"
      >
        Level {mod.level}
      </text>

      {/* Name (small) */}
      <text
        x={0}
        y={-NODE_HEIGHT / 2 + (isVehicle ? 72 : 52)}
        textAnchor="middle"
        fontSize="10"
        fill="rgba(255, 255, 255, 0.6)"
        data-node-element="true"
      >
        {t(mod.nameKey).length > 22 ? t(mod.nameKey).substring(0, 22) + '...' : t(mod.nameKey)}
      </text>

      {/* Wrenches per sub-level */}
      <text
        x={0}
        y={-NODE_HEIGHT / 2 + 90}
        textAnchor="middle"
        fontSize="10"
        fill="rgba(255, 255, 255, 0.5)"
        data-node-element="true"
      >
        🔧 {formatNumber(mod.wrenchesPerSub)} {t('tank.perSubLevel')}
      </text>

      {/* Sub-level indicator */}
      <text
        x={0}
        y={-NODE_HEIGHT / 2 + 105}
        textAnchor="middle"
        fontSize="12"
        fill={isActive ? '#ffa500' : 'rgba(255, 255, 255, 0.6)'}
        fontWeight="600"
        data-node-element="true"
      >
        {t('tank.subLevel')}: {currentSubLevel} / {maxSubLevel}
      </text>

      {/* Slider */}
      {unlocked ? (
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
              max={maxSubLevel}
              value={Math.min(currentSubLevel, maxSubLevel)}
              onChange={(e) => {
                const newValue = Number.parseInt((e.target as HTMLInputElement).value, 10);
                onSubLevelChange(mod.level, newValue);
              }}
              aria-label={`Level ${mod.level} sub-level`}
              aria-valuemin={0}
              aria-valuemax={maxSubLevel}
              aria-valuenow={Math.min(currentSubLevel, maxSubLevel)}
              aria-valuetext={`Sub-level ${Math.min(currentSubLevel, maxSubLevel)} of ${maxSubLevel}`}
              style={{
                width: '100%',
                height: '8px',
                cursor: 'pointer',
                accentColor: isVehicle ? '#3498db' : '#ffa500',
                touchAction: 'manipulation'
              }}
            />
          </div>
        </foreignObject>
      ) : (
        <g data-node-element="true">
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
          {maxSubLevel > 0 && (
            <rect
              x={-NODE_WIDTH / 2 + 15 + (currentSubLevel / maxSubLevel) * (NODE_WIDTH - 30) - 6}
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

      {/* Total wrenches for current sub-level */}
      <text
        x={0}
        y={-NODE_HEIGHT / 2 + 155}
        textAnchor="middle"
        fontSize="11"
        fill={isActive ? '#ffa500' : 'rgba(255, 255, 255, 0.4)'}
        fontWeight="600"
        data-node-element="true"
      >
        {t('tank.cost')}: 🔧 {formatNumber(totalWrenchesForSubLevel)} / {formatNumber(mod.totalWrenches)}
      </text>

      {/* Cumulative total (bottom) */}
      <text
        x={0}
        y={-NODE_HEIGHT / 2 + 170}
        textAnchor="middle"
        fontSize="9"
        fill="rgba(255, 255, 255, 0.3)"
        data-node-element="true"
      >
        {t('tank.total')}: 🔧 {formatNumber(mod.cumulativeTotal)}
      </text>
    </g>
  );
}

export default memo(TankModificationNode);
