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
            <p className="text-xs text-slate-500">Last updated: February 7, 2026</p>
          </div>
        </div>
        <div className="p-2 rounded-full bg-emerald-50 text-emerald-700">
          <ShieldCheck size={20} />
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">1. Data Collected</h2>
        <p className="text-sm text-slate-600">AERA collects the following information to provide emergency disaster relief services:</p>
        <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
          <li>Location Data: Your real-time GPS location when you enable live location sharing, both when the app is in use (foreground) and when monitoring is active (background)</li>
          <li>Safety Status: Your reported safety status (safe, need help, emergency)</li>
          <li>Emergency Help Requests: Messages and details you submit when requesting assistance</li>
          <li>Account Information: Email address, name, and authentication data</li>
          <li>Household Data: Information about your household members and their safety status</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">2. How Data Is Collected</h2>
        <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
          <li>User Input: Information you provide when creating an account, updating your profile, or submitting help requests</li>
          <li>Device Permissions: GPS location data when you grant location access</li>
          <li>Background Services: Continuous location tracking when you activate safety monitoring (only when explicitly enabled by you)</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">3. How Data Is Used</h2>
        <p className="text-sm text-slate-600">Your data is used exclusively for:</p>
        <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
          <li>Safety Monitoring: Tracking your location during active safety monitoring to enable emergency response</li>
          <li>Emergency Response Coordination: Sharing your location and status with your designated response team when you request help</li>
          <li>App Functionality: Providing core features like household tracking, inventory management, and alerts</li>
        </ul>
        <p className="text-sm text-slate-700">We do not use your data for advertising, marketing, or any purpose unrelated to emergency disaster relief.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">4. Data Sharing</h2>
        <p className="text-sm text-slate-600">Your data is shared only as follows:</p>
        <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
          <li>Response Team: Your real-time location and safety status are shared with members of your organization's emergency response team when you activate live location sharing or submit a help request</li>
          <li>Organization Members: Information you choose to share within your organization (such as household status updates)</li>
          <li>No Third-Party Sales: We never sell your personal data to third parties</li>
          <li>No External Sharing: Your data is not shared with advertisers or external services except as required by law</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">5. User Consent</h2>
        <p className="text-sm text-slate-600">You are in control of your data:</p>
        <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
          <li>Location access requires explicit permission through iOS system prompts</li>
          <li>Live location sharing requires additional in-app consent</li>
          <li>You can turn off location sharing at any time through the app</li>
          <li>You can manage permissions in your device Settings</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">6. Data Retention &amp; Deletion</h2>
        <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
          <li>Active Data: Your data is retained while you have an active account</li>
          <li>Location History: Real-time location data is used for immediate emergency response and is not stored long-term</li>
          <li>Account Deletion: You can delete your account directly from the app (Settings → Delete Account) or by contacting support. All your personal data will be permanently removed within 30 days.</li>
          <li>Inactive Accounts: Accounts inactive for 2 years may be automatically deleted</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">7. User Rights</h2>
        <p className="text-sm text-slate-600">You have the right to:</p>
        <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
          <li>Access: Request a copy of your personal data</li>
          <li>Correction: Update or correct your information through the app</li>
          <li>Deletion: Request permanent deletion of your account and data</li>
          <li>Opt-Out: Disable location sharing or other features at any time</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">8. Contact Information</h2>
        <p className="text-sm text-slate-700">For privacy concerns, data requests, or account deletion:</p>
        <p className="text-sm text-slate-700">Email: aerapp369@gmail.com</p>
        <p className="text-sm text-slate-700">We will respond to all privacy-related inquiries within 7 business days.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">9. Changes to This Policy</h2>
        <p className="text-sm text-slate-700">We may update this privacy policy as our services evolve. Significant changes will be communicated through the app or via email. Continued use of the app after changes constitutes acceptance of the updated policy.</p>
        <p className="text-sm text-slate-700">Questions? If you have any questions about this privacy policy or how we handle your data, please contact us at aerapp369@gmail.com</p>
      </section>
    </div>
  );
};
