import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, FileText, HeartPulse, Save, Share2, Sparkles, Droplets, Flashlight } from 'lucide-react';
import { Button } from '../components/Button';
import { ViewState } from '../types';
import { fetchKitGuidanceForCurrentUser, fetchReadyKit, saveReadyKit } from '../services/api';
import { StorageService } from '../services/storage';
import { calculateAgeFromDob } from '../services/validation';

const READY_KIT_STORAGE_KEY = 'aeraReadyKit';

type KitItem = {
  id: string;
  title: string;
  description: string;
  quantity: string;
};

type KitCategory = {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  items: KitItem[];
};

type KitGuidance = {
  recommended_duration_days: number;
  readiness_score: number;
  readiness_cap: number;
  base_completion_pct: number;
  risk_tier: string;
  added_items: Array<{ id: string; item: string; category: string; priority: string; explanation?: string | null }>;
  critical_missing_items: Array<{ id: string; item: string; explanation?: string | null }>;
  outreach_flags: string[];
};

const CATEGORIES: KitCategory[] = [
  {
    id: 'food',
    title: 'Food & Water',
    subtitle: 'Keep yourself fed and hydrated',
    icon: <Droplets size={20} className="text-blue-700" />,
    items: [
      { id: 'water', title: 'Bottled water', description: 'About 1 gallon per person each day', quantity: '3 days' },
      { id: 'food', title: 'Easy-to-eat foods', description: 'Canned items, granola bars, crackers', quantity: '3 days' },
      { id: 'plates', title: 'Paper plates and utensils', description: 'Cups, forks, spoons you can throw away', quantity: '1 pack' },
      { id: 'opener', title: 'Can opener', description: "Manual type that doesn't need electricity", quantity: '1x' },      { id: 'filter', title: 'Water filter or purifier', description: 'Small device or tablets to clean water', quantity: '1 item' },
    ],
  },
  {
    id: 'health',
    title: 'Health Items',
    subtitle: 'Take care of yourself and family',
    icon: <HeartPulse size={20} className="text-rose-600" />,
    items: [
      { id: 'bandages', title: 'Bandages and wound care', description: 'Band-aids, gauze, medical tape', quantity: '1 kit' },
      { id: 'meds', title: 'Your regular medications', description: "Keep about a week's worth if possible", quantity: '7 days' },
      { id: 'common-meds', title: 'Common medicines', description: 'Pain relief, stomach, allergy meds', quantity: 'Small supply' },
      { id: 'glasses', title: 'Extra glasses or contacts', description: 'If you wear them, keep a spare pair', quantity: '1 pair' },
      { id: 'sanitizer', title: 'Hand sanitizer and soap', description: 'Small bottles to keep hands clean', quantity: 'Travel size' },
      { id: 'toiletries', title: 'Toiletries', description: 'Toothbrush, hygiene items, tissues', quantity: 'Small kit' },
    ],
  },
  {
    id: 'power',
    title: 'Light & Power',
    subtitle: 'Stay connected and see in the dark',
    icon: <Flashlight size={20} className="text-amber-600" />,
    items: [
      { id: 'flashlight', title: 'Flashlight', description: 'LED type with extra batteries', quantity: '1-2x' },
      { id: 'radio', title: 'Battery or hand-crank radio', description: 'To hear news and weather updates', quantity: '1x' },
      { id: 'charger', title: 'Phone charger and power bank', description: 'Wall plug, cables, backup battery', quantity: 'Complete set' },
      { id: 'car-charger', title: 'Car phone charger', description: 'Charge from your vehicle if needed', quantity: '1x' },
      { id: 'whistle', title: 'Whistle', description: 'Loud one to get attention', quantity: '1-2x' },
      { id: 'mask', title: 'Dust masks', description: 'N95 type for filtering air', quantity: '3-5x' },
      { id: 'multi-tool', title: 'Multi-tool', description: 'Knife, pliers, screwdriver in one', quantity: '1x' },
    ],
  },
  {
    id: 'papers',
    title: 'Papers & Money',
    subtitle: 'Keep important info handy',
    icon: <FileText size={20} className="text-slate-600" />,
    items: [
      { id: 'ids', title: 'Copies of IDs', description: "Driver's license, passport, birth certificate", quantity: 'Photocopies' },
      { id: 'cash', title: 'Cash', description: "Small bills in case cards don't work", quantity: '$200-300' },
      { id: 'contacts', title: 'Contact list', description: 'Phone numbers written down on paper', quantity: '1 list' },
      { id: 'insurance', title: 'Insurance papers', description: 'Copies of your insurance info', quantity: 'Photocopies' },
      { id: 'map', title: 'Local map', description: 'Paper map of your area', quantity: '1x' },
      { id: 'usb', title: 'USB drive', description: 'Digital copies of important files', quantity: '1x' },
      { id: 'photos', title: 'Family photos', description: 'Printed pictures to help identify people', quantity: 'A few' },
    ],
  },
];

export const BuildKitView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [showSaved, setShowSaved] = useState(false);
  const [guidance, setGuidance] = useState<KitGuidance | null>(null);

  const householdScale = useMemo(() => {
    const profile = StorageService.getProfile();
    const members = Array.isArray(profile.household) ? profile.household : [];
    const fallbackSize = Math.max(1, Number(profile.householdMembers) || 1);

    let adults = 1;
    let children = 0;
    let seniors = 0;

    members.forEach((member) => {
      const raw = String(member.age || '').trim();
      const dobAge = calculateAgeFromDob(raw);
      const numericAge = Number.isFinite(Number(raw)) ? Number(raw) : null;
      const age = dobAge ?? numericAge;

      if (age !== null && age !== undefined) {
        if (age >= 65) {
          seniors += 1;
          return;
        }
        if (age <= 17) {
          children += 1;
          return;
        }
      }
      if (member.ageGroup === 'SENIOR') {
        seniors += 1;
      } else if (member.ageGroup === 'CHILD' || member.ageGroup === 'TEEN' || member.ageGroup === 'INFANT') {
        children += 1;
      } else {
        adults += 1;
      }
    });

    const inferredTotal = adults + children + seniors;
    const people = Math.max(fallbackSize, inferredTotal);
    return { people, adults, children, seniors };
  }, []);

  const scaledQuantityForItem = (itemId: string, baseQuantity: string) => {
    const people = Math.max(1, householdScale.people);
    const adults = Math.max(1, householdScale.adults);
    const children = Math.max(0, householdScale.children);
    const seniors = Math.max(0, householdScale.seniors);
    const days = Math.max(3, Number(guidance?.recommended_duration_days || 3));

    switch (itemId) {
      case 'water':
        return `${people * days} gal (${days}d)`;
      case 'food':
        return `${people * days} meals`;
      case 'plates':
        return `${Math.max(1, Math.ceil((people * days) / 18))} packs`;
      case 'filter':
        return `${Math.max(1, Math.ceil(people / 4))} unit(s)`;
      case 'bandages':
        return `${Math.max(1, Math.ceil(people / 2))} kit(s)`;
      case 'meds':
        return `${days} days/person`;
      case 'common-meds':
        return `${Math.max(1, Math.ceil(people / 2))} supply sets`;
      case 'sanitizer':
        return `${Math.max(1, Math.ceil(people / 2))} bottles`;
      case 'toiletries':
        return `${Math.max(1, Math.ceil(people / 2))} hygiene kits`;
      case 'flashlight':
        return `${Math.max(1, Math.ceil(people / 2))}x`;
      case 'whistle':
        return `${people}x`;
      case 'mask':
        return `${Math.max(3, people * 3)}x`;
      case 'cash': {
        const min = 200 + (people - 1) * 75;
        const max = 300 + (people - 1) * 100;
        return `$${min}-${max}`;
      }
      case 'contacts':
        return `${Math.max(1, adults)} list(s)`;
      case 'photos':
        return `${Math.max(4, people * 2)} photos`;
      case 'opener':
      case 'radio':
      case 'car-charger':
      case 'multi-tool':
      case 'map':
      case 'usb':
        return people >= 4 ? '2x' : '1x';
      case 'glasses':
        return `1 pair per wearer`;
      default:
        if (seniors > 0 && (itemId === 'charger' || itemId === 'power')) {
          return `${Math.max(2, Math.ceil(people / 2))} sets`;
        }
        if (children > 0 && itemId === 'food') {
          return `${people * days} meals (+ child snacks)`;
        }
        return baseQuantity;
    }
  };

  const dynamicItems = useMemo(() => {
    const staticIds = new Set(CATEGORIES.flatMap((cat) => cat.items.map((item) => item.id)));
    return (guidance?.added_items || []).filter((item) => !staticIds.has(item.id));
  }, [guidance]);

  const totalItems = useMemo(() => {
    const staticCount = CATEGORIES.reduce((sum, cat) => sum + cat.items.length, 0);
    return staticCount + dynamicItems.length;
  }, [dynamicItems]);
  const checkedCount = useMemo(() => Object.values(checkedItems).filter(Boolean).length, [checkedItems]);
  const progressPercent = Math.round((checkedCount / totalItems) * 100);

  useEffect(() => {
    setExpanded((prev) => ({ ...prev, [CATEGORIES[0].id]: true }));
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(READY_KIT_STORAGE_KEY);
    let localUpdatedAt = 0;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.checkedIds && Array.isArray(parsed.checkedIds)) {
          const restored: Record<string, boolean> = {};
          parsed.checkedIds.forEach((id: string) => {
            restored[id] = true;
          });
          setCheckedItems(restored);
        }
        if (parsed?.lastUpdated) {
          localUpdatedAt = Date.parse(parsed.lastUpdated) || 0;
        }
      } catch {
        // ignore parse errors
      }
    }

    const loadRemote = async () => {
      try {
        const remote = await fetchReadyKit();
        if (!remote?.checked_ids || !Array.isArray(remote.checked_ids)) return;
        const remoteUpdatedAt = remote.updated_at ? Date.parse(remote.updated_at) : 0;
        if (remoteUpdatedAt >= localUpdatedAt) {
          const restored: Record<string, boolean> = {};
          remote.checked_ids.forEach((id: string) => {
            restored[id] = true;
          });
          setCheckedItems(restored);
        }
      } catch {
        // ignore remote load errors
      }

      try {
        const kitGuidance = await fetchKitGuidanceForCurrentUser();
        setGuidance(kitGuidance as KitGuidance);
      } catch {
        // ignore guidance errors
      }
    };

    loadRemote();
  }, []);

  const toggleCategory = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleItem = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const saveKit = async () => {
    const checkedIds = Object.keys(checkedItems).filter((id) => checkedItems[id]);
    localStorage.setItem(
      READY_KIT_STORAGE_KEY,
      JSON.stringify({
        checkedIds,
        totalItems,
        checkedItems: checkedIds.length,
        lastUpdated: new Date().toISOString(),
      })
    );
    try {
      await saveReadyKit({
        checkedIds,
        totalItems,
        checkedItems: checkedIds.length,
      });
      try {
        const kitGuidance = await fetchKitGuidanceForCurrentUser();
        setGuidance(kitGuidance as KitGuidance);
      } catch {
        // ignore guidance refresh errors
      }
    } catch {
      // keep local save even if remote sync fails
    }
    setShowSaved(true);
  };

  const buildSummaryText = () => {
    const lines: string[] = [];
    lines.push('AERA Ready Kit');
    lines.push(`Progress: ${checkedCount} of ${totalItems} items`);
    lines.push('');
    CATEGORIES.forEach((category) => {
      lines.push(category.title);
      category.items.forEach((item) => {
        const checked = checkedItems[item.id];
        lines.push(`${checked ? '✓' : '•'} ${item.title} (${scaledQuantityForItem(item.id, item.quantity)}) - ${item.description}`);
      });
      lines.push('');
    });
    return lines;
  };

  const exportPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 54;
    const contentWidth = pageWidth - margin * 2;

    const colors = {
      primaryBlue: '#5B9BD5',
      lightBlue: '#DAE8F5',
      accentGreen: '#70AD47',
      textDark: '#2C3E50',
      textMedium: '#5A6C7D',
      borderLight: '#BDD7EE',
      headerBg: '#4472C4',
      categoryBg: '#E7F3FF',
      white: '#FFFFFF',
    };

    const setFill = (hex: string) => doc.setFillColor(hex);
    const setText = (hex: string) => doc.setTextColor(hex);
    const setDraw = (hex: string) => doc.setDrawColor(hex);

    let y = margin;

    const addTitle = () => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      setText(colors.headerBg);
      doc.text('Your Ready Kit Checklist', pageWidth / 2, y, { align: 'center' });
      y += 22;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      setText(colors.textMedium);
      doc.text('Gather these helpful items to have on hand when you need them', pageWidth / 2, y, { align: 'center' });
      y += 28;
    };

    const addProgressBox = () => {
      const boxHeight = 120;
      setFill(colors.lightBlue);
      setDraw(colors.primaryBlue);
      doc.rect(margin, y, contentWidth, boxHeight, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      setText(colors.white);
      setFill(colors.primaryBlue);
      doc.rect(margin, y, contentWidth, 26, 'F');
      doc.text('My Progress Tracker', margin + 12, y + 18);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      setText(colors.textDark);
      const progressLines = [
        `☐ Food & Water (${CATEGORIES[0].items.length} items)`,
        `☐ Health Items (${CATEGORIES[1].items.length} items)`,
        `☐ Light & Power (${CATEGORIES[2].items.length} items)`,
        `☐ Papers & Money (${CATEGORIES[3].items.length} items)`,
      ];
      progressLines.forEach((line, index) => {
        doc.text(line, margin + 16, y + 46 + index * 18);
      });
      y += boxHeight + 28;
    };

    const addCategoryHeader = (title: string, description: string) => {
      const headerHeight = 32;
      setFill(colors.categoryBg);
      setDraw(colors.primaryBlue);
      doc.rect(margin, y, contentWidth, headerHeight, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      setText(colors.headerBg);
      doc.text(title, margin + 12, y + 20);
      y += headerHeight + 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      setText(colors.textMedium);
      doc.text(description, margin + 12, y + 2);
      y += 12;
    };

    const addItemsTable = (items: KitCategory['items']) => {
      const rowHeight = 30;
      const checkboxWidth = 24;
      const qtyWidth = 90;
      const textWidth = contentWidth - checkboxWidth - qtyWidth;

      items.forEach((item, index) => {
        if (y + rowHeight + 40 > pageHeight) {
          doc.addPage();
          y = margin;
        }
        const isAlt = index % 2 === 1;
        setFill(isAlt ? colors.lightBlue : colors.white);
        setDraw(colors.borderLight);
        doc.rect(margin, y, contentWidth, rowHeight, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        setText(colors.accentGreen);
        doc.text('☐', margin + 8, y + 20);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        setText(colors.textDark);
        doc.text(item.title, margin + checkboxWidth, y + 14, { maxWidth: textWidth - 10 });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        setText(colors.textMedium);
        doc.text(item.description, margin + checkboxWidth, y + 26, { maxWidth: textWidth - 10 });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        setText(colors.textMedium);
        doc.text(scaledQuantityForItem(item.id, item.quantity), margin + checkboxWidth + textWidth + qtyWidth - 8, y + 18, { align: 'right' });

        y += rowHeight;
      });
      y += 16;
    };

    const addTips = () => {
      if (y + 120 > pageHeight) {
        doc.addPage();
        y = margin;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      setText(colors.headerBg);
      doc.text('Helpful Tips', margin, y + 14);
      y += 22;
      const tips = [
        'Store your kit in an easy-to-reach spot that everyone in your home knows about',
        'Check expiration dates every 6 months and replace items as needed',
        'Keep this list with your kit so you can re-check it later',
        'Share this checklist with family members so everyone can help gather items',
      ];
      const boxHeight = 86;
      setFill(colors.lightBlue);
      setDraw(colors.primaryBlue);
      doc.rect(margin, y, contentWidth, boxHeight, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      setText(colors.accentGreen);
      tips.forEach((tip, index) => {
        doc.text('✓', margin + 12, y + 22 + index * 18);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        setText(colors.textDark);
        doc.text(tip, margin + 28, y + 22 + index * 18, { maxWidth: contentWidth - 40 });
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        setText(colors.accentGreen);
      });
      y += boxHeight + 10;
    };

    addTitle();
    addProgressBox();

    CATEGORIES.forEach((category) => {
      if (y + 140 > pageHeight) {
        doc.addPage();
        y = margin;
      }
      addCategoryHeader(`${category.title}`, category.subtitle);
      addItemsTable(category.items);
    });

    addTips();
    doc.save('AERA-Ready-Kit.pdf');
  };

  const shareKit = async () => {
    const text = buildSummaryText().join('\n');
    if (navigator.share) {
      try {
        await navigator.share({ title: 'AERA Ready Kit', text });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      alert('Ready kit copied to clipboard.');
    } catch {
      alert('Unable to share right now.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-40">
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white px-5 pt-4 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setView('DASHBOARD')}
            className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Build Your Ready Kit</h1>
            <p className="text-sm text-blue-50">Gather helpful items to have on hand when you need them</p>
          </div>
        </div>
      </div>

      <div className="bg-white px-5 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-slate-900">What You’ve Gathered</h3>
          <span className="text-xs font-bold text-emerald-600">{checkedCount} of {totalItems} items</span>
        </div>
        <button
          onClick={() => setView('READINESS_GAP')}
          className="text-[11px] font-semibold text-brand-600 hover:underline mb-2"
        >
          View readiness gaps
        </button>
        <p className="text-[11px] text-slate-500 mb-2">
          Quantities auto-scaled for {householdScale.people} household member{householdScale.people === 1 ? '' : 's'}.
        </p>
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {guidance && (
        <div className="mx-4 mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">Personalized Preparedness Guidance</h3>
            <p className="text-xs text-slate-500">Based on your profile, we recommend the following:</p>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-2">
                <p className="text-[10px] text-blue-700 font-bold uppercase">Supply Duration</p>
                <p className="text-lg font-black text-blue-900">{guidance.recommended_duration_days}d</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                <p className="text-[10px] text-emerald-700 font-bold uppercase">Readiness</p>
                <p className="text-lg font-black text-emerald-900">{Math.round(guidance.readiness_score)}%</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <p className="text-[10px] text-slate-600 font-bold uppercase">Risk Tier</p>
                <p className="text-lg font-black text-slate-900">{guidance.risk_tier}</p>
              </div>
            </div>

            {guidance.critical_missing_items.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs font-bold text-red-700 uppercase mb-1">Critical Items Needed</p>
                <ul className="space-y-1">
                  {guidance.critical_missing_items.map((item) => (
                    <li key={item.id} className="text-sm text-red-900">• {item.item}</li>
                  ))}
                </ul>
                <p className="text-xs text-red-700 mt-2">Readiness is currently capped at {Math.round(guidance.readiness_cap)}% until these are completed.</p>
              </div>
            )}

            {guidance.added_items.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-bold text-amber-700 uppercase mb-1">Dynamic Kit Additions</p>
                <ul className="space-y-1">
                  {guidance.added_items.slice(0, 8).map((item) => (
                    <li key={item.id} className="text-sm text-amber-900">• {item.item} <span className="text-[11px] uppercase font-semibold">({item.priority})</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {dynamicItems.length > 0 && (
        <div className="mx-4 mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
            <h3 className="text-sm font-bold text-amber-900">Profile-Based Required Additions</h3>
            <p className="text-xs text-amber-700">These items were added automatically based on your profile.</p>
          </div>
          <div>
            {dynamicItems.map((item) => {
              const checked = !!checkedItems[item.id];
              return (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 border-b last:border-b-0 border-slate-100 hover:bg-slate-50"
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${checked ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'}`}>
                    {checked && <Check size={12} className="text-white" />}
                  </div>
                  <div className={`flex-1 text-left ${checked ? 'opacity-60 line-through' : ''}`}>
                    <div className="text-sm font-semibold text-slate-900">{item.item}</div>
                    <div className="text-xs text-slate-500">{item.explanation || 'Added from intake rule engine.'}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded uppercase font-bold ${String(item.priority).toLowerCase() === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {item.priority}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-4 py-4 space-y-2">
        {CATEGORIES.map((category) => {
          const catChecked = category.items.filter((item) => checkedItems[item.id]).length;
          const isOpen = !!expanded[category.id];
          return (
            <div key={category.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between px-4 py-4 hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
                    {category.icon}
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-bold text-slate-900">{category.title}</h3>
                    <p className="text-xs text-slate-500">{category.subtitle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
                    {catChecked}/{category.items.length}
                  </span>
                  <ChevronDown size={18} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-slate-100">
                  {category.items.map((item) => {
                    const checked = !!checkedItems[item.id];
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        className="w-full px-4 py-3 flex items-center gap-3 border-b border-slate-100 hover:bg-slate-50"
                      >
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${checked ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'}`}>
                          {checked && <Check size={12} className="text-white" />}
                        </div>
                        <div className={`flex-1 text-left ${checked ? 'opacity-60 line-through' : ''}`}>
                          <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                          <div className="text-xs text-slate-500">{item.description}</div>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                          {scaledQuantityForItem(item.id, item.quantity)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-4 pt-3 pb-6">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            onClick={exportPDF}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            <FileText size={16} /> Download PDF
          </button>
          <button
            onClick={shareKit}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Share2 size={16} /> Share
          </button>
        </div>
        <button
          onClick={saveKit}
          className="w-full rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white py-3 text-sm font-bold shadow-lg shadow-emerald-200"
        >
          <Save size={16} className="inline-block mr-2" /> Save My List
        </button>
      </div>

      {showSaved && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-emerald-100 mx-auto flex items-center justify-center text-emerald-600 mb-4">
              <Sparkles size={26} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">All Set!</h3>
            <p className="text-sm text-slate-500 mt-2">Your list is saved and ready whenever you need it. You can find it in your Settings.</p>
            <Button className="mt-4 w-full" onClick={() => setShowSaved(false)}>
              Sounds good
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
