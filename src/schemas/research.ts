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
  name: z.object({
    de: z.string(),
    en: z.string(),
  }),
  maxLevel: z.number().positive().int(),
  badgeCosts: z.array(z.number().nonnegative().int()),
  badges: z.array(z.number().nonnegative().int()).optional(),
  icon: z.string().optional(),
  prerequisites: z.array(PrerequisiteSchema),
});

export const ResearchTreeSchema = z.object({
  id: z.string(),
  name: z.object({
    de: z.string(),
    en: z.string(),
  }),
  totalBadges: z.number().nonnegative().int(),
  nodeCount: z.number().nonnegative().int(),
  image: z.string().optional(),
  technologies: z.array(TechnologySchema),
});

export type Prerequisite = z.infer<typeof PrerequisiteSchema>;
export type Technology = z.infer<typeof TechnologySchema>;
export type ResearchTree = z.infer<typeof ResearchTreeSchema>;
