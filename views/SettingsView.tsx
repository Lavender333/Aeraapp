
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ViewState, UserProfile, UserRole, RoleDefinition, MockUser, DatabaseSchema, LanguageCode, OrganizationProfile, OrgMember, HouseholdMember, ReplenishmentRequest } from '../types';
import { Input, Textarea } from '../components/Input';
import { Button } from '../components/Button';
import { HouseholdManager } from '../components/HouseholdManager';
import { SignaturePad } from '../components/SignaturePad';
import { StorageService } from '../services/storage';
import { AppNotificationRecord, createHouseholdInvitationForMember, ensureHouseholdForCurrentUser, fetchHouseholdForCurrentUser, fetchProfileForUser, fetchVitalsForUser, HouseholdInvitationRecord, HouseholdJoinRequestRecord, HouseholdOption, leaveCurrentHousehold, listHouseholdInvitationsForCurrentUser, listHouseholdJoinRequestsForOwner, listHouseholdsForCurrentUser, listMyHouseholdJoinRequests, listNotificationsForCurrentUser, markNotificationRead, requestHouseholdJoinByCode, resolveHouseholdJoinRequest, revokeHouseholdInvitationForCurrentUser, switchActiveHousehold, updateProfileForUser, updateVitalsForUser } from '../services/api';
import { getOrgByCode } from '../services/supabase';
import { subscribeToNotifications } from '../services/supabaseRealtime';
import { isValidPhoneForInvite, validateHouseholdMembers } from '../services/validation';
import { t } from '../services/translations';
import { User, Bell, Lock, LogOut, Check, Save, Building2, ArrowLeft, ArrowRight, Link as LinkIcon, Loader2, HeartPulse, ShieldCheck, Users, ToggleLeft, ToggleRight, MoreVertical, Copy, CheckCircle, Database, X, XCircle, Globe, Search, Truck, Phone, Mail, MapPin, Power, Ban, Activity, Radio, AlertTriangle, HelpCircle, FileText, Printer, CheckSquare, Download, RefreshCcw, Clipboard, PenTool, ChevronDown } from 'lucide-react';

// Phone Formatter Utility
const formatPhoneNumber = (value: string) => {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\d]/g, '');
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  }
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

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

const maskPhoneNumber = (value: string) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 4) return value;
  const last4 = digits.slice(-4);
  return `***-***-${last4}`;
};

// --- Mock Data for Access Control ---
const INITIAL_ROLES: RoleDefinition[] = [
  {
    id: 'ADMIN',
    label: 'Administrator',
    description: 'Full system access and user management.',
    permissions: { canViewPII: true, canDispatchDrone: true, canApproveFunds: true, canManageInventory: true, canBroadcastAlerts: true }
  },
  {
    id: 'FIRST_RESPONDER',
    label: 'First Responder',
    description: 'Field access to location data and medical info.',
    permissions: { canViewPII: true, canDispatchDrone: false, canApproveFunds: false, canManageInventory: false, canBroadcastAlerts: true }
  },
  {
    id: 'LOCAL_AUTHORITY',
    label: 'Local Authority',
    description: 'Oversight of alerts and population tracking.',
    permissions: { canViewPII: false, canDispatchDrone: false, canApproveFunds: true, canManageInventory: false, canBroadcastAlerts: true }
  },
  {
    id: 'CONTRACTOR',
    label: 'Contractor',
    description: 'Logistics and repair management.',
    permissions: { canViewPII: false, canDispatchDrone: false, canApproveFunds: false, canManageInventory: true, canBroadcastAlerts: false }
  },
  {
    id: 'INSTITUTION_ADMIN',
    label: 'Institution Admin',
    description: 'Manage community members and hub inventory.',
    permissions: { canViewPII: false, canDispatchDrone: false, canApproveFunds: false, canManageInventory: true, canBroadcastAlerts: true }
  },
  {
    id: 'GENERAL_USER',
    label: 'General User',
    description: 'Standard access to report emergencies.',
    permissions: { canViewPII: false, canDispatchDrone: false, canApproveFunds: false, canManageInventory: false, canBroadcastAlerts: false }
  }
];

type PlaceSuggestion = {
  placeId: string;
  description: string;
};

export const SettingsView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const mapsApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim();
  const trustedCommunityRef = useRef<HTMLElement | null>(null);
  const profileSectionRef = useRef<HTMLElement | null>(null);
  const contactsSectionRef = useRef<HTMLElement | null>(null);
  const householdSectionRef = useRef<HTMLElement | null>(null);
  const securitySectionRef = useRef<HTMLElement | null>(null);

  type SettingsAccordionKey = 'profile' | 'household' | 'contacts' | 'community' | 'security';
  const [expandedSections, setExpandedSections] = useState<Record<SettingsAccordionKey, boolean>>({
    profile: false,
    household: false,
    contacts: false,
    community: false,
    security: false,
  });
  const [showMoreSections, setShowMoreSections] = useState<Record<SettingsAccordionKey, boolean>>({
    profile: false,
    household: false,
    contacts: false,
    community: false,
    security: false,
  });

  // Main Settings State
  const [profile, setProfile] = useState<UserProfile>({
    id: '',
    fullName: '',
    phone: '',
    address: '',
    householdMembers: 1,
    household: [],
    zipCode: '',
    petDetails: '',
    medicalNeeds: '',
    medicationDependency: false,
    insulinDependency: false,
    oxygenPoweredDevice: false,
    mobilityLimitation: false,
    transportationAccess: true,
    financialStrain: false,
    consentPreparednessPlanning: false,
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
    communityId: '',
    role: 'GENERAL_USER',
    language: 'en',
    active: true,
    notifications: { push: true, sms: true, email: true }
  });

  const normalizedRole = String(profile.role || '').toUpperCase();
  const isAdmin = ['ADMIN', 'STATE_ADMIN', 'COUNTY_ADMIN', 'ORG_ADMIN', 'INSTITUTION_ADMIN'].includes(normalizedRole);
  const hasAddressInput = String(profile.address || '').trim().length > 0;
  const isAddressVerificationRequired = hasAddressInput && Boolean(mapsApiKey) && !profile.addressVerified;
  const addressVerifiedLabel = profile.addressVerifiedAt
    ? new Date(profile.addressVerifiedAt).toLocaleString()
    : null;
  
  // UI States
  const [currentSection, setCurrentSection] = useState<'MAIN' | 'ACCESS_CONTROL' | 'DB_VIEWER' | 'ORG_DIRECTORY' | 'BROADCAST_CONTROL' | 'MASTER_INVENTORY'>('MAIN');
  const [isSaved, setIsSaved] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [connectedOrg, setConnectedOrg] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isDisconnectingOrg, setIsDisconnectingOrg] = useState(false);

  // Validation States
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [addressStatus, setAddressStatus] = useState<'IDLE' | 'VERIFYING' | 'VALID' | 'INVALID'>('IDLE');
  const [addressSuggestions, setAddressSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isAddressSuggesting, setIsAddressSuggesting] = useState(false);
  const [highlightedAddressIndex, setHighlightedAddressIndex] = useState(-1);

  // Access Control State
  type AccessTab = 'ALL_USERS' | 'ROLE_DEFINITIONS';
  const [activeTab, setActiveTab] = useState<AccessTab>('ALL_USERS');
  const [roles, setRoles] = useState<RoleDefinition[]>(() => StorageService.getRoles() || INITIAL_ROLES);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // DB Viewer State
  const [dbContent, setDbContent] = useState<DatabaseSchema | null>(null);

  // Org Directory State
  const [orgList, setOrgList] = useState<OrganizationProfile[]>([]);
  const [orgSearch, setOrgSearch] = useState('');
  const [selectedOrgDetails, setSelectedOrgDetails] = useState<OrganizationProfile | null>(null);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [membersFallback, setMembersFallback] = useState(false);

  // Master Inventory State
  const [inventoryRequests, setInventoryRequests] = useState<ReplenishmentRequest[]>([]);
  const [printingRequest, setPrintingRequest] = useState<ReplenishmentRequest | null>(null);
  const [workOrderForm, setWorkOrderForm] = useState<Record<string, string>>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingVitals, setIsSavingVitals] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [vitalsSaveError, setVitalsSaveError] = useState<string | null>(null);
  const [householdCodeInput, setHouseholdCodeInput] = useState('');
  const [householdCodeError, setHouseholdCodeError] = useState<string | null>(null);
  const [householdCodeSuccess, setHouseholdCodeSuccess] = useState<string | null>(null);
  const [isHouseholdCodeBusy, setIsHouseholdCodeBusy] = useState(false);
  const [memberInvites, setMemberInvites] = useState<HouseholdInvitationRecord[]>([]);
  const [inviteStatusMessage, setInviteStatusMessage] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteBusyMemberId, setInviteBusyMemberId] = useState<string | null>(null);
  const [ownerJoinRequests, setOwnerJoinRequests] = useState<HouseholdJoinRequestRecord[]>([]);
  const [myJoinRequests, setMyJoinRequests] = useState<HouseholdJoinRequestRecord[]>([]);
  const [householdOptions, setHouseholdOptions] = useState<HouseholdOption[]>([]);
  const [isSwitchingHousehold, setIsSwitchingHousehold] = useState(false);
  const [isLeavingHousehold, setIsLeavingHousehold] = useState(false);
  const [notifications, setNotifications] = useState<AppNotificationRecord[]>([]);
  const [joinRequestBusyId, setJoinRequestBusyId] = useState<string | null>(null);
  const [notificationsBusy, setNotificationsBusy] = useState(false);

  const toggleSection = (section: SettingsAccordionKey) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleShowMore = (section: SettingsAccordionKey) => {
    setShowMoreSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const openSectionAndScroll = (section: SettingsAccordionKey) => {
    setExpandedSections((prev) => ({ ...prev, [section]: true }));
    const targetRef = section === 'profile'
      ? profileSectionRef
      : section === 'contacts'
        ? contactsSectionRef
        : section === 'household'
          ? householdSectionRef
          : section === 'community'
            ? trustedCommunityRef
            : securitySectionRef;

    window.setTimeout(() => {
      targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const discardLocalChanges = () => {
    const loaded = StorageService.getProfile();
    if (!loaded.role) loaded.role = 'GENERAL_USER';
    if (!loaded.language) loaded.language = 'en';
    if (loaded.active === undefined) loaded.active = true;
    if (!loaded.household) loaded.household = [];
    setProfile(loaded);
    setPhoneError(null);
    setProfileSaveError(null);
    setVitalsSaveError(null);
    setHouseholdCodeError(null);
    setHouseholdCodeSuccess(null);
    setInviteError(null);
    setInviteStatusMessage(null);
    setVerifyError(null);
    if (loaded.addressVerified) {
      setAddressStatus('VALID');
    } else if (loaded.address && loaded.address.length > 5) {
      setAddressStatus('IDLE');
    } else {
      setAddressStatus('IDLE');
    }
    setAddressSuggestions([]);
    setHighlightedAddressIndex(-1);
  };

  const saveVisibleSection = async () => {
    if (expandedSections.security || expandedSections.household) {
      await handleVitalsSave();
      return;
    }
    await handleProfileSave();
  };

  // Broadcast Control State
  const [systemTicker, setSystemTicker] = useState('');

  const applyHouseholdSummary = (summary: {
    householdId: string;
    householdCode: string;
    householdName: string;
    householdRole: 'OWNER' | 'MEMBER';
  }) => {
    setProfile((prev) => ({
      ...prev,
      householdId: summary.householdId,
      householdCode: summary.householdCode,
      householdName: summary.householdName,
      householdRole: summary.householdRole,
    }));

    const current = StorageService.getProfile();
    StorageService.saveProfile({
      ...current,
      householdId: summary.householdId,
      householdCode: summary.householdCode,
      householdName: summary.householdName,
      householdRole: summary.householdRole,
    });
  };

  useEffect(() => {
    const loaded = StorageService.getProfile();
    // Ensure role exists for legacy profiles
    if (!loaded.role) loaded.role = 'GENERAL_USER';
    if (!loaded.language) loaded.language = 'en'; 
    if (loaded.active === undefined) loaded.active = true;
    if (!loaded.household) loaded.household = []; // Ensure array exists
    if (typeof loaded.zipCode !== 'string') loaded.zipCode = '';
    if (typeof loaded.medicationDependency !== 'boolean') loaded.medicationDependency = false;
    if (typeof loaded.insulinDependency !== 'boolean') loaded.insulinDependency = false;
    if (typeof loaded.oxygenPoweredDevice !== 'boolean') loaded.oxygenPoweredDevice = false;
    if (typeof loaded.mobilityLimitation !== 'boolean') loaded.mobilityLimitation = false;
    if (typeof loaded.transportationAccess !== 'boolean') loaded.transportationAccess = true;
    if (typeof loaded.financialStrain !== 'boolean') loaded.financialStrain = false;
    if (typeof loaded.consentPreparednessPlanning !== 'boolean') loaded.consentPreparednessPlanning = false;
    setProfile(loaded);
    
    if (loaded.addressVerified) {
      setAddressStatus('VALID');
    } else if (loaded.address && loaded.address.length > 5) {
      setAddressStatus('IDLE');
    }
    
    if (loaded.communityId && loaded.role !== 'INSTITUTION_ADMIN') {
      const org = StorageService.getOrganization(loaded.communityId);
      if (org) setConnectedOrg(org.name);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const hydrateFromSupabase = async () => {
      try {
        const [remoteProfile, remoteVitals] = await Promise.all([
          fetchProfileForUser(),
          fetchVitalsForUser(),
        ]);

        if (!active) return;

        if (remoteProfile || remoteVitals) {
          const current = StorageService.getProfile();
          const merged = {
            ...current,
            ...(remoteProfile || {}),
            ...(remoteVitals || {}),
          } as UserProfile;
          StorageService.saveProfile(merged);
          setProfile(merged);
          setAddressStatus(merged.addressVerified ? 'VALID' : 'IDLE');
        }

        const householdSummary = await fetchHouseholdForCurrentUser();
        if (!active) return;

        if (householdSummary) {
          applyHouseholdSummary(householdSummary);
        } else {
          const created = await ensureHouseholdForCurrentUser();
          if (!active) return;
          applyHouseholdSummary(created);
        }

        try {
          const options = await listHouseholdsForCurrentUser();
          if (active) setHouseholdOptions(options);
        } catch {
          if (active) setHouseholdOptions([]);
        }
      } catch {
        // Ignore remote hydration errors; local profile remains available.
      }
    };

    hydrateFromSupabase();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isAdmin && currentSection !== 'MAIN') {
      setCurrentSection('MAIN');
    }
  }, [isAdmin, currentSection]);

  useEffect(() => {
    const target = sessionStorage.getItem('settingsScrollTarget');
    if (target !== 'TRUSTED_COMMUNITY') return;

    const timer = window.setTimeout(() => {
      setExpandedSections((prev) => ({ ...prev, community: true }));
      trustedCommunityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      sessionStorage.removeItem('settingsScrollTarget');
    }, 150);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const additionalMembers = Array.isArray(profile.household) ? profile.household.length : 0;
    const derivedHouseholdSize = Math.max(1, additionalMembers + 1);
    if (profile.householdMembers !== derivedHouseholdSize) {
      setProfile((prev) => ({ ...prev, householdMembers: derivedHouseholdSize }));
    }
  }, [profile.household, profile.householdMembers]);

  useEffect(() => {
    let active = true;
    const loadInvites = async () => {
      if (!profile.householdId) {
        setMemberInvites([]);
        return;
      }
      try {
        const invites = await listHouseholdInvitationsForCurrentUser();
        if (active) setMemberInvites(invites);
      } catch {
        if (active) setMemberInvites([]);
      }
    };

    loadInvites();
    return () => {
      active = false;
    };
  }, [profile.householdId]);

  useEffect(() => {
    let active = true;
    const loadHouseholds = async () => {
      try {
        const options = await listHouseholdsForCurrentUser();
        if (active) setHouseholdOptions(options);
      } catch {
        if (active) setHouseholdOptions([]);
      }
    };

    loadHouseholds();
    return () => {
      active = false;
    };
  }, [profile.householdId, profile.householdRole]);

  useEffect(() => {
    let active = true;

    const loadJoinState = async () => {
      if (!profile.householdId) {
        setOwnerJoinRequests([]);
        setMyJoinRequests([]);
      }

      try {
        const [ownerRequests, myRequests] = await Promise.all([
          listHouseholdJoinRequestsForOwner(),
          listMyHouseholdJoinRequests(),
        ]);
        if (!active) return;
        setOwnerJoinRequests(ownerRequests);
        setMyJoinRequests(myRequests);
      } catch {
        if (!active) return;
        setOwnerJoinRequests([]);
        setMyJoinRequests([]);
      }

      try {
        const inbox = await listNotificationsForCurrentUser(50);
        if (active) setNotifications(inbox);
      } catch {
        if (active) setNotifications([]);
      }
    };

    loadJoinState();
    return () => {
      active = false;
    };
  }, [profile.householdId, profile.householdRole]);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let active = true;

    const bind = async () => {
      try {
        unsub = await subscribeToNotifications(async () => {
          if (!active) return;
          try {
            const [inbox, ownerRequests, myRequests] = await Promise.all([
              listNotificationsForCurrentUser(50),
              listHouseholdJoinRequestsForOwner(),
              listMyHouseholdJoinRequests(),
            ]);
            if (!active) return;
            setNotifications(inbox);
            setOwnerJoinRequests(ownerRequests);
            setMyJoinRequests(myRequests);
          } catch {
            // Ignore transient realtime refresh failures.
          }
        });
      } catch {
        unsub = null;
      }
    };

    bind();
    return () => {
      active = false;
      if (unsub) unsub();
    };
  }, []);

  // Fetch members when an org is selected in directory
  useEffect(() => {
    if (selectedOrgDetails) {
      const members = StorageService.getOrgMembers(selectedOrgDetails.id);
      setOrgMembers(members);
      StorageService.fetchOrgMembersRemote(selectedOrgDetails.id).then(({ members, fromCache }) => {
        setOrgMembers(members);
        setMembersFallback(fromCache);
      }).catch(() => setMembersFallback(true));
    } else {
      setOrgMembers([]);
    }
  }, [selectedOrgDetails]);

  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
    if (!phoneRegex.test(phone)) {
      setPhoneError("Invalid format. Use 555-123-4567");
      return false;
    }
    setPhoneError(null);
    return true;
  };

  const applyAddressResultToProfile = (result: any, fallbackAddress: string) => {
    const components = Array.isArray(result?.address_components)
      ? result.address_components
      : Array.isArray(result?.addressComponents)
        ? result.addressComponents
        : [];
    const findComponent = (kind: string, short = false) => {
      const match = components.find((part: any) => Array.isArray(part.types) && part.types.includes(kind));
      if (!match) return '';
      return short
        ? String(match.short_name || match.shortText || '')
        : String(match.long_name || match.longText || '');
    };

    const streetNumber = findComponent('street_number');
    const route = findComponent('route');
    const city = findComponent('locality') || findComponent('sublocality') || findComponent('administrative_area_level_2');
    const state = findComponent('administrative_area_level_1', true);
    const zip = findComponent('postal_code');
    const addressLine1 = [streetNumber, route].filter(Boolean).join(' ').trim();
    const addressLine2 = findComponent('subpremise');

    const lat = result?.geometry?.location?.lat ?? result?.location?.latitude;
    const lng = result?.geometry?.location?.lng ?? result?.location?.longitude;
    const formattedAddress = String(result?.formatted_address || result?.formattedAddress || fallbackAddress);
    const placeId = String(result?.place_id || result?.id || '');

    setProfile((prev) => ({
      ...prev,
      address: formattedAddress,
      addressLine1: addressLine1 || undefined,
      addressLine2: addressLine2 || undefined,
      city: city || undefined,
      state: state || undefined,
      zipCode: zip || prev.zipCode,
      latitude: Number.isFinite(lat) ? Number(lat) : undefined,
      longitude: Number.isFinite(lng) ? Number(lng) : undefined,
      googlePlaceId: placeId || undefined,
      addressVerified: true,
      addressVerifiedAt: new Date().toISOString(),
    }));
  };

  const fetchAddressSuggestions = async (rawAddress: string) => {
    const address = String(rawAddress || '').trim();
    if (!mapsApiKey || address.length < 3 || addressStatus === 'VERIFYING') {
      setAddressSuggestions([]);
      return;
    }

    setIsAddressSuggesting(true);
    try {
      const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': mapsApiKey,
          'X-Goog-FieldMask': 'suggestions.placePrediction.place,suggestions.placePrediction.placeId,suggestions.placePrediction.text',
        },
        body: JSON.stringify({
          input: address,
          includedRegionCodes: ['us'],
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setAddressSuggestions([]);
        return;
      }

      const suggestions: PlaceSuggestion[] = Array.isArray(payload?.suggestions)
        ? payload.suggestions
            .map((item: any) => {
              const prediction = item?.placePrediction;
              const placeRef = String(prediction?.place || '');
              const placeId = String(prediction?.placeId || (placeRef.startsWith('places/') ? placeRef.replace('places/', '') : placeRef));
              const description = String(prediction?.text?.text || '').trim();
              return { placeId, description };
            })
            .filter((item: PlaceSuggestion) => item.placeId && item.description)
            .slice(0, 5)
        : [];

      setAddressSuggestions(suggestions);
      setHighlightedAddressIndex(-1);
    } catch {
      setAddressSuggestions([]);
      setHighlightedAddressIndex(-1);
    } finally {
      setIsAddressSuggesting(false);
    }
  };

  const handleSelectAddressSuggestion = async (suggestion: PlaceSuggestion) => {
    if (!mapsApiKey || !suggestion.placeId) return;
    setAddressStatus('VERIFYING');

    try {
      const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(suggestion.placeId)}`, {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': mapsApiKey,
          'X-Goog-FieldMask': 'id,formattedAddress,addressComponents,location',
        },
      });
      const place = await response.json();

      if (!response.ok || !place) {
        await verifyAddressWithGoogle(suggestion.description);
        return;
      }

      applyAddressResultToProfile(place, suggestion.description);
      setAddressStatus('VALID');
      setAddressSuggestions([]);
      setHighlightedAddressIndex(-1);
      setProfileSaveError(null);
    } catch {
      await verifyAddressWithGoogle(suggestion.description);
    }
  };

  const handleAddressInputBlur = () => {
    setAddressSuggestions([]);
    setHighlightedAddressIndex(-1);
    verifyAddressWithGoogle(profile.address);
  };

  const handleAddressInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setAddressSuggestions([]);
      setHighlightedAddressIndex(-1);
      return;
    }

    if (addressSuggestions.length === 0) {
      if (event.key === 'Enter') {
        event.preventDefault();
        verifyAddressWithGoogle(profile.address);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedAddressIndex((prev) => (prev + 1) % addressSuggestions.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedAddressIndex((prev) => {
        if (prev <= 0) return addressSuggestions.length - 1;
        return prev - 1;
      });
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const selected = addressSuggestions[highlightedAddressIndex] || addressSuggestions[0];
      if (selected) {
        handleSelectAddressSuggestion(selected);
      }
    }
  };

  useEffect(() => {
    const address = String(profile.address || '').trim();
    if (!mapsApiKey || address.length < 3 || profile.addressVerified) {
      setAddressSuggestions([]);
      setHighlightedAddressIndex(-1);
      return;
    }

    const timer = window.setTimeout(() => {
      fetchAddressSuggestions(address);
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [profile.address, profile.addressVerified, mapsApiKey]);

  const verifyAddressWithGoogle = async (rawAddress?: string) => {
    const address = (rawAddress ?? profile.address ?? '').trim();
    if (address.length < 5) {
      setAddressStatus('IDLE');
      return;
    }
    if (!mapsApiKey) {
      setAddressStatus('IDLE');
      return;
    }

    setAddressStatus('VERIFYING');

    try {
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${mapsApiKey}`);
      const geocode = await response.json();
      const topResult = geocode?.results?.[0];

      if (!response.ok || geocode?.status !== 'OK' || !topResult) {
        setAddressStatus('INVALID');
        setAddressSuggestions([]);
        setHighlightedAddressIndex(-1);
        setProfile((prev) => ({
          ...prev,
          addressVerified: false,
          addressVerifiedAt: undefined,
          googlePlaceId: undefined,
          latitude: undefined,
          longitude: undefined,
          addressLine1: undefined,
          addressLine2: undefined,
          city: undefined,
          state: undefined,
        }));
        return;
      }

      applyAddressResultToProfile(topResult, address);
      setAddressStatus('VALID');
      setAddressSuggestions([]);
      setHighlightedAddressIndex(-1);
      setProfileSaveError(null);
    } catch {
      setAddressStatus('INVALID');
    }
  };

  const handleProfileSave = async () => {
    const trimmedAddress = String(profile.address || '').trim();

    if (!validatePhone(profile.phone)) {
      setExpandedSections((prev) => ({ ...prev, profile: true }));
      alert("Please fix phone number errors before saving.");
      return;
    }
    if (trimmedAddress.length > 0 && mapsApiKey && !profile.addressVerified) {
      setExpandedSections((prev) => ({ ...prev, profile: true }));
      setProfileSaveError('Please select a verified address from suggestions or verify your address before saving.');
      return;
    }
    if (addressStatus === 'INVALID') {
      setExpandedSections((prev) => ({ ...prev, profile: true }));
      alert("Please verify your address.");
      return;
    }
    setIsSavingProfile(true);
    setProfileSaveError(null);
    try {
      await updateProfileForUser({
        fullName: profile.fullName,
        phone: profile.phone,
        email: profile.email,
        address: profile.address,
        addressLine1: profile.addressLine1,
        addressLine2: profile.addressLine2,
        city: profile.city,
        state: profile.state,
        zip: profile.zipCode,
        latitude: profile.latitude,
        longitude: profile.longitude,
        googlePlaceId: profile.googlePlaceId,
        addressVerified: Boolean(profile.addressVerified),
        addressVerifiedAt: profile.addressVerifiedAt,
        emergencyContactName: profile.emergencyContactName,
        emergencyContactPhone: profile.emergencyContactPhone,
        emergencyContactRelation: profile.emergencyContactRelation,
        communityId: profile.communityId,
        role: profile.role,
      });
      StorageService.saveProfile(profile);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err: any) {
      setProfileSaveError(err?.message || 'Unable to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleVitalsSave = async () => {
    if (!profile.zipCode?.trim()) {
      setExpandedSections((prev) => ({ ...prev, profile: true }));
      setVitalsSaveError('ZIP is pulled from your Home Address. Verify your address in Identity first.');
      return;
    }
    const memberValidation = validateHouseholdMembers(profile.household || []);
    if (!memberValidation.ok) {
      setExpandedSections((prev) => ({ ...prev, household: true }));
      setVitalsSaveError(memberValidation.error);
      return;
    }
    if (!profile.consentPreparednessPlanning) {
      setExpandedSections((prev) => ({ ...prev, security: true }));
      setVitalsSaveError('You must provide consent before saving Vital Intake.');
      return;
    }

    setIsSavingVitals(true);
    setVitalsSaveError(null);
    try {
      await updateVitalsForUser({
        household: profile.household,
        householdMembers: profile.householdMembers,
        petDetails: profile.petDetails,
        medicalNeeds: profile.medicalNeeds,
        zipCode: profile.zipCode,
        medicationDependency: Boolean(profile.medicationDependency),
        insulinDependency: Boolean(profile.insulinDependency),
        oxygenPoweredDevice: Boolean(profile.oxygenPoweredDevice),
        mobilityLimitation: Boolean(profile.mobilityLimitation),
        transportationAccess: Boolean(profile.transportationAccess),
        financialStrain: Boolean(profile.financialStrain),
        consentPreparednessPlanning: Boolean(profile.consentPreparednessPlanning),
      });
      const nextProfile: UserProfile = {
        ...profile,
        consentTimestamp: new Date().toISOString(),
      };
      setProfile(nextProfile);
      StorageService.saveProfile(nextProfile);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err: any) {
      setVitalsSaveError(err?.message || 'Unable to update vitals.');
    } finally {
      setIsSavingVitals(false);
    }
  };

  const updateProfile = (key: keyof UserProfile, value: any) => {
    setProfile((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'address') {
        next.addressVerified = false;
        next.addressVerifiedAt = undefined;
        next.googlePlaceId = undefined;
        next.latitude = undefined;
        next.longitude = undefined;
        next.addressLine1 = undefined;
        next.addressLine2 = undefined;
        next.city = undefined;
        next.state = undefined;
      }
      return next;
    });
    if (key === 'communityId') {
      setConnectedOrg(null);
      setVerifyError(null);
    }
    if (key === 'address') {
      setAddressStatus('IDLE');
      setAddressSuggestions([]);
      setHighlightedAddressIndex(-1);
      setProfileSaveError(null);
    }
  };

  const verifyCommunityId = async () => {
    const normalized = String(profile.communityId || '')
      .trim()
      .replace(/[–—−]/g, '-')
      .replace(/\s+/g, '')
      .toUpperCase();

    if (!normalized) return;

    setIsVerifying(true);
    setVerifyError(null);
    setConnectedOrg(null);

    try {
      const localOrg = StorageService.getOrganization(normalized);
      const remoteOrg = localOrg ? { orgCode: normalized, orgName: localOrg.name } : await getOrgByCode(normalized);

      if (!remoteOrg) {
        setVerifyError('Invalid Community ID');
        return;
      }

      const orgName = remoteOrg.orgName || localOrg?.name || normalized;
      const nextProfile: UserProfile = {
        ...profile,
        communityId: normalized,
      };

      setProfile(nextProfile);
      StorageService.saveProfile(nextProfile);
      setConnectedOrg(orgName);

      try {
        await updateProfileForUser({
          fullName: nextProfile.fullName,
          phone: nextProfile.phone,
          email: nextProfile.email,
          address: nextProfile.address,
          addressLine1: nextProfile.addressLine1,
          addressLine2: nextProfile.addressLine2,
          city: nextProfile.city,
          state: nextProfile.state,
          zip: nextProfile.zipCode,
          latitude: nextProfile.latitude,
          longitude: nextProfile.longitude,
          googlePlaceId: nextProfile.googlePlaceId,
          addressVerified: Boolean(nextProfile.addressVerified),
          addressVerifiedAt: nextProfile.addressVerifiedAt,
          emergencyContactName: nextProfile.emergencyContactName,
          emergencyContactPhone: nextProfile.emergencyContactPhone,
          emergencyContactRelation: nextProfile.emergencyContactRelation,
          communityId: normalized,
          role: nextProfile.role,
        });
      } catch {
        // Keep local connection state; profile update will retry on next explicit save.
      }
    } catch {
      setVerifyError('Unable to verify Community ID right now. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisconnectCommunity = async () => {
    if (!profile.communityId) return;
    setIsDisconnectingOrg(true);
    setVerifyError(null);
    try {
      await updateProfileForUser({
        fullName: profile.fullName,
        phone: profile.phone,
        email: profile.email,
        address: profile.address,
        emergencyContactName: profile.emergencyContactName,
        emergencyContactPhone: profile.emergencyContactPhone,
        emergencyContactRelation: profile.emergencyContactRelation,
        communityId: '',
        role: profile.role,
      });

      const nextProfile: UserProfile = {
        ...profile,
        communityId: '',
      };
      setProfile(nextProfile);
      StorageService.saveProfile(nextProfile);
      setConnectedOrg(null);
      setVerifyError(null);
    } catch (err: any) {
      setVerifyError(err?.message || 'Unable to disconnect organization right now.');
    } finally {
      setIsDisconnectingOrg(false);
    }
  };

  const toggleNotification = (key: keyof UserProfile['notifications']) => {
    setProfile(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: !prev.notifications[key]
      }
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard');
  };

  const shareInviteMessage = async (memberName: string, text: string) => {
    const title = `AERA household invite for ${memberName}`;
    const encodedText = encodeURIComponent(text);
    const encodedSubject = encodeURIComponent(title);

    if (navigator.share) {
      try {
        await navigator.share({ title, text });
        return { method: 'native' as const, copied: false };
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return { method: 'cancelled' as const, copied: false };
        }
      }
    }

    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = false;
    }

    try {
      window.location.href = `mailto:?subject=${encodedSubject}&body=${encodedText}`;
      return { method: 'email' as const, copied };
    } catch {
      if (copied) {
        return { method: 'clipboard' as const, copied };
      }
      throw new Error('Unable to open share options on this device.');
    }
  };

  const buildMemberInviteCode = (member: HouseholdMember) => {
    const household = (profile.householdCode || '').trim().toUpperCase();
    const fallback = (member.id || '').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(-3);
    const nameSeed = (member.name || '').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 3);
    const suffix = (nameSeed || fallback || 'MEM').padEnd(3, 'X').slice(0, 3);
    return household ? `${household}-${suffix}` : suffix;
  };

  const inviteEnabledMembers = (profile.household || []).filter((member) => member.loginEnabled);

  const latestInviteByMember = useMemo(() => {
    const mapped: Record<string, HouseholdInvitationRecord> = {};
    memberInvites.forEach((invite) => {
      if (!invite.inviteeMemberRef) return;
      if (!mapped[invite.inviteeMemberRef]) {
        mapped[invite.inviteeMemberRef] = invite;
      }
    });
    return mapped;
  }, [memberInvites]);

  const pendingOwnerRequests = useMemo(
    () => ownerJoinRequests.filter((request) => request.status === 'pending'),
    [ownerJoinRequests],
  );

  const latestMyJoinRequest = useMemo(
    () => myJoinRequests[0] || null,
    [myJoinRequests],
  );

  const unreadNotificationCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications],
  );

  const latestSafetyStatusByMember = useMemo(() => {
    const mapped: Record<string, { status: 'SAFE' | 'DANGER'; at?: string }> = {};
    for (const item of notifications) {
      if (item.type !== 'household_member_reported_safe' && item.type !== 'household_member_reported_danger') continue;
      const metadata = item.metadata || {};
      const memberRef = String((metadata as any).memberRef || '');
      if (!memberRef || mapped[memberRef]) continue;
      mapped[memberRef] = {
        status: item.type === 'household_member_reported_danger' ? 'DANGER' : 'SAFE',
        at: item.createdAt,
      };
    }
    return mapped;
  }, [notifications]);

  const handleCopyMemberInvite = async (member: HouseholdMember) => {
    setInviteStatusMessage(null);
    setInviteError(null);
    setInviteBusyMemberId(member.id);
    try {
      if (!isValidPhoneForInvite(member.loginPhone || '')) {
        throw new Error(`${member.name} needs a valid phone number before creating an account invite.`);
      }
      const invitation = await createHouseholdInvitationForMember({
        memberId: member.id,
        memberName: member.name,
        inviteePhone: member.loginPhone || '',
        suggestedCode: buildMemberInviteCode(member),
      });
      const text = `AERA invite for ${member.name}: create or log in to your account, then use invite code ${invitation.invitationCode} to join this household.`;
      const result = await shareInviteMessage(member.name, text);
      if (result.method === 'cancelled') {
        setInviteStatusMessage('Share cancelled.');
      } else if (result.method === 'native') {
        setInviteStatusMessage(`Invite shared for ${member.name}. Current status: ${invitation.status}.`);
      } else if (result.copied) {
        setInviteStatusMessage(`Invite prepared for ${member.name}. Opened email and copied message.`);
      } else {
        setInviteStatusMessage(`Invite prepared for ${member.name}. Opened email draft.`);
      }
      const invites = await listHouseholdInvitationsForCurrentUser();
      setMemberInvites(invites);
    } catch (err: any) {
      setInviteError(err?.message || 'Unable to create invite right now.');
    } finally {
      setInviteBusyMemberId(null);
    }
  };

  const handleResendMemberInvite = async (member: HouseholdMember) => {
    setInviteStatusMessage(null);
    setInviteError(null);
    setInviteBusyMemberId(member.id);
    try {
      if (!isValidPhoneForInvite(member.loginPhone || '')) {
        throw new Error(`${member.name} needs a valid phone number before creating an account invite.`);
      }
      const invitation = await createHouseholdInvitationForMember({
        memberId: member.id,
        memberName: member.name,
        inviteePhone: member.loginPhone || '',
        suggestedCode: buildMemberInviteCode(member),
        forceNew: true,
      });
      const text = `AERA invite for ${member.name}: create or log in to your account, then use invite code ${invitation.invitationCode} to join this household.`;
      const result = await shareInviteMessage(member.name, text);
      if (result.method === 'cancelled') {
        setInviteStatusMessage('Share cancelled.');
      } else if (result.copied) {
        setInviteStatusMessage(`New invite generated for ${member.name}. Opened email and copied message.`);
      } else {
        setInviteStatusMessage(`New invite generated for ${member.name}.`);
      }
      const invites = await listHouseholdInvitationsForCurrentUser();
      setMemberInvites(invites);
    } catch (err: any) {
      setInviteError(err?.message || 'Unable to resend invite right now.');
    } finally {
      setInviteBusyMemberId(null);
    }
  };

  const handleRevokeMemberInvite = async (member: HouseholdMember) => {
    const currentInvite = latestInviteByMember[member.id];
    if (!currentInvite?.id || currentInvite.status !== 'PENDING') return;

    setInviteStatusMessage(null);
    setInviteError(null);
    setInviteBusyMemberId(member.id);
    try {
      await revokeHouseholdInvitationForCurrentUser(currentInvite.id);
      setInviteStatusMessage(`Invite revoked for ${member.name}.`);
      const invites = await listHouseholdInvitationsForCurrentUser();
      setMemberInvites(invites);
    } catch (err: any) {
      setInviteError(err?.message || 'Unable to revoke invite right now.');
    } finally {
      setInviteBusyMemberId(null);
    }
  };

  const handleJoinHousehold = async () => {
    setHouseholdCodeError(null);
    setHouseholdCodeSuccess(null);

    if (profile.householdId) {
      setHouseholdCodeError('Leave your current household before submitting a join request.');
      return;
    }

    const normalized = householdCodeInput.trim().toUpperCase();
    if (normalized.length < 6 || normalized.includes('-')) {
      setHouseholdCodeError('Enter a valid 6-character household code.');
      return;
    }

    setIsHouseholdCodeBusy(true);
    try {
      const response = await requestHouseholdJoinByCode(normalized);
      setHouseholdCodeSuccess(response.message || 'Your request has been sent to the household administrator.');
      setHouseholdCodeInput('');
      try {
        const [ownerRequests, myRequests, inbox] = await Promise.all([
          listHouseholdJoinRequestsForOwner(),
          listMyHouseholdJoinRequests(),
          listNotificationsForCurrentUser(50),
        ]);
        setOwnerJoinRequests(ownerRequests);
        setMyJoinRequests(myRequests);
        setNotifications(inbox);
      } catch {
        // Ignore refresh errors.
      }
    } catch (err: any) {
      setHouseholdCodeError(err?.message || 'Unable to submit join request.');
    } finally {
      setIsHouseholdCodeBusy(false);
    }
  };

  const handleLeaveHousehold = async () => {
    if (!profile.householdId || isLeavingHousehold) return;

    setHouseholdCodeError(null);
    setHouseholdCodeSuccess(null);
    setIsLeavingHousehold(true);
    try {
      await leaveCurrentHousehold(profile.householdId);

      const summary = await fetchHouseholdForCurrentUser();
      if (summary) {
        applyHouseholdSummary(summary);
      } else {
        setProfile((prev) => ({
          ...prev,
          householdId: undefined,
          householdCode: undefined,
          householdName: undefined,
          householdRole: undefined,
        }));

        const current = StorageService.getProfile();
        StorageService.saveProfile({
          ...current,
          householdId: undefined,
          householdCode: undefined,
          householdName: undefined,
          householdRole: undefined,
        });
      }

      try {
        const [options, ownerRequests, myRequests, inbox] = await Promise.all([
          listHouseholdsForCurrentUser(),
          listHouseholdJoinRequestsForOwner(),
          listMyHouseholdJoinRequests(),
          listNotificationsForCurrentUser(50),
        ]);
        setHouseholdOptions(options);
        setOwnerJoinRequests(ownerRequests);
        setMyJoinRequests(myRequests);
        setNotifications(inbox);
      } catch {
        setHouseholdOptions([]);
        setOwnerJoinRequests([]);
      }

      setHouseholdCodeSuccess('You left your current household. You can now submit a join request.');
    } catch (err: any) {
      setHouseholdCodeError(err?.message || 'Unable to leave household right now.');
    } finally {
      setIsLeavingHousehold(false);
    }
  };

  const handleSwitchHousehold = async (nextHouseholdId: string) => {
    if (!nextHouseholdId || nextHouseholdId === profile.householdId) return;
    setHouseholdCodeError(null);
    setHouseholdCodeSuccess(null);
    setIsSwitchingHousehold(true);
    try {
      await switchActiveHousehold(nextHouseholdId);
      const selected = householdOptions.find((item) => item.householdId === nextHouseholdId);
      if (selected) {
        applyHouseholdSummary({
          householdId: selected.householdId,
          householdCode: selected.householdCode,
          householdName: selected.householdName,
          householdRole: selected.householdRole,
        });
      }
      setHouseholdCodeSuccess('Active household updated.');
    } catch (err: any) {
      setHouseholdCodeError(err?.message || 'Unable to switch households right now.');
    } finally {
      setIsSwitchingHousehold(false);
    }
  };

  const handleResolveJoinRequest = async (request: HouseholdJoinRequestRecord, action: 'approved' | 'rejected') => {
    setHouseholdCodeError(null);
    setHouseholdCodeSuccess(null);
    setJoinRequestBusyId(request.id);
    try {
      await resolveHouseholdJoinRequest(request.id, action);
      const [ownerRequests, myRequests, inbox] = await Promise.all([
        listHouseholdJoinRequestsForOwner(),
        listMyHouseholdJoinRequests(),
        listNotificationsForCurrentUser(50),
      ]);
      setOwnerJoinRequests(ownerRequests);
      setMyJoinRequests(myRequests);
      setNotifications(inbox);
      setHouseholdCodeSuccess(
        action === 'approved'
          ? 'Connection successful. This member has been added.'
          : 'Request rejected.',
      );
    } catch (err: any) {
      setHouseholdCodeError(err?.message || 'Unable to resolve request right now.');
    } finally {
      setJoinRequestBusyId(null);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotificationsBusy(true);
    try {
      const unread = notifications.filter((item) => !item.read);
      await Promise.all(unread.map((item) => markNotificationRead(item.id)));
      const inbox = await listNotificationsForCurrentUser(50);
      setNotifications(inbox);
    } catch {
      // Best effort read state update.
    } finally {
      setNotificationsBusy(false);
    }
  };

  const handleLogout = () => {
    StorageService.logoutUser();
    setView('LOGIN');
  };

  const openDbViewer = () => {
    if (!isAdmin) return;
    const db = StorageService.getDB();
    setDbContent(db);
    setCurrentSection('DB_VIEWER');
  };

  const openOrgDirectory = () => {
    if (!isAdmin) return;
    const db = StorageService.getDB();
    setOrgList(db.organizations);
    setCurrentSection('ORG_DIRECTORY');
    setSelectedOrgDetails(null);
  };

  const openAccessControl = () => {
    console.info('[AccessControl] openAccessControl clicked', { isAdmin });
    if (!isAdmin) {
      console.warn('[AccessControl] blocked: not admin');
      return;
    }
    const db = StorageService.getDB();
    console.info('[AccessControl] loading users', { count: Array.isArray(db.users) ? db.users.length : 0 });
    setUsers(Array.isArray(db.users) ? db.users : []);
    setActiveTab('ALL_USERS');
    setCurrentSection('ACCESS_CONTROL');
    setSelectedUser(null);
  };

  const openBroadcastControl = () => {
    if (!isAdmin) return;
    const db = StorageService.getDB();
    setOrgList(db.organizations);
    setSystemTicker(db.tickerMessage);
    setCurrentSection('BROADCAST_CONTROL');
  };

  const openMasterInventory = () => {
    if (!isAdmin) return;
    const reqs = StorageService.getAllReplenishmentRequests();
    setInventoryRequests(reqs);
    setCurrentSection('MASTER_INVENTORY');
  };

  // --- Access Control Handlers ---
  const togglePermission = (roleId: UserRole, perm: keyof RoleDefinition['permissions']) => {
    setRoles(prev => {
      const updated = prev.map(r => {
        if (r.id === roleId) {
          return {
            ...r,
            permissions: { ...r.permissions, [perm]: !r.permissions[perm] }
          };
        }
        return r;
      });
      StorageService.saveRoles(updated);
      return updated;
    });
  };

  const updateUserRole = (userId: string, newRole: UserRole) => {
    if (!isAdmin) return;
    setUsers(prev => {
      const updated = prev.map(u => u.id === userId ? { ...u, role: newRole } : u);
      const changed = updated.find(u => u.id === userId);
      if (changed) {
        StorageService.saveProfile(changed);
      }
      return updated;
    });
  };

  const toggleUserStatus = (userId: string, currentStatus: boolean) => {
    if (!isAdmin) return;
    const newStatus = !currentStatus;
    StorageService.updateUserStatus(userId, newStatus);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, active: newStatus } : u));
    setSelectedUser(prev => prev && prev.id === userId ? { ...prev, active: newStatus } : prev);
  };

  const handleExportUsers = () => {
    const headers = ['ID', 'Name', 'Phone', 'Role', 'Status', 'Address', 'Community ID', 'Household Size'];
    const rows = users.map(u => [
      u.id,
      `"${u.fullName.replace(/"/g, '""')}"`,
      u.phone,
      u.role,
      u.active ? 'Active' : 'Inactive',
      `"${u.address.replace(/"/g, '""')}"`,
      u.communityId || 'N/A',
      u.householdMembers
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `AERA_User_Directory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleOrgStatus = (orgId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    StorageService.updateOrgStatus(orgId, newStatus);
    // Update both list and selected detail view
    setOrgList(prev => prev.map(o => o.id === orgId ? { ...o, active: newStatus } : o));
    if (selectedOrgDetails && selectedOrgDetails.id === orgId) {
      setSelectedOrgDetails(prev => prev ? { ...prev, active: newStatus } : null);
    }
  };

  const handleUpdateSystemTicker = () => {
    StorageService.updateSystemTicker(systemTicker);
    alert("Global System Alert Updated");
  };

  const handleClearOrgBroadcast = (orgId: string) => {
    StorageService.clearOrgBroadcast(orgId);
    setOrgList(prev => prev.map(o => o.id === orgId ? { ...o, currentBroadcast: undefined } : o));
  };

  const changeLanguage = (lang: LanguageCode) => {
    setProfile(prev => {
      const updated = { ...prev, language: lang };
      StorageService.saveProfile(updated);
      return updated;
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 1000);
  };

  const handleMarkFulfilled = (requestId: string) => {
    StorageService.updateReplenishmentRequestStatus(requestId, 'FULFILLED');
    // Refresh list
    setInventoryRequests(prev => prev.map(req => 
      req.id === requestId ? { ...req, status: 'FULFILLED' } : req
    ));
  };

  const handleReopenRequest = (requestId: string) => {
    StorageService.updateReplenishmentRequestStatus(requestId, 'PENDING');
    // Refresh list
    setInventoryRequests(prev => prev.map(req => 
      req.id === requestId ? { ...req, status: 'PENDING' } : req
    ));
  };

  const handlePrintOrder = (req: ReplenishmentRequest) => {
    setWorkOrderForm({}); // Reset form for new order
    setPrintingRequest(req);
  };

  const updateWorkOrderForm = (key: string, value: string) => {
    setWorkOrderForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSignature = (dataUrl: string, type: 'RELEASE' | 'RECEIVE') => {
    if (printingRequest) {
      StorageService.signReplenishmentRequest(printingRequest.id, dataUrl, type);
      
      const updatedReq = { ...printingRequest };
      if (type === 'RELEASE') {
        updatedReq.signature = dataUrl;
        updatedReq.signedAt = new Date().toISOString();
      } else {
        updatedReq.receivedSignature = dataUrl;
        updatedReq.receivedAt = new Date().toISOString();
      }
      
      setPrintingRequest(updatedReq);
      // Also update the main list
      setInventoryRequests(prev => prev.map(r => r.id === printingRequest.id ? updatedReq : r));
    }
  };

  const handleExportCSV = () => {
    const headers = ['Request ID', 'Org Name', 'Org ID', 'Item', 'Quantity', 'Status', 'Date', 'Provider', 'Released', 'Received'];
    const rows = inventoryRequests.map(req => [
      req.id,
      `"${req.orgName.replace(/"/g, '""')}"`,
      req.orgId,
      `"${req.item.replace(/"/g, '""')}"`,
      req.quantity,
      req.status,
      new Date(req.timestamp).toLocaleDateString(),
      `"${req.provider.replace(/"/g, '""')}"`,
      req.signature ? 'Yes' : 'No',
      req.receivedSignature ? 'Yes' : 'No'
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `AERA_Master_Inventory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportTotalsCSV = () => {
    const totals = inventoryRequests.reduce((acc, req) => {
      acc[req.item] = (acc[req.item] || 0) + req.quantity;
      return acc;
    }, {} as Record<string, number>);

    const headers = ['Item Name', 'Total Quantity'];
    const rows = Object.entries(totals).map(([item, count]) => [
      `"${item.replace(/"/g, '""')}"`,
      count
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `AERA_Inventory_Tally_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Render: Printable Work Order (Overlay) ---
  if (printingRequest) {
    const org = StorageService.getOrganization(printingRequest.orgId);
    
    return (
      <div className="fixed inset-0 z-[100] overflow-y-auto bg-white p-8 font-serif text-black animate-fade-in print:p-0 print:bg-white print:text-black print:static print:overflow-visible">
        {/* Navigation (Hidden in Print) */}
        <div className="fixed top-0 left-0 right-0 p-4 bg-slate-900 text-white flex justify-between items-center print:hidden shadow-lg z-50">
           <span className="font-bold">Work Order Preview</span>
           <div className="flex gap-2">
             <Button size="sm" className="bg-brand-600 text-white" onClick={() => window.print()}>
               <Printer size={16} className="mr-2" /> Print Now
             </Button>
             <Button size="sm" variant="secondary" onClick={() => setPrintingRequest(null)}>
               <X size={16} className="mr-2" /> Close
             </Button>
           </div>
        </div>

        {/* Paper Layout */}
        <div className="max-w-3xl mx-auto border border-black p-8 mt-16 print:mt-0 print:border-0 print:w-full">
           <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
              <div>
                <h1 className="text-4xl font-bold uppercase tracking-tight">Work Order</h1>
                <p className="text-sm font-bold uppercase mt-1">AERA Logistics Fulfillment</p>
              </div>
              <div className="text-right">
                <p className="text-sm"><strong>Order ID:</strong> {printingRequest.id}</p>
                <p className="text-sm"><strong>Printed On:</strong> {new Date().toLocaleDateString()}</p>
                <p className="text-sm"><strong>Request Date:</strong> {new Date(printingRequest.timestamp).toLocaleDateString()}</p>
                <p className="text-sm"><strong>Provider:</strong> {printingRequest.provider}</p>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                 <h3 className="font-bold uppercase border-b border-black mb-2 text-sm">Ship To (Organization)</h3>
                 <p className="text-lg font-bold">{printingRequest.orgName}</p>
                 <p>{org?.address || 'Address Unknown'}</p>
                 <p>{org?.adminContact}</p>
                 <p>{org?.adminPhone}</p>
                 <p className="mt-2 text-sm font-mono">ID: {printingRequest.orgId}</p>
              </div>
              <div>
                 <h3 className="font-bold uppercase border-b border-black mb-2 text-sm">Fulfillment Instructions</h3>
                 <p className="text-sm mb-2">Please pick and pack the items listed below. Ensure quality check is performed before release.</p>
                 <div className="border border-black p-2 text-center mt-4">
                    <p className="text-xs uppercase font-bold">Priority Status</p>
                    <p className="text-xl font-bold">URGENT</p>
                 </div>
              </div>
           </div>

           <div className="mb-12">
              <table className="w-full border-collapse border border-black">
                 <thead>
                    <tr className="bg-slate-100 print:bg-slate-200">
                       <th className="border border-black p-2 text-left w-12 print:text-black">#</th>
                       <th className="border border-black p-2 text-left print:text-black">Requested Item</th>
                       <th className="border border-black p-2 text-center w-24 print:text-black">Qty Req</th>
                       <th className="border border-black p-2 text-center w-28 print:text-black">Qty Picked</th>
                       <th className="border border-black p-2 text-center w-28 print:text-black">Verified</th>
                    </tr>
                 </thead>
                 <tbody>
                    <tr>
                       <td className="border border-black p-3 text-center print:text-black">1</td>
                       <td className="border border-black p-3 font-bold text-lg print:text-black">{printingRequest.item}</td>
                       <td className="border border-black p-3 text-center font-bold text-lg print:text-black">{printingRequest.quantity}</td>
                       <td className="border border-black p-1">
                         <input 
                           className="w-full h-full text-center font-bold text-lg bg-yellow-50/50 hover:bg-yellow-50 focus:bg-white outline-none transition-colors print:bg-transparent print:border-none"
                           placeholder=""
                           value={workOrderForm['item_picked'] || ''}
                           onChange={(e) => updateWorkOrderForm('item_picked', e.target.value)}
                         />
                       </td>
                       <td className="border border-black p-1">
                         <input 
                           className="w-full h-full text-center font-medium text-lg bg-yellow-50/50 hover:bg-yellow-50 focus:bg-white outline-none transition-colors print:bg-transparent print:border-none"
                           placeholder=""
                           value={workOrderForm['item_verified'] || ''}
                           onChange={(e) => updateWorkOrderForm('item_verified', e.target.value)}
                         />
                       </td>
                    </tr>
                    {/* Note Rows with Inputs */}
                    {[2,3].map(i => (
                       <tr key={i}>
                          <td className="border border-black p-3 text-center opacity-50 print:text-black">{i}</td>
                          <td className="border border-black p-2">
                            <div className="flex items-center gap-2 h-full">
                              <span className="italic text-slate-500 text-sm whitespace-nowrap print:text-black">Notes/Substitutions:</span>
                              <input 
                                className="flex-1 bg-transparent border-b border-slate-300 focus:border-blue-500 outline-none text-slate-900 print:border-none print:text-black font-mono"
                                value={workOrderForm[`note_${i}`] || ''}
                                onChange={(e) => updateWorkOrderForm(`note_${i}`, e.target.value)}
                              />
                            </div>
                          </td>
                          <td className="border border-black p-3"></td>
                          <td className="border border-black p-3"></td>
                          <td className="border border-black p-3"></td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>

           <div className="grid grid-cols-2 gap-12 mt-12 pt-12">
              <div className="break-inside-avoid">
                 <p className="text-xs font-bold uppercase mb-2">Released By (Signature)</p>
                 {printingRequest.signature ? (
                   <div className="border border-slate-200 p-2 print:border-none">
                     <img src={printingRequest.signature} alt="Digital Signature" className="h-16 mb-1"/>
                     <p className="text-[10px] text-slate-500 font-mono print:text-black">
                       Signed: {new Date(printingRequest.signedAt || '').toLocaleString()}
                     </p>
                   </div>
                 ) : (
                   <div className="print:hidden">
                     <SignaturePad onSave={(data) => handleSaveSignature(data, 'RELEASE')} />
                   </div>
                 )}
                 {/* Print-only signature line if digital not present */}
                 {!printingRequest.signature && (
                   <div className="hidden print:block border-b border-black mb-2 h-16"></div>
                 )}
              </div>
              
              <div className="break-inside-avoid">
                 <p className="text-xs font-bold uppercase mb-2">Received By (Signature)</p>
                 {printingRequest.receivedSignature ? (
                   <div className="border border-slate-200 p-2 print:border-none">
                     <img src={printingRequest.receivedSignature} alt="Digital Signature" className="h-16 mb-1"/>
                     <p className="text-[10px] text-slate-500 font-mono print:text-black">
                       Signed: {new Date(printingRequest.receivedAt || '').toLocaleString()}
                     </p>
                   </div>
                 ) : (
                   <div className="print:hidden">
                     <SignaturePad onSave={(data) => handleSaveSignature(data, 'RECEIVE')} />
                   </div>
                 )}
                 {/* Print-only signature line if digital not present */}
                 {!printingRequest.receivedSignature && (
                   <div className="hidden print:block border-b border-black mb-2 h-16"></div>
                 )}
              </div>
           </div>
           
           <div className="text-center mt-12 text-xs text-slate-500 print:text-black">
              <p>Generated by AERA System • {new Date().toLocaleString()}</p>
           </div>
        </div>
      </div>
    );
  }

  // --- Render: Master Inventory Database ---
  if (currentSection === 'MASTER_INVENTORY') {
    const totals = inventoryRequests.reduce((acc, req) => {
      acc[req.item] = (acc[req.item] || 0) + req.quantity;
      return acc;
    }, {} as Record<string, number>);

    return (
      <div className="p-6 pb-28 space-y-6 animate-fade-in bg-white min-h-screen print:p-0 print:pb-0">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 sticky top-0 bg-white z-10 print:hidden">
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentSection('MAIN')} className="p-2 -ml-2 text-slate-500 hover:text-slate-800">
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Master Inventory Database</h1>
              <p className="text-xs text-slate-500">System-Wide Supply Request Aggregation</p>
            </div>
          </div>
        </div>

        {/* Print Header (Only visible in print if printing main list) */}
        <div className="hidden print:block mb-6">
           <h1 className="text-2xl font-bold text-slate-900">AERA Master Inventory Report</h1>
           <p className="text-sm text-slate-500">Generated on {new Date().toLocaleString()}</p>
        </div>

        {/* Summary Tally */}
        <div className="space-y-4 print:break-inside-avoid">
           <div className="flex justify-between items-end border-b-2 border-slate-900 pb-1">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider">Total Tally (All Organizations)</h3>
              <button onClick={handleExportTotalsCSV} className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 print:hidden">
                <Download size={14} /> Export Tally CSV
              </button>
           </div>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(totals).map(([item, count]) => (
                <div key={item} className="bg-slate-50 border border-slate-200 p-4 rounded-lg print:border-black print:bg-white print:border">
                   <p className="text-xs font-bold text-slate-500 uppercase">{item}</p>
                   <p className="text-2xl font-mono font-bold text-slate-900">{count}</p>
                </div>
              ))}
              {Object.keys(totals).length === 0 && <p className="text-slate-500 italic">No requests logged.</p>}
           </div>
        </div>

        {/* Detailed List */}
        <div className="space-y-4 mt-8">
           <div className="flex justify-between items-end border-b-2 border-slate-900 pb-1">
             <h3 className="font-bold text-slate-900 uppercase tracking-wider">Request Log</h3>
             <Button 
                size="sm" 
                variant="outline" 
                className="border-slate-300 text-slate-900 hover:bg-slate-50 print:hidden h-8"
                onClick={handleExportCSV}
              >
                <Download size={14} className="mr-2" /> Export Log CSV
              </Button>
           </div>
           
           <div className="overflow-x-auto print:overflow-visible">
             <table className="w-full text-left text-sm print:text-xs">
               <thead className="print:table-header-group">
                 <tr className="bg-slate-100 print:bg-slate-200">
                   <th className="p-3 font-bold text-slate-700">Organization</th>
                   <th className="p-3 font-bold text-slate-700">Item</th>
                   <th className="p-3 font-bold text-slate-700">Qty</th>
                   <th className="p-3 font-bold text-slate-700">Date</th>
                   <th className="p-3 font-bold text-slate-700">Status</th>
                   <th className="p-3 font-bold text-slate-700 print:hidden">Action</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-200">
                 {inventoryRequests.map(req => (
                   <tr key={req.id} className="print:break-inside-avoid">
                     <td className="p-3 font-medium text-slate-900">{req.orgName} <span className="text-xs text-slate-500 block">{req.orgId}</span></td>
                     <td className="p-3 text-slate-700">{req.item}</td>
                     <td className="p-3 font-mono font-bold text-slate-900">{req.quantity}</td>
                     <td className="p-3 text-slate-500">{new Date(req.timestamp).toLocaleDateString()}</td>
                     <td className="p-3">
                       <span className={`px-2 py-1 rounded text-xs font-bold ${req.status === 'FULFILLED' ? 'bg-green-100 text-green-700 print:border print:border-black' : 'bg-yellow-100 text-yellow-700 print:border print:border-black'}`}>
                         {req.status}
                       </span>
                     </td>
                     <td className="p-3 print:hidden">
                       <div className="flex flex-col gap-2">
                         {req.status === 'PENDING' ? (
                           <div className="flex gap-2">
                             <Button 
                               size="sm" 
                               onClick={() => handleMarkFulfilled(req.id)}
                               className="bg-green-600 hover:bg-green-700 text-xs py-1 h-8"
                             >
                               <CheckSquare size={14} className="mr-1" /> Fulfill
                             </Button>
                             <Button
                               size="sm"
                               variant="outline"
                               onClick={() => handlePrintOrder(req)}
                               className="text-xs py-1 h-8 px-2 border-slate-300"
                               title={req.signature ? "Print Work Order" : "Sign Work Order"}
                             >
                               {req.signature && req.receivedSignature ? <Printer size={14} /> : <PenTool size={14} />}
                             </Button>
                           </div>
                         ) : (
                           <div className="flex items-center gap-2">
                             <Button
                               size="sm"
                               variant="outline"
                               onClick={() => handlePrintOrder(req)}
                               className="text-xs py-1 h-8 px-2 border-slate-300 mr-2"
                               title="View Signed Order"
                             >
                               {req.signature && req.receivedSignature ? <CheckCircle size={14} className="text-green-600" /> : <Printer size={14} />}
                             </Button>
                             <button 
                               onClick={() => handleReopenRequest(req.id)}
                               className="text-xs text-slate-400 hover:text-blue-600 hover:underline flex items-center gap-0.5"
                               title="Undo Completion"
                             >
                               <RefreshCcw size={10} /> Undo
                             </button>
                           </div>
                         )}
                       </div>
                     </td>
                   </tr>
                 ))}
                 {inventoryRequests.length === 0 && (
                   <tr><td colSpan={6} className="p-4 text-center text-slate-500">No requests found.</td></tr>
                 )}
               </tbody>
             </table>
           </div>
        </div>
        
        {/* Print Footer */}
        <div className="hidden print:block mt-8 pt-4 border-t border-slate-300 text-center text-xs text-slate-500 fixed bottom-0 left-0 right-0">
           <p>End of Report • AERA System</p>
        </div>
      </div>
    );
  }

  // --- Render: Broadcast Control ---
  if (currentSection === 'BROADCAST_CONTROL') {
    return (
      <div className="p-6 pb-28 space-y-6 animate-fade-in bg-slate-50 min-h-screen">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4 sticky top-0 bg-slate-50 z-10">
          <button onClick={() => setCurrentSection('MAIN')} className="p-2 -ml-2 text-slate-500 hover:text-slate-800">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Broadcast Control</h1>
            <p className="text-xs text-slate-500">Manage System & Organization Alerts</p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 p-4 rounded-xl shadow-sm">
           <h3 className="font-bold text-red-900 mb-2 flex items-center gap-2">
             <Activity size={18} /> Global System Alert
           </h3>
           <p className="text-xs text-red-700 mb-3">
             This message overrides ALL organization broadcasts and is visible to every user.
           </p>
           <Textarea 
             className="bg-white border-red-200 mb-3"
             value={systemTicker}
             onChange={(e) => setSystemTicker(e.target.value)}
             placeholder="Enter high-priority system alert..."
           />
           <div className="flex justify-end gap-2">
             <Button size="sm" variant="ghost" onClick={() => setSystemTicker('')} className="text-slate-500">Clear</Button>
             <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleUpdateSystemTicker}>Update Global Alert</Button>
           </div>
        </div>

        <h3 className="font-bold text-slate-900 mt-4">Active Organization Broadcasts</h3>
        <div className="space-y-3">
           {orgList.filter(o => o.currentBroadcast).map(org => (
             <div key={org.id} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                <div className="flex justify-between items-start mb-2">
                   <div className="font-bold text-slate-900">{org.name}</div>
                   <button 
                     onClick={() => handleClearOrgBroadcast(org.id)}
                     className="text-xs text-red-600 font-bold hover:underline"
                   >
                     Remove
                   </button>
                </div>
                <div className="bg-slate-50 p-3 rounded text-sm text-slate-700 italic">
                  "{org.currentBroadcast}"
                </div>
                <div className="text-xs text-slate-400 mt-2 text-right">
                  Last Updated: {new Date(org.lastBroadcastTime || '').toLocaleString()}
                </div>
             </div>
           ))}
           {orgList.filter(o => o.currentBroadcast).length === 0 && (
             <p className="text-center text-slate-400 py-4 italic">No active organization broadcasts.</p>
           )}
        </div>
      </div>
    );
  }

  // --- Render: DB Viewer ---
  if (currentSection === 'DB_VIEWER') {
    return (
      <div className="p-6 pb-28 space-y-6 animate-fade-in bg-slate-900 min-h-screen text-slate-300 font-mono">
        <div className="flex items-center justify-between border-b border-slate-700 pb-4 sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentSection('MAIN')} className="p-2 -ml-2 text-slate-400 hover:text-white">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-xl font-bold text-white">Database Viewer</h1>
          </div>
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-brand-400 hover:text-brand-300 hover:bg-slate-800"
            onClick={() => copyToClipboard(JSON.stringify(dbContent, null, 2))}
          >
            <Copy size={16} className="mr-2" /> Copy JSON
          </Button>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 overflow-hidden">
             <h3 className="text-brand-400 font-bold mb-2">Users ({dbContent?.users.length})</h3>
             <pre className="text-xs overflow-auto max-h-60 text-slate-300">
               {JSON.stringify(dbContent?.users, null, 2)}
             </pre>
          </div>
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 overflow-hidden">
             <h3 className="text-purple-400 font-bold mb-2">Organizations ({dbContent?.organizations.length})</h3>
             <div className="space-y-2">
                {dbContent?.organizations.map(org => (
                  <div key={org.id} className="p-2 bg-slate-900 rounded border border-slate-600 flex justify-between">
                    <span>{org.name}</span>
                    <span className="text-purple-300 select-all font-bold">{org.id}</span>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Render: Org Directory ---
  if (currentSection === 'ORG_DIRECTORY') {
    const filteredOrgs = orgList.filter(o => 
      o.name.toLowerCase().includes(orgSearch.toLowerCase()) || 
      o.id.toLowerCase().includes(orgSearch.toLowerCase()) ||
      o.type.toLowerCase().includes(orgSearch.toLowerCase())
    );

    return (
      <div className="p-6 pb-28 space-y-6 animate-fade-in bg-slate-50 min-h-screen">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 sticky top-0 bg-slate-50 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentSection('MAIN')} className="p-2 -ml-2 text-slate-500 hover:text-slate-800">
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Organization Directory</h1>
              <p className="text-xs text-slate-500">Search and View Registered Hubs</p>
            </div>
          </div>
        </div>

        {selectedOrgDetails ? (
          <div className="animate-slide-up space-y-6">
            <Button variant="ghost" onClick={() => setSelectedOrgDetails(null)} className="pl-0 text-slate-500">
              <ArrowLeft size={16} className="mr-1" /> Back to list
            </Button>

            <div className={`bg-white rounded-2xl border ${selectedOrgDetails.active ? 'border-slate-200' : 'border-red-300'} shadow-lg overflow-hidden`}>
               <div className={`${selectedOrgDetails.active ? 'bg-purple-600' : 'bg-slate-600'} p-6 text-white`}>
                 <div className="flex items-start justify-between">
                   <div>
                     <div className="flex gap-2 mb-2">
                       <span className="inline-block px-2 py-1 bg-white/20 rounded text-xs font-bold border border-white/30">{selectedOrgDetails.type}</span>
                       {!selectedOrgDetails.active && <span className="inline-block px-2 py-1 bg-red-500 rounded text-xs font-bold">SUSPENDED</span>}
                     </div>
                     <h2 className="text-2xl font-bold">{selectedOrgDetails.name}</h2>
                     <p className="flex items-center gap-1 text-white/80 text-sm mt-1">
                       <ShieldCheck size={14} /> {selectedOrgDetails.verified ? 'Verified Partner' : 'Unverified'}
                     </p>
                   </div>
                   <div className="text-right">
                     <p className="text-xs text-white/60 font-bold uppercase tracking-wider">Community ID</p>
                     <p className="text-3xl font-mono font-black tracking-widest">{selectedOrgDetails.id}</p>
                   </div>
                 </div>
               </div>

               <div className="p-6 space-y-6">
                 {/* Detail Grids */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Location & Contact</h3>
                      <div className="flex items-start gap-3">
                        <MapPin className="text-slate-400 mt-1" size={18} />
                        <div>
                          <p className="text-sm font-bold text-slate-900">Address</p>
                          <p className="text-sm text-slate-600">{selectedOrgDetails.address}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <User className="text-slate-400 mt-1" size={18} />
                        <div>
                          <p className="text-sm font-bold text-slate-900">Admin</p>
                          <p className="text-sm text-slate-600">{selectedOrgDetails.adminContact}</p>
                          <p className="text-xs text-slate-500">{selectedOrgDetails.adminPhone}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Logistics Profile</h3>
                      <div className="flex items-start gap-3">
                        <Truck className="text-slate-400 mt-1" size={18} />
                        <div>
                          <p className="text-sm font-bold text-slate-900">Replenishment Provider</p>
                          <p className="text-sm text-slate-600">{selectedOrgDetails.replenishmentProvider}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Mail className="text-slate-400 mt-1" size={18} />
                        <div>
                          <p className="text-sm font-bold text-slate-900">Supply Email</p>
                          <p className="text-sm text-slate-600 break-all">{selectedOrgDetails.replenishmentEmail || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Phone className="text-slate-400 mt-1" size={18} />
                        <div>
                          <p className="text-sm font-bold text-slate-900">Supply Phone</p>
                          <p className="text-sm text-slate-600">{selectedOrgDetails.replenishmentPhone || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                 </div>

                 {/* Member List Section */}
                <div className="space-y-3">
                   <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                     <Users size={18} className="text-slate-400" /> Registered Members ({orgMembers.length})
                     {membersFallback && (
                       <span className="text-[11px] text-amber-600 font-semibold">Using cached list</span>
                     )}
                   </h3>
                   {orgMembers.length === 0 ? (
                     <p className="text-slate-500 text-sm italic">No members linked yet.</p>
                   ) : (
                      <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-100 rounded-lg p-2 bg-slate-50">
                        {orgMembers.map(member => (
                          <div key={member.id} className="bg-white p-3 rounded-lg border border-slate-200 flex justify-between items-center shadow-sm">
                             <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white ${
                                  member.status === 'SAFE' ? 'bg-green-500' : member.status === 'DANGER' ? 'bg-red-500' : 'bg-slate-400'
                                }`}>
                                  {member.name.charAt(0)}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-900">{member.name}</p>
                                  <p className="text-[10px] text-slate-500">{member.phone}</p>
                                </div>
                             </div>
                             <div className="text-right">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                  member.status === 'SAFE' ? 'bg-green-100 text-green-700' : 
                                  member.status === 'DANGER' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'
                                }`}>
                                  {member.status}
                                </span>
                             </div>
                          </div>
                        ))}
                      </div>
                    )}
                 </div>
               </div>
               
               <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center">
                  <Button 
                    size="sm" 
                    variant={selectedOrgDetails.active ? "danger" : "primary"}
                    onClick={() => toggleOrgStatus(selectedOrgDetails.id, selectedOrgDetails.active)}
                    className={selectedOrgDetails.active ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100" : "bg-green-600 text-white"}
                  >
                    {selectedOrgDetails.active ? (
                      <>
                        <Ban size={16} className="mr-2" /> Deactivate Org
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} className="mr-2" /> Activate Org
                      </>
                    )}
                  </Button>

                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => copyToClipboard(selectedOrgDetails.id)}
                  >
                    <Copy size={16} className="mr-2" /> Copy Code
                  </Button>
               </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 text-slate-400" size={20} />
              <Input 
                className="pl-10" 
                placeholder="Search by Name, Type, or ID..." 
                value={orgSearch} 
                onChange={(e) => setOrgSearch(e.target.value)} 
              />
            </div>

            <div className="space-y-3">
              {filteredOrgs.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <Building2 size={48} className="mx-auto mb-2 opacity-20" />
                  <p>No organizations found matching "{orgSearch}"</p>
                </div>
              ) : (
                filteredOrgs.map(org => (
                  <button 
                    key={org.id}
                    onClick={() => setSelectedOrgDetails(org)}
                    className={`w-full bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition-all text-left flex justify-between items-center group ${org.active ? 'border-slate-200 hover:border-purple-300' : 'border-red-200 bg-red-50/30'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border ${org.active ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-slate-200 text-slate-500 border-slate-300'}`}>
                        {org.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className={`font-bold transition-colors ${org.active ? 'text-slate-900 group-hover:text-purple-700' : 'text-slate-500'}`}>
                          {org.name} {!org.active && <span className="text-[10px] text-red-500 ml-2 font-bold uppercase">(Inactive)</span>}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{org.type}</span>
                          <span className="font-mono">{org.id}</span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight size={20} className="text-slate-300 group-hover:text-purple-500" />
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Render: Access Control Section ---
  if (currentSection === 'ACCESS_CONTROL') {
    const safeUsers = Array.isArray(users) ? users : [];
    const filteredUsers = safeUsers.filter(u => {
      const name = (u.fullName || '').toLowerCase();
      const phone = (u.phone || '').toLowerCase();
      const role = (u.role || '').toLowerCase();
      const query = userSearch.toLowerCase();
      return name.includes(query) || phone.includes(query) || role.includes(query);
    });

    // If a user is selected, show their detail view
    if (selectedUser) {
      return (
        <div className="p-6 pb-28 space-y-6 animate-fade-in bg-slate-50 min-h-screen">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-4 sticky top-0 bg-slate-50 z-10">
            <button onClick={() => setSelectedUser(null)} className="p-2 -ml-2 text-slate-500 hover:text-slate-800">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-xl font-bold text-slate-900">User Profile</h1>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-slide-up">
             <div className="bg-slate-800 p-6 text-white flex justify-between items-start">
               <div className="flex items-center gap-4">
                 <div className="w-16 h-16 rounded-full bg-slate-600 flex items-center justify-center text-2xl font-bold border-2 border-slate-500">
                   {(selectedUser.fullName || '?').charAt(0)}
                 </div>
                 <div>
                   <h2 className="text-2xl font-bold">{selectedUser.fullName || 'Unnamed User'}</h2>
                   <div className="flex gap-2 mt-1">
                     <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-bold uppercase">{(selectedUser.role || 'UNKNOWN').replace('_', ' ')}</span>
                     <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${selectedUser.active ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                       {selectedUser.active ? 'Active' : 'Suspended'}
                     </span>
                   </div>
                 </div>
               </div>
               <div className="text-right text-xs opacity-60 font-mono">ID: {selectedUser.id}</div>
             </div>

             <div className="p-6 space-y-6">
                {/* Contact Info */}
                <div className="grid md:grid-cols-2 gap-6">
                   <div className="space-y-3">
                      <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                        <Phone size={16} className="text-slate-400" /> Contact Details
                      </h3>
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Mobile Phone</p>
                        <a href={`tel:${selectedUser.phone}`} className="text-blue-600 font-bold hover:underline">{selectedUser.phone}</a>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Home Address</p>
                        <div className="flex items-start gap-1">
                          <MapPin size={14} className="mt-0.5 text-slate-400" />
                          <p className="text-slate-900">{selectedUser.address || 'Not Provided'}</p>
                        </div>
                      </div>
                      {selectedUser.communityId && (
                        <div>
                          <p className="text-xs text-slate-500 font-bold uppercase">Community Connection</p>
                          <p className="text-purple-700 font-bold bg-purple-50 px-2 py-1 rounded w-fit text-sm mt-1">{selectedUser.communityId}</p>
                        </div>
                      )}
                   </div>

                   <div className="space-y-3">
                      <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                        <HeartPulse size={16} className="text-slate-400" /> Emergency Profile
                      </h3>
                      {selectedUser.medicalNeeds && (
                        <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                           <p className="text-xs text-red-600 font-bold uppercase mb-1">Medical Needs</p>
                           <p className="text-red-900 font-medium text-sm">{selectedUser.medicalNeeds}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Household</p>
                        <p className="text-slate-900 font-bold text-lg">{selectedUser.householdMembers} Member(s)</p>
                        {Array.isArray(selectedUser.household) && selectedUser.household.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {selectedUser.household.map(mem => (
                              <div key={mem.id} className="text-xs bg-slate-100 p-2 rounded flex justify-between">
                                <span className="font-bold">{mem.name}</span>
                                <span className="text-slate-500">{mem.age} • {mem.needs || 'No needs'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Emergency Contact</p>
                        <p className="text-slate-900 text-sm font-medium">{selectedUser.emergencyContactName} <span className="text-slate-500">({selectedUser.emergencyContactRelation})</span></p>
                        <a href={`tel:${selectedUser.emergencyContactPhone}`} className="text-sm font-bold text-slate-700">{selectedUser.emergencyContactPhone}</a>
                      </div>
                   </div>
                </div>

                {/* Controls */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4 space-y-4">
                   <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Account Management</h3>
                   
                   <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-700">System Role</label>
                      <select 
                        value={selectedUser.role}
                        onChange={(e) => updateUserRole(selectedUser.id, e.target.value as UserRole)}
                        className={`text-sm p-2 rounded border bg-white font-medium ${!selectedUser.active ? 'opacity-50 cursor-not-allowed' : 'border-slate-300'}`}
                        disabled={!selectedUser.active}
                      >
                        {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>
                   </div>

                   <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                      <span className="text-sm font-medium text-slate-700">Account Status</span>
                      <Button 
                        size="sm"
                        onClick={() => toggleUserStatus(selectedUser.id, selectedUser.active !== false)}
                        className={selectedUser.active ? "bg-red-100 text-red-700 hover:bg-red-200 border-red-200" : "bg-green-600 text-white"}
                      >
                        {selectedUser.active ? "Suspend Account" : "Activate Account"}
                      </Button>
                   </div>
                </div>
             </div>
          </div>
        </div>
      );
    }

    return (
      <div className="p-6 pb-28 space-y-6 animate-fade-in bg-slate-50 min-h-screen">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 sticky top-0 bg-slate-50 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentSection('MAIN')} className="p-2 -ml-2 text-slate-500 hover:text-slate-800">
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">User Directory</h1>
              <p className="text-xs text-slate-500">Manage All Registered Users & Permissions</p>
            </div>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            className="border-slate-300 text-slate-900 hover:bg-slate-100 h-9"
            onClick={handleExportUsers}
          >
            <Download size={16} className="mr-2" /> Export CSV
          </Button>
        </div>
        
        {/* Toggle Tabs */}
        <div className="flex bg-white rounded-lg p-1 border border-slate-200">
          <button 
            onClick={() => setActiveTab('ALL_USERS')}
            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
              activeTab === 'ALL_USERS' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            All Users ({safeUsers.length})
          </button>
          <button 
            onClick={() => setActiveTab('ROLE_DEFINITIONS')}
            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
              activeTab === 'ROLE_DEFINITIONS' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Role Definitions
          </button>
        </div>

        {activeTab === 'ROLE_DEFINITIONS' && (
          <div className="space-y-4">
             {roles.map(role => (
               <div key={role.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                 <div className="p-4 bg-slate-50 border-b border-slate-100">
                   <h3 className="font-bold text-slate-900">{role.label}</h3>
                   <p className="text-xs text-slate-500">{role.description}</p>
                 </div>
                 <div className="p-4 space-y-3">
                    {Object.entries(role.permissions).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700 capitalize">
                          {key.replace('can', '').replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <button 
                          onClick={() => togglePermission(role.id, key as keyof RoleDefinition['permissions'])}
                          className={`w-10 h-5 rounded-full relative transition-colors ${val ? 'bg-green-500' : 'bg-slate-300'}`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${val ? 'left-[22px]' : 'left-0.5'}`} />
                        </button>
                      </div>
                    ))}
                 </div>
               </div>
             ))}
          </div>
        )}

          {activeTab === 'ALL_USERS' && (
          <div className="space-y-4">
             <div className="relative">
                <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                <Input 
                  className="pl-10 h-10" 
                  placeholder="Search users by name, phone, or role..." 
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
             </div>
             {filteredUsers.map(user => {
               const createdLabel = user.createdAt
                 ? new Date(user.createdAt).toLocaleDateString()
                 : 'Unknown';
               return (
               <div 
                 key={user.id} 
                 onClick={() => setSelectedUser(user)}
                 className={`bg-white p-4 rounded-xl border shadow-sm flex flex-col gap-3 cursor-pointer hover:border-brand-400 hover:shadow-md transition-all group ${user.active ? 'border-slate-200' : 'border-red-200 bg-red-50/10'}`}
               >
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${user.active ? 'bg-slate-100 text-slate-600' : 'bg-red-100 text-red-500'}`}>
                         <User size={18} />
                      </div>
                      <div>
                        <h3 className={`font-bold group-hover:text-brand-700 transition-colors ${user.active ? 'text-slate-900' : 'text-slate-500 line-through'}`}>{user.fullName || 'Unnamed User'}</h3>
                        <p className="text-xs text-slate-500">{user.phone || 'No phone'} {user.role === 'ADMIN' && <span className="text-brand-600 font-bold ml-1">(Admin)</span>}</p>
                        <p className="text-[11px] text-slate-400">Created: {createdLabel}</p>
                      </div>
                   </div>
                   <ArrowRight size={18} className="text-slate-300 group-hover:text-brand-500" />
                 </div>
                 
                 <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                    <span className={`text-[10px] font-bold uppercase ${user.active ? 'text-green-600' : 'text-red-600'}`}>
                      Status: {user.active ? 'Active' : 'Deactivated'}
                    </span>
                    <span className="text-xs px-2 py-1 bg-slate-100 rounded text-slate-600 font-medium">
                      {(user.role || 'UNKNOWN').replace('_', ' ')}
                    </span>
                 </div>
               </div>
               );
             })}
             {filteredUsers.length === 0 && <p className="text-center text-slate-400 py-4">No users found.</p>}
          </div>
        )}
      </div>
    );
  }

  // --- Render: Main Settings ---
  return (
    <div className="p-6 pb-28 space-y-8 animate-fade-in bg-slate-50 min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
           <button onClick={() => setView('DASHBOARD')} className="p-2 -ml-2 text-slate-500 hover:text-slate-800 md:hidden">
             <ArrowLeft size={24} />
           </button>
           <h1 className="text-2xl font-bold text-slate-900">{t('settings.title')}</h1>
        </div>
        
        {isSaved && (
          <span className="text-sm font-medium text-green-600 flex items-center gap-1 animate-fade-in">
            <Check size={16} /> Saved
          </span>
        )}
      </div>

      <section className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Quick Jump</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => openSectionAndScroll('profile')} className="min-w-[92px] flex-1 text-[11px] sm:text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-2">Profile</button>
          <button type="button" onClick={() => openSectionAndScroll('household')} className="min-w-[92px] flex-1 text-[11px] sm:text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-2">Household</button>
          <button type="button" onClick={() => openSectionAndScroll('contacts')} className="min-w-[92px] flex-1 text-[11px] sm:text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-2">Emergancy Contact</button>
          <button type="button" onClick={() => openSectionAndScroll('community')} className="min-w-[92px] flex-1 text-[11px] sm:text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-2">Community</button>
          <button type="button" onClick={() => openSectionAndScroll('security')} className="min-w-[92px] flex-1 text-[11px] sm:text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-2">Preparedness</button>
        </div>
      </section>

      {/* Language Selector */}
      <section className="bg-white p-6 rounded-2xl shadow-sm space-y-4 order-10">
        <div className="flex items-center gap-4 mb-2">
          <div className="p-3 bg-indigo-50 rounded-full text-indigo-600">
            <Globe size={24} />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">{t('settings.language')}</h2>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => changeLanguage('en')}
            className={`flex-1 py-3 px-4 rounded-xl border-2 font-bold transition-all ${
              profile.language === 'en' 
                ? 'border-indigo-600 bg-indigo-50 text-indigo-800' 
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            English
          </button>
          <button 
            onClick={() => changeLanguage('es')}
            className={`flex-1 py-3 px-4 rounded-xl border-2 font-bold transition-all ${
              profile.language === 'es' 
                ? 'border-indigo-600 bg-indigo-50 text-indigo-800' 
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            Español
          </button>
          <button 
            onClick={() => changeLanguage('fr')}
            className={`flex-1 py-3 px-4 rounded-xl border-2 font-bold transition-all ${
              profile.language === 'fr' 
                ? 'border-indigo-600 bg-indigo-50 text-indigo-800' 
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            Français
          </button>
        </div>
      </section>

      {isAdmin && (
        <section className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <ShieldCheck size={80} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2 text-brand-400 font-bold text-xs uppercase tracking-wider">
              <Lock size={12} /> Administrator Area
            </div>
            <h2 className="text-xl font-bold mb-4">Roles & Dashboards</h2>
            <div className="space-y-3">
              <Button 
                onClick={openAccessControl} 
                className="bg-brand-600 hover:bg-brand-500 text-white border-0 w-full justify-between"
              >
                <span>User Directory & Access Control</span>
                <Users size={18} />
              </Button>
              <Button 
                onClick={openOrgDirectory} 
                className="bg-purple-600 hover:bg-purple-500 text-white border-0 w-full justify-between"
              >
                <span>Organization Directory</span>
                <Building2 size={18} />
              </Button>
              <Button 
                onClick={openMasterInventory} 
                className="bg-orange-600 hover:bg-orange-500 text-white border-0 w-full justify-between"
              >
                <span>Master Inventory Database</span>
                <FileText size={18} />
              </Button>
              <Button 
                onClick={openBroadcastControl} 
                className="bg-red-600 hover:bg-red-500 text-white border-0 w-full justify-between"
              >
                <span>Manage Broadcasts</span>
                <Radio size={18} />
              </Button>
              <Button 
                onClick={openDbViewer}
                variant="outline"
                className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 w-full justify-between"
              >
                 <span>View Raw Database</span>
                 <Database size={18} />
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Profile */}
      <section ref={profileSectionRef} className="bg-white p-6 rounded-2xl shadow-sm space-y-4">
        <button
          type="button"
          onClick={() => toggleSection('profile')}
          className="w-full flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4 text-left">
            <div className="p-3 bg-brand-50 rounded-full text-brand-600">
              <User size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Profile</h2>
              <p className="text-xs text-slate-500">{profile.fullName || 'Name not set'} • {profile.phone || 'Phone not set'}</p>
            </div>
          </div>
          <ChevronDown size={18} className={`text-slate-500 transition-transform ${expandedSections.profile ? 'rotate-180' : ''}`} />
        </button>

        {!expandedSections.profile && (
          <p className="text-xs text-slate-500">{profile.address ? `Address set • ${profile.address}` : 'Address not set yet'}</p>
        )}

        {expandedSections.profile && (
          <>
            {showMoreSections.profile && <div className="text-xs text-slate-400 font-mono -mt-2 mb-1">ID: {profile.id}</div>}

            <Input 
              label="Full Name" 
              value={profile.fullName}
              onChange={(e) => updateProfile('fullName', e.target.value)}
              placeholder="e.g. Jane Doe"
            />
            <Input 
              label="Mobile Phone" 
              value={profile.phone}
              onChange={(e) => updateProfile('phone', formatPhoneNumber(e.target.value))}
              onBlur={() => expandedSections.profile && validatePhone(profile.phone)}
              placeholder="e.g. (555) 123-4567"
              className={phoneError ? 'border-red-500 bg-red-50' : ''}
              error={phoneError || undefined}
            />

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Home Address</label>
              <div className="relative">
                <input 
                  placeholder="123 Main St..."
                  value={profile.address}
                  onChange={(e) => {
                    setHighlightedAddressIndex(-1);
                    updateProfile('address', e.target.value);
                  }}
                  onBlur={handleAddressInputBlur}
                  onKeyDown={handleAddressInputKeyDown}
                  className={`w-full px-4 py-3 rounded-lg border focus:ring-2 outline-none transition-all font-medium ${
                    addressStatus === 'VALID' ? 'border-green-500 bg-green-50 focus:ring-green-500' :
                    addressStatus === 'INVALID' ? 'border-red-500 bg-red-50 focus:ring-red-500' :
                    'border-slate-300 focus:ring-brand-500 focus:border-brand-500'
                  }`}
                />
                {addressSuggestions.length > 0 && addressStatus !== 'VERIFYING' && (
                  <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-56 overflow-auto">
                    {addressSuggestions.map((result, index) => (
                      <button
                        key={`${result.placeId || 'addr'}-${index}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectAddressSuggestion(result)}
                        className={`w-full text-left px-3 py-2 text-sm border-b border-slate-100 last:border-b-0 ${
                          index === highlightedAddressIndex
                            ? 'bg-slate-100 text-slate-900'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {result.description || 'Suggested address'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {isAddressSuggesting && addressStatus !== 'VERIFYING' && <p className="text-xs text-slate-500 font-semibold mt-1">Finding address suggestions...</p>}
              {addressStatus === 'VERIFYING' && <p className="text-xs text-slate-500 font-semibold mt-1">Verifying with Google Maps...</p>}
              {addressStatus === 'VALID' && <p className="text-xs text-green-600 font-bold mt-1">Verified with Google Maps</p>}
              {addressStatus === 'INVALID' && <p className="text-xs text-red-600 font-bold mt-1">Address not found on Maps</p>}
              {addressStatus === 'VALID' && addressVerifiedLabel && (
                <p className="text-xs text-slate-500 mt-1">Verified on {addressVerifiedLabel}</p>
              )}
              {isAddressVerificationRequired && (
                <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                    <Lock size={13} /> Address verification required before saving.
                  </p>
                  <button
                    type="button"
                    onClick={() => verifyAddressWithGoogle(profile.address)}
                    className="text-xs font-bold text-amber-800 hover:text-amber-900 underline"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => toggleShowMore('profile')}
              className="text-xs font-semibold text-brand-600 hover:underline"
            >
              {showMoreSections.profile ? 'Show less' : 'Show more'}
            </button>
            {profileSaveError && (
              <p className="text-xs text-red-600 font-semibold mt-2">{profileSaveError}</p>
            )}
          </>
        )}
      </section>

      {/* Contacts */}
      <section ref={contactsSectionRef} className="bg-white p-6 rounded-2xl shadow-sm space-y-4">
        <button
          type="button"
          onClick={() => toggleSection('contacts')}
          className="w-full flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4 text-left">
            <div className="p-3 bg-cyan-50 rounded-full text-cyan-700">
              <Phone size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Emergancy Contact</h2>
              <p className="text-xs text-slate-500">
                {profile.emergencyContactName ? `${profile.emergencyContactName} • ${profile.emergencyContactPhone || 'No phone'}` : 'Emergency contact not set'}
              </p>
            </div>
          </div>
          <ChevronDown size={18} className={`text-slate-500 transition-transform ${expandedSections.contacts ? 'rotate-180' : ''}`} />
        </button>

        {expandedSections.contacts && (
          <>
            <div className="space-y-3">
              <Input 
                placeholder="Contact Name"
                value={profile.emergencyContactName}
                onChange={(e) => updateProfile('emergencyContactName', e.target.value)}
              />
              <Input 
                placeholder="Mobile Phone"
                type="tel"
                value={profile.emergencyContactPhone}
                onChange={(e) => updateProfile('emergencyContactPhone', formatPhoneNumber(e.target.value))}
              />
              {showMoreSections.contacts && (
                <Input 
                  placeholder="Relationship"
                  value={profile.emergencyContactRelation}
                  onChange={(e) => updateProfile('emergencyContactRelation', e.target.value)}
                />
              )}
            </div>

            <button
              type="button"
              onClick={() => toggleShowMore('contacts')}
              className="text-xs font-semibold text-brand-600 hover:underline"
            >
              {showMoreSections.contacts ? 'Show less' : 'Show more'}
            </button>
          </>
        )}
      </section>

      {/* Household */}
      <section ref={householdSectionRef} className="bg-white p-6 rounded-2xl shadow-sm space-y-4 border border-emerald-100 order-30">
        <button
          type="button"
          onClick={() => toggleSection('household')}
          className="w-full flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4 text-left">
            <div className="p-3 bg-emerald-50 rounded-full text-emerald-700">
              <Users size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Household</h2>
              <p className="text-xs text-slate-500">{profile.householdName || 'Your Home'} • {profile.householdCode || 'Code not set'}</p>
            </div>
          </div>
          <ChevronDown size={18} className={`text-slate-500 transition-transform ${expandedSections.household ? 'rotate-180' : ''}`} />
        </button>

        {!expandedSections.household && (
          <p className="text-xs text-slate-500">{(profile.household || []).length} members • Role: {profile.householdRole || 'OWNER'}</p>
        )}

        {expandedSections.household && (
          <>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Household Code</p>
            <p className="text-2xl font-mono font-black tracking-widest text-emerald-900">
              {profile.householdCode || '------'}
            </p>
            <p className="text-xs text-emerald-700 mt-1">
              {profile.householdName || 'Your Home'} • {profile.householdRole || 'OWNER'}
            </p>
          </div>
          {profile.householdRole === 'OWNER' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyToClipboard(profile.householdCode || '')}
              disabled={!profile.householdCode}
              className="text-emerald-800 hover:bg-emerald-100"
            >
              <Copy size={16} className="mr-2" /> Copy
            </Button>
          )}
        </div>

        {householdOptions.length > 1 && (
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">Active Household</label>
            <select
              value={profile.householdId || ''}
              onChange={(e) => handleSwitchHousehold(e.target.value)}
              disabled={isSwitchingHousehold}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {householdOptions.map((option) => (
                <option key={option.householdId} value={option.householdId}>
                  {option.householdName} ({option.householdCode}) • {option.householdRole}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">Switch to another linked household context.</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
          <Input
            label="Request Home Join by Code"
            placeholder="e.g. A3K7Q2"
            value={householdCodeInput}
            onChange={(e) => setHouseholdCodeInput(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <Button onClick={handleJoinHousehold} disabled={isHouseholdCodeBusy || isLeavingHousehold || Boolean(profile.householdId) || householdCodeInput.trim().length < 6 || householdCodeInput.includes('-')}>
            {isHouseholdCodeBusy ? 'Sending...' : 'Click Here to Connect'}
          </Button>
        </div>
        {profile.householdId ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
            <p className="text-xs text-amber-800 font-semibold">Leave your current household before submitting a join request.</p>
            <Button
              size="sm"
              variant="ghost"
              className="text-amber-800 hover:bg-amber-100"
              onClick={handleLeaveHousehold}
              disabled={isLeavingHousehold}
            >
              {isLeavingHousehold ? 'Leaving...' : 'Leave Current Household'}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Your request has been sent to the household administrator and requires approval.</p>
        )}

        {latestMyJoinRequest && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] uppercase tracking-wide font-bold text-slate-500">Latest Join Request</p>
            <p className="text-sm font-semibold text-slate-900 mt-1">
              Status: {latestMyJoinRequest.status === 'pending'
                ? 'Pending Approval'
                : latestMyJoinRequest.status === 'approved'
                  ? 'Approved'
                  : 'Rejected'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Submitted {new Date(latestMyJoinRequest.createdAt).toLocaleString()}</p>
          </div>
        )}

        {householdCodeError && (
          <p className="text-xs text-red-600 font-semibold">{householdCodeError}</p>
        )}
        {householdCodeSuccess && (
          <p className="text-xs text-emerald-700 font-semibold">{householdCodeSuccess}</p>
        )}

        {showMoreSections.household && profile.householdRole === 'OWNER' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">New Household Join Request{pendingOwnerRequests.length === 1 ? '' : 's'}</p>

            {pendingOwnerRequests.length === 0 ? (
              <p className="text-xs text-amber-700">No pending requests.</p>
            ) : (
              <div className="space-y-2">
                {pendingOwnerRequests.map((request) => (
                  <div key={request.id} className="rounded-lg border border-amber-200 bg-white p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{request.requestingUserName || 'AERA user'}</p>
                      <p className="text-[11px] text-slate-500">{request.requestingUserPhone || request.requestingUserEmail || 'No contact preview available'}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Requested {new Date(request.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handleResolveJoinRequest(request, 'approved')}
                        disabled={joinRequestBusyId === request.id}
                      >
                        {joinRequestBusyId === request.id ? 'Working...' : 'Approve'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => handleResolveJoinRequest(request, 'rejected')}
                        disabled={joinRequestBusyId === request.id}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showMoreSections.household && profile.householdRole === 'OWNER' && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Notifications</p>
            <Button
              size="sm"
              variant="ghost"
              className="text-indigo-700 hover:bg-indigo-100"
              onClick={handleMarkAllNotificationsRead}
              disabled={notificationsBusy || unreadNotificationCount === 0}
            >
              Mark Read ({unreadNotificationCount})
            </Button>
          </div>

          {notifications.length === 0 ? (
            <p className="text-xs text-indigo-700">No notifications yet.</p>
          ) : (
            <div className="space-y-1">
              {notifications.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className={`rounded-md border px-3 py-2 text-xs ${item.read ? 'border-indigo-100 bg-white text-slate-500' : 'border-indigo-300 bg-white text-slate-800 font-semibold'}`}
                >
                  <p>
                    {item.type === 'household_join_request'
                      ? 'New Household Join Request'
                      : item.type === 'household_join_approved'
                        ? 'Your request was approved.'
                        : item.type === 'household_join_rejected'
                          ? 'Your request was not approved.'
                          : item.type === 'household_member_reported_danger'
                            ? `${String((item.metadata as any)?.reporterName || 'A household member')} reported DANGER.`
                            : item.type === 'household_member_reported_safe'
                              ? `${String((item.metadata as any)?.reporterName || 'A household member')} reported SAFE.`
                          : item.type}
                  </p>
                  <p className="text-[10px] mt-0.5 opacity-80">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        <div>
          <Input
            label="Household Size"
            type="text"
            value={String(profile.householdMembers || 1)}
            readOnly
            className="bg-slate-50"
          />
          <p className="text-[11px] text-slate-500 mt-1">Includes you as the first household occupant.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Who lives in your home</label>
          <p className="text-xs text-slate-500 mb-2">Each member requires DOB in MM/DD/YYYY. Young children and seniors are flagged automatically.</p>
          <HouseholdManager 
            members={profile.household}
            onChange={(updated) => updateProfile('household', updated)}
            readOnly={profile.householdRole !== 'OWNER'}
            latestSafetyStatusByMember={latestSafetyStatusByMember}
          />
        </div>

        {showMoreSections.household && profile.householdRole === 'OWNER' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
          <div>
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Member Account Invites</p>
          </div>

          {inviteEnabledMembers.length === 0 ? (
            <></>
          ) : (
            <div className="space-y-2">
              {inviteEnabledMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-lg border border-emerald-200 bg-white p-3 gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{member.name}</p>
                    <p className="text-xs text-slate-600">Invite Code: <span className="font-mono font-bold tracking-wider">{latestInviteByMember[member.id]?.invitationCode || buildMemberInviteCode(member)}</span></p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Bound phone: {maskPhoneNumber(latestInviteByMember[member.id]?.inviteePhone || member.loginPhone || '') || 'Not set'}</p>
                    {!isValidPhoneForInvite(member.loginPhone || '') && (
                      <p className="text-[11px] text-amber-700 mt-0.5">Add a valid member phone in Household Members before creating an invite.</p>
                    )}
                    {latestInviteByMember[member.id] && (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Status: {latestInviteByMember[member.id].status}
                        {latestInviteByMember[member.id].expiresAt
                          ? ` • Expires ${new Date(latestInviteByMember[member.id].expiresAt as string).toLocaleDateString()}`
                          : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-emerald-800 hover:bg-emerald-100"
                      onClick={() => handleCopyMemberInvite(member)}
                      disabled={inviteBusyMemberId === member.id || !isValidPhoneForInvite(member.loginPhone || '')}
                    >
                      <Copy size={14} className="mr-1" /> {inviteBusyMemberId === member.id ? 'Working...' : 'Share'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-slate-700 hover:bg-slate-100"
                      onClick={() => handleResendMemberInvite(member)}
                      disabled={inviteBusyMemberId === member.id || !isValidPhoneForInvite(member.loginPhone || '')}
                    >
                      {inviteBusyMemberId === member.id ? 'Working...' : 'Resend'}
                    </Button>
                    {latestInviteByMember[member.id]?.status === 'PENDING' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => handleRevokeMemberInvite(member)}
                        disabled={inviteBusyMemberId === member.id}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {inviteStatusMessage && <p className="text-xs text-emerald-700 font-semibold">{inviteStatusMessage}</p>}
          {inviteError && <p className="text-xs text-red-600 font-semibold">{inviteError}</p>}
        </div>
        )}

        <button
          type="button"
          onClick={() => toggleShowMore('household')}
          className="text-xs font-semibold text-brand-600 hover:underline"
        >
          {showMoreSections.household ? 'Show less' : 'Show more'}
        </button>
        {vitalsSaveError && (
          <p className="text-xs text-red-600 font-semibold mt-2">{vitalsSaveError}</p>
        )}
        </>
        )}
      </section>

      {/* Security */}
      <section ref={securitySectionRef} className="bg-white p-6 rounded-2xl shadow-sm space-y-4 border border-red-100 order-20">
        <button
          type="button"
          onClick={() => toggleSection('security')}
          className="w-full flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4 text-left">
            <div className="p-3 bg-red-50 rounded-full text-red-600">
              <HeartPulse size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Preparedness</h2>
              <p className="text-xs text-slate-500">Health and mobility planning details.</p>
            </div>
          </div>
          <ChevronDown size={18} className={`text-slate-500 transition-transform ${expandedSections.security ? 'rotate-180' : ''}`} />
        </button>

        {!expandedSections.security && (
          <p className="text-xs text-slate-500">
            Consent: {profile.consentPreparednessPlanning ? 'Provided' : 'Pending'} • ZIP: {profile.zipCode || 'Not detected'}
          </p>
        )}

        {expandedSections.security && (
          <>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">ZIP Code</p>
          <p className="text-sm font-semibold text-slate-900 mt-1">{profile.zipCode || 'Not detected yet'}</p>
          <p className="text-xs text-slate-500 mt-1">From your Home Address</p>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Medical</p>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <span className="text-sm font-medium text-slate-700">Medication Dependency</span>
              <input
                type="checkbox"
                checked={Boolean(profile.medicationDependency)}
                onChange={(e) => updateProfile('medicationDependency', e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <span className="text-sm font-medium text-slate-700">Insulin Dependency</span>
              <input
                type="checkbox"
                checked={Boolean(profile.insulinDependency)}
                onChange={(e) => updateProfile('insulinDependency', e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Oxygen / Powered Medical Device</span>
              <input
                type="checkbox"
                checked={Boolean(profile.oxygenPoweredDevice)}
                onChange={(e) => updateProfile('oxygenPoweredDevice', e.target.checked)}
              />
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Accessibility</p>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <span className="text-sm font-medium text-slate-700">Mobility Limitation</span>
              <input
                type="checkbox"
                checked={Boolean(profile.mobilityLimitation)}
                onChange={(e) => updateProfile('mobilityLimitation', e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <span className="text-sm font-medium text-slate-700">Transportation Access</span>
              <input
                type="checkbox"
                checked={Boolean(profile.transportationAccess)}
                onChange={(e) => updateProfile('transportationAccess', e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Financial Strain</span>
              <input
                type="checkbox"
                checked={Boolean(profile.financialStrain)}
                onChange={(e) => updateProfile('financialStrain', e.target.checked)}
              />
            </label>
          </div>
        </div>

        <Input 
          label="Pets" 
          placeholder="e.g. 2 Dogs"
          value={profile.petDetails}
          onChange={(e) => updateProfile('petDetails', e.target.value)}
        />
        {showMoreSections.security && (
          <Textarea 
            label="Anything else not listed above" 
            value={profile.medicalNeeds}
            onChange={(e) => updateProfile('medicalNeeds', e.target.value)}
          />
        )}

        <div className="border-t border-slate-200 pt-4">
          <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Final Step</p>
          <p className="text-sm font-bold text-slate-800 mt-1">Confirm preparedness consent</p>
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <input
            className="mt-1"
            type="checkbox"
            checked={Boolean(profile.consentPreparednessPlanning)}
            onChange={(e) => updateProfile('consentPreparednessPlanning', e.target.checked)}
          />
          <span className="text-sm text-emerald-900 font-semibold">
            I understand this data is used only for preparedness planning and can be deleted anytime.
          </span>
        </label>

        <button
          type="button"
          onClick={() => toggleShowMore('security')}
          className="text-xs font-semibold text-brand-600 hover:underline"
        >
          {showMoreSections.security ? 'Show less' : 'Show more'}
        </button>
        {vitalsSaveError && (
          <p className="text-xs text-red-600 font-semibold mt-2">{vitalsSaveError}</p>
        )}
        </>
        )}
      </section>

      {/* Community Onboarding */}
      <section ref={trustedCommunityRef} className="bg-white p-6 rounded-2xl shadow-sm space-y-4 border border-purple-100 relative overflow-hidden order-40">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Building2 size={64} className="text-purple-600" />
        </div>
        <button
          type="button"
          onClick={() => toggleSection('community')}
          className="w-full flex items-center justify-between gap-4 relative z-10"
        >
          <div className="flex items-center gap-4 mb-2 text-left">
            <div className="p-3 bg-purple-50 rounded-full text-purple-600">
              <Building2 size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">{t('settings.trusted_conn')}</h2>
              <p className="text-xs text-slate-500">{connectedOrg ? `Connected to ${connectedOrg}` : 'No community connected'}</p>
            </div>
          </div>
          <ChevronDown size={18} className={`text-slate-500 transition-transform ${expandedSections.community ? 'rotate-180' : ''}`} />
        </button>

        {expandedSections.community && (
          <>
        
        {profile.role === 'INSTITUTION_ADMIN' ? (
          <div className="relative z-10 space-y-3">
             <div className="bg-purple-100 border border-purple-200 p-4 rounded-xl flex items-center justify-between">
                <div>
                   <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Your Organization ID</p>
                   <p className="text-2xl font-mono font-black text-purple-900 tracking-widest">{profile.communityId || 'NOT SET'}</p>
                </div>
                <Button 
                   size="sm"
                   variant="ghost" 
                   onClick={() => copyToClipboard(profile.communityId)}
                   className="text-purple-700 hover:bg-purple-200"
                >
                   <Copy size={20} />
                </Button>
             </div>
             <div className="flex gap-3 items-end">
                <div className="flex-1">
                   <Input 
                     label="Change Organization ID" 
                     value={profile.communityId}
                     onChange={(e) => {
                      updateProfile('communityId', formatCommunityIdInput(e.target.value));
                        setConnectedOrg(null);
                        setVerifyError(null);
                     }}
                     className={connectedOrg ? "border-green-500 focus:ring-green-500 bg-green-50/30" : verifyError ? "border-red-500 focus:ring-red-500" : ""}
                   />
                   <p className="text-[11px] text-slate-500 mt-1">Format: CH-1234</p>
                </div>
                <div className="flex flex-col items-center">
                  <Button 
                    className={`mb-[1px] min-w-[50px] ${connectedOrg ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                    onClick={verifyCommunityId}
                    disabled={isVerifying || !profile.communityId}
                  >
                    {isVerifying ? <Loader2 className="animate-spin" size={20} /> : connectedOrg ? <Check size={20} /> : <LinkIcon size={20} />}
                  </Button>
                  <p className="text-[10px] font-semibold text-purple-600 mt-1">Click here</p>
                </div>
             </div>
             {verifyError && (
               <div className="flex items-center gap-2 text-red-600 text-sm font-bold bg-red-50 p-2 rounded-lg animate-fade-in border border-red-100 relative z-10">
                  <XCircle size={16} /> {verifyError}
               </div>
             )}
          </div>
        ) : (
          <>
            <div className="flex gap-3 items-end relative z-10">
              <div className="flex-1">
                 <Input 
                  label="Community ID" 
                  value={profile.communityId}
                  onChange={(e) => {
                     updateProfile('communityId', formatCommunityIdInput(e.target.value));
                     setConnectedOrg(null);
                     setVerifyError(null);
                  }}
                  className={connectedOrg ? "border-green-500 focus:ring-green-500 bg-green-50/30" : verifyError ? "border-red-500 focus:ring-red-500" : ""}
                />
                <p className="text-[11px] text-slate-500 mt-1">Format: CH-1234</p>
              </div>
              <div className="flex flex-col items-center">
                <Button 
                  className={`mb-[1px] min-w-[50px] ${connectedOrg ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                  onClick={verifyCommunityId}
                  disabled={isVerifying || !profile.communityId}
                >
                  {isVerifying ? <Loader2 className="animate-spin" size={20} /> : connectedOrg ? <Check size={20} /> : <LinkIcon size={20} />}
                </Button>
                <p className="text-[10px] font-semibold text-purple-600 mt-1">Click here</p>
              </div>
            </div>
            {connectedOrg && (
              <p className="text-xs font-semibold text-emerald-700 relative z-10">Connected to {connectedOrg}.</p>
            )}
            {verifyError && (
               <div className="flex items-center gap-2 text-red-600 text-sm font-bold bg-red-50 p-2 rounded-lg animate-fade-in border border-red-100 relative z-10">
                  <XCircle size={16} /> {verifyError}
               </div>
            )}
            {showMoreSections.community && (
              <div className="relative z-10 mt-4 border-t border-slate-200 pt-3">
                <p className="text-[11px] text-slate-500 mb-2">Advanced</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:bg-red-50"
                  onClick={handleDisconnectCommunity}
                  disabled={isDisconnectingOrg || !profile.communityId}
                >
                  {isDisconnectingOrg ? 'Disconnecting...' : 'Disconnect Organization'}
                </Button>
              </div>
            )}
          </>
        )}

        <button
          type="button"
          onClick={() => toggleShowMore('community')}
          className="text-xs font-semibold text-brand-600 hover:underline relative z-10"
        >
          {showMoreSections.community ? 'Show less' : 'Show more'}
        </button>
        </>
        )}
      </section>

      <section className="bg-white p-6 rounded-2xl shadow-sm space-y-4 order-50">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-50 rounded-full text-emerald-700">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Legal</h2>
            <p className="text-xs text-slate-500">Privacy & consent</p>
          </div>
        </div>
        <Button
          onClick={() => {
            sessionStorage.setItem('privacyReturnView', 'SETTINGS');
            setView('PRIVACY_POLICY');
          }}
          variant="outline"
          className="w-full justify-between border-slate-300 hover:bg-slate-50"
        >
          <span>View Privacy & Consent</span>
          <FileText size={18} />
        </Button>
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            className="flex-1"
            onClick={discardLocalChanges}
            disabled={isSavingProfile || isSavingVitals}
          >
            Reset
          </Button>
          <Button
            className="flex-1"
            onClick={saveVisibleSection}
            disabled={isSavingProfile || isSavingVitals}
          >
            <Save size={16} className="mr-2" />
            {isSavingProfile || isSavingVitals
              ? 'Saving...'
              : expandedSections.security || expandedSections.household
                ? 'Save'
                : 'Save'}
          </Button>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-slate-200 order-60">
        <Button onClick={handleLogout} variant="ghost" fullWidth className="text-red-600 hover:bg-red-50 hover:text-red-700">
          <LogOut className="mr-2" size={18} />
          Log Out
        </Button>
      </div>
    </div>
  );
};
