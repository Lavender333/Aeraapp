
import React from 'react';
import { Button } from '../components/Button';
import splashLogo from '../logo4.png';

interface SplashViewProps {
  onEnter: () => void;
  onPrivacy?: () => void;
  peopleServedCount?: number;
}

export const SplashView: React.FC<SplashViewProps> = ({ onEnter, onPrivacy, peopleServedCount = 0 }) => {
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
          <p className="text-[12px] uppercase tracking-[0.1em] text-[#4B5563]">People Served</p>
          <p className="text-[24px] leading-none font-semibold text-[#1F2937]">{peopleServedCount.toLocaleString()}</p>
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
