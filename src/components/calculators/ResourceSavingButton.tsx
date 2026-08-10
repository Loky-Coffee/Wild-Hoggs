import { useEffect, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { useProfile } from '../../hooks/useProfile';
import { useCalculatorState } from '../../hooks/useCalculatorState';
import { useSheetDrag } from '../../hooks/useSheetDrag';
import {
  RESOURCE_SAVING_DEFAULT, SAVING_MAX_LEVEL, SAVING_PER_LEVEL,
  savingPercent, type ResourceSaving,
} from '../../utils/resourceSaving';
import './ResearchLevelSheet.css';
import './ResourceSavingButton.css';

interface Props {
  readonly label: string;      // "Sparen"
  readonly title: string;      // "Baukosten senken"
  readonly note: string;       // "Saison 4 · Spezialisierung — je Stufe 2 % weniger"
  readonly levelWord: string;  // "Stufe"
  readonly offWord: string;    // "aus"
}

// Knopf über dem Bau-Rechner für die Saison-4-Spezialisierung, die alle
// Baukosten senkt. Zustand pro Spielprofil gespeichert (Server-Abgleich bei
// Anmeldung); bei Änderung ein Event, damit der Rechner sofort neu rechnet —
// dasselbe Muster wie Bau-Tempo und Doppelte-ausblenden.
export default function ResourceSavingButton({ label, title, note, levelWord, offWord }: Props) {
  const { activeProfile } = useProfile();
  const [saving, setSaving] = useCalculatorState<ResourceSaving>(
    'building-saving', 'main', RESOURCE_SAVING_DEFAULT, activeProfile.id,
  );
  const [open, setOpen] = useState(false);
  const pct = savingPercent(saving);

  const pick = (lvl: number) => {
    // Erneuter Klick auf die aktive Stufe schaltet den Buff ab — sonst käme man
    // ohne den Umweg über die Null nicht mehr zurück.
    const next = { level: (saving.level === lvl ? 0 : lvl) as ResourceSaving['level'] };
    setSaving(next);
    try { window.dispatchEvent(new CustomEvent('wh-saving-change', { detail: next })); } catch { /* ignore */ }
  };

  return (
    <>
      <button type="button" class="labspeed-link" onClick={() => setOpen(true)}>
        💰 {label}: {pct ? `−${pct}%` : `0%`}
      </button>
      {open && <Dialog
        saving={saving} pct={pct} title={title} note={note}
        levelWord={levelWord} offWord={offWord}
        onPick={pick} onClose={() => setOpen(false)}
      />}
    </>
  );
}

function Dialog({ saving, pct, title, note, levelWord, offWord, onPick, onClose }: {
  readonly saving: ResourceSaving;
  readonly pct: number;
  readonly title: string;
  readonly note: string;
  readonly levelWord: string;
  readonly offWord: string;
  readonly onPick: (lvl: number) => void;
  readonly onClose: () => void;
}) {
  const { handleRef, sheetRef } = useSheetDrag(onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const stufen = Array.from({ length: SAVING_MAX_LEVEL + 1 }, (_, i) => i);

  return createPortal(
    <div class="rls-backdrop" onClick={onClose}>
      <div class="rls-sheet ls-modal" ref={sheetRef} onClick={(e) => e.stopPropagation()}
           role="dialog" aria-modal="true" aria-label={title}>
        <div class="rls-handle" ref={handleRef} />
        <div class="rls-header">
          <strong>💰 {title}</strong>
          <button class="rls-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div class="rls-speed">
          <span class="rls-buffs-note">{note}</span>

          <div class="rsav-levels" role="group" aria-label={levelWord}>
            {stufen.map((lvl) => (
              <button
                key={lvl}
                type="button"
                class={`rsav-lv${saving.level === lvl ? ' active' : ''}`}
                aria-pressed={saving.level === lvl}
                onClick={() => onPick(lvl)}
              >
                <span class="rsav-lv-num">{lvl === 0 ? offWord : `${levelWord} ${lvl}`}</span>
                <span class="rsav-lv-pct">{lvl === 0 ? '—' : `−${lvl * SAVING_PER_LEVEL}%`}</span>
              </button>
            ))}
          </div>

          <div class="rls-speed-eff-total">= <b>{pct ? `−${pct}%` : '0%'}</b></div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
