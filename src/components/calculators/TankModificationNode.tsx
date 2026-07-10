import { memo } from 'preact/compat';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData, TranslationKey } from '../../i18n/index';
import { NODE_WIDTH, NODE_HEIGHT } from '../../utils/treeNodeConfig';
import CompletedRibbon from './CompletedRibbon';

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
  readonly onOpenSheet?: (mod: TankModification) => void;
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
  onOpenSheet,
  onSetTarget,
  onFocus,
  translationData
}: TankModificationNodeProps) {
  const t = useTranslations(translationData);
  const isVehicle = mod.isVehicle === true;
  const isActive = currentSubLevel > 0;

  const nodeStrokeColor = isActive
    ? '#ffa500'
    : unlocked
      ? 'rgba(255, 165, 0, 0.3)'
      : 'rgba(255, 255, 255, 0.1)';

  const totalWrenchesForSubLevel = currentSubLevel * mod.wrenchesPerSub;

  const handleNodeKeyDown = (e: React.KeyboardEvent<Element>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onOpenSheet) onOpenSheet(mod);
    }
  };

  return (
    <g
      transform={`translate(${x}, ${y})`}
      data-node-element="true"
      tabIndex={0}
      role="button"
      aria-label={`Level ${mod.level}: ${t(mod.nameKey as TranslationKey)} - Sub-Level ${currentSubLevel} of ${maxSubLevel}${unlocked ? '' : ' (locked)'}`}
      className="research-tree-node"
      data-mod-level={mod.level}
      data-unlocked={unlocked}
      onKeyDown={handleNodeKeyDown}
      onFocus={onFocus}
      onClick={(e: React.MouseEvent<Element>) => {
        const target = e.target as Element;
        // Klick auf Ziel-Button etc. nicht abfangen; sonst Sheet öffnen
        if (!target.closest('[data-clickable="true"]')) {
          onFocus?.();
          if (onOpenSheet) onOpenSheet(mod);
        }
      }}
      style={{ cursor: 'pointer' }}
    >
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

      {/* Target button (top-left corner) — nicht bei fertigen Knoten (kein Sinn als Ziel) */}
      {onSetTarget && currentSubLevel < maxSubLevel && (
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
          {t(mod.nameKey as TranslationKey)}
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
        fontSize="11"
        fill="rgba(255, 255, 255, 0.6)"
        data-node-element="true"
      >
        {t(mod.nameKey as TranslationKey).length > 22 ? t(mod.nameKey as TranslationKey).substring(0, 22) + '...' : t(mod.nameKey as TranslationKey)}
      </text>

      {/* Wrenches per sub-level */}
      <text
        x={0}
        y={-NODE_HEIGHT / 2 + 90}
        textAnchor="middle"
        fontSize="11"
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

      {/* Read-only Fortschrittsbalken — Sub-Level wählt man im Bottom-Sheet */}
      <g data-node-element="true">
        <rect
          x={-NODE_WIDTH / 2 + 15}
          y={-NODE_HEIGHT / 2 + 122}
          width={NODE_WIDTH - 30}
          height={8}
          rx={4}
          fill="rgba(255, 255, 255, 0.12)"
          opacity={unlocked ? 1 : 0.4}
          data-node-element="true"
        />
        {/* immer rendern (Breite 0 bei Sub-Level 0) — sonst SSR/Client-Hydration-Mismatch */}
        <rect
          x={-NODE_WIDTH / 2 + 15}
          y={-NODE_HEIGHT / 2 + 122}
          width={maxSubLevel > 0 && currentSubLevel > 0 ? (Math.min(currentSubLevel, maxSubLevel) / maxSubLevel) * (NODE_WIDTH - 30) : 0}
          height={8}
          rx={4}
          fill={isVehicle ? '#3498db' : (isActive ? '#ffa500' : 'rgba(255, 165, 0, 0.4)')}
          opacity={unlocked ? 1 : 0.4}
          data-node-element="true"
        />
        {/* Striche pro Sub-Level (Trennlinien) */}
        {maxSubLevel > 1 && Array.from({ length: maxSubLevel - 1 }, (_, i) => {
          const tx = -NODE_WIDTH / 2 + 15 + ((i + 1) / maxSubLevel) * (NODE_WIDTH - 30);
          return (
            <line
              key={i}
              x1={tx}
              y1={-NODE_HEIGHT / 2 + 122}
              x2={tx}
              y2={-NODE_HEIGHT / 2 + 130}
              stroke="rgba(0, 0, 0, 0.4)"
              strokeWidth={1}
              opacity={unlocked ? 1 : 0.4}
              data-node-element="true"
            />
          );
        })}
      </g>

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
        fontSize="10"
        fill="rgba(255, 255, 255, 0.3)"
        data-node-element="true"
      >
        {t('tank.total')}: 🔧 {formatNumber(mod.cumulativeTotal)}
      </text>
      {maxSubLevel > 0 && currentSubLevel >= maxSubLevel && (
        <CompletedRibbon label={t('calc.done' as TranslationKey)} />
      )}
    </g>
  );
}

export default memo(TankModificationNode);
