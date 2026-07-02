import { useEffect, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { type LabSpeed, effectiveLabSpeed } from '../../utils/labSpeed';
import { useSheetDrag } from '../../hooks/useSheetDrag';
import labSpeedHelp from '../../data/lab-speed-help.json';
import './ResearchLevelSheet.css';

const HELP = labSpeedHelp as Record<string, Record<string, string>>;

interface Props {
  readonly labSpeed: LabSpeed;
  readonly onChange: (v: LabSpeed) => void;
  readonly onClose: () => void;
  readonly lang: string;
  // Optional: andere Hilfe-Daten + Bild (z.B. Bau-Geschwindigkeit statt Forschung)
  readonly helpData?: Record<string, Record<string, string>>;
  readonly helpImage?: string;
}

export default function LabSpeedModal({ labSpeed, onChange, onClose, lang, helpData, helpImage }: Props) {
  const H = (helpData ?? HELP)[lang] || (helpData ?? HELP).en;
  const eff = effectiveLabSpeed(labSpeed);
  const { handleRef, sheetRef } = useSheetDrag(onClose);

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

  // Lokaler Text-State, damit Dezimal-Eingabe sauber geht — Komma UND Punkt werden akzeptiert
  const [baseStr, setBaseStr] = useState(labSpeed.base ? String(labSpeed.base) : '');
  const onBaseInput = (raw: string) => {
    setBaseStr(raw);
    const v = parseFloat(raw.replace(',', '.'));
    onChange({ ...labSpeed, base: Number.isFinite(v) && v >= 0 ? v : 0 });
  };
  const toggleGeneralG = () => onChange({ ...labSpeed, generalG: !labSpeed.generalG, minister: false });
  const toggleMinister = () => onChange({ ...labSpeed, minister: !labSpeed.minister, generalG: false });
  const toggleRose = () => onChange({ ...labSpeed, rose: !labSpeed.rose });

  return createPortal(
    <div class="rls-backdrop" onClick={onClose}>
      <div class="rls-sheet ls-modal" ref={sheetRef} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={H.title}>
        <div class="rls-handle" ref={handleRef} />
        <div class="rls-header">
          <strong>⏱ {H.title}</strong>
          <button class="rls-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div class="rls-speed">
          <div class="rls-speed-row">
            <span class="rls-speed-label">{H.base}</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder={H.placeholder}
              value={baseStr}
              onInput={(e) => onBaseInput((e.target as HTMLInputElement).value)}
            />
            <span class="rls-speed-pct">%</span>
          </div>
          <div class="rls-buffs">
            <span class="rls-buffs-note">{H.buffsNote}</span>
            <label class="rls-buff"><input type="checkbox" checked={labSpeed.generalG} onChange={toggleGeneralG} /> {H.generalG} <b>+20%</b></label>
            <label class="rls-buff"><input type="checkbox" checked={labSpeed.minister} onChange={toggleMinister} /> {H.minister} <b>+15%</b></label>
            <label class="rls-buff"><input type="checkbox" checked={labSpeed.rose} onChange={toggleRose} /> {H.rose} <b>+20%</b></label>
          </div>
          <div class="rls-speed-eff-total">= <b>{eff}%</b></div>
        </div>

        <div class="ls-help">
          <p class="ls-help-title">ℹ️ {H.howto}</p>
          <p class="rls-help-text">{H.help}</p>
          <img src={helpImage ?? '/help/lab-speed-help.png'} alt="" class="ls-help-img" loading="lazy" />
        </div>
      </div>
    </div>,
    document.body,
  );
}
