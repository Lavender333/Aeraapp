
import React, { useState } from 'react';
import { ViewState } from '../types';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { StorageService } from '../services/storage';
import { t } from '../services/translations';
import { LogIn, ArrowLeft, User, ShieldCheck, HeartPulse, Navigation, Lock, AlertOctagon } from 'lucide-react';

// Phone Formatter Utility
const formatPhoneNumber = (value: string) => {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\d]/g, '');
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  }
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

export const LoginView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    setError('');
    const result = StorageService.loginUser(phone);
    if (result.success) {
      // Smart Routing based on Role
      const profile = StorageService.getProfile();
      if (profile.role === 'INSTITUTION_ADMIN') {
        setView('ORG_DASHBOARD');
      } else {
        setView('DASHBOARD');
      }
    } else {
      setError(result.message || 'Login failed.');
    }
  };

  const handleDemoLogin = (demoPhone: string) => {
    // We set the state and immediately trigger login logic to avoid double-click requirement
    setPhone(demoPhone);
    const result = StorageService.loginUser(demoPhone);
    
    if (!result.success) {
      setError(result.message || 'Demo Login Failed');
      return;
    }
    
    // Check role immediately for the direct action
    const profile = StorageService.getProfile(); 
    if (profile.role === 'INSTITUTION_ADMIN') {
      setView('ORG_DASHBOARD');
    } else {
      setView('DASHBOARD');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6 animate-fade-in pb-safe justify-center max-w-sm mx-auto w-full">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-700 border border-brand-200">
          <LogIn size={32} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{t('login.welcome')}</h1>
        <p className="text-slate-600 font-medium">{t('login.subtitle')}</p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
        <Input 
          label={t('login.phone_label')}
          placeholder="(555) 000-0000"
          value={phone}
          onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
          className="border-slate-300"
          error={error}
        />
        
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertOctagon size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button 
          fullWidth 
          size="lg" 
          onClick={handleLogin}
          className="font-bold shadow-md"
          disabled={!phone}
        >
          {t('login.btn')}
        </Button>
      </div>

      {/* Demo Credentials Helper */}
      <div className="mt-6 space-y-3">
        <p className="text-xs font-bold text-slate-400 uppercase text-center mb-2">{t('login.demo_title')}</p>
        
        <button onClick={() => handleDemoLogin('555-0000')} className="w-full p-3 bg-white border border-slate-200 rounded-lg flex items-center gap-3 hover:border-slate-900 hover:shadow-md transition-all group">
          <div className="bg-slate-900 p-2 rounded text-white group-hover:bg-black"><Lock size={16}/></div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-900">System Admin</p>
            <p className="text-xs text-slate-500">Full Access & Settings</p>
          </div>
        </button>

        <button onClick={() => handleDemoLogin('555-1001')} className="w-full p-3 bg-white border border-slate-200 rounded-lg flex items-center gap-3 hover:border-brand-400 transition-colors">
          <div className="bg-blue-100 p-2 rounded text-blue-600"><User size={16}/></div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-900">Alice (General User)</p>
            <p className="text-xs text-slate-500">Standard user flow</p>
          </div>
        </button>

        <button onClick={() => handleDemoLogin('555-1002')} className="w-full p-3 bg-white border border-slate-200 rounded-lg flex items-center gap-3 hover:border-red-400 transition-colors">
          <div className="bg-red-100 p-2 rounded text-red-600"><HeartPulse size={16}/></div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-900">David (High Risk)</p>
            <p className="text-xs text-slate-500">Medical needs intake</p>
          </div>
        </button>

        <button onClick={() => handleDemoLogin('555-0101')} className="w-full p-3 bg-white border border-slate-200 rounded-lg flex items-center gap-3 hover:border-purple-400 transition-colors">
          <div className="bg-purple-100 p-2 rounded text-purple-600"><ShieldCheck size={16}/></div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-900">Pastor John (Org Admin)</p>
            <p className="text-xs text-slate-500">Hub Dashboard access</p>
          </div>
        </button>

        <button onClick={() => handleDemoLogin('555-9111')} className="w-full p-3 bg-white border border-slate-200 rounded-lg flex items-center gap-3 hover:border-slate-800 transition-colors">
          <div className="bg-slate-800 p-2 rounded text-brand-400"><Navigation size={16}/></div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-900">Sarah (First Responder)</p>
            <p className="text-xs text-slate-500">Drone & Map access</p>
          </div>
        </button>
      </div>

      <div className="mt-8 text-center">
        <p className="text-slate-600">{t('login.no_account')}</p>
        <Button variant="ghost" onClick={() => setView('REGISTRATION')} className="text-brand-700 font-bold hover:bg-brand-50 mt-1">
          {t('login.create')}
        </Button>
      </div>
    </div>
  );
};
