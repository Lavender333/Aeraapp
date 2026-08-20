
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { shouldShowEssentialNavigation } from './services/essentialAccess';
import { ViewState, UserProfile } from './types';
import { StorageService } from './services/storage';
import {
  capturePendingCommunityInviteFromUrl,
  clearPendingCommunityInvite,
  getPendingCommunityInvite,
  resolveCommunityInvite,
} from './services/communityInvite';
import { fetchProfileForUser, fetchVitalsForUser, getPeopleRegisteredCount as fetchPeopleRegisteredCount } from './services/api';
import { hasSupabaseConfig, supabaseConfigMessage, supabase } from './services/supabase';
import { shouldCompleteNewAccountSetup } from './services/accountSetup';
import { savePendingOrganizationCode } from './services/organizationCodeIntent';
import { canRoleAccessView } from './services/rolePageAccess';
import { requiresIndividualAppleSubscription } from './services/subscription';

let initialSessionPromise: ReturnType<typeof supabase.auth.getSession> | null = null;

const getInitialSession = () => {
  if (!initialSessionPromise) {
    initialSessionPromise = supabase.auth.getSession().catch((error) => {
      initialSessionPromise = null;
      throw error;
    });
  }
  return initialSessionPromise;
};

const lazyWithRetry = <T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>
) =>
  lazy(async () => {
    const retryKey = 'aera.lazyImportRetried';
    try {
      const module = await importer();
      sessionStorage.removeItem(retryKey);
      return module;
    } catch (err: any) {
      const message = String(err?.message || err || '');
      const isChunkLoadError = /importing a module script failed|failed to fetch dynamically imported module|loading chunk/i.test(
        message.toLowerCase()
      );

      if (isChunkLoadError) {
        const hasRetried = sessionStorage.getItem(retryKey) === '1';
        if (!hasRetried) {
          sessionStorage.setItem(retryKey, '1');
          window.location.reload();
          return new Promise(() => {
          }) as Promise<{ default: T }>;
        }
      }

      throw err;
    }
  });

const SplashView = lazyWithRetry(() => import('./views/SplashView').then((m) => ({ default: m.SplashView })));
const DashboardView = lazyWithRetry(() => import('./views/DashboardView').then((m) => ({ default: m.DashboardView })));
const HelpFormView = lazyWithRetry(() => import('./views/HelpFormView').then((m) => ({ default: m.HelpFormView })));
const SettingsView = lazyWithRetry(() => import('./views/SettingsView').then((m) => ({ default: m.SettingsView })));
const MapView = lazyWithRetry(() => import('./views/MapView').then((m) => ({ default: m.MapView })));
const GapView = lazyWithRetry(() => import('./views/GapView').then((m) => ({ default: m.GapView })));
const GapManagementView = lazyWithRetry(() => import('./views/GapManagementView').then((m) => ({ default: m.GapManagementView })));
const AssessmentView = lazyWithRetry(() => import('./views/AssessmentView').then((m) => ({ default: m.AssessmentView })));
const PopulationView = lazyWithRetry(() => import('./views/PopulationView').then((m) => ({ default: m.PopulationView })));
const RecoveryView = lazyWithRetry(() => import('./views/RecoveryView').then((m) => ({ default: m.RecoveryView })));
const DroneView = lazyWithRetry(() => import('./views/DroneView').then((m) => ({ default: m.DroneView })));
const LogisticsView = lazyWithRetry(() => import('./views/LogisticsView').then((m) => ({ default: m.LogisticsView })));
const RegistrationView = lazyWithRetry(() => import('./views/RegistrationView').then((m) => ({ default: m.RegistrationView })));
const OrgDashboardView = lazyWithRetry(() => import('./views/OrgDashboardView').then((m) => ({ default: m.OrgDashboardView })));
const NewSignupsView = lazyWithRetry(() => import('./views/NewSignupsView').then((m) => ({ default: m.NewSignupsView })));
const LoginView = lazyWithRetry(() => import('./views/LoginView').then((m) => ({ default: m.LoginView })));
const PresentationView = lazyWithRetry(() => import('./views/PresentationView').then((m) => ({ default: m.PresentationView })));
const PrivacyPolicyView = lazyWithRetry(() => import('./views/PrivacyPolicyView').then((m) => ({ default: m.PrivacyPolicyView })));
const ResetPasswordView = lazyWithRetry(() => import('./views/ResetPasswordView').then((m) => ({ default: m.ResetPasswordView })));
const BuildKitView = lazyWithRetry(() => import('./views/BuildKitView').then((m) => ({ default: m.BuildKitView })));
const ReadinessView = lazyWithRetry(() => import('./views/ReadinessView').then((m) => ({ default: m.ReadinessView })));
const ReadinessGapView = lazyWithRetry(() => import('./views/ReadinessGapView').then((m) => ({ default: m.ReadinessGapView })));
const PresentationLayout = lazyWithRetry(() => import('./src/presentation/PresentationLayout').then((m) => ({ default: m.PresentationLayout })));
const EventsView = lazyWithRetry(() => import('./views/EventsView').then((m) => ({ default: m.EventsView })));
const EventSetupView = lazyWithRetry(() => import('./views/EventSetupView').then((m) => ({ default: m.EventSetupView })));
const EventRegistrationView = lazyWithRetry(() => import('./views/EventRegistrationView').then((m) => ({ default: m.EventRegistrationView })));
const VolunteerScanView = lazyWithRetry(() => import('./views/VolunteerScanView').then((m) => ({ default: m.VolunteerScanView })));
const EventDashboardView = lazyWithRetry(() => import('./views/EventDashboardView').then((m) => ({ default: m.EventDashboardView })));
const ShelterLocatorView = lazyWithRetry(() => import('./views/ShelterLocatorView').then((m) => ({ default: m.ShelterLocatorView })));
const BuyerPortalView = lazyWithRetry(() => import('./views/BuyerPortalView').then((m) => ({ default: m.BuyerPortalView })));
const LeadIntakeView = lazyWithRetry(() => import('./views/LeadIntakeView').then((m) => ({ default: m.LeadIntakeView })));
const LeadAdminView = lazyWithRetry(() => import('./views/LeadAdminView').then((m) => ({ default: m.LeadAdminView })));
const PublicIntakeView = lazyWithRetry(() => import('./views/PublicIntakeView').then((m) => ({ default: m.PublicIntakeView })));
const FinanceDashboardView = lazyWithRetry(() => import('./views/FinanceDashboardView').then((m) => ({ default: m.FinanceDashboardView })));
const SubscriptionView = lazyWithRetry(() => import('./views/SubscriptionView').then((m) => ({ default: m.SubscriptionView })));

class ViewErrorBoundary extends React.Component<
  { onRecover: () => void; children: React.ReactNode },
  { hasError: boolean; message?: string }
> {
  constructor(props: { onRecover: () => void; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: undefined };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, message: String(error?.message || error || 'Unknown view error') };
  }

  componentDidCatch(error: any) {
    console.error('View render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--bg-app)' }}>
          <div className="max-w-sm w-full bg-white border border-red-200 rounded-2xl p-5 shadow-sm">
            <h2 className="text-lg font-bold text-red-700 mb-2">Screen failed to load</h2>
            <p className="text-sm text-slate-600 mb-4">{this.state.message || 'An unexpected error occurred in this view.'}</p>
            <button
              className="w-full bg-slate-900 text-white rounded-lg py-2.5 font-semibold"
              onClick={() => {
                this.setState({ hasError: false, message: undefined });
                this.props.onRecover();
              }}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('SPLASH');
  const [subscriptionUnlockedFor, setSubscriptionUnlockedFor] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [postSplashView, setPostSplashView] = useState<ViewState>('LOGIN');
  const [peopleRegisteredCount, setPeopleRegisteredCount] = useState(0);
  const showSetupNotice = !hasSupabaseConfig;
  const currentRole = String(StorageService.getProfile()?.role || 'GENERAL_USER').toUpperCase();
  const isPresentationPath = typeof window !== 'undefined' && window.location.pathname === '/presentation';
  const isPresentationView = currentView === 'PRESENTATION' || isPresentationPath;

  const getStandaloneRequestedView = (): ViewState | null => {
    if (typeof window === 'undefined') return null;
    const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
    if (pathname === '/buyer-portal') return 'BUYER_PORTAL';
    if (pathname === '/lead-intake') return 'LEAD_INTAKE';
    if (pathname === '/lead-admin') return 'LEAD_ADMIN';
    if (pathname === '/public/intake') return 'PUBLIC_INTAKE';
    if (pathname === '/finance-dashboard') return 'FINANCE_DASHBOARD';
    if (pathname === '/privacy') return 'PRIVACY_POLICY';
    return null;
  };

  const getEventIdFromUrl = () => {
    const searchId = new URLSearchParams(window.location.search).get('event');
    if (searchId) return searchId;

    const hash = window.location.hash || '';
    const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
    const hashId = hashQuery ? new URLSearchParams(hashQuery).get('event') : null;
    return hashId || '';
  };

  const getStoredProfileForSessionUser = (sessionUser: { id?: string; email?: string | null }) => {
    const db = StorageService.getDB();
    const sessionUserId = String(sessionUser?.id || '').trim();
    const sessionEmail = String(sessionUser?.email || '').trim().toLowerCase();
    return db.users.find((user) => {
      const userId = String(user.id || '').trim();
      const userEmail = String(user.email || '').trim().toLowerCase();
      return (sessionUserId && userId === sessionUserId) || (sessionEmail && userEmail === sessionEmail);
    }) || null;
  };

  const resolveAuthenticatedLandingView = (profile: Partial<UserProfile> | null | undefined): ViewState => {
    const role = String(profile?.role || 'GENERAL_USER').toUpperCase();
    const onboardComplete = Boolean(profile?.onboardComplete || StorageService.isProfileComplete(profile));
    const recoveredView = sessionStorage.getItem('aera.viewAfterChunkReload') as ViewState | null;
    sessionStorage.removeItem('aera.viewAfterChunkReload');
    const requestedStandaloneView = getStandaloneRequestedView() || recoveredView || (sessionStorage.getItem('postLoginView') as ViewState | null);

    if (requestedStandaloneView && canRoleAccessView(role, requestedStandaloneView)) {
      sessionStorage.removeItem('postLoginView');
      return requestedStandaloneView;
    }
    if (requestedStandaloneView) sessionStorage.removeItem('postLoginView');

    if (shouldCompleteNewAccountSetup(profile?.email, onboardComplete)) return 'ACCOUNT_SETUP';
    if (role === 'BUYER') return 'BUYER_PORTAL';
    if (role === 'INSTITUTION_ADMIN' || role === 'ORG_ADMIN') return 'ORG_DASHBOARD';
    return 'DASHBOARD';
  };

  const setView = (nextView: ViewState) => {
    if (nextView === 'ACCOUNT_SETUP') {
      const profile = StorageService.getProfile();
      if (profile?.onboardComplete || StorageService.isProfileComplete(profile)) {
        setCurrentView(resolveAuthenticatedLandingView(profile));
        return;
      }
    }
    if (!isBootstrapping && !['SPLASH', 'LOGIN', 'REGISTRATION', 'RESET_PASSWORD'].includes(nextView)) {
      // If a newly deployed lazy chunk is missing from an older open browser tab,
      // lazyWithRetry reloads the page. Preserve the requested authenticated view
      // so that recovery resumes there instead of returning to Splash.
      sessionStorage.setItem('aera.viewAfterChunkReload', nextView);
    }
    setCurrentView(nextView);
  };

  useEffect(() => {
    StorageService.startOfflineSyncListener();
  }, []);

  useEffect(() => {
    let active = true;
    const loadPeopleRegisteredCount = async () => {
      if (!isBootstrapping && currentView !== 'SPLASH') return;
      try {
        const count = await fetchPeopleRegisteredCount();
        if (active) setPeopleRegisteredCount(count);
      } catch (e) {
        console.warn('Failed to fetch people registered count', e);
      }
    };
    loadPeopleRegisteredCount();
    return () => {
      active = false;
    };
  }, [currentView, isBootstrapping]);

  useEffect(() => {
    let active = true;
    const bootstrapSession = async () => {
      const pendingInviteFromUrl = capturePendingCommunityInviteFromUrl();
      const pendingInvite = pendingInviteFromUrl || getPendingCommunityInvite();
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      const eventIdFromUrl = getEventIdFromUrl();
      const isRecoveryPath = window.location.pathname.includes('reset-password');
      const isRecoveryHash = hash.includes('type=recovery') || search.includes('type=recovery') || hash.includes('reset-password');
      const isRecoveryUrl = isRecoveryPath || isRecoveryHash;
      const isPresentationUrl = window.location.pathname === '/presentation';
      const requestedStandaloneView = getStandaloneRequestedView();
      const isPublicIntakeUrl = requestedStandaloneView === 'PUBLIC_INTAKE';
      const isPrivacyUrl = requestedStandaloneView === 'PRIVACY_POLICY';
      const isEventRegistrationUrl = Boolean(eventIdFromUrl);
      try {
        // React Strict Mode intentionally remounts effects in development. Reuse one
        // startup session read so both mounts cannot compete for Supabase's auth lock.
        const { data } = hasSupabaseConfig
          ? await getInitialSession()
          : { data: { session: null } };
        if (!active) return;
        if (isPublicIntakeUrl) {
          setPostSplashView('PUBLIC_INTAKE');
          setView('PUBLIC_INTAKE');
        } else if (isPrivacyUrl) {
          setPostSplashView('PRIVACY_POLICY');
          setView('PRIVACY_POLICY');
        } else if (isPresentationUrl) {
          setPostSplashView('PRESENTATION');
          setView('PRESENTATION');
        } else if (isRecoveryUrl) {
          setPostSplashView('RESET_PASSWORD');
          setView('RESET_PASSWORD');
        } else if (isEventRegistrationUrl) {
          setPostSplashView('EVENT_REGISTRATION');
          setView('SPLASH');
        } else if (data?.session?.user) {
          const sessionUser = data.session.user;
          const activeLocalProfile = StorageService.getProfile();
          const storedSessionProfile = getStoredProfileForSessionUser(sessionUser);
          const localProfile = activeLocalProfile?.id && activeLocalProfile.id !== 'guest'
            ? activeLocalProfile
            : storedSessionProfile;
          if (localProfile?.id && localProfile.id !== 'guest') {
            const baseProfile = localProfile as UserProfile;
            StorageService.saveProfile(baseProfile, { skipRemoteSync: true });
            // Background hydrate + sync so edits made on one device are pushed to Supabase and reloaded elsewhere.
            void (async () => {
              try {
                const [remoteProfile, remoteVitals] = await Promise.all([
                  fetchProfileForUser().catch(() => null),
                  fetchVitalsForUser().catch(() => null),
                ]);

                const mergedProfile: UserProfile = {
                  ...baseProfile,
                  fullName: remoteProfile?.fullName || baseProfile.fullName || '',
                  email: remoteProfile?.email || baseProfile.email || sessionUser.email || '',
                  phone: remoteProfile?.phone || baseProfile.phone || '',
                  address: remoteProfile?.address || baseProfile.address || '',
                  addressLine1: remoteProfile?.addressLine1 || baseProfile.addressLine1,
                  addressLine2: remoteProfile?.addressLine2 || baseProfile.addressLine2,
                  city: remoteProfile?.city || baseProfile.city,
                  state: remoteProfile?.state || baseProfile.state,
                  zipCode: remoteProfile?.zipCode || baseProfile.zipCode,
                  latitude: remoteProfile?.latitude ?? baseProfile.latitude,
                  longitude: remoteProfile?.longitude ?? baseProfile.longitude,
                  googlePlaceId: remoteProfile?.googlePlaceId || baseProfile.googlePlaceId,
                  addressVerified: remoteProfile?.addressVerified ?? baseProfile.addressVerified,
                  addressVerifiedAt: remoteProfile?.addressVerifiedAt || baseProfile.addressVerifiedAt,
                  geocodeConfidence: remoteProfile?.geocodeConfidence ?? baseProfile.geocodeConfidence,
                  geocodedAt: remoteProfile?.geocodedAt || baseProfile.geocodedAt,
                  geofencedOutreachOptIn: remoteProfile?.geofencedOutreachOptIn ?? baseProfile.geofencedOutreachOptIn,
                  geofencedOutreachRadiusMiles: remoteProfile?.geofencedOutreachRadiusMiles ?? baseProfile.geofencedOutreachRadiusMiles,
                  geofencedOutreachConsentAt: remoteProfile?.geofencedOutreachConsentAt || baseProfile.geofencedOutreachConsentAt,
                  householdMembers: remoteVitals?.householdMembers || baseProfile.householdMembers || 1,
                  household: remoteVitals?.household || baseProfile.household || [],
                  petDetails: remoteVitals?.petDetails || baseProfile.petDetails || '',
                  medicalNeeds: remoteVitals?.medicalNeeds || baseProfile.medicalNeeds || '',
                  medicationDependency: remoteVitals?.medicationDependency ?? baseProfile.medicationDependency,
                  insulinDependency: remoteVitals?.insulinDependency ?? baseProfile.insulinDependency,
                  oxygenPoweredDevice: remoteVitals?.oxygenPoweredDevice ?? baseProfile.oxygenPoweredDevice,
                  mobilityLimitation: remoteVitals?.mobilityLimitation ?? baseProfile.mobilityLimitation,
                  transportationAccess: remoteVitals?.transportationAccess ?? baseProfile.transportationAccess,
                  financialStrain: remoteVitals?.financialStrain ?? baseProfile.financialStrain,
                  consentPreparednessPlanning:
                    remoteVitals?.consentPreparednessPlanning ?? baseProfile.consentPreparednessPlanning,
                  consentTimestamp: remoteVitals?.consentTimestamp ?? baseProfile.consentTimestamp,
                  emergencyContactName: remoteProfile?.emergencyContactName || baseProfile.emergencyContactName || '',
                  emergencyContactPhone: remoteProfile?.emergencyContactPhone || baseProfile.emergencyContactPhone || '',
                  emergencyContactRelation:
                    remoteProfile?.emergencyContactRelation || baseProfile.emergencyContactRelation || '',
                  communityId: remoteProfile?.communityId || baseProfile.communityId || '',
                  role: remoteProfile?.role || baseProfile.role || 'GENERAL_USER',
                  onboardComplete: remoteProfile?.onboardComplete ?? baseProfile.onboardComplete,
                  notifications: baseProfile.notifications || { push: true, sms: true, email: true },
                };

                StorageService.saveProfile(mergedProfile);
              } catch (err) {
                console.warn('Background profile sync failed', err);
              }
            })();
            const inviteResolution = resolveCommunityInvite(localProfile.communityId, pendingInvite);
            if (inviteResolution === 'already-connected') clearPendingCommunityInvite();
            const nextView = inviteResolution === 'needs-confirmation' &&
              Boolean(localProfile.onboardComplete || StorageService.isProfileComplete(localProfile))
              ? 'SETTINGS'
              : resolveAuthenticatedLandingView(localProfile);
            setPostSplashView(nextView);
            setView('SPLASH');
          } else {
            const [remoteProfile, remoteVitals] = await Promise.all([
              fetchProfileForUser().catch(() => null),
              fetchVitalsForUser().catch(() => null),
            ]);

            const hydratedProfile: UserProfile = {
              id: sessionUser.id,
              fullName: remoteProfile?.fullName || storedSessionProfile?.fullName || '',
              email: remoteProfile?.email || storedSessionProfile?.email || sessionUser.email || '',
              phone: remoteProfile?.phone || storedSessionProfile?.phone || '',
              address: remoteProfile?.address || storedSessionProfile?.address || '',
              addressLine1: remoteProfile?.addressLine1 || storedSessionProfile?.addressLine1,
              addressLine2: remoteProfile?.addressLine2 || storedSessionProfile?.addressLine2,
              city: remoteProfile?.city || storedSessionProfile?.city,
              state: remoteProfile?.state || storedSessionProfile?.state,
              zipCode: remoteProfile?.zipCode || storedSessionProfile?.zipCode,
              latitude: remoteProfile?.latitude ?? storedSessionProfile?.latitude,
              longitude: remoteProfile?.longitude ?? storedSessionProfile?.longitude,
              googlePlaceId: remoteProfile?.googlePlaceId || storedSessionProfile?.googlePlaceId,
              addressVerified: remoteProfile?.addressVerified ?? storedSessionProfile?.addressVerified,
              addressVerifiedAt: remoteProfile?.addressVerifiedAt || storedSessionProfile?.addressVerifiedAt,
              geocodeConfidence: remoteProfile?.geocodeConfidence ?? storedSessionProfile?.geocodeConfidence,
              geocodedAt: remoteProfile?.geocodedAt || storedSessionProfile?.geocodedAt,
              geofencedOutreachOptIn: remoteProfile?.geofencedOutreachOptIn ?? storedSessionProfile?.geofencedOutreachOptIn,
              geofencedOutreachRadiusMiles: remoteProfile?.geofencedOutreachRadiusMiles ?? storedSessionProfile?.geofencedOutreachRadiusMiles,
              geofencedOutreachConsentAt: remoteProfile?.geofencedOutreachConsentAt || storedSessionProfile?.geofencedOutreachConsentAt,
              householdMembers: remoteVitals?.householdMembers || storedSessionProfile?.householdMembers || 1,
              household: remoteVitals?.household || storedSessionProfile?.household || [],
              petDetails: remoteVitals?.petDetails || storedSessionProfile?.petDetails || '',
              medicalNeeds: remoteVitals?.medicalNeeds || storedSessionProfile?.medicalNeeds || '',
              medicationDependency: remoteVitals?.medicationDependency,
              insulinDependency: remoteVitals?.insulinDependency,
              oxygenPoweredDevice: remoteVitals?.oxygenPoweredDevice,
              mobilityLimitation: remoteVitals?.mobilityLimitation,
              transportationAccess: remoteVitals?.transportationAccess,
              financialStrain: remoteVitals?.financialStrain,
              consentPreparednessPlanning: remoteVitals?.consentPreparednessPlanning,
              consentTimestamp: remoteVitals?.consentTimestamp,
              emergencyContactName: remoteProfile?.emergencyContactName || storedSessionProfile?.emergencyContactName || '',
              emergencyContactPhone: remoteProfile?.emergencyContactPhone || storedSessionProfile?.emergencyContactPhone || '',
              emergencyContactRelation: remoteProfile?.emergencyContactRelation || storedSessionProfile?.emergencyContactRelation || '',
              communityId: remoteProfile?.communityId || storedSessionProfile?.communityId || '',
              role: remoteProfile?.role || storedSessionProfile?.role || 'GENERAL_USER',
              language: 'en',
              active: true,
              onboardComplete: remoteProfile?.onboardComplete ?? Boolean(remoteVitals || storedSessionProfile?.onboardComplete),
              notifications: storedSessionProfile?.notifications || { push: true, sms: true, email: true },
            };

            StorageService.saveProfile(hydratedProfile, { skipRemoteSync: true });
            const inviteResolution = resolveCommunityInvite(hydratedProfile.communityId, pendingInvite);
            if (inviteResolution === 'already-connected') clearPendingCommunityInvite();
            const nextView = inviteResolution === 'needs-confirmation' &&
              Boolean(hydratedProfile.onboardComplete || StorageService.isProfileComplete(hydratedProfile))
              ? 'SETTINGS'
              : resolveAuthenticatedLandingView(hydratedProfile);
            setPostSplashView(nextView);
            setView('SPLASH');
          }
        } else {
          // A local profile is only a cache of an authenticated account. When
          // Supabase confirms there is no session, clear it before rendering
          // any public route so a shared device cannot expose the prior user.
          StorageService.logoutUser();
          if (requestedStandaloneView) {
            sessionStorage.setItem('postLoginView', requestedStandaloneView);
            setPostSplashView('LOGIN');
            setView('SPLASH');
          } else if (pendingInvite?.communityId) {
            setPostSplashView('LOGIN');
            setView('SPLASH');
          } else {
            setPostSplashView('LOGIN');
            setView('SPLASH');
          }
        }
      } catch {
        if (!active) return;
        if (isPublicIntakeUrl) {
          setPostSplashView('PUBLIC_INTAKE');
          setView('PUBLIC_INTAKE');
        } else if (isPrivacyUrl) {
          setPostSplashView('PRIVACY_POLICY');
          setView('PRIVACY_POLICY');
        } else if (isPresentationUrl) {
          setPostSplashView('PRESENTATION');
          setView('PRESENTATION');
        } else if (isRecoveryUrl) {
          setPostSplashView('RESET_PASSWORD');
          setView('RESET_PASSWORD');
        } else if (isEventRegistrationUrl) {
          setPostSplashView('EVENT_REGISTRATION');
          setView('SPLASH');
        } else {
          if (pendingInvite?.communityId) {
            setPostSplashView('LOGIN');
            setView('SPLASH');
          } else {
            setPostSplashView('LOGIN');
            setView('SPLASH');
          }
        }
      } finally {
        if (active) setIsBootstrapping(false);
      }
    };
    bootstrapSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPostSplashView('RESET_PASSWORD');
        setView('RESET_PASSWORD');
        return;
      }

      if (event === 'SIGNED_OUT') {
        initialSessionPromise = null;
        StorageService.logoutUser();
        setPostSplashView('LOGIN');
        setView('LOGIN');
      }
    });
    return () => {
      subscription?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentPath = window.location.pathname;

    if (currentView === 'BUYER_PORTAL' && currentPath !== '/buyer-portal') {
      window.history.replaceState({}, '', '/buyer-portal');
      return;
    }

    if (
      currentPath === '/buyer-portal' &&
      currentView !== 'BUYER_PORTAL' &&
      currentView !== 'SPLASH' &&
      currentView !== 'LOGIN'
    ) {
      window.history.replaceState({}, '', '/');
    }
  }, [currentView]);

  const handleSplashComplete = () => {
    sessionStorage.setItem('splashSeen', '1');
    setView(postSplashView);
  };

  const handleFinanceFromSplash = () => {
    sessionStorage.setItem('openFinanceOnLoad', '1');
    setView('DASHBOARD');
    window.dispatchEvent(new Event('finance-open'));
  };

  const handleOrganizationCodeFromSplash = (code: string) => {
    savePendingOrganizationCode(code);
    setView('LOGIN');
  };

  const handlePrivacyFromSplash = () => {
    // The privacy page is public. Preserve its public return destination so a
    // signed-out visitor cannot fall through to a cached user's Settings view.
    sessionStorage.setItem('privacyReturnView', 'SPLASH');
    setView('PRIVACY_POLICY');
  };

  const renderView = () => {
    if (isBootstrapping) {
      return (
        <SplashView
          onEnter={handleSplashComplete}
          onOrganizationCode={handleOrganizationCodeFromSplash}
          onPrivacy={handlePrivacyFromSplash}
          peopleRegisteredCount={peopleRegisteredCount}
        />
      );
    }

    const subscriptionProfile = StorageService.getProfile();
    const mayOpenWithoutSubscription = currentView === 'SETTINGS' || currentView === 'PRIVACY_POLICY';
    if (
      !mayOpenWithoutSubscription
      && subscriptionUnlockedFor !== subscriptionProfile.id
      && requiresIndividualAppleSubscription(subscriptionProfile)
    ) {
      return (
        <SubscriptionView
          profile={subscriptionProfile}
          onSubscribed={() => {
            setSubscriptionUnlockedFor(subscriptionProfile.id);
            setView('DASHBOARD');
          }}
          onOpenAccountSettings={() => setView('SETTINGS')}
        />
      );
    }

    switch (currentView) {
      case 'SPLASH':
        return (
          <SplashView
            onEnter={handleSplashComplete}
            onOrganizationCode={handleOrganizationCodeFromSplash}
            onPrivacy={handlePrivacyFromSplash}
            peopleRegisteredCount={peopleRegisteredCount}
          />
        );
      case 'PRESENTATION':
        return <PresentationLayout setView={setView} />;
      case 'REGISTRATION':
        return <RegistrationView setView={setView} mode="REGISTRATION" />;
      case 'ACCOUNT_SETUP':
        return <RegistrationView setView={setView} mode="SETUP" />;
      case 'LOGIN':
        return <LoginView setView={setView} />;
      case 'RESET_PASSWORD':
        return <ResetPasswordView setView={setView} />;
      case 'BUILD_KIT':
        return <ReadinessView setView={setView} />;
      case 'READINESS':
        return <ReadinessView setView={setView} />;
      case 'READINESS_GAP':
        return <ReadinessGapView setView={setView} />;
      case 'DASHBOARD':
        return <DashboardView setView={setView} />;
      case 'HELP_WIZARD':
        return <HelpFormView setView={setView} />;
      case 'SETTINGS':
        return <SettingsView setView={setView} />;
      case 'NEW_SIGNUPS':
        return canRoleAccessView(currentRole, 'NEW_SIGNUPS') ? <NewSignupsView setView={setView} /> : <DashboardView setView={setView} />;
      case 'MAP':
        return canRoleAccessView(currentRole, 'MAP') ? <MapView setView={setView} /> : <DashboardView setView={setView} />;
      case 'ALERTS':
        return <DashboardView setView={setView} />;
      case 'GAP':
        return <GapView setView={setView} />;
      case 'GAP_MANAGEMENT':
        return canRoleAccessView(currentRole, 'GAP_MANAGEMENT') ? <GapManagementView setView={setView} /> : <DashboardView setView={setView} />;
      case 'ASSESSMENT':
        return <AssessmentView setView={setView} />;
      case 'POPULATION':
        return canRoleAccessView(currentRole, 'POPULATION') ? <PopulationView setView={setView} /> : <DashboardView setView={setView} />;
      case 'RECOVERY':
        return canRoleAccessView(currentRole, 'RECOVERY') ? <RecoveryView setView={setView} /> : <DashboardView setView={setView} />;
      case 'DRONE':
        return canRoleAccessView(currentRole, 'DRONE') ? <DroneView setView={setView} /> : <DashboardView setView={setView} />;
      case 'LOGISTICS':
        return canRoleAccessView(currentRole, 'LOGISTICS') ? <LogisticsView setView={setView} /> : <DashboardView setView={setView} />;
      case 'ORG_DASHBOARD':
        {
          const requestedTab = sessionStorage.getItem('orgDashboardInitialTab');
          const initialOrgDashboardTab = requestedTab === 'INVENTORY' || requestedTab === 'PREPAREDNESS' || requestedTab === 'MEMBERS' || requestedTab === 'OUTREACH'
            ? requestedTab
            : 'MEMBERS';
          sessionStorage.removeItem('orgDashboardInitialTab');
          return canRoleAccessView(currentRole, 'ORG_DASHBOARD')
            ? <OrgDashboardView setView={setView} initialTab={initialOrgDashboardTab} />
            : <DashboardView setView={setView} />;
        }
      case 'PRIVACY_POLICY':
        return <PrivacyPolicyView setView={setView} />;
      case 'EVENTS':
        return <EventsView setView={setView} />;
      case 'EVENT_SETUP':
        return canRoleAccessView(currentRole, 'EVENT_SETUP') ? <EventSetupView setView={setView} /> : <DashboardView setView={setView} />;
      case 'EVENT_REGISTRATION':
        return <EventRegistrationView setView={setView} />;
      case 'VOLUNTEER_SCAN':
        return canRoleAccessView(currentRole, 'VOLUNTEER_SCAN') ? <VolunteerScanView setView={setView} /> : <DashboardView setView={setView} />;
      case 'EVENT_DASHBOARD':
        return canRoleAccessView(currentRole, 'EVENT_DASHBOARD') ? <EventDashboardView setView={setView} /> : <DashboardView setView={setView} />;
      case 'SHELTER_LOCATOR':
        return <ShelterLocatorView setView={setView} />;
      case 'BUYER_PORTAL':
        return canRoleAccessView(currentRole, 'BUYER_PORTAL') ? <BuyerPortalView setView={setView} /> : <DashboardView setView={setView} />;
      case 'LEAD_INTAKE':
        return canRoleAccessView(currentRole, 'LEAD_INTAKE') ? <LeadIntakeView setView={setView} /> : <DashboardView setView={setView} />;
      case 'LEAD_ADMIN':
        return canRoleAccessView(currentRole, 'LEAD_ADMIN') ? <LeadAdminView setView={setView} /> : <DashboardView setView={setView} />;
      case 'PUBLIC_INTAKE': {
        const searchParams = new URLSearchParams(window.location.search || '');
        const hash = window.location.hash || '';
        const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
        const hashParams = new URLSearchParams(hashQuery);
        const rawShareToken =
          searchParams.get('share_token') ||
          searchParams.get('token') ||
          searchParams.get('shareToken') ||
          hashParams.get('share_token') ||
          hashParams.get('token') ||
          hashParams.get('shareToken') ||
          '';
        const shareToken = rawShareToken.replace(/^['"]|['"]$/g, '').trim();
        return <PublicIntakeView shareToken={shareToken} />;
      }
      case 'FINANCE_DASHBOARD':
        return canRoleAccessView(currentRole, 'FINANCE_DASHBOARD') ? <FinanceDashboardView setView={setView} /> : <DashboardView setView={setView} />;
      default:
        return <DashboardView setView={setView} />;
    }
  };

  const showNav = shouldShowEssentialNavigation(currentView, StorageService.hasProfile());

  const useWideLayout = [
    'DASHBOARD',
    'SETTINGS',
    'MAP',
    'GAP',
    'GAP_MANAGEMENT',
    'ASSESSMENT',
    'POPULATION',
    'RECOVERY',
    'DRONE',
    'LOGISTICS',
    'ORG_DASHBOARD',
    'NEW_SIGNUPS',
    'EVENTS',
    'EVENT_SETUP',
    'EVENT_DASHBOARD',
    'VOLUNTEER_SCAN',
    'SHELTER_LOCATOR',
    'BUYER_PORTAL',
    'LEAD_ADMIN',
  ].includes(currentView);
  const shellFrameClass = useWideLayout
    ? 'shadow-none md:border-0'
    : 'shadow-2xl md:border-x md:border-slate-200';

  return (
    <div className={isPresentationView
      ? 'w-screen min-h-screen relative overflow-x-hidden overflow-y-auto print:max-w-none print:w-full print:h-auto print:overflow-visible print:shadow-none print:border-0'
      : `${useWideLayout
          ? 'w-full max-w-md md:max-w-5xl'
          : 'w-full max-w-md'} mx-auto min-h-screen relative overflow-hidden ${shellFrameClass} print:max-w-none print:w-full print:h-auto print:overflow-visible print:shadow-none print:border-0`} style={{ backgroundColor: 'var(--bg-app)' }}>
      {showSetupNotice && (
        <div className="absolute top-0 inset-x-0 z-50">
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2 text-xs text-center">
            {supabaseConfigMessage} — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then rebuild.
          </div>
        </div>
      )}
      <ViewErrorBoundary onRecover={() => setView('DASHBOARD')}>
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--bg-app)' }}>
              <p className="text-sm font-medium text-slate-500">Loading…</p>
            </div>
          }
        >
          {renderView()}
        </Suspense>
      </ViewErrorBoundary>
      {showNav && <BottomNav currentView={currentView} setView={setView} />}
    </div>
  );
}
