
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { ViewState, UserProfile } from './types';
import { StorageService } from './services/storage';
import { capturePendingCommunityInviteFromUrl, getPendingCommunityInvite } from './services/communityInvite';
import { fetchProfileForUser, fetchVitalsForUser, getPeopleRegisteredCount as fetchPeopleRegisteredCount } from './services/api';
import { hasSupabaseConfig, supabaseConfigMessage, supabase } from './services/supabase';

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
  const [currentView, setView] = useState<ViewState>('SPLASH');
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [postSplashView, setPostSplashView] = useState<ViewState>('LOGIN');
  const [peopleRegisteredCount, setPeopleRegisteredCount] = useState(0);
  const showSetupNotice = !hasSupabaseConfig;
  const currentRole = String(StorageService.getProfile()?.role || 'GENERAL_USER').toUpperCase();
  const canAccessAdvancedViews = ['ADMIN', 'STATE_ADMIN', 'COUNTY_ADMIN', 'ORG_ADMIN', 'INSTITUTION_ADMIN', 'FIRST_RESPONDER', 'LOCAL_AUTHORITY', 'CONTRACTOR'].includes(currentRole);
  const canAccessLeadIntake = ['ADMIN', 'ORG_ADMIN'].includes(currentRole);
  const canAccessBuyerPortal = ['ADMIN', 'BUYER'].includes(currentRole);
  const canAccessLeadAdmin = currentRole === 'ADMIN';
  const canAccessOrgDashboard = ['ADMIN', 'STATE_ADMIN', 'COUNTY_ADMIN', 'ORG_ADMIN', 'INSTITUTION_ADMIN'].includes(currentRole);
  const canAccessNewSignups = currentRole === 'ADMIN';
  const isPresentationPath = typeof window !== 'undefined' && window.location.pathname === '/presentation';
  const isPresentationView = currentView === 'PRESENTATION' || isPresentationPath;

  const canRoleAccessBuyerPortal = (role: string) => ['ADMIN', 'BUYER'].includes(role);

  const getStandaloneRequestedView = (): ViewState | null => {
    if (typeof window === 'undefined') return null;
    if (window.location.pathname === '/buyer-portal') return 'BUYER_PORTAL';
    if (window.location.pathname === '/lead-intake') return 'LEAD_INTAKE';
    if (window.location.pathname === '/lead-admin') return 'LEAD_ADMIN';
    if (window.location.pathname === '/public/intake') return 'PUBLIC_INTAKE';
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

  const resolveAuthenticatedLandingView = (profile: Partial<UserProfile> | null | undefined): ViewState => {
    const role = String(profile?.role || 'GENERAL_USER').toUpperCase();
    const onboardComplete = Boolean(profile?.onboardComplete);
    const canRoleAccessLeadIntake = ['ADMIN', 'ORG_ADMIN'].includes(role);
    const canRoleAccessLeadAdmin = role === 'ADMIN';

    const requestedStandaloneView = getStandaloneRequestedView() || (sessionStorage.getItem('postLoginView') as ViewState | null);

    if (requestedStandaloneView === 'BUYER_PORTAL' && canRoleAccessBuyerPortal(role)) {
      sessionStorage.removeItem('postLoginView');
      return 'BUYER_PORTAL';
    }
    if (requestedStandaloneView === 'LEAD_INTAKE' && canRoleAccessLeadIntake) {
      sessionStorage.removeItem('postLoginView');
      return 'LEAD_INTAKE';
    }
    if (requestedStandaloneView === 'LEAD_ADMIN' && canRoleAccessLeadAdmin) {
      sessionStorage.removeItem('postLoginView');
      return 'LEAD_ADMIN';
    }

    if (!onboardComplete) return 'ACCOUNT_SETUP';
    if (role === 'BUYER') return 'BUYER_PORTAL';
    if (role === 'INSTITUTION_ADMIN' || role === 'ORG_ADMIN') return 'ORG_DASHBOARD';
    return 'DASHBOARD';
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
      const isEventRegistrationUrl = Boolean(eventIdFromUrl);
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
          if (isPublicIntakeUrl) {
            setPostSplashView('PUBLIC_INTAKE');
            setView('PUBLIC_INTAKE');
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
          const localProfile = StorageService.getProfile();
          if (localProfile?.id && localProfile.id !== 'guest') {
            const nextView = resolveAuthenticatedLandingView(localProfile);
            setPostSplashView(nextView);
            setView(nextView);
          } else {
            const [remoteProfile, remoteVitals] = await Promise.all([
              fetchProfileForUser().catch(() => null),
              fetchVitalsForUser().catch(() => null),
            ]);

            const sessionUser = data.session.user;
            const hydratedProfile: UserProfile = {
              id: sessionUser.id,
              fullName: remoteProfile?.fullName || '',
              email: remoteProfile?.email || sessionUser.email || '',
              phone: remoteProfile?.phone || '',
              address: remoteProfile?.address || '',
              addressLine1: remoteProfile?.addressLine1,
              addressLine2: remoteProfile?.addressLine2,
              city: remoteProfile?.city,
              state: remoteProfile?.state,
              zipCode: remoteProfile?.zipCode,
              latitude: remoteProfile?.latitude,
              longitude: remoteProfile?.longitude,
              googlePlaceId: remoteProfile?.googlePlaceId,
              addressVerified: remoteProfile?.addressVerified,
              addressVerifiedAt: remoteProfile?.addressVerifiedAt,
              householdMembers: remoteVitals?.householdMembers || 1,
              household: remoteVitals?.household || [],
              petDetails: remoteVitals?.petDetails || '',
              medicalNeeds: remoteVitals?.medicalNeeds || '',
              medicationDependency: remoteVitals?.medicationDependency,
              insulinDependency: remoteVitals?.insulinDependency,
              oxygenPoweredDevice: remoteVitals?.oxygenPoweredDevice,
              mobilityLimitation: remoteVitals?.mobilityLimitation,
              transportationAccess: remoteVitals?.transportationAccess,
              financialStrain: remoteVitals?.financialStrain,
              consentPreparednessPlanning: remoteVitals?.consentPreparednessPlanning,
              consentTimestamp: remoteVitals?.consentTimestamp,
              emergencyContactName: remoteProfile?.emergencyContactName || '',
              emergencyContactPhone: remoteProfile?.emergencyContactPhone || '',
              emergencyContactRelation: remoteProfile?.emergencyContactRelation || '',
              communityId: remoteProfile?.communityId || '',
              role: remoteProfile?.role || 'GENERAL_USER',
              language: 'en',
              active: true,
              onboardComplete: Boolean(remoteVitals || localProfile?.onboardComplete),
              notifications: { push: true, sms: true, email: true },
            };

            StorageService.saveProfile(hydratedProfile, { skipRemoteSync: true });
            const nextView = resolveAuthenticatedLandingView(hydratedProfile);
            setPostSplashView(nextView);
            setView(nextView);
          }
        } else if (requestedStandaloneView === 'PUBLIC_INTAKE') {
          setPostSplashView('PUBLIC_INTAKE');
          setView('PUBLIC_INTAKE');
        } else if (requestedStandaloneView === 'BUYER_PORTAL') {
          sessionStorage.setItem('postLoginView', 'BUYER_PORTAL');
          setPostSplashView('LOGIN');
          setView('SPLASH');
        } else if (requestedStandaloneView === 'LEAD_INTAKE') {
          sessionStorage.setItem('postLoginView', 'LEAD_INTAKE');
          setPostSplashView('LOGIN');
          setView('SPLASH');
        } else if (requestedStandaloneView === 'LEAD_ADMIN') {
          sessionStorage.setItem('postLoginView', 'LEAD_ADMIN');
          setPostSplashView('LOGIN');
          setView('SPLASH');
        } else if (pendingInvite?.communityId) {
          setPostSplashView('REGISTRATION');
          setView('SPLASH');
        } else {
          setPostSplashView('LOGIN');
          setView('SPLASH');
        }
      } catch {
        if (!active) return;
        if (isPublicIntakeUrl) {
          setPostSplashView('PUBLIC_INTAKE');
          setView('PUBLIC_INTAKE');
        } else if (isPresentationUrl) {
          setPostSplashView('PRESENTATION');
          setView('PRESENTATION');
        } else if (isRecoveryUrl) {
          setPostSplashView('RESET_PASSWORD');
          setView('RESET_PASSWORD');
        } else if (isEventRegistrationUrl) {
          setPostSplashView('EVENT_REGISTRATION');
          setView('SPLASH');
        } else if (pendingInvite?.communityId) {
          setPostSplashView('REGISTRATION');
          setView('SPLASH');
        } else {
          setView('SPLASH');
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

  const renderView = () => {
    if (isBootstrapping) {
      return (
        <SplashView
          onEnter={handleSplashComplete}
          onPrivacy={() => setView('PRIVACY_POLICY')}
          peopleRegisteredCount={peopleRegisteredCount}
        />
      );
    }
    switch (currentView) {
      case 'SPLASH':
        return (
          <SplashView
            onEnter={handleSplashComplete}
            onPrivacy={() => setView('PRIVACY_POLICY')}
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
        return canAccessNewSignups ? <NewSignupsView setView={setView} /> : <DashboardView setView={setView} />;
      case 'MAP':
        return canAccessAdvancedViews ? <MapView setView={setView} /> : <DashboardView setView={setView} />;
      case 'ALERTS':
        return <DashboardView setView={setView} />;
      case 'GAP':
        return <GapView setView={setView} />;
      case 'GAP_MANAGEMENT':
        return currentRole === 'ADMIN' ? <GapManagementView setView={setView} /> : <DashboardView setView={setView} />;
      case 'ASSESSMENT':
        return <AssessmentView setView={setView} />;
      case 'POPULATION':
        return canAccessAdvancedViews ? <PopulationView setView={setView} /> : <DashboardView setView={setView} />;
      case 'RECOVERY':
        return canAccessAdvancedViews ? <RecoveryView setView={setView} /> : <DashboardView setView={setView} />;
      case 'DRONE':
        return canAccessAdvancedViews ? <DroneView setView={setView} /> : <DashboardView setView={setView} />;
      case 'LOGISTICS':
        return canAccessAdvancedViews ? <LogisticsView setView={setView} /> : <DashboardView setView={setView} />;
      case 'ORG_DASHBOARD':
        {
          const requestedTab = sessionStorage.getItem('orgDashboardInitialTab');
          const initialOrgDashboardTab = requestedTab === 'INVENTORY' || requestedTab === 'PREPAREDNESS' || requestedTab === 'MEMBERS'
            ? requestedTab
            : 'MEMBERS';
          sessionStorage.removeItem('orgDashboardInitialTab');
          return canAccessOrgDashboard
            ? <OrgDashboardView setView={setView} initialTab={initialOrgDashboardTab} />
            : <DashboardView setView={setView} />;
        }
      case 'PRIVACY_POLICY':
        return <PrivacyPolicyView setView={setView} />;
      case 'EVENTS':
        return <EventsView setView={setView} />;
      case 'EVENT_SETUP':
        return canAccessOrgDashboard ? <EventSetupView setView={setView} /> : <DashboardView setView={setView} />;
      case 'EVENT_REGISTRATION':
        return <EventRegistrationView setView={setView} />;
      case 'VOLUNTEER_SCAN':
        return canAccessAdvancedViews ? <VolunteerScanView setView={setView} /> : <DashboardView setView={setView} />;
      case 'EVENT_DASHBOARD':
        return canAccessOrgDashboard ? <EventDashboardView setView={setView} /> : <DashboardView setView={setView} />;
      case 'SHELTER_LOCATOR':
        return <ShelterLocatorView setView={setView} />;
      case 'BUYER_PORTAL':
        return canAccessBuyerPortal ? <BuyerPortalView setView={setView} /> : <DashboardView setView={setView} />;
      case 'LEAD_INTAKE':
        return canAccessLeadIntake ? <LeadIntakeView setView={setView} /> : <DashboardView setView={setView} />;
      case 'LEAD_ADMIN':
        return canAccessLeadAdmin ? <LeadAdminView setView={setView} /> : <DashboardView setView={setView} />;
      case 'PUBLIC_INTAKE': {
        const shareToken = new URLSearchParams(window.location.search).get('share_token') || '';
        return <PublicIntakeView shareToken={shareToken} />;
      }
      default:
        return <DashboardView setView={setView} />;
    }
  };

  const showNav = currentView !== 'SPLASH' && 
                  currentView !== 'PRESENTATION' &&
                  currentView !== 'HELP_WIZARD' && 
                  currentView !== 'REGISTRATION' && 
                  currentView !== 'ACCOUNT_SETUP' &&
                  currentView !== 'LOGIN' && 
                  currentView !== 'RESET_PASSWORD' &&
                  currentView !== 'BUILD_KIT' &&
                  currentView !== 'NEW_SIGNUPS' &&
                  currentView !== 'READINESS' &&
                  currentView !== 'READINESS_GAP' &&
                  currentView !== 'ORG_DASHBOARD' &&
                  currentView !== 'PRIVACY_POLICY' &&
                  currentView !== 'EVENT_SETUP' &&
                  currentView !== 'EVENT_REGISTRATION' &&
                  currentView !== 'VOLUNTEER_SCAN' &&
                  currentView !== 'EVENT_DASHBOARD' &&
                  currentView !== 'BUYER_PORTAL' &&
                  currentView !== 'PUBLIC_INTAKE' &&
                  currentView !== 'LEAD_INTAKE' &&
                  currentView !== 'LEAD_ADMIN';

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
