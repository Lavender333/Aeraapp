
import React from 'react';
import { Home, AlertCircle, Settings, CalendarCheck } from 'lucide-react';
import { ViewState } from '../types';
import { ESSENTIAL_NAV_ITEMS } from '../services/essentialAccess';

interface BottomNavProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentView, setView }) => {
  const icons: Record<(typeof ESSENTIAL_NAV_ITEMS)[number]['id'], React.ReactNode> = {
    DASHBOARD: <Home size={24} />,
    HELP_WIZARD: <AlertCircle size={24} />,
    EVENTS: <CalendarCheck size={24} />,
    SETTINGS: <Settings size={24} />,
  };

  return (
    <nav aria-label="Essential account navigation" className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe pt-2 px-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50 print:hidden">
      <div className="flex justify-between items-center max-w-md mx-auto pb-4">
        {ESSENTIAL_NAV_ITEMS.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              type="button"
              key={item.id}
              onClick={() => setView(item.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              className={`flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[48px] transition-colors ${
                isActive ? 'text-[#2F7A64]' : 'text-[#6B7280] hover:text-[#374151]'
              }`}
            >
              <div className="p-1">
                {icons[item.id]}
              </div>
              <span className="text-[10px] font-medium text-center">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
