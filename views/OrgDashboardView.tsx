
import React, { useState, useEffect } from 'react';
import { ViewState, OrgMember, OrgInventory, ReplenishmentRequest } from '../types';
import { Button } from '../components/Button';
import { StorageService } from '../services/storage';
import { t } from '../services/translations';
import { Building2, CheckCircle, AlertTriangle, HelpCircle, Package, ArrowLeft, Send, Truck, Copy, Save, Phone, MapPin, User, HeartPulse, BellRing, X, AlertOctagon, Loader2, Wand2, ShieldCheck, WifiOff } from 'lucide-react';
import { Textarea } from '../components/Input';
import { GoogleGenAI } from "@google/genai";

export const OrgDashboardView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [inventory, setInventory] = useState<OrgInventory>({ water: 0, food: 0, blankets: 0, medicalKits: 0 });
  const [activeTab, setActiveTab] = useState<'MEMBERS' | 'INVENTORY'>('MEMBERS');
  const [orgName, setOrgName] = useState('Community Organization');
  const [communityId, setCommunityId] = useState('');
  const [requests, setRequests] = useState<ReplenishmentRequest[]>([]);
  
  // Member Detail State
  const [selectedMember, setSelectedMember] = useState<OrgMember | null>(null);
  
  // Replenishment Details
  const [replenishmentProvider, setReplenishmentProvider] = useState('Central Warehouse');
  const [replenishmentEmail, setReplenishmentEmail] = useState('');
  
  // Inventory Edit State
  const [hasChanges, setHasChanges] = useState(false);

  // Request Feature State
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [selectedItem, setSelectedItem] = useState('Water Cases');
  const [requestAmount, setRequestAmount] = useState(10);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [fulfillDraft, setFulfillDraft] = useState<{ id: string | null; quantity: number }>({ id: null, quantity: 0 });
  const [fulfillLoading, setFulfillLoading] = useState(false);
  const [stockLoading, setStockLoading] = useState(false);

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
    }
    
    // Load Live Data from Backend
    setMembers(StorageService.getOrgMembers(id));
    setInventory(StorageService.getOrgInventory(id));
    setRequests(StorageService.getOrgReplenishmentRequests(id));

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
    safe: members.filter(m => m.status === 'SAFE').length,
    danger: members.filter(m => m.status === 'DANGER').length,
    unknown: members.filter(m => m.status === 'UNKNOWN').length,
  };

  const handleInventoryChange = (key: keyof OrgInventory, value: number) => {
    const safeVal = Math.max(0, Number.isFinite(value) ? value : 0);
    setInventory(prev => ({ ...prev, [key]: safeVal }));
    setHasChanges(true);
  };

  const saveInventory = () => {
    const summary = `Water: ${inventory.water}\nFood: ${inventory.food}\nBlankets: ${inventory.blankets}\nMed Kits: ${inventory.medicalKits}\n\nSave these counts?`;
    if (!window.confirm(summary)) return;
    StorageService.updateOrgInventory(communityId, inventory);
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

  const handleSubmitRequest = () => {
    // 1. Submit to Backend (will handle offline queue)
    StorageService.submitReplenishmentRequest(communityId, selectedItem, requestAmount);
    setRequests(StorageService.getOrgReplenishmentRequests(communityId));
    setRequestSuccess(true);

    // 2. Trigger Email (Simulated external comms - only works if online)
    if (replenishmentEmail && navigator.onLine) {
      const subject = `Urgent Resupply Request - ${communityId} - ${orgName}`;
      const body = `To ${replenishmentProvider},%0D%0A%0D%0APlease fulfill the following emergency supply request:%0D%0A%0D%0AItem: ${selectedItem}%0D%0AQuantity: ${requestAmount}%0D%0A%0D%0AHub: ${orgName}%0D%0AID: ${communityId}%0D%0A%0D%0ASent via AERA App`;
      window.location.href = `mailto:${replenishmentEmail}?subject=${subject}&body=${body}`;
    }
    
    setTimeout(() => {
      setIsRequesting(false);
      setRequestSuccess(false);
    }, 4000);
  };

  const handleStartFulfill = (req: ReplenishmentRequest) => {
    setFulfillDraft({ id: req.id, quantity: req.quantity });
  };

  const handleSubmitFulfill = () => {
    if (!fulfillDraft.id) return;
    if (!Number.isFinite(fulfillDraft.quantity) || fulfillDraft.quantity < 0) {
      alert("Enter a valid delivered quantity.");
      return;
    }

    const request = requests.find(r => r.id === fulfillDraft.id);
    if (!request) return;

    const itemMap: Record<string, keyof OrgInventory> = {
      'Water Cases': 'water',
      'Food Boxes': 'food',
      'Blankets': 'blankets',
      'Medical Kits': 'medicalKits'
    };
    const key = itemMap[request.item];
    if (!key) {
      alert("Unknown item type.");
      return;
    }

    const confirmMsg = `Mark as fulfilled?\nItem: ${request.item}\nDelivered: ${fulfillDraft.quantity}\nOrg: ${request.orgName}`;
    if (!window.confirm(confirmMsg)) return;

    setFulfillLoading(true);
    StorageService.fulfillReplenishmentRequest(request.id, { [key]: fulfillDraft.quantity }, 'FULFILLED');
    setRequests(StorageService.getOrgReplenishmentRequests(communityId));
    setFulfillDraft({ id: null, quantity: 0 });
    setFulfillLoading(false);
  };

  const handleStock = (req: ReplenishmentRequest) => {
    const itemMap: Record<string, keyof OrgInventory> = {
      'Water Cases': 'water',
      'Food Boxes': 'food',
      'Blankets': 'blankets',
      'Medical Kits': 'medicalKits'
    };
    const key = itemMap[req.item];
    if (!key) {
      alert("Unknown item type.");
      return;
    }
    const defaultQty = req.quantity;
    const input = window.prompt(`Enter stocked quantity for ${req.item}:`, String(defaultQty));
    if (input === null) return;
    const qty = parseInt(input);
    if (!Number.isFinite(qty) || qty < 0) {
      alert("Enter a valid non-negative quantity.");
      return;
    }
    if (!window.confirm(`Confirm stocked:\nItem: ${req.item}\nQuantity: ${qty}`)) return;

    setStockLoading(true);
    StorageService.stockReplenishmentRequest(req.id, { [key]: qty });
    setInventory(StorageService.getOrgInventory(communityId));
    setRequests(StorageService.getOrgReplenishmentRequests(communityId));
    setStockLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-safe animate-fade-in relative">
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

      {/* Organization Header */}
      <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('SETTINGS')} className="p-2 -ml-2 text-slate-500 hover:text-slate-800">
              <ArrowLeft size={24} />
            </button>
            <div>
               <h1 className="font-bold text-lg text-slate-900 leading-tight">{orgName}</h1>
               <div className="flex items-center gap-1 text-xs text-brand-600 font-bold bg-brand-50 px-2 py-0.5 rounded w-fit mt-1">
                 <Building2 size={12} /> {t('org.verified')}
               </div>
            </div>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            className="border-slate-300 text-slate-900 hover:bg-slate-50"
            onClick={openBroadcastModal}
          >
            <Send size={16} className="mr-2" /> {t('org.broadcast')}
          </Button>
        </div>

        {/* Rest of Dashboard UI (Same as previous) */}
        <div className="bg-slate-900 text-white p-3 rounded-xl mb-4 flex items-center justify-between shadow-md">
           <div>
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('org.code')}</p>
             <p className="text-xl font-mono font-black tracking-widest text-brand-400">{communityId}</p>
           </div>
           <Button 
             size="sm" 
             className="bg-slate-700 hover:bg-slate-600 text-white border-0"
             onClick={copyToClipboard}
           >
             <Copy size={16} className="mr-2" /> {t('org.copy')}
           </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-red-50 border border-red-100 p-2 rounded-lg text-center">
             <span className="block text-2xl font-bold text-red-600">{stats.danger}</span>
             <span className="text-xs text-red-800 font-bold uppercase">{t('status.danger')}</span>
          </div>
          <div className="bg-green-50 border border-green-100 p-2 rounded-lg text-center">
             <span className="block text-2xl font-bold text-green-600">{stats.safe}</span>
             <span className="text-xs text-green-800 font-bold uppercase">{t('status.safe')}</span>
          </div>
          <div className="bg-slate-100 border border-slate-200 p-2 rounded-lg text-center">
             <span className="block text-2xl font-bold text-slate-600">{stats.unknown}</span>
             <span className="text-xs text-slate-500 font-bold uppercase">{t('status.unknown')}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex bg-white border-b border-slate-200">
         <button 
           onClick={() => { setActiveTab('MEMBERS'); setSelectedMember(null); }}
           className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'MEMBERS' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500'}`}
         >
           {t('org.tab.members')}
         </button>
         <button 
           onClick={() => setActiveTab('INVENTORY')}
           className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'INVENTORY' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500'}`}
         >
           {t('org.tab.inventory')}
         </button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        {activeTab === 'MEMBERS' && (
          selectedMember ? (
            // Detail View
            <div className="space-y-6 animate-slide-up">
              <Button variant="ghost" onClick={() => setSelectedMember(null)} className="pl-0 text-slate-500">
                <ArrowLeft size={16} className="mr-1" /> Back to list
              </Button>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
                <div className={`p-6 ${selectedMember.status === 'SAFE' ? 'bg-green-600' : selectedMember.status === 'DANGER' ? 'bg-red-600' : 'bg-slate-600'} text-white`}>
                   <div className="flex items-center justify-between">
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
                </div>

                <div className="p-6 space-y-6">
                   <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <h4 className="text-purple-900 font-bold text-sm">Status Check</h4>
                        <p className="text-purple-700 text-xs">Request immediate update.</p>
                      </div>
                      <Button size="sm" onClick={handlePingMember} className="bg-purple-600 hover:bg-purple-700 text-white">
                        <BellRing size={16} className="mr-2" /> Ping Member
                      </Button>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                         <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                           <User size={18} className="text-slate-400" /> Contact Info
                         </h3>
                         <div className="space-y-3">
                            <div>
                               <p className="text-xs text-slate-500 font-bold uppercase">Phone</p>
                               <a href={`tel:${selectedMember.phone}`} className="text-blue-600 font-bold hover:underline flex items-center gap-1">
                                 <Phone size={14} /> {selectedMember.phone || 'N/A'}
                               </a>
                            </div>
                            <div>
                               <p className="text-xs text-slate-500 font-bold uppercase">Home Address</p>
                               <p className="text-slate-900">{selectedMember.address || 'Not Provided'}</p>
                            </div>
                            <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                               <p className="text-xs text-red-600 font-bold uppercase mb-1">Emergency Contact</p>
                               <div className="text-slate-900 font-medium">
                                 {selectedMember.emergencyContactName ? (
                                   <>
                                     <p>{selectedMember.emergencyContactName} ({selectedMember.emergencyContactRelation})</p>
                                     <a href={`tel:${selectedMember.emergencyContactPhone}`} className="text-red-700 hover:underline font-bold text-sm">
                                       {selectedMember.emergencyContactPhone}
                                     </a>
                                   </>
                                 ) : (
                                   <p>None Listed</p>
                                 )}
                               </div>
                            </div>
                         </div>
                      </div>

                      <div className="space-y-4">
                         <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                           <HeartPulse size={18} className="text-slate-400" /> Current Status
                         </h3>
                         <div className="space-y-3">
                            <div>
                               <p className="text-xs text-slate-500 font-bold uppercase">Last Location</p>
                               <div className="flex items-center gap-2 text-slate-900">
                                  <MapPin size={16} className="text-slate-400" />
                                  {selectedMember.location}
                               </div>
                            </div>
                            <div>
                               <p className="text-xs text-slate-500 font-bold uppercase">Last Update</p>
                               <p className="text-slate-900">{selectedMember.lastUpdate}</p>
                            </div>
                            {selectedMember.needs.length > 0 && (
                               <div>
                                  <p className="text-xs text-slate-500 font-bold uppercase mb-1">Reported Needs</p>
                                  <div className="flex flex-wrap gap-1">
                                    {selectedMember.needs.map(n => (
                                      <span key={n} className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded">{n}</span>
                                    ))}
                                  </div>
                               </div>
                            )}
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          ) : (
            // List View
            <div className="space-y-3">
               {members.length === 0 && (
                 <p className="text-center text-slate-500 mt-8">No members linked to {communityId} yet.</p>
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
                         {member.needs.length > 0 && (
                           <div className="flex gap-1 mt-1">
                             {member.needs.map(n => (
                               <span key={n} className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-bold uppercase">{n}</span>
                             ))}
                           </div>
                         )}
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
          )
        )}

        {/* Inventory Tab (Same as previous) */}
        {activeTab === 'INVENTORY' && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
              <Package className="text-blue-600 mt-1" />
              <div>
                <h3 className="font-bold text-blue-900">{t('org.manage_res')}</h3>
                <p className="text-sm text-blue-800">{t('org.manage_desc')}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               {[
                 { label: 'Water Cases', key: 'water', unit: 'cases' },
                 { label: 'Food Boxes', key: 'food', unit: 'boxes' },
                 { label: 'Blankets', key: 'blankets', unit: 'units' },
                 { label: 'Med Kits', key: 'medicalKits', unit: 'kits' },
               ].map((item) => (
                 <div key={item.label} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                    <p className="text-slate-500 text-xs font-bold uppercase mb-1">{item.label}</p>
                    {/* @ts-ignore */}
                    <input 
                      type="number"
                      min="0"
                      className="w-full mt-2 p-2 rounded-lg border border-slate-300 text-center font-bold text-slate-900"
                      value={inventory[item.key as keyof OrgInventory]}
                      onChange={(e) => handleInventoryChange(item.key as keyof OrgInventory, parseInt(e.target.value))}
                    />
                    <p className="text-slate-400 text-xs mt-1">{item.unit}</p>
                  </div>
               ))}
            </div>
            
            <Button fullWidth className="font-bold" onClick={saveInventory} disabled={!hasChanges}>
               <Save size={18} className="mr-2" /> {hasChanges ? t('btn.save') : 'All Saved'}
            </Button>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mt-4">
              <div className="flex items-center gap-2 mb-3">
                 <Truck className="text-brand-600" size={20} />
                 <h3 className="font-bold text-slate-900">{t('org.req_replenish')}</h3>
              </div>
              <p className="text-sm text-slate-600 mb-4 font-medium">{t('org.req_desc')}</p>
              
              {!isRequesting ? (
                 <Button variant="outline" fullWidth onClick={() => setIsRequesting(true)} className="text-slate-900 border-slate-300">
                   {t('org.create_req')}
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
                        req.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {req.status}
                      </span>
                    </div>

                    {req.status !== 'FULFILLED' && (
                      <div className="mt-3 space-y-2">
                        {fulfillDraft.id === req.id ? (
                          <div className="flex gap-2 items-center">
                            <input
                              type="number"
                              min="0"
                              className="w-28 p-2 rounded border border-slate-300 text-sm font-bold text-slate-900"
                              value={fulfillDraft.quantity}
                              onChange={(e) => setFulfillDraft(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                            />
                            <Button size="sm" onClick={handleSubmitFulfill} disabled={fulfillLoading}>
                              {fulfillLoading ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                              Mark Fulfilled
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setFulfillDraft({ id: null, quantity: 0 })}>Cancel</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => handleStartFulfill(req)}>
                            Mark Fulfilled
                          </Button>
                        )}
                      </div>
                    )}

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
          </div>
        )}
      </div>
    </div>
  );
};
