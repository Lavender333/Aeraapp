
import React, { useState } from 'react';
import { ViewState } from '../types';
import { ArrowRight, ArrowLeft, ShieldCheck, Users, Building2, Radio, Navigation, X, AlertOctagon, WifiOff, DollarSign, Activity, BellRing, CheckCircle, MessageSquare, Download } from 'lucide-react';
import { downloadAdminPresentationPptx } from '../services/presentationExport';

interface Slide {
  id: number;
  title: string;
  subtitle: string;
  content: React.ReactNode;
  icon: React.ReactNode;
  gradient: string;
  accent: string;
  tag: string;
}

export const PresentationView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try { await downloadAdminPresentationPptx(); } finally { setDownloading(false); }
  };

  const slides: Slide[] = [
    {
      id: 0,
      title: "AERA",
      subtitle: "Accelerated Emergency Response Application",
      gradient: "from-[#0f172a] via-[#1e293b] to-[#0f172a]",
      accent: "#6366f1",
      tag: "Introduction",
      icon: <ShieldCheck size={52} strokeWidth={1.5} className="text-indigo-400" />,
      content: (
        <div className="space-y-5 text-center">
          <p className="text-2xl font-extralight tracking-widest text-white/70 uppercase">
            Mitigate &nbsp;·&nbsp; Communicate &nbsp;·&nbsp; Respond &nbsp;·&nbsp; Recover
          </p>
          <div className="relative bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-6">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
            <p className="text-base text-white/70 leading-relaxed">
              A comprehensive, role-based platform built to connect&nbsp;
              <span className="text-indigo-300 font-semibold">Communities</span>,&nbsp;
              <span className="text-indigo-300 font-semibold">Responders</span>, and&nbsp;
              <span className="text-indigo-300 font-semibold">Institutions</span>&nbsp;when it matters most.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 1,
      title: "The Challenge",
      subtitle: "Why existing systems fail during disasters",
      gradient: "from-[#1a0505] via-[#450a0a] to-[#1a0505]",
      accent: "#ef4444",
      tag: "Problem",
      icon: <AlertOctagon size={52} strokeWidth={1.5} className="text-red-400" />,
      content: (
        <div className="space-y-3 text-left">
          {[
            { label: "911 Overload", detail: "Call centers crash during mass events, leaving thousands unreachable." },
            { label: "Information Silos", detail: "NGOs, churches, and government agencies operate in isolation." },
            { label: "Slow Triage", detail: "Responders waste critical time locating people who are already safe." },
          ].map((item) => (
            <div key={item.label} className="flex gap-4 items-start bg-white/5 border border-red-500/20 p-4 rounded-xl backdrop-blur-sm">
              <div className="mt-0.5 w-2 h-2 rounded-full bg-red-400 shrink-0 mt-2" />
              <div>
                <p className="font-bold text-white text-sm">{item.label}</p>
                <p className="text-xs text-white/60 mt-0.5 leading-relaxed">{item.detail}</p>
              </div>
            </div>
          ))}
          <p className="text-center text-sm font-semibold text-red-300 italic pt-2">"AERA solves the chaos of coordination."</p>
        </div>
      )
    },
    {
      id: 2,
      title: "The User Journey",
      subtitle: "Rapid, frictionless emergency reporting",
      gradient: "from-[#030c1a] via-[#0c2340] to-[#030c1a]",
      accent: "#3b82f6",
      tag: "Core Feature",
      icon: <Users size={52} strokeWidth={1.5} className="text-blue-400" />,
      content: (
        <div className="space-y-3">
          {[
            { num: "01", label: "One-Tap SOS", detail: "Report Safe or Danger status in under 3 seconds." },
            { num: "02", label: "Live GPS Tracking", detail: "Real-time location with accuracy metrics for precise routing." },
            { num: "03", label: "Vital Intake", detail: "Pre-loaded medical and household data speeds triage response." },
          ].map((step) => (
            <div key={step.num} className="flex gap-4 items-start bg-white/5 border border-blue-500/20 p-4 rounded-xl">
              <span className="text-2xl font-black text-blue-500/40 leading-none shrink-0 w-8">{step.num}</span>
              <div>
                <p className="font-bold text-white text-sm">{step.label}</p>
                <p className="text-xs text-white/60 mt-0.5 leading-relaxed">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )
    },
    {
      id: 3,
      title: "Offline Resilience",
      subtitle: "Works when infrastructure fails",
      gradient: "from-[#1a0f00] via-[#431407] to-[#1a0f00]",
      accent: "#f59e0b",
      tag: "Infrastructure",
      icon: <WifiOff size={52} strokeWidth={1.5} className="text-amber-400" />,
      content: (
        <div className="space-y-4">
          {[
            { icon: <Activity size={18} className="text-amber-400" />, label: "Store & Forward", detail: "Reports save locally then auto-sync the instant a signal is detected — even for a single second." },
            { icon: <Navigation size={18} className="text-amber-400" />, label: "Local Caching", detail: "Maps, safety protocols, and critical contacts remain fully accessible with zero internet." },
          ].map((item) => (
            <div key={item.label} className="relative bg-white/5 border border-amber-500/20 p-4 rounded-xl">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
              <div className="flex items-center gap-2 mb-1.5">{item.icon}<p className="font-bold text-white text-sm">{item.label}</p></div>
              <p className="text-xs text-white/60 leading-relaxed">{item.detail}</p>
            </div>
          ))}
        </div>
      )
    },
    {
      id: 4,
      title: "Organization Hubs",
      subtitle: "Empowering trusted community institutions",
      gradient: "from-[#0d0720] via-[#2e1065] to-[#0d0720]",
      accent: "#a855f7",
      tag: "Organizations",
      icon: <Building2 size={52} strokeWidth={1.5} className="text-purple-400" />,
      content: (
        <div className="space-y-3">
          <div className="relative bg-white/5 border border-purple-500/20 p-4 rounded-xl">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
            <p className="font-bold text-purple-300 text-sm mb-1">Community Connect</p>
            <p className="text-xs text-white/60 leading-relaxed">Churches & NGOs become <span className="text-white font-semibold">Digital Beacons</span>. Members join via unique <span className="text-white font-semibold">Community IDs</span>.</p>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {["Real-time member safety status (Safe vs Danger)", "Local supply inventory management", "Direct replenishment requests to FEMA / HQ"].map((item) => (
              <div key={item} className="flex items-center gap-3 text-xs text-white/70 bg-white/5 px-3 py-2 rounded-lg border border-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 5,
      title: "Active Safety Checks",
      subtitle: "Proactive accountability at scale",
      gradient: "from-[#040820] via-[#1e1b4b] to-[#040820]",
      accent: "#818cf8",
      tag: "Safety",
      icon: <BellRing size={52} strokeWidth={1.5} className="text-indigo-300" />,
      content: (
        <div className="space-y-3">
          <p className="text-sm text-white/60 text-center italic">Don't wait for reports — proactively check on your people.</p>
          {[
            { icon: <Radio size={16} />, color: "bg-indigo-600", label: "Admin Pings Member", detail: '"Status check requested — please respond."' },
            { icon: <MessageSquare size={16} />, color: "bg-red-500", label: "User Responds", detail: 'One tap: "I Am Safe" or "Need Help".' },
            { icon: <CheckCircle size={16} />, color: "bg-emerald-500", label: "Dashboard Updates", detail: "Status card turns green or red in real-time." },
          ].map((step, i) => (
            <div key={step.label} className="flex gap-3 items-start bg-white/5 border border-white/10 p-3 rounded-xl">
              <div className={`${step.color} p-2 rounded-full text-white shrink-0`}>{step.icon}</div>
              <div>
                <p className="font-bold text-white text-xs">{i + 1}. {step.label}</p>
                <p className="text-xs text-white/50 mt-0.5">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )
    },
    {
      id: 6,
      title: "Economic Recovery",
      subtitle: "The G.A.P. Financial Center",
      gradient: "from-[#021a0e] via-[#064e3b] to-[#021a0e]",
      accent: "#10b981",
      tag: "Recovery",
      icon: <DollarSign size={52} strokeWidth={1.5} className="text-emerald-400" />,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-white/60 text-center">Rescue is just the beginning. AERA bridges the gap to rebuilding.</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Grants", color: "text-emerald-300", detail: "Streamlined applications for housing & business aid." },
              { label: "Advances", color: "text-teal-300", detail: "Emergency cash flow for verified disaster victims." },
            ].map((card) => (
              <div key={card.label} className="relative bg-white/5 border border-emerald-500/20 p-3 rounded-xl">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
                <p className={`font-bold text-sm ${card.color} mb-1`}>{card.label}</p>
                <p className="text-xs text-white/50 leading-relaxed">{card.detail}</p>
              </div>
            ))}
          </div>
          <div className="text-center text-sm font-semibold text-emerald-300 italic bg-white/5 border border-emerald-500/10 rounded-xl py-3">
            "Getting funds to families faster."
          </div>
        </div>
      )
    },
    {
      id: 7,
      title: "Admin Command",
      subtitle: "System-wide control & full accountability",
      gradient: "from-[#0a0a0f] via-[#18181b] to-[#0a0a0f]",
      accent: "#f43f5e",
      tag: "Admin",
      icon: <Radio size={52} strokeWidth={1.5} className="text-rose-400" />,
      content: (
        <div className="space-y-3">
          {[
            { label: "Broadcasts", color: "text-rose-400", detail: "Push global or org-scoped emergency alerts instantly to all connected members." },
            { label: "Master Inventory", color: "text-orange-400", detail: "Aggregate and manage supply needs across every organization simultaneously." },
            { label: "Paper Trail", color: "text-green-400", detail: "Digital signatures, printable work orders, and CSV exports for full legal accountability." },
          ].map((item) => (
            <div key={item.label} className="bg-white/5 border border-white/10 p-3 rounded-xl">
              <p className={`font-bold text-sm ${item.color} mb-1`}>{item.label}</p>
              <p className="text-xs text-white/50 leading-relaxed">{item.detail}</p>
            </div>
          ))}
        </div>
      )
    },
    {
      id: 8,
      title: "Future Tech",
      subtitle: "AI & autonomous drone integration",
      gradient: "from-[#00131a] via-[#0d3a40] to-[#00131a]",
      accent: "#14b8a6",
      tag: "Vision",
      icon: <Navigation size={52} strokeWidth={1.5} className="text-teal-400" />,
      content: (
        <div className="space-y-4">
          {[
            { icon: <Navigation size={18} className="text-teal-400" />, label: "Drone Dispatch", detail: "Autonomous UAVs dispatched for supply drops or visual recon based on GPS distress signals." },
            { icon: <ShieldCheck size={18} className="text-teal-400" />, label: "AI Analysis", detail: "Gemini-powered damage assessment from photos and real-time content moderation for broadcasts." },
          ].map((item) => (
            <div key={item.label} className="relative bg-white/5 border border-teal-500/20 p-4 rounded-xl">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-500/50 to-transparent" />
              <div className="flex items-center gap-2 mb-1.5">{item.icon}<p className="font-bold text-white text-sm">{item.label}</p></div>
              <p className="text-xs text-white/60 leading-relaxed">{item.detail}</p>
            </div>
          ))}
        </div>
      )
    }
  ];

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) setCurrentSlide(p => p + 1);
    else setView('SPLASH');
  };

  const prevSlide = () => { if (currentSlide > 0) setCurrentSlide(p => p - 1); };

  const slide = slides[currentSlide];
  const progressPct = ((currentSlide + 1) / slides.length) * 100;

  return (
    <div className={`min-h-screen flex flex-col bg-gradient-to-br ${slide.gradient} transition-all duration-700 relative overflow-hidden`}>

      {/* Ambient glow blob */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-700"
        style={{ background: `radial-gradient(ellipse 60% 40% at 50% 0%, ${slide.accent}18 0%, transparent 70%)` }}
      />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-6 pb-2">
        {/* Left: tag + slide count */}
        <div className="flex items-center gap-3">
          <span
            className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border"
            style={{ color: slide.accent, borderColor: `${slide.accent}40`, background: `${slide.accent}12` }}
          >
            {slide.tag}
          </span>
          <span className="text-white/30 text-xs font-mono">{String(currentSlide + 1).padStart(2,'0')} / {String(slides.length).padStart(2,'0')}</span>
        </div>

        {/* Right: download + close */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 text-white/50 hover:text-white transition-colors text-xs font-semibold disabled:opacity-40"
          >
            <Download size={14} /> {downloading ? 'Saving…' : '.pptx'}
          </button>
          <div className="w-px h-4 bg-white/10" />
          <button onClick={() => setView('SPLASH')} className="text-white/40 hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Thin progress bar */}
      <div className="relative z-10 h-0.5 mx-6 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progressPct}%`, background: slide.accent }}
        />
      </div>

      {/* Slide content */}
      <div
        className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8 text-center"
        key={currentSlide}
        style={{ animation: 'fadeSlideUp 0.45s cubic-bezier(.22,1,.36,1) both' }}
      >
        {/* Icon circle */}
        <div
          className="mb-6 p-5 rounded-3xl border backdrop-blur-sm"
          style={{ borderColor: `${slide.accent}30`, background: `${slide.accent}12` }}
        >
          {slide.icon}
        </div>

        {/* Accent line */}
        <div className="w-8 h-0.5 rounded-full mb-5" style={{ background: slide.accent }} />

        <h1 className="text-4xl font-black tracking-tight text-white mb-2 leading-tight">
          {slide.title}
        </h1>
        <p className="text-sm font-medium text-white/50 mb-8 max-w-xs leading-relaxed">
          {slide.subtitle}
        </p>

        <div className="w-full max-w-sm">
          {slide.content}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="relative z-10 flex items-center justify-between px-6 pb-8 pt-4">
        <button
          onClick={prevSlide}
          disabled={currentSlide === 0}
          className="flex items-center gap-2 text-white/40 hover:text-white disabled:opacity-0 transition-all text-sm font-semibold"
        >
          <ArrowLeft size={18} /> Prev
        </button>

        {/* Dot indicators */}
        <div className="flex gap-1.5 items-center">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === currentSlide ? '20px' : '6px',
                height: '6px',
                background: i === currentSlide ? slide.accent : 'rgba(255,255,255,0.2)'
              }}
            />
          ))}
        </div>

        <button
          onClick={nextSlide}
          className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-full transition-all hover:scale-105 active:scale-95 shadow-lg"
          style={{ background: slide.accent, color: '#fff', boxShadow: `0 4px 20px ${slide.accent}50` }}
        >
          {currentSlide === slides.length - 1 ? 'Finish' : 'Next'} <ArrowRight size={16} />
        </button>
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
