import React, { useEffect } from 'react';
import { UserProfile } from '../../../types';
import { Card } from '../../../components/Card';
import { LoginView } from '../../../views/LoginView';
import { RegistrationView } from '../../../views/RegistrationView';
import { DashboardView } from '../../../views/DashboardView';
import { HelpFormView } from '../../../views/HelpFormView';
import { OrgDashboardView } from '../../../views/OrgDashboardView';
import { AlertsView } from '../../../views/AlertsView';
import { RecoveryView } from '../../../views/RecoveryView';
import { SettingsView } from '../../../views/SettingsView';
import { BuildKitView } from '../../../views/BuildKitView';
import { PopulationView } from '../../../views/PopulationView';
import { LogisticsView } from '../../../views/LogisticsView';
import { presentationProfiles } from '../demoData';
import { usePresentationDemo } from '../PresentationDemoProvider';
import { PlaceholderPanel } from './PlaceholderPanel';
import { TitleSlide } from './TitleSlide';

export type SlideStatus = 'LIVE' | 'NEXT';

export type PresentationSlide = {
  id: number;
  section?: string;
  title: string;
  speakerNote?: string;
  status: SlideStatus;
  content: React.ReactNode;
  lockInteraction?: boolean;
  scale?: number;
};

const noOpSetView = () => undefined;

const ProfileContext: React.FC<{ profile: UserProfile; children: React.ReactNode }> = ({ profile, children }) => {
  const { setActiveDemoProfile } = usePresentationDemo();

  useEffect(() => {
    setActiveDemoProfile(profile);
  }, [profile, setActiveDemoProfile]);

  return <>{children}</>;
};

const AnnouncementOverlay: React.FC<{ text: string }> = ({ text }) => (
  <div className="absolute inset-x-6 bottom-6 z-30">
    <Card>
      <p className="text-lg font-semibold text-slate-900">{text}</p>
    </Card>
  </div>
);

const DualModelSlide: React.FC = () => {
  return (
    <div className="h-full w-full grid grid-cols-2 gap-4 p-4">
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="p-3 border-b border-slate-200 font-semibold text-slate-700">Network Org</div>
        <div className="h-[calc(100%-49px)] overflow-hidden">
          <OrgDashboardView setView={noOpSetView} initialTab="MEMBERS" communityIdOverride="NG-1001" />
        </div>
      </div>
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="p-3 border-b border-slate-200 font-semibold text-slate-700">Single Org</div>
        <div className="h-[calc(100%-49px)] overflow-hidden">
          <OrgDashboardView setView={noOpSetView} initialTab="MEMBERS" communityIdOverride="TX-HOPE-HUB-03" />
        </div>
      </div>
    </div>
  );
};

export const presentationSlides: PresentationSlide[] = [
  {
    id: 1,
    section: 'Section 1 • Activation',
    title: 'AERA Preparedness Architecture',
    speakerNote: 'AERA is preparedness architecture for churches before, during, and after disaster.',
    status: 'LIVE',
    content: <TitleSlide />,
    lockInteraction: true,
  },
  {
    id: 2,
    section: 'Section 1 • Activation',
    title: 'Step 1 — Institution Speaks First',
    speakerNote: 'Leadership activates preparedness and calls the congregation to the same operating standard.',
    status: 'NEXT',
    content: <PlaceholderPanel />,
    lockInteraction: true,
  },
  {
    id: 3,
    section: 'Section 1 • Activation',
    title: 'Step 2 — Community Code Issued',
    speakerNote: 'One institutional code creates one trusted operating identity for the entire church community.',
    status: 'LIVE',
    content: (
      <ProfileContext profile={presentationProfiles.networkAdmin}>
        <SettingsView setView={noOpSetView} />
      </ProfileContext>
    ),
    lockInteraction: true,
  },
  {
    id: 4,
    section: 'Section 1 • Activation',
    title: 'Step 3 — Relational Announcement',
    speakerNote: 'The message is social first: families are invited, not merely instructed, to prepare together.',
    status: 'LIVE',
    content: (
      <ProfileContext profile={presentationProfiles.member}>
        <div className="relative h-full w-full">
          <DashboardView setView={noOpSetView} />
          <AnnouncementOverlay text="Download AERA. Enter our Community Code." />
        </div>
      </ProfileContext>
    ),
    lockInteraction: true,
  },
  {
    id: 5,
    section: 'Section 2 • Household Onboarding',
    title: 'Step 4 — Person Entry: Login',
    speakerNote: 'Individual onboarding begins at the same entry point used in normal operations.',
    status: 'LIVE',
    content: <LoginView setView={noOpSetView} />,
    lockInteraction: true,
  },
  {
    id: 6,
    section: 'Section 2 • Household Onboarding',
    title: 'Step 5 — Person Entry: Registration',
    speakerNote: 'New users register and establish identity before household data collection begins.',
    status: 'LIVE',
    content: <RegistrationView setView={noOpSetView} mode="REGISTRATION" />,
    lockInteraction: true,
    scale: 0.92,
  },
  {
    id: 7,
    section: 'Section 2 • Household Onboarding',
    title: 'Step 6 — Household Setup',
    speakerNote: 'Preparedness-relevant attributes are captured at the household level for operational clarity.',
    status: 'LIVE',
    content: <RegistrationView setView={noOpSetView} mode="SETUP" />,
    lockInteraction: true,
    scale: 0.72,
  },
  {
    id: 8,
    section: 'Section 2 • Household Onboarding',
    title: 'Step 7 — Household Dashboard',
    speakerNote: 'After onboarding, each household has a persistent readiness and communications home.',
    status: 'LIVE',
    content: (
      <ProfileContext profile={presentationProfiles.member}>
        <DashboardView setView={noOpSetView} />
      </ProfileContext>
    ),
    lockInteraction: true,
  },
  {
    id: 9,
    section: 'Section 2 • Household Onboarding',
    title: 'Step 8 — Help Request Flow',
    speakerNote: 'Safety and need signals are submitted through a structured flow designed for triage.',
    status: 'LIVE',
    content: (
      <ProfileContext profile={presentationProfiles.member}>
        <HelpFormView setView={noOpSetView} />
      </ProfileContext>
    ),
    lockInteraction: true,
    scale: 0.92,
  },
  {
    id: 10,
    section: 'Section 2 • Household Onboarding',
    title: 'Step 9 — Preparedness Checklist',
    speakerNote: 'Build Kit completion gives leaders proactive visibility before impact.',
    status: 'LIVE',
    content: (
      <ProfileContext profile={presentationProfiles.member}>
        <BuildKitView setView={noOpSetView} />
      </ProfileContext>
    ),
    lockInteraction: true,
    scale: 0.92,
  },
  {
    id: 11,
    section: 'Section 3 • Org Operations',
    title: 'Step 10 — Org Operations Dashboard',
    speakerNote: 'Single-location leadership tracks member readiness and status from one command view.',
    status: 'LIVE',
    content: (
      <ProfileContext profile={presentationProfiles.singleOrgAdmin}>
        <OrgDashboardView setView={noOpSetView} initialTab="MEMBERS" />
      </ProfileContext>
    ),
    lockInteraction: true,
  },
  {
    id: 12,
    section: 'Section 3 • Org Operations',
    title: 'Step 11 — Preparedness Oversight',
    speakerNote: 'Preparedness tab surfaces who is ready, who is vulnerable, and where outreach is needed.',
    status: 'LIVE',
    content: (
      <ProfileContext profile={presentationProfiles.singleOrgAdmin}>
        <OrgDashboardView setView={noOpSetView} initialTab="PREPAREDNESS" />
      </ProfileContext>
    ),
    lockInteraction: true,
  },
  {
    id: 13,
    section: 'Section 3 • Org Operations',
    title: 'Step 12 — Resource and Shelter Readiness',
    speakerNote: 'Inventory visibility is live while shelter assignment remains marked for next release.',
    status: 'NEXT',
    content: (
      <ProfileContext profile={presentationProfiles.singleOrgAdmin}>
        <div className="relative h-full w-full">
          <OrgDashboardView setView={noOpSetView} initialTab="INVENTORY" />
          <div className="absolute right-6 top-20 z-30">
            <Card>
              <p className="font-semibold text-slate-900">Next Release – Feature Not Yet Implemented.</p>
              <p className="text-sm text-slate-600 mt-1">Shelter Assignment</p>
            </Card>
          </div>
        </div>
      </ProfileContext>
    ),
    lockInteraction: true,
  },
  {
    id: 14,
    section: 'Section 3 • Org Operations',
    title: 'Step 13 — Network vs Single-Location Model',
    speakerNote: 'The same workflows support both network governance and independent local operation.',
    status: 'LIVE',
    content: (
      <ProfileContext profile={presentationProfiles.networkAdmin}>
        <DualModelSlide />
      </ProfileContext>
    ),
    lockInteraction: true,
  },
  {
    id: 15,
    section: 'Section 4 • Lifecycle',
    title: 'Step 14 — Hurrican Helen Declared',
    speakerNote: 'Now we fast-forward into an actual event to show the full lifecycle under pressure.',
    status: 'LIVE',
    content: (
      <div className="h-full w-full flex items-center justify-center p-6">
        <Card className="max-w-2xl w-full">
          <p className="text-2xl font-bold text-slate-900">Let’s fast-forward. Hurrican Helen is announced.</p>
        </Card>
      </div>
    ),
    lockInteraction: true,
  },
  {
    id: 16,
    section: 'Section 4 • Lifecycle',
    title: 'Step 15 — Threat Broadcast and Mobilization',
    speakerNote: 'Alerting is live; transport dispatch is explicitly marked as next-release capability.',
    status: 'NEXT',
    content: (
      <ProfileContext profile={presentationProfiles.networkAdmin}>
        <div className="relative h-full w-full">
          <AlertsView setView={noOpSetView} />
          <div className="absolute right-6 top-20 z-30">
            <Card>
              <p className="font-semibold text-slate-900">Next Release – Feature Not Yet Implemented.</p>
              <p className="text-sm text-slate-600 mt-1">Transport Dispatch</p>
            </Card>
          </div>
        </div>
      </ProfileContext>
    ),
    lockInteraction: true,
  },
  {
    id: 17,
    section: 'Section 4 • Lifecycle',
    title: 'Step 16 — T-72 Hours: Preparedness Sweep',
    speakerNote: 'At T-72, leaders run preparedness sweeps and close critical readiness gaps.',
    status: 'LIVE',
    content: (
      <ProfileContext profile={presentationProfiles.networkAdmin}>
        <OrgDashboardView setView={noOpSetView} initialTab="PREPAREDNESS" communityIdOverride="NG-1001" />
      </ProfileContext>
    ),
    lockInteraction: true,
  },
  {
    id: 18,
    section: 'Section 4 • Lifecycle',
    title: 'Step 17 — T-24 Hours: Logistics Positioning',
    speakerNote: 'At T-24, logistics are staged and route constraints are surfaced for execution teams.',
    status: 'LIVE',
    content: (
      <ProfileContext profile={presentationProfiles.networkAdmin}>
        <LogisticsView setView={noOpSetView} />
      </ProfileContext>
    ),
    lockInteraction: true,
  },
  {
    id: 19,
    section: 'Section 4 • Lifecycle',
    title: 'Step 18 — Impact and Check-Ins',
    speakerNote: 'During impact, household safety and urgent requests become live operational signals.',
    status: 'LIVE',
    content: (
      <ProfileContext profile={presentationProfiles.member}>
        <HelpFormView setView={noOpSetView} />
      </ProfileContext>
    ),
    lockInteraction: true,
    scale: 0.9,
  },
  {
    id: 20,
    section: 'Section 4 • Lifecycle',
    title: 'Step 19 — +24 to +72 Hours: Population Status',
    speakerNote: 'Post-impact population status enables coordinated response and welfare accountability.',
    status: 'LIVE',
    content: (
      <ProfileContext profile={presentationProfiles.networkAdmin}>
        <PopulationView setView={noOpSetView} />
      </ProfileContext>
    ),
    lockInteraction: true,
  },
  {
    id: 21,
    section: 'Section 4 • Lifecycle',
    title: 'Step 20 — Recovery and Reporting',
    speakerNote: 'Recovery workflows continue while donation allocation remains a next-release placeholder.',
    status: 'NEXT',
    content: (
      <ProfileContext profile={presentationProfiles.networkAdmin}>
        <div className="relative h-full w-full">
          <RecoveryView setView={noOpSetView} />
          <div className="absolute right-6 top-20 z-30">
            <Card>
              <p className="font-semibold text-slate-900">Next Release – Feature Not Yet Implemented.</p>
              <p className="text-sm text-slate-600 mt-1">Donation Allocation</p>
            </Card>
          </div>
        </div>
      </ProfileContext>
    ),
    lockInteraction: true,
  },
  {
    id: 22,
    section: 'Section 5 • Scale',
    title: 'Step 21 — Community Code Control Plane',
    speakerNote: 'Community Code governance keeps operational boundaries clear as network size increases.',
    status: 'LIVE',
    content: (
      <ProfileContext profile={presentationProfiles.networkAdmin}>
        <SettingsView setView={noOpSetView} />
      </ProfileContext>
    ),
    lockInteraction: true,
  },
  {
    id: 23,
    section: 'Section 5 • Scale',
    title: 'Step 22 — Why Community Code Scales',
    speakerNote: 'One architecture supports local autonomy and national growth without changing member UX.',
    status: 'LIVE',
    content: (
      <div className="h-full w-full flex items-center justify-center p-6">
        <Card className="max-w-3xl w-full">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">One app. Thousands of community nodes.</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-slate-200 rounded-lg p-4"><p className="font-semibold text-slate-900">Church Autonomy</p><p className="text-sm text-slate-600">Each institution keeps its own operational authority.</p></div>
            <div className="border border-slate-200 rounded-lg p-4"><p className="font-semibold text-slate-900">Regional Integrity</p><p className="text-sm text-slate-600">Community codes prevent cross-region confusion.</p></div>
            <div className="border border-slate-200 rounded-lg p-4"><p className="font-semibold text-slate-900">City Multiplexing</p><p className="text-sm text-slate-600">Many churches in one city can operate in parallel.</p></div>
            <div className="border border-slate-200 rounded-lg p-4"><p className="font-semibold text-slate-900">National Scale</p><p className="text-sm text-slate-600">Network model supports parent + child expansion.</p></div>
          </div>
        </Card>
      </div>
    ),
    lockInteraction: true,
  },
  {
    id: 24,
    section: 'Section 5 • Close',
    title: 'Strategic Close',
    speakerNote: 'Churches are where people go first; AERA helps them be operational before the first knock.',
    status: 'LIVE',
    content: (
      <div className="h-full w-full flex items-center justify-center p-6">
        <Card className="max-w-2xl w-full">
          <p className="text-2xl font-bold text-slate-900 leading-snug">
            Churches are where people go first. AERA ensures they are operationally ready before the knock at the door.
          </p>
        </Card>
      </div>
    ),
    lockInteraction: true,
  },
];
