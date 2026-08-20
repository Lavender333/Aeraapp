import { ViewState } from '../types';

export type EssentialView = 'DASHBOARD' | 'HELP_WIZARD' | 'EVENTS' | 'SETTINGS';

export const ESSENTIAL_NAV_ITEMS: ReadonlyArray<{
  id: EssentialView;
  label: string;
}> = [
  { id: 'DASHBOARD', label: 'Home' },
  { id: 'HELP_WIZARD', label: 'Report' },
  { id: 'EVENTS', label: 'Public Events' },
  { id: 'SETTINGS', label: 'Settings' },
];

const VIEWS_WITHOUT_AUTHENTICATED_NAV = new Set<ViewState>([
  'SPLASH',
  'PRESENTATION',
  'REGISTRATION',
  'ACCOUNT_SETUP',
  'LOGIN',
  'RESET_PASSWORD',
  // The report wizard has its own fixed Back/Next controls. Keeping the
  // global bottom navigation visible here places it above those controls on
  // iPhone and intercepts taps intended for the Next button.
  'HELP_WIZARD',
  'EVENT_REGISTRATION',
  'PUBLIC_INTAKE',
  'PRIVACY_POLICY',
]);

export function shouldShowEssentialNavigation(
  currentView: ViewState,
  hasAuthenticatedProfile: boolean,
): boolean {
  return hasAuthenticatedProfile && !VIEWS_WITHOUT_AUTHENTICATED_NAV.has(currentView);
}
