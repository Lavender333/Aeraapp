import React from 'react';
import { ArrowLeft, ExternalLink, MapPin } from 'lucide-react';
import { ViewState } from '../types';
import { Button } from '../components/Button';

const SHELTER_LOCATOR_URL = 'https://egateway.fema.gov/ESF6/DRCLocator';
const SHELTER_LOCATOR_PREVIEW_IMAGE = 'https://disasterresponse.maps.arcgis.com/sharing/rest/content/items/a5da083275bb4bc7bfb7c032891a9d6e/resources/inConfig/6892968846091456.png';

export const ShelterLocatorView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-safe animate-fade-in">
      <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('DASHBOARD')}
            className="p-2 -ml-2 text-slate-500 hover:text-slate-800"
            aria-label="Back to dashboard"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="font-bold text-lg text-slate-900">Shelter Locator</h1>
            <p className="text-xs text-slate-500">Find open shelter options near your area.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <img
              src={SHELTER_LOCATOR_PREVIEW_IMAGE}
              alt="Shelter Locator"
              className="w-full h-auto max-h-[240px] object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200">
              <div className="inline-flex items-center gap-2 text-slate-700 text-sm font-semibold">
                <MapPin size={16} className="text-emerald-600" />
                Live Shelter Map
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(SHELTER_LOCATOR_URL, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink size={14} className="mr-1" />
                Open Full Screen
              </Button>
            </div>
            <div className="h-[70vh] min-h-[420px]">
              <iframe
                title="Shelter Locator"
                src={SHELTER_LOCATOR_URL}
                className="w-full h-full"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
