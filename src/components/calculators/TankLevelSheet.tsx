import { useEffect } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData, TranslationKey } from '../../i18n/index';
import './ResearchLevelSheet.css';
import './TankLevelSheet.css';

interface TankModification {
  level: number;
  nameKey: string;
  wrenchesPerSub: number;
  subLevels: number;
  totalWrenches: number;
  cumulativeTotal: number;
  isVehicle?: boolean;
}

function fc(n: number): string {
  try {
    return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  } catch {
    return String(n);
  }
}

interface TankLevelSheetProps {
  readonly mod: TankModification;
  readonly currentSubLevel: number;
  readonly unlocked: boolean;
  readonly onSelect: (subLevel: number) => void;
  readonly onClose: () => void;
  readonly lang: 'de' | 'en';
  readonly translationData: TranslationData;
}

export default function TankLevelSheet({
  mod,
  currentSubLevel,
  unlocked,
  onSelect,
  onClose,
  translationData,
}: TankLevelSheetProps) {
  const t = useTranslations(translationData);
  const name = t(mod.nameKey as TranslationKey) || mod.nameKey;

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

  const rows = [];
  for (let sl = 1; sl <= mod.subLevels; sl++) {
    const selected = sl <= currentSubLevel;
    rows.push(
      <button
        key={sl}
        type="button"
        class={`rls-row tls-3${selected ? ' selected' : ''}`}
        onClick={() => onSelect(sl)}
      >
        <span class="rls-lvl">{selected ? '✓ ' : ''}{sl}</span>
        <span>🔧 {fc(mod.wrenchesPerSub)}</span>
        <span>🔧 {fc(sl * mod.wrenchesPerSub)}</span>
      </button>,
    );
  }

  return createPortal(
    <div class="rls-backdrop" onClick={onClose}>
      <div class="rls-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={name}>
        <div class="rls-handle" />
        <div class="rls-header">
          <strong>{mod.isVehicle ? '🚗 ' : ''}{name}</strong>
          <span class="rls-level">Level {mod.level} · {currentSubLevel} / {mod.subLevels}</span>
          <button class="rls-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {!unlocked && (
          <div class="rls-note">🔒 {t('tank.unlock' as TranslationKey)} — vorige Level werden automatisch entsperrt</div>
        )}

        <div class="rls-table-head tls-3">
          <span>Sub</span>
          <span>🔧 / Sub</span>
          <span>🔧 Σ</span>
        </div>

        <div class="rls-rows">
          <button
            type="button"
            class={`rls-row tls-3${currentSubLevel === 0 ? ' selected' : ''}`}
            onClick={() => onSelect(0)}
          >
            <span class="rls-lvl">0</span>
            <span>–</span>
            <span>🔧 0</span>
          </button>
          {rows}
        </div>

        <div class="rls-total">
          <span class="rls-total-label">{t('tank.cost' as TranslationKey)} (Sub {currentSubLevel}):</span>
          <span>🔧 {fc(currentSubLevel * mod.wrenchesPerSub)}</span>
          <span class="rls-total-label">{t('tank.total' as TranslationKey)}:</span>
          <span>🔧 {fc(mod.cumulativeTotal)}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
