
import React, { useState } from 'react';
import { ViewState } from '../types';
import { Button } from '../components/Button';
import { ArrowRight, ArrowLeft, ShieldCheck, Users, Building2, Radio, Navigation, X, AlertOctagon, WifiOff, DollarSign, Activity, BellRing, CheckCircle, MessageSquare } from 'lucide-react';

interface Slide {
  id: number;
  title: string;
  subtitle: string;
  content: React.ReactNode;
  icon: React.ReactNode;
  bg: string;
}

export const PresentationView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides: Slide[] = [
    {
      id: 0,
      title: "AERA",
      subtitle: "Accelerated Emergency Response Application",
      bg: "bg-slate-900 text-white",
      icon: <ShieldCheck size={64} className="text-brand-500" />,
      content: (
        <div className="space-y-6 text-center">
          <p className="text-xl font-light text-slate-300">
            "Mitigate • Communicate • Respond • Recover"
          </p>
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
            <p className="text-sm text-slate-400 leading-relaxed">
              A comprehensive, role-based platform designed to connect 
              <strong> Communities</strong>, <strong> Responders</strong>, and 
              <strong> Institutions</strong> during disasters.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 1,
      title: "The Challenge",
      subtitle: "Why We Built AERA",
      bg: "bg-red-900 text-white",
      icon: <AlertOctagon size={64} className="text-red-200" />,
      content: (
        <div className="space-y-4 text-left">
          <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
            <h4 className="font-bold text-red-200 mb-2">Current Problems:</h4>
            <ul className="space-y-3 text-sm text-white/90">
              <li className="flex gap-3">
                <X className="text-red-400 shrink-0" size={18} /> 
                <span><strong>911 Overload:</strong> Call centers crash during mass events.</span>
              </li>
              <li className="flex gap-3">
                <X className="text-red-400 shrink-0" size={18} /> 
                <span><strong>Information Silos:</strong> NGOs, Churches, and Gov don't share data.</span>
              </li>
              <li className="flex gap-3">
                <X className="text-red-400 shrink-0" size={18} /> 
                <span><strong>Slow Triage:</strong> Responders waste time finding people who are already safe.</span>
              </li>
            </ul>
          </div>
          <p className="text-center text-sm font-medium text-red-200 italic">
            "AERA solves the chaos of coordination."
          </p>
        </div>
      )
    },
    {
      id: 2,
      title: "The User Journey",
      subtitle: "Rapid, Low-Friction Emergency Reporting",
      bg: "bg-blue-600 text-white",
      icon: <Users size={64} className="text-blue-200" />,
      content: (
        <div className="space-y-4">
          <ul className="space-y-4 text-left">
            <li className="flex items-start gap-3 bg-blue-700/50 p-3 rounded-lg">
              <span className="bg-white text-blue-700 font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0">1</span>
              <span><strong>One-Tap SOS:</strong> Users report status (Safe/Danger) in seconds.</span>
            </li>
            <li className="flex items-start gap-3 bg-blue-700/50 p-3 rounded-lg">
              <span className="bg-white text-blue-700 font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0">2</span>
              <span><strong>Live GPS:</strong> Real-time tracking with accuracy metrics.</span>
            </li>
            <li className="flex items-start gap-3 bg-blue-700/50 p-3 rounded-lg">
              <span className="bg-white text-blue-700 font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0">3</span>
              <span><strong>Vital Intake:</strong> Pre-loaded medical needs and household data speeds up triage.</span>
            </li>
          </ul>
        </div>
      )
    },
    {
      id: 3,
      title: "Offline Resilience",
      subtitle: "Works When The Power Goes Out",
      bg: "bg-amber-700 text-white",
      icon: <WifiOff size={64} className="text-amber-200" />,
      content: (
        <div className="space-y-5">
          <div className="bg-amber-800/50 p-4 rounded-xl border border-amber-500/30">
            <h4 className="font-bold flex items-center gap-2 mb-2"><Activity size={18}/> Store & Forward</h4>
            <p className="text-sm text-amber-100">
              When cell towers fail, AERA saves reports locally. As soon as a signal is detected (even for a second), data is automatically synced to the command center.
            </p>
          </div>
          <div className="bg-amber-800/50 p-4 rounded-xl border border-amber-500/30">
             <h4 className="font-bold flex items-center gap-2 mb-2"><Navigation size={18}/> Local Caching</h4>
             <p className="text-sm text-amber-100">
               Maps, safety tips, and critical contacts remain accessible on the device without internet.
             </p>
          </div>
        </div>
      )
    },
    {
      id: 4,
      title: "Organization Hubs",
      subtitle: "Empowering Trusted Institutions",
      bg: "bg-purple-700 text-white",
      icon: <Building2 size={64} className="text-purple-200" />,
      content: (
        <div className="space-y-4">
          <div className="bg-white text-purple-900 p-4 rounded-xl shadow-lg">
            <h4 className="font-bold border-b border-purple-100 pb-2 mb-2">Community Connect</h4>
            <p className="text-sm">Churches & NGOs act as "Digital Beacons". Users link via <strong>Community IDs</strong>.</p>
          </div>
          <ul className="space-y-2 text-sm text-purple-100">
            <li className="flex gap-2"><div className="w-1.5 h-1.5 bg-white rounded-full mt-2"/> Real-time Member Status (Safe vs Danger)</li>
            <li className="flex gap-2"><div className="w-1.5 h-1.5 bg-white rounded-full mt-2"/> Local Inventory Management</li>
            <li className="flex gap-2"><div className="w-1.5 h-1.5 bg-white rounded-full mt-2"/> Direct Replenishment Requests to FEMA/HQ</li>
          </ul>
        </div>
      )
    },
    {
      id: 5,
      title: "Active Safety Checks",
      subtitle: "Instant Accountability",
      bg: "bg-indigo-700 text-white",
      icon: <BellRing size={64} className="text-indigo-200" />,
      content: (
        <div className="space-y-6">
          <p className="text-lg font-light text-indigo-100">
            Don't wait for reports. Proactively check on your people.
          </p>
          <div className="space-y-3">
             {/* Step 1 */}
             <div className="flex items-center gap-4 bg-indigo-800/50 p-3 rounded-xl border border-indigo-500/30">
               <div className="p-2 bg-indigo-600 rounded-full text-white"><Radio size={20} /></div>
               <div className="text-left">
                 <p className="font-bold text-sm">1. Admin Pings Member</p>
                 <p className="text-xs text-indigo-200">"Pastor John requests a status check."</p>
               </div>
             </div>
             
             {/* Step 2 */}
             <div className="flex items-center gap-4 bg-indigo-800/50 p-3 rounded-xl border border-indigo-500/30">
               <div className="p-2 bg-red-500 rounded-full text-white"><MessageSquare size={20} /></div>
               <div className="text-left">
                 <p className="font-bold text-sm">2. User Responds</p>
                 <p className="text-xs text-indigo-200">User taps "I Am Safe" or "Need Help" instantly.</p>
               </div>
             </div>

             {/* Step 3 */}
             <div className="flex items-center gap-4 bg-indigo-800/50 p-3 rounded-xl border border-indigo-500/30">
               <div className="p-2 bg-green-500 rounded-full text-white"><CheckCircle size={20} /></div>
               <div className="text-left">
                 <p className="font-bold text-sm">3. Dashboard Updates</p>
                 <p className="text-xs text-indigo-200">Member status turns Green/Red in real-time.</p>
               </div>
             </div>
          </div>
        </div>
      )
    },
    {
      id: 6,
      title: "Economic Recovery",
      subtitle: "The G.A.P. Financial Center",
      bg: "bg-emerald-700 text-white",
      icon: <DollarSign size={64} className="text-emerald-200" />,
      content: (
        <div className="space-y-4">
          <p className="text-lg font-light text-emerald-100">
            Rescue is just the beginning. AERA bridges the gap to rebuilding.
          </p>
          <div className="grid grid-cols-2 gap-3 text-left">
             <div className="bg-emerald-800/50 p-3 rounded-lg border border-emerald-500/30">
               <strong className="block text-white mb-1">Grants</strong>
               <span className="text-xs text-emerald-200">Streamlined application for housing & business aid.</span>
             </div>
             <div className="bg-emerald-800/50 p-3 rounded-lg border border-emerald-500/30">
               <strong className="block text-white mb-1">Advances</strong>
               <span className="text-xs text-emerald-200">Emergency cash flow for verified victims.</span>
             </div>
          </div>
          <div className="bg-white/10 p-3 rounded-lg text-sm text-emerald-50 italic text-center">
             "Getting funds to families faster."
          </div>
        </div>
      )
    },
    {
      id: 7,
      title: "Admin Command",
      subtitle: "System-Wide Control & Logistics",
      bg: "bg-slate-800 text-white",
      icon: <Radio size={64} className="text-red-500" />,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-700 p-3 rounded-lg border border-slate-600">
              <strong className="block text-red-400 mb-1">Broadcasts</strong>
              <span className="text-xs text-slate-300">Push global alerts or scoped organization updates instantly.</span>
            </div>
            <div className="bg-slate-700 p-3 rounded-lg border border-slate-600">
              <strong className="block text-orange-400 mb-1">Master Inventory</strong>
              <span className="text-xs text-slate-300">Aggregate supply needs across all organizations.</span>
            </div>
          </div>
          <div className="bg-slate-700 p-3 rounded-lg border border-slate-600">
             <strong className="block text-green-400 mb-1">Paper Trail</strong>
             <span className="text-xs text-slate-300">Digital signatures, printable work orders, and CSV exports for full accountability.</span>
          </div>
        </div>
      )
    },
    {
      id: 8,
      title: "Future Tech",
      subtitle: "AI & Drone Integration",
      bg: "bg-teal-700 text-white",
      icon: <Navigation size={64} className="text-teal-200" />,
      content: (
        <div className="space-y-4">
          <div className="bg-teal-800/50 p-4 rounded-xl border border-teal-500/30">
            <h4 className="font-bold flex items-center gap-2 mb-2"><Navigation size={16}/> Drone Dispatch</h4>
            <p className="text-xs text-teal-100">Future capability to dispatch autonomous UAVs for supply drops or visual recon based on GPS distress signals.</p>
          </div>
          <div className="bg-teal-800/50 p-4 rounded-xl border border-teal-500/30">
            <h4 className="font-bold flex items-center gap-2 mb-2"><ShieldCheck size={16}/> AI Analysis</h4>
            <p className="text-xs text-teal-100">Gemini-powered damage assessment from user photos and content moderation for public broadcasts.</p>
          </div>
        </div>
      )
    }
  ];

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      setView('SPLASH');
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) setCurrentSlide(prev => prev - 1);
  };

  const slide = slides[currentSlide];

  return (
    <div className={`min-h-screen flex flex-col ${slide.bg} transition-colors duration-500`}>
      <div className="flex justify-between items-center p-6">
        <button onClick={() => setView('SPLASH')} className="text-white/50 hover:text-white transition-colors">
          <X size={24} />
        </button>
        <div className="flex gap-1">
          {slides.map((s, i) => (
            <div 
              key={s.id} 
              className={`w-2 h-2 rounded-full transition-all ${i === currentSlide ? 'bg-white w-6' : 'bg-white/30'}`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in" key={currentSlide}>
        <div className="mb-8 animate-slide-up">
          {slide.icon}
        </div>
        
        <h1 className="text-4xl font-black mb-2 tracking-tight animate-slide-up" style={{animationDelay: '100ms'}}>
          {slide.title}
        </h1>
        <p className="text-lg font-medium opacity-80 mb-12 animate-slide-up" style={{animationDelay: '200ms'}}>
          {slide.subtitle}
        </p>

        <div className="w-full max-w-sm animate-slide-up" style={{animationDelay: '300ms'}}>
          {slide.content}
        </div>
      </div>

      <div className="p-6 pb-safe flex justify-between items-center bg-black/10 backdrop-blur-sm">
        <Button 
          variant="ghost" 
          onClick={prevSlide} 
          disabled={currentSlide === 0}
          className="text-white hover:bg-white/10 disabled:opacity-0"
        >
          <ArrowLeft size={24} />
        </Button>

        <Button 
          onClick={nextSlide} 
          className="bg-white text-slate-900 hover:bg-slate-200 font-bold px-8 shadow-lg"
        >
          {currentSlide === slides.length - 1 ? 'Start App' : 'Next'} <ArrowRight size={18} className="ml-2" />
        </Button>
      </div>
    </div>
  );
};
