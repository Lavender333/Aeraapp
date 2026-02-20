
import React, { useEffect, useState } from 'react';
import { ViewState, OrganizationProfile, OrgInventory } from '../types';
import { ArrowLeft, ShoppingCart, Box, MapPin, Truck, Navigation } from 'lucide-react';
import { t } from '../services/translations';
import { StorageService } from '../services/storage';
import { getInventoryStatuses } from '../services/inventoryStatus';

const REQUESTED_RESOURCE_COUNTS = {
  water: 42,
  food: 35,
  blankets: 28,
  medicalKits: 18,
} as const;

export const LogisticsView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const [depot, setDepot] = useState<OrganizationProfile | null>(null);
  const [inventory, setInventory] = useState<OrgInventory>({ water: 0, food: 0, blankets: 0, medicalKits: 0 });
  const [memberCount, setMemberCount] = useState<number>(0);

  useEffect(() => {
    const profile = StorageService.getProfile();
    // Default to the seed church if no community ID is set
    const orgId = profile.communityId || 'CH-9921';
    const org = StorageService.getOrganization(orgId);
    setDepot(org);
    setInventory(StorageService.getOrgInventory(orgId));
    setMemberCount(StorageService.getOrgMembers(orgId).length);

    StorageService.fetchOrgInventoryRemote(orgId).then(({ inventory }) => {
      setInventory(inventory);
    });
    StorageService.fetchOrgMembersRemote(orgId).then(({ members }) => {
      setMemberCount(members.length);
    });

    const handleInventoryUpdate = () => {
      setInventory(StorageService.getOrgInventory(orgId));
      setMemberCount(StorageService.getOrgMembers(orgId).length);
    };
    window.addEventListener('inventory-update', handleInventoryUpdate);
    window.addEventListener('storage', handleInventoryUpdate);
    return () => {
      window.removeEventListener('inventory-update', handleInventoryUpdate);
      window.removeEventListener('storage', handleInventoryUpdate);
    };
  }, []);

  const handleGetDirections = () => {
    if (depot?.address) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(depot.address)}`;
      window.open(url, '_blank');
    }
  };

  const coverageBase = memberCount || depot?.registeredPopulation || 0;
  const status = getInventoryStatuses(inventory, coverageBase);
  const totalRequestedResources =
    REQUESTED_RESOURCE_COUNTS.water +
    REQUESTED_RESOURCE_COUNTS.food +
    REQUESTED_RESOURCE_COUNTS.blankets +
    REQUESTED_RESOURCE_COUNTS.medicalKits;

  const depotResourcePercentages = [
    { label: 'Water', key: 'water' as const, unit: 'cases', count: REQUESTED_RESOURCE_COUNTS.water },
    { label: 'Food', key: 'food' as const, unit: 'boxes', count: REQUESTED_RESOURCE_COUNTS.food },
    { label: 'Blankets', key: 'blankets' as const, unit: 'units', count: REQUESTED_RESOURCE_COUNTS.blankets },
    { label: 'Med Kits', key: 'medicalKits' as const, unit: 'kits', count: REQUESTED_RESOURCE_COUNTS.medicalKits },
  ].map((item) => ({
    ...item,
    percentage: totalRequestedResources > 0
      ? Number(((item.count / totalRequestedResources) * 100).toFixed(1))
      : 0,
  }));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-safe animate-fade-in">
      <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('DASHBOARD')} className="p-2 -ml-2 text-slate-500 hover:text-slate-800">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="font-bold text-lg text-slate-900">{t('logistics.title')}</h1>
            <p className="text-xs text-slate-500">{t('logistics.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        
        {/* Nearest Depot Highlight */}
        <div className="bg-brand-50 border border-brand-100 p-4 rounded-xl shadow-sm">
           <div className="flex items-start gap-3">
             <div className="p-3 bg-brand-100 rounded-lg text-brand-700">
               <Truck size={24} />
             </div>
             <div className="flex-1">
               <h3 className="font-bold text-brand-900">{t('logistics.depot')}</h3>
               {depot ? (
                 <>
                   <p className="text-lg font-bold text-brand-800 leading-tight mt-1">{depot.name}</p>
                   <div className="flex items-start gap-1.5 mt-2 text-brand-700">
                     <MapPin size={16} className="mt-0.5 shrink-0" />
                     <p className="text-sm font-medium">{depot.address}</p>
                   </div>
                   <button 
                     onClick={handleGetDirections}
                     className="mt-3 flex items-center gap-1 text-xs font-bold text-brand-700 bg-white/50 px-3 py-1.5 rounded border border-brand-200 hover:bg-white transition-colors"
                   >
                     <Navigation size={12} /> Get Directions
                   </button>
                 </>
               ) : (
                 <p className="text-sm text-brand-700 animate-pulse mt-1">Locating nearest hub...</p>
               )}
               
               <div className="mt-4 pt-3 border-t border-brand-200/50">
                 <p className="text-[10px] uppercase font-bold text-brand-600 mb-2">Current Stock Levels</p>
                 <div className="grid grid-cols-2 gap-2">
                   {[
                     { label: 'Water', key: 'water' as const, unit: 'cases' },
                     { label: 'Food', key: 'food' as const, unit: 'boxes' },
                     { label: 'Blankets', key: 'blankets' as const, unit: 'units' },
                     { label: 'Med Kits', key: 'medicalKits' as const, unit: 'kits' },
                   ].map(item => {
                     const level = status[item.key].level;
                     const color =
                      level === 'HIGH' ? 'text-green-700 border-green-200 bg-green-50' :
                      level === 'MEDIUM' ? 'text-amber-700 border-amber-200 bg-amber-50' :
                      level === 'LOW' ? 'text-red-700 border-red-200 bg-red-50' :
                      'text-slate-500 border-slate-200 bg-white';
                     return (
                       <div key={item.label} className={`text-xs px-3 py-2 rounded border font-bold shadow-sm ${color} flex justify-between`}>
                         <span>{item.label}</span>
                         <span>{level === 'UNKNOWN' ? 'N/A' : level}</span>
                       </div>
                     );
                   })}
                 </div>
               </div>

               <div className="mt-4 pt-3 border-t border-brand-200/50 space-y-2">
                 <p className="text-[10px] uppercase font-bold text-brand-600">Nearest Resource Depot</p>
                 {depotResourcePercentages.map((resource) => (
                   <div key={resource.key} className="rounded-lg border border-brand-100 bg-white p-2">
                     <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                       <span>{resource.label} ({resource.count} {resource.unit})</span>
                       <span>{resource.percentage.toFixed(1)}%</span>
                     </div>
                     <div className="h-2 rounded bg-brand-100 overflow-hidden">
                       <div
                         className="h-full bg-brand-600"
                         style={{ width: `${resource.percentage}%` }}
                       />
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           </div>
        </div>

        <div className="pt-2">
          <button
            onClick={() => setView('DASHBOARD')}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
        </div>

      </div>
    </div>
  );
};
