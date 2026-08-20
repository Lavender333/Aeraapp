import { HelpRequestData, StepId } from '../types';

export const getReportStepErrors = (step: StepId, data: HelpRequestData): string[] => {
  const errors: string[] = [];

  // Emergency reporting must remain fast and resilient. Steps 1–4 collect
  // helpful details, but they are intentionally non-blocking so a person can
  // continue if GPS is slow, they do not know an answer, or time is critical.

  if (step === 5 && !data.consentToShare) {
    errors.push('Consent is required to share this report with responders.');
  }

  return errors;
};

export const canAdvanceReport = (step: StepId, data: HelpRequestData) =>
  getReportStepErrors(step, data).length === 0;
