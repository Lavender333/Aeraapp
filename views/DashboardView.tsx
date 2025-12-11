
import React, { useEffect, useState } from 'react';
import { Card } from '../components/Card';
import { ViewState, HelpRequestRecord, UserRole, OrgInventory } from '../types';
import { StorageService } from '../services/storage';
import { getInventoryStatuses } from '../services/inventoryStatus';
import { t } from '../services/translations';
import { 
  AlertTriangle, 
  MapPin, 
  Activity, 
  Bell, 
  ChevronRight,
  Radio,
  DollarSign,
  ClipboardList,
  Users,
  HardHat,
  BarChart2,
  Navigation,
  Truck,
  Database,
  WifiOff,
  Building2,
  BellRing,
  X,
  Info,
  RefreshCw,
  Check,
  Droplets,
  Package,
  Box,
  Calendar,
  Target,
  Calculator,
  BarChart3,
  Shield
} from 'lucide-react';
import { Button } from '../components/Button';

interface DashboardViewProps {
  setView: (view: ViewState) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ setView }) => {
  const [activeRequest, setActiveRequest] = useState<HelpRequestRecord | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncCount, setSyncCount] = useState(0);
  const [userRole, setUserRole] = useState<UserRole>('GENERAL_USER');
  const [userName, setUserName] = useState('');
  const [connectedOrg, setConnectedOrg] = useState<string | null>(null);
  const [orgPopulation, setOrgPopulation] = useState<number>(0);
  const [orgInventory, setOrgInventory] = useState<OrgInventory | null>(null);
  const [orgMemberCount, setOrgMemberCount] = useState<number>(0);
  const [tickerMessage, setTickerMessage] = useState('');
  const [showFinanceModal, setShowFinanceModal] = useState(false);
  
  // Status Ping State
  const [pendingPing, setPendingPing] = useState<{ requesterName: string, timestamp: string } | undefined>(undefined);

  // Broadcast Modal State
  const [showTickerModal, setShowTickerModal] = useState(false);

  useEffect(() => {
    // Load Profile Data
    const profile = StorageService.getProfile();
    setUserRole(profile.role);
    setUserName(profile.fullName);
    setPendingPing(profile.pendingStatusRequest);
    
    if (profile.communityId) {
       const org = StorageService.getOrganization(profile.communityId);
       if (org) {
         setConnectedOrg(org.name);
         setOrgPopulation(org.registeredPopulation || 0);
         setOrgInventory(StorageService.getOrgInventory(org.id));
         setOrgMemberCount(StorageService.getOrgMembers(org.id).length);
       }
    }
    
    // Load Active Request
    setActiveRequest(StorageService.getActiveRequest());
    
    // Load Ticker with user context for scoped broadcasts
    setTickerMessage(StorageService.getTicker(profile));

    const handleOnline = () => {
      setIsOnline(true);
      // Trigger Auto-Sync when back online
      setIsSyncing(true);
      StorageService.syncPendingData().then((count) => {
        setIsSyncing(false);
        if (count > 0) {
          setSyncCount(count);
          setTimeout(() => setSyncCount(0), 4000);
        }
      });
    };
    const handleOffline = () => setIsOnline(false);
    
    // Listen for storage events (cross-tab)
    const handleStorageChange = () => {
       const updatedProfile = StorageService.getProfile();
       setTickerMessage(StorageService.getTicker(updatedProfile));
       setPendingPing(updatedProfile.pendingStatusRequest);
       setActiveRequest(StorageService.getActiveRequest());
       if (updatedProfile.communityId) {
         setOrgInventory(StorageService.getOrgInventory(updatedProfile.communityId));
         const org = StorageService.getOrganization(updatedProfile.communityId);
         if (org) setOrgPopulation(org.registeredPopulation || 0);
         setOrgMemberCount(StorageService.getOrgMembers(updatedProfile.communityId).length);
       }
    };
    
    // Listen for custom ticker update event (same-window)
    const handleTickerUpdate = () => {
       const updatedProfile = StorageService.getProfile();
       setTickerMessage(StorageService.getTicker(updatedProfile));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('ticker-update', handleTickerUpdate);
    window.addEventListener('inventory-update', handleStorageChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('ticker-update', handleTickerUpdate);
      window.removeEventListener('inventory-update', handleStorageChange);
    };
  }, []);

  const respondToPing = (isSafe: boolean) => {
    StorageService.respondToPing(isSafe);
    setPendingPing(undefined);
    // Refresh active request state as submitting a status creates a request record
    setActiveRequest(StorageService.getActiveRequest());
  };

  // Role Helper Checks
  const isResponder = userRole === 'FIRST_RESPONDER' || userRole === 'LOCAL_AUTHORITY' || userRole === 'ADMIN';
  const isOrgAdmin = userRole === 'INSTITUTION_ADMIN';
  const isContractor = userRole === 'CONTRACTOR';
  const isGeneralUser = userRole === 'GENERAL_USER';

  const financeTierDefaults = {
    tier1: { name: 'MVP / Sandbox', targetUsers: 100, activeUsers: 50, platformCost: 12, peopleCost: 3500, securityCost: 4, grantRevenue: 50000 },
    tier2: { name: 'Neighborhood Pilot', targetUsers: 5000, activeUsers: 650, platformCost: 130, peopleCost: 13000, securityCost: 1000, grantRevenue: 50000 },
    tier3: { name: 'City-Level', targetUsers: 50000, activeUsers: 11000, platformCost: 1000, peopleCost: 38000, securityCost: 2000, grantRevenue: 50000 },
  };
  const financeTier = financeTierDefaults.tier2;
  const financeMonthlyCost = financeTier.platformCost + financeTier.peopleCost + financeTier.securityCost;
  const financeBurn = financeMonthlyCost - financeTier.grantRevenue;
  const initials = userName ? userName.trim().charAt(0).toUpperCase() : 'A';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50 animate-fade-in pb-28">
      <div className="max-w-5xl mx-auto p-6 space-y-6 relative">
      
      {/* Broadcast Detail Modal */}
      {showTickerModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setShowTickerModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
             <div className="bg-slate-900 p-4 flex justify-between items-center text-white border-b border-slate-800">
               <div className="flex items-center gap-2">
                 <Activity className="text-brand-400" size={20} />
                 <h3 className="font-bold text-lg">Active Broadcast</h3>
               </div>
               <button onClick={() => setShowTickerModal(false)} className="text-slate-400 hover:text-white transition-colors">
                 <X size={24} />
               </button>
             </div>
             <div className="p-6">
               <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
                 <p className="text-slate-900 text-lg font-medium leading-relaxed whitespace-pre-wrap">
                   {tickerMessage}
                 </p>
               </div>
               <Button fullWidth onClick={() => setShowTickerModal(false)} className="bg-slate-900 hover:bg-slate-800 text-white font-bold">
                 Close Message
               </Button>
             </div>
          </div>
        </div>
      )}
      {showFinanceModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setShowFinanceModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <BarChart3 size={18} />
                <h3 className="font-bold">AERA Financial Dashboard</h3>
              </div>
              <button onClick={() => setShowFinanceModal(false)} className="text-slate-400 hover:text-white">
                <X size={22} />
              </button>
            </div>
            <div className="p-6 space-y-4 bg-gradient-to-br from-slate-50 to-blue-50">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs uppercase font-bold text-slate-500">Current Tier</p>
                  <p className="text-xl font-bold text-slate-900">{financeTier.name}</p>
                </div>
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-lg font-semibold">
                  Month 3 of 12
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 shadow border border-slate-200">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                    <Users size={16} className="text-blue-600" /> Users & Goals
                  </h4>
                  <p className="text-sm text-slate-600">Active: <span className="font-bold text-slate-900">{financeTier.activeUsers.toLocaleString()}</span></p>
                  <p className="text-sm text-slate-600">Target: <span className="font-bold text-slate-900">{financeTier.targetUsers.toLocaleString()}</span></p>
                  <p className="text-sm text-slate-600">Growth needed/mo: <span className="font-bold text-slate-900">+{Math.ceil((financeTier.targetUsers - financeTier.activeUsers)/9)}</span></p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow border border-slate-200">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                    <DollarSign size={16} className="text-emerald-600" /> Monthly Costs
                  </h4>
                  <p className="text-sm text-slate-600">Platform: <span className="font-bold text-slate-900">${financeTier.platformCost.toLocaleString()}</span></p>
                  <p className="text-sm text-slate-600">People: <span className="font-bold text-slate-900">${financeTier.peopleCost.toLocaleString()}</span></p>
                  <p className="text-sm text-slate-600">Security: <span className="font-bold text-slate-900">${financeTier.securityCost.toLocaleString()}</span></p>
                  <p className="text-sm text-slate-600 mt-2">Total: <span className="font-bold text-slate-900">${financeMonthlyCost.toLocaleString()}</span></p>
                  <p className="text-sm text-slate-600">Grant: <span className="font-bold text-slate-900">${financeTier.grantRevenue.toLocaleString()}</span></p>
                  <p className="text-sm font-bold text-slate-900 mt-1">Burn: ${financeBurn.toLocaleString()}/mo</p>
                </div>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-2">
                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                  <Target size={16} className="text-indigo-600" /> Profitability Snapshot
                </h4>
                <p className="text-sm text-slate-700">
                  With current grant funding, burn is <span className="font-bold">${financeBurn.toLocaleString()}/mo</span>.
                  To break even without grants, set pricing or increase funding.
                </p>
                <p className="text-sm text-slate-700">
                  Break-even users at $5/user: <span className="font-bold">{Math.ceil(financeBurn / 5).toLocaleString()}</span>
                </p>
                <p className="text-sm text-slate-700">
                  Break-even users at $15/user: <span className="font-bold">{Math.ceil(financeBurn / 15).toLocaleString()}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offline Indicator */}
      {!isOnline && (
        <div className="bg-slate-800 text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 text-sm font-bold shadow-lg animate-pulse">
           <WifiOff size={16} />
           <span>{t('dash.offline')}</span>
        </div>
      )}

      {/* Syncing Indicator */}
      {isSyncing && (
        <div className="bg-blue-600 text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 text-sm font-bold shadow-lg">
           <RefreshCw size={16} className="animate-spin" />
           <span>Syncing with Command Center...</span>
        </div>
      )}

      {/* Sync Success Toast */}
      {syncCount > 0 && !isSyncing && (
        <div className="bg-green-600 text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 text-sm font-bold shadow-lg animate-fade-in">
           <Check size={16} />
           <span>Successfully synced {syncCount} item{syncCount > 1 ? 's' : ''}.</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-800 mb-1">{t('dash.welcome')}</h1>
          <p className="text-lg text-slate-500">{userName.split(' ')[0]}</p>
        </div>
        <div className="flex items-center gap-2">
          {isResponder && (
            <div className="hidden md:flex items-center gap-1.5 px-2 py-1 bg-slate-200 rounded text-[10px] font-bold text-slate-600">
               <Database size={10} /> FEMA SYNC: {isOnline ? 'ACTIVE' : 'QUEUED'}
            </div>
          )}
          <div 
            onClick={() => setView('SETTINGS')}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-xl font-semibold shadow-md cursor-pointer"
          >
            {initials}
          </div>
        </div>
      </div>

      {isOrgAdmin && connectedOrg && orgInventory && (
        (() => {
          const coverageBase = orgMemberCount || orgPopulation;
          const status = getInventoryStatuses(orgInventory, coverageBase);
          return (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-6 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-bold text-emerald-700">Hub Inventory</p>
              <p className="text-base font-bold text-slate-900">{connectedOrg}</p>
              <p className="text-[11px] text-slate-500 font-bold">Members: {orgMemberCount || orgPopulation}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setView('ORG_DASHBOARD')}>
              Manage
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Water Cases', value: orgInventory.water, unit: 'cases', key: 'water' as const, icon: <Droplets size={16} className="text-blue-600" /> },
              { label: 'Food Boxes', value: orgInventory.food, unit: 'boxes', key: 'food' as const, icon: <Package size={16} className="text-emerald-600" /> },
              { label: 'Blankets', value: orgInventory.blankets, unit: 'units', key: 'blankets' as const, icon: <Box size={16} className="text-amber-600" /> },
              { label: 'Med Kits', value: orgInventory.medicalKits, unit: 'kits', key: 'medicalKits' as const, icon: <AlertTriangle size={16} className="text-red-600" /> },
            ].map(item => (
              <div key={item.label} className="bg-white border border-emerald-100 rounded-xl p-3 shadow-sm flex items-center gap-3">
                <div className="p-2 bg-slate-50 rounded-lg">
                  {item.icon}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[11px] uppercase font-bold text-slate-500">{item.label}</p>
                  <p className="text-2xl font-black text-slate-900 leading-tight">{item.value}</p>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{item.unit}</span>
                    <span className={`font-bold ${
                      status[item.key].level === 'HIGH' ? 'text-green-600' :
                      status[item.key].level === 'MEDIUM' ? 'text-amber-600' :
                      status[item.key].level === 'LOW' ? 'text-red-600' : 'text-slate-400'
                    }`}>
                      {status[item.key].level === 'UNKNOWN' ? 'N/A' : status[item.key].level}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
          );
        })()
      )}

      {/* Real-time Data Feed / Status Ticker - Clickable */}
      <div 
        onClick={() => setShowTickerModal(true)}
        className="bg-slate-900 text-white p-3 rounded-lg flex items-center gap-3 text-sm shadow-md overflow-hidden cursor-pointer group hover:bg-slate-800 transition-colors"
        title="Tap to read full message"
      >
        <Activity size={16} className="text-brand-400 animate-pulse shrink-0" />
        <div className="flex-1 overflow-hidden whitespace-nowrap relative">
          <span className="inline-block animate-[slideLeft_20s_linear_infinite]">
            {tickerMessage}
          </span>
        </div>
        <ChevronRight size={16} className="text-slate-500 group-hover:text-white shrink-0" />
      </div>
      <div className="flex justify-end">
        <button
          onClick={() => setShowFinanceModal(true)}
          className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold shadow hover:from-blue-600 hover:to-indigo-700 transition-colors"
        >
          <BarChart3 size={16} /> Financial Dashboard
        </button>
      </div>

      {/* PENDING PING ACTION - Top Priority */}
      {pendingPing && (
        <div className="bg-purple-600 text-white p-5 rounded-2xl shadow-xl shadow-purple-200 animate-slide-up border-2 border-purple-400">
           <div className="flex items-center gap-3 mb-4">
              <div className="bg-white/20 p-2 rounded-full animate-bounce">
                <BellRing size={24} />
              </div>
              <div>
                <h2 className="font-bold text-lg leading-tight">Status Check Requested</h2>
                <p className="text-purple-200 text-sm">By {pendingPing.requesterName}</p>
              </div>
           </div>
           <p className="mb-4 font-medium">Are you safe right now?</p>
           <div className="grid grid-cols-2 gap-3">
              <Button 
                onClick={() => respondToPing(true)} 
                className="bg-green-500 hover:bg-green-400 text-white border-0 font-bold"
              >
                I Am Safe
              </Button>
              <Button 
                onClick={() => respondToPing(false)} 
                className="bg-red-500 hover:bg-red-400 text-white border-0 font-bold"
              >
                I Need Help
              </Button>
           </div>
        </div>
      )}

      {/* Critical Action: Get Help or Status */}
      {activeRequest && (
        <Card 
          className="bg-blue-50 border-blue-100 hover:border-blue-200"
          onClick={() => setView('HELP_WIZARD')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full text-blue-600 relative">
                <Radio size={32} className="animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-blue-900">{t('dash.request_active')}</h2>
                <div className="flex flex-col">
                  {activeRequest.synced === false ? (
                    <span className="text-amber-600 text-sm font-bold flex items-center gap-1">
                      <WifiOff size={12} /> Pending Sync
                    </span>
                  ) : (
                    <span className="text-blue-700 text-sm">{t('dash.tracking')}</span>
                  )}
                  {activeRequest.priority === 'CRITICAL' && (
                     <span className="text-xs font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded w-fit mt-1">TRIAGE: CRITICAL</span>
                  )}
                </div>
              </div>
            </div>
            <ChevronRight className="text-blue-400" />
          </div>
        </Card>
      )}

      {/* Resource Alert System (Visible to Everyone) */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3 shadow-sm cursor-pointer hover:bg-amber-100 transition-colors" onClick={() => setView('LOGISTICS')}>
         <div className="p-2 bg-amber-200 rounded-full text-amber-800">
           {connectedOrg ? <Building2 size={18} /> : <MapPin size={18} />}
         </div>
         <div className="flex-1">
           <h3 className="font-bold text-amber-900 text-sm">{t('dash.resource_depot')}</h3>
           <p className="text-xs text-amber-800">
             {connectedOrg ? (
               <>{connectedOrg} (My Community) has reported <span className="font-bold">Water & Food</span> availability.</>
             ) : (
               <>Grace Community Church (0.8 mi) has reported <span className="font-bold">Water & Food</span> availability.</>
             )}
           </p>
         </div>
         <ChevronRight size={16} className="text-amber-500 mt-2" />
      </div>

      {/* Push Notification Console / Alerts */}
      <Card 
        title={t('dash.alerts')}
        icon={<Bell size={20} />} 
        onClick={() => setView('ALERTS')}
        className="border-l-4 border-l-orange-500"
      >
        <div className="flex justify-between items-center">
           <div>
             <div className="font-semibold text-slate-800">Flash Flood Warning</div>
             <div className="text-xs text-slate-500">Effective until 6:00 PM EST</div>
           </div>
           <div className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded uppercase">
             Critical
           </div>
        </div>
      </Card>

      {/* Modular Card Layout - DYNAMIC BASED ON ROLE */}
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mt-2">Recovery & Resources</h3>
      <div className="grid grid-cols-2 gap-4">
        
        {/* G.A.P. Financial Aid - For Users in need of aid */}
        {(isGeneralUser || isOrgAdmin) && (
          <Card 
            className="col-span-1 hover:border-brand-300"
            onClick={() => setView('GAP')}
          >
            <div className="flex flex-col items-start gap-3">
              <div className="p-2 bg-green-100 rounded-lg text-green-700">
                <DollarSign size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{t('dash.gap')}</h3>
                <p className="text-xs text-slate-500 mt-1">{t('dash.gap.desc')}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Damage Assessment - For Users (reporting) and Pros (reviewing) */}
        {(isGeneralUser || isResponder || isContractor) && (
          <Card 
            className="col-span-1 hover:border-brand-300"
            onClick={() => setView('ASSESSMENT')}
          >
            <div className="flex flex-col items-start gap-3">
              <div className="p-2 bg-purple-100 rounded-lg text-purple-700">
                <ClipboardList size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{t('dash.assess')}</h3>
                <p className="text-xs text-slate-500 mt-1">{t('dash.assess.desc')}</p>
              </div>
            </div>
          </Card>
        )}
        
        {(isResponder || isOrgAdmin || isContractor) && (
          <Card 
            className="col-span-2 bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100 hover:border-emerald-200"
            onClick={() => setView('LOGISTICS')}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white rounded-xl shadow-sm">
                <MapPin size={24} className="text-emerald-700" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900">{t('dash.logistics')}</h3>
                <p className="text-sm text-slate-600">{t('dash.logistics.desc')}</p>
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm">
                    <Droplets size={16} className="text-blue-600" />
                    <span className="text-sm font-semibold text-slate-800">Water</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm">
                    <Package size={16} className="text-emerald-600" />
                    <span className="text-sm font-semibold text-slate-800">Food</span>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition-transform flex-shrink-0" />
            </div>
          </Card>
        )}

        {/* --- PRO FEATURES (Responders / Admins) --- */}
        {isResponder && (
          <>
            {/* Population Tracker */}
            <Card 
              className="col-span-1 hover:border-brand-300 border-indigo-200 bg-indigo-50/50"
              onClick={() => setView('POPULATION')}
            >
              <div className="flex flex-col items-start gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700">
                  <Users size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Population</h3>
                  <p className="text-xs text-slate-500 mt-1">Evac zones & heatmaps</p>
                </div>
              </div>
            </Card>

            {/* Deployment & Recovery */}
            <Card 
              className="col-span-1 hover:border-brand-300 border-orange-200 bg-orange-50/50"
              onClick={() => setView('RECOVERY')}
            >
              <div className="flex flex-col items-start gap-3">
                <div className="p-2 bg-orange-100 rounded-lg text-orange-700">
                  <HardHat size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Recovery</h3>
                  <p className="text-xs text-slate-500 mt-1">Teams & Deployments</p>
                </div>
              </div>
            </Card>

            {/* Drone Innovations */}
            <Card 
              className="col-span-1 hover:border-brand-300 border-slate-300 bg-slate-100"
              onClick={() => setView('DRONE')}
            >
              <div className="flex flex-col items-start gap-3">
                <div className="p-2 bg-slate-800 rounded-lg text-brand-400">
                  <Navigation size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Drone Dispatch</h3>
                  <p className="text-xs text-slate-500 mt-1">UAV Feed & Delivery</p>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Analytics / Stats Preview - Only for Pros */}
      {isResponder && (
        <Card 
          title="Community Status (Pro)" 
          icon={<BarChart2 size={20} />}
          className="bg-slate-800 text-slate-100 border-slate-700"
        >
           <div className="grid grid-cols-3 gap-2 text-center divide-x divide-slate-700">
              <div>
                 <div className="text-xl font-bold text-brand-400">85%</div>
                 <div className="text-[10px] text-slate-400">Evacuated</div>
              </div>
              <div>
                 <div className="text-xl font-bold text-blue-400">324</div>
                 <div className="text-[10px] text-slate-400">Rescued</div>
              </div>
              <div>
                 <div className="text-xl font-bold text-green-400">12</div>
                 <div className="text-[10px] text-slate-400">Shelters Open</div>
             </div>
           </div>
        </Card>
      )}
    </div>
  </div>
);
};
