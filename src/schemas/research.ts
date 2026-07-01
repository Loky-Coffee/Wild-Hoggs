import { z } from 'zod';

export const PrerequisiteSchema = z.union([
  z.string(),
  z.object({
    id: z.string(),
    requiredLevel: z.number().positive().int().optional(),
  }),
]);

// Bonus/Effekt eines Knotens (aus Spieldaten APS_science col[12]).
// effect -> Schlüssel in src/data/research-effects.json (Name in 15 Sprachen + Format).
// Wert bei Stufe N: linear -> perLevel * N; sonst -> values[N-1].
export const BonusSchema = z.object({
  effect: z.string(),
  perLevel: z.number().optional(),
  values: z.array(z.number()).optional(),
});

// Freischaltung eines Knotens (aus Spieldaten APS_science col[16]).
// type/target -> Text-Keys in src/data/research-unlocks.json; amount -> Zahlenwert.
export const UnlockSchema = z.object({
  type: z.string(),
  target: z.string().optional(),
  amount: z.number().optional(),
});

export const TechnologySchema = z.object({
  id: z.string(),
  nameKey: z.string(),
  name: z.string().optional(), // englischer Klartext-Name aus der Spiel-Config
  maxLevel: z.number().positive().int(),
  labLevel: z.number().nonnegative().int().optional(), // benötigtes Laboratory-Level (0 = keins)
  badgeCosts: z.array(z.number().nonnegative().int()),
  stromCosts: z.array(z.number().nonnegative().int()).optional(), // je Stufe
  zentCosts: z.array(z.number().nonnegative().int()).optional(),  // je Stufe
  combatPower: z.array(z.number().nonnegative().int()).optional(),// Kampfkraft je Stufe
  badges: z.array(z.number().nonnegative().int()).optional(),
  bonuses: z.array(BonusSchema).optional(), // Effekte/Boni je Stufe
  times: z.array(z.number().nonnegative()).optional(), // Basis-Forschungszeit je Stufe (Sekunden)
  unlocks: z.array(UnlockSchema).optional(), // Freischaltungen (Gebäude/Funktion/Einheit)
  icon: z.string().optional(),
  prerequisites: z.array(PrerequisiteSchema),
}).refine(
  (data) => data.badgeCosts.length === data.maxLevel,
  { error: "badgeCosts array length must match maxLevel", path: ['badgeCosts'] }
);

export const ResearchTreeSchema = z.object({
  id: z.string(),
  nameKey: z.string(),
  name: z.string().optional(),
  tabId: z.number().int().optional(),
  totalBadges: z.number().nonnegative().int(),
  totalStrom: z.number().nonnegative().int().optional(),
  totalZent: z.number().nonnegative().int().optional(),
  totalLevels: z.number().nonnegative().int(),
  nodeCount: z.number().nonnegative().int(),
  labLevelMin: z.number().nonnegative().int().optional(),
  onlyResourcesNoBadges: z.boolean().optional(),
  image: z.string().optional(),
  technologies: z.array(TechnologySchema),
});

export type Prerequisite = z.infer<typeof PrerequisiteSchema>;
export type Technology = z.infer<typeof TechnologySchema>;
export type ResearchTree = z.infer<typeof ResearchTreeSchema>;
