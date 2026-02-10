
import React, { useState, useEffect, useRef } from 'react';
import { ViewState, OrgMember, OrgInventory, ReplenishmentRequest } from '../types';
import { Button } from '../components/Button';
import { StorageService } from '../services/storage';
import { listRequests, createRequest, updateRequestStatus } from '../services/api';
import { REQUEST_ITEM_MAP } from '../services/validation';
import { getInventoryStatuses, getRecommendedResupply } from '../services/inventoryStatus';
import { t } from '../services/translations';
import { Building2, CheckCircle, AlertTriangle, HelpCircle, Package, ArrowLeft, Send, Truck, Copy, Save, Phone, MapPin, User, HeartPulse, BellRing, X, AlertOctagon, Loader2, Wand2, ShieldCheck, WifiOff, ChevronDown, ChevronUp } from 'lucide-react';
import { Textarea } from '../components/Input';
import { GoogleGenAI } from "../services/mockGenAI";

export const OrgDashboardView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [inventory, setInventory] = useState<OrgInventory>({ water: 0, food: 0, blankets: 0, medicalKits: 0 });
  const [activeTab, setActiveTab] = useState<'MEMBERS' | 'INVENTORY'>('MEMBERS');
  const [orgName, setOrgName] = useState('Community Organization');
  const [communityId, setCommunityId] = useState('');
  const [registeredPopulation, setRegisteredPopulation] = useState<number>(0);
  const [requests, setRequests] = useState<ReplenishmentRequest[]>([]);
  const [inventoryFallback, setInventoryFallback] = useState(false);
  const [requestsFallback, setRequestsFallback] = useState(false);
  const [, setMembersFallback] = useState(false);
  
  // Member Detail State
  const [selectedMember, setSelectedMember] = useState<OrgMember | null>(null);
  
  // Replenishment Details
  const [replenishmentProvider, setReplenishmentProvider] = useState('Central Warehouse');
  const [replenishmentEmail, setReplenishmentEmail] = useState('');
  
  // Inventory Edit State
  const [hasChanges, setHasChanges] = useState(false);
  const [statusCounts, setStatusCounts] = useState({ safe: 0, danger: 0, unknown: 0 });

  // Request Feature State
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [selectedItem, setSelectedItem] = useState('Water Cases');
  const [requestAmount, setRequestAmount] = useState(10);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [stockLoading, setStockLoading] = useState(false);
  const [showCommunityId, setShowCommunityId] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [lastInventoryUpdated, setLastInventoryUpdated] = useState<string>('');

  const requestsRef = useRef<HTMLDivElement | null>(null);
  const membersRef = useRef<HTMLDivElement | null>(null);
  const alertsRef = useRef<HTMLDivElement | null>(null);

  // Broadcast State
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastDraft, setBroadcastDraft] = useState('');
  const [broadcastStep, setBroadcastStep] = useState<'COMPOSE' | 'CONFIRM'>('COMPOSE');
  const [isModerating, setIsModerating] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);

  useEffect(() => {
    const profile = StorageService.getProfile();
    const id = profile.communityId || 'CH-9921';
    setCommunityId(id);
    
    // Load Org Data
    const org = StorageService.getOrganization(id);
    if (org) {
      setOrgName(org.name);
      setReplenishmentProvider(org.replenishmentProvider || 'General Aid Pool');
      setReplenishmentEmail(org.replenishmentEmail || '');
      setRegisteredPopulation(org.registeredPopulation || 0);
    }
    
    // Load Live Data from Backend
    setMembers(StorageService.getOrgMembers(id));
    StorageService.fetchOrgMembersRemote(id).then(({ members, fromCache }) => {
      setMembers(members);
      setMembersFallback(fromCache);
    }).catch(() => setMembersFallback(true));
    StorageService.fetchOrgInventoryRemote(id).then(({ inventory, fromCache }) => {
      setInventory(inventory);
      setInventoryFallback(fromCache);
      setLastInventoryUpdated(new Date().toISOString());
    });
    listRequests(id)
      .then((data) => {
        setRequestsFallback(false);
        setRequests(data);
      })
      .catch(() => {
        setRequestsFallback(true);
        setRequests(StorageService.getOrgReplenishmentRequests(id));
      });
    StorageService.fetchMemberStatus(id).then((resp) => {
      if (resp?.counts) setStatusCounts(resp.counts);
      if (resp?.members?.length) setMembers(resp.members as any);
    });

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const stats = {
    total: members.length,
    safe: statusCounts.safe || members.filter(m => m.status === 'SAFE').length,
    danger: statusCounts.danger || members.filter(m => m.status === 'DANGER').length,
    unknown: statusCounts.unknown || members.filter(m => m.status === 'UNKNOWN').length,
  };

  // Use member count for coverage; fallback to registeredPopulation if no linked members yet
  const coverageBase = stats.total || registeredPopulation;

  const handleInventoryChange = (key: keyof OrgInventory, value: number) => {
    const safeVal = Math.max(0, Number.isFinite(value) ? value : 0);
    setInventory(prev => ({ ...prev, [key]: safeVal }));
    setHasChanges(true);
  };

  const saveInventory = () => {
    const summary = `Water: ${inventory.water}\nFood: ${inventory.food}\nBlankets: ${inventory.blankets}\nMed Kits: ${inventory.medicalKits}\n\nSave these counts?`;
    if (!window.confirm(summary)) return;
    StorageService.updateOrgInventory(communityId, inventory);
    StorageService.saveOrgInventoryRemote(communityId, inventory);
    setLastInventoryUpdated(new Date().toISOString());
    setHasChanges(false);
    alert("Inventory Updated in Central Database");
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(communityId);
    alert(`Copied Community ID: ${communityId}`);
  };

  const openBroadcastModal = () => {
    setBroadcastDraft('');
    setBroadcastStep('COMPOSE');
    setModerationError(null);
    setShowBroadcastModal(true);
  };

  const checkContentSafety = async (text: string): Promise<boolean> => {
    setIsModerating(true);
    setModerationError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Analyze this broadcast message for an emergency app: "${text}". 
        Does it contain profanity, hate speech, threats, or extremely rude language? 
        If it is safe and appropriate for public broadcast, return strictly "SAFE". 
        If it contains prohibited content, return "UNSAFE".`,
      });
      
      const result = response.text?.trim().toUpperCase();
      setIsModerating(false);
      
      if (result?.includes("SAFE") && !result?.includes("UNSAFE")) {
        return true;
      } else {
        setModerationError("Message flagged as inappropriate or rude by AI system.");
        return false;
      }
    } catch (e) {
      console.error("Moderation failed", e);
      // Fallback: simple banned word check
      const banned = ['hate', 'kill', 'stupid', 'idiot', 'damn', 'hell'];
      if (banned.some(word => text.toLowerCase().includes(word))) {
        setModerationError("Message contains prohibited words.");
        setIsModerating(false);
        return false;
      }
      setIsModerating(false);
      return true;
    }
  };

  const handleReviewClick = async () => {
    if (!broadcastDraft.trim()) return;
    
    // Auto-moderate before review
    const isSafe = await checkContentSafety(broadcastDraft);
    if (isSafe) {
      setBroadcastStep('CONFIRM');
    }
  };

  const confirmBroadcast = () => {
    if (broadcastDraft.trim()) {
      // Scoped Update: Only updates for this Org
      StorageService.updateOrgBroadcast(communityId, broadcastDraft);
      setShowBroadcastModal(false);
      alert(`Broadcast sent to all members linked to ${orgName}.`);
    }
  };

  const handlePingMember = () => {
    if (selectedMember) {
      const success = StorageService.sendPing(selectedMember.id);
      if (success) {
        alert(`Ping sent to ${selectedMember.name}. They will see a status check prompt on their dashboard.`);
      } else {
        alert("Failed to ping member.");
      }
    }
  };

  const handleSubmitRequest = async () => {
    try {
      // Try API first, but fall back to local storage
      try {
        await createRequest(communityId, { item: selectedItem, quantity: requestAmount, provider: replenishmentProvider, orgName });
        const refreshed = await listRequests(communityId);
        setRequests(refreshed);
      } catch (apiError) {
        console.warn('API request failed, using local storage:', apiError);
        // Use local storage as fallback
        StorageService.createReplenishmentRequest(communityId, {
          item: selectedItem,
          quantity: requestAmount,
          provider: replenishmentProvider,
          orgName
        });
        const localRequests = StorageService.getOrgReplenishmentRequests(communityId);
        setRequests(localRequests);
      }
      setRequestSuccess(true);
    } catch (e) {
      console.error(e);
      alert('Failed to submit request. Please try again.');
    }
    
    setTimeout(() => {
      setIsRequesting(false);
      setRequestSuccess(false);
    }, 4000);
  };

  const handleStock = (req: ReplenishmentRequest) => {
    const defaultQty = req.quantity;
    const input = window.prompt(`Enter stocked quantity for ${req.item}:`, String(defaultQty));
    if (input === null) return; // User clicked Cancel
    const qty = parseInt(input);
    if (!Number.isFinite(qty) || qty < 0) {
      alert("Enter a valid non-negative quantity.");
      return;
    }

    setStockLoading(true);
    
    // Try API first, fall back to local storage
    updateRequestStatus(req.id, { status: 'STOCKED', deliveredQuantity: qty })
      .then(async () => {
        const refreshedReqs = await listRequests(communityId);
        setRequests(refreshedReqs);
        StorageService.fetchOrgInventoryRemote(communityId).then(setInventory);
      })
      .catch(() => {
        // Use local storage as fallback
        console.warn('API update failed, using local storage');
        const itemKey = req.item.toLowerCase().includes('water') ? 'water' :
                       req.item.toLowerCase().includes('food') ? 'food' :
                       req.item.toLowerCase().includes('blanket') ? 'blankets' : 'medicalKits';
        
        const delivered = { [itemKey]: qty };
        StorageService.stockReplenishment(req.id, delivered);
        
        const localRequests = StorageService.getOrgReplenishmentRequests(communityId);
        setRequests(localRequests);
        
        const updatedInv = StorageService.getOrgInventory(communityId);
        setInventory(updatedInv);
      })
      .finally(() => setStockLoading(false));
  };

  const status = getInventoryStatuses(inventory, coverageBase);
  const readinessThresholds = { stocked: 0.8, reorder: 0.3 };
  const toReadinessLabel = (level: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN') => {
    if (level === 'HIGH') return { label: 'Stocked', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    if (level === 'MEDIUM') return { label: 'Reorder Soon', tone: 'text-amber-700 bg-amber-50 border-amber-200' };
    if (level === 'LOW') return { label: 'Critical', tone: 'text-red-700 bg-red-50 border-red-200' };
    return { label: 'Unknown', tone: 'text-slate-600 bg-slate-50 border-slate-200' };
  };

  const inventoryLevels = Object.values(status).map((entry) => entry.level);
  const hubStatus = (() => {
    const hasCritical = inventoryLevels.includes('LOW') || stats.danger > 0;
    const hasRisk = inventoryLevels.includes('MEDIUM') || stats.unknown > 0;
    if (hasCritical) return { label: 'Critical', color: 'text-red-700 bg-red-50 border-red-200' };
    if (hasRisk) return { label: 'At Risk', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    return { label: 'Operational', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  })();

  const readinessItems = [
    { label: 'Water', key: 'water' as const, unit: 'cases' },
    { label: 'Food', key: 'food' as const, unit: 'boxes' },
    { label: 'Blankets', key: 'blankets' as const, unit: 'units' },
    { label: 'Med Kits', key: 'medicalKits' as const, unit: 'kits' },
  ];

  const alertItems = [
    stats.danger > 0
      ? { id: 'member-danger', severity: 'Critical', message: `${stats.danger} member(s) marked DANGER`, unread: true }
      : null,
    lowItems.length > 0
      ? { id: 'inventory-low', severity: 'At Risk', message: `Low inventory on ${lowItems.length} item(s)`, unread: true }
      : null,
    orgName && communityId
      ? { id: 'broadcast', severity: 'Info', message: `Last broadcast ready for ${orgName}`, unread: false }
      : null,
  ].filter(Boolean) as Array<{ id: string; severity: 'Critical' | 'At Risk' | 'Info'; message: string; unread: boolean }>;

  const sortedAlerts = [...alertItems].sort((a, b) => {
    const rank = { 'Critical': 0, 'At Risk': 1, 'Info': 2 } as const;
    return rank[a.severity] - rank[b.severity];
  });
  const lowItems = [
    { label: 'Water Cases', key: 'water' as const, unit: 'cases' },
    { label: 'Food Boxes', key: 'food' as const, unit: 'boxes' },
    { label: 'Blankets', key: 'blankets' as const, unit: 'units' },
    { label: 'Med Kits', key: 'medicalKits' as const, unit: 'kits' },
  ].filter(item => status[item.key].level === 'LOW');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-safe animate-fade-in relative">
      {(inventoryFallback || requestsFallback) && (
        <div className="mx-4 mb-2 text-xs text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center justify-between">
          <span>
            {inventoryFallback && 'Using cached inventory'}{inventoryFallback && requestsFallback ? ' • ' : ''}
            {requestsFallback && 'Using cached requests'}
          </span>
          <span className="text-amber-500">Check API connection</span>
        </div>
      )}
      {/* Broadcast Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2">
                <Send size={18} /> {t('org.broadcast')}
              </h3>
              <button onClick={() => setShowBroadcastModal(false)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6">
              {broadcastStep === 'COMPOSE' ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-brand-600 font-medium bg-brand-50 p-2 rounded-lg">
                    <Building2 size={16} />
                    <span>Sending to members of <strong>{orgName}</strong></span>
                  </div>
                  <Textarea 
                    label="Message Content"
                    placeholder="e.g., Food distribution starts at 2PM in the main hall..."
                    value={broadcastDraft}
                    onChange={(e) => setBroadcastDraft(e.target.value)}
                    className="min-h-[120px] text-lg font-medium"
                  />
                  
                  {moderationError && (
                    <div className="bg-red-50 text-red-600 text-sm font-bold p-3 rounded-lg flex items-center gap-2 animate-pulse">
                      <AlertOctagon size={16} /> {moderationError}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button variant="ghost" fullWidth onClick={() => setShowBroadcastModal(false)}>Cancel</Button>
                    <Button 
                      fullWidth 
                      disabled={!broadcastDraft.trim() || isModerating} 
                      onClick={handleReviewClick}
                    >
                      {isModerating ? (
                        <><Loader2 className="animate-spin mr-2" size={18}/> Checking...</>
                      ) : (
                        <><Wand2 className="mr-2" size={18}/> Review</>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 text-center">
                  <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto text-brand-600 mb-2">
                    <ShieldCheck size={32} />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-slate-900 mb-2">Message Approved</h4>
                    <p className="text-slate-500 text-sm mb-4">Ready to broadcast to your community members:</p>
                    <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 text-slate-900 font-medium text-left italic">
                      "{broadcastDraft}"
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="secondary" fullWidth onClick={() => setBroadcastStep('COMPOSE')}>Edit</Button>
                    <Button 
                      fullWidth 
                      className="bg-brand-600 hover:bg-brand-700 text-white font-bold"
                      onClick={confirmBroadcast}
                    >
                      SEND NOW
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{orgName} — Hub Admin</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="px-2 py-1 text-[11px] font-bold uppercase bg-slate-100 text-slate-700 rounded">Institution Admin</span>
              <span className={`px-2 py-1 text-[11px] font-bold uppercase border rounded ${hubStatus.color}`}>
                {hubStatus.label === 'Operational' ? '🟢' : hubStatus.label === 'At Risk' ? '🟡' : '🔴'} {hubStatus.label}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              sessionStorage.setItem('openHubSettings', '1');
              setView('SETTINGS');
            }}
            className="text-sm font-bold text-brand-700 hover:text-brand-800"
          >
            Manage Hub Settings
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Hub Readiness Overview</h2>
              <p className="text-xs text-slate-500">
                Thresholds: Stocked ≥ {Math.round(readinessThresholds.stocked * 100)}% • Reorder Soon ≥ {Math.round(readinessThresholds.reorder * 100)}%
              </p>
            </div>
            <div className="text-xs text-slate-500 font-semibold">
              Last Updated: {lastInventoryUpdated ? new Date(lastInventoryUpdated).toLocaleString() : 'Unknown'}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {readinessItems.map((item) => {
              const entry = status[item.key];
              const readiness = toReadinessLabel(entry.level);
              return (
                <div key={item.label} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                  <p className="text-xs text-slate-500 font-bold uppercase">{item.label}</p>
                  <p className="text-xl font-bold text-slate-900">{inventory[item.key]} <span className="text-xs font-semibold text-slate-500">{item.unit}</span></p>
                  <span className={`mt-2 inline-flex items-center px-2 py-1 text-[11px] font-bold rounded border ${readiness.tone}`}>
                    {readiness.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">Coverage base: {coverageBase || 'Unknown'} members</p>
            <Button
              className="font-bold"
              onClick={() => {
                const firstLow = lowItems[0];
                const needed = firstLow ? getRecommendedResupply(inventory[firstLow.key], coverageBase) || 1 : 1;
                if (firstLow) setSelectedItem(firstLow.label);
                setRequestAmount(Math.max(1, needed));
                setIsRequesting(true);
                requestsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              Request Refill
            </Button>
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl p-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-white">
          <Button variant="ghost" fullWidth className="bg-white/10 hover:bg-white/20 text-white" onClick={() => requestsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            Request Supplies
          </Button>
          <Button variant="ghost" fullWidth className="bg-white/10 hover:bg-white/20 text-white" onClick={openBroadcastModal}>
            Broadcast Update
          </Button>
          <Button variant="ghost" fullWidth className="bg-white/10 hover:bg-white/20 text-white" onClick={() => requestsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            Approve Requests
          </Button>
          <Button variant="ghost" fullWidth className="bg-white/10 hover:bg-white/20 text-white" onClick={() => { setShowMembersPanel(true); membersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
            View Members
          </Button>
        </div>

        <div ref={requestsRef} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Supply Requests</h3>
              <p className="text-xs text-slate-500">Track and request hub supplies</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">{requests.length} total</span>
          </div>

          <div className="mt-4">
            {!isRequesting ? (
              <Button variant="outline" onClick={() => setIsRequesting(true)} className="text-slate-900 border-slate-300">
                Request Supplies
              </Button>
            ) : requestSuccess ? (
              <div className="bg-green-50 text-green-700 p-4 rounded-lg text-center font-bold flex flex-col items-center animate-fade-in border border-green-100">
                <CheckCircle size={32} className="mb-2" />
                {isOffline ? (
                  <>
                    Request Queued for Sync
                    <span className="text-xs font-normal mt-1 flex items-center gap-1"><WifiOff size={10}/> Will send when online</span>
                  </>
                ) : (
                  `Request Sent to ${replenishmentProvider}`
                )}
              </div>
            ) : (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3 animate-fade-in">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Item</label>
                  <select 
                    className="w-full p-2 rounded border border-slate-300 text-sm bg-white text-slate-900 font-bold"
                    value={selectedItem}
                    onChange={(e) => setSelectedItem(e.target.value)}
                  >
                    <option value="Water Cases">Water Cases</option>
                    <option value="Food Boxes">Food Boxes</option>
                    <option value="Blankets">Blankets</option>
                    <option value="Medical Kits">Medical Kits</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantity</label>
                  <input 
                    type="number" 
                    min="1"
                    className="w-full p-2 rounded border border-slate-300 text-sm text-slate-900 font-bold"
                    value={requestAmount}
                    onChange={(e) => setRequestAmount(parseInt(e.target.value))}
                  />
                </div>
                <div className="text-xs text-slate-600 text-right">
                   Provider: <span className="font-bold text-slate-900">{replenishmentProvider}</span>
                </div>
                <div className="flex gap-2 pt-2">
                   <Button variant="ghost" size="sm" onClick={() => setIsRequesting(false)} className="flex-1 text-slate-700">{t('btn.cancel')}</Button>
                   <Button size="sm" className="flex-1" onClick={handleSubmitRequest}>
                     {isOffline ? 'Queue Offline' : t('org.submit_req')}
                   </Button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900">Recent Requests</h4>
              <span className="text-xs text-slate-500 font-bold">Latest first</span>
            </div>
            {requests.length === 0 && (
              <p className="text-sm text-slate-500">No requests yet.</p>
            )}
            {requests.slice(0, 5).map((req) => (
              <div key={req.id} className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{req.item}</p>
                    <p className="text-xs text-slate-500">Qty: {req.quantity} • {new Date(req.timestamp).toLocaleString()}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    req.status === 'FULFILLED' ? 'bg-green-100 text-green-700' :
                    req.status === 'STOCKED' ? 'bg-emerald-100 text-emerald-700' :
                    req.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {req.status}
                  </span>
                </div>

                {req.status === 'FULFILLED' && (
                  <div className="mt-3 flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant={req.stocked ? "ghost" : "outline"} 
                      onClick={() => !req.stocked && handleStock(req)}
                      disabled={req.stocked || stockLoading}
                    >
                      {req.stocked ? (
                        <>Stocked</>
                      ) : (
                        <>
                          {stockLoading ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                          Mark Stocked
                        </>
                      )}
                    </Button>
                    {req.stocked && req.stockedAt && (
                      <span className="text-[11px] text-slate-500 font-bold">
                        Stocked at {new Date(req.stockedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm" ref={membersRef}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Community & Membership</h3>
              <p className="text-xs text-slate-500">Member oversight and approvals</p>
            </div>
            <div className="text-xs text-slate-500 font-semibold">Total Members: {stats.total}</div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-500 font-bold uppercase">Pending Approvals</p>
              <p className="text-xl font-bold text-slate-900">0</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-500 font-bold uppercase">Safety Overview</p>
              <p className="text-sm text-slate-700">Safe: {stats.safe} • Danger: {stats.danger} • Unknown: {stats.unknown}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={() => setShowMembersPanel((prev) => !prev)}>
              Manage Members
            </Button>
            <Button size="sm" variant="outline" onClick={() => { sessionStorage.setItem('openHubSettings', '1'); setView('SETTINGS'); }}>
              Edit Community Info
            </Button>
            <button
              onClick={() => setShowCommunityId((prev) => !prev)}
              className="text-xs font-bold text-slate-500 hover:text-slate-700"
            >
              {showCommunityId ? 'Hide Community ID' : 'Show Community ID'}
            </button>
          </div>

          {showCommunityId && (
            <div className="mt-3 flex items-center gap-2 bg-slate-900 text-white p-3 rounded-lg">
              <span className="text-xs font-bold uppercase text-slate-300">Community ID</span>
              <span className="font-mono font-black tracking-widest text-brand-300">{communityId}</span>
              <Button size="sm" variant="ghost" className="ml-auto text-white" onClick={copyToClipboard}>
                <Copy size={14} className="mr-2" /> Copy
              </Button>
            </div>
          )}

          {showMembersPanel && (
            <div className="mt-4">
              {selectedMember ? (
                <div className="space-y-4">
                  <Button variant="ghost" onClick={() => setSelectedMember(null)} className="pl-0 text-slate-500">
                    <ArrowLeft size={16} className="mr-1" /> Back to list
                  </Button>
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
                    <div className={`p-6 ${selectedMember.status === 'SAFE' ? 'bg-green-600' : selectedMember.status === 'DANGER' ? 'bg-red-600' : 'bg-slate-600'} text-white`}>
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center font-bold text-2xl border-2 border-white/30">
                          {selectedMember.name.charAt(0)}
                        </div>
                        <div>
                          <h2 className="text-xl font-bold">{selectedMember.name}</h2>
                          <div className="flex items-center gap-1.5 mt-1 bg-black/20 w-fit px-2 py-0.5 rounded text-xs font-bold uppercase">
                            {selectedMember.status === 'SAFE' && <CheckCircle size={12} />}
                            {selectedMember.status === 'DANGER' && <AlertTriangle size={12} />}
                            {selectedMember.status === 'UNKNOWN' && <HelpCircle size={12} />}
                            {selectedMember.status}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <Button size="sm" onClick={handlePingMember} className="bg-purple-600 hover:bg-purple-700 text-white">
                        <BellRing size={16} className="mr-2" /> Ping Member
                      </Button>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <h3 className="font-bold text-slate-900">Contact Info</h3>
                          <p className="text-sm text-slate-700">{selectedMember.phone || 'No phone on file'}</p>
                          <p className="text-sm text-slate-700">{selectedMember.address || 'No address on file'}</p>
                        </div>
                        <div className="space-y-2">
                          <h3 className="font-bold text-slate-900">Current Status</h3>
                          <p className="text-sm text-slate-700">Last update: {selectedMember.lastUpdate}</p>
                          <p className="text-sm text-slate-700">Location: {selectedMember.location}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {members.length === 0 && (
                    <p className="text-center text-slate-500">No members linked to {communityId} yet.</p>
                  )}
                  {members.map(member => (
                    <div 
                      key={member.id} 
                      onClick={() => setSelectedMember(member)}
                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-brand-400 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                          member.status === 'SAFE' ? 'bg-green-500' : 
                          member.status === 'DANGER' ? 'bg-red-500' : 'bg-slate-400'
                        }`}>
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 group-hover:text-brand-700 transition-colors">{member.name}</h3>
                          <p className="text-xs text-slate-600 font-medium">{member.location} • {member.lastUpdate}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {member.status === 'SAFE' && <CheckCircle className="text-green-500" />}
                        {member.status === 'DANGER' && <AlertTriangle className="text-red-500 animate-pulse" />}
                        {member.status === 'UNKNOWN' && <HelpCircle className="text-slate-300" />}
                        <ArrowLeft size={16} className="text-slate-300 rotate-180 group-hover:text-brand-500 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm" ref={alertsRef}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Hub Alerts & Announcements</h3>
              <p className="text-xs text-slate-500">Severity ordered, newest first</p>
            </div>
            <button onClick={openBroadcastModal} className="text-xs font-bold text-brand-700 hover:text-brand-800">
              View All
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {sortedAlerts.length === 0 && (
              <p className="text-sm text-slate-500">No alerts right now.</p>
            )}
            {sortedAlerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{alert.message}</p>
                  <span className={`text-[11px] font-bold ${
                    alert.severity === 'Critical' ? 'text-red-700' : alert.severity === 'At Risk' ? 'text-amber-700' : 'text-slate-600'
                  }`}>
                    {alert.severity}
                  </span>
                </div>
                {alert.unread && (
                  <span className="text-[10px] font-bold uppercase bg-brand-100 text-brand-700 px-2 py-1 rounded">Unread</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Regional Resource Context</h3>
            <p className="text-xs text-slate-500">Read‑only reference for regional supply chain</p>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-500 font-bold uppercase">Provider</p>
              <p className="text-sm font-semibold text-slate-900">{replenishmentProvider || 'Not set'}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-500 font-bold uppercase">Contact Email</p>
              <p className="text-sm font-semibold text-slate-900">{replenishmentEmail || 'Not set'}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-500 font-bold uppercase">Contact Phone</p>
              <p className="text-sm font-semibold text-slate-900">{replenishmentProvider ? 'On file' : 'Not set'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <button
            onClick={() => setShowRecovery((prev) => !prev)}
            className="w-full flex items-center justify-between"
          >
            <div>
              <h3 className="text-lg font-bold text-slate-900">Recovery & Supply Chain</h3>
              <p className="text-xs text-slate-500">External • Post‑Incident</p>
            </div>
            {showRecovery ? <ChevronUp size={20} className="text-slate-500" /> : <ChevronDown size={20} className="text-slate-500" />}
          </button>

          {showRecovery && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <h4 className="font-bold text-slate-900">G.A.P. Center</h4>
                <p className="text-xs text-slate-500">External • Post‑Incident</p>
                <Button size="sm" className="mt-3" onClick={() => setView('GAP')}>Open</Button>
              </div>
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <h4 className="font-bold text-slate-900">Logistics</h4>
                <p className="text-xs text-slate-500">External • Post‑Incident</p>
                <Button size="sm" className="mt-3" onClick={() => setView('LOGISTICS')}>Open</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
