
import React, { useState } from 'react';
import { ViewState } from '../types';
import { Button } from '../components/Button';
import { ArrowLeft, Crosshair, Navigation, Video, Battery, Signal, Wind } from 'lucide-react';

export const DroneView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const [isDispatching, setIsDispatching] = useState(false);
  const [activeDrone, setActiveDrone] = useState<string | null>(null);

  const handleDispatch = (id: string) => {
    setIsDispatching(true);
    setTimeout(() => {
      setIsDispatching(false);
      setActiveDrone(id);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col pb-safe animate-fade-in">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 p-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('DASHBOARD')} className="p-2 -ml-2 text-slate-400 hover:text-white">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="font-bold text-lg text-white">Drone Command</h1>
            <p className="text-xs text-brand-400 font-mono">UAV-NETWORK: ONLINE</p>
          </div>
        </div>
      </div>

      {/* Main Interface */}
      <div className="flex-1 flex flex-col">
        {/* Live Feed / Map Placeholder */}
        <div className="h-64 bg-black relative border-b border-slate-700">
          <div className="absolute inset-0 opacity-40 bg-[url('https://picsum.photos/800/600')] bg-cover bg-center"></div>
          
          {/* Overlay HUD */}
          <div className="absolute inset-0 p-4 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="bg-red-600/80 px-2 py-0.5 rounded text-xs font-bold animate-pulse flex items-center gap-1">
                 <div className="w-2 h-2 rounded-full bg-white"></div> LIVE FEED
              </span>
              <div className="text-right text-xs font-mono text-green-400">
                <p>LAT: 34.0522 N</p>
                <p>LNG: 118.2437 W</p>
                <p>ALT: 120 FT</p>
              </div>
            </div>
            
            <div className="flex justify-center">
               <Crosshair size={48} className="text-white/30" />
            </div>

            <div className="flex justify-between items-end">
               <div className="text-xs font-mono text-white/70">
                 <div className="flex items-center gap-1"><Battery size={12}/> 84%</div>
                 <div className="flex items-center gap-1"><Signal size={12}/> STRONG</div>
                 <div className="flex items-center gap-1"><Wind size={12}/> 12 MPH NW</div>
               </div>
            </div>
          </div>
        </div>

        {/* Fleet Control */}
        <div className="p-6 space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Navigation size={20} className="text-brand-400"/> Fleet Status
          </h2>
          
          <div className="space-y-4">
            {[
              { id: 'UAV-Alpha', status: 'In-Flight', task: 'Supply Drop - Zone 4', batt: 84 },
              { id: 'UAV-Bravo', status: 'Idle', task: 'Awaiting Orders', batt: 100 },
              { id: 'UAV-Charlie', status: 'Charging', task: 'Docked', batt: 12 },
            ].map((drone) => (
              <div key={drone.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col gap-3">
                 <div className="flex justify-between items-center">
                   <div className="flex items-center gap-3">
                     <div className={`p-2 rounded-full ${drone.status === 'In-Flight' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                       <Video size={18} />
                     </div>
                     <div>
                       <h3 className="font-bold">{drone.id}</h3>
                       <p className="text-xs text-slate-400">{drone.task}</p>
                     </div>
                   </div>
                   <div className="text-right">
                     <span className={`text-xs px-2 py-1 rounded font-bold ${
                       drone.status === 'In-Flight' ? 'bg-green-900 text-green-300' : 
                       drone.status === 'Idle' ? 'bg-blue-900 text-blue-300' : 'bg-slate-700 text-slate-300'
                     }`}>
                       {drone.status}
                     </span>
                   </div>
                 </div>
                 
                 {drone.status === 'Idle' && (
                   <Button 
                     size="sm" 
                     className="w-full bg-brand-600 hover:bg-brand-500 text-white border-0"
                     onClick={() => handleDispatch(drone.id)}
                     disabled={isDispatching}
                   >
                     {isDispatching && activeDrone !== drone.id ? 'Initializing...' : 'Dispatch to My Location'}
                   </Button>
                 )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
