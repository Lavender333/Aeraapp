
import React, { useState } from 'react';
import { ViewState } from '../types';
import { ArrowLeft, Layers, Users, Map as MapIcon, List } from 'lucide-react';

export const PopulationView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const [viewMode, setViewMode] = useState<'MAP' | 'LIST'>('MAP');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-safe animate-fade-in">
      <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('DASHBOARD')} className="p-2 -ml-2 text-slate-500 hover:text-slate-800">
              <ArrowLeft size={24} />
            </button>
            <h1 className="font-bold text-lg text-slate-900">Population Tracker</h1>
          </div>
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button 
              onClick={() => setViewMode('MAP')}
              className={`p-2 rounded ${viewMode === 'MAP' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
            >
              <MapIcon size={18} />
            </button>
            <button 
              onClick={() => setViewMode('LIST')}
              className={`p-2 rounded ${viewMode === 'LIST' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
            >
              <List size={18} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
           <span className="px-3 py-1 bg-slate-800 text-white rounded-full text-xs font-medium whitespace-nowrap">All Zones</span>
           <span className="px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded-full text-xs font-medium whitespace-nowrap">Elderly</span>
           <span className="px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded-full text-xs font-medium whitespace-nowrap">Medical Needs</span>
           <span className="px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded-full text-xs font-medium whitespace-nowrap">Evacuated</span>
        </div>
      </div>

      <div className="flex-1 relative">
        {viewMode === 'MAP' ? (
          <div className="absolute inset-0 bg-slate-200">
            {/* Mock Map */}
            <div className="w-full h-full opacity-60 bg-[url('https://picsum.photos/800/1200')] bg-cover bg-center grayscale" />
            
            {/* Heatmap Overlays */}
            <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-red-500/30 rounded-full blur-xl" />
            <div className="absolute bottom-1/3 right-1/4 w-40 h-40 bg-orange-500/30 rounded-full blur-xl" />
            
            <div className="absolute bottom-8 left-4 right-4 bg-white/90 backdrop-blur p-4 rounded-xl shadow-lg border border-slate-200">
               <div className="flex justify-between items-end">
                 <div>
                   <p className="text-xs font-bold text-slate-500 uppercase">Zone Status</p>
                   <p className="text-lg font-bold text-slate-900">High Density Evacuation</p>
                   <p className="text-sm text-slate-600">Sector 7 • Updated 2m ago</p>
                 </div>
                 <Layers className="text-slate-400" />
               </div>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
             {[1, 2, 3, 4].map(i => (
               <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                     <Users size={20} />
                   </div>
                   <div>
                     <p className="font-bold text-slate-900">Zone {i} - Residential</p>
                     <p className="text-xs text-slate-500">450 Families • 85% Evacuated</p>
                   </div>
                 </div>
                 <span className={`px-2 py-1 rounded text-xs font-bold ${i % 2 === 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                   {i % 2 === 0 ? 'High Risk' : 'Cleared'}
                 </span>
               </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
};
