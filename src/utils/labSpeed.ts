// Globale Lab-Speed-Einstellung (Basis-% + optionale Buffs).
// Wird pro Profil über useCalculatorService gespeichert (Server-Sync bei Login).
export interface LabSpeed {
  base: number;       // Basis-Forschungsgeschwindigkeit % (aus dem Spiel abgelesen)
  generalG: boolean;  // Kapitol-Buff General G (+20%)
  minister: boolean;  // Forschungsminister-Buff (+15%)  — schließt generalG aus
  rose: boolean;      // Rosen-Buff (+20%)
  spec: 0 | 1 | 2;    // Saison-Spezialisierung "Unterstützung" (ab Saison 2): 0 = aus, Lv.1 = +10%, Lv.2 = +15%
}

export const LAB_SPEED_DEFAULT: LabSpeed = { base: 0, generalG: false, minister: false, rose: false, spec: 0 };

// Bonus der Saison-Spezialisierung in % (gilt gleichermaßen für Forschung und Bau)
export const SPEC_BONUS: Record<number, number> = { 1: 10, 2: 15 };

// Effektiver % = Basis + gewählte Buffs
export function effectiveLabSpeed(s: LabSpeed): number {
  if (!s) return 0;
  return (s.base || 0) + (s.generalG ? 20 : 0) + (s.minister ? 15 : 0) + (s.rose ? 20 : 0) + (SPEC_BONUS[s.spec] || 0);
}
