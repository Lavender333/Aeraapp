import React from 'react';
import { ViewState } from '../types';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

interface PrivacyPolicyViewProps {
  setView: (view: ViewState) => void;
}

export const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = ({ setView }) => {
  const returnView = (sessionStorage.getItem('privacyReturnView') as ViewState) || 'SETTINGS';

  return (
    <div className="p-6 pb-28 space-y-6 animate-fade-in bg-white min-h-screen">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView(returnView)}
            className="p-2 -ml-2 text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Proof of Consent & Privacy Policy</h1>
            <p className="text-xs text-slate-500">Last updated: February 8, 2026</p>
          </div>
        </div>
        <div className="p-2 rounded-full bg-emerald-50 text-emerald-700">
          <ShieldCheck size={20} />
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">1. Data Collected</h2>
        <p className="text-sm text-slate-600">AERA collects the following information to support safety awareness and disaster-related assistance:</p>
        <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
          <li>Location Data: Your real-time GPS location when you explicitly enable live location sharing, including when the app is in use (foreground) or when safety monitoring is active (background)</li>
          <li>Safety Status: Your self-reported status (e.g., safe, need help, emergency)</li>
          <li>Emergency Help Requests: Information you voluntarily submit when requesting assistance</li>
          <li>Account Information: Name, email address, and authentication details</li>
          <li>Household Data: Information you choose to provide about household members and their safety status</li>
          <li>Emergency Contact Information: Contact details for the emergency contact you designate</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">2. How Data Is Collected</h2>
        <p className="text-sm text-slate-600">Data is collected only through the following user-initiated methods:</p>
        <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
          <li>User Input: Information you provide when creating an account, updating your profile, managing household details, or submitting a help request</li>
          <li>Device Permissions: Location data collected only after you grant permission through your device settings</li>
          <li>Background Services: Continuous location tracking occurs only when you explicitly activate safety monitoring features</li>
        </ul>
        <p className="text-sm text-slate-700">AERA does not collect location data without your direct action or consent.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">3. How Data Is Used</h2>
        <p className="text-sm text-slate-600">Your data is used solely to operate and support AERA’s safety-related features, including:</p>
        <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
          <li>Safety Monitoring: Displaying your location during active monitoring sessions that you initiate</li>
          <li>Assistance Coordination: Facilitating situational awareness and communication when you request help</li>
          <li>App Functionality: Enabling features such as household safety tracking, alerts, and inventory tools</li>
        </ul>
        <p className="text-sm text-slate-700">AERA does not use your data for advertising, marketing, profiling, or any purpose unrelated to safety or disaster-related support.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">4. Data Sharing</h2>
        <p className="text-sm text-slate-600">Your information is shared only in the following user-directed circumstances:</p>
        <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
          <li>Organization Administrator: Information you submit (including safety status, location during active sharing, and help requests) may be viewed by the administrator of the organization you choose to connect to within AERA.</li>
          <li>AERA may send notifications or messages via text or in-app to your organization administrator as part of safety monitoring or help requests.</li>
          <li>Emergency Contact: Your safety status and relevant information may be shared with the emergency contact you designate.</li>
          <li>AERA may send notifications or messages via text or in-app to your emergency contact to inform them of your status or requests for help.</li>
          <li>Organization Visibility: Information you choose to share (such as household or status updates) may be visible to members of your connected organization, based on your actions and settings.</li>
          <li>AERA does not sell personal data, does not share data with advertisers, and does not share data with external third parties except where required by law.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">5. User Consent &amp; Control</h2>
        <p className="text-sm text-slate-600">You remain in control of your information at all times:</p>
        <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
          <li>Location access requires explicit permission through system prompts</li>
          <li>Live location sharing requires additional in-app action</li>
          <li>You may disable location sharing at any time</li>
          <li>Permissions can be managed through your device settings</li>
          <li>You choose which organization to connect to and which emergency contact to designate</li>
          <li>You consent to messages or notifications sent to your emergency contact or organization administrator as described above</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">6. Data Retention &amp; Deletion</h2>
        <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
          <li>Active Accounts: Data is retained while your account remains active</li>
          <li>Location Data: Real-time location data is used to support active safety features and is not retained beyond operational or safety-related needs</li>
          <li>Account Deletion: You may delete your account at any time through the app (Settings → Delete Account) or by contacting support. Personal data will be permanently removed within 30 days</li>
          <li>Inactive Accounts: Accounts inactive for two (2) years may be automatically deleted</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">7. Your Rights</h2>
        <p className="text-sm text-slate-600">You have the right to:</p>
        <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
          <li>Access: Request a copy of your personal data</li>
          <li>Correction: Update or correct your information through the app</li>
          <li>Deletion: Request permanent deletion of your account and associated data</li>
          <li>Opt-Out: Disable optional features, including location sharing, at any time</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">8. Children’s Information</h2>
        <p className="text-sm text-slate-700">AERA may process limited information about minors only when provided by a parent or legal guardian as part of household safety features.</p>
        <p className="text-sm text-slate-700">AERA does not knowingly collect personal data directly from children without parental involvement.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">9. Data Security</h2>
        <p className="text-sm text-slate-700">AERA uses reasonable administrative, technical, and organizational measures designed to protect personal information from unauthorized access, misuse, or disclosure.</p>
        <p className="text-sm text-slate-700">No system is completely secure, and AERA cannot guarantee absolute security.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">10. Emergency Disclaimer &amp; Limitation of Responsibility</h2>
        <p className="text-sm text-slate-700">AERA is a safety-support and information-sharing platform. AERA does not provide emergency, medical, or rescue services and does not guarantee any specific outcome.</p>
        <p className="text-sm text-slate-700">You acknowledge that AERA is not responsible for the actions, inactions, or response times of organization administrators, emergency contacts, emergency services, or any third parties.</p>
        <p className="text-sm text-slate-700">In the event of an immediate or life-threatening emergency, you are responsible for contacting local emergency services (such as 911).</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">11. Service Availability</h2>
        <p className="text-sm text-slate-700">AERA’s services may be interrupted, delayed, or unavailable due to factors outside of our control, including network issues, device limitations, system outages, or maintenance.</p>
        <p className="text-sm text-slate-700">Availability of the app does not guarantee delivery of assistance.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">12. HIPAA Notice</h2>
        <p className="text-sm text-slate-700">AERA is not a “covered entity” or “business associate” as defined under the Health Insurance Portability and Accountability Act (HIPAA).</p>
        <p className="text-sm text-slate-700">Information collected through AERA is not considered protected health information (PHI) under HIPAA.</p>
        <p className="text-sm text-slate-700">While AERA takes privacy and data protection seriously, the app should not be used as a substitute for professional medical services or emergency care.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">13. No Professional Services</h2>
        <p className="text-sm text-slate-700">Information provided through AERA is for informational and coordination purposes only and does not constitute medical, legal, or emergency advice.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">14. Governing Law</h2>
        <p className="text-sm text-slate-700">This policy is governed by and interpreted in accordance with the laws of the jurisdiction in which AERA operates, without regard to conflict-of-law principles.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">15. International Use</h2>
        <p className="text-sm text-slate-700">If you access AERA from outside the United States, you acknowledge that your information may be processed and stored in the United States or other jurisdictions where data protection laws may differ.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">16. Contact Information</h2>
        <p className="text-sm text-slate-700">For privacy questions, data requests, or account deletion:</p>
        <p className="text-sm text-slate-700">Email: aerapp369@gmail.com</p>
        <p className="text-sm text-slate-700">We aim to respond to privacy-related inquiries within 7 business days.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">17. Changes to This Policy</h2>
        <p className="text-sm text-slate-700">This policy may be updated as AERA evolves. Material changes will be communicated through the app or via email. Continued use of the app after updates indicates acceptance of the revised policy.</p>
      </section>
    </div>
  );
};
