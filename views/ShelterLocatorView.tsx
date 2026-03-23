import React, { useState } from 'react';
import { ArrowLeft, ExternalLink, MapPin } from 'lucide-react';
import { ViewState } from '../types';

const SHELTER_LOCATOR_URL = 'https://egateway.fema.gov/ESF6/DRCLocator';

export const ShelterLocatorView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const [showEmbedAttempt, setShowEmbedAttempt] = useState(false);

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
          <p className="text-xs text-slate-500">FEMA Disaster Recovery Centers</p>
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
            <h2 className="text-base md:text-lg font-semibold text-slate-900">Open the Official FEMA Locator</h2>
            <p className="text-sm text-slate-600 mt-2">
              FEMA often blocks in-app embedding for security. For the most reliable experience, open the official
              Disaster Recovery Center locator in a new browser tab.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={openOfficialLocator}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-white text-sm font-semibold hover:bg-brand-700"
              >
                <ExternalLink size={16} />
                Open FEMA Locator
              </button>

              <a
                href={SHELTER_LOCATOR_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-slate-700 text-sm font-medium hover:bg-slate-100"
              >
                Open Direct Link
              </a>

              <button
                onClick={() => setView('MAP')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-slate-700 text-sm font-medium hover:bg-slate-100"
              >
                Use Map Assistant Instead
              </button>
            </div>

            <button
              onClick={() => setShowEmbedAttempt((prev) => !prev)}
              className="mt-4 text-xs text-slate-500 underline underline-offset-2 hover:text-slate-700"
            >
              {showEmbedAttempt ? 'Hide embedded attempt' : 'Try embedded view anyway'}
            </button>

            {showEmbedAttempt && (
              <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden h-[65vh] bg-white">
                <iframe
                  src={SHELTER_LOCATOR_URL}
                  title="FEMA Shelter Locator"
                  className="h-full w-full border-0"
                  allow="geolocation"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
