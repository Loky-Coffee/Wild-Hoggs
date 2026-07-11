import { useEffect } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import type { Technology } from '../../schemas/research';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData, TranslationKey } from '../../i18n/index';
import { useSheetDrag } from '../../hooks/useSheetDrag';
import './ResearchLevelSheet.css';
import './TargetLevelSheet.css';

interface Props {
  readonly tech: Technology;
  readonly currentTarget: number | null; // aktuell gesetztes Ziel-Level (falls dieser Knoten Ziel ist)
  readonly onSelect: (level: number) => void;
  readonly onClose: () => void;
  readonly translationData: TranslationData;
}

// Modal beim Ziel-Klick: „Bis welches Level als Ziel?" — Level antippen setzt das Ziel.
export default function TargetLevelSheet({ tech, currentTarget, onSelect, onClose, translationData }: Props) {
  const t = useTranslations(translationData);
  const name = t(tech.nameKey as TranslationKey) || (tech as { name?: string }).name || tech.id;
  const { handleRef, sheetRef } = useSheetDrag(onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return createPortal(
    <div class="rls-backdrop" onClick={onClose}>
      <div class="rls-sheet tls-sheet" ref={sheetRef} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={name}>
        <div class="rls-handle" ref={handleRef} />
        <div class="rls-header">
          <strong>🎯 {name}</strong>
          <span class="rls-level">{t('tank.setTarget' as TranslationKey)}</span>
          <button class="rls-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div class="tls-grid">
          {Array.from({ length: tech.maxLevel }, (_, i) => i + 1).map((lvl) => (
            <button
              key={lvl}
              type="button"
              class={`tls-lvl${lvl === currentTarget ? ' active' : ''}`}
              onClick={() => { onSelect(lvl); onClose(); }}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
