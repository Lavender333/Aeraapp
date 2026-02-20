
import React, { useEffect, useState } from 'react';
import { ViewState } from '../types';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { StorageService } from '../services/storage';
import { supabase } from '../services/supabase';
import { t } from '../services/translations';
import { LogIn, AlertOctagon, Mail, KeyRound, HelpCircle } from 'lucide-react';

const IS_PRODUCTION = import.meta.env.PROD;

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const isRecoveryFlow = hash.includes('type=recovery') || search.includes('type=recovery');
    if (isRecoveryFlow) {
      setIsRecovery(true);
      setShowReset(true);
      setInfo('Enter a new password to finish resetting your account.');
    }
  }, []);

  const handleLogin = async () => {
    setError('');
    setInfo('');
    try {
      setIsLoggingIn(true);
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const enteredPassword = String(password || '');
      if (!normalizedEmail || !enteredPassword) {
        setError('Email and password are required.');
        return;
      }
      console.log('Attempting login with email:', normalizedEmail);
      await StorageService.loginWithCredentials(normalizedEmail, enteredPassword);
      const profile = StorageService.getProfile();
      console.log('Login successful! Profile:', { 
        id: profile.id, 
        name: profile.fullName, 
        role: profile.role, 
        onboardComplete: profile.onboardComplete 
      });
      console.log('Redirecting to DASHBOARD');
      setView('DASHBOARD');
    } catch (e: any) {
      console.error('Login error:', e);
      setError(e?.message || 'Login failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDemoLogin = (demoPhone: string) => {
    if (IS_PRODUCTION) {
      setError('Demo login is disabled in production.');
      return;
    }
    // We set the state and immediately trigger login logic to avoid double-click requirement
    setPhone(demoPhone);
    console.log('Demo login with phone:', demoPhone);
    const result = StorageService.loginUser(demoPhone);
    
    if (!result.success) {
      console.error('Demo login failed:', result.message);
      setError(result.message || 'Demo Login Failed');
      return;
    }
    
    // Check role immediately for the direct action
    const profile = StorageService.getProfile();
    console.log('Demo login successful! Profile:', { 
      id: profile.id, 
      name: profile.fullName, 
      role: profile.role, 
      onboardComplete: profile.onboardComplete 
    });
    const needsSetup = !profile.onboardComplete;
    
    if (needsSetup) {
      console.log('User needs setup, redirecting to ACCOUNT_SETUP');
      setView('ACCOUNT_SETUP');
    }
    else if (profile.role === 'INSTITUTION_ADMIN' || profile.role === 'ORG_ADMIN') {
      console.log('Organization admin, redirecting to ORG_DASHBOARD');
      setView('ORG_DASHBOARD');
    }
    else {
      console.log('Regular user, redirecting to DASHBOARD');
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

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-700 uppercase">Email Login</h2>
        <Input 
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border-slate-300"
          leftIcon={<Mail size={16} />}
        />
        <Input
          label="Password"
          type="password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border-slate-300"
          leftIcon={<KeyRound size={16} />}
        />
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertOctagon size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {info && (
          <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg">
            <HelpCircle size={16} className="mt-0.5 shrink-0" />
            <span>{info}</span>
          </div>
        )}
        <Button 
          fullWidth 
          size="lg" 
          onClick={handleLogin}
          className="font-bold shadow-md"
          disabled={!email || !password || isLoggingIn}
        >
          {isLoggingIn ? 'Signing in…' : t('login.btn')}
        </Button>
        <button className="text-sm text-brand-600 font-semibold underline" onClick={() => setShowReset(!showReset)}>
          Forgot password?
        </button>
        {showReset && (
          <div className="space-y-3 border border-slate-200 rounded-lg p-3 bg-slate-50">
            {isRecovery ? (
              <>
                <Input
                  label="New Password"
                  type="password"
                  placeholder="New password"
                  value={recoveryPassword}
                  onChange={(e) => setRecoveryPassword(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={async () => {
                    setError('');
                    setInfo('');
                    try {
                      setIsResetting(true);
                      const { error: updateError } = await supabase.auth.updateUser({ password: recoveryPassword });
                      if (updateError) throw updateError;
                      setInfo('Password updated. You can log in now.');
                      setIsRecovery(false);
                      setShowReset(false);
                      setRecoveryPassword('');
                      await supabase.auth.signOut({ scope: 'local' });
                      window.history.replaceState({}, document.title, window.location.pathname);
                    } catch (e: any) {
                      setError(e?.message || 'Password reset failed');
                    } finally {
                      setIsResetting(false);
                    }
                  }}
                  disabled={!recoveryPassword}
                >
                  {isResetting ? 'Saving…' : 'Set new password'}
                </Button>
              </>
            ) : (
              <>
                <Input 
                  label="Email for reset"
                  placeholder="you@example.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                />
                <Button 
                  size="sm"
                  onClick={async () => {
                    setError('');
                    setInfo('');
                    try {
                      setIsResetting(true);
                      const normalizedResetEmail = String(resetEmail || '').trim().toLowerCase();
                      await StorageService.requestPasswordReset(normalizedResetEmail);
                      setInfo('Check your email to reset your password.');
                    } catch (e: any) {
                      const message = String(e?.message || '').toLowerCase();
                      if (message.includes('rate') && message.includes('limit')) {
                        setError('Too many reset requests. Please wait a few minutes and try again.');
                      } else {
                        setError(e?.message || 'Reset request failed');
                      }
                    } finally {
                      setIsResetting(false);
                    }
                  }}
                  disabled={!resetEmail || isResetting}
                >
                  {isResetting ? 'Sending…' : 'Send reset email'}
                </Button>
              </>
            )}
          </div>
        )}
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
