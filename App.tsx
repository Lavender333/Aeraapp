
import React, { useEffect, useState } from 'react';
import { SplashView } from './views/SplashView';
import { DashboardView } from './views/DashboardView';
import { HelpFormView } from './views/HelpFormView';
import { SettingsView } from './views/SettingsView';
import { MapView } from './views/MapView';
import { GapView } from './views/GapView';
import { AssessmentView } from './views/AssessmentView';
import { PopulationView } from './views/PopulationView';
import { RecoveryView } from './views/RecoveryView';
import { DroneView } from './views/DroneView';
import { LogisticsView } from './views/LogisticsView';
import { RegistrationView } from './views/RegistrationView';
import { OrgDashboardView } from './views/OrgDashboardView';
import { OrgRegistrationView } from './views/OrgRegistrationView';
import { LoginView } from './views/LoginView';
import { PresentationView } from './views/PresentationView';
import { PrivacyPolicyView } from './views/PrivacyPolicyView';
import { ResetPasswordView } from './views/ResetPasswordView';
import { BottomNav } from './components/BottomNav';
import { ViewState } from './types';
import { StorageService } from './services/storage';
import { hasSupabaseConfig, supabaseConfigMessage, supabase } from './services/supabase';

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
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        const isRecoveryPath = window.location.pathname.includes('reset-password');
        const isRecoveryHash = (window.location.hash || '').includes('type=recovery') || (window.location.search || '').includes('type=recovery');
        if (isRecoveryPath || isRecoveryHash) {
          setPostSplashView('RESET_PASSWORD');
        } else {
          setPostSplashView('LOGIN');
        }
        setView('SPLASH');
      } catch {
        if (active) setView('SPLASH');
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
      case 'ORG_REGISTRATION':
        return <OrgRegistrationView setView={setView} />;
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
                  currentView !== 'ORG_REGISTRATION' &&
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
      {renderView()}
      <div
        className={`fixed inset-x-0 ${showNav ? 'bottom-16' : 'bottom-4'} z-40 flex justify-center print:hidden`}
      >
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
      {showNav && <BottomNav currentView={currentView} setView={setView} />}
    </div>
  );
}
