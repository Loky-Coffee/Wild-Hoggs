import buildingsData from '../buildings.json';
import type { Building } from '../../schemas/buildings';

// Statische, vorab geprüfte Gebäudedaten. Bewusst KEINE zod-Laufzeitvalidierung hier:
// das hält zod aus dem Client-Bundle des Building-Rechners (verhindert die Vite
// "Outdated Optimize Dep"-504s beim Hydrieren) und spart Bundle-Größe.
export const validatedBuildings = buildingsData as unknown as Building[];
