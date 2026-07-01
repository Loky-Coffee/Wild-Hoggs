import { useEffect } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import type { Technology } from '../../schemas/research';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData, TranslationKey } from '../../i18n/index';
import './ResearchLevelSheet.css';

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

interface ResearchLevelSheetProps {
  readonly tech: Technology;
  readonly currentLevel: number;
  readonly maxAvailable: number;
  readonly unlocked: boolean;
  readonly onSelect: (level: number) => void;
  readonly onClose: () => void;
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

  // Cumulative totals up to the currently selected level
  let cs = 0;
  let cz = 0;
  let cb = 0;
  for (let i = 0; i < currentLevel; i++) {
    cs += strom(i);
    cz += zent(i);
    cb += badge(i);
  }

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
        </div>
      </div>
    </div>,
    document.body,
  );
}
