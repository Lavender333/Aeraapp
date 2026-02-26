import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { UserProfile } from '../../types';
import { StorageService } from '../../services/storage';
import { presentationOrganizations, presentationProfiles } from './demoData';

type PresentationDemoContextValue = {
  setActiveDemoProfile: (profile: UserProfile) => void;
};

const PresentationDemoContext = createContext<PresentationDemoContextValue | null>(null);

export const usePresentationDemo = () => {
  const context = useContext(PresentationDemoContext);
  if (!context) {
    throw new Error('usePresentationDemo must be used inside PresentationDemoProvider');
  }
  return context;
};

export const PresentationDemoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const originalFetch = window.fetch.bind(window);
    const supabaseHost = String(import.meta.env.VITE_SUPABASE_URL || '');

    (window as any).__AERA_PRESENTATION_MODE__ = true;

    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;

      if (supabaseHost && requestUrl.includes(supabaseHost)) {
        return Promise.reject(new Error('Presentation mode uses isolated demo data only.'));
      }

      return originalFetch(input as any, init);
    }) as typeof window.fetch;

    const blockSubmit = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener('submit', blockSubmit, true);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.fetch = originalFetch;
      document.removeEventListener('submit', blockSubmit, true);
      delete (window as any).__AERA_PRESENTATION_MODE__;
    };
  }, []);

  useEffect(() => {
    StorageService.logoutUser();
    for (const org of presentationOrganizations) {
      StorageService.saveOrganization({ ...org });
    }
    StorageService.saveProfile({ ...presentationProfiles.member }, { skipRemoteSync: true });
  }, []);

  const value = useMemo<PresentationDemoContextValue>(() => ({
    setActiveDemoProfile: (profile: UserProfile) => {
      StorageService.saveProfile({ ...profile }, { skipRemoteSync: true });
    },
  }), []);

  return (
    <PresentationDemoContext.Provider value={value}>
      {children}
    </PresentationDemoContext.Provider>
  );
};
