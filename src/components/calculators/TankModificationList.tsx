import { useTranslations } from '../../i18n/utils';
import { formatNumber as sharedFormatNumber } from '../../utils/formatters';
import type { TranslationData } from '../../i18n/index';

interface TankModification {
  level: number;
  nameKey: string;
  wrenchesPerSub: number;
  subLevels: number;
  totalWrenches: number;
  cumulativeTotal: number;
  isVehicle?: boolean;
}

interface TankModificationListProps {
  readonly modifications: TankModification[];
  readonly unlockedLevels: Set<number>;
  readonly subLevels: Map<number, number>;
  readonly onSubLevelChange: (level: number, subLevel: number) => void;
  readonly onUnlockClick: (mod: TankModification) => void;
  readonly lang: 'de' | 'en';
  readonly translationData: TranslationData;
}

export default function TankModificationList({
  modifications,
  unlockedLevels,
  subLevels,
  onSubLevelChange,
  onUnlockClick,
  lang,
  translationData
}: TankModificationListProps) {
  const t = useTranslations(translationData);
  const formatNumber = (num: number) => sharedFormatNumber(num, lang);

  return (
    <div style={{
      background: 'rgba(0, 0, 0, 0.3)',
      borderRadius: '12px',
      border: '1px solid rgba(255, 165, 0, 0.2)',
      height: '100%',
      overflow: 'auto'
    }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '0.95rem'
      }}>
        <thead style={{
          position: 'sticky',
          top: 0,
          background: 'rgba(0, 0, 0, 0.9)',
          zIndex: 10
        }}>
          <tr>
            <th style={{ padding: '1rem', textAlign: 'left', color: '#ffa500', borderBottom: '2px solid rgba(255, 165, 0, 0.3)' }}>Level</th>
            <th style={{ padding: '1rem', textAlign: 'left', color: '#ffa500', borderBottom: '2px solid rgba(255, 165, 0, 0.3)' }}>Name</th>
            <th style={{ padding: '1rem', textAlign: 'center', color: '#ffa500', borderBottom: '2px solid rgba(255, 165, 0, 0.3)' }}>🔧/Sub</th>
            <th style={{ padding: '1rem', textAlign: 'center', color: '#ffa500', borderBottom: '2px solid rgba(255, 165, 0, 0.3)' }}>{t('tank.subLevel')}</th>
            <th style={{ padding: '1rem', textAlign: 'center', color: '#ffa500', borderBottom: '2px solid rgba(255, 165, 0, 0.3)', minWidth: '250px' }}>Slider</th>
            <th style={{ padding: '1rem', textAlign: 'right', color: '#ffa500', borderBottom: '2px solid rgba(255, 165, 0, 0.3)' }}>{t('tank.total')}</th>
            <th style={{ padding: '1rem', textAlign: 'center', color: '#ffa500', borderBottom: '2px solid rgba(255, 165, 0, 0.3)' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {modifications.map((mod) => {
            const isUnlocked = unlockedLevels.has(mod.level);
            const currentSubLevel = subLevels.get(mod.level) || 0;
            const isActive = currentSubLevel > 0;

            return (
              <tr
                key={mod.level}
                style={{
                  background: mod.isVehicle
                    ? 'rgba(52, 152, 219, 0.1)'
                    : isActive
                      ? 'rgba(255, 165, 0, 0.05)'
                      : 'transparent',
                  borderBottom: '1px solid rgba(255, 165, 0, 0.1)',
                  opacity: isUnlocked ? 1 : 0.5
                }}
              >
                {/* Level */}
                <td style={{
                  padding: '0.75rem 1rem',
                  fontWeight: 'bold',
                  color: mod.isVehicle ? '#3498db' : '#ffa500'
                }}>
                  {mod.level}
                </td>

                {/* Name */}
                <td style={{
                  padding: '0.75rem 1rem',
                  color: 'rgba(255, 255, 255, 0.8)'
                }}>
                  {t(mod.nameKey)}
                </td>

                {/* Wrenches per sub */}
                <td style={{
                  padding: '0.75rem 1rem',
                  textAlign: 'center',
                  color: 'rgba(255, 255, 255, 0.6)'
                }}>
                  {formatNumber(mod.wrenchesPerSub)}
                </td>

                {/* Sub-Level count */}
                <td style={{
                  padding: '0.75rem 1rem',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: isActive ? '#ffa500' : 'rgba(255, 255, 255, 0.6)'
                }}>
                  {currentSubLevel} / {mod.subLevels}
                </td>

                {/* Slider */}
                <td style={{ padding: '0.75rem 1rem' }}>
                  {isUnlocked ? (
                    <input
                      type="range"
                      min="0"
                      max={mod.subLevels}
                      value={currentSubLevel}
                      onChange={(e) => onSubLevelChange(mod.level, Number.parseInt((e.target as HTMLInputElement).value, 10))}
                      style={{
                        width: '100%',
                        height: '8px',
                        cursor: 'pointer',
                        accentColor: mod.isVehicle ? '#3498db' : '#ffa500'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '8px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '4px'
                    }} />
                  )}
                </td>

                {/* Total */}
                <td style={{
                  padding: '0.75rem 1rem',
                  textAlign: 'right',
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: '0.85rem'
                }}>
                  {formatNumber(mod.cumulativeTotal)}
                </td>

                {/* Action */}
                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                  {!isUnlocked && (
                    <button
                      onClick={() => onUnlockClick(mod)}
                      style={{
                        background: 'rgba(255, 165, 0, 0.2)',
                        border: '1px solid rgba(255, 165, 0, 0.5)',
                        borderRadius: '4px',
                        padding: '0.4rem 0.8rem',
                        color: '#ffa500',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 'bold'
                      }}
                    >
                      🔒 {t('tank.unlock')}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
