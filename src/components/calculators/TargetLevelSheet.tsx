import { useEffect } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { useTranslations } from '../../i18n/utils';
import type { TranslationData, TranslationKey } from '../../i18n/index';
import { useSheetDrag } from '../../hooks/useSheetDrag';
import './ResearchLevelSheet.css';
import './TargetLevelSheet.css';

interface Props {
  readonly nameKey: string;              // Übersetzungs-Key des Knotennamens
  readonly maxLevel: number;             // Anzahl wählbarer Level (Research: maxLevel, Tank: maxSubLevel)
  readonly currentLevel: number;         // schon erreichtes Level -> nicht als Ziel wählbar
  readonly currentTarget: number | null; // aktuell gesetztes Ziel-Level (falls dieser Knoten Ziel ist)
  readonly onSelect: (level: number) => void;
  readonly onClose: () => void;
  readonly translationData: TranslationData;
}

// Modal beim Ziel-Klick: „Bis welches Level als Ziel?" — Level antippen setzt das Ziel.
export default function TargetLevelSheet({ nameKey, maxLevel, currentLevel, currentTarget, onSelect, onClose, translationData }: Props) {
  const t = useTranslations(translationData);
  const name = t(nameKey as TranslationKey) || nameKey;
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
          {Array.from({ length: maxLevel }, (_, i) => i + 1).map((lvl) => {
            const done = lvl <= currentLevel; // schon erreicht -> nicht als Ziel wählbar
            return (
              <button
                key={lvl}
                type="button"
                disabled={done}
                class={`tls-lvl${lvl === currentTarget ? ' active' : ''}${done ? ' done' : ''}`}
                onClick={() => { if (!done) { onSelect(lvl); onClose(); } }}
              >
                {done ? '✓' : lvl}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
