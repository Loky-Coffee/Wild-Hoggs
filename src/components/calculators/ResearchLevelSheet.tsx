import { useEffect } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import type { Technology } from '../../schemas/research';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData, TranslationKey } from '../../i18n/index';
import researchEffects from '../../data/research-effects.json';
import researchUnlocks from '../../data/research-unlocks.json';
import labSpeedHelp from '../../data/lab-speed-help.json';
import { type LabSpeed, effectiveLabSpeed } from '../../utils/labSpeed';
import './ResearchLevelSheet.css';

const EFFECTS = researchEffects as Record<string, { format: string; names: Record<string, string> }>;
const UNLOCKS = researchUnlocks as Record<string, Record<string, string>>;
const HELP = labSpeedHelp as Record<string, Record<string, string>>;

const ICON = {
  strom: '/images/research-icons/strom.webp',
  zent: '/images/research-icons/zent.webp',
  badge: '/images/research-icons/badge.webp',
};

function fc(n: number): string {
  try {
    return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  } catch {
    return String(n);
  }
}

// Sekunden -> "Xd HH:MM:SS"
function fmtTime(s: number): string {
  s = Math.max(0, Math.round(s));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return (d > 0 ? `${d}d ` : '') + `${p(h)}:${p(m)}:${p(sec)}`;
}

interface ResearchLevelSheetProps {
  readonly tech: Technology;
  readonly currentLevel: number;
  readonly maxAvailable: number;
  readonly unlocked: boolean;
  readonly onSelect: (level: number) => void;
  readonly onClose: () => void;
  readonly labSpeed: LabSpeed;
  readonly onOpenLabSpeed: () => void;
  readonly lang: 'de' | 'en';
  readonly translationData: TranslationData;
}

export default function ResearchLevelSheet({
  tech,
  currentLevel,
  maxAvailable,
  unlocked,
  onSelect,
  onClose,
  labSpeed,
  onOpenLabSpeed,
  lang,
  translationData,
}: ResearchLevelSheetProps) {
  const t = useTranslations(translationData);
  const name = t(tech.nameKey as TranslationKey) || (tech as { name?: string }).name || tech.id;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const strom = (i: number) => tech.stromCosts?.[i] ?? 0;
  const zent = (i: number) => tech.zentCosts?.[i] ?? 0;
  const badge = (i: number) => tech.badgeCosts[i] ?? 0;
  const hasBadges = tech.badgeCosts.some((b) => b > 0);

  // Boni/Effekte (aus Spieldaten) — Namen aus research-effects.json in der aktuellen Sprache
  const effName = (id: string) => EFFECTS[id]?.names[lang] || EFFECTS[id]?.names.en || '';
  const effUnit = (id: string) => (EFFECTS[id]?.format === 'percent' ? '%' : '');
  const fmtV = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const bonusList = (tech.bonuses ?? []).filter((b) => effName(b.effect));
  const valAt = (b: { perLevel?: number; values?: number[] }, lvl: number): number =>
    b.values ? (b.values[lvl - 1] ?? 0) : (b.perLevel ?? 0) * lvl;
  const bonusFull = (lvl: number) =>
    bonusList.map((b) => `${effName(b.effect)} +${fmtV(valAt(b, lvl))}${effUnit(b.effect)}`).join(' · ');

  // Freischaltungen (Gebäude/Funktion/Einheit) — Text aus research-unlocks.json
  const uText = (k: string) => UNLOCKS[k]?.[lang] || UNLOCKS[k]?.en || k;
  const unlockList = tech.unlocks ?? [];
  const unlockStr = unlockList
    .map((u) => (u.target ? `${uText(u.type)} ${uText(u.target)}` : u.amount != null ? `${uText(u.type)} +${u.amount}` : uText(u.type)))
    .join(' · ');

  // Forschungszeiten (Basis in Sekunden) + Lab-Speed (Basis-% + Buffs), synchronisiert übers Profil
  const H = HELP[lang] || HELP.en;
  const eff = effectiveLabSpeed(labSpeed);
  const hasTimes = Array.isArray(tech.times) && tech.times.length > 0;
  const baseTime = (lvl: number) => tech.times?.[lvl - 1] ?? 0;
  const timeAt = (lvl: number) => baseTime(lvl) / (1 + eff / 100);

  // Cumulative totals up to the currently selected level
  let cs = 0;
  let cz = 0;
  let cb = 0;
  let ctSec = 0;
  for (let i = 0; i < currentLevel; i++) {
    cs += strom(i);
    cz += zent(i);
    cb += badge(i);
    ctSec += tech.times?.[i] ?? 0;
  }
  const ct = ctSec / (1 + eff / 100);

  const rows = [];
  for (let lvl = 1; lvl <= tech.maxLevel; lvl++) {
    const i = lvl - 1;
    const selected = lvl <= currentLevel;
    const reachable = lvl <= maxAvailable;
    rows.push(
      <button
        key={lvl}
        type="button"
        class={`rls-row${selected ? ' selected' : ''}${!reachable ? ' needs-unlock' : ''}`}
        onClick={() => onSelect(lvl)}
      >
        <span class="rls-lvl">{selected ? '✓ ' : (!reachable ? '🔒 ' : '')}{lvl}</span>
        <span><img src={ICON.strom} class="rls-ico" alt="" />{fc(strom(i))}</span>
        <span><img src={ICON.zent} class="rls-ico" alt="" />{fc(zent(i))}</span>
        <span>{hasBadges ? (<><img src={ICON.badge} class="rls-ico" alt="" />{fc(badge(i))}</>) : '–'}</span>
        {hasTimes && (
          <span class="rls-row-time">
            ⏱ {eff > 0 && <s class="rls-time-base">{fmtTime(baseTime(lvl))}</s>} <b>{fmtTime(timeAt(lvl))}</b>
          </span>
        )}
        {bonusList.length > 0 && <span class="rls-row-bonus">{bonusFull(lvl)}</span>}
      </button>,
    );
  }

  return createPortal(
    <div class="rls-backdrop" onClick={onClose}>
      <div class="rls-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={name}>
        <div class="rls-handle" />
        <div class="rls-header">
          <strong>{name}</strong>
          <span class="rls-level">Level {currentLevel} / {tech.maxLevel}</span>
          <button class="rls-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {!unlocked && (
          <div class="rls-note">🔒 {t('calc.research.unlockPrerequisites' as TranslationKey)}</div>
        )}
        {tech.labLevel ? <div class="rls-note">🔬 Labor-Level {tech.labLevel}</div> : null}
        {unlockList.length > 0 && <div class="rls-note rls-unlock">🔓 {unlockStr}</div>}

        {hasTimes && (
          <button type="button" class="rls-speed-btn" onClick={onOpenLabSpeed}>
            ⏱ {H.title}: <b>{eff}%</b><span class="rls-speed-gear">⚙️</span>
          </button>
        )}

        <div class="rls-table-head">
          <span>Lvl</span>
          <span><img src={ICON.strom} class="rls-ico" alt="Strom" /></span>
          <span><img src={ICON.zent} class="rls-ico" alt="Zent" /></span>
          <span>{hasBadges ? <img src={ICON.badge} class="rls-ico" alt="Badges" /> : ''}</span>
        </div>

        <div class="rls-rows">
          <button
            type="button"
            class={`rls-row${currentLevel === 0 ? ' selected' : ''}`}
            onClick={() => onSelect(0)}
          >
            <span class="rls-lvl">0</span>
            <span>–</span>
            <span>–</span>
            <span>–</span>
          </button>
          {rows}
        </div>

        <div class="rls-total">
          <span class="rls-total-label">Gesamt bis Lv {currentLevel}:</span>
          <span><img src={ICON.strom} class="rls-ico" alt="" />{fc(cs)}</span>
          <span><img src={ICON.zent} class="rls-ico" alt="" />{fc(cz)}</span>
          {hasBadges && <span><img src={ICON.badge} class="rls-ico" alt="" />{fc(cb)}</span>}
          {hasTimes && (
            <span class="rls-total-timeval">
              ⏱ {eff > 0 && <s class="rls-time-base">{fmtTime(ctSec)}</s>} {fmtTime(ct)}
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
