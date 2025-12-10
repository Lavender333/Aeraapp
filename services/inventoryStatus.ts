import { OrgInventory } from '../types';

export type StockLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

interface StockStatus {
  level: StockLevel;
  coverage: number | null; // 0-1 ratio or null if unknown
}

const HIGH_THRESHOLD = 0.8;
const MEDIUM_THRESHOLD = 0.3;
const TARGET_COVERAGE = HIGH_THRESHOLD; // aim to reach high

export function getStockStatus(value: number, registeredPopulation?: number): StockStatus {
  if (!registeredPopulation || registeredPopulation <= 0) {
    return { level: 'UNKNOWN', coverage: null };
  }
  const coverage = value / registeredPopulation;
  if (coverage >= HIGH_THRESHOLD) return { level: 'HIGH', coverage };
  if (coverage >= MEDIUM_THRESHOLD) return { level: 'MEDIUM', coverage };
  return { level: 'LOW', coverage };
}

export function getInventoryStatuses(inventory: OrgInventory, registeredPopulation?: number) {
  return {
    water: getStockStatus(inventory.water, registeredPopulation),
    food: getStockStatus(inventory.food, registeredPopulation),
    blankets: getStockStatus(inventory.blankets, registeredPopulation),
    medicalKits: getStockStatus(inventory.medicalKits, registeredPopulation),
  };
}

export function getRecommendedResupply(
  current: number,
  registeredPopulation?: number
): number | null {
  if (!registeredPopulation || registeredPopulation <= 0) return null;
  const target = Math.ceil(registeredPopulation * TARGET_COVERAGE);
  const needed = target - current;
  return needed > 0 ? needed : 0;
}
