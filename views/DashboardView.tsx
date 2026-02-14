import React, { useEffect, useState } from 'react';
import { Card } from '../components/Card';
import { ViewState, HelpRequestRecord, UserRole, OrgInventory, OrgMember, OrganizationProfile } from '../types';
import { StorageService } from '../services/storage';
import { getInventoryStatuses } from '../services/inventoryStatus';
import { getBroadcast } from '../services/api';
import { getOrgByCode } from '../services/supabase';
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
  Shield,
  TrendingUp,
  BookOpen,
  ExternalLink,
  ClipboardCheck,
  Phone,
  Home,
  User
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  ReferenceLine,
} from 'recharts';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

interface DashboardViewProps {
  setView: (view: ViewState) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ setView }) => {
  const formatCommunityIdInput = (value: string) => {
    const cleaned = String(value || '')
      .toUpperCase()
      .replace(/[–—−]/g, '-')
      .replace(/[^A-Z0-9-]/g, '')
      .replace(/-+/g, '-');

    if (cleaned.length <= 2) return cleaned;
    if (cleaned.includes('-')) return cleaned;
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
  };

  const normalizeRole = (role: any): UserRole => {
    const normalized = String(role || 'GENERAL_USER').toUpperCase();
    const validRoles: UserRole[] = ['ADMIN', 'CONTRACTOR', 'LOCAL_AUTHORITY', 'FIRST_RESPONDER', 'GENERAL_USER', 'INSTITUTION_ADMIN', 'STATE_ADMIN', 'COUNTY_ADMIN', 'ORG_ADMIN', 'MEMBER'];
    return validRoles.includes(normalized as UserRole) ? (normalized as UserRole) : 'GENERAL_USER';
  };

  const [activeRequest, setActiveRequest] = useState<HelpRequestRecord | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncCount, setSyncCount] = useState(0);
  const [userRole, setUserRole] = useState<UserRole>('GENERAL_USER');
  const [userName, setUserName] = useState('');
  const [connectedOrg, setConnectedOrg] = useState<string | null>(null);
  const [orgProfile, setOrgProfile] = useState<OrganizationProfile | null>(null);
  const [orgPopulation, setOrgPopulation] = useState<number>(0);
  const [orgInventory, setOrgInventory] = useState<OrgInventory | null>(null);
  const [orgMemberCount, setOrgMemberCount] = useState<number>(0);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [tickerMessage, setTickerMessage] = useState('');
  const [showFinanceModal, setShowFinanceModal] = useState(false);
  const [financeTierKey, setFinanceTierKey] = useState<'tier1' | 'tier2' | 'tier3'>('tier2');
  const [financeScenario, setFinanceScenario] = useState<'low' | 'medium' | 'high'>('high');
  const [financePrice, setFinancePrice] = useState<number>(2);
  const [financeUsersInput, setFinanceUsersInput] = useState<number>(3000);
  const [inventoryFallback, setInventoryFallback] = useState(false);
  const [showOpDef, setShowOpDef] = useState(false);
  const [communityIdInput, setCommunityIdInput] = useState('');
  const [communityConnectError, setCommunityConnectError] = useState<string | null>(null);
  const [isConnectingCommunity, setIsConnectingCommunity] = useState(false);
  const [isAddressVerified, setIsAddressVerified] = useState(false);
  const [addressVerifiedAt, setAddressVerifiedAt] = useState<string | null>(null);
  const hasCommunity = !!connectedOrg;
  
  // Status Ping State
  const [pendingPing, setPendingPing] = useState<{ requesterName: string, timestamp: string } | undefined>(undefined);

  // Broadcast Modal State
  const [showTickerModal, setShowTickerModal] = useState(false);

  useEffect(() => {
    // Load Profile Data
    const profile = StorageService.getProfile();
    setUserRole(normalizeRole(profile.role));
    setUserName(profile.fullName);
    setIsAddressVerified(Boolean(profile.addressVerified));
    setAddressVerifiedAt(profile.addressVerifiedAt || null);
    setPendingPing(profile.pendingStatusRequest);
    setCommunityIdInput(profile.communityId || '');
    
    if (profile.communityId) {
       const org = StorageService.getOrganization(profile.communityId);
       setConnectedOrg(org?.name || profile.communityId);
       setOrgProfile(org || null);
       setOrgPopulation(org?.registeredPopulation || 0);
       StorageService.fetchOrgMembersRemote(profile.communityId).then(({ members }) => {
         setOrgMemberCount(members.length);
         setOrgMembers(members);
       });
       StorageService.fetchOrgInventoryRemote(profile.communityId).then(({ inventory, fromCache }) => {
         setOrgInventory(inventory);
         setInventoryFallback(fromCache);
       });
    }
    
    // Load Active Request
    StorageService.getActiveRequest().then(setActiveRequest);
    
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
       setUserRole(normalizeRole(updatedProfile.role));
      setIsAddressVerified(Boolean(updatedProfile.addressVerified));
      setAddressVerifiedAt(updatedProfile.addressVerifiedAt || null);
       setTickerMessage(StorageService.getTicker(updatedProfile));
       setPendingPing(updatedProfile.pendingStatusRequest);
       StorageService.getActiveRequest().then(setActiveRequest);
       if (updatedProfile.communityId) {
         const org = StorageService.getOrganization(updatedProfile.communityId);
         setConnectedOrg(org?.name || updatedProfile.communityId);
         setOrgProfile(org || null);
         setOrgPopulation(org?.registeredPopulation || 0);
         StorageService.fetchOrgMembersRemote(updatedProfile.communityId).then(({ members }) => {
           setOrgMemberCount(members.length);
           setOrgMembers(members);
         });
         StorageService.fetchOrgInventoryRemote(updatedProfile.communityId).then(({ inventory, fromCache }) => {
           setOrgInventory(inventory);
           setInventoryFallback(fromCache);
         });
       } else {
         setConnectedOrg(null);
         setOrgProfile(null);
         setOrgPopulation(0);
         setOrgInventory(null);
         setOrgMemberCount(0);
         setOrgMembers([]);
       }
    };
    
    // Listen for custom ticker update event (same-window)
    const handleTickerUpdate = () => {
       const updatedProfile = StorageService.getProfile();
       setTickerMessage(StorageService.getTicker(updatedProfile));
    };

    // Handle deferred finance open (e.g., from Splash)
    const openFinanceIfFlagged = () => {
      if (sessionStorage.getItem('openFinanceOnLoad')) {
        setShowFinanceModal(true);
        sessionStorage.removeItem('openFinanceOnLoad');
      }
    };
    openFinanceIfFlagged();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('ticker-update', handleTickerUpdate);
    window.addEventListener('inventory-update', handleStorageChange);
    window.addEventListener('finance-open', openFinanceIfFlagged);
    if (profile.communityId) {
      const orgId = profile.communityId;
      getBroadcast(orgId)
        .then((resp) => {
          if (resp?.message) setTickerMessage(`[${connectedOrg || orgId} Update] ${resp.message}`);
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('ticker-update', handleTickerUpdate);
      window.removeEventListener('inventory-update', handleStorageChange);
      window.removeEventListener('finance-open', openFinanceIfFlagged);
    };
  }, []);

  const handleConnectCommunity = async () => {
    const normalized = communityIdInput
      .trim()
      .replace(/[–—−]/g, '-')
      .replace(/\s+/g, '')
      .toUpperCase();

    if (!normalized) {
      setCommunityConnectError('Enter a Community ID.');
      return;
    }

    setIsConnectingCommunity(true);
    setCommunityConnectError(null);

    try {
      const localOrg = StorageService.getOrganization(normalized);
      const remoteOrg = localOrg ? { orgCode: normalized, orgName: localOrg.name } : await getOrgByCode(normalized);

      if (!remoteOrg) {
        setCommunityConnectError('Community not found. Check the ID and try again.');
        return;
      }

      const profile = StorageService.getProfile();
      StorageService.saveProfile({ ...profile, communityId: normalized });

      setConnectedOrg(remoteOrg.orgName || normalized);
      setOrgProfile(localOrg || null);
      setOrgPopulation(localOrg?.registeredPopulation || 0);

      const [{ members }, { inventory, fromCache }] = await Promise.all([
        StorageService.fetchOrgMembersRemote(normalized),
        StorageService.fetchOrgInventoryRemote(normalized),
      ]);

      setOrgMemberCount(members.length);
      setOrgMembers(members);
      setOrgInventory(inventory);
      setInventoryFallback(fromCache);
    } catch (err) {
      setCommunityConnectError('Unable to connect right now. Please try again.');
    } finally {
      setIsConnectingCommunity(false);
    }
  };

  const handleDisconnectCommunity = () => {
    const profile = StorageService.getProfile();
    StorageService.saveProfile({ ...profile, communityId: '' });
    setConnectedOrg(null);
    setOrgProfile(null);
    setOrgPopulation(0);
    setOrgInventory(null);
    setOrgMemberCount(0);
    setOrgMembers([]);
    setCommunityIdInput('');
    setCommunityConnectError(null);
    setIsConnectingCommunity(false);
  };

  const respondToPing = (isSafe: boolean) => {
    StorageService.respondToPing(isSafe);
    setPendingPing(undefined);
    // Refresh active request state as submitting a status creates a request record
    StorageService.getActiveRequest().then(setActiveRequest);
  };

  // Role Helper Checks
  const isResponder = userRole === 'FIRST_RESPONDER' || userRole === 'LOCAL_AUTHORITY' || userRole === 'ADMIN' || userRole === 'STATE_ADMIN' || userRole === 'COUNTY_ADMIN';
  const isOrgAdmin = userRole === 'INSTITUTION_ADMIN' || userRole === 'ORG_ADMIN';
  const canOpenOrgDashboard = isOrgAdmin || userRole === 'ADMIN' || userRole === 'STATE_ADMIN' || userRole === 'COUNTY_ADMIN';
  const isContractor = userRole === 'CONTRACTOR';
  const isGeneralUser = userRole === 'GENERAL_USER';
  const showCommunityBlocks = !isGeneralUser;
  const showCommunityAnnouncements = hasCommunity;
  const isProStatusViewer = userRole === 'ADMIN' || userRole === 'FIRST_RESPONDER' || userRole === 'STATE_ADMIN' || userRole === 'COUNTY_ADMIN';
  const showLogisticsHome = userRole === 'FIRST_RESPONDER' || userRole === 'LOCAL_AUTHORITY' || userRole === 'STATE_ADMIN' || userRole === 'COUNTY_ADMIN' || isContractor;

  const safeCount = orgMembers.filter((member) => member.status === 'SAFE').length;
  const dangerCount = orgMembers.filter((member) => member.status === 'DANGER').length;
  const accountedCount = safeCount + dangerCount;
  const totalMembers = orgMembers.length || orgMemberCount || orgPopulation;
  const evacuatedPercent = totalMembers ? Math.round((accountedCount / totalMembers) * 100) : null;
  const rescuedDisplay = totalMembers ? safeCount : null;
  const addressVerifiedDisplay = addressVerifiedAt
    ? new Date(addressVerifiedAt).toLocaleString()
    : null;
  const sheltersOpen = orgProfile?.currentBroadcast
    ? orgProfile.currentBroadcast.toLowerCase().includes('shelter') ? 1 : 0
    : null;

  /**
   * Financial model defaults aligned with AERA business plan:
   * - Tier 1: MVP pilot (loss leader)
   * - Tier 2: Neighborhood (sponsor-backed)
   * - Tier 3: City-level (scalable, where profitability becomes realistic)
   */
  const financeTierDefaults = {
    tier1: { 
      name: 'MVP / Sandbox', 
      targetUsers: 300,
      activeUsers: 150,
      // Low/Med/High monthly cost ranges (USD)
      costs: { 
        low: [2500, 3000] as [number, number],
        medium: [3600, 5300] as [number, number],
        high: [8500, 9000] as [number, number],
      },
      capacity: { total: '100–300', mau: '50–150', dau: '10–50', concurrent: '5–20' },
      grantRevenue: 0
    },
    tier2: { 
      name: 'Neighborhood', 
      targetUsers: 15000,
      activeUsers: 3000,
      costs: { 
        low: [12800, 13400] as [number, number],
        medium: [14800, 23500] as [number, number],
        high: [33500, 44000] as [number, number],
      },
      capacity: { total: '5k–15k', mau: '1.5k–3k', dau: '500–1.2k', concurrent: '50–150' },
      grantRevenue: 0
    },
    tier3: { 
      name: 'City-Level', 
      targetUsers: 250000,
      activeUsers: 20000,
      costs: { 
        low: [38500, 40000] as [number, number],
        medium: [44500, 67500] as [number, number],
        high: [86000, 155000] as [number, number],
      },
      capacity: { total: '50k–250k', mau: '10k–70k', dau: '3k–20k', concurrent: '400–2.5k' },
      grantRevenue: 0
    },
  } as const;

  const financeTier = financeTierDefaults[financeTierKey];
  const financeMonthlyCost = Math.round(
    (financeTier.costs[financeScenario][0] + financeTier.costs[financeScenario][1]) / 2
  );
  const financeBurn = financeMonthlyCost - financeTier.grantRevenue;
  const financeUsers = financeUsersInput;

  // Base subscription price per active subscriber (resident view)
  const defaultPricePerUser = financePrice;
  const monthlyRevenue = financeTier.grantRevenue + (financeUsers * defaultPricePerUser);
  const monthlyProfit = monthlyRevenue - financeMonthlyCost;
  const breakEvenUsersPrice = defaultPricePerUser > 0
    ? Math.max(0, Math.ceil(financeBurn / defaultPricePerUser))
    : null;
  const projected12MonthProfit = monthlyProfit * 12;
  const initials = userName ? userName.trim().charAt(0).toUpperCase() : 'A';

  // Simple growth model: +10% users per month compared to base
  const userGrowthSeries = Array.from({ length: 12 }).map((_, idx) => {
    const month = idx + 1;
    const projected = Math.round(financeUsers * Math.pow(1.1, idx));
    const target = Math.round(financeTier.targetUsers * (month / 12));
    return { month, projected, target };
  });

  const revenueProfitSeries = Array.from({ length: 12 }).map((_, idx) => {
    const month = idx + 1;
    const users = Math.round(financeUsers * Math.pow(1.1, idx));
    const revenue = financeTier.grantRevenue + (users * defaultPricePerUser);
    const profit = revenue - financeMonthlyCost;
    return { month, revenue, cost: financeMonthlyCost, profit };
  });

  const currentTotalUsers = financeUsers;
  const conversionNeededPct = financeTier.targetUsers > 0 && breakEvenUsersPrice !== null
    ? Math.min(100, Math.round((breakEvenUsersPrice / financeTier.targetUsers) * 100))
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50 animate-fade-in pb-28">
      <div className="max-w-5xl mx-auto p-6 space-y-6 relative">
      
      {/* Broadcast Detail Modal */}
      {showTickerModal && (
        <div 
          className="fixed inset-0 z-50 flex itemscenter justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
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

      {/* Financial Intelligence Modal */}
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
                <div>
                  <h3 className="font-bold">AERA Financial Intelligence Dashboard</h3>
                </div>
              </div>
              <button onClick={() => setShowFinanceModal(false)} className="text-slate-400 hover:text-white">
                <X size={22} />
              </button>
            </div>
            <div className="p-6 space-y-4 bg-gradient-to-br from-slate-50 to-blue-50 max-h-[75vh] overflow-y-auto">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs uppercase font-bold text-slate-500">Current Tier</p>
                  <p className="text-xl font-bold text-slate-900">{financeTier.name}</p>
                  <p className="text-xs text-slate-500">
                    Scenario: {financeScenario.toUpperCase()} • ${financeMonthlyCost.toLocaleString()}/mo
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Quick snapshot: set users and price; see burn, break-even, and conversion needed.
                  </p>
                </div>
                <div className="bg-slate-900 text-slate-100 px-4 py-2 rounded-lg font-semibold text-xs shadow-sm">
                  Financial snapshot
                </div>
              </div>

              {/* Scenario Switcher (High / Medium / Low) + Operational Cost Definition toggle */}
              <div className="flex items-center gap-2">
                <p className="text-xs uppercase font-bold text-slate-500">Scenario</p>
                <div className="flex items-center gap-2 ml-2">
                  {(['high','medium','low'] as const).map((scenario) => (
                    <button
                      key={scenario}
                      onClick={() => setFinanceScenario(scenario)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border uppercase tracking-wide ${
                        financeScenario === scenario
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300'
                      }`}
                    >
                      {scenario === 'high' ? 'High Operational Cost' : scenario === 'medium' ? 'Medium Operational Cost' : 'Low Operational Cost'}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowOpDef(s => !s)}
                    className="ml-3 text-sm text-slate-600 underline"
                  >
                    Operational Cost Definition
                  </button>
                </div>
              </div>

              {showOpDef && (
                <div className="bg-white rounded-xl p-4 shadow border border-slate-200 mt-3 text-sm">
                  <h5 className="font-bold mb-2">Operational Cost Definition</h5>
                  <ul className="list-disc ml-5 space-y-1">
                    <li>Hosting & compute: VMs/containers, serverless runtime, autoscaling instances.</li>
                    <li>Databases & storage: primary DB, object storage, backups.</li>
                    <li>Network & CDN: bandwidth, egress, load balancers, CDN caching.</li>
                    <li>Monitoring & logging: observability tooling, retention, alerting.</li>
                    <li>Backups & disaster recovery: snapshot storage, multi‑region replication.</li>
                    <li>Security & compliance: WAF, vulnerability scanning, audits, certs.</li>
                    <li>Support & operations: SRE/DevOps on‑call, incident response, runbook time.</li>
                    <li>Third‑party services & licenses: maps, SMS/email gateways, analytics, paid APIs.</li>
                    <li>Integrations & data pipelines: ETL, message queues, 3rd‑party connectors.</li>
                    <li>Capacity buffer / redundancy: spare capacity, concurrent/peak provisioning.</li>
                  </ul>

                  <div className="mt-3">
                    <h6 className="font-semibold mb-2">What each scenario supports (current tier: {financeTier.name})</h6>
                    <div className="grid md:grid-cols-3 gap-3">
                      {(['low','medium','high'] as const).map((s) => (
                        <div key={s} className="p-3 border rounded-lg bg-slate-50">
                          <p className="font-bold uppercase text-xs mb-1">{s}</p>
                          <p className="text-xs">Cost range: ${financeTier.costs[s][0].toLocaleString()} — ${financeTier.costs[s][1].toLocaleString()}</p>
                          <p className="text-xs mt-1">Capacity (approx): {financeTier.capacity.total}</p>
                          <p className="text-xs">MAU: {financeTier.capacity.mau}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Snapshot + Inputs */}
              <div className="bg-white rounded-xl p-4 shadow border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                  <Users size={16} className="text-blue-600" /> Snapshot
                </h4>
                <div className="grid md:grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-slate-600 flex flex-col gap-1">
                    Price per user (monthly)
                    <input
                      type="number"
                      value={financePrice}
                      onChange={(e) => setFinancePrice(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600 flex flex-col gap-1">
                    Active users
                    <input
                      type="number"
                      value={financeUsersInput}
                      onChange={(e) => setFinanceUsersInput(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </label>
                </div>
                <div className="grid md:grid-cols-5 gap-3 text-sm">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p className="text-[11px] uppercase font-bold text-slate-500">Cost</p>
                    <p className="text-lg font-bold text-slate-900">${financeMonthlyCost.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p className="text-[11px] uppercase font-bold text-slate-500">Revenue</p>
                    <p className="text-lg font-bold text-slate-900">${monthlyRevenue.toLocaleString()}</p>
                  </div>
                  <div className={`rounded-lg p-3 border ${monthlyProfit >=0 ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'}`}>
                    <p className="text-[11px] uppercase font-bold text-slate-500">Burn / Profit</p>
                    <p className={`text-lg font-bold ${monthlyProfit >=0 ? 'text-emerald-700' : 'text-orange-700'}`}>
                      {monthlyProfit >=0 ? '+' : '-'}${Math.abs(monthlyProfit).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p className="text-[11px] uppercase font-bold text-slate-500">Break-even users</p>
                    <p className="text-lg font-bold text-slate-900">{breakEvenUsersPrice?.toLocaleString() ?? 'N/A'}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p className="text-[11px] uppercase font-bold text-slate-500">Conversion needed</p>
                    <p className="text-lg font-bold text-slate-900">{conversionNeededPct ?? 'N/A'}%</p>
                  </div>
                </div>
              </div>

              {/* Revenue / Cost / Profit (12 months) */}
              <div className="bg-white rounded-xl p-4 shadow border border-slate-200">
                <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-emerald-600" /> Revenue, Cost & Profit (12 Months)
                </h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueProfitSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(val: number | string) => `$${Number(val).toLocaleString()}`} />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={3} name="Revenue" dot={false} />
                      <Line type="monotone" dataKey="cost" stroke="#f59e0b" strokeWidth={2} name="Cost" dot={false} />
                      <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} name="Profit" dot={false} />
                      <ReferenceLine y={0} stroke="#94a3b8" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Simple note */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-slate-700">
                Keep it simple: set users and price; read burn, break-even, and conversion. Use scenarios only to reflect cost side (low/med/high).
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
          <div 
            onClick={() => setView('SETTINGS')}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-xl font-semibold shadow-md cursor-pointer"
          >
            {initials}
          </div>
        </div>
      </div>

      {canOpenOrgDashboard && connectedOrg && (
        (() => {
          const inventoryReady = Boolean(orgInventory);
          const effectiveInventory = orgInventory || { water: 0, food: 0, blankets: 0, medicalKits: 0 };
          const coverageBase = orgMemberCount || orgPopulation;
          const status: Record<'water' | 'food' | 'blankets' | 'medicalKits', { level: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN' }> = inventoryReady
            ? getInventoryStatuses(effectiveInventory, coverageBase)
            : {
                water: { level: 'UNKNOWN' },
                food: { level: 'UNKNOWN' },
                blankets: { level: 'UNKNOWN' },
                medicalKits: { level: 'UNKNOWN' },
              };
          return (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-6 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-bold text-emerald-700">Hub Inventory</p>
              <p className="text-base font-bold text-slate-900">{connectedOrg}</p>
              <p className="text-[11px] text-slate-500 font-bold">Members: {orgMemberCount || orgPopulation}</p>
              {inventoryFallback && (
                <p className="text-[11px] text-amber-600 font-semibold">Using cached inventory (API unavailable).</p>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={() => setView('ORG_DASHBOARD')}>
              Manage
            </Button>
          </div>
          {!orgInventory && (
            <p className="text-[11px] text-slate-500 font-semibold">Inventory is loading or unavailable. You can still open Manage.</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Water Cases', value: effectiveInventory.water, unit: 'cases', key: 'water' as const, icon: <Droplets size={16} className="text-blue-600" /> },
              { label: 'Food Boxes', value: effectiveInventory.food, unit: 'boxes', key: 'food' as const, icon: <Package size={16} className="text-emerald-600" /> },
              { label: 'Blankets', value: effectiveInventory.blankets, unit: 'units', key: 'blankets' as const, icon: <Box size={16} className="text-amber-600" /> },
              { label: 'Med Kits', value: effectiveInventory.medicalKits, unit: 'kits', key: 'medicalKits' as const, icon: <AlertTriangle size={16} className="text-red-600" /> },
            ].map(item => (
              <div key={item.label} className="bg-white border border-emerald-100 rounded-xl p-3 shadow-sm flex items-center gap-3">
                <div className="p-2 bg-slate-50 rounded-lg">
                  {item.icon}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[11px] uppercase font-bold text-slate-500">{item.label}</p>
                  <p className="text-2xl font-black text-slate-900 leading-tight">{inventoryReady ? item.value : '—'}</p>
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

      {showCommunityAnnouncements && (
        /* Real-time Data Feed / Status Ticker - Clickable */
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
      )}

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

      {hasCommunity && showCommunityBlocks && (
        <Card
          title="Community Connection"
          icon={<Building2 size={20} />}
          className="border-l-4 border-l-brand-500"
        >
          <p className="text-sm text-slate-600">
            Connected to <span className="font-semibold text-slate-900">{connectedOrg}</span>. Update the Community ID to reconnect.
          </p>
          <div className="mt-4 space-y-2">
            <Input
              placeholder="Community ID (e.g., CH-1234)"
              value={communityIdInput}
              onChange={(e) => setCommunityIdInput(formatCommunityIdInput(e.target.value))}
            />
            <p className="text-[11px] text-slate-500">Format: CH-1234</p>
            {communityConnectError && (
              <p className="text-xs text-red-600 font-semibold">{communityConnectError}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={handleConnectCommunity}
                disabled={isConnectingCommunity}
              >
                {isConnectingCommunity ? 'Updating...' : 'Update Community'}
              </Button>
            </div>
            <div className="pt-2 border-t border-slate-200">
              <p className="text-[11px] text-slate-500 mb-1">Advanced</p>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600 hover:bg-red-50"
                onClick={handleDisconnectCommunity}
              >
                Disconnect
              </Button>
            </div>
          </div>
        </Card>
      )}

      {!hasCommunity && showCommunityBlocks && (
        <Card
          title="Trusted Community Connection"
          icon={<Building2 size={20} />}
          className="border-l-4 border-l-brand-500"
        >
          <p className="text-sm text-slate-600">
            Enter your Community ID to unlock local alerts, depots, and inventory updates.
          </p>
          <div className="mt-4 space-y-2">
            <Input
              placeholder="Community ID (e.g., CH-1234)"
              value={communityIdInput}
              onChange={(e) => setCommunityIdInput(formatCommunityIdInput(e.target.value))}
            />
            <p className="text-[11px] text-slate-500">Format: CH-1234</p>
            {communityConnectError && (
              <p className="text-xs text-red-600 font-semibold">{communityConnectError}</p>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleConnectCommunity}
                disabled={isConnectingCommunity}
              >
                {isConnectingCommunity ? 'Connecting...' : 'Connect Community'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {isGeneralUser && (
        <>
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Home & Safety</h3>
            <p className="text-xs text-slate-500 mt-1">Your readiness, household, and emergency settings in one place</p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <button
                type="button"
                onClick={() => setView('READINESS')}
                className="text-left bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-slate-300 hover:shadow-md transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center mb-3">
                  <ClipboardCheck size={18} />
                </div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-slate-900 text-sm">Readiness Checklist</h4>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Build and track your kit with quantity guidance.</p>
              </button>
              <button
                type="button"
                onClick={() => setView('SETTINGS')}
                className="text-left bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-slate-300 hover:shadow-md transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center mb-3">
                  <Phone size={18} />
                </div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-slate-900 text-sm">Home & Profile</h4>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Household members, emergency contacts, and org connection.</p>
                {isAddressVerified && addressVerifiedDisplay ? (
                  <p className="text-[11px] text-emerald-700 font-semibold mt-2 inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                    <Check size={12} /> Last verified: {addressVerifiedDisplay}
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-700 font-semibold mt-2 inline-flex items-center gap-1 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    <Shield size={12} /> Address verification needed
                  </p>
                )}
              </button>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">National Preparedness</h3>
            <p className="text-xs text-slate-500 mt-1">Official resources to help you stay ready</p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <a
                href="https://www.ready.gov/"
                target="_blank"
                rel="noreferrer"
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-slate-300 hover:shadow-md transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center mb-3">
                  <BookOpen size={18} />
                </div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-slate-900 text-sm">FEMA Safety Guides</h4>
                  <ExternalLink size={12} className="text-slate-400" />
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Official how-to guides for floods, fires, and outages.</p>
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 mt-3">
                  Explore Guides
                </div>
              </a>
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center mb-3">
                  <BookOpen size={18} />
                </div>
                <h4 className="font-semibold text-slate-900 text-sm">Community Resources</h4>
                <p className="text-[11px] text-slate-500 mt-2">
                  {hasCommunity ? `Connected to ${connectedOrg}.` : 'Join or update your community connection in Settings.'}
                </p>
                {hasCommunity && communityIdInput && (
                  <p className="text-[11px] text-emerald-700 font-semibold mt-1">Community ID: {communityIdInput}</p>
                )}
                <button
                  type="button"
                  onClick={() => setView('SETTINGS')}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 mt-3 hover:underline"
                >
                  {hasCommunity ? 'Manage in Settings' : 'Open Settings'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {hasCommunity && userRole !== 'ADMIN' && !isOrgAdmin && !(canOpenOrgDashboard && connectedOrg && orgInventory) && (
        <>
          {/* Resource Alert System (Community Only) */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3 shadow-sm cursor-pointer hover:bg-amber-100 transition-colors" onClick={() => setView('LOGISTICS')}>
             <div className="p-2 bg-amber-200 rounded-full text-amber-800">
               <Building2 size={18} />
             </div>
             <div className="flex-1">
               <h3 className="font-bold text-amber-900 text-sm">{t('dash.resource_depot')}</h3>
               <p className="text-xs text-amber-800">
                 {orgInventory
                   ? `${connectedOrg} hub inventory — Water ${orgInventory.water}, Food ${orgInventory.food}, Blankets ${orgInventory.blankets}, Med Kits ${orgInventory.medicalKits}.`
                   : `${connectedOrg} hub inventory is not available yet.`}
               </p>
             </div>
             <ChevronRight size={16} className="text-amber-500 mt-2" />
          </div>

        </>
      )}

      {hasCommunity && showCommunityBlocks && (
        /* Modular Card Layout - DYNAMIC BASED ON ROLE */
        <>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mt-2">Recovery & Resources</h3>
          <div className="grid grid-cols-2 gap-4">

        {/* Org Dashboard entry is provided in the Hub Inventory card via Manage button to avoid duplicate navigation */}
        
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
        
        {showLogisticsHome && (
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
        </>
      )}

      {/* Analytics / Stats Preview - Only for Pros */}
      {isProStatusViewer && (
        <Card 
          title="Community Status (Pro)" 
          icon={<BarChart2 size={20} />}
          className="bg-slate-800 text-slate-100 border-slate-700"
        >
           <div className="grid grid-cols-3 gap-2 text-center divide-x divide-slate-700">
              <div>
                 <div className="text-xl font-bold text-brand-400">
                   {evacuatedPercent === null ? 'N/A' : `${evacuatedPercent}%`}
                 </div>
                 <div className="text-[10px] text-slate-400">Evacuated</div>
              </div>
              <div>
                 <div className="text-xl font-bold text-blue-400">
                   {rescuedDisplay === null ? 'N/A' : rescuedDisplay}
                 </div>
                 <div className="text-[10px] text-slate-400">Rescued</div>
              </div>
              <div>
                 <div className="text-xl font-bold text-green-400">
                   {sheltersOpen === null ? 'N/A' : sheltersOpen}
                 </div>
                 <div className="text-[10px] text-slate-400">Shelters Open</div>
             </div>
           </div>
        </Card>
      )}
    </div>
  </div>
);
};
