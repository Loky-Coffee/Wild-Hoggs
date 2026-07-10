import { useState, useEffect, useMemo } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { validatedBuildings as buildingsData } from '../../data/validated/buildings';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData, TranslationKey } from '../../i18n/index';
import type { Building } from '../../schemas/buildings';
import buildingNames from '../../data/buildings-names.json';
import buildingBonuses from '../../data/buildings-bonuses.json';
import buildingUnlocks from '../../data/buildings-unlocks.json';
import { LAB_SPEED_DEFAULT, effectiveLabSpeed, type LabSpeed } from '../../utils/labSpeed';
import { useCalculatorState } from '../../hooks/useCalculatorState';
import { useProfile } from '../../hooks/useProfile';
import { useSheetDrag } from '../../hooks/useSheetDrag';
import './Calculator.css';
import './BuildingCalculator.css';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BNAMES = buildingNames as any;
interface Bonus { key: string; name: Record<string, string>; fmt: 'percent' | 'plus' | 'flat'; values: number[]; }
const BONUSES = buildingBonuses as unknown as Record<string, Bonus[]>;
interface Unlock { level: number; name: Record<string, string>; }
const UNLOCKS = buildingUnlocks as unknown as Record<string, Unlock[]>;

// Gebäude, die es in der Stadt mehrfach gibt (jedes Exemplar zählt zur Gesamt-Kampfkraft)
const COUNTS: Record<string, number> = {
  residence: 6, 'steel-plant': 5, 'smelting-plant': 4, lumberyard: 4,
  'wind-turbine': 4, 'training-ground': 4, warehouse: 3, formation: 4,
};

interface Inst { iid: string; b: Building; num: number; }
const INSTANCES: Inst[] = buildingsData.flatMap((b) => {
  const n = COUNTS[b.id] ?? 1;
  if (n <= 1) return [{ iid: b.id, b, num: 0 }];
  return Array.from({ length: n }, (_, i) => ({ iid: `${b.id}#${i + 1}`, b, num: i + 1 }));
});

// Farben + Icons pro Bonus (damit man Boni unterscheiden kann)
const BONUS_COLORS = ['#6ee7a0', '#7cc5ff', '#c792ea', '#f78c6c'];
function bonusIcon(name: string): string {
  const n = name.toLowerCase();
  if (/atk|angriff/.test(n)) return '⚔️';
  if (/def|verteidig/.test(n)) return '🛡️';
  if (/produktion|yield|prod/.test(n)) return '📈';
  if (/geschwindig|speed|ausspäh/.test(n)) return '⚡';
  if (/levelgrenze|hero|helden/.test(n)) return '🦸';
  if (/haltbar|durab/.test(n)) return '🧱';
  if (/schutz|protect/.test(n)) return '🔒';
  if (/soldat|unit|menge|grenze|cap|truppe|kapaz|gruppe/.test(n)) return '👥';
  return '✨';
}

// Spiel-Schreibweise K / M / G (sprachunabhängig — kein hartkodiertes Locale)
function fcCompact(n: number, _lang?: 'de' | 'en'): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}G`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}
function fmtDur(sec: number): string {
  sec = Math.max(0, Math.round(sec));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const p = (n: number) => String(n).padStart(2, '0');
  return (d > 0 ? `${d}d ` : '') + `${p(h)}:${p(m)}`;
}

// Echte Ressourcen-Icons (Steel hat kein Icon -> ⚙️)
const RES_ICON: Record<string, string> = {
  food: '/images/res-icons/food.webp',
  wood: '/images/res-icons/wood.webp',
  zent: '/images/res-icons/zent.webp',
  steel: '/images/res-icons/steel.webp',
};
function ric(res: string) {
  return <img src={RES_ICON[res]} class="res-ic" alt="" width={16} height={16} />;
}

interface BuildingState { levels: Record<string, number> }
const BUILDING_DEFAULT: BuildingState = { levels: {} };

interface BuildingCalculatorProps {
  readonly lang: string;
  readonly translationData: TranslationData;
}

export default function BuildingCalculator({ lang, translationData }: BuildingCalculatorProps) {
  const { activeProfile } = useProfile();
  const [stored, setStored] = useCalculatorState<BuildingState>('building', 'main', BUILDING_DEFAULT, activeProfile.id);
  const [storedSpeed] = useCalculatorState<LabSpeed>('buildspeed', 'main', LAB_SPEED_DEFAULT, activeProfile.id);
  const [overrideSpeed, setOverrideSpeed] = useState<LabSpeed | null>(null);
  const [hdStored] = useCalculatorState<{ hide: boolean }>('building-hidedupes', 'main', { hide: true }, activeProfile.id);
  const [hideDupesOverride, setHideDupesOverride] = useState<boolean | null>(null);
  const [openIid, setOpenIid] = useState<string | null>(null);

  // Bau-Speed + Doppelte-ausblenden werden von den Buttons ÜBER der Analyse gesetzt;
  // live via Event, sonst aus Cache/Server.
  useEffect(() => {
    const hSpeed = (e: Event) => setOverrideSpeed((e as CustomEvent).detail as LabSpeed);
    const hDupes = (e: Event) => setHideDupesOverride(Boolean((e as CustomEvent).detail));
    window.addEventListener('wh-buildspeed-change', hSpeed);
    window.addEventListener('wh-hidedupes-change', hDupes);
    return () => {
      window.removeEventListener('wh-buildspeed-change', hSpeed);
      window.removeEventListener('wh-hidedupes-change', hDupes);
    };
  }, []);
  const hideDupes = hideDupesOverride ?? !!hdStored.hide;

  const t = useTranslations(translationData);
  const tk = (s: string) => t(s as TranslationKey);
  const numLang: 'de' | 'en' = lang === 'de' ? 'de' : 'en';
  const kampfkraft = tk('calc.building.power');
  const buildSpeed = overrideSpeed ?? storedSpeed;
  const eff = effectiveLabSpeed(buildSpeed);
  const applySpeed = (sec: number) => sec / (1 + eff / 100);
  const bName = (id: string) => BNAMES[id]?.[lang] || BNAMES[id]?.en || id;
  const resName = (r: string) => BNAMES.__resources__?.[r]?.[lang] || BNAMES.__resources__?.[r]?.en || r;

  const capOf = (b: Building) => b.displayMaxLevel ?? b.maxLevel;
  const levelOf = (iid: string): number => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v: any = (stored.levels ?? {})[iid];
    return typeof v === 'number' ? v : (v?.current ?? 1);
  };
  const curOf = (inst: Inst) => Math.max(1, Math.min(levelOf(inst.iid), capOf(inst.b)));
  const setLevel = (iid: string, lvl: number) =>
    setStored((s) => ({ ...s, levels: { ...(s.levels ?? {}), [iid]: lvl } }));
  const instName = (inst: Inst) => bName(inst.b.id) + (inst.num ? ` ${inst.num}` : '');

  const open = openIid ? INSTANCES.find((x) => x.iid === openIid) ?? null : null;

  const overview = useMemo(() => {
    let power = 0, curSum = 0, maxSum = 0, food = 0, wood = 0, zent = 0, steel = 0, time = 0;
    for (const inst of INSTANCES) {
      const cap = capOf(inst.b);
      const cur = curOf(inst);
      power += inst.b.costs[cur - 1]?.power ?? 0;
      curSum += cur; maxSum += cap;
      for (let lvl = cur + 1; lvl <= cap; lvl++) {
        const c = inst.b.costs[lvl - 1];
        if (c) { food += c.food; wood += c.wood; zent += c.zent; steel += c.steel; time += c.time; }
      }
    }
    return { power, pct: maxSum > 0 ? Math.round((curSum / maxSum) * 100) : 0, food, wood, zent, steel, time };
  }, [stored.levels]);

  return (
    <div class="bld-wrap">
      <div class="bld-overview">
        <div class="bld-ov-item">
          <span class="bld-ov-label">{kampfkraft}</span>
          <span class="bld-ov-val">{fcCompact(overview.power, numLang)}</span>
        </div>
        <div class="bld-ov-item">
          <span class="bld-ov-label">{tk('calc.building.progress')}</span>
          <span class="bld-ov-val">{overview.pct}%</span>
        </div>
        <div class="bld-ov-item bld-ov-rest">
          <span class="bld-ov-label">{tk('calc.building.remainingToMax')}</span>
          <span class="bld-ov-rest-vals">
            {ric('food')} {fcCompact(overview.food, numLang)} {ric('wood')} {fcCompact(overview.wood, numLang)} {ric('zent')} {fcCompact(overview.zent, numLang)} {ric('steel')} {fcCompact(overview.steel, numLang)} ⏱ {fmtDur(applySpeed(overview.time))}
          </span>
        </div>
      </div>

      <div class="bld-grid">
        {INSTANCES.filter((inst) => !hideDupes || inst.num <= 1).map((inst) => {
          const cap = capOf(inst.b);
          const cur = curOf(inst);
          const pct = Math.round((cur / cap) * 100);
          const maxed = cur >= cap;
          return (
            <button key={inst.iid} type="button" class={`bld-card${maxed ? ' maxed' : ''}`} onClick={() => setOpenIid(inst.iid)}>
              {inst.b.image && <img src={inst.b.image} alt="" loading="lazy" width={96} height={96} />}
              <span class="bld-card-name">{instName(inst)}</span>
              <span class="bld-card-lvl">{maxed ? 'MAX' : `Lv ${cur} / ${cap}`}</span>
              <div class="bld-card-bar"><div class="bld-card-bar-fill" style={{ width: `${pct}%` }} /></div>
              <span class="bld-card-power">{kampfkraft} {fcCompact(inst.b.costs[cur - 1]?.power ?? 0, numLang)}</span>
            </button>
          );
        })}
      </div>

      {open && (
        <BuildingSheet
          building={open.b}
          cap={capOf(open.b)}
          current={curOf(open)}
          name={instName(open)}
          numLang={numLang}
          lang={lang}
          kampfkraft={kampfkraft}
          tk={tk}
          applySpeed={applySpeed}
          onSetLevel={(lvl) => setLevel(open.iid, lvl)}
          onClose={() => setOpenIid(null)}
        />
      )}

    </div>
  );
}

interface SheetProps {
  readonly building: Building;
  readonly cap: number;
  readonly current: number;
  readonly name: string;
  readonly numLang: 'de' | 'en';
  readonly lang: string;
  readonly kampfkraft: string;
  readonly tk: (s: string) => string;
  readonly applySpeed: (sec: number) => number;
  readonly onSetLevel: (lvl: number) => void;
  readonly onClose: () => void;
}

function BuildingSheet({ building, cap, current, name, numLang, lang, kampfkraft, tk, applySpeed, onSetLevel, onClose }: SheetProps) {
  const { handleRef, sheetRef } = useSheetDrag(onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const fc = (n: number) => fcCompact(n, numLang);
  const bonuses = BONUSES[building.id] ?? [];
  const unlocks = UNLOCKS[building.id] ?? [];
  const unlockAt = (lvl: number) => unlocks.find((u) => u.level === lvl);
  const reqName = (r: { id?: string; name?: string }) =>
    r.id ? (BNAMES[r.id]?.[lang] || BNAMES[r.id]?.en || r.id) : (r.name || '');
  const bonusName = (b: Bonus) => b.name[lang] || b.name.en || '';
  const bColor = (i: number) => BONUS_COLORS[i % BONUS_COLORS.length];
  const bonusFmt = (b: Bonus, lvl: number) => {
    const v = b.values[Math.min(lvl, b.values.length) - 1] ?? 0;
    return b.fmt === 'percent' ? `+${v}%` : b.fmt === 'plus' ? `+${fc(v)}` : String(fc(v));
  };

  const rem = useMemo(() => {
    let food = 0, wood = 0, zent = 0, steel = 0, time = 0;
    for (let lvl = current + 1; lvl <= cap; lvl++) {
      const c = building.costs[lvl - 1];
      if (c) { food += c.food; wood += c.wood; zent += c.zent; steel += c.steel; time += c.time; }
    }
    return { food, wood, zent, steel, time };
  }, [building, current, cap]);

  const maxed = current >= cap;

  return createPortal(
    <div class="bld-backdrop" onClick={onClose}>
      <div class="bld-sheet" ref={sheetRef} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={name}>
        <div class="bld-handle" ref={handleRef} />
        <div class="bld-sheet-head">
          {building.image && <img src={building.image} alt="" width={54} height={54} />}
          <div class="bld-sheet-title">
            <strong>{name}</strong>
            <span>{maxed ? 'MAX' : `Level ${current} / ${cap}`}</span>
          </div>
          <button class="bld-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <p class="bld-pick-hint">{tk('calc.building.tapLevel')}</p>

        {!maxed && (
          <div class="bld-rem">
            <span class="bld-rem-label">{tk('calc.building.remainingToMax')}:</span>
            {rem.food > 0 && <span>{ric('food')} {fc(rem.food)}</span>}
            {rem.wood > 0 && <span>{ric('wood')} {fc(rem.wood)}</span>}
            {rem.zent > 0 && <span>{ric('zent')} {fc(rem.zent)}</span>}
            {rem.steel > 0 && <span>{ric('steel')} {fc(rem.steel)}</span>}
            {rem.time > 0 && <span class="bld-brow-time">⏱ {fmtDur(applySpeed(rem.time))}</span>}
          </div>
        )}

        {/* Bonus-Legende: je Bonus eine Zeile mit Icon + Farbe */}
        {bonuses.length > 0 && (
          <div class="bld-legend">
            {bonuses.map((bo, i) => (
              <div key={bo.key} class="bld-legend-row" style={{ color: bColor(i) }}>
                <span>{bonusIcon(bonusName(bo))}</span> {bonusName(bo)}
              </div>
            ))}
          </div>
        )}

        <div class="bld-levels">
          {Array.from({ length: cap }, (_, i) => i + 1).map((N) => {
            const item = building.costs[N - 1];
            const u = unlockAt(N);
            const isCur = N === current;
            const done = N < current;
            return (
              <button
                key={N}
                type="button"
                class={`bld-brow bld-lrow${isCur ? ' current' : ''}${done ? ' done' : ''}`}
                onClick={() => onSetLevel(N)}
              >
                <span class="bld-brow-lvl">{isCur ? '📍' : done ? '✓' : ''} Lv {N}</span>
                <div class="bld-brow-body">
                  <div class="bld-brow-stats">
                    {bonuses.map((bo, i) => (
                      <span key={bo.key} class="bld-stat" style={{ color: bColor(i), background: bColor(i) + '22' }}>
                        {bonusIcon(bonusName(bo))} {bonusFmt(bo, N)}
                      </span>
                    ))}
                    {item?.power ? <span class="bld-stat bld-stat-power">{kampfkraft} {fc(item.power)}</span> : null}
                  </div>
                  <div class="bld-brow-costs">
                    {item && item.food > 0 && <span>{ric('food')} {fc(item.food)}</span>}
                    {item && item.wood > 0 && <span>{ric('wood')} {fc(item.wood)}</span>}
                    {item && item.zent > 0 && <span>{ric('zent')} {fc(item.zent)}</span>}
                    {item && item.steel > 0 && <span>{ric('steel')} {fc(item.steel)}</span>}
                    {item && item.time > 0 && <span class="bld-brow-time">⏱ {fmtDur(applySpeed(item.time))}</span>}
                  </div>
                  {item?.requires && item.requires.length > 0 && (
                    <div class="bld-brow-req">🔒 {item.requires.map((r) => `${reqName(r)} Lv ${r.level}`).join(' · ')}</div>
                  )}
                  {u && <div class="bld-brow-unlock">🔓 {u.name[lang] || u.name.en}</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
