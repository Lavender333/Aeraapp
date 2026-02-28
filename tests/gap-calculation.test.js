import { describe, it, expect } from 'vitest';
import { calculateGapSuggestedAmount, resolveGapRequestAmount } from '../services/gapCalculation';

describe('GAP calculation', () => {
  it('calculates hardship suggested amount as $250 x household', () => {
    expect(calculateGapSuggestedAmount('HARDSHIP', 1)).toBe(250);
    expect(calculateGapSuggestedAmount('HARDSHIP', 4)).toBe(1000);
  });

  it('calculates advance suggested amount as $125 x household', () => {
    expect(calculateGapSuggestedAmount('ADVANCE', 1)).toBe(125);
    expect(calculateGapSuggestedAmount('ADVANCE', 4)).toBe(500);
  });

  it('uses explicit requested amount when present', () => {
    expect(resolveGapRequestAmount({
      requestedAmount: 975,
      program: 'HARDSHIP',
      householdImpacted: 3,
      fallbackPeopleCount: 2,
    })).toBe(975);
  });

  it('falls back to hardship formula when no explicit amount is present', () => {
    expect(resolveGapRequestAmount({
      requestedAmount: 0,
      program: 'HARDSHIP',
      householdImpacted: 3,
      fallbackPeopleCount: 2,
    })).toBe(750);
  });

  it('falls back to advance formula when no explicit amount is present', () => {
    expect(resolveGapRequestAmount({
      requestedAmount: undefined,
      program: 'ADVANCE',
      householdImpacted: 3,
      fallbackPeopleCount: 2,
    })).toBe(375);
  });
});
