import React from 'react';
import { ArrowLeft, MapPin } from 'lucide-react';
import { ViewState } from '../types';

const SHELTER_LOCATOR_URL = 'https://egateway.fema.gov/ESF6/DRCLocator';

export const ShelterLocatorView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
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

        <iframe
          src={SHELTER_LOCATOR_URL}
          title="FEMA Shelter Locator"
          className="flex-1 w-full border-0"
          allow="geolocation"
        />
      </div>
    </div>
  );
};
