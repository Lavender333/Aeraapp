export type GapProgramType = 'HARDSHIP' | 'ADVANCE';

export const calculateGapSuggestedAmount = (program: GapProgramType, householdImpacted: number): number => {
  const safeHouseholdImpacted = Math.max(1, Number(householdImpacted || 1));
  const perPersonRate = program === 'ADVANCE' ? 125 : 250;
  return safeHouseholdImpacted * perPersonRate;
};

export const resolveGapRequestAmount = (payload: {
  requestedAmount?: number | null;
  program?: GapProgramType | null;
  householdImpacted?: number | null;
  fallbackPeopleCount?: number | null;
}): number => {
  const explicitAmount = Number(payload.requestedAmount || 0);
  if (explicitAmount > 0) return explicitAmount;

  const program: GapProgramType = payload.program === 'ADVANCE' ? 'ADVANCE' : 'HARDSHIP';
  const householdImpacted = Number(
    payload.householdImpacted || payload.fallbackPeopleCount || 1
  );
  return calculateGapSuggestedAmount(program, householdImpacted);
};
