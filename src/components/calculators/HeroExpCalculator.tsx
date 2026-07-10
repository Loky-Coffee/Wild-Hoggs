import { useMemo } from 'preact/hooks';
import heroExpTable from '../../data/hero-exp-table.json';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData, TranslationKey } from '../../i18n/index';
import { useCalculatorState } from '../../hooks/useCalculatorState';
import { useProfile } from '../../hooks/useProfile';
import './HeroExpCalculator.css';

const TABLE = heroExpTable as number[];
const MAX_LEVEL = TABLE.length; // 175

// Spiel-Schreibweise: K / M / G (Milliarde)
function fmtShort(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}G`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(v) || lo));
}

interface HeroExpState { currentLevel: number; targetLevel: number }
const DEFAULT: HeroExpState = { currentLevel: 1, targetLevel: MAX_LEVEL };

interface Props {
  readonly lang: 'de' | 'en';
  readonly translationData: TranslationData;
}

export default function HeroExpCalculator({ lang, translationData }: Props) {
  const { activeProfile } = useProfile();
  const [stored, setStored] = useCalculatorState<HeroExpState>('hero-exp', 'main', DEFAULT, activeProfile.id);
  const t = useTranslations(translationData);
  const k = (s: string) => t(s as TranslationKey);
  const numLocale = lang; // echte Sprach-Locale (statt hartkodiert de-DE/en-US)

  const current = clamp(stored.currentLevel, 1, MAX_LEVEL - 1);
  const target = clamp(stored.targetLevel, current + 1, MAX_LEVEL);

  const setCurrent = (v: number) => {
    const c = clamp(v, 1, MAX_LEVEL - 1);
    setStored((s) => ({ currentLevel: c, targetLevel: Math.max(c + 1, clamp(s.targetLevel, 2, MAX_LEVEL)) }));
  };
  const setTarget = (v: number) => setStored((s) => ({ ...s, targetLevel: clamp(v, current + 1, MAX_LEVEL) }));

  const total = useMemo(() => {
    let sum = 0;
    for (let n = current; n < target; n++) sum += TABLE[n] ?? 0;
    return sum;
  }, [current, target]);

  const rows = useMemo(() => {
    const r: { level: number; exp: number }[] = [];
    for (let n = current; n < target; n++) r.push({ level: n, exp: TABLE[n] ?? 0 });
    return r;
  }, [current, target]);

  const pct = Math.round(((current - 1) / (MAX_LEVEL - 1)) * 100);

  return (
    <div class="hx-wrap">
      <div class="hx-card">
        <div class="hx-levels">
          <div class="hx-lvl">
            <span class="hx-lvl-label">{k('calc.hero.currentLevel')}</span>
            <input class="hx-lvl-num" type="number" min={1} max={MAX_LEVEL - 1} value={current}
              onChange={(e) => setCurrent(Number((e.target as HTMLInputElement).value))} />
            <input class="hx-slider" type="range" min={1} max={MAX_LEVEL - 1} value={current}
              onInput={(e) => setCurrent(Number((e.target as HTMLInputElement).value))} aria-label={k('calc.hero.currentLevel')} />
          </div>

          <div class="hx-arrow">→</div>

          <div class="hx-lvl">
            <span class="hx-lvl-label">{k('calc.hero.targetLevel')}</span>
            <input class="hx-lvl-num" type="number" min={2} max={MAX_LEVEL} value={target}
              onChange={(e) => setTarget(Number((e.target as HTMLInputElement).value))} />
            <input class="hx-slider" type="range" min={2} max={MAX_LEVEL} value={target}
              onInput={(e) => setTarget(Number((e.target as HTMLInputElement).value))} aria-label={k('calc.hero.targetLevel')} />
          </div>
        </div>

        <div class="hx-result">
          <span class="hx-result-label">🎖️ {k('calc.hero.totalExp')}</span>
          <span class="hx-result-val">{fmtShort(total)}</span>
          <span class="hx-result-sub">
            {new Intl.NumberFormat(numLocale).format(total)} · {target - current} {k('calc.hero.levels')}
          </span>
        </div>

        <div class="hx-progress" title={`${pct}%`}>
          <div class="hx-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <details class="hx-details">
        <summary>{k('calc.hero.expPerLevel')} · Lv {current} → {target}</summary>
        <div class="hx-table">
          {rows.map((r) => (
            <div key={r.level} class="hx-row">
              <span class="hx-row-lvl">Lv {r.level} → {r.level + 1}</span>
              <span class="hx-row-exp">{fmtShort(r.exp)}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
