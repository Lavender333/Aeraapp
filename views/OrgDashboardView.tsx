
import React, { useState, useEffect, useRef } from 'react';
import { ViewState, OrgMember, OrgInventory, ReplenishmentRequest } from '../types';
import { Button } from '../components/Button';
import { StorageService } from '../services/storage';
import { listRequests, createRequest, updateRequestStatus, fetchOrgOutreachFlags, fetchOrgMemberPreparednessNeeds, listChildOrganizations, aggregateOrgStats, broadcastToOrgs } from '../services/api';
import { REQUEST_ITEM_MAP } from '../services/validation';
import { getInventoryStatuses, getRecommendedResupply } from '../services/inventoryStatus';
import { getOrgByCode } from '../services/supabase';
import { getOrgLeaderOutreachCandidates, listOrgOutreachAuditLogs, logOrgOutreachContact, OrgOutreachCandidate, OrgOutreachAuditLog, OutreachContactMethod } from '../services/eventDistribution';
import { t } from '../services/translations';
import { Building2, CheckCircle, AlertTriangle, HelpCircle, Package, ArrowLeft, Send, Truck, Copy, Save, Phone, MapPin, User, HeartPulse, BellRing, X, AlertOctagon, Loader2, Wand2, ShieldCheck, WifiOff, FileText, Printer, Mail, LocateFixed } from 'lucide-react';
import { Textarea } from '../components/Input';
import { GoogleGenAI } from "../services/mockGenAI";

type OrgDashboardTab = 'MEMBERS' | 'PREPAREDNESS' | 'INVENTORY';
type OrgSelectorOption = { id: string; org_code: string; name: string };

const mergeReplenishmentRequests = (remoteRequests: ReplenishmentRequest[], localRequests: ReplenishmentRequest[]) => {
  const merged = new Map<string, ReplenishmentRequest>();

  [...localRequests, ...remoteRequests].forEach((request) => {
    if (!request?.id) return;
    merged.set(request.id, request);
  });

  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
  );
};

export const OrgDashboardView: React.FC<{ setView: (v: ViewState) => void; initialTab?: OrgDashboardTab; communityIdOverride?: string }> = ({ setView, initialTab = 'MEMBERS', communityIdOverride }) => {
  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

  const normalizeOrgCode = (value: string) =>
    String(value || '')
      .trim()
      .replace(/[–—−]/g, '-')
      .replace(/\s+/g, '')
      .toUpperCase();

  type OutreachFlagRow = {
    organization_id: string;
    state_id: string | null;
    county_id: string | null;
    outreach_flag: 'LOW' | 'MEDIUM' | 'HIGH';
    member_count: number;
    last_updated: string;
  };

  type MemberPreparednessNeedRow = {
    profile_id: string;
    member_name: string;
    phone: string | null;
    readiness_score: number;
    readiness_cap: number;
    risk_tier: string;
    critical_missing_items: Array<{ id?: string; item?: string; explanation?: string | null }>;
    critical_missing_count: number;
    outreach_flags: string[];
    updated_at: string | null;
  };

  const normalizeMember = (member: any): OrgMember => ({
    id: String(member?.id || ''),
    name: String(member?.name || 'Unknown Member'),
    status: (member?.status || 'UNKNOWN') as OrgMember['status'],
    lastUpdate: String(member?.lastUpdate || member?.last_update || 'Unknown'),
    location: String(member?.location || 'Unknown'),
    needs: Array.isArray(member?.needs) ? member.needs : [],
    phone: String(member?.phone || ''),
    address: String(member?.address || ''),
    emergencyContactName: String(member?.emergencyContactName || member?.emergency_contact_name || ''),
    emergencyContactPhone: String(member?.emergencyContactPhone || member?.emergency_contact_phone || ''),
    emergencyContactRelation: String(member?.emergencyContactRelation || member?.emergency_contact_relation || ''),
  });

  const normalizeMembers = (list: any[]): OrgMember[] => (Array.isArray(list) ? list.map(normalizeMember) : []);

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [inventory, setInventory] = useState<OrgInventory>({ water: 0, food: 0, blankets: 0, medicalKits: 0 });
  const [activeTab, setActiveTab] = useState<OrgDashboardTab>(initialTab);
  const [orgName, setOrgName] = useState('Community Organization');
  const [parentOrgName, setParentOrgName] = useState('Community Organization');
  const [communityId, setCommunityId] = useState('');
  // viewOrgId === 'ALL' means show aggregated stats for all child organizations
  const [viewOrgId, setViewOrgId] = useState<string | 'ALL'>('ALL');
  const [childOrgs, setChildOrgs] = useState<Array<{id:string;org_code:string;name:string}>>([]);
  const [isAggregateView, setIsAggregateView] = useState(false);
  const [aggStats, setAggStats] = useState<{memberCounts:{total:number;safe:number;danger:number;unknown:number}; inventory:OrgInventory} | null>(null);
  const [selectedBroadcastTargets, setSelectedBroadcastTargets] = useState<string[]>([]);
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
  const requestFormRef = useRef<HTMLDivElement | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [stockLoading, setStockLoading] = useState(false);
  const [outreachFlags, setOutreachFlags] = useState<OutreachFlagRow[]>([]);
  const [memberNeeds, setMemberNeeds] = useState<MemberPreparednessNeedRow[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [outreachCandidates, setOutreachCandidates] = useState<OrgOutreachCandidate[]>([]);
  const [outreachAuditLogs, setOutreachAuditLogs] = useState<OrgOutreachAuditLog[]>([]);
  const [outreachPanelLoading, setOutreachPanelLoading] = useState(false);
  const [outreachPanelError, setOutreachPanelError] = useState<string | null>(null);
  const [loggingTargetId, setLoggingTargetId] = useState<string | null>(null);

  // Broadcast State
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastDraft, setBroadcastDraft] = useState('');
  const [broadcastStep, setBroadcastStep] = useState<'COMPOSE' | 'CONFIRM'>('COMPOSE');
  const [isModerating, setIsModerating] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const currentOrgOption: OrgSelectorOption | null = React.useMemo(() => {
    const normalizedCode = normalizeOrgCode(communityId);
    if (!normalizedCode) return null;

    const org = StorageService.getOrganization(normalizedCode);
    return {
      id: String(org?.id || normalizedCode),
      org_code: normalizedCode,
      name: String(org?.name || parentOrgName || normalizedCode),
    };
  }, [communityId, parentOrgName]);

  const networkOrgs = React.useMemo(() => {
    const options: OrgSelectorOption[] = [];
    const seen = new Set<string>();

    if (currentOrgOption) {
      options.push(currentOrgOption);
      seen.add(normalizeOrgCode(currentOrgOption.org_code));
    }

    for (const org of childOrgs) {
      const code = normalizeOrgCode(org.org_code);
      if (!code || seen.has(code)) continue;
      options.push({ ...org, org_code: code });
      seen.add(code);
    }

    return options;
  }, [childOrgs, currentOrgOption]);

  useEffect(() => {
    const profile = StorageService.getProfile();
    const id = communityIdOverride || profile.communityId || 'CH-9921';
    setCommunityId(id);
    setParentOrgName(profile.communityName || 'Community Organization');

    // Load Org Data (parent only)
    const org = StorageService.getOrganization(id);
    if (org) {
      setOrgName(org.name);
      setParentOrgName(org.name);
      setReplenishmentProvider(org.replenishmentProvider || 'General Aid Pool');
      setReplenishmentEmail(org.replenishmentEmail || '');
      setRegisteredPopulation(org.registeredPopulation || 0);
    }

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [communityIdOverride]);

  // whenever communityId changes, fetch child org list and compute aggregates
  useEffect(() => {
    if (!communityId) return;
    // In local seed data, organization "id" is actually the org code (e.g. CH-9921).
    // In Supabase, organization "id" is a UUID and org_code is a separate column.
    // We support both by deriving a parent org code from either the local org record or the stored communityId.
    const parent = StorageService.getOrganization(communityId);
    const candidate = normalizeOrgCode((parent as any)?.orgCode || parent?.id || communityId);
    if (!candidate || isUuid(candidate)) {
      console.warn('Unable to resolve parent org code for child-org lookup', { communityId, candidate });
      return;
    }

    listChildOrganizations(candidate)
      .then(async (rows) => {
        setChildOrgs(rows as any[]);
        if (rows && rows.length > 0) {
          // compute aggregates
          const codes = [candidate, ...(rows as any[]).map(r => r.org_code as string)];
          try {
            const agg = await aggregateOrgStats(codes);
            setAggStats(agg as any);
            setIsAggregateView(true);
            setSelectedBroadcastTargets(codes.map(code => String(code || '').toUpperCase().trim()));
          } catch (e) {
            console.warn('aggregateOrgStats failed', e);
          }
        } else {
          setIsAggregateView(false);
          setAggStats(null);
        }
      })
      .catch((e) => {
        console.warn('failed to list child organizations', e);
        setChildOrgs([]);
        setIsAggregateView(false);
        setAggStats(null);
      });
  }, [communityId]);

  // Active org code that the dashboard should display/edit (parent or selected child)
  const activeOrgCode = viewOrgId === 'ALL'
    ? normalizeOrgCode(communityId)
    : normalizeOrgCode(String(viewOrgId));

  // load data for the currently viewed organization (or aggregate)
  useEffect(() => {
    if (!communityId) return;
    const id = viewOrgId === 'ALL' ? normalizeOrgCode(communityId) : normalizeOrgCode(String(viewOrgId));
    // update orgName if viewing a specific child
    if (viewOrgId === 'ALL') {
      setOrgName(parentOrgName);
    } else {
      const selectedChild = childOrgs.find(o => normalizeOrgCode(o.org_code) === normalizeOrgCode(String(viewOrgId)));
      if (selectedChild) setOrgName(selectedChild.name);
      else {
        const org = StorageService.getOrganization(id);
        if (org) setOrgName(org.name);
      }
    }

    // live data fetch same as before but using dynamic id
    setMembers(normalizeMembers(StorageService.getOrgMembers(id) as any[]));
    StorageService.fetchOrgMembersRemote(id).then(({ members, fromCache }) => {
      setMembers(normalizeMembers(members as any[]));
      setMembersFallback(fromCache);
    }).catch(() => setMembersFallback(true));

    StorageService.fetchOrgInventoryRemote(id).then(({ inventory, fromCache }) => {
      setInventory(inventory);
      setInventoryFallback(fromCache);
    });

    const localRequests = StorageService.getOrgReplenishmentRequests(id);

    listRequests(id)
      .then((data) => {
        setRequestsFallback(false);
        setRequests(mergeReplenishmentRequests(data, localRequests));
      })
      .catch(() => {
        setRequestsFallback(true);
        setRequests(localRequests);
      });

    StorageService.fetchMemberStatus(id).then((resp) => {
      if (resp?.counts) setStatusCounts(resp.counts);
      if (resp?.members?.length) setMembers(normalizeMembers(resp.members as any[]));
    });

    fetchOrgOutreachFlags(id)
      .then((rows) => setOutreachFlags(rows as OutreachFlagRow[]))
      .catch(() => setOutreachFlags([]));

    fetchOrgMemberPreparednessNeeds(id)
      .then((rows) => setMemberNeeds(rows as MemberPreparednessNeedRow[]))
      .catch(() => setMemberNeeds([]));
  }, [communityId, viewOrgId, childOrgs, parentOrgName]);

  useEffect(() => {
    if (activeTab !== 'PREPAREDNESS' || !activeOrgCode) return;

    let active = true;
    const loadOutreachPanel = async () => {
      setOutreachPanelLoading(true);
      setOutreachPanelError(null);
      try {
        const org = await getOrgByCode(activeOrgCode);
        if (!org?.orgId) throw new Error('Organization lookup failed');

        const [candidates, logs] = await Promise.all([
          getOrgLeaderOutreachCandidates(org.orgId, 3),
          listOrgOutreachAuditLogs(org.orgId, 20),
        ]);

        if (!active) return;
        setOutreachCandidates(candidates);
        setOutreachAuditLogs(logs);
      } catch (e: any) {
        if (!active) return;
        setOutreachPanelError(e?.message || 'Unable to load outreach panel.');
        setOutreachCandidates([]);
        setOutreachAuditLogs([]);
      } finally {
        if (active) setOutreachPanelLoading(false);
      }
    };

    loadOutreachPanel();
    return () => {
      active = false;
    };
  }, [activeTab, activeOrgCode]);

  useEffect(() => {
    if (!activeOrgCode) return;

    let cancelled = false;

    const refreshRequests = () => {
      const localRequests = StorageService.getOrgReplenishmentRequests(activeOrgCode);
      listRequests(activeOrgCode)
        .then((data) => {
          if (cancelled) return;
          setRequestsFallback(false);
          setRequests(mergeReplenishmentRequests(data, localRequests));
        })
        .catch(() => {
          if (cancelled) return;
          setRequestsFallback(true);
          setRequests(localRequests);
        });
    };

    refreshRequests();
    const interval = window.setInterval(refreshRequests, 15000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshRequests();
    };

    const handleFocus = () => refreshRequests();
    const handleInventoryUpdate = () => refreshRequests();

    window.addEventListener('focus', handleFocus);
    window.addEventListener('inventory-update', handleInventoryUpdate);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('inventory-update', handleInventoryUpdate);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [activeOrgCode]);

  const displayOrgCode = (() => {
    if (viewOrgId === 'ALL') return activeOrgCode || communityId;
    return activeOrgCode;
  })();

  const stats = isAggregateView && aggStats ? {
    total: aggStats.memberCounts.total,
    safe: aggStats.memberCounts.safe,
    danger: aggStats.memberCounts.danger,
    unknown: aggStats.memberCounts.unknown,
  } : {
    total: members.length,
    safe: statusCounts.safe || members.filter(m => m.status === 'SAFE').length,
    danger: statusCounts.danger || members.filter(m => m.status === 'DANGER').length,
    unknown: statusCounts.unknown || members.filter(m => m.status === 'UNKNOWN').length,
  };

  const filteredMembers = members.filter((member) =>
    member.name.toLowerCase().includes(memberSearch.trim().toLowerCase())
  );

  const readinessTrackedCount = memberNeeds.length;
  const fullyReadyCount = memberNeeds.filter((need) => Number(need.readiness_score || 0) >= 100).length;
  const fullyReadyPercent = readinessTrackedCount > 0
    ? Math.round((fullyReadyCount / readinessTrackedCount) * 1000) / 10
    : 0;

  // Use member count for coverage; fallback to registeredPopulation if no linked members yet
  const coverageBase = stats.total || registeredPopulation;

  const handleInventoryChange = (key: keyof OrgInventory, value: number) => {
    const safeVal = Math.max(0, Number.isFinite(value) ? value : 0);
    setInventory(prev => ({ ...prev, [key]: safeVal }));
    setHasChanges(true);
  };

  const saveInventory = async () => {
    const summary = `Water: ${inventory.water}\nFood: ${inventory.food}\nBlankets: ${inventory.blankets}\nMed Kits: ${inventory.medicalKits}\n\nSave these counts?`;
    if (!window.confirm(summary)) return;
    StorageService.updateOrgInventory(activeOrgCode, inventory);
    let message = 'Inventory Updated in Central Database';

    try {
      await StorageService.saveOrgInventoryRemote(activeOrgCode, inventory);
      const { inventory: latestInventory, fromCache } = await StorageService.fetchOrgInventoryRemote(activeOrgCode);
      setInventory(latestInventory);
      setInventoryFallback(fromCache);
      if (fromCache) {
        message = 'Inventory saved locally (using cached data until API is available).';
      }
    } catch {
      setInventoryFallback(true);
      message = 'Inventory saved locally. Remote sync will retry when available.';
    }

    setHasChanges(false);
    alert(message);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(displayOrgCode);
      alert(`Copied Community ID: ${displayOrgCode}`);
      return;
    } catch {}

    try {
      const textArea = document.createElement('textarea');
      textArea.value = displayOrgCode;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (copied) {
        alert(`Copied Community ID: ${displayOrgCode}`);
      } else {
        alert(`Community ID: ${displayOrgCode}`);
      }
    } catch {
      alert(`Community ID: ${displayOrgCode}`);
    }
  };

  const openBroadcastModal = () => {
    setBroadcastDraft('');
    setBroadcastStep('COMPOSE');
    setModerationError(null);
    if (isAggregateView) {
      // default to all child orgs when composing
      setSelectedBroadcastTargets(networkOrgs.map(o => normalizeOrgCode(o.org_code)));
    }
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

  const confirmBroadcast = async () => {
    if (!broadcastDraft.trim()) return;
    if (isAggregateView) {
      // broadcast to selected child organizations
      const targets = childOrgs.filter(o => selectedBroadcastTargets.includes(normalizeOrgCode(o.org_code)));
      const codes = targets.map(o => normalizeOrgCode(o.org_code));
      try {
        await broadcastToOrgs(codes, broadcastDraft);
        alert(`Broadcast sent to ${targets.length} organizations.`);
      } catch (e) {
        console.error('broadcastToOrgs failed', e);
        alert('Failed to send broadcast to child orgs.');
      }
    } else {
      StorageService.updateOrgBroadcast(activeOrgCode, broadcastDraft);
      alert(`Broadcast sent to all members linked to ${orgName}.`);
    }
    setShowBroadcastModal(false);
  };

  const handleLogOutreach = async (candidate: OrgOutreachCandidate, method: OutreachContactMethod) => {
    setLoggingTargetId(candidate.profile_id);
    try {
      const org = await getOrgByCode(activeOrgCode);
      if (!org?.orgId) throw new Error('Organization lookup failed');

      if (method === 'PHONE_CALL' && candidate.phone) {
        window.location.href = `tel:${candidate.phone}`;
      }
      if (method === 'EMAIL' && candidate.email) {
        window.location.href = `mailto:${candidate.email}`;
      }

      const notes = window.prompt('Optional outreach note:', '') || '';
      await logOrgOutreachContact({
        organizationId: org.orgId,
        targetProfileId: candidate.profile_id,
        targetName: candidate.full_name,
        targetPhone: candidate.phone,
        targetEmail: candidate.email,
        contactMethod: method,
        distanceMiles: candidate.distance_miles,
        notes,
      });

      const refreshedLogs = await listOrgOutreachAuditLogs(org.orgId, 20);
      setOutreachAuditLogs(refreshedLogs);
    } catch (e: any) {
      alert(e?.message || 'Failed to log outreach.');
    } finally {
      setLoggingTargetId(null);
    }
  };

  const handlePingMember = async () => {
    if (selectedMember) {
      const success = await StorageService.sendPing(selectedMember.id, selectedMember.name, activeOrgCode);
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
        await createRequest(activeOrgCode, { item: selectedItem, quantity: requestAmount, provider: replenishmentProvider, orgName });
        const refreshed = await listRequests(activeOrgCode);
        setRequests(mergeReplenishmentRequests(refreshed, StorageService.getOrgReplenishmentRequests(activeOrgCode)));
      } catch (apiError) {
        console.warn('API request failed, using local storage:', apiError);
        // Use local storage as fallback
        StorageService.createReplenishmentRequest(activeOrgCode, {
          item: selectedItem,
          quantity: requestAmount,
          provider: replenishmentProvider,
          orgName
        });
        const localRequests = StorageService.getOrgReplenishmentRequests(activeOrgCode);
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
        const refreshedReqs = await listRequests(activeOrgCode);
        setRequests(refreshedReqs);
        StorageService.fetchOrgInventoryRemote(activeOrgCode).then(({ inventory }) => setInventory(inventory));
      })
      .catch(() => {
        // Use local storage as fallback
        console.warn('API update failed, using local storage');
        const itemKey = req.item.toLowerCase().includes('water') ? 'water' :
                       req.item.toLowerCase().includes('food') ? 'food' :
                       req.item.toLowerCase().includes('blanket') ? 'blankets' : 'medicalKits';
        
        const delivered = { [itemKey]: qty };
        StorageService.stockReplenishment(req.id, delivered);
        
        const localRequests = StorageService.getOrgReplenishmentRequests(activeOrgCode);
        setRequests(localRequests);
        
        const updatedInv = StorageService.getOrgInventory(activeOrgCode);
        setInventory(updatedInv);
      })
      .finally(() => setStockLoading(false));
  };

  const escapeHtml = (value: string) =>
    String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const openReceipt = (req: ReplenishmentRequest, autoPrint = false) => {
    const receiptWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1100');
    if (!receiptWindow) {
      alert('Please allow pop-ups to preview and print receipts.');
      return;
    }

    const stockedQty = req.stockedQuantity ?? req.quantity;
    const statusTime = req.stockedAt || req.receivedAt || req.signedAt || req.timestamp;
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>AERA Receipt ${escapeHtml(req.id)}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0f172a; margin: 24px; }
      .card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
      .title { font-size: 24px; font-weight: 700; margin: 0 0 6px; }
      .sub { color: #475569; margin: 0 0 16px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
      th { background: #f1f5f9; width: 220px; }
      .sign { max-height: 70px; border: 1px solid #cbd5e1; padding: 6px; border-radius: 8px; background: #fff; }
      .row { margin-top: 10px; }
      @media print { .no-print { display: none; } body { margin: 0; } }
    </style>
  </head>
  <body>
    <div class="card">
      <h1 class="title">Fulfillment Receipt</h1>
      <p class="sub">AERA Replenishment Confirmation</p>
      <table>
        <tr><th>Receipt / Order ID</th><td>${escapeHtml(req.id)}</td></tr>
        <tr><th>Organization</th><td>${escapeHtml(req.orgName)} (${escapeHtml(req.orgId)})</td></tr>
        <tr><th>Item</th><td>${escapeHtml(req.item)}</td></tr>
        <tr><th>Requested Qty</th><td>${escapeHtml(String(req.quantity))}</td></tr>
        <tr><th>Delivered / Stocked Qty</th><td>${escapeHtml(String(stockedQty))}</td></tr>
        <tr><th>Status</th><td>${escapeHtml(req.status)}</td></tr>
        <tr><th>Request Date</th><td>${escapeHtml(new Date(req.timestamp).toLocaleString())}</td></tr>
        <tr><th>Fulfillment Date</th><td>${escapeHtml(new Date(statusTime).toLocaleString())}</td></tr>
        <tr><th>Provider</th><td>${escapeHtml(req.provider || 'Central Warehouse')}</td></tr>
      </table>

      <div class="row">
        <strong>Released By Signature:</strong><br/>
        ${req.signature ? `<img class="sign" src="${req.signature}" alt="Released signature" />` : 'Not provided'}
      </div>
      <div class="row">
        <strong>Received By Signature:</strong><br/>
        ${req.receivedSignature ? `<img class="sign" src="${req.receivedSignature}" alt="Received signature" />` : 'Not provided'}
      </div>
    </div>
    <div class="no-print">
      <button onclick="window.print()">Print Receipt</button>
    </div>
  </body>
</html>`;

    receiptWindow.document.open();
    receiptWindow.document.write(html);
    receiptWindow.document.close();
    receiptWindow.focus();

    if (autoPrint) {
      window.setTimeout(() => {
        receiptWindow.print();
      }, 250);
    }
  };

  const status = getInventoryStatuses(inventory, coverageBase);
  const inventoryItems = [
    { label: 'Water Cases', key: 'water' as const, unit: 'cases' },
    { label: 'Food Boxes', key: 'food' as const, unit: 'boxes' },
    { label: 'Blankets', key: 'blankets' as const, unit: 'units' },
    { label: 'Med Kits', key: 'medicalKits' as const, unit: 'kits' },
  ];
  const requestItemByInventoryKey: Record<keyof OrgInventory, string> = {
    water: 'Water Cases',
    food: 'Food Boxes',
    blankets: 'Blankets',
    medicalKits: 'Medical Kits',
  };
  const lowItems = inventoryItems.filter(item => status[item.key].level === 'LOW');
  const pendingOrApprovedRequests = requests.filter((req) => req.status === 'PENDING' || req.status === 'APPROVED');
  const fulfilledAwaitingStock = requests.filter((req) => req.status === 'FULFILLED' && !req.stocked);
  const releaseApprovedCount = requests.filter((req) => Boolean(req.signature)).length;
  const custodyAcceptedCount = requests.filter((req) => Boolean(req.receivedSignature)).length;
  const importantRequests = requests
    .filter((req) => req.status === 'PENDING' || req.status === 'APPROVED' || (req.status === 'FULFILLED' && !req.stocked))
    .slice(0, 8);
  const getMemberProfileImage = (memberId?: string) => {
    const normalizedId = String(memberId || '').trim();
    if (!normalizedId) return '';
    return StorageService.getProfileImageDataUrl(normalizedId) || '';
  };
  const selectedMemberImageDataUrl = selectedMember ? getMemberProfileImage(selectedMember.id) : '';

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
                    {isAggregateView ? (
                      <span>
                        Sending to <strong>{selectedBroadcastTargets.length} orgs</strong>
                      </span>
                    ) : (
                      <span>Sending to members of <strong>{orgName}</strong></span>
                    )}
                  </div>
                  {isAggregateView && (
                    <div className="mb-2">
                      <p className="text-xs font-semibold">Select target organizations:</p>
                      <div className="max-h-32 overflow-y-auto border border-slate-200 rounded p-2">
                        {networkOrgs.map(o => (
                          <label key={o.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selectedBroadcastTargets.includes(normalizeOrgCode(o.org_code))}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedBroadcastTargets(prev => [...prev, normalizeOrgCode(o.org_code)]);
                                } else {
                                  setSelectedBroadcastTargets(prev => prev.filter(code => code !== normalizeOrgCode(o.org_code)));
                                }
                              }}
                            />
                            {o.name} ({normalizeOrgCode(o.org_code)})
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

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
                      disabled={isAggregateView && selectedBroadcastTargets.length === 0}
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
            <button onClick={() => setView('DASHBOARD')} className="p-2 -ml-2 text-slate-500 hover:text-slate-800">
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
             <p className="text-xl font-mono font-black tracking-widest text-brand-400">{displayOrgCode}</p>
           </div>
           <Button 
             size="sm" 
             className="bg-slate-700 hover:bg-slate-600 text-white border-0"
             onClick={copyToClipboard}
           >
             <Copy size={16} className="mr-2" /> {t('org.copy')}
           </Button>
        </div>

        {/* child organization selector */}
        {networkOrgs.length > 1 && (
          <div className="mb-2 flex items-center gap-2">
            <label className="text-xs font-semibold">View:</label>
            <select
              value={viewOrgId}
              onChange={e => setViewOrgId(e.target.value as string)}
              className="text-sm border border-slate-300 rounded px-2 py-1"
            >
              <option value="ALL">All ({networkOrgs.length})</option>
              {networkOrgs.map(o => (
                <option key={o.id} value={normalizeOrgCode(o.org_code)}>{o.name} ({normalizeOrgCode(o.org_code)})</option>
              ))}
            </select>
          </div>
        )}

        {/* aggregated stats (parent only) */}
        {isAggregateView && aggStats && (
          <div className="mb-2 p-2 bg-blue-50 border border-blue-100 rounded text-sm">
            <div className="flex justify-between">
              <span className="font-bold">Combined Members:</span>
              <span>{aggStats.memberCounts.total} (safe {aggStats.memberCounts.safe}, danger {aggStats.memberCounts.danger})</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="font-bold">Inventory Totals:</span>
              <span>W:{aggStats.inventory.water} F:{aggStats.inventory.food} B:{aggStats.inventory.blankets} M:{aggStats.inventory.medicalKits}</span>
            </div>
          </div>
        )}

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
        <div className="text-xs text-slate-500 font-bold mt-2">Total Members: {stats.total}</div>
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
           onClick={() => { setActiveTab('PREPAREDNESS'); setSelectedMember(null); }}
           className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'PREPAREDNESS' ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500'}`}
         >
           {t('org.tab.preparedness')}
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
                      <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center font-bold text-2xl border-2 border-white/30 overflow-hidden">
                        {selectedMemberImageDataUrl ? (
                          <img src={selectedMemberImageDataUrl} alt={selectedMember.name} className="w-full h-full object-cover" />
                        ) : (
                          selectedMember.name.charAt(0)
                        )}
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
               <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                 <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Search Members</label>
                 <input
                   value={memberSearch}
                   onChange={(e) => setMemberSearch(e.target.value)}
                   placeholder="Search by first or last name"
                   className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                 />
               </div>
               {filteredMembers.length === 0 && (
                 <p className="text-center text-slate-500 mt-8">
                   {members.length === 0 ? `No members linked to ${displayOrgCode} yet.` : 'No members match your search.'}
                 </p>
               )}
               {filteredMembers.map(member => (
                (() => {
                  const memberImageDataUrl = getMemberProfileImage(member.id);
                  return (
                 <div 
                   key={member.id} 
                   onClick={() => setSelectedMember(member)}
                   className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-brand-400 hover:shadow-md transition-all group"
                 >
                    <div className="flex items-center gap-3">
                       <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold overflow-hidden ${
                         member.status === 'SAFE' ? 'bg-green-500' : 
                         member.status === 'DANGER' ? 'bg-red-500' : 'bg-slate-400'
                       }`}>
                         {memberImageDataUrl ? (
                           <img src={memberImageDataUrl} alt={member.name} className="w-full h-full object-cover" />
                         ) : (
                           member.name.charAt(0)
                         )}
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
                  );
                })()
               ))}
            </div>
          )
        )}

        {activeTab === 'PREPAREDNESS' && (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-emerald-900">Nearby Outreach Panel</h3>
                  <p className="text-xs text-emerald-800 mt-1">
                    Opted-in app users within 3 miles who are not yet connected to a trusted network.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase font-bold text-emerald-700">Candidates</p>
                  <p className="text-lg font-black text-emerald-900">{outreachCandidates.length}</p>
                </div>
              </div>

              {outreachPanelError && (
                <div className="bg-white border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {outreachPanelError}
                </div>
              )}

              {outreachPanelLoading ? (
                <div className="bg-white border border-emerald-100 rounded-lg p-4 text-sm text-slate-600">
                  Loading nearby outreach candidates…
                </div>
              ) : outreachCandidates.length > 0 ? (
                <div className="space-y-2">
                  {outreachCandidates.slice(0, 12).map((candidate) => (
                    <div key={candidate.profile_id} className="bg-white border border-emerald-100 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{candidate.full_name || 'Nearby App User'}</p>
                          <p className="text-xs text-slate-500">
                            {candidate.distance_miles} miles away
                            {candidate.phone ? ` • ${candidate.phone}` : ''}
                            {candidate.email ? ` • ${candidate.email}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          {candidate.phone && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleLogOutreach(candidate, 'PHONE_CALL')}
                              disabled={loggingTargetId === candidate.profile_id}
                            >
                              <Phone size={14} className="mr-1" /> Call
                            </Button>
                          )}
                          {candidate.email && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleLogOutreach(candidate, 'EMAIL')}
                              disabled={loggingTargetId === candidate.profile_id}
                            >
                              <Mail size={14} className="mr-1" /> Email
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => handleLogOutreach(candidate, 'MANUAL_OUTREACH')}
                            disabled={loggingTargetId === candidate.profile_id}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <LocateFixed size={14} className="mr-1" /> Log Outreach
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-emerald-100 rounded-lg p-4 text-sm text-slate-600">
                  No opted-in, unconnected app users are currently within 3 miles.
                </div>
              )}

              <div className="bg-white border border-emerald-100 rounded-lg p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 className="text-sm font-bold text-slate-900">Recent Outreach Audit</h4>
                  <span className="text-[11px] font-bold uppercase text-slate-500">Last 20</span>
                </div>
                {outreachAuditLogs.length > 0 ? (
                  <div className="space-y-2">
                    {outreachAuditLogs.slice(0, 8).map((log) => (
                      <div key={log.id} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-slate-900">{log.target_name}</p>
                          <span className="text-[10px] px-2 py-1 rounded bg-slate-100 text-slate-700 font-bold uppercase">
                            {log.contact_method.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(log.created_at).toLocaleString()}
                          {log.distance_miles != null ? ` • ${log.distance_miles} miles` : ''}
                        </p>
                        {log.notes && <p className="text-xs text-slate-700 mt-2">{log.notes}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">No outreach has been logged yet.</p>
                )}
              </div>
            </div>

            {outreachFlags.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h3 className="text-sm font-bold text-amber-900 mb-2">{t('org.outreach.title')}</h3>
                <div className="space-y-2">
                  {outreachFlags.slice(0, 8).map((flag, idx) => {
                    const levelClasses =
                      flag.outreach_flag === 'HIGH'
                        ? 'bg-red-100 text-red-700 border-red-200'
                        : flag.outreach_flag === 'MEDIUM'
                          ? 'bg-amber-100 text-amber-700 border-amber-200'
                          : 'bg-emerald-100 text-emerald-700 border-emerald-200';
                    return (
                      <div key={`${flag.county_id || 'state'}-${idx}`} className="bg-white border border-amber-100 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-500 font-bold uppercase">{flag.county_id || flag.state_id || 'Organization Scope'}</p>
                          <p className="text-sm text-slate-700">{flag.member_count} members • Updated {new Date(flag.last_updated).toLocaleString()}</p>
                        </div>
                        <span className={`px-2 py-1 text-[11px] border rounded font-bold ${levelClasses}`}>{flag.outreach_flag}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {memberNeeds.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h3 className="text-sm font-bold text-slate-900">{t('org.gaps.title')}</h3>
                  <div className="text-right">
                    <p className="text-[11px] uppercase font-bold text-slate-500">100% Readiness</p>
                    <p className="text-sm font-black text-emerald-700">{fullyReadyCount} / {readinessTrackedCount} ({fullyReadyPercent}%)</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {memberNeeds.slice(0, 20).map((need) => {
                    const score = Math.round(Number(need.readiness_score || 0));
                    const riskClasses =
                      need.risk_tier === 'HIGH'
                        ? 'bg-red-100 text-red-700 border-red-200'
                        : need.risk_tier === 'ELEVATED'
                          ? 'bg-amber-100 text-amber-700 border-amber-200'
                          : 'bg-emerald-100 text-emerald-700 border-emerald-200';

                    return (
                      <div key={need.profile_id} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{need.member_name}</p>
                            <p className="text-xs text-slate-500">{need.phone || 'No phone'} • {need.critical_missing_count} critical missing</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500 uppercase font-bold">{t('org.gaps.readiness')}</p>
                            <p className="text-sm font-black text-slate-900">{score}%</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] px-2 py-1 border rounded font-bold uppercase ${riskClasses}`}>{need.risk_tier}</span>
                          {need.outreach_flags.slice(0, 3).map((flag) => (
                            <span key={flag} className="text-[10px] px-2 py-1 rounded bg-purple-100 text-purple-700 font-bold">{flag}</span>
                          ))}
                        </div>
                        {need.critical_missing_items.length > 0 && (
                          <div className="mt-2 text-xs text-slate-600">
                            {t('org.gaps.missing')}: {need.critical_missing_items.slice(0, 3).map((m) => m.item || 'Critical item').join(', ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {outreachFlags.length === 0 && memberNeeds.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
                {t('org.gaps.none')}
              </div>
            )}
          </div>
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

            {coverageBase > 0 && lowItems.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle size={18} />
                  <p className="font-bold text-sm">Low stock relative to population of {coverageBase}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {lowItems.map(item => {
                    const needed = getRecommendedResupply(inventory[item.key], coverageBase) || 0;
                    return (
                      <div key={item.key} className="bg-white border border-red-100 rounded-lg p-3 shadow-sm">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-red-700 text-sm">{item.label}</p>
                          <span className="text-[11px] font-bold text-red-600">LOW</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          Current: <span className="font-bold">{inventory[item.key]} {item.unit}</span>
                        </p>
                        <p className="text-xs text-slate-600">
                          Recommend: <span className="font-bold">{needed} {item.unit}</span> to reach 80% coverage
                        </p>
                        <Button 
                          size="sm" 
                          className="mt-2 w-full" 
                          onClick={() => {
                            setSelectedItem(requestItemByInventoryKey[item.key]);
                            setRequestAmount(Math.max(1, needed));
                            setRequestSuccess(false);
                            setIsRequesting(true);
                            window.setTimeout(() => {
                              requestFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 30);
                          }}
                        >
                          Prefill Request
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                {inventoryItems.map((item) => {
                  const key = item.key as keyof OrgInventory;
                  const recommendedResupply = getRecommendedResupply(inventory[key], coverageBase);
                  const suggestedTarget = recommendedResupply == null ? null : inventory[key] + recommendedResupply;

                  return (
                    <div key={item.label} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                      <p className="text-slate-500 text-xs font-bold uppercase mb-1">{item.label}</p>
                      {/* @ts-ignore */}
                      <input 
                        type="number"
                        min="0"
                        className="w-full mt-2 p-2 rounded-lg border border-slate-300 text-center font-bold text-slate-900"
                        value={inventory[key]}
                        onChange={(e) => handleInventoryChange(key, parseInt(e.target.value))}
                      />
                      <p className="text-slate-400 text-xs mt-1">{item.unit}</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {suggestedTarget == null
                          ? 'Suggested target unavailable (set population).'
                          : `Suggested target: ${suggestedTarget} ${item.unit}`}
                      </p>
                      <p className={`text-[11px] font-bold mt-1 ${
                        status[key].level === 'HIGH' ? 'text-green-600' :
                        status[key].level === 'MEDIUM' ? 'text-amber-600' :
                        status[key].level === 'LOW' ? 'text-red-600' :
                        'text-slate-400'
                      }`}>
                        {status[key].level === 'UNKNOWN' ? 'N/A' : status[key].level}
                      </p>
                    </div>
                  );
                })}
            </div>
            
            <Button fullWidth className="font-bold" onClick={saveInventory} disabled={!hasChanges}>
               <Save size={18} className="mr-2" /> {hasChanges ? t('btn.save') : 'All Saved'}
            </Button>

            <div ref={requestFormRef} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mt-4">
              <div className="flex items-center gap-2 mb-3">
                 <Truck className="text-brand-600" size={20} />
                 <h3 className="font-bold text-slate-900">{t('org.req_replenish')}</h3>
              </div>
              <p className="text-sm text-slate-600 mb-4 font-medium">{t('org.req_desc')}</p>
              <p className="text-xs text-slate-500 mb-4">
                Saved submissions are scoped to <span className="font-bold text-slate-700">{orgName}</span> ({displayOrgCode}), so this org only sees its own request priorities.
              </p>
              
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
                        onChange={(e) => setRequestAmount(Math.max(1, parseInt(e.target.value || '1', 10) || 1))}
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

              <div className="mt-6 border border-slate-200 rounded-xl p-4 bg-slate-50">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h4 className="font-bold text-slate-900">What’s Important to This Org</h4>
                  <span className="text-[11px] text-slate-500 font-bold uppercase">Saved Request Snapshot</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                  <div className="bg-white border border-amber-200 rounded-lg p-2">
                    <p className="text-[10px] uppercase font-bold text-amber-700">Open Requests</p>
                    <p className="text-lg font-black text-amber-800">{pendingOrApprovedRequests.length}</p>
                  </div>
                  <div className="bg-white border border-blue-200 rounded-lg p-2">
                    <p className="text-[10px] uppercase font-bold text-blue-700">Awaiting Stock</p>
                    <p className="text-lg font-black text-blue-800">{fulfilledAwaitingStock.length}</p>
                  </div>
                  <div className="bg-white border border-emerald-200 rounded-lg p-2">
                    <p className="text-[10px] uppercase font-bold text-emerald-700">Release Signed</p>
                    <p className="text-lg font-black text-emerald-800">{releaseApprovedCount}</p>
                  </div>
                  <div className="bg-white border border-purple-200 rounded-lg p-2">
                    <p className="text-[10px] uppercase font-bold text-purple-700">Custody Signed</p>
                    <p className="text-lg font-black text-purple-800">{custodyAcceptedCount}</p>
                  </div>
                </div>

                {importantRequests.length > 0 ? (
                  <div className="space-y-2">
                    {importantRequests.map((req) => (
                      <div key={`important-${req.id}`} className="bg-white border border-slate-200 rounded-lg p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{req.item}</p>
                            <p className="text-[11px] text-slate-500">Qty {req.quantity} • {new Date(req.timestamp).toLocaleString()}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                            req.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                            req.status === 'FULFILLED' ? 'bg-green-100 text-green-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {req.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No active priorities. New submissions will appear here.</p>
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
                {requests.slice(0, 12).map((req) => (
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

                    {req.status !== 'FULFILLED' && req.status !== 'STOCKED' && (
                      <p className="mt-2 text-[11px] text-slate-500 font-bold">
                        Status managed by warehouse log.
                      </p>
                    )}

                    {req.status === 'FULFILLED' && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
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
                        <Button size="sm" variant="outline" onClick={() => openReceipt(req)}>
                          <FileText size={14} className="mr-1" /> Receipt
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openReceipt(req, true)}>
                          <Printer size={14} className="mr-1" /> Print
                        </Button>
                        {req.stocked && req.stockedAt && (
                          <span className="text-[11px] text-slate-500 font-bold">
                            Stocked at {new Date(req.stockedAt).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold uppercase">
                      <span className={`px-2 py-1 rounded ${req.signature ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {req.signature ? 'Release Approved' : 'Release Pending'}
                      </span>
                      <span className={`px-2 py-1 rounded ${req.receivedSignature ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {req.receivedSignature ? 'Custody Accepted' : 'Custody Pending'}
                      </span>
                    </div>

                    {req.status === 'STOCKED' && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-emerald-700 font-bold">
                          Stocked at {req.stockedAt ? new Date(req.stockedAt).toLocaleTimeString() : '—'}
                        </span>
                        <Button size="sm" variant="outline" onClick={() => openReceipt(req)}>
                          <FileText size={14} className="mr-1" /> Receipt
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openReceipt(req, true)}>
                          <Printer size={14} className="mr-1" /> Print
                        </Button>
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
