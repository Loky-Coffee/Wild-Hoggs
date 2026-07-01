import { ResearchTreeSchema } from '../../schemas/research';

// Import all research category data
import allianceRecognitionRaw from '../research/alliance-recognition.json';
import unitSpecialTrainingRaw from '../research/unit-special-training.json';
import fullyArmedAllianceRaw from '../research/fully-armed-alliance.json';
import fieldRaw from '../research/field.json';
import heroTrainingRaw from '../research/hero-training.json';
import militaryStrategiesRaw from '../research/military-strategies.json';
import peaceShieldRaw from '../research/peace-shield.json';
import siegeToSeizeRaw from '../research/siege-to-seize.json';
import armyBuildingRaw from '../research/army-building.json';
import tacticalMasterRaw from '../research/tactical-master.json';
import riderTrainingRaw from '../research/rider-training.json';
import assaulterTrainingRaw from '../research/assaulter-training.json';
import shooterTrainingRaw from '../research/shooter-training.json';
import ageOfSteelRaw from '../research/age-of-steel.json';
import newHomeRaw from '../research/new-home.json';
import rapidGrowthRaw from '../research/rapid-growth.json';
import shelterBuildingRaw from '../research/shelter-building.json';
import eliteTroopsRaw from '../research/elite-troops.json';
import hqManagementRaw from '../research/hq-management.json';

// Validate all research trees at import time
export const allianceRecognition = ResearchTreeSchema.parse(allianceRecognitionRaw);
export const unitSpecialTraining = ResearchTreeSchema.parse(unitSpecialTrainingRaw);
export const fullyArmedAlliance = ResearchTreeSchema.parse(fullyArmedAllianceRaw);
export const field = ResearchTreeSchema.parse(fieldRaw);
export const heroTraining = ResearchTreeSchema.parse(heroTrainingRaw);
export const militaryStrategies = ResearchTreeSchema.parse(militaryStrategiesRaw);
export const peaceShield = ResearchTreeSchema.parse(peaceShieldRaw);
export const siegeToSeize = ResearchTreeSchema.parse(siegeToSeizeRaw);
export const armyBuilding = ResearchTreeSchema.parse(armyBuildingRaw);
export const tacticalMaster = ResearchTreeSchema.parse(tacticalMasterRaw);
export const riderTraining = ResearchTreeSchema.parse(riderTrainingRaw);
export const assaulterTraining = ResearchTreeSchema.parse(assaulterTrainingRaw);
export const shooterTraining = ResearchTreeSchema.parse(shooterTrainingRaw);
export const ageOfSteel = ResearchTreeSchema.parse(ageOfSteelRaw);
export const newHome = ResearchTreeSchema.parse(newHomeRaw);
export const rapidGrowth = ResearchTreeSchema.parse(rapidGrowthRaw);
export const shelterBuilding = ResearchTreeSchema.parse(shelterBuildingRaw);
export const eliteTroops = ResearchTreeSchema.parse(eliteTroopsRaw);
export const hqManagement = ResearchTreeSchema.parse(hqManagementRaw);
