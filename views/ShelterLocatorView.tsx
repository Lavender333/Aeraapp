import React from 'react';
import { ArrowLeft, ExternalLink, MapPin } from 'lucide-react';
import { ViewState } from '../types';

const SHELTER_LOCATOR_URL = 'https://www.redcross.org/get-help/disaster-relief-and-recovery-services/find-an-open-shelter.html?srsltid=AfmBOorv3dKWO5pfPruqLNig-etY2kHmX5pFl9sYh1EFHcS_bakK4COm';

export const ShelterLocatorView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const openOfficialLocator = () => {
    window.open(SHELTER_LOCATOR_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col pb-safe">
      <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-30 flex items-center gap-3">
        <button
          onClick={() => setView('DASHBOARD')}
          className="p-2 -ml-2 text-slate-500 hover:text-slate-800"
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="font-bold text-lg text-slate-900">Shelter Locator</h1>
          <p className="text-xs text-slate-500">Red Cross Shelters</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <div className="flex items-start gap-2 max-w-6xl mx-auto">
            <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-700 flex-shrink-0 mt-0.5">
              <MapPin size={16} />
            </div>
            <div className="flex-1 text-sm">
              <p className="font-semibold text-slate-900">Find Disaster Recovery Centers near you</p>
              <p className="text-slate-600 text-xs mt-0.5">
                Search by location, view hours, get directions, and find eligibility information
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 p-4 bg-slate-50 overflow-auto">
          <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm">
            <h2 className="text-base md:text-lg font-semibold text-slate-900">Open the Official Red Cross Locator</h2>
            <p className="text-sm text-slate-600 mt-2">
              For the most reliable experience, open the official American Red Cross shelter finder in a new browser tab.
            </p>

            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <span className="font-semibold">Disclaimer:</span> The American Red Cross is an independent humanitarian organization. AERA is not affiliated with, endorsed by, or connected to the American Red Cross or any of its programs. This link is provided solely for informational convenience.
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-[11px] uppercase font-bold text-slate-500 mb-2">Official Red Cross Tool</p>
                <button
                  onClick={openOfficialLocator}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-white text-sm font-semibold hover:bg-brand-700"
                >
                  <ExternalLink size={16} />
                  Open Red Cross Locator
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
