import { describe, expect, it } from 'vitest';
import { HelpRequestData } from '../types';
import { canAdvanceReport, getReportStepErrors } from '../services/reportFlow';

const completeReport = (): HelpRequestData => ({
  isSafe: true,
  location: '101 Pine St',
  emergencyType: '',
  isInjured: false,
  injuryDetails: '',
  situationDescription: 'Tree is blocking the only exit.',
  canEvacuate: false,
  hazardsPresent: true,
  hazardDetails: 'Downed power line near the driveway.',
  peopleCount: 2,
  petsPresent: true,
  hasWater: true,
  hasFood: true,
  hasMeds: true,
  hasPower: false,
  hasPhone: true,
  needsTransport: true,
  vulnerableGroups: ['Elderly'],
  medicalConditions: '',
  damageType: 'Access blocked',
  consentToShare: true,
});

describe('report questionnaire validation', () => {
  it('blocks an unanswered first step', () => {
    const report = completeReport();
    report.isSafe = null;
    report.location = '';
    report.isInjured = null;
    expect(canAdvanceReport(1, report)).toBe(false);
    expect(getReportStepErrors(1, report)).toHaveLength(3);
  });

  it('requires injury and hazard details when applicable', () => {
    const report = completeReport();
    report.isInjured = true;
    report.injuryDetails = '';
    expect(getReportStepErrors(1, report)).toContain('Describe the injuries so responders know what to expect.');
    report.hazardDetails = '';
    expect(getReportStepErrors(2, report)).toContain('Describe the hazards that are present.');
  });

  it('requires every resource answer, transport, damage, and consent', () => {
    const report = completeReport();
    report.hasMeds = null;
    report.needsTransport = null;
    report.damageType = '';
    report.consentToShare = false;
    expect(canAdvanceReport(3, report)).toBe(false);
    expect(getReportStepErrors(4, report)).toHaveLength(2);
    expect(canAdvanceReport(5, report)).toBe(false);
  });

  it('allows all five complete steps', () => {
    const report = completeReport();
    for (const step of [1, 2, 3, 4, 5] as const) {
      expect(canAdvanceReport(step, report)).toBe(true);
    }
  });
});
