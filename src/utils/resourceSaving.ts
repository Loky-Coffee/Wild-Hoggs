// Saison-4-Spezialisierung: senkt die Baukosten.
//
// Fünf Stufen, je Stufe zwei Prozent — auf der letzten Stufe also zehn Prozent
// weniger Lebensmittel, Holz, Stahl und Z-Münzen.
//
// Bewusst getrennt von LabSpeed gespeichert: Bau- und Forschungstempo werden im
// Spiel unterschiedlich hoch, weshalb sie zweimal einzeln gepflegt werden. Der
// Sparbuff ist dagegen eine Eigenschaft des Kontos — einmal einstellen genügt.

export interface ResourceSaving {
  level: 0 | 1 | 2 | 3 | 4 | 5;
}

export const RESOURCE_SAVING_DEFAULT: ResourceSaving = { level: 0 };

export const SAVING_MAX_LEVEL = 5;
export const SAVING_PER_LEVEL = 2; // Prozent je Stufe

/** Rabatt in Prozent für die eingestellte Stufe (0–10). */
export function savingPercent(s: ResourceSaving | null | undefined): number {
  const lvl = s?.level ?? 0;
  if (lvl <= 0) return 0;
  return Math.min(lvl, SAVING_MAX_LEVEL) * SAVING_PER_LEVEL;
}

/**
 * Wendet den Rabatt auf einen Rohstoffbetrag an.
 *
 * Gerundet wird erst am Ende auf ganze Einheiten — Bruchteile von Holz gibt es
 * im Spiel nicht, und über eine ganze Ausbaureihe summierte Nachkommastellen
 * wären ohnehin irreführend genau.
 */
export function applySaving(betrag: number, s: ResourceSaving | null | undefined): number {
  const pct = savingPercent(s);
  if (!pct) return betrag;
  return Math.round(betrag * (1 - pct / 100));
}
