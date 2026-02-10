import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, FileText, HeartPulse, Save, Share2, Sparkles, Droplets, Flashlight } from 'lucide-react';
import { Button } from '../components/Button';
import { ViewState } from '../types';

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

  const totalItems = useMemo(() => CATEGORIES.reduce((sum, cat) => sum + cat.items.length, 0), []);
  const checkedCount = useMemo(() => Object.values(checkedItems).filter(Boolean).length, [checkedItems]);
  const progressPercent = Math.round((checkedCount / totalItems) * 100);

  useEffect(() => {
    setExpanded((prev) => ({ ...prev, [CATEGORIES[0].id]: true }));
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(READY_KIT_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed?.checkedIds && Array.isArray(parsed.checkedIds)) {
        const restored: Record<string, boolean> = {};
        parsed.checkedIds.forEach((id: string) => {
          restored[id] = true;
        });
        setCheckedItems(restored);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const toggleCategory = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleItem = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const saveKit = () => {
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
    setShowSaved(true);
  };

  const exportPDF = () => {
    alert('This will create a printable list you can save or print. Great for keeping a paper copy with your supplies!');
  };

  const shareKit = () => {
    alert('Share this list with your family or friends so everyone knows what to gather.');
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
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

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
                          {item.quantity}
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
