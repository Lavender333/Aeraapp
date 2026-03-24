import type { GapRevenueSettings } from '../types';

export type GapProgramType = 'HARDSHIP' | 'ADVANCE';

export type GapSuggestedAmountInput = {
  revenueSettings?: Partial<GapRevenueSettings> | null;
  monthlyIncomeLoss?: number | null;
  urgencyRisk?: string | null;
  immediateExpenseCategories?: string[] | null;
};

const BASELINE_MONTHLY_MEMBER_CONTRIBUTION = 9.99 * (1 - 0.30) * 0.30;

const EXPENSE_IMPACT_WEIGHTS: Record<string, number> = {
  'Rent / Mortgage': 700,
  Utilities: 260,
  'Temporary housing': 900,
  Food: 250,
  'Medical expenses': 500,
  Repairs: 600,
  Transportation: 220,
  Other: 180,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toPositiveNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getUrgencyMultiplier = (urgencyRisk: string | null | undefined): number => {
  const normalized = String(urgencyRisk || '').trim().toLowerCase();
  if (normalized === 'risk of eviction') return 1.35;
  if (normalized === 'risk of utility shutoff') return 1.25;
  if (normalized === 'unsafe housing conditions') return 1.2;
  if (normalized === 'no immediate safety risk') return 0.9;
  return 1;
};

const getRevenueScale = (settings?: Partial<GapRevenueSettings> | null): number => {
  const membershipPrice = toPositiveNumber(settings?.membershipPriceUsd, 9.99);
  const appStoreFeePercent = clamp(Number(settings?.appStoreFeePercent ?? 30), 0, 50);
  const gapFundAllocationPercent = clamp(Number(settings?.gapFundAllocationPercent ?? 30), 1, 100);
  const billingCycle = settings?.billingCycle === 'annual' ? 'annual' : 'monthly';
  const cycleDivisor = billingCycle === 'annual' ? 12 : 1;

  const monthlyContribution = (membershipPrice * (1 - appStoreFeePercent / 100) * (gapFundAllocationPercent / 100)) / cycleDivisor;
  const normalizedScale = monthlyContribution / BASELINE_MONTHLY_MEMBER_CONTRIBUTION;
  return clamp(normalizedScale, 0.75, 1.5);
};

const estimateExpenseNeed = (categories: string[] | null | undefined): number => {
  const unique = Array.from(new Set((categories || []).map((entry) => String(entry || '').trim())));
  return unique.reduce((sum, category) => sum + (EXPENSE_IMPACT_WEIGHTS[category] || 120), 0);
};

const roundToNearest25 = (amount: number) => {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount / 25) * 25;
};

export const calculateGapSuggestedAmount = (
  program: GapProgramType,
  householdImpacted: number,
  input?: GapSuggestedAmountInput,
): number => {
  const household = Math.max(1, Number(householdImpacted || 1));
  const incomeLoss = Math.max(0, Number(input?.monthlyIncomeLoss || 0));
  const urgencyMultiplier = getUrgencyMultiplier(input?.urgencyRisk);
  const revenueScale = getRevenueScale(input?.revenueSettings);
  const expenseNeed = estimateExpenseNeed(input?.immediateExpenseCategories);

  const householdNeed = program === 'ADVANCE'
    ? 220 * Math.pow(household, 1.08)
    : 320 * Math.pow(household, 1.1);
  const expenseWeight = program === 'ADVANCE' ? 0.45 : 0.75;
  const incomeWeight = program === 'ADVANCE' ? 0.35 : 0.55;
  const incomeNeed = Math.min(incomeLoss, 6000) * incomeWeight;

  const raw = (householdNeed + (expenseNeed * expenseWeight) + incomeNeed) * urgencyMultiplier * revenueScale;

  const bounds = program === 'ADVANCE'
    ? { min: 200, max: 6000 }
    : { min: 350, max: 12000 };

  return roundToNearest25(clamp(raw, bounds.min, bounds.max));
};

export const resolveGapRequestAmount = (payload: {
  requestedAmount?: number | null;
  program?: GapProgramType | null;
  householdImpacted?: number | null;
  fallbackPeopleCount?: number | null;
  revenueSettings?: Partial<GapRevenueSettings> | null;
  monthlyIncomeLoss?: number | null;
  urgencyRisk?: string | null;
  immediateExpenseCategories?: string[] | null;
}): number => {
  const explicitAmount = Number(payload.requestedAmount || 0);
  if (explicitAmount > 0) return explicitAmount;

  const program: GapProgramType = payload.program === 'ADVANCE' ? 'ADVANCE' : 'HARDSHIP';
  const householdImpacted = Number(payload.householdImpacted || payload.fallbackPeopleCount || 1);

  return calculateGapSuggestedAmount(program, householdImpacted, {
    revenueSettings: payload.revenueSettings,
    monthlyIncomeLoss: payload.monthlyIncomeLoss,
    urgencyRisk: payload.urgencyRisk,
    immediateExpenseCategories: payload.immediateExpenseCategories,
  });
};
