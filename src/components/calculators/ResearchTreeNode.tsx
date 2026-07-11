import { memo } from 'preact/compat';
import { useRef, useState } from 'preact/hooks';
import type { Technology } from '../../schemas/research';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData, TranslationKey } from '../../i18n/index';
import { NODE_WIDTH, NODE_HEIGHT } from '../../utils/treeNodeConfig';
import CompletedRibbon from './CompletedRibbon';

interface ResearchTreeNodeProps {
  readonly tech: Technology;
  readonly x: number;
  readonly y: number;
  readonly selectedLevel: number;
  readonly maxAvailable: number;
  readonly unlocked: boolean;
  readonly isTarget?: boolean;
  readonly targetLevel?: number | null;
  readonly formatNumber: (num: number) => string;
  readonly onLevelChange: (techId: string, level: number) => void;
  readonly onOpenSheet?: (tech: Technology) => void;
  readonly onUnlockClick: (tech: Technology) => void;
  readonly onSetTarget?: () => void;
  readonly onFocus?: () => void;
  readonly iconMap?: Record<string, string>;
  readonly lang: 'de' | 'en';
  readonly translationData: TranslationData;
}

function generateFallbackSvg(letter: string): string {
  const encodedLetter = encodeURIComponent(letter.toUpperCase());
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23333' width='100' height='100'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.3em' fill='%23ffa500' font-size='50' font-weight='bold'%3E${encodedLetter}%3C/text%3E%3C/svg%3E`;
}

// Helper function to get technology icon href
// iconMap (techIcon -> optimierter src) wird serverseitig gebaut und durchgereicht,
// damit der Client NICHT alle ~380 Baum-Icons per eager-Glob lädt (nur die ~20 dieses Baums).
function getTechIconHref(tech: Technology, techName: string, iconMap?: Record<string, string>): string {
  if (!tech.icon) {
    return generateFallbackSvg(techName.charAt(0));
  }
  const src = iconMap?.[tech.icon];
  return src || generateFallbackSvg(techName.charAt(0));
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
  targetLevel = null,
  formatNumber,
  onLevelChange,
  onOpenSheet,
  onUnlockClick,
  onSetTarget,
  onFocus,
  iconMap,
  lang,
  translationData
}: ResearchTreeNodeProps) {
  const t = useTranslations(translationData);
  const techName = t(tech.nameKey as TranslationKey) || tech.nameKey || 'Unknown';
  const totalBadges = tech.badgeCosts.slice(0, selectedLevel).reduce((sum, cost) => sum + cost, 0);
  const maxBadges = tech.badgeCosts.reduce((a, b) => a + b, 0);
  const isActive = selectedLevel > 0;
  // Knoten mit Level (isActive) hell zeigen — auch wenn Voraussetzungen (nach
  // Regeländerung / alte DB-Stände) gerade nicht erfüllt sind. Level = echter Fortschritt.
  const bright = unlocked || isActive;

  // Ref for the node group element to programmatically focus it
  const nodeGroupRef = useRef<SVGGElement>(null);

  // State to control focus indicator visibility (React state for reliable SVG styling)
  const [isFocused, setIsFocused] = useState(false);

  const iconHref = getTechIconHref(tech, techName, iconMap);
  const nodeStrokeColor = getNodeStrokeColor(isActive, unlocked);

  // Important: Do not clamp the slider value here.
  // Using a clamped value causes the browser to auto-adjust ("snap down")
  // when maxAvailable changes due to other node interactions.
  // We instead clamp on user change only to preserve the displayed state.

  const handleNodeKeyDown = (e: React.KeyboardEvent<Element>) => {
    // Enter/Space opens the level bottom-sheet
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onOpenSheet) {
        onOpenSheet(tech);
      } else if (!unlocked) {
        onUnlockClick(tech);
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
        if (!target.closest('[data-clickable="true"]')) {
          setIsFocused(true);
          onFocus?.();
          // Programmatically focus the node element to trigger :focus CSS
          if (nodeGroupRef.current) {
            nodeGroupRef.current.focus();
          }
          if (onOpenSheet) onOpenSheet(tech);
        }
      }}
    >
      {/* immer rendern (Inhalt leer wenn entsperrt) — Hydration-stabil */}
      <title>{!unlocked ? t('calc.research.unlockPrerequisites') : ''}</title>

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
        opacity={bright ? 1 : 0.5}
        data-node-element="true"
        className="node-background"
        style={{
          filter: isFocused ? 'brightness(1.3)' : 'brightness(1)',
          transition: 'filter 0.2s ease-out'
        }}
      />

      {/* Target button (top-left corner) — nicht bei fertigen Knoten (kein Sinn als Ziel) */}
      {onSetTarget && selectedLevel < tech.maxLevel && (
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
            {isTarget ? `Lv ${targetLevel ?? tech.maxLevel}` : t('tank.setTarget')}
          </text>
        </g>
      )}

      {/* Unlock button in top-right corner - KEYBOARD ACCESSIBLE */}
      {/* Unlock-Button entfernt: Knoten sind read-only. Gesperrte Knoten sind nur
          gedimmt; das Entsperren passiert automatisch beim Level-Wählen im Bottom-Sheet
          (Tippen auf den Knoten öffnet das Sheet). Kein Top-Right-Element mehr -> keine
          Geist-Box mehr beim Umschalten gesperrt/entsperrt. */}

      {/* Technology icon - NOW WITH OPTIMIZED IMAGE */}
      <image
        href={iconHref}
        x={-25}
        y={-NODE_HEIGHT / 2 + 15}
        width={50}
        height={50}
        opacity={bright ? 1 : 0.3}
        data-node-element="true"
      />

      {/* Technology name */}
      <text
        x={0}
        y={-NODE_HEIGHT / 2 + 80}
        textAnchor="middle"
        fontSize="13"
        fill={bright ?'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.4)'}
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

      {/* Read-only Fortschrittsbalken — Stufe wählt man im Bottom-Sheet */}
      <g data-node-element="true">
        <rect
          x={-NODE_WIDTH / 2 + 15}
          y={-NODE_HEIGHT / 2 + 122}
          width={NODE_WIDTH - 30}
          height={8}
          rx={4}
          fill="rgba(255, 255, 255, 0.12)"
          opacity={bright ? 1 : 0.4}
          data-node-element="true"
        />
        {/* immer rendern (Breite 0 bei Level 0) — sonst SSR/Client-Hydration-Mismatch */}
        <rect
          x={-NODE_WIDTH / 2 + 15}
          y={-NODE_HEIGHT / 2 + 122}
          width={tech.maxLevel > 0 && selectedLevel > 0 ? (Math.min(selectedLevel, tech.maxLevel) / tech.maxLevel) * (NODE_WIDTH - 30) : 0}
          height={8}
          rx={4}
          fill={isActive ? '#ffa500' : 'rgba(255, 165, 0, 0.4)'}
          opacity={bright ? 1 : 0.4}
          data-node-element="true"
        />
        {/* Striche pro Level (Trennlinien) */}
        {tech.maxLevel > 1 && Array.from({ length: tech.maxLevel - 1 }, (_, i) => {
          const tx = -NODE_WIDTH / 2 + 15 + ((i + 1) / tech.maxLevel) * (NODE_WIDTH - 30);
          return (
            <line
              key={i}
              x1={tx}
              y1={-NODE_HEIGHT / 2 + 122}
              x2={tx}
              y2={-NODE_HEIGHT / 2 + 130}
              stroke="rgba(0, 0, 0, 0.4)"
              strokeWidth={1}
              opacity={bright ? 1 : 0.4}
              data-node-element="true"
            />
          );
        })}
      </g>

      {/* Badge cost - Current / Total */}
      <text
        x={0}
        y={NODE_HEIGHT / 2 - 25}
        textAnchor="middle"
        fontSize="11"
        fill={isActive ? '#ffa500' : 'rgba(255, 255, 255, 0.5)'}
        fontWeight="600"
        data-node-element="true"
      >
        {formatNumber(totalBadges)} / {formatNumber(maxBadges)} 🎖️
      </text>

      {/* Next level cost — immer rendern, Inhalt leer bei Max (Hydration-stabil) */}
      <text
        x={0}
        y={NODE_HEIGHT / 2 - 10}
        textAnchor="middle"
        fontSize="10"
        fill={bright ?'rgba(255, 165, 0, 0.7)' : 'rgba(255, 255, 255, 0.4)'}
        fontWeight="500"
        data-node-element="true"
      >
        {selectedLevel < tech.maxLevel ? `${t('calc.research.next')}: ${formatNumber(tech.badgeCosts[selectedLevel])} 🎖️` : ''}
      </text>
      {tech.maxLevel > 0 && selectedLevel >= tech.maxLevel && (
        <CompletedRibbon label={t('calc.done' as TranslationKey)} />
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
    prevProps.isTarget === nextProps.isTarget &&
    prevProps.targetLevel === nextProps.targetLevel &&
    prevProps.x === nextProps.x &&
    prevProps.y === nextProps.y &&
    prevProps.lang === nextProps.lang
  );
});
