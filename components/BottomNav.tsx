
import React from 'react';
import { Home, AlertCircle, Settings } from 'lucide-react';
import { ViewState } from '../types';

interface BottomNavProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentView, setView }) => {
  const navItems = [
    { id: 'DASHBOARD' as ViewState, icon: <Home size={24} />, label: 'Home' },
    { id: 'HELP_WIZARD' as ViewState, icon: <AlertCircle size={24} />, label: 'Report' },
    { id: 'SETTINGS' as ViewState, icon: <Settings size={24} />, label: 'Settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe pt-2 px-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50 print:hidden">
      <div className="flex justify-between items-center max-w-md mx-auto pb-4">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              className={`flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[48px] transition-colors ${
                isActive ? 'text-[#2F7A64]' : 'text-[#6B7280] hover:text-[#374151]'
              }`}
            >
              <div className="p-1">
                {item.icon}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
