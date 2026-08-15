
import React, { useState } from 'react';
import { ViewState } from '../types';
import { Button } from '../components/Button';
import { ArrowLeft, HardHat, CheckCircle, Clock, Truck } from 'lucide-react';

export const RecoveryView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const [showRecoveryLogs, setShowRecoveryLogs] = useState(false);
  const recoveryTeams = [
    { name: 'Metro Restoration', role: 'Debris Removal', status: 'On-site', verified: true, update: 'Arrived and began debris clearance.' },
    { name: 'City Power & Light', role: 'Utility Repair', status: 'Dispatched', verified: true, update: 'Crew dispatched; estimated arrival in 2 hours.' },
    { name: 'Local Aid Group', role: 'Supply Drop', status: 'Completed', verified: true, update: 'Supply delivery completed.' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-safe animate-fade-in">
      <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('DASHBOARD')} className="p-2 -ml-2 text-slate-500 hover:text-slate-800">
            <ArrowLeft size={24} />
          </button>
          <h1 className="font-bold text-lg text-slate-900">Recovery Teams</h1>
        </div>
      </div>

      <div className="p-6 space-y-6">
        
        {/* Status Card */}
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg">
           <h2 className="text-xl font-bold mb-1">Your Area Status</h2>
           <p className="text-brand-400 font-medium text-sm mb-4">Active Recovery in Progress</p>
           
           <div className="flex items-center gap-4 text-sm opacity-90">
             <div className="flex items-center gap-2">
               <Truck size={16} /> 3 Teams On-site
             </div>
             <div className="flex items-center gap-2">
               <Clock size={16} /> ETA 2hrs
             </div>
           </div>
        </div>

        <h3 className="font-bold text-slate-900 mt-4">Assigned Contractors</h3>
        <div className="space-y-4">
          {recoveryTeams.map((team, idx) => (
            <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
               <div className="flex justify-between items-start">
                 <div className="flex items-start gap-3">
                   <div className="p-2 bg-orange-50 rounded-lg text-orange-600 mt-1">
                     <HardHat size={20} />
                   </div>
                   <div>
                     <div className="flex items-center gap-1">
                       <h4 className="font-bold text-slate-900">{team.name}</h4>
                       {team.verified && <CheckCircle size={14} className="text-blue-500" fill="currentColor" stroke="#fff" />}
                     </div>
                     <p className="text-sm text-slate-500">{team.role}</p>
                   </div>
                 </div>
                 <span className={`px-2 py-1 rounded text-xs font-bold ${
                   team.status === 'Completed' ? 'bg-green-100 text-green-700' :
                   team.status === 'On-site' ? 'bg-blue-100 text-blue-700' :
                   'bg-yellow-100 text-yellow-700'
                 }`}>
                   {team.status}
                 </span>
               </div>
            </div>
          ))}
        </div>

        {showRecoveryLogs && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3" aria-live="polite">
            <h3 className="font-bold text-slate-900">Recovery Activity Log</h3>
            {recoveryTeams.map((team) => (
              <div key={team.name} className="border-l-2 border-brand-400 pl-3">
                <p className="text-sm font-semibold text-slate-800">{team.name} · {team.status}</p>
                <p className="text-xs text-slate-600">{team.update}</p>
              </div>
            ))}
          </div>
        )}

        <Button variant="outline" fullWidth onClick={() => setShowRecoveryLogs((current) => !current)}>
          {showRecoveryLogs ? 'Hide Recovery Logs' : 'View Recovery Logs'}
        </Button>
      </div>
    </div>
  );
};
