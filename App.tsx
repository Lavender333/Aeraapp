
import React, { useEffect, useState } from 'react';
import { SplashView } from './views/SplashView';
import { DashboardView } from './views/DashboardView';
import { HelpFormView } from './views/HelpFormView';
import { SettingsView } from './views/SettingsView';
import { MapView } from './views/MapView';
import { AlertsView } from './views/AlertsView';
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
import { BottomNav } from './components/BottomNav';
import { ViewState } from './types';
import { StorageService } from './services/storage';
import { hasSupabaseConfig, supabaseConfigMessage } from './services/supabase';

export default function App() {
  const [currentView, setView] = useState<ViewState>('SPLASH');
  const showSetupNotice = !hasSupabaseConfig;

  useEffect(() => {
    StorageService.startOfflineSyncListener();
  }, []);

  const handleSplashComplete = () => {
    // Check if user has a profile saved
    if (StorageService.hasProfile()) {
      const profile = StorageService.getProfile();
      // Smart Routing
      if (profile.onboardComplete) setView('DASHBOARD');
      else setView('ACCOUNT_SETUP');
    } else {
      setView('REGISTRATION');
    }
  };

  const handleFinanceFromSplash = () => {
    sessionStorage.setItem('openFinanceOnLoad', '1');
    setView('DASHBOARD');
    window.dispatchEvent(new Event('finance-open'));
  };

  const renderView = () => {
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
        return <AlertsView setView={setView} />;
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
                  currentView !== 'ORG_REGISTRATION' &&
                  currentView !== 'ORG_DASHBOARD';

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
      {showNav && <BottomNav currentView={currentView} setView={setView} />}
    </div>
  );
}
