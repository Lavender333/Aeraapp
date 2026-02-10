
import React, { useState, useEffect } from 'react';
import { ViewState, UserProfile, LanguageCode, HouseholdMember } from '../types';
import { Button } from '../components/Button';
import { Input, Textarea } from '../components/Input';
import { HouseholdManager } from '../components/HouseholdManager';
import { StorageService } from '../services/storage';
import { getOrganizationByCode, searchOrganizations, updateProfile } from '../services/api';
import { supabase } from '../services/supabase';
import { t } from '../services/translations';
import { User, Shield, Building2, Check, ArrowRight, Link as LinkIcon, Loader2, Lock, HeartPulse, XCircle, Search, MapPin, AlertTriangle, Globe, Map } from 'lucide-react';

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

interface RegistrationViewProps {
  setView: (v: ViewState) => void;
  mode?: 'REGISTRATION' | 'SETUP';
}

export const RegistrationView: React.FC<RegistrationViewProps> = ({ setView, mode = 'REGISTRATION' }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<UserProfile>({
    id: '', // Will be generated
    fullName: '',
    email: '',
    phone: '',
    address: '',
    householdMembers: 1,
    household: [],
    petDetails: '',
    medicalNeeds: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
    communityId: '',
    role: 'GENERAL_USER',
    language: 'en',
    active: true,
    onboardComplete: false,
    notifications: { push: true, sms: true, email: true }
  });

  const [isVerifying, setIsVerifying] = useState(false);
  const [connectedOrg, setConnectedOrg] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  
  // Validation States
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [addressStatus, setAddressStatus] = useState<'IDLE' | 'VERIFYING' | 'VALID' | 'INVALID'>('IDLE');
  const [addressFeedback, setAddressFeedback] = useState<string>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Org Search
  const [showOrgSearch, setShowOrgSearch] = useState(false);
  const [orgSearchTerm, setOrgSearchTerm] = useState('');
  const [foundOrgs, setFoundOrgs] = useState<any[]>([]);

  // Permission States
  const [locPermission, setLocPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [camPermission, setCamPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [locError, setLocError] = useState<string | null>(null);

  // Initialize language from storage if available
  useEffect(() => {
    const profile = StorageService.getProfile();
    if (profile.language) {
      setFormData(prev => ({ ...prev, language: profile.language }));
    }
    if (mode === 'SETUP' && profile.email) {
       setFormData(prev => ({
         ...prev,
         id: profile.id || prev.id,
         fullName: profile.fullName || prev.fullName,
         email: profile.email || prev.email,
         phone: profile.phone || prev.phone,
         communityId: profile.communityId || prev.communityId,
         role: profile.role || prev.role,
       }));
    }
    
    // Check permissions status
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        setLocPermission(result.state);
      });
    }
  }, []);

  const changeLanguage = (lang: LanguageCode) => {
    // Save to storage immediately so t() helper picks it up
    const currentProfile = StorageService.getProfile();
    StorageService.saveProfile({ ...currentProfile, language: lang });
    setFormData(prev => ({ ...prev, language: lang }));
  };

  const updateForm = (key: keyof UserProfile, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    // Reset specific validation states on change
    if (key === 'phone') setPhoneError(null);
    if (key === 'address') {
      const trimmed = String(value || '').trim();
      if (!trimmed) {
        setAddressStatus('IDLE');
        setAddressFeedback('');
      } else {
        setAddressStatus('VALID');
        setAddressFeedback('');
      }
    }
  };

  const validatePhone = (phone: string): boolean => {
    // Allows: (123) 456-7890, 123-456-7890, 1234567890, +1...
    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
    if (!phoneRegex.test(phone)) {
      setPhoneError("Please enter a valid mobile number (e.g., 555-123-4567)");
      return false;
    }
    return true;
  };


  const requestLocation = () => {
    setLocError(null);
    if (!window.isSecureContext) {
      setLocPermission('denied');
      setLocError('Location requires HTTPS. Please use the secure site URL.');
      return;
    }
    if (!navigator.geolocation) {
      setLocPermission('denied');
      setLocError('Location is not supported by this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocPermission('granted');
        setLocError(null);
      },
      (err) => {
        setLocPermission('denied');
        if (err?.code === 1) {
          setLocError('Location permission denied. Enable it in your browser settings.');
        } else {
          setLocError(err?.message || 'Unable to access location.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCamPermission('granted');
      // Stop immediately, we just wanted permission
      stream.getTracks().forEach(t => t.stop());
    } catch (e) {
      setCamPermission('denied');
    }
  };

  const handleNext = () => {
    if (step === 1) {
      const isPhoneValid = validatePhone(formData.phone);
      if (!isPhoneValid) return;

      if (!formData.address?.trim()) {
        setAddressStatus('INVALID');
        setAddressFeedback("Address is required.");
        return;
      }
    }
    setStep(prev => prev + 1);
  };

  const verifyCommunityId = async (idToVerify?: string) => {
    const id = idToVerify || formData.communityId;
    if (!id) return;
    
    setIsVerifying(true);
    setVerifyError(null);
    setConnectedOrg(null);
    try {
      const org = await getOrganizationByCode(id);
      setIsVerifying(false);
      if (org) {
        setConnectedOrg(org.orgName || org.orgCode);
        if (idToVerify) updateForm('communityId', idToVerify);
      } else {
        setVerifyError("Invalid Community ID. Please check with your institution.");
      }
    } catch (e) {
      setIsVerifying(false);
      setVerifyError("Unable to verify Community ID. Please try again.");
    }
  };
  
  const handleSearchOrgs = async () => {
    try {
      const results = await searchOrganizations(orgSearchTerm);
      setFoundOrgs(results as any[]);
    } catch (e) {
      setFoundOrgs([]);
    }
  };

  const handleAuthRegister = async () => {
    setAuthError(null);
    setAuthSuccess(null);
    if (!email || !password || !confirmPassword) {
      setAuthError('Email and password required.');
      return;
    }
    if (password !== confirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }
    try {
      setIsRegistering(true);
      const resp: any = await StorageService.registerWithCredentials(email, password, formData.fullName);
      if (resp?.needsEmailConfirm) {
        setNeedsEmailConfirm(true);
        setAuthSuccess('Check your email to confirm your account before continuing.');
        return;
      }
      setAuthSuccess('Account created. Continue with required setup.');
      setView('ACCOUNT_SETUP');
    } catch (e: any) {
      setAuthError(e?.message || 'Registration failed.');
    } finally {
      setIsRegistering(false);
    }
  };

  const selectOrg = (org: { org_code?: string; orgCode?: string; id?: string; name?: string }) => {
    const code = org?.org_code || org?.orgCode || org?.id || '';
    if (!code) return;
    updateForm('communityId', code);
    setConnectedOrg(org?.name || code);
    setVerifyError(null);
    setShowOrgSearch(false);
  };

  const handleComplete = async () => {
    // Save to our Backend
    const payload = { ...formData, onboardComplete: true };
    try {
      const currentProfile = StorageService.getProfile();
      const { data: authData } = await supabase.auth.getUser();
      const authId = authData?.user?.id || null;
      const profileId = authId || (payload.id && payload.id !== 'guest' ? payload.id : currentProfile.id);
      await updateProfile({
        id: profileId,
        email: payload.email,
        phone: payload.phone,
        fullName: payload.fullName,
        role: payload.role,
        communityId: payload.communityId,
      });
      StorageService.saveProfile({ ...payload, id: profileId });
      setView('DASHBOARD');
    } catch (e: any) {
      const currentProfile = StorageService.getProfile();
      const { data: authData } = await supabase.auth.getUser();
      const authId = authData?.user?.id || null;
      const profileId = authId || (payload.id && payload.id !== 'guest' ? payload.id : currentProfile.id);
      StorageService.saveProfile({ ...payload, id: profileId });
      setAuthError('Profile saved locally. Sync will resume when available.');
      setView('DASHBOARD');
    }
  };

  // If in REGISTRATION mode, show only credential page, then force SETUP
  if (mode === 'REGISTRATION') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col p-6 animate-fade-in pb-safe">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Create Account</p>
            <h1 className="text-3xl font-black text-slate-900">Email & Password</h1>
          </div>
          <Button variant="ghost" onClick={() => setView('LOGIN')} className="font-semibold text-brand-600">
            Have an account? Log in
          </Button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 max-w-lg w-full">
          <Input 
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input 
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input 
              label="Confirm Password"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button size="lg" onClick={handleAuthRegister} className="font-bold" disabled={isRegistering}>
            {isRegistering ? 'Creating…' : 'Create Account & Continue'}
          </Button>
          {authError && <p className="text-sm text-red-600">{authError}</p>}
          {authSuccess && <p className="text-sm text-emerald-600">{authSuccess}</p>}
          {needsEmailConfirm && (
            <Button variant="ghost" onClick={() => setView('LOGIN')} className="font-semibold text-brand-600">
              Go to Log In
            </Button>
          )}
          <p className="text-xs text-slate-500">You’ll complete required account setup next.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6 animate-fade-in pb-safe">
      
      {/* Header Progress & Language */}
      <div className="flex items-center justify-between mb-8 pt-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('reg.title')}</h1>
          {/* Language Toggle */}
          <div className="flex gap-2 mt-1">
            {['en', 'es', 'fr'].map((lang) => (
              <button
                key={lang}
                onClick={() => changeLanguage(lang as LanguageCode)}
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                  formData.language === lang 
                    ? 'bg-slate-800 text-white border-slate-800' 
                    : 'bg-white text-slate-500 border-slate-200'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map(i => (
            <div 
              key={i} 
              className={`h-2 w-8 rounded-full transition-colors ${i <= step ? 'bg-brand-600' : 'bg-slate-300'}`} 
            />
          ))}
        </div>
      </div>



      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
        
        {step === 1 && (
          <div className="space-y-6 animate-slide-up">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-700 border border-brand-200">
                <User size={32} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">{t('reg.personal')}</h2>
              <p className="text-slate-600 font-medium">{t('reg.personal_desc')}</p>
            </div>

            <div className="space-y-4">
              <Input 
                label="Full Name" 
                placeholder="Jane Doe"
                value={formData.fullName}
                onChange={(e) => updateForm('fullName', e.target.value)}
                className="text-slate-900 placeholder:text-slate-400 font-medium"
              />
              
              <Input 
                label="Mobile Phone" 
                placeholder="(555) 123-4567"
                type="tel"
                value={formData.phone}
                onChange={(e) => updateForm('phone', formatPhoneNumber(e.target.value))}
                onBlur={() => validatePhone(formData.phone)}
                className={`text-slate-900 placeholder:text-slate-400 font-medium ${phoneError ? 'border-red-500 bg-red-50' : ''}`}
                error={phoneError || undefined}
              />

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Home Address</label>
                <input 
                  placeholder="123 Main St, City, State, Zip"
                  value={formData.address}
                  onChange={(e) => updateForm('address', e.target.value)}
                  className={`w-full px-4 py-3 rounded-lg border focus:ring-2 outline-none transition-all font-medium ${
                    addressStatus === 'VALID' ? 'border-green-500 bg-green-50 focus:ring-green-500' :
                    addressStatus === 'INVALID' ? 'border-red-500 bg-red-50 focus:ring-red-500' :
                    'border-slate-300 focus:ring-brand-500 focus:border-brand-500'
                  }`}
                />
                {addressStatus === 'INVALID' && <p className="text-xs text-red-600 font-bold mt-1">{addressFeedback || "Address is required"}</p>}
              </div>

              <div className="border-t border-slate-200 pt-4">
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Emergency Contact</p>
                <div className="space-y-3">
                  <Input 
                    placeholder="Contact Name"
                    value={formData.emergencyContactName}
                    onChange={(e) => updateForm('emergencyContactName', e.target.value)}
                    className="text-slate-900 placeholder:text-slate-400 font-medium"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input 
                      placeholder="Mobile Phone"
                      type="tel"
                      value={formData.emergencyContactPhone}
                      onChange={(e) => updateForm('emergencyContactPhone', formatPhoneNumber(e.target.value))}
                      className="text-slate-900 placeholder:text-slate-400 font-medium"
                    />
                    <Input 
                      placeholder="Relationship"
                      value={formData.emergencyContactRelation}
                      onChange={(e) => updateForm('emergencyContactRelation', e.target.value)}
                      className="text-slate-900 placeholder:text-slate-400 font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 text-center">
              <p className="text-sm text-slate-500 mb-2">Already have an account?</p>
              <Button variant="ghost" onClick={() => setView('LOGIN')} className="text-brand-600 font-bold">
                 Log In Here
              </Button>
            </div>

            <Button 
              fullWidth 
              size="lg" 
              onClick={handleNext}
              disabled={!formData.fullName || !formData.phone || !formData.address?.trim()}
              className="mt-6 font-bold shadow-md"
            >
              Next Step
            </Button>
          </div>
        )}

        {step === 2 && (
           <div className="space-y-6 animate-slide-up">
             <div className="text-center mb-6">
               <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 border border-red-200">
                 <HeartPulse size={32} />
               </div>
               <h2 className="text-2xl font-bold text-slate-900">{t('reg.vital')}</h2>
               <p className="text-slate-600 font-medium">{t('reg.vital_desc')}</p>
             </div>

             <div className="space-y-4">
               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-2">Household Members</label>
                 <HouseholdManager 
                   members={formData.household}
                   onChange={(updated) => updateForm('household', updated)}
                 />
               </div>
               
               <Input 
                 label="Pets" 
                 placeholder="e.g. 2 Dogs"
                 value={formData.petDetails}
                 onChange={(e) => updateForm('petDetails', e.target.value)}
               />
               
               <Textarea 
                 label="Medical Needs / Disabilities"
                 placeholder="E.g. Insulin dependent, wheelchair user, oxygen tank..."
                 value={formData.medicalNeeds}
                 onChange={(e) => updateForm('medicalNeeds', e.target.value)}
                 className="min-h-[120px]"
               />
               <p className="text-xs text-slate-500 italic">This information is only shared with responders during an emergency.</p>
             </div>

             <div className="flex gap-3 mt-6">
               <Button variant="ghost" onClick={() => setStep(1)}>{t('btn.back')}</Button>
               <Button fullWidth onClick={handleNext} className="font-bold shadow-md">{t('btn.next')}</Button>
             </div>
           </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-slide-up">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-600 border border-purple-200">
                <Building2 size={32} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">{t('reg.community')}</h2>
              <p className="text-slate-600 font-medium">Link to a trusted institution for specialized aid. If you are part of a church, NGO, or local organization, enter your Community ID below.</p>
            </div>

            <div className="space-y-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              {!showOrgSearch ? (
                <>
                  <Input 
                    label="Community ID (Optional)" 
                    placeholder="e.g. CH-1234"
                    value={formData.communityId}
                    onChange={(e) => {
                      updateForm('communityId', e.target.value);
                      setConnectedOrg(null);
                      setVerifyError(null);
                    }}
                    className={connectedOrg ? "border-green-500 focus:ring-green-500 bg-green-50/30 font-mono text-center tracking-widest text-lg" : "text-center tracking-widest text-lg font-mono"}
                  />

                  {verifyError && (
                    <div className="flex items-center justify-center gap-2 text-red-600 text-sm font-bold bg-red-50 p-2 rounded-lg animate-fade-in border border-red-100">
                       <XCircle size={16} /> {verifyError}
                    </div>
                  )}

                  {connectedOrg && (
                    <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-xl flex items-center gap-3 animate-fade-in">
                       <Check className="shrink-0" />
                       <div>
                         <p className="text-xs font-bold uppercase text-green-600">Verified Member</p>
                         <p className="font-bold">{connectedOrg}</p>
                       </div>
                    </div>
                  )}

                  <Button 
                    variant={connectedOrg ? "secondary" : "primary"}
                    fullWidth 
                    onClick={() => verifyCommunityId()}
                    disabled={isVerifying || !formData.communityId || !!connectedOrg}
                    className={connectedOrg ? "bg-green-100 text-green-800 border-green-200" : "bg-purple-600 hover:bg-purple-700"}
                  >
                    {isVerifying ? <Loader2 className="animate-spin" /> : connectedOrg ? "Connected" : "Verify Code"}
                  </Button>
                  
                  <div className="text-center">
                    <button 
                      onClick={() => setShowOrgSearch(true)}
                      className="text-sm text-purple-600 font-bold hover:underline flex items-center justify-center gap-1 mx-auto"
                    >
                      <Search size={14} /> Search for Organization
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-2">
                     <Input 
                       placeholder="Search Org Name..."
                       value={orgSearchTerm}
                       onChange={(e) => setOrgSearchTerm(e.target.value)}
                       autoFocus
                     />
                     <Button onClick={handleSearchOrgs} className="px-3 bg-purple-600"><Search size={20} /></Button>
                  </div>
                  
                  <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-100 rounded-lg p-1">
                     {foundOrgs.map((org, idx) => (
                       <button 
                         key={idx}
                         onClick={() => selectOrg(org)}
                         className="w-full text-left p-3 hover:bg-purple-50 rounded border border-transparent hover:border-purple-100 transition-colors"
                       >
                         <div className="font-bold text-slate-800">{org.name}</div>
                         <div className="text-xs text-slate-500 flex items-center gap-1">
                           <MapPin size={10} /> {org.address || org.org_code}
                         </div>
                       </button>
                     ))}
                     {foundOrgs.length === 0 && (
                       <div className="text-center py-4 text-slate-400 text-sm">No organizations found</div>
                     )}
                  </div>
                  
                  <Button variant="ghost" size="sm" fullWidth onClick={() => setShowOrgSearch(false)}>Cancel Search</Button>
                </div>
              )}
            </div>
            
            <div className="pt-4 border-t border-slate-200">
               <p className="text-center text-sm text-slate-500 mb-3">Represent an institution?</p>
               <Button 
                 variant="outline" 
                 fullWidth 
                 onClick={() => setView('ORG_REGISTRATION')}
                 className="border-purple-200 text-purple-700 hover:bg-purple-50"
               >
                 Register Organization Hub <ArrowRight size={16} className="ml-2" />
               </Button>
            </div>

            <div className="flex gap-3 mt-6">
               <Button variant="ghost" onClick={() => setStep(2)}>{t('btn.back')}</Button>
               <Button fullWidth onClick={handleComplete} className="font-bold shadow-md">
                 {t('reg.complete')}
               </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
