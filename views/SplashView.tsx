
import React, { useState } from 'react';
import { Button } from '../components/Button';
import splashLogo from '../logo4.png';

interface SplashViewProps {
  onEnter: () => void;
  onOrganizationCode?: (code: string) => void;
  onPrivacy?: () => void;
  peopleRegisteredCount?: number;
}

export const SplashView: React.FC<SplashViewProps> = ({ onEnter, onOrganizationCode, onPrivacy, peopleRegisteredCount = 0 }) => {
  const [showCommunityCode, setShowCommunityCode] = useState(false);
  const [communityCode, setCommunityCode] = useState('');
  const [communityCodeError, setCommunityCodeError] = useState('');

  const normalizeCommunityCode = (value: string) => String(value || '')
    .toUpperCase()
    .replace(/[–—−]/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-+/g, '-');

  const continueWithCommunityCode = () => {
    const normalized = normalizeCommunityCode(communityCode).trim();
    if (!normalized) {
      setCommunityCodeError('Enter the community access code you received.');
      return;
    }
    setCommunityCodeError('');
    onOrganizationCode?.(normalized);
  };

  return (
    <div className="min-h-screen bg-[#F6F8F7] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-[420px] text-center flex flex-col items-center">
        <div className="aera-fade mb-8">
          <img src={splashLogo} alt="AERA logo" className="w-40 h-40 object-contain mx-auto" />
        </div>

        <div className="aera-fade aera-delay-1 space-y-2">
          <h1 className="text-[36px] leading-tight tracking-[-0.01em] font-semibold text-[#1F2937]">AERA</h1>
          <p className="text-[12px] tracking-[0.14em] uppercase font-medium text-[#4B5563]">
            Accelerated Emergency Response
          </p>
        </div>

        <p className="aera-fade aera-delay-2 mt-6 text-[20px] leading-[1.35] tracking-[-0.01em] font-normal text-[#4B5563]">
          Prepare with clarity.
        </p>

        <div className="aera-fade aera-delay-3 mt-5 px-4 py-2 rounded-full bg-white border border-[#D1D5DB]">
          <p className="text-[12px] uppercase tracking-[0.1em] text-[#4B5563]">People Registered</p>
          <p className="text-[24px] leading-none font-semibold text-[#1F2937]">{peopleRegisteredCount.toLocaleString()}</p>
        </div>

        <div className="aera-fade aera-delay-3 w-full mt-8 max-w-[320px]">
          <Button
            onClick={onEnter}
            size="xl"
            fullWidth
            className="h-[56px] rounded-xl bg-[#2F7A64] hover:bg-[#296A57] text-white font-semibold text-[17px] leading-none tracking-[0.01em] shadow-[0_6px_16px_rgba(47,122,100,0.10)] focus:ring-[#2F7A64]"
          >
            Continue
          </Button>
          <Button
            onClick={() => {
              setShowCommunityCode((current) => !current);
              setCommunityCodeError('');
            }}
            variant="outline"
            size="lg"
            fullWidth
            className="mt-3 h-[50px] rounded-xl border-[#2F7A64] text-[#2F7A64] font-semibold"
          >
            Enter Community Access Code
          </Button>
          {showCommunityCode && (
            <div className="mt-3 rounded-xl border border-[#B7D5CB] bg-white p-3 text-left">
              <label htmlFor="splash-community-code" className="block text-[12px] font-semibold text-[#374151]">
                Community access code
              </label>
              <input
                id="splash-community-code"
                type="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                value={communityCode}
                onChange={(event) => {
                  setCommunityCode(normalizeCommunityCode(event.target.value));
                  setCommunityCodeError('');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') continueWithCommunityCode();
                }}
                placeholder="Enter code"
                className="mt-2 w-full rounded-lg border border-[#9CA3AF] bg-white px-3 py-3 text-[16px] font-semibold uppercase tracking-wider text-[#1F2937] outline-none focus:border-[#2F7A64] focus:ring-2 focus:ring-[#B7D5CB]"
              />
              {communityCodeError && (
                <p role="alert" className="mt-2 text-[12px] font-semibold text-red-700">{communityCodeError}</p>
              )}
              <Button
                onClick={continueWithCommunityCode}
                size="lg"
                fullWidth
                disabled={!communityCode.trim()}
                className="mt-3 h-[48px] rounded-lg bg-[#2F7A64] hover:bg-[#296A57] text-white font-semibold"
              >
                Continue with Code
              </Button>
              <p className="mt-2 text-[11px] leading-snug text-[#6B7280]">
                You will sign in or create a verified account before the funded seat is activated.
              </p>
            </div>
          )}

          <p className="mt-4 text-[12px] leading-snug text-[#6B7280]">Not a substitute for 911</p>
          <button
            type="button"
            onClick={() => onPrivacy?.()}
            className="mt-2 text-[12px] text-[#6B7280] hover:underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-[#2F7A64] focus:ring-offset-2 rounded"
          >
            Privacy &amp; Consent
          </button>
        </div>
      </div>
    </div>
  );
};
