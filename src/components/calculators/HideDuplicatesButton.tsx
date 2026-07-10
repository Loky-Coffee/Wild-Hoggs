import { useProfile } from '../../hooks/useProfile';
import { useCalculatorState } from '../../hooks/useCalculatorState';

interface HideDupesState { hide: boolean }
// Standard: Duplikate ausgeblendet.
const DEFAULT: HideDupesState = { hide: true };

interface Props {
  readonly labelHide: string; // "Doppelte ausblenden" (wenn gerade alle sichtbar sind)
  readonly labelShow: string; // "Alle Gebäude einblenden" (wenn gerade ausgeblendet)
}

// Button neben dem Bau-Speed: blendet die doppelten Gebäude-Exemplare (Nr. 2, 3, 4 …) aus.
// Zustand pro Profil gespeichert (Server-Sync bei Login). Bei Änderung -> Event, damit der
// Rechner das Grid live filtert.
export default function HideDuplicatesButton({ labelHide, labelShow }: Props) {
  const { activeProfile } = useProfile();
  const [state, setState] = useCalculatorState<HideDupesState>('building-hidedupes', 'main', DEFAULT, activeProfile.id);
  const hide = !!state.hide;

  const toggle = () => {
    const v = !hide;
    setState({ hide: v });
    try { window.dispatchEvent(new CustomEvent('wh-hidedupes-change', { detail: v })); } catch { /* ignore */ }
  };

  return (
    <button type="button" class="labspeed-link" onClick={toggle} aria-pressed={hide}>
      {hide ? '👁️' : '🙈'} {hide ? labelShow : labelHide}
    </button>
  );
}
