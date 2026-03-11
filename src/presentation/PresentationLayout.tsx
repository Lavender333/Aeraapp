import React, { useEffect } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { ViewState } from '../../types';
import { Button } from '../../components/Button';

const featureRows = [
  {
    feature: 'Structured emergency intake',
    advantage: 'Captures safety status, location, injuries, hazards, household size, and resource needs in a consistent workflow',
    benefit: 'Faster triage, clearer field decisions, and fewer missed details during high-stress events',
  },
  {
    feature: 'AI-assisted triage support',
    advantage: 'Helps prioritize incoming requests and surface urgency signals quickly',
    benefit: 'Reduces response delays and helps teams focus first on the highest-risk households',
  },
  {
    feature: 'Offline-first operation',
    advantage: 'Supports store-and-forward reporting with sync when connectivity returns',
    benefit: 'Keeps communities operational when networks are overloaded or down',
  },
  {
    feature: 'Role-based dashboards',
    advantage: 'Gives admins, organization leaders, responders, and residents views tailored to their responsibilities',
    benefit: 'Less confusion, stronger accountability, and quicker action by every user group',
  },
  {
    feature: 'Community hub coordination',
    advantage: 'Connects churches, NGOs, and local institutions through trusted community structures',
    benefit: 'Enables hyper-local response using organizations people already know and trust',
  },
  {
    feature: 'Member safety check and status tracking',
    advantage: 'Makes it easy to see who is safe, who needs help, and who has not responded',
    benefit: 'Improves situational awareness and reduces time spent chasing incomplete status updates',
  },
  {
    feature: 'Broadcast alerts and targeted communication',
    advantage: 'Supports system-wide or organization-level messaging',
    benefit: 'Delivers clear instructions quickly and helps reduce misinformation during incidents',
  },
  {
    feature: 'Inventory and replenishment management',
    advantage: 'Tracks supply levels and requests for items like water, food, blankets, and medical kits',
    benefit: 'Prevents shortages, improves logistics visibility, and supports faster resupply',
  },
  {
    feature: 'Household and vulnerability profiles',
    advantage: 'Stores important readiness factors such as mobility limits, medical dependency, and transportation access',
    benefit: 'Helps teams identify high-risk households before and during an event',
  },
  {
    feature: 'Preparedness and recovery support',
    advantage: 'Extends beyond immediate response into kit readiness, recovery tracking, and financial assistance workflows',
    benefit: 'Makes AERA useful before, during, and after disaster—not only at the moment of crisis',
  },
  {
    feature: 'Multi-language support',
    advantage: 'Improves accessibility for diverse communities',
    benefit: 'Expands reach, trust, and adoption across broader populations',
  },
  {
    feature: 'Mobile-first experience',
    advantage: 'Designed for rapid use in the field and on personal devices',
    benefit: 'Increases usability for both affected residents and operational teams',
  },
];

const standoutSections = [
  {
    title: 'Built for real disaster conditions',
    body: 'AERA is designed for environments where time is limited, information is incomplete, and connectivity may fail. Its offline-first and mobile-first approach keeps operations practical when conventional workflows break down.',
  },
  {
    title: 'Connects institutions and households',
    body: 'AERA creates a shared operating picture across households, churches, NGOs, organization administrators, responders, and public leaders.',
  },
  {
    title: 'Supports preparedness, response, and recovery',
    body: 'The platform stays useful before, during, and after an incident through onboarding, alerts, triage, logistics, and financial recovery support.',
  },
  {
    title: 'Turns trusted networks into response assets',
    body: 'Community organizations can operate as digital hubs that accelerate communication, accountability, and help distribution.',
  },
];

const stakeholderBenefits = [
  {
    title: 'Residents and Households',
    items: ['Easier access to help', 'Faster reporting during emergencies', 'Better visibility to trusted support networks', 'More personalized response based on household realities'],
  },
  {
    title: 'Churches, NGOs, and Community Organizations',
    items: ['Better member accountability', 'Stronger preparedness oversight', 'Clearer resource planning', 'Faster communication with affected households'],
  },
  {
    title: 'Responders and Authorities',
    items: ['Better triage inputs', 'Improved prioritization of high-risk cases', 'Stronger local coordination', 'More efficient use of limited personnel and supplies'],
  },
  {
    title: 'Overall Community',
    items: ['Faster, more coordinated response', 'Reduced duplication and confusion', 'Better use of local trust networks', 'Stronger resilience before, during, and after disasters'],
  },
];

export const PresentationLayout: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const handleExit = () => {
    if (typeof window !== 'undefined' && window.location.pathname === '/presentation') {
      window.location.assign('/');
      return;
    }
    setView('LOGIN');
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleExit();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden overflow-y-auto bg-[linear-gradient(180deg,#020617_0%,#0f172a_32%,#111827_100%)] text-slate-100">
      <div className="top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl sm:sticky">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 md:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300">Presentation Mode</p>
            <h1 className="text-lg font-semibold text-white md:text-xl">AERA One-Pager</h1>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <a
              href="/docs/AERA_FEATURES_ADVANTAGES_BENEFITS_ONE_PAGER.md"
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:border-amber-400/40 hover:bg-white/10 hover:text-white sm:w-auto"
            >
              <ExternalLink size={16} /> Open source file
            </a>
            <Button size="sm" variant="secondary" onClick={handleExit} className="w-full sm:w-auto justify-center">
              <X size={16} className="mr-1" /> Exit
            </Button>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.30),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.18),transparent_30%),radial-gradient(circle_at_left,rgba(16,185,129,0.12),transparent_25%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
        <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-5 px-3 py-6 sm:px-4 sm:py-8 md:gap-8 md:px-6 md:py-14">
          <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.06] p-5 shadow-[0_30px_80px_rgba(2,6,23,0.55)] sm:p-6 md:rounded-[32px] md:p-10">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01)_45%,rgba(16,185,129,0.08))]" />
            <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
              <div className="max-w-4xl space-y-5">
                <div className="flex flex-wrap gap-2">
                  {['Preparedness', 'Response', 'Recovery'].map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200 sm:px-3 sm:text-xs sm:tracking-[0.18em]">
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-300">AERA at a glance</p>
                  <h2 className="max-w-4xl text-[1.9rem] font-semibold leading-tight tracking-tight text-white sm:text-4xl md:text-6xl md:leading-[1.05]">Prepared communities. Faster decisions. Stronger recovery.</h2>
                  <p className="max-w-3xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7 md:text-lg">
                  AERA is a mobile-first emergency coordination platform that helps households, trusted organizations, responders, and public-sector leaders prepare, communicate, respond, and recover faster during disasters.
                </p>
              </div>

                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {[
                  ['Mobile-first', 'Rapid field use'],
                  ['Offline-ready', 'Resilient operations'],
                  ['Role-based', 'Clear accountability'],
                ].map(([title, caption]) => (
                    <div key={title} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 backdrop-blur-sm">
                    <p className="text-base font-semibold text-white sm:text-lg">{title}</p>
                    <p className="mt-1 text-sm text-slate-400">{caption}</p>
                  </div>
                ))}
              </div>
            </div>

              <div className="relative mt-6 rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5 text-emerald-50 shadow-inner shadow-emerald-950/20 sm:mt-8 sm:p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Core value proposition</p>
                <p className="mt-2 max-w-4xl text-lg font-medium leading-7 sm:text-xl sm:leading-8 md:text-2xl">AERA helps communities move from chaos to coordinated action by giving every stakeholder the right information, at the right time, in the right format.</p>
            </div>
          </section>

            <section className="space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-300">Feature matrix</p>
                <h3 className="text-2xl font-semibold text-white md:text-3xl">What AERA does, why it matters, and what it changes</h3>
              </div>
            </div>

              <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
              {featureRows.map((row) => (
                  <article key={row.feature} className="group rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.86),rgba(15,23,42,0.62))] p-4 shadow-lg shadow-slate-950/20 transition duration-200 hover:-translate-y-1 hover:border-sky-400/30 hover:shadow-sky-950/20 sm:p-5">
                    <div className="mb-4 flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <p className="text-base font-semibold leading-6 text-white sm:text-lg">{row.feature}</p>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-200">AERA</span>
                  </div>
                    <div className="mt-4 space-y-3 text-sm leading-6">
                    <div className="rounded-2xl bg-white/[0.03] p-3">
                      <p className="font-semibold text-amber-300">Advantage</p>
                      <p className="text-slate-300">{row.advantage}</p>
                    </div>
                    <div className="rounded-2xl bg-white/[0.03] p-3">
                      <p className="font-semibold text-emerald-300">Benefit</p>
                      <p className="text-slate-300">{row.benefit}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-lg shadow-slate-950/20 sm:p-6 md:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-purple-300">Why AERA stands out</p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {standoutSections.map((section) => (
                  <div key={section.title} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 transition hover:border-purple-400/30 hover:bg-slate-900/85">
                    <h4 className="text-base font-semibold text-white sm:text-lg">{section.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{section.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-amber-400/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.14),rgba(245,158,11,0.06))] p-5 shadow-lg shadow-amber-950/10 sm:p-6 md:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-300">Bottom line</p>
              <h4 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">From fragmented reaction to coordinated action.</h4>
              <p className="mt-4 text-sm leading-6 text-amber-50/90 sm:leading-7">
                By combining structured intake, offline resilience, role-based coordination, community hub operations, logistics visibility, and recovery support, AERA helps communities respond faster, protect vulnerable households, and recover with greater confidence.
              </p>
            </div>
          </section>

          <section className="space-y-4 pb-10">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-300">Stakeholder benefits</p>
              <h3 className="text-2xl font-semibold text-white md:text-3xl">Clear value for every participant in the response chain</h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {stakeholderBenefits.map((group) => (
                <article key={group.title} className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(30,41,59,0.72))] p-5 shadow-lg shadow-slate-950/20">
                  <h4 className="text-base font-semibold text-white sm:text-lg">{group.title}</h4>
                  <ul className="mt-4 space-y-2 text-sm text-slate-300">
                    {group.items.map((item) => (
                      <li key={item} className="flex gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-300" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
