import { useState } from 'preact/hooks';
import { useProfile } from '../../hooks/useProfile';
import { useCalculatorState } from '../../hooks/useCalculatorState';
import { LAB_SPEED_DEFAULT, type LabSpeed, effectiveLabSpeed } from '../../utils/labSpeed';
import LabSpeedModal from './LabSpeedModal';
import labSpeedHelp from '../../data/lab-speed-help.json';

const HELP = labSpeedHelp as Record<string, Record<string, string>>;

// Eigenständiger Button für die Research-Übersicht: öffnet die globale Lab-Speed-Einstellung.
// Wert wird pro Profil gespeichert (Server-Sync bei Login) — derselbe Wert wie in den Knoten-Sheets.
export default function LabSpeedButton({ lang }: { readonly lang: string }) {
  const { activeProfile } = useProfile();
  const [labSpeed, setLabSpeed] = useCalculatorState<LabSpeed>('labspeed', 'main', LAB_SPEED_DEFAULT, activeProfile.id);
  const [open, setOpen] = useState(false);
  const H = HELP[lang] || HELP.en;
  const eff = effectiveLabSpeed(labSpeed);

  return (
    <>
      <button type="button" class="labspeed-link" onClick={() => setOpen(true)}>
        ⏱ {H.title}: {eff}%
      </button>
      {open && (
        <LabSpeedModal labSpeed={labSpeed} onChange={setLabSpeed} onClose={() => setOpen(false)} lang={lang} />
      )}
    </>
  );
}
