import { useState, useMemo } from 'preact/hooks';

interface Prerequisite {
  id: string;
  requiredLevel?: number;
}

interface Technology {
  id: string;
  name: { de: string; en: string };
  maxLevel: number;
  badgeCosts: number[];
  icon?: string;
  prerequisites: (string | Prerequisite)[];
}

interface TreeNodePosition {
  x: number;
  y: number;
  tier: number;
}

interface ResearchTreeViewProps {
  technologies: Technology[];
  selectedLevels: Map<string, number>;
  onLevelChange: (techId: string, level: number) => void;
  onBatchLevelChange: (updates: Map<string, number>) => void;
  layoutDirection: 'horizontal' | 'vertical';
  lang: 'de' | 'en';
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 180;
const TIER_SPACING = 320;
const NODE_SPACING = 240;

type LayoutDirection = 'horizontal' | 'vertical';

export default function ResearchTreeView({
  technologies,
  selectedLevels,
  onLevelChange,
  onBatchLevelChange,
  layoutDirection,
  lang
}: ResearchTreeViewProps) {

  // Calculate tier for each technology (depth in dependency tree)
  const calculateTiers = (): Map<string, number> => {
    const tiers = new Map<string, number>();
    const visited = new Set<string>();

    const calculateTier = (techId: string): number => {
      if (tiers.has(techId)) return tiers.get(techId)!;
      if (visited.has(techId)) return 0;

      visited.add(techId);
      const tech = technologies.find(t => t.id === techId);
      if (!tech || tech.prerequisites.length === 0) {
        tiers.set(techId, 0);
        return 0;
      }

      const maxPrereqTier = Math.max(...tech.prerequisites.map(prereq => {
        const prereqId = typeof prereq === 'string' ? prereq : prereq.id;
        return calculateTier(prereqId);
      }));
      const tier = maxPrereqTier + 1;
      tiers.set(techId, tier);
      return tier;
    };

    technologies.forEach(tech => calculateTier(tech.id));
    return tiers;
  };

  // Calculate positions for all nodes
  const nodePositions = useMemo((): Map<string, TreeNodePosition> => {
    const positions = new Map<string, TreeNodePosition>();
    const tiers = calculateTiers();

    const tierGroups = new Map<number, string[]>();
    tiers.forEach((tier, techId) => {
      if (!tierGroups.has(tier)) tierGroups.set(tier, []);
      tierGroups.get(tier)!.push(techId);
    });

    tierGroups.forEach((techIds, tier) => {
      const tierSize = techIds.length * NODE_SPACING;
      const startPos = -tierSize / 2;

      techIds.forEach((techId, index) => {
        const primaryPos = tier * TIER_SPACING;
        const secondaryPos = startPos + index * NODE_SPACING;

        positions.set(techId, {
          x: layoutDirection === 'horizontal' ? primaryPos : secondaryPos,
          y: layoutDirection === 'horizontal' ? secondaryPos : primaryPos,
          tier
        });
      });
    });

    return positions;
  }, [technologies, layoutDirection]);

  const isUnlocked = (tech: Technology): boolean => {
    if (tech.prerequisites.length === 0) return true;
    return tech.prerequisites.every(prereq => {
      const prereqId = typeof prereq === 'string' ? prereq : prereq.id;
      const requiredLevel = typeof prereq === 'string' ? 1 : (prereq.requiredLevel || 1);
      const currentLevel = selectedLevels.get(prereqId) || 0;
      return currentLevel >= requiredLevel;
    });
  };

  const getMaxAvailableLevel = (tech: Technology): number => {
    if (tech.prerequisites.length === 0) return tech.maxLevel;

    // Check if any prerequisite has a low requiredLevel (progressive leveling)
    const hasProgressivePrereq = tech.prerequisites.some(prereq => {
      if (typeof prereq === 'string') return true; // String prerequisites default to progressive
      const prereqTech = technologies.find(t => t.id === prereq.id);
      const reqLevel = prereq.requiredLevel || 1;
      // If requiredLevel is less than the prerequisite's maxLevel, it's progressive
      return reqLevel < (prereqTech?.maxLevel || 1);
    });

    if (hasProgressivePrereq) {
      // Progressive: level capped by minimum current level of prerequisites
      const minPrereqLevel = Math.min(...tech.prerequisites.map(prereq => {
        const prereqId = typeof prereq === 'string' ? prereq : prereq.id;
        return selectedLevels.get(prereqId) || 0;
      }));
      return Math.min(tech.maxLevel, minPrereqLevel);
    }

    // All prerequisites require maxLevel: independent leveling once unlocked
    return tech.maxLevel;
  };

  const getTotalBadges = (tech: Technology, level: number): number => {
    return tech.badgeCosts.slice(0, level).reduce((sum, cost) => sum + cost, 0);
  };

  const unlockWithPrerequisites = (tech: Technology) => {
    const newLevels = new Map(selectedLevels);

    // Recursive function to unlock all prerequisites to MAX level
    const unlockPrereqs = (t: Technology) => {
      t.prerequisites.forEach(prereq => {
        const prereqId = typeof prereq === 'string' ? prereq : prereq.id;
        const prereqTech = technologies.find(tech => tech.id === prereqId);

        if (prereqTech) {
          // First unlock the prerequisites of this prerequisite
          unlockPrereqs(prereqTech);

          // Then set this prerequisite to MAX level
          newLevels.set(prereqId, prereqTech.maxLevel);
        }
      });
    };

    // Unlock all prerequisites to max
    unlockPrereqs(tech);

    // Apply all changes at once using batch update
    onBatchLevelChange(newLevels);
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US');
  };

  const svgDimensions = useMemo(() => {
    let minX = 0, minY = 0, maxX = 0, maxY = 0;

    nodePositions.forEach((pos) => {
      minX = Math.min(minX, pos.x - NODE_WIDTH / 2);
      minY = Math.min(minY, pos.y - NODE_HEIGHT / 2);
      maxX = Math.max(maxX, pos.x + NODE_WIDTH / 2);
      maxY = Math.max(maxY, pos.y + NODE_HEIGHT / 2);
    });

    const padding = 100;
    const offsetX = -minX + padding;
    const offsetY = -minY + padding;

    return {
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
      offsetX,
      offsetY
    };
  }, [nodePositions]);

  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      de: {
        horizontal: 'Horizontal (Links→Rechts)',
        vertical: 'Vertikal (Oben→Unten)',
        layout: 'Layout',
        level: 'Level'
      },
      en: {
        horizontal: 'Horizontal (Left→Right)',
        vertical: 'Vertical (Top→Bottom)',
        layout: 'Layout',
        level: 'Level'
      }
    };
    return translations[lang][key] || key;
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        background: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '12px',
        padding: '1rem',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-x pan-y',
        cursor: 'grab',
        display: 'flex',
        justifyContent: layoutDirection === 'vertical' ? 'center' : 'flex-start',
        alignItems: 'flex-start'
      } as any}>
        <div style={{
          minWidth: 'min-content',
          minHeight: 'min-content'
        }}>
          <svg
            width={svgDimensions.width}
            height={svgDimensions.height}
            style={{ display: 'block' }}
          >
          {/* Connection lines with branching */}
          {(() => {
            const connections: JSX.Element[] = [];
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

            return connections;
          })()}

          {/* Nodes with embedded controls */}
          {technologies.map(tech => {
            const pos = nodePositions.get(tech.id);
            if (!pos) return null;

            const unlocked = isUnlocked(tech);
            const maxAvailable = getMaxAvailableLevel(tech);
            const selectedLevel = selectedLevels.get(tech.id) || 0;
            const totalBadges = getTotalBadges(tech, selectedLevel);
            const isActive = selectedLevel > 0;

            return (
              <g key={tech.id} transform={`translate(${pos.x + svgDimensions.offsetX}, ${pos.y + svgDimensions.offsetY})`}>
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
                />

                {/* Unlock button in top-right corner */}
                {!unlocked && (
                  <g
                    onClick={() => unlockWithPrerequisites(tech)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Clickable background */}
                    <rect
                      x={NODE_WIDTH / 2 - 45}
                      y={-NODE_HEIGHT / 2 + 5}
                      width={40}
                      height={35}
                      rx={6}
                      fill="rgba(255, 165, 0, 0.2)"
                      stroke="rgba(255, 165, 0, 0.5)"
                      strokeWidth={1}
                    />
                    {/* Lock icon */}
                    <text
                      x={NODE_WIDTH / 2 - 25}
                      y={-NODE_HEIGHT / 2 + 20}
                      textAnchor="middle"
                      fontSize="16"
                    >
                      🔒
                    </text>
                    {/* Unlock text */}
                    <text
                      x={NODE_WIDTH / 2 - 25}
                      y={-NODE_HEIGHT / 2 + 33}
                      textAnchor="middle"
                      fontSize="7"
                      fill="rgba(255, 165, 0, 0.9)"
                      fontWeight="600"
                    >
                      {lang === 'de' ? 'Unlock' : 'Unlock'}
                    </text>
                  </g>
                )}

                {/* Technology icon */}
                {tech.icon && (
                  <image
                    href={tech.icon}
                    x={-25}
                    y={-NODE_HEIGHT / 2 + 15}
                    width={50}
                    height={50}
                    opacity={unlocked ? 1 : 0.3}
                  />
                )}

                {/* Technology name */}
                <text
                  x={0}
                  y={-NODE_HEIGHT / 2 + 80}
                  textAnchor="middle"
                  fontSize="13"
                  fill={unlocked ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.4)'}
                  fontWeight="600"
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
                >
                  {t('level')}: {selectedLevel} / {tech.maxLevel}
                </text>

                {/* Slider embedded in node */}
                <foreignObject
                  x={-NODE_WIDTH / 2 + 15}
                  y={-NODE_HEIGHT / 2 + 110}
                  width={NODE_WIDTH - 30}
                  height={40}
                >
                  <div xmlns="http://www.w3.org/1999/xhtml" style={{ width: '100%', height: '100%' }}>
                    <input
                      type="range"
                      min="0"
                      max={maxAvailable}
                      value={selectedLevel}
                      disabled={!unlocked}
                      onChange={(e) => onLevelChange(tech.id, parseInt((e.target as HTMLInputElement).value, 10))}
                      style={{
                        width: '100%',
                        height: '8px',
                        cursor: unlocked ? 'pointer' : 'not-allowed',
                        opacity: unlocked ? 1 : 0.3,
                        accentColor: '#ffa500'
                      }}
                    />
                  </div>
                </foreignObject>

                {/* Badge cost */}
                <text
                  x={0}
                  y={NODE_HEIGHT / 2 - 15}
                  textAnchor="middle"
                  fontSize="11"
                  fill={isActive ? '#ffa500' : 'rgba(255, 255, 255, 0.5)'}
                  fontWeight="600"
                >
                  {isActive
                    ? `${formatNumber(totalBadges)} 🎖️`
                    : `Max: ${formatNumber(tech.badgeCosts.reduce((a, b) => a + b, 0))} 🎖️`
                  }
                </text>
              </g>
            );
          })}
        </svg>
        </div>
      </div>
    </div>
  );
}
