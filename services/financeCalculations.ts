export type FinanceProjection = {
  month: number;
  users: number;
  gross: number;
  marketplaceFee: number;
  net: number;
  cost: number;
  profit: number;
};

export type FinanceMetrics = {
  monthlyCost: number;
  gross: number;
  marketplaceFee: number;
  netRevenue: number;
  monthlyProfit: number;
  netPricePerUser: number;
  breakEvenUsers: number | null;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const finiteNonNegative = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

const toCents = (dollars: number) => Math.round(finiteNonNegative(dollars) * 100);
const fromCents = (cents: number) => cents / 100;

export const averageMonthlyCost = (costRange: readonly [number, number]): number => {
  const lowCents = toCents(costRange[0]);
  const highCents = toCents(costRange[1]);
  return fromCents(Math.round((lowCents + highCents) / 2));
};

export const calculateFinanceMetrics = (input: {
  users: number;
  pricePerUser: number;
  marketplaceFeePercent: number;
  monthlyCost: number;
}): FinanceMetrics => {
  const users = Math.floor(finiteNonNegative(input.users));
  const pricePerUserCents = toCents(input.pricePerUser);
  const monthlyCostCents = toCents(input.monthlyCost);
  const feeRate = clamp(
    Number.isFinite(input.marketplaceFeePercent) ? input.marketplaceFeePercent : 0,
    0,
    100,
  ) / 100;

  const grossCents = users * pricePerUserCents;
  const marketplaceFeeCents = Math.round(grossCents * feeRate);
  const netRevenueCents = grossCents - marketplaceFeeCents;
  const monthlyProfitCents = netRevenueCents - monthlyCostCents;
  const netPricePerUserCents = pricePerUserCents * (1 - feeRate);
  const netRevenueForUsers = (userCount: number) => {
    const candidateGross = userCount * pricePerUserCents;
    return candidateGross - Math.round(candidateGross * feeRate);
  };

  let breakEvenUsers: number | null = null;
  if (monthlyCostCents === 0) {
    breakEvenUsers = 0;
  } else if (netPricePerUserCents > 0) {
    let low = 0;
    let high = Math.max(1, Math.ceil(monthlyCostCents / netPricePerUserCents));
    while (netRevenueForUsers(high) < monthlyCostCents) high *= 2;
    while (low < high) {
      const midpoint = Math.floor((low + high) / 2);
      if (netRevenueForUsers(midpoint) >= monthlyCostCents) high = midpoint;
      else low = midpoint + 1;
    }
    breakEvenUsers = low;
  }

  return {
    monthlyCost: fromCents(monthlyCostCents),
    gross: fromCents(grossCents),
    marketplaceFee: fromCents(marketplaceFeeCents),
    netRevenue: fromCents(netRevenueCents),
    monthlyProfit: fromCents(monthlyProfitCents),
    netPricePerUser: fromCents(Math.round(netPricePerUserCents)),
    breakEvenUsers,
  };
};

export const buildFinanceProjection = (input: {
  startingUsers: number;
  pricePerUser: number;
  marketplaceFeePercent: number;
  monthlyCost: number;
  monthlyGrowthRate?: number;
  months?: number;
}): FinanceProjection[] => {
  const startingUsers = Math.floor(finiteNonNegative(input.startingUsers));
  const growthRate = Math.max(
    -1,
    Number.isFinite(input.monthlyGrowthRate) ? Number(input.monthlyGrowthRate) : 0.08,
  );
  const months = clamp(Math.floor(input.months || 12), 1, 120);

  return Array.from({ length: months }, (_, index) => {
    const users = Math.round(startingUsers * Math.pow(1 + growthRate, index));
    const metrics = calculateFinanceMetrics({
      users,
      pricePerUser: input.pricePerUser,
      marketplaceFeePercent: input.marketplaceFeePercent,
      monthlyCost: input.monthlyCost,
    });

    return {
      month: index + 1,
      users,
      gross: metrics.gross,
      marketplaceFee: metrics.marketplaceFee,
      net: metrics.netRevenue,
      cost: metrics.monthlyCost,
      profit: metrics.monthlyProfit,
    };
  });
};
