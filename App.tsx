
import React, { useState } from 'react';
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

export default function App() {
  const [currentView, setView] = useState<ViewState>('SPLASH');

  const handleSplashComplete = () => {
    // Check if user has a profile saved
    if (StorageService.hasProfile()) {
      const profile = StorageService.getProfile();
      // Smart Routing
      if (profile.role === 'INSTITUTION_ADMIN') {
        setView('ORG_DASHBOARD');
      } else {
        setView('DASHBOARD');
      }
    } else {
      setView('REGISTRATION');
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'SPLASH':
        return <SplashView onEnter={handleSplashComplete} onPresentation={() => setView('PRESENTATION')} />;
      case 'PRESENTATION':
        return <PresentationView setView={setView} />;
      case 'REGISTRATION':
        return <RegistrationView setView={setView} />;
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
                  currentView !== 'LOGIN' && 
                  currentView !== 'ORG_REGISTRATION' &&
                  currentView !== 'ORG_DASHBOARD';

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 shadow-2xl relative overflow-hidden md:border-x md:border-slate-200 print:max-w-none print:w-full print:h-auto print:overflow-visible print:shadow-none print:border-0">
      {renderView()}
      {showNav && <BottomNav currentView={currentView} setView={setView} />}
    </div>
  );
}
