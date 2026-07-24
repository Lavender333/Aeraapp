import { describe, expect, it } from 'vitest';
import {
  averageMonthlyCost,
  buildFinanceProjection,
  calculateFinanceMetrics,
} from '../services/financeCalculations';

describe('financial dashboard calculations', () => {
  it('uses the midpoint of the selected monthly cost range', () => {
    expect(averageMonthlyCost([33_500, 44_000])).toBe(38_750);
  });

  it('calculates gross, fee, net, profit, and break-even consistently', () => {
    expect(calculateFinanceMetrics({
      users: 3_000,
      pricePerUser: 2,
      marketplaceFeePercent: 20,
      monthlyCost: 38_750,
    })).toEqual({
      monthlyCost: 38_750,
      gross: 6_000,
      marketplaceFee: 1_200,
      netRevenue: 4_800,
      monthlyProfit: -33_950,
      netPricePerUser: 1.6,
      breakEvenUsers: 24_219,
    });
  });

  it('rounds currency to cents before deriving totals', () => {
    const result = calculateFinanceMetrics({
      users: 3,
      pricePerUser: 0.1,
      marketplaceFeePercent: 15,
      monthlyCost: 0.2,
    });

    expect(result.gross).toBe(0.3);
    expect(result.marketplaceFee).toBe(0.05);
    expect(result.netRevenue).toBe(0.25);
    expect(result.monthlyProfit).toBe(0.05);
  });

  it('returns no break-even point when the fee consumes all revenue', () => {
    const result = calculateFinanceMetrics({
      users: 100,
      pricePerUser: 2,
      marketplaceFeePercent: 100,
      monthlyCost: 1_000,
    });

    expect(result.netRevenue).toBe(0);
    expect(result.monthlyProfit).toBe(-1_000);
    expect(result.breakEvenUsers).toBeNull();
  });

  it('derives break-even from rounded aggregate fees, not an approximate unit rate', () => {
    const result = calculateFinanceMetrics({
      users: 0,
      pricePerUser: 0.01,
      marketplaceFeePercent: 33,
      monthlyCost: 0.01,
    });

    expect(result.breakEvenUsers).toBe(1);
  });

  it('uses month one as the baseline and compounds later months', () => {
    const projection = buildFinanceProjection({
      startingUsers: 1_000,
      pricePerUser: 2,
      marketplaceFeePercent: 20,
      monthlyCost: 1_000,
      monthlyGrowthRate: 0.08,
      months: 3,
    });

    expect(projection.map((month) => month.users)).toEqual([1_000, 1_080, 1_166]);
    expect(projection[0].profit).toBe(600);
    expect(projection[1].profit).toBe(728);
  });
});
