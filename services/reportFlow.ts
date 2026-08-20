import { HelpRequestData, StepId } from '../types';

export const getReportStepErrors = (step: StepId, data: HelpRequestData): string[] => {
  const errors: string[] = [];

  if (step === 1) {
    if (data.isSafe === null) errors.push('Select whether you are currently safe.');
    if (!String(data.location || '').trim()) errors.push('Enter or detect your current location.');
    if (data.isSafe === false && !String(data.emergencyType || '').trim()) {
      errors.push('Select the type of emergency help you need.');
    }
    if (data.isInjured === null) errors.push('Select whether anyone is injured.');
    if (data.isInjured === true && !String(data.injuryDetails || '').trim()) {
      errors.push('Describe the injuries so responders know what to expect.');
    }
  }

  if (step === 2) {
    if (!String(data.situationDescription || '').trim()) errors.push('Describe what is happening.');
    if (data.canEvacuate === null) errors.push('Select whether you can evacuate safely.');
    if (data.hazardsPresent === null) errors.push('Select whether hazards are present.');
    if (data.hazardsPresent === true && !String(data.hazardDetails || '').trim()) {
      errors.push('Describe the hazards that are present.');
    }
    if (!Number.isFinite(data.peopleCount) || data.peopleCount < 1) {
      errors.push('Enter at least one person needing help.');
    }
    if (data.petsPresent === null) errors.push('Select whether pets are present.');
  }

  if (step === 3) {
    const unansweredResources = [data.hasWater, data.hasFood, data.hasMeds, data.hasPower, data.hasPhone]
      .filter((answer) => answer === null).length;
    if (unansweredResources > 0) errors.push('Answer Yes or No for every resource.');
  }

  if (step === 4) {
    if (data.needsTransport === null) errors.push('Select whether transportation is needed.');
    if (!String(data.damageType || '').trim()) errors.push('Select the type of damage, or choose No visible damage.');
  }

  if (step === 5 && !data.consentToShare) {
    errors.push('Consent is required to share this report with responders.');
  }

  return errors;
};

export const canAdvanceReport = (step: StepId, data: HelpRequestData) =>
  getReportStepErrors(step, data).length === 0;
