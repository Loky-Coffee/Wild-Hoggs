import { z } from 'zod';

export const PrerequisiteSchema = z.union([
  z.string(),
  z.object({
    id: z.string(),
    requiredLevel: z.number().positive().int().optional(),
  }),
]);

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
