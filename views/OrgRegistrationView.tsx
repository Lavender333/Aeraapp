
import React, { useState } from 'react';
import { ViewState, OrganizationProfile } from '../types';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { createOrganization } from '../services/api';
import { Building2, ArrowLeft, CheckCircle, ShieldCheck, ArrowRight, Truck, Mail, Phone } from 'lucide-react';

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

export const OrgRegistrationView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const [step, setStep] = useState(1);
  const [orgData, setOrgData] = useState<Partial<OrganizationProfile>>({
    name: '',
    type: 'CHURCH',
    address: '',
    adminContact: '',
    adminPhone: '',
    replenishmentProvider: '',
    replenishmentEmail: '',
    replenishmentPhone: ''
  });
  const [generatedId, setGeneratedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateForm = (key: keyof OrganizationProfile, value: string) => {
    setOrgData(prev => ({ ...prev, [key]: value }));
  };

  const handleRegister = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const created = await createOrganization({
        name: orgData.name || '',
        type: orgData.type || 'CHURCH',
        address: orgData.address || '',
        adminContact: orgData.adminContact || '',
        adminPhone: orgData.adminPhone || '',
        replenishmentEmail: orgData.replenishmentEmail || '',
        replenishmentPhone: orgData.replenishmentPhone || '',
      });
      setGeneratedId(created.org_code);
      setStep(3);
    } catch (e: any) {
      setError(e?.message || 'Organization registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6 animate-fade-in pb-safe">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => setView('REGISTRATION')} className="p-2 -ml-2 text-slate-500 hover:text-slate-900">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Institution Setup</h1>
        <div className="w-8" />
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
        
        {step === 1 && (
          <div className="space-y-6 animate-slide-up">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-700 border border-purple-200">
                <Building2 size={32} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Register Organization</h2>
              <p className="text-slate-600 font-medium">Create a hub for your community.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1.5">Organization Type</label>
                <select 
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 outline-none bg-white text-slate-900 font-medium"
                  value={orgData.type}
                  onChange={(e) => updateForm('type', e.target.value)}
                >
                  <option value="CHURCH">Faith-Based (Church, Mosque, etc.)</option>
                  <option value="NGO">Non-Profit / NGO</option>
                  <option value="COMMUNITY_CENTER">Community Center</option>
                  <option value="LOCAL_GOV">Local Government</option>
                </select>
              </div>

              <Input 
                label="Organization Name" 
                placeholder="e.g. Grace Community Church"
                value={orgData.name}
                onChange={(e) => updateForm('name', e.target.value)}
                className="text-slate-900 placeholder:text-slate-400 font-medium"
              />
              
              <Input 
                label="Physical Address" 
                placeholder="123 Main St, City, State"
                value={orgData.address}
                onChange={(e) => updateForm('address', e.target.value)}
                className="text-slate-900 placeholder:text-slate-400 font-medium"
              />
            </div>

            <Button 
              fullWidth 
              size="lg" 
              onClick={() => setStep(2)}
              disabled={!orgData.name || !orgData.address}
              className="mt-6 bg-purple-600 hover:bg-purple-700 font-bold"
            >
              Next Step
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-slide-up">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-700 border border-blue-200">
                <ShieldCheck size={32} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Operations Details</h2>
              <p className="text-slate-600 font-medium">Who manages this hub and fulfills requests?</p>
            </div>

            <div className="space-y-4">
              <Input 
                label="Administrator Name" 
                placeholder="e.g. Pastor John Smith"
                value={orgData.adminContact}
                onChange={(e) => updateForm('adminContact', e.target.value)}
                className="text-slate-900 font-medium"
              />
              
              <Input 
                label="Admin Phone" 
                placeholder="(555) 123-4567"
                type="tel"
                value={orgData.adminPhone}
                onChange={(e) => updateForm('adminPhone', formatPhoneNumber(e.target.value))}
                className="text-slate-900 font-medium"
              />

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm uppercase">
                  <Truck size={14} /> Replenishment Source
                </div>
                
                <Input 
                  label="Provider Name"
                  placeholder="e.g. FEMA Region 4, Diocese HQ"
                  value={orgData.replenishmentProvider}
                  onChange={(e) => updateForm('replenishmentProvider', e.target.value)}
                  className="bg-white text-slate-900 font-medium"
                />
                
                <Input 
                  label="Provider Email (For Requests)"
                  placeholder="supply@provider.org"
                  type="email"
                  value={orgData.replenishmentEmail}
                  onChange={(e) => updateForm('replenishmentEmail', e.target.value)}
                  className="bg-white text-slate-900 font-medium"
                />

                <Input 
                  label="Provider Phone (Optional)"
                  placeholder="(555) 999-9999"
                  type="tel"
                  value={orgData.replenishmentPhone}
                  onChange={(e) => updateForm('replenishmentPhone', formatPhoneNumber(e.target.value))}
                  className="bg-white text-slate-900 font-medium"
                />
                
                <p className="text-xs text-slate-600 font-medium">
                  We will email this contact when you submit a replenishment request.
                </p>
              </div>
            </div>

            <Button 
              fullWidth 
              size="lg" 
              onClick={handleRegister}
              disabled={!orgData.adminContact || !orgData.adminPhone || !orgData.replenishmentProvider || !orgData.replenishmentEmail}
              className="mt-6 bg-purple-600 hover:bg-purple-700 font-bold"
            >
              {isSubmitting ? 'Submitting...' : 'Generate Community ID'}
            </Button>
            {error && (
              <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-slide-up text-center">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 relative">
              <div className="absolute inset-0 rounded-full border-4 border-green-500/30 animate-ping"></div>
              <CheckCircle size={48} className="text-green-600 relative z-10" />
            </div>

            <h2 className="text-3xl font-extrabold text-slate-900">Registration Complete</h2>
            <p className="text-slate-600">Your organization is now a registered Hub on the AERA network.</p>

            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-6 my-6 shadow-sm">
              <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-2">Your Community ID</p>
              <div className="text-4xl font-mono font-black text-slate-900 tracking-widest">{generatedId}</div>
              <p className="text-sm text-slate-500 mt-2">Share this code with your members to link them to your dashboard.</p>
            </div>

            <Button 
              fullWidth 
              size="lg" 
              onClick={() => setView('ORG_DASHBOARD')}
              className="bg-purple-600 hover:bg-purple-700 font-bold shadow-lg shadow-purple-200"
            >
              Enter Org Dashboard <ArrowRight size={20} className="ml-2" />
            </Button>
          </div>
        )}

      </div>
    </div>
  );
};
