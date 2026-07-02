import { useState } from 'preact/hooks';
import { useProfile } from '../../hooks/useProfile';
import { useCalculatorState } from '../../hooks/useCalculatorState';
import { LAB_SPEED_DEFAULT, type LabSpeed, effectiveLabSpeed } from '../../utils/labSpeed';
import LabSpeedModal from './LabSpeedModal';
import buildSpeedHelp from '../../data/build-speed-help.json';

const HELP = buildSpeedHelp as Record<string, Record<string, string>>;

// Eigenständiger Button (über dem Building-Rechner) für die globale Bau-Geschwindigkeit.
// Wert pro Profil gespeichert (Server-Sync bei Login). Bei Änderung -> Event, damit
// der Rechner die Bauzeiten live anpasst.
export default function BuildSpeedButton({ lang }: { readonly lang: string }) {
  const { activeProfile } = useProfile();
  const [buildSpeed, setBuildSpeed] = useCalculatorState<LabSpeed>('buildspeed', 'main', LAB_SPEED_DEFAULT, activeProfile.id);
  const [open, setOpen] = useState(false);
  const H = HELP[lang] || HELP.en;
  const eff = effectiveLabSpeed(buildSpeed);

  const onChange = (v: LabSpeed) => {
    setBuildSpeed(v);
    try { window.dispatchEvent(new CustomEvent('wh-buildspeed-change', { detail: v })); } catch { /* ignore */ }
  };

  return (
    <>
      <button type="button" class="labspeed-link" onClick={() => setOpen(true)}>
        ⏱ {H.title}: {eff}%
      </button>
      {open && (
        <LabSpeedModal
          labSpeed={buildSpeed}
          onChange={onChange}
          onClose={() => setOpen(false)}
          lang={lang}
          helpData={HELP}
          helpImage="/help/build-speed-help.png"
        />
      )}
    </>
  );
}
