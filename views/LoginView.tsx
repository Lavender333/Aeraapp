
import React, { useEffect, useState } from 'react';
import { UserProfile, ViewState } from '../types';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { StorageService } from '../services/storage';
import { DEMO_COMMUNITY_QR_SEEDS, getPendingCommunityInvite } from '../services/communityInvite';
import { supabase } from '../services/supabase';
import { t } from '../services/translations';
import { LogIn, AlertOctagon, Mail, KeyRound, HelpCircle, FileDown } from 'lucide-react';

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
    // Defensive: fallback for missing or malformed profile
    const safeGetProfile = (): Partial<UserProfile> => {
      try {
        const profile = StorageService.getProfile();
        if (!profile || typeof profile !== 'object') return {};
        return profile;
      } catch (e) {
        return {};
      }
    };
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
  const [isDownloadingAbout, setIsDownloadingAbout] = useState(false);
  const [pendingCommunityId, setPendingCommunityId] = useState('');
  const pendingCommunityName = pendingCommunityId
    ? StorageService.getOrganization(pendingCommunityId)?.name || DEMO_COMMUNITY_QR_SEEDS.find((seed) => seed.communityId === pendingCommunityId)?.name || pendingCommunityId
    : '';

  const resolvePostLoginView = (role: string, onboardComplete: boolean): ViewState => {
    const requestedView = sessionStorage.getItem('postLoginView');
    if (requestedView === 'BUYER_PORTAL' && ['ADMIN', 'BUYER'].includes(role) && onboardComplete) {
      sessionStorage.removeItem('postLoginView');
      return 'BUYER_PORTAL';
    }
    if (requestedView === 'LEAD_INTAKE' && ['ADMIN', 'ORG_ADMIN'].includes(role) && onboardComplete) {
      sessionStorage.removeItem('postLoginView');
      return 'LEAD_INTAKE';
    }
    if (requestedView === 'LEAD_ADMIN' && role === 'ADMIN' && onboardComplete) {
      sessionStorage.removeItem('postLoginView');
      return 'LEAD_ADMIN';
    }
    sessionStorage.removeItem('postLoginView');
    if (!onboardComplete) return 'ACCOUNT_SETUP';
    if (role === 'BUYER') return 'BUYER_PORTAL';
    if (role === 'INSTITUTION_ADMIN' || role === 'ORG_ADMIN') return 'ORG_DASHBOARD';
    return 'DASHBOARD';
  };

  useEffect(() => {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const isRecoveryFlow = hash.includes('type=recovery') || search.includes('type=recovery');
    if (isRecoveryFlow) {
      setIsRecovery(true);
      setShowReset(true);
      setInfo('Enter a new password to finish resetting your account.');
    }
    const pendingInvite = getPendingCommunityInvite();
    if (pendingInvite?.communityId) {
      setPendingCommunityId(pendingInvite.communityId);
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
      let profile: Partial<UserProfile> = safeGetProfile();
      const pendingInvite = getPendingCommunityInvite();
      if (pendingInvite?.communityId && !String((profile as any)?.communityId || '').trim()) {
        const updatedProfile = { ...profile, communityId: pendingInvite.communityId };
        StorageService.saveProfile(updatedProfile as any);
        profile = updatedProfile;
      }
      // Defensive: fallback values for missing fields
      const id = profile.id || '';
      const name = profile.fullName || '';
      const role = profile.role || 'GENERAL_USER';
      const onboardComplete = profile.onboardComplete || false;
      console.log('Login successful! Profile:', { 
        id, 
        name, 
        role, 
        onboardComplete 
      });
      const nextView = resolvePostLoginView(String(role || '').toUpperCase(), Boolean(onboardComplete));
      console.log('Redirecting to', nextView);
      if (nextView === 'DASHBOARD') {
        sessionStorage.setItem('showCommunityConnectPromptOnLogin', '1');
      }
      setView(nextView);
    } catch (e: any) {
      console.error('Login error:', e);
      const message = String(e?.message || 'Login failed.');
      if (message.toLowerCase().includes('email not confirmed')) {
        setError('Please verify your email first, then log in to continue setup.');
      } else {
        setError(message);
      }
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
    const result = (StorageService as unknown as { loginUser: (phone: string) => { success?: boolean; message?: string } }).loginUser(demoPhone);
    
    if (!result.success) {
      console.error('Demo login failed:', result.message);
      setError(result.message || 'Demo Login Failed');
      return;
    }
    
    // Defensive: fallback for missing or malformed profile
    let profile: Partial<UserProfile> = safeGetProfile();
    const pendingInvite = getPendingCommunityInvite();
    if (pendingInvite?.communityId && !String((profile as any)?.communityId || '').trim()) {
      const updatedProfile = { ...profile, communityId: pendingInvite.communityId };
      StorageService.saveProfile(updatedProfile as any);
      profile = updatedProfile;
    }
    const id = profile.id || '';
    const name = profile.fullName || '';
    const role = profile.role || 'GENERAL_USER';
    const onboardComplete = profile.onboardComplete || false;
    console.log('Demo login successful! Profile:', { 
      id, 
      name, 
      role, 
      onboardComplete 
    });
    const nextView = resolvePostLoginView(String(role || '').toUpperCase(), Boolean(onboardComplete));
    console.log('Redirecting to', nextView);
    if (nextView === 'DASHBOARD') {
      sessionStorage.setItem('showCommunityConnectPromptOnLogin', '1');
    }
    setView(nextView);
  };

  const handleAboutAeraDownload = async () => {
    setError('');
    setInfo('');
    try {
      setIsDownloadingAbout(true);
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 54;
      const contentWidth = pageWidth - margin * 2;

      const drawParagraph = (text: string, y: number, fontSize = 11, lineHeight = 16) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(text, contentWidth);
        doc.text(lines, margin, y);
        return y + lines.length * lineHeight;
      };

      let y = 64;
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 120, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      doc.text('About AERA', margin, y);
      y += 28;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('Accelerated Emergency Response Application', margin, y);

      doc.setTextColor(15, 23, 42);
      y = 156;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('What AERA Does', margin, y);
      y += 24;

      y = drawParagraph(
        'AERA is a mobile-first emergency coordination platform that helps households, trusted organizations, responders, and public leaders prepare, communicate, respond, and recover faster during disasters.',
        y,
      );
      y += 10;
      y = drawParagraph(
        'It connects people in need, community organizations, and decision-makers through role-based operations, structured intake, offline resilience, and real-time coordination in one platform.',
        y,
      );

      const sections = [
        {
          title: 'Core Capabilities',
          bullets: [
            'Household readiness, emergency contacts, and vulnerability tracking.',
            'Organization dashboards for member status, inventory, and broadcasts.',
            'Population tracking, alerts, and geographic risk overlays for operations teams.',
            'Assessments, recovery workflows, and G.A.P. support intake for documented need.',
          ],
        },
        {
          title: 'Why It Matters',
          bullets: [
            'Reduces confusion with role-specific views for residents, org leaders, and responders.',
            'Uses trusted community structures such as churches, nonprofits, and local institutions.',
            'Improves coordination speed before, during, and after incidents.',
            'Supports broader reach through scalable community-code and parent-child org networks.',
          ],
        },
        {
          title: 'Who Uses It',
          bullets: [
            'Households and residents preparing for emergencies.',
            'Churches, NGOs, community hubs, and institution administrators.',
            'Emergency managers, first responders, and public-sector operations teams.',
          ],
        },
      ];

      for (const section of sections) {
        if (y > pageHeight - 120) {
          doc.addPage();
          y = 64;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(section.title, margin, y);
        y += 18;

        for (const bullet of section.bullets) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);
          const lines = doc.splitTextToSize(`• ${bullet}`, contentWidth - 12);
          doc.text(lines, margin + 8, y);
          y += lines.length * 16 + 4;
        }
        y += 10;
      }

      if (y > pageHeight - 96) {
        doc.addPage();
        y = 64;
      }

      doc.setDrawColor(203, 213, 225);
      doc.line(margin, y, pageWidth - margin, y);
      y += 22;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.text('Prepared from the current AERA product overview.', margin, y);

      doc.save('About-AERA.pdf');
    } catch (downloadError) {
      console.error('About AERA PDF export failed', downloadError);
      setError('Unable to download the About Aera PDF right now.');
    } finally {
      setIsDownloadingAbout(false);
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
        {pendingCommunityId && (
          <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-200">
            <HelpCircle size={16} className="mt-0.5 shrink-0" />
            <span>You are joining {pendingCommunityName}. This link will connect your account to Community ID {pendingCommunityId} after sign in or signup.</span>
          </div>
        )}
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
        <Button
          fullWidth
          variant="secondary"
          size="sm"
          onClick={handleAboutAeraDownload}
          disabled={isDownloadingAbout}
        >
          <FileDown size={16} className="mr-2" /> {isDownloadingAbout ? 'Preparing PDF…' : 'About Aera'}
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
