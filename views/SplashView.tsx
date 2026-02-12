
import React, { useState, useEffect } from 'react';
import { Button } from '../components/Button';
import { ShieldAlert, Globe, Presentation } from 'lucide-react';
import { t, LanguageCode } from '../services/translations';
import { StorageService } from '../services/storage';

interface SplashViewProps {
  onEnter: () => void;
  onPresentation?: () => void; // Optional if not passed by App yet
  onFinance?: () => void;
}

// NOTE: We need to update the prop signature in App.tsx to pass the presentation handler
export const SplashView: React.FC<SplashViewProps & { onPresentation?: () => void; onFinance?: () => void }> = ({ onEnter, onPresentation, onFinance }) => {
  const profile = StorageService.getProfile();
  const isAdmin = ['ADMIN', 'STATE_ADMIN', 'COUNTY_ADMIN', 'ORG_ADMIN', 'INSTITUTION_ADMIN'].includes(String(profile?.role || '').toUpperCase());
  const [lang, setLang] = useState<LanguageCode>('en');

  useEffect(() => {
    const loaded = StorageService.getProfile().language || 'en';
    setLang(loaded);
  }, []);

  const changeLanguage = (l: LanguageCode) => {
    const profile = StorageService.getProfile();
    StorageService.saveProfile({ ...profile, language: l });
    setLang(l);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-teal-100 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
      
      {/* Abstract Background Shapes */}
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-brand-200/30 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-blue-200/30 rounded-full blur-3xl animate-pulse delay-700" />

      {/* Language Selector */}
      <div className="absolute top-6 right-6 z-20 flex gap-2 bg-white/50 backdrop-blur-sm p-1 rounded-lg shadow-sm border border-white/50">
         {(['en', 'es', 'fr'] as LanguageCode[]).map(l => (
           <button
             key={l}
             onClick={() => changeLanguage(l)}
             className={`px-3 py-1 rounded-md text-xs font-bold uppercase transition-colors ${
               lang === l ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white/50'
             }`}
           >
             {l}
           </button>
         ))}
      </div>

      <div className="relative z-10 flex flex-col items-center animate-fade-in space-y-8 max-w-sm w-full">
        
        <div className="bg-white p-6 rounded-3xl shadow-xl shadow-brand-500/10 mb-4 animate-slide-up">
          <ShieldAlert size={64} className="text-brand-600" />
        </div>

        <div className="space-y-2 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight">AERA</h1>
          <p className="text-slate-600 font-medium tracking-wide text-xs uppercase opacity-80">
            Accelerated Emergency Response
          </p>
        </div>

        <div className="space-y-1 text-slate-700 text-sm font-medium animate-slide-up whitespace-pre-wrap" style={{ animationDelay: '200ms' }}>
          <p>{t('splash.motto').split('•').slice(0,2).join(' • ')}</p>
          <p>{t('splash.motto').split('•').slice(2).join(' • ')}</p>
        </div>

        <p className="text-slate-500 text-base leading-relaxed animate-slide-up" style={{ animationDelay: '300ms' }}>
          {t('splash.desc')}
        </p>

        <div className="w-full pt-4 animate-slide-up space-y-3" style={{ animationDelay: '400ms' }}>
          <Button 
            onClick={onEnter} 
            size="xl" 
            fullWidth 
            className="shadow-lg shadow-brand-500/30 font-bold tracking-wide"
          >
            {t('splash.enter')}
          </Button>
          
          {onPresentation && isAdmin && (
            <Button
              onClick={onPresentation}
              variant="secondary"
              fullWidth 
              className="bg-white/60 hover:bg-white border-white/50 text-slate-600 font-semibold"
            >
              <Presentation size={18} className="mr-2" /> View Presentation
            </Button>
          )}
          {onFinance && isAdmin && (
            <Button 
              onClick={onFinance} 
              variant="outline"
              fullWidth 
              className="border-slate-300 text-slate-700 font-semibold"
            >
              <Presentation size={18} className="mr-2" /> Financial Dashboard
            </Button>
          )}

          <p className="mt-4 text-xs text-slate-400">{t('splash.disclaimer')}</p>
        </div>
      </div>
    </div>
  );
};
