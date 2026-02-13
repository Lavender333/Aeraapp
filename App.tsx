
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { ViewState } from './types';
import { StorageService } from './services/storage';
import { hasSupabaseConfig, supabaseConfigMessage, supabase } from './services/supabase';

const SplashView = lazy(() => import('./views/SplashView').then((m) => ({ default: m.SplashView })));
const DashboardView = lazy(() => import('./views/DashboardView').then((m) => ({ default: m.DashboardView })));
const HelpFormView = lazy(() => import('./views/HelpFormView').then((m) => ({ default: m.HelpFormView })));
const SettingsView = lazy(() => import('./views/SettingsView').then((m) => ({ default: m.SettingsView })));
const MapView = lazy(() => import('./views/MapView').then((m) => ({ default: m.MapView })));
const GapView = lazy(() => import('./views/GapView').then((m) => ({ default: m.GapView })));
const AssessmentView = lazy(() => import('./views/AssessmentView').then((m) => ({ default: m.AssessmentView })));
const PopulationView = lazy(() => import('./views/PopulationView').then((m) => ({ default: m.PopulationView })));
const RecoveryView = lazy(() => import('./views/RecoveryView').then((m) => ({ default: m.RecoveryView })));
const DroneView = lazy(() => import('./views/DroneView').then((m) => ({ default: m.DroneView })));
const LogisticsView = lazy(() => import('./views/LogisticsView').then((m) => ({ default: m.LogisticsView })));
const RegistrationView = lazy(() => import('./views/RegistrationView').then((m) => ({ default: m.RegistrationView })));
const OrgDashboardView = lazy(() => import('./views/OrgDashboardView').then((m) => ({ default: m.OrgDashboardView })));
const LoginView = lazy(() => import('./views/LoginView').then((m) => ({ default: m.LoginView })));
const PresentationView = lazy(() => import('./views/PresentationView').then((m) => ({ default: m.PresentationView })));
const PrivacyPolicyView = lazy(() => import('./views/PrivacyPolicyView').then((m) => ({ default: m.PrivacyPolicyView })));
const ResetPasswordView = lazy(() => import('./views/ResetPasswordView').then((m) => ({ default: m.ResetPasswordView })));
const BuildKitView = lazy(() => import('./views/BuildKitView').then((m) => ({ default: m.BuildKitView })));

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
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
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
  const showSetupNotice = !hasSupabaseConfig;

  useEffect(() => {
    StorageService.startOfflineSyncListener();
  }, []);

  useEffect(() => {
    let active = true;
    const bootstrapSession = async () => {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      const isRecoveryPath = window.location.pathname.includes('reset-password');
      const isRecoveryHash = hash.includes('type=recovery') || search.includes('type=recovery') || hash.includes('reset-password');
      const isRecoveryUrl = isRecoveryPath || isRecoveryHash;
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        if (isRecoveryUrl) {
          setPostSplashView('RESET_PASSWORD');
          setView('RESET_PASSWORD');
        } else {
          setPostSplashView('LOGIN');
          setView('SPLASH');
        }
      } catch {
        if (!active) return;
        if (isRecoveryUrl) {
          setPostSplashView('RESET_PASSWORD');
          setView('RESET_PASSWORD');
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
          onPresentation={() => setView('PRESENTATION')}
          onFinance={handleFinanceFromSplash}
        />
      );
    }
    switch (currentView) {
      case 'SPLASH':
        return (
          <SplashView
            onEnter={handleSplashComplete}
            onPresentation={() => setView('PRESENTATION')}
            onFinance={handleFinanceFromSplash}
          />
        );
      case 'PRESENTATION':
        return <PresentationView setView={setView} />;
      case 'REGISTRATION':
        return <RegistrationView setView={setView} mode="REGISTRATION" />;
      case 'ACCOUNT_SETUP':
        return <RegistrationView setView={setView} mode="SETUP" />;
      case 'LOGIN':
        return <LoginView setView={setView} />;
      case 'RESET_PASSWORD':
        return <ResetPasswordView setView={setView} />;
      case 'BUILD_KIT':
        return <BuildKitView setView={setView} />;
      case 'DASHBOARD':
        return <DashboardView setView={setView} />;
      case 'HELP_WIZARD':
        return <HelpFormView setView={setView} />;
      case 'SETTINGS':
        return <SettingsView setView={setView} />;
      case 'MAP':
        return <MapView setView={setView} />;
      case 'ALERTS':
        return <DashboardView setView={setView} />;
      case 'GAP':
        return <GapView setView={setView} />;
      case 'ASSESSMENT':
        return <AssessmentView setView={setView} />;
      case 'POPULATION':
        return <PopulationView setView={setView} />;
      case 'RECOVERY':
        return <RecoveryView setView={setView} />;
      case 'DRONE':
        return <DroneView setView={setView} />;
      case 'LOGISTICS':
        return <LogisticsView setView={setView} />;
      case 'ORG_DASHBOARD':
        return <OrgDashboardView setView={setView} />;
      case 'PRIVACY_POLICY':
        return <PrivacyPolicyView setView={setView} />;
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
                  currentView !== 'ORG_DASHBOARD' &&
                  currentView !== 'PRIVACY_POLICY';

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 shadow-2xl relative overflow-hidden md:border-x md:border-slate-200 print:max-w-none print:w-full print:h-auto print:overflow-visible print:shadow-none print:border-0">
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
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
              <p className="text-sm font-medium text-slate-500">Loading…</p>
            </div>
          }
        >
          {renderView()}
        </Suspense>
      </ViewErrorBoundary>
      {!showNav && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center print:hidden">
          <button
            onClick={() => {
              sessionStorage.setItem('privacyReturnView', currentView);
              setView('PRIVACY_POLICY');
            }}
            className="text-[11px] text-slate-500 hover:text-slate-700 underline bg-white/80 px-3 py-1 rounded-full shadow-sm"
          >
            View Proof of Consent &amp; Privacy Policy
          </button>
        </div>
      )}
      {showNav && <BottomNav currentView={currentView} setView={setView} />}
    </div>
  );
}
