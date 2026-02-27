import { useMemo, useEffect, useState } from 'preact/hooks';
import caravanLevels from '../../data/caravan-levels.json';
import { FACTIONS, type HeroFaction } from '../../data/heroes';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData } from '../../i18n/index';
import { useCalculatorState } from '../../hooks/useCalculatorState';
import { useAuth } from '../../hooks/useAuth';
import './Calculator.css';
import './CaravanCalculator.css';

interface CaravanCalculatorProps {
  readonly lang: string;
  readonly translationData: TranslationData;
}

const FACTION_HERO: Record<HeroFaction, { name: string; buffKey: string }> = {
  'wings-of-dawn':  { name: 'Laura',   buffKey: 'ATK' },
  'blood-rose':     { name: 'Katrina', buffKey: 'DEF' },
  'guard-of-order': { name: 'Chicha',  buffKey: 'DMG' },
};

const FACTION_ICON: Record<HeroFaction, string> = {
  'blood-rose':     '/images/heroes/symbols/blood-rose.webp',
  'wings-of-dawn':  '/images/heroes/symbols/wings-of-dawn.webp',
  'guard-of-order': '/images/heroes/symbols/guard-of-order.webp',
};

const FACTION_LIST = Object.keys(FACTIONS) as HeroFaction[];

const FACTION_POWER_FIELD: Record<HeroFaction, 'formation_power_br' | 'formation_power_wd' | 'formation_power_go'> = {
  'blood-rose':     'formation_power_br',
  'wings-of-dawn':  'formation_power_wd',
  'guard-of-order': 'formation_power_go',
};

function parsePower(input: string): number {
  let s = input.trim().toLowerCase().replace(/\s/g, '');
  let multiplier = 1;
  if (s.endsWith('m')) { multiplier = 1_000_000; s = s.slice(0, -1); }
  else if (s.endsWith('k')) { multiplier = 1_000; s = s.slice(0, -1); }
  const commaCount = (s.match(/,/g) || []).length;
  const dotCount   = (s.match(/\./g) || []).length;
  if (commaCount > 1) { s = s.replace(/,/g, ''); }
  else if (dotCount > 1) { s = s.replace(/\./g, ''); }
  else if (commaCount === 1 && dotCount === 1) {
    const lastComma = s.lastIndexOf(',');
    const lastDot   = s.lastIndexOf('.');
    s = lastComma > lastDot ? s.replace('.', '').replace(',', '.') : s.replace(',', '');
  } else if (commaCount === 1) {
    const afterComma = s.split(',')[1] || '';
    s = afterComma.length === 3 ? s.replace(',', '') : s.replace(',', '.');
  }
  const num = parseFloat(s);
  return isNaN(num) ? NaN : num * multiplier;
}

function formatCompact(value: number, lang: string): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    const str = m % 1 === 0 ? m.toFixed(0) : m.toFixed(1);
    return lang === 'de' ? `${str.replace('.', ',')}m` : `${str}m`;
  }
  if (value >= 1_000) {
    const k = value / 1_000;
    const str = k % 1 === 0 ? k.toFixed(0) : k.toFixed(1);
    return lang === 'de' ? `${str.replace('.', ',')}k` : `${str}k`;
  }
  return value.toString();
}

function getBeatableSubLevels(start: number, end: number, power: number): number {
  if (power < start) return 0;
  if (power >= end) return 20;
  if (end === start) return 0;
  return Math.floor(1 + 19 * (power - start) / (end - start));
}

function getMatchingBonus(count: number): number {
  if (count >= 5) return 0.10;
  if (count >= 4) return 0.07;
  if (count >= 3) return 0.05;
  return 0;
}

interface CaravanState {
  powerInput: string;
  yourFaction: HeroFaction | null;
  matchingCount: number;
  weeklyActive: boolean;
}

const CARAVAN_DEFAULT: CaravanState = {
  powerInput: '',
  yourFaction: null,
  matchingCount: 5,
  weeklyActive: false,
};

export default function CaravanCalculator({ lang, translationData }: CaravanCalculatorProps) {
  const [stored, setStored] = useCalculatorState<CaravanState>('caravan', 'main', CARAVAN_DEFAULT);
  const { user } = useAuth();

  // calculated is pure UI state — never persisted, resets to false on every page load
  const [calculated, setCalculated] = useState(false);

  const powerInput    = stored.powerInput;
  const yourFaction   = stored.yourFaction;
  const matchingCount = stored.matchingCount;
  const weeklyActive  = stored.weeklyActive;

  const setPowerInput    = (v: string)  => setStored(s => ({ ...s, powerInput: v }));
  const setMatchingCount = (v: number)  => setStored(s => ({ ...s, matchingCount: v }));
  const setWeeklyActive  = (v: boolean | ((prev: boolean) => boolean)) =>
    setStored(s => ({ ...s, weeklyActive: typeof v === 'function' ? v(s.weeklyActive) : v }));

  // On load: if calculator is still at defaults and user has profile data → auto-fill
  useEffect(() => {
    if (!user?.faction) return;
    const faction = FACTION_LIST.includes(user.faction as HeroFaction)
      ? (user.faction as HeroFaction) : null;
    if (!faction) return;
    setStored(s => {
      if (s.yourFaction !== null || s.powerInput.trim()) return s; // don't override manual state
      const savedPower = user[FACTION_POWER_FIELD[faction]] ?? null;
      return {
        ...s,
        yourFaction: faction,
        powerInput: savedPower ? String(savedPower) : s.powerInput,
      };
    });
  }, [user?.faction, user?.formation_power_br, user?.formation_power_wd, user?.formation_power_go]); // eslint-disable-line react-hooks/exhaustive-deps

  // When selecting a faction: always fill power from profile if available, else keep current
  const handleFactionSelect = (f: HeroFaction) => {
    const newFaction = f === yourFaction ? null : f;
    setStored(s => {
      const savedPower = newFaction ? (user?.[FACTION_POWER_FIELD[newFaction]] ?? null) : null;
      return {
        ...s,
        yourFaction: newFaction,
        powerInput: savedPower ? String(savedPower) : s.powerInput,
      };
    });
  };

  const t = useTranslations(translationData);

  const basePower = useMemo(() => {
    if (!powerInput.trim()) return null;
    const p = parsePower(powerInput);
    return isNaN(p) || p <= 0 ? null : p;
  }, [powerInput]);

  const buffs = useMemo(() => {
    const matchingBonus = yourFaction ? getMatchingBonus(matchingCount) : 0;
    const heroBonus     = weeklyActive && yourFaction ? 0.10 : 0;
    const total = 1 + matchingBonus + heroBonus;
    return { matchingBonus, heroBonus, total };
  }, [yourFaction, matchingCount, weeklyActive]);

  const effectivePower = basePower !== null ? Math.round(basePower * buffs.total) : null;

  const results = useMemo(() => {
    if (effectivePower === null) return null;
    return caravanLevels.map(({ level, start, end }) => ({
      level, start, end,
      beatable: getBeatableSubLevels(start, end, effectivePower),
    }));
  }, [effectivePower]);

  const summary = useMemo(() => {
    if (!results) return null;
    let maxFull = 0, maxLevel = 0, maxSub = 0;
    for (const { level, beatable } of results) {
      if (beatable === 20) maxFull = level;
      if (beatable > 0) { maxLevel = level; maxSub = beatable; }
    }
    return { maxFull, maxLevel, maxSub };
  }, [results]);

  const fn: Record<HeroFaction, string> = {
    'blood-rose':     t('calc.caravan.factionRed'),
    'wings-of-dawn':  t('calc.caravan.factionBlue'),
    'guard-of-order': t('calc.caravan.factionYellow'),
  };

  return (
    <div className={`calc-split${(results && calculated) ? ' has-results' : ''}`}>
    <div className="calc-controls">

      {/* ── Step 1: Power Input ── */}
      <div className="calc-step">
        <div className="calc-step-label">{t('calc.caravan.formationPower')}</div>
        <input
          type="text"
          className="cc-power-input"
          value={powerInput}
          placeholder={t('calc.caravan.placeholder')}
          onInput={e => setPowerInput((e.target as HTMLInputElement).value)}
        />
      </div>

      {/* ── Step 2: Your Faction + Bonuses ── */}
      <div className="calc-step">
        <div className="calc-step-label">{t('calc.caravan.yourFaction')}</div>
        <div className="cc-faction-row">
          {FACTION_LIST.map(f => {
            const savedPower = user?.[FACTION_POWER_FIELD[f]] ?? null;
            return (
              <button
                key={f}
                type="button"
                className={`cc-faction-card cc-${f}${yourFaction === f ? ' selected' : ''}`}
                onClick={() => handleFactionSelect(f)}
                aria-label={fn[f]}
              >
                <img src={FACTION_ICON[f]} alt={fn[f]} className="cc-faction-icon" />
                <span className="cc-faction-name">{fn[f]}</span>
                {savedPower && (
                  <span className="cc-faction-saved">💾 {formatCompact(savedPower, lang)}</span>
                )}
              </button>
            );
          })}
        </div>

        {yourFaction && (
          <div className="cc-options-row">
            <div className="cc-heroes">
              <span className="cc-opt-label">{t('calc.caravan.matchingHeroes')}:</span>
              {[3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  className={`cc-count-chip${matchingCount === n ? ' active' : ''}`}
                  onClick={() => setMatchingCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`cc-weekly-btn${weeklyActive ? ' active' : ''}`}
              onClick={() => setWeeklyActive(v => !v)}
            >
              {FACTION_HERO[yourFaction].name} +40% {FACTION_HERO[yourFaction].buffKey}
            </button>
          </div>
        )}
      </div>

      {/* ── Effective Power ── */}
      {basePower !== null && buffs.total > 1.001 && (
        <div className="cc-eff-row">
          <span className="cc-eff-label">{t('calc.caravan.effectivePower')}:</span>
          <span className="cc-eff-value">{formatCompact(effectivePower!, lang)}</span>
          <div className="cc-eff-chips">
            {buffs.matchingBonus > 0 && (
              <span className="cc-chip cc-chip-match">+{Math.round(buffs.matchingBonus * 100)}%</span>
            )}
            {buffs.heroBonus > 0 && (
              <span className="cc-chip cc-chip-hero">+40%</span>
            )}
          </div>
        </div>
      )}

      {/* ── Calculate Button ── */}
      <button
        type="button"
        className={`calc-btn${calculated ? ' done' : ''}`}
        onClick={() => setCalculated(true)}
        disabled={calculated}
      >
        {calculated ? `✓ ${t('calc.caravan.autoCalculate')}` : t('calc.caravan.calculate')}
      </button>

    </div>{/* end calc-controls */}
    <div className="calc-results">

      {/* ── Results ── */}
      {summary && results && calculated ? (
        <>
          <div className="cc-summary">
            <div className="cc-summary-card">
              <div className="cc-summary-lbl">{t('calc.caravan.maxFullLevel')}</div>
              <div className="cc-summary-val">
                {summary.maxFull > 0 ? `Lvl ${summary.maxFull}` : '—'}
              </div>
            </div>
            {summary.maxLevel > summary.maxFull && (
              <div className="cc-summary-card">
                <div className="cc-summary-lbl">{t('calc.caravan.maxReach')}</div>
                <div className="cc-summary-val">
                  Lvl {summary.maxLevel} · {summary.maxSub}/20
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
                    className={beatable === 20 ? 'caravan-row-green' : beatable > 0 ? 'caravan-row-yellow' : 'caravan-row-red'}
                  >
                    <td>{level}</td>
                    <td>{formatCompact(start, lang)}–{formatCompact(end, lang)}</td>
                    <td>
                      {beatable === 20
                        ? t('calc.caravan.allClear')
                        : beatable === 0
                          ? '—'
                          : `${beatable}/20`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : calculated ? (
        <p className="calc-hint">{t('calc.caravan.enterPower')}</p>
      ) : null}

    </div>{/* end calc-results */}
    </div>
  );
}
