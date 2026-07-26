import { describe, it, expect } from 'vitest';
import { calculateGapSuggestedAmount, resolveGapRequestAmount } from '../services/gapCalculation';

describe('GAP calculation', () => {
  it('applies the hardship need curve and minimum award', () => {
    expect(calculateGapSuggestedAmount('HARDSHIP', 1)).toBe(350);
    expect(calculateGapSuggestedAmount('HARDSHIP', 4)).toBe(1475);
  });

  it('applies the advance need curve and minimum award', () => {
    expect(calculateGapSuggestedAmount('ADVANCE', 1)).toBe(225);
    expect(calculateGapSuggestedAmount('ADVANCE', 4)).toBe(975);
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
    })).toBe(1075);
  });

  it('falls back to advance formula when no explicit amount is present', () => {
    expect(resolveGapRequestAmount({
      requestedAmount: undefined,
      program: 'ADVANCE',
      householdImpacted: 3,
      fallbackPeopleCount: 2,
    })).toBe(725);
  });
});
