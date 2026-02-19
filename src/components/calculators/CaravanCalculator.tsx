import { useState, useMemo } from 'preact/hooks';
import caravanLevels from '../../data/caravan-levels.json';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData } from '../../i18n/index';
import './Calculator.css';
import './CaravanCalculator.css';

interface CaravanCalculatorProps {
  readonly lang: 'de' | 'en';
  readonly translationData: TranslationData;
}

type Faction = 'red' | 'blue' | 'yellow';

// Counter system: counters[a] = b means faction a beats faction b
const COUNTERS: Record<Faction, Faction> = {
  blue: 'red',    // Wings of Dawn beats Blood Rose
  red: 'yellow',  // Blood Rose beats Guard of Order
  yellow: 'blue', // Guard of Order beats Wings of Dawn
};

// Hero name and buff type per faction
const FACTION_HERO: Record<Faction, { name: string; buffKey: string }> = {
  blue:   { name: 'Laura',   buffKey: 'ATK' },
  red:    { name: 'Katrina', buffKey: 'DEF' },
  yellow: { name: 'Chicha',  buffKey: 'DMG' },
};

function parsePower(input: string): number {
  let s = input.trim().toLowerCase().replace(/\s/g, '');
  let multiplier = 1;

  if (s.endsWith('m')) { multiplier = 1_000_000; s = s.slice(0, -1); }
  else if (s.endsWith('k')) { multiplier = 1_000; s = s.slice(0, -1); }

  const commaCount = (s.match(/,/g) || []).length;
  const dotCount   = (s.match(/\./g) || []).length;

  if (commaCount > 1) {
    s = s.replace(/,/g, '');
  } else if (dotCount > 1) {
    s = s.replace(/\./g, '');
  } else if (commaCount === 1 && dotCount === 1) {
    const lastComma = s.lastIndexOf(',');
    const lastDot   = s.lastIndexOf('.');
    s = lastComma > lastDot
      ? s.replace('.', '').replace(',', '.')
      : s.replace(',', '');
  } else if (commaCount === 1) {
    const afterComma = s.split(',')[1] || '';
    s = afterComma.length === 3 ? s.replace(',', '') : s.replace(',', '.');
  }

  const num = parseFloat(s);
  return isNaN(num) ? NaN : num * multiplier;
}

function formatCompact(value: number, lang: string): string {
  if (value >= 1_000_000) {
    const m   = value / 1_000_000;
    const str = m % 1 === 0 ? m.toFixed(0) : m.toFixed(1);
    return lang === 'de' ? `${str.replace('.', ',')}m` : `${str}m`;
  }
  if (value >= 1_000) {
    const k   = value / 1_000;
    const str = k % 1 === 0 ? k.toFixed(0) : k.toFixed(1);
    return lang === 'de' ? `${str.replace('.', ',')}k` : `${str}k`;
  }
  return value.toString();
}

function getBeatableSubLevels(start: number, end: number, power: number): number {
  if (power < start) return 0;
  if (power >= end) return 20;
  return Math.floor(1 + 19 * (power - start) / (end - start));
}

function getMatchingBonus(count: number): number {
  if (count >= 5) return 0.10;
  if (count >= 4) return 0.07;
  if (count >= 3) return 0.05;
  return 0;
}

interface FactionButtonsProps {
  value: Faction | null;
  onChange: (f: Faction | null) => void;
  includeNone?: boolean;
  noneLabel: string;
  redLabel: string;
  blueLabel: string;
  yellowLabel: string;
}

function FactionButtons({ value, onChange, includeNone, noneLabel, redLabel, blueLabel, yellowLabel }: FactionButtonsProps) {
  const options: { key: Faction | null; label: string; cls: string }[] = [
    { key: 'red',    label: redLabel,    cls: 'faction-btn-red'    },
    { key: 'blue',   label: blueLabel,   cls: 'faction-btn-blue'   },
    { key: 'yellow', label: yellowLabel, cls: 'faction-btn-yellow' },
  ];
  if (includeNone) options.push({ key: null, label: noneLabel, cls: 'faction-btn-none' });

  return (
    <div className="faction-btn-group">
      {options.map(({ key, label, cls }) => (
        <button
          key={String(key)}
          type="button"
          className={`faction-btn ${cls} ${value === key ? 'active' : ''}`}
          onClick={() => onChange(value === key ? (includeNone ? null : null) : key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function CaravanCalculator({ lang, translationData }: CaravanCalculatorProps) {
  const [powerInput,      setPowerInput]      = useState('');
  const [yourFaction,     setYourFaction]     = useState<Faction | null>(null);
  const [matchingCount,   setMatchingCount]   = useState<number>(5);
  const [weeklyActive,    setWeeklyActive]    = useState(false);
  const [enemyFaction,    setEnemyFaction]    = useState<Faction | null>(null);

  const t = useTranslations(translationData);

  const basePower = useMemo(() => {
    if (!powerInput.trim()) return null;
    const parsed = parsePower(powerInput);
    return isNaN(parsed) || parsed <= 0 ? null : parsed;
  }, [powerInput]);

  const buffs = useMemo(() => {
    const matchingBonus = yourFaction ? getMatchingBonus(matchingCount) : 0;
    const heroBonus     = weeklyActive && yourFaction ? 0.40 : 0;
    const counterBonus  = (yourFaction && enemyFaction && COUNTERS[yourFaction] === enemyFaction) ? 0.10 : 0;
    const totalMultiplier = (1 + matchingBonus) * (1 + heroBonus) * (1 + counterBonus);
    return { matchingBonus, heroBonus, counterBonus, totalMultiplier };
  }, [yourFaction, matchingCount, weeklyActive, enemyFaction]);

  const effectivePower = basePower !== null ? Math.round(basePower * buffs.totalMultiplier) : null;

  const results = useMemo(() => {
    if (effectivePower === null) return null;
    return caravanLevels.map(({ level, start, end }) => ({
      level,
      start,
      end,
      beatable: getBeatableSubLevels(start, end, effectivePower),
    }));
  }, [effectivePower]);

  const summary = useMemo(() => {
    if (!results) return null;
    let maxFullLevel   = 0;
    let maxReachLevel  = 0;
    let maxReachSub    = 0;
    for (const { level, beatable } of results) {
      if (beatable === 20) maxFullLevel = level;
      if (beatable > 0) { maxReachLevel = level; maxReachSub = beatable; }
    }
    return { maxFullLevel, maxReachLevel, maxReachSub };
  }, [results]);

  const factionNames = {
    red:    t('calc.caravan.factionRed'),
    blue:   t('calc.caravan.factionBlue'),
    yellow: t('calc.caravan.factionYellow'),
  };

  const hasAnyBuff = buffs.totalMultiplier > 1.0001;

  return (
    <div className="calculator-container">
      <div className="info-box">
        <p>{t('calc.caravan.infoText')}</p>
      </div>

      {/* Power input */}
      <div className="calculator-form compact">
        <div className="form-row compact-row centered">
          <div className="form-group compact" style={{ minWidth: '220px' }}>
            <label htmlFor="formation-power">{t('calc.caravan.formationPower')}:</label>
            <input
              id="formation-power"
              type="text"
              value={powerInput}
              placeholder={t('calc.caravan.placeholder')}
              onInput={(e) => setPowerInput((e.target as HTMLInputElement).value)}
              style={{ width: '220px' }}
            />
          </div>
        </div>
      </div>

      {/* Faction & Buffs section */}
      <div className="faction-section">
        <h4 className="faction-section-title">{t('calc.caravan.factionSection')}</h4>

        <div className="faction-row">
          <span className="faction-label">{t('calc.caravan.yourFaction')}:</span>
          <FactionButtons
            value={yourFaction}
            onChange={setYourFaction}
            includeNone={true}
            noneLabel={t('calc.caravan.factionNone')}
            redLabel={factionNames.red}
            blueLabel={factionNames.blue}
            yellowLabel={factionNames.yellow}
          />
        </div>

        {yourFaction && (
          <>
            <div className="faction-row">
              <span className="faction-label">{t('calc.caravan.matchingHeroes')}:</span>
              <div className="faction-btn-group">
                {[3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`faction-btn faction-btn-count ${matchingCount === n ? 'active' : ''}`}
                    onClick={() => setMatchingCount(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="faction-row">
              <span className="faction-label">{t('calc.caravan.weeklyBonus')}:</span>
              <div className="faction-btn-group">
                <button
                  type="button"
                  className={`faction-btn ${weeklyActive ? 'faction-btn-yes active' : 'faction-btn-no'}`}
                  onClick={() => setWeeklyActive(!weeklyActive)}
                >
                  {weeklyActive
                    ? `${FACTION_HERO[yourFaction].name} (+40% ${FACTION_HERO[yourFaction].buffKey})`
                    : t('calc.caravan.weeklyBonusOff')}
                </button>
              </div>
            </div>
          </>
        )}

        <div className="faction-row">
          <span className="faction-label">{t('calc.caravan.enemyFaction')}:</span>
          <FactionButtons
            value={enemyFaction}
            onChange={setEnemyFaction}
            includeNone={true}
            noneLabel={t('calc.caravan.factionNone')}
            redLabel={factionNames.red}
            blueLabel={factionNames.blue}
            yellowLabel={factionNames.yellow}
          />
        </div>

        {/* Faction interaction hint */}
        {yourFaction && enemyFaction && (() => {
          const counters = COUNTERS[yourFaction] === enemyFaction;
          const countered = COUNTERS[enemyFaction] === yourFaction;
          return (
            <div className={`faction-hint ${counters ? 'hint-good' : countered ? 'hint-bad' : 'hint-neutral'}`}>
              {counters
                ? `${factionNames[yourFaction]} > ${factionNames[enemyFaction]} — +10% ${t('calc.caravan.counterAdvantage')}`
                : countered
                  ? `${factionNames[enemyFaction]} > ${factionNames[yourFaction]} — ${t('calc.caravan.counterDisadvantage')}`
                  : t('calc.caravan.noCounterBonus')}
            </div>
          );
        })()}
      </div>

      {/* Effective power breakdown */}
      {basePower !== null && hasAnyBuff && (
        <div className="effective-power-box">
          <div className="effective-power-header">{t('calc.caravan.effectivePower')}</div>
          <div className="effective-power-value">{formatCompact(effectivePower!, lang)}</div>
          <div className="effective-power-breakdown">
            <span>{formatCompact(basePower, lang)}</span>
            {buffs.matchingBonus > 0 && (
              <span className="buff-chip buff-match">
                ×{(1 + buffs.matchingBonus).toFixed(2)} (+{Math.round(buffs.matchingBonus * 100)}% {t('calc.caravan.matchingBonus')})
              </span>
            )}
            {buffs.heroBonus > 0 && yourFaction && (
              <span className="buff-chip buff-hero">
                ×1.40 ({FACTION_HERO[yourFaction].name} +40% {FACTION_HERO[yourFaction].buffKey})
              </span>
            )}
            {buffs.counterBonus > 0 && (
              <span className="buff-chip buff-counter">
                ×1.10 (+10% {t('calc.caravan.counterAdvantage')})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {summary && results && (
        <>
          <div className="calculator-results">
            <div className="result-card highlight">
              <div className="result-label">{t('calc.caravan.maxFullLevel')}</div>
              <div className="result-value">
                {summary.maxFullLevel > 0 ? `Level ${summary.maxFullLevel}` : t('calc.caravan.none')}
              </div>
            </div>

            {summary.maxReachLevel > summary.maxFullLevel && (
              <div className="result-card">
                <div className="result-label">{t('calc.caravan.maxReach')}</div>
                <div className="result-value">
                  {`Level ${summary.maxReachLevel} · ${t('calc.caravan.subLevel')} ${summary.maxReachSub}`}
                </div>
              </div>
            )}
          </div>

          <div className="caravan-table-wrapper">
            <table className="caravan-table">
              <thead>
                <tr>
                  <th>{t('calc.caravan.level')}</th>
                  <th>{t('calc.caravan.powerRange')}</th>
                  <th>{t('calc.caravan.beatable')}</th>
                </tr>
              </thead>
              <tbody>
                {results.map(({ level, start, end, beatable }) => (
                  <tr
                    key={level}
                    className={
                      beatable === 20 ? 'caravan-row-green'
                      : beatable > 0  ? 'caravan-row-yellow'
                      :                 'caravan-row-red'
                    }
                  >
                    <td>{level}</td>
                    <td>{formatCompact(start, lang)} – {formatCompact(end, lang)}</td>
                    <td>
                      {beatable === 20
                        ? t('calc.caravan.allClear')
                        : beatable === 0
                          ? t('calc.caravan.none')
                          : `${beatable}/20`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!summary && (
        <div className="info-box" style={{ marginTop: '1rem' }}>
          <p>{t('calc.caravan.enterPower')}</p>
        </div>
      )}
    </div>
  );
}
