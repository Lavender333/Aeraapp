import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  Check,
  Church,
  ClipboardList,
  CloudLightning,
  Expand,
  HeartHandshake,
  Home,
  MapPin,
  PackageCheck,
  Radio,
  ShieldCheck,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { ViewState } from '../types';

type PresentationViewProps = {
  setView: (view: ViewState) => void;
};

type Slide = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  accent: string;
  content: React.ReactNode;
};

const Metric: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <div className="border-l border-white/20 pl-4">
    <p className="text-2xl font-semibold text-white md:text-3xl">{value}</p>
    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
  </div>
);

const FlowStep: React.FC<{
  icon: React.ReactNode;
  label: string;
  detail: string;
  active?: boolean;
}> = ({ icon, label, detail, active }) => (
  <div className={`relative flex-1 rounded-2xl border p-4 ${
    active ? 'border-emerald-400/60 bg-emerald-400/10' : 'border-white/10 bg-white/[0.04]'
  }`}>
    <div className={`mb-4 inline-flex rounded-xl p-2.5 ${active ? 'bg-emerald-400 text-slate-950' : 'bg-white/10 text-white'}`}>
      {icon}
    </div>
    <p className="text-base font-semibold text-white">{label}</p>
    <p className="mt-1 text-sm leading-5 text-slate-400">{detail}</p>
  </div>
);

const slides: Slide[] = [
  {
    eyebrow: 'On Mission Network × AERA',
    title: 'One network. One shared operating picture.',
    subtitle: 'A coordinated disaster response—from a family’s request to resources delivered.',
    accent: '#34d399',
    content: (
      <div className="grid gap-8 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:p-7">
          <div className="flex items-center gap-3 text-emerald-300">
            <ShieldCheck size={28} />
            <span className="text-sm font-semibold uppercase tracking-[0.22em]">Disaster-response coordination</span>
          </div>
          <p className="mt-5 max-w-2xl text-xl leading-8 text-slate-200 md:text-2xl">
            Physical response capacity and real-time digital coordination working as one system.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Metric value="1" label="Shared picture" />
          <Metric value="4" label="Connected levels" />
          <Metric value="Live" label="Operational data" />
          <Metric value="Local" label="Trusted response" />
        </div>
      </div>
    ),
  },
  {
    eyebrow: 'The operating challenge',
    title: 'During a disaster, information often moves slower than resources.',
    subtitle: 'The people, supplies, and willingness to help may already exist—but coordination is fragmented.',
    accent: '#fb7185',
    content: (
      <div className="grid gap-4 md:grid-cols-4">
        <FlowStep icon={<Home size={24} />} label="A family needs help" detail="Water, medication, and transportation are urgent." />
        <FlowStep icon={<Church size={24} />} label="A church can respond" detail="Local volunteers know the neighborhood." />
        <FlowStep icon={<Boxes size={24} />} label="A hub has supplies" detail="Resources exist, but demand is changing." />
        <FlowStep icon={<BarChart3 size={24} />} label="Leaders need clarity" detail="Decisions depend on timely, shared information." />
      </div>
    ),
  },
  {
    eyebrow: 'The partnership',
    title: 'On Mission Network delivers the response. AERA coordinates it.',
    accent: '#60a5fa',
    content: (
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-3xl border border-amber-300/25 bg-amber-300/[0.07] p-6 md:p-8">
          <Truck className="text-amber-300" size={34} />
          <h3 className="mt-5 text-2xl font-semibold text-white">Physical response</h3>
          <p className="mt-1 text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">On Mission Network</p>
          <ul className="mt-6 space-y-3 text-base text-slate-200">
            {['Regional hubs', 'Equipment and supplies', 'Church network', 'Volunteers and response teams'].map((item) => (
              <li key={item} className="flex items-center gap-3"><Check size={18} className="text-amber-300" />{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border border-sky-300/25 bg-sky-300/[0.07] p-6 md:p-8">
          <Radio className="text-sky-300" size={34} />
          <h3 className="mt-5 text-2xl font-semibold text-white">Digital coordination</h3>
          <p className="mt-1 text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">AERA</p>
          <ul className="mt-6 space-y-3 text-base text-slate-200">
            {['Requests and verified needs', 'Resource and volunteer coordination', 'Live operational information', 'One shared operating picture'].map((item) => (
              <li key={item} className="flex items-center gap-3"><Check size={18} className="text-sky-300" />{item}</li>
            ))}
          </ul>
        </div>
      </div>
    ),
  },
  {
    eyebrow: 'One disaster scenario',
    title: 'A severe storm creates urgent needs across the region.',
    subtitle: 'Power is out. Roads are flooded. Requests are arriving from households in multiple communities.',
    accent: '#a78bfa',
    content: (
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0b1627] p-6 md:p-8">
        <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_30%,#60a5fa_0,transparent_24%),radial-gradient(circle_at_80%_70%,#34d399_0,transparent_22%)]" />
        <div className="relative grid gap-6 md:grid-cols-[1.2fr_.8fr]">
          <div className="min-h-56 rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(30,64,175,.25),rgba(15,23,42,.9))] p-5">
            <div className="flex items-center gap-2 text-sky-300"><CloudLightning size={24} /><span className="font-semibold">Storm impact area</span></div>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                ['North County', '12 needs'],
                ['River District', '27 needs'],
                ['East Ridge', '8 needs'],
              ].map(([place, needs], index) => (
                <div key={place} className={`rounded-xl border p-3 ${index === 1 ? 'border-rose-400/60 bg-rose-400/10' : 'border-white/10 bg-white/5'}`}>
                  <MapPin size={18} className={index === 1 ? 'text-rose-300' : 'text-sky-300'} />
                  <p className="mt-3 text-sm font-semibold text-white">{place}</p>
                  <p className="text-xs text-slate-400">{needs}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {['Food and water', 'Medication support', 'Shelter', 'Transportation'].map((need, index) => (
              <div key={need} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="text-sm text-slate-200">{need}</span>
                <span className="font-mono text-sm text-white">{[34, 11, 9, 7][index]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    eyebrow: 'Step 1 · Request',
    title: 'A family communicates its need in minutes.',
    subtitle: 'The Carter household requests bottled water and medication delivery.',
    accent: '#38bdf8',
    content: (
      <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <div className="rounded-[2rem] border border-white/15 bg-slate-950 p-5 shadow-2xl">
          <div className="mx-auto mb-5 h-1.5 w-16 rounded-full bg-white/20" />
          <p className="text-xs uppercase tracking-[0.18em] text-sky-300">Request assistance</p>
          <h3 className="mt-2 text-xl font-semibold text-white">What does your household need?</h3>
          <div className="mt-5 space-y-2">
            {['Bottled water', 'Medication delivery', 'Transportation'].map((item, i) => (
              <div key={item} className={`flex items-center justify-between rounded-xl border px-4 py-3 ${i < 2 ? 'border-sky-400/50 bg-sky-400/10' : 'border-white/10'}`}>
                <span className="text-sm text-slate-200">{item}</span>
                {i < 2 && <Check size={17} className="text-sky-300" />}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-center">
          <p className="text-2xl font-semibold leading-tight text-white md:text-3xl">A clear request replaces scattered calls, texts, and spreadsheets.</p>
          <div className="mt-7 grid grid-cols-2 gap-4">
            <Metric value="Verified" label="Household profile" />
            <Metric value="Mapped" label="Request location" />
            <Metric value="Prioritized" label="Urgency signals" />
            <Metric value="Shared" label="With trusted teams" />
          </div>
        </div>
      </div>
    ),
  },
  {
    eyebrow: 'Step 2 · Local response',
    title: 'The local church sees a verified need and takes action.',
    subtitle: 'Grace Community Response Team accepts the request and assigns a nearby volunteer.',
    accent: '#fbbf24',
    content: (
      <div className="grid gap-5 md:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-start justify-between">
            <div><p className="text-xs uppercase tracking-[0.18em] text-amber-300">Priority request</p><h3 className="mt-2 text-2xl font-semibold text-white">Carter household</h3></div>
            <span className="rounded-full bg-rose-400/15 px-3 py-1 text-xs font-semibold text-rose-300">High priority</span>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-white/5 p-3 text-slate-300"><MapPin size={17} className="mb-2 text-amber-300" />1.8 miles away</div>
            <div className="rounded-xl bg-white/5 p-3 text-slate-300"><Users size={17} className="mb-2 text-amber-300" />Household of four</div>
          </div>
          <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-50">Water + temperature-sensitive medication</div>
        </div>
        <div className="flex flex-col justify-center space-y-3">
          {['Need reviewed', 'Response accepted', 'Volunteer assigned'].map((item, index) => (
            <div key={item} className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400 text-slate-950"><Check size={18} /></div>
              <div><p className="font-semibold text-white">{item}</p><p className="text-xs text-slate-400">{['11:08 AM', '11:11 AM', '11:14 AM'][index]}</p></div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    eyebrow: 'Step 3 · Regional coordination',
    title: 'The hub matches demand with available resources.',
    subtitle: 'Needs from multiple churches become one regional logistics picture.',
    accent: '#c084fc',
    content: (
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 md:col-span-2">
          <p className="text-xs uppercase tracking-[0.18em] text-purple-300">Regional demand</p>
          <div className="mt-5 space-y-4">
            {[
              ['Water cases', 74, 120],
              ['Food kits', 48, 80],
              ['Medical deliveries', 11, 15],
            ].map(([label, used, total]) => (
              <div key={String(label)}>
                <div className="mb-2 flex justify-between text-sm"><span className="text-slate-200">{label}</span><span className="text-slate-400">{used} requested</span></div>
                <div className="h-2 rounded-full bg-white/10"><div className="h-full rounded-full bg-purple-400" style={{ width: `${(Number(used) / Number(total)) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-emerald-300/25 bg-emerald-300/[0.07] p-5">
          <PackageCheck size={32} className="text-emerald-300" />
          <p className="mt-5 text-sm uppercase tracking-[0.16em] text-emerald-300">Allocation confirmed</p>
          <p className="mt-2 text-2xl font-semibold text-white">Church Route 04</p>
          <p className="mt-5 text-sm leading-6 text-slate-300">12 water cases<br />4 food kits<br />1 medical cooler</p>
        </div>
      </div>
    ),
  },
  {
    eyebrow: 'Step 4 · Delivery',
    title: 'Every resource remains visible from hub to household.',
    accent: '#34d399',
    content: (
      <div>
        <div className="grid gap-3 md:grid-cols-4">
          <FlowStep icon={<Boxes size={23} />} label="Regional hub" detail="Resources allocated" />
          <FlowStep icon={<Church size={23} />} label="Local church" detail="Shipment received" />
          <FlowStep icon={<Truck size={23} />} label="Response team" detail="Delivery in progress" />
          <FlowStep active icon={<Home size={23} />} label="Carter household" detail="Assistance delivered" />
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.07] p-5">
          <div><p className="text-xs uppercase tracking-[0.18em] text-emerald-300">Request resolved</p><p className="mt-1 text-xl font-semibold text-white">Water and medication delivered at 1:42 PM</p></div>
          <HeartHandshake size={38} className="text-emerald-300" />
        </div>
      </div>
    ),
  },
  {
    eyebrow: 'Step 5 · Leadership',
    title: 'One shared operating picture improves every decision.',
    subtitle: 'Leaders see what is happening, where needs are growing, and what resources should move next.',
    accent: '#60a5fa',
    content: (
      <div className="grid gap-4 lg:grid-cols-[.7fr_1.3fr]">
        <div className="grid grid-cols-2 gap-3">
          {[['47', 'Open requests'], ['83', 'Resolved'], ['12', 'Active churches'], ['106', 'Volunteers']].map(([value, label]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-3xl font-semibold text-white">{value}</p><p className="mt-1 text-xs text-slate-400">{label}</p></div>
          ))}
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between"><p className="font-semibold text-white">Regional priorities</p><ClipboardList size={22} className="text-sky-300" /></div>
          <div className="mt-5 space-y-3">
            {[
              ['River District water shortage', 'Move 40 cases from North Hub', 'Critical'],
              ['East Ridge volunteer gap', 'Reassign 6 available drivers', 'Action'],
              ['North County requests stabilizing', 'Maintain current coverage', 'Stable'],
            ].map(([title, action, status]) => (
              <div key={title} className="grid gap-2 rounded-xl border border-white/10 bg-slate-950/35 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                <p className="text-sm font-semibold text-white">{title}</p><p className="text-xs text-slate-400">{action}</p><span className="text-xs font-semibold text-sky-300">{status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    eyebrow: 'The opportunity',
    title: 'Physical capacity and digital coordination become one response system.',
    accent: '#fbbf24',
    content: (
      <div className="grid gap-7 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
        <div>
          <p className="max-w-3xl text-2xl font-semibold leading-snug text-white md:text-4xl">
            On Mission Network delivers the resources. <span className="text-emerald-300">AERA delivers the coordination.</span>
          </p>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
            Together, they create a faster, more organized, and data-informed disaster response—without replacing the trusted network already doing the work.
          </p>
        </div>
        <div className="rounded-3xl border border-amber-300/25 bg-amber-300/[0.07] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Proposed next step</p>
          <p className="mt-3 text-2xl font-semibold text-white">Demonstrate AERA in one regional response exercise.</p>
          <p className="mt-4 text-sm leading-6 text-slate-300">Validate the workflow with churches, hub leaders, volunteers, and one shared scenario.</p>
        </div>
      </div>
    ),
  },
];

export const PresentationView: React.FC<PresentationViewProps> = ({ setView }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slide = slides[currentSlide];

  const exit = () => {
    if (window.location.pathname === '/presentation') {
      window.location.assign('/');
      return;
    }
    setView('LOGIN');
  };

  const next = () => {
    if (currentSlide === slides.length - 1) return;
    setCurrentSlide((value) => value + 1);
  };

  const previous = () => setCurrentSlide((value) => Math.max(0, value - 1));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (['ArrowRight', 'PageDown', ' '].includes(event.key)) {
        event.preventDefault();
        next();
      }
      if (['ArrowLeft', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        previous();
      }
      if (event.key === 'Home') setCurrentSlide(0);
      if (event.key === 'End') setCurrentSlide(slides.length - 1);
      if (event.key === 'Escape') exit();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentSlide]);

  const requestFullscreen = () => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.();
    else void document.exitFullscreen?.();
  };

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#07111f] text-white">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_15%_10%,rgba(14,165,233,.13),transparent_28%),radial-gradient(circle_at_90%_85%,rgba(16,185,129,.12),transparent_30%)]" />
      <header className="relative z-20 flex items-center justify-between border-b border-white/10 px-4 py-3 md:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-300/30 bg-emerald-300/10"><ShieldCheck size={20} className="text-emerald-300" /></div>
          <div><p className="text-sm font-semibold">AERA</p><p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">On Mission Network briefing</p></div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={requestFullscreen} aria-label="Toggle full screen" className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"><Expand size={18} /></button>
          <button type="button" onClick={exit} aria-label="Exit presentation" className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"><X size={19} /></button>
        </div>
      </header>

      <section aria-live="polite" className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-5 py-8 md:px-10 lg:px-14">
        <div key={currentSlide} className="animate-[fadeSlide_.5s_ease-out]">
          <p className="text-xs font-semibold uppercase tracking-[0.26em]" style={{ color: slide.accent }}>{slide.eyebrow}</p>
          <h1 className="mt-4 max-w-5xl text-3xl font-semibold leading-[1.08] tracking-tight text-white md:text-5xl lg:text-6xl">{slide.title}</h1>
          {slide.subtitle && <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 md:text-xl">{slide.subtitle}</p>}
          <div className="mt-8 md:mt-10">{slide.content}</div>
        </div>
      </section>

      <footer className="relative z-20 border-t border-white/10 px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <button type="button" onClick={previous} disabled={currentSlide === 0} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 disabled:invisible"><ArrowLeft size={17} /> Previous</button>
          <div className="flex items-center gap-3">
            <span className="text-xs tabular-nums text-slate-500">{String(currentSlide + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
            <div className="hidden gap-1.5 sm:flex">
              {slides.map((item, index) => (
                <button key={item.title} type="button" onClick={() => setCurrentSlide(index)} aria-label={`Go to slide ${index + 1}`} className="h-1.5 rounded-full transition-all" style={{ width: index === currentSlide ? 28 : 7, backgroundColor: index === currentSlide ? slide.accent : 'rgba(255,255,255,.18)' }} />
              ))}
            </div>
          </div>
          <button type="button" onClick={next} disabled={currentSlide === slides.length - 1} className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:invisible" style={{ backgroundColor: slide.accent }}>Next <ArrowRight size={17} /></button>
        </div>
      </footer>

      <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
};
