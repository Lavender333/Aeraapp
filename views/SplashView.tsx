
import React from 'react';
import { Button } from '../components/Button';
import splashLogo from '../Logo2.png';

interface SplashViewProps {
  onEnter: () => void;
  onPrivacy?: () => void;
}

export const SplashView: React.FC<SplashViewProps> = ({ onEnter, onPrivacy }) => {
  return (
    <div className="min-h-screen bg-[#F6F8F7] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-[420px] text-center flex flex-col items-center">
        <div className="aera-fade mb-8">
          <img src={splashLogo} alt="AERA logo" className="w-40 h-40 object-contain mx-auto" />
        </div>

        <div className="aera-fade aera-delay-1 space-y-2">
          <h1 className="text-[36px] leading-tight tracking-[-0.01em] font-semibold text-[#0B3D2E]">AERA</h1>
          <p className="text-[12px] tracking-[0.14em] uppercase font-medium text-[#355E54]">
            Accelerated Emergency Response
          </p>
        </div>

        <p className="aera-fade aera-delay-2 mt-6 text-[20px] leading-[1.35] tracking-[-0.01em] font-normal text-[#355E54]">
          Preparedness, organized.
        </p>

        <div className="aera-fade aera-delay-3 w-full mt-8 max-w-[320px]">
          <Button
            onClick={onEnter}
            size="xl"
            fullWidth
            className="h-[56px] rounded-xl bg-[#107A5D] hover:bg-[#0E6A52] text-white font-semibold text-[17px] leading-none tracking-[0.01em] shadow-[0_4px_10px_rgba(16,122,93,0.14)] focus:ring-[#107A5D]"
          >
            Continue
          </Button>

          <p className="mt-4 text-[12px] leading-snug text-[#4B5D58]">Not a substitute for 911</p>
          <button
            type="button"
            onClick={() => onPrivacy?.()}
            className="mt-2 text-[11px] text-[#355E54] underline underline-offset-2 hover:text-[#0B3D2E] focus:outline-none focus:ring-2 focus:ring-[#107A5D] focus:ring-offset-2 rounded"
          >
            Privacy &amp; Consent
          </button>
        </div>
      </div>
    </div>
  );
};
