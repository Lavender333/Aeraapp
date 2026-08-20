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
  it('allows an unanswered first step so reporting is never blocked', () => {
    const report = completeReport();
    report.isSafe = null;
    report.location = '';
    report.isInjured = null;
    expect(canAdvanceReport(1, report)).toBe(true);
    expect(getReportStepErrors(1, report)).toHaveLength(0);
  });

  it('allows injury and hazard details to be completed later', () => {
    const report = completeReport();
    report.isInjured = true;
    report.injuryDetails = '';
    expect(canAdvanceReport(1, report)).toBe(true);
    report.hazardDetails = '';
    expect(canAdvanceReport(2, report)).toBe(true);
  });

  it('keeps resource, transport, and damage questions optional but requires final consent', () => {
    const report = completeReport();
    report.hasMeds = null;
    report.needsTransport = null;
    report.damageType = '';
    report.consentToShare = false;
    expect(canAdvanceReport(3, report)).toBe(true);
    expect(canAdvanceReport(4, report)).toBe(true);
    expect(canAdvanceReport(5, report)).toBe(false);
  });

  it('allows all five complete steps', () => {
    const report = completeReport();
    for (const step of [1, 2, 3, 4, 5] as const) {
      expect(canAdvanceReport(step, report)).toBe(true);
    }
  });
});
