import React from 'react';

const PrivacyPolicyView: React.FC = () => (
  <div style={{ maxWidth: 700, margin: '2rem auto', padding: '2rem', background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0001' }}>
    <h1>Proof of Consent & Privacy Policy</h1>
    <p><strong>Last updated: February 7, 2026</strong></p>
    <h2>1. Data Collected</h2>
    <ul>
      <li>Location Data: Your real-time GPS location when you enable live location sharing, both when the app is in use (foreground) and when monitoring is active (background)</li>
      <li>Safety Status: Your reported safety status (safe, need help, emergency)</li>
      <li>Emergency Help Requests: Messages and details you submit when requesting assistance</li>
      <li>Account Information: Email address, name, and authentication data</li>
      <li>Household Data: Information about your household members and their safety status</li>
    </ul>
    <h2>2. How Data Is Collected</h2>
    <ul>
      <li>User Input: Information you provide when creating an account, updating your profile, or submitting help requests</li>
      <li>Device Permissions: GPS location data when you grant location access</li>
      <li>Background Services: Continuous location tracking when you activate safety monitoring (only when explicitly enabled by you)</li>
    </ul>
    <h2>3. How Data Is Used</h2>
    <ul>
      <li>Safety Monitoring: Tracking your location during active safety monitoring to enable emergency response</li>
      <li>Emergency Response Coordination: Sharing your location and status with your designated response team when you request help</li>
      <li>App Functionality: Providing core features like household tracking, inventory management, and alerts</li>
    </ul>
    <p>We do not use your data for advertising, marketing, or any purpose unrelated to emergency disaster relief.</p>
    <h2>4. Data Sharing</h2>
    <ul>
      <li>Response Team: Your real-time location and safety status are shared with members of your organization's emergency response team when you activate live location sharing or submit a help request</li>
      <li>Organization Members: Information you choose to share within your organization (such as household status updates)</li>
      <li>No Third-Party Sales: We never sell your personal data to third parties</li>
      <li>No External Sharing: Your data is not shared with advertisers or external services except as required by law</li>
    </ul>
    <h2>5. User Consent</h2>
    <ul>
      <li>Location access requires explicit permission through iOS system prompts</li>
      <li>Live location sharing requires additional in-app consent</li>
      <li>You can turn off location sharing at any time through the app</li>
      <li>You can manage permissions in your device Settings</li>
    </ul>
    <h2>6. Data Retention & Deletion</h2>
    <ul>
      <li>Active Data: Your data is retained while you have an active account</li>
      <li>Location History: Real-time location data is used for immediate emergency response and is not stored long-term</li>
      <li>Account Deletion: You can delete your account directly from the app (Settings → Delete Account) or by contacting support. All your personal data will be permanently removed within 30 days.</li>
      <li>Inactive Accounts: Accounts inactive for 2 years may be automatically deleted</li>
    </ul>
    <h2>7. User Rights</h2>
    <ul>
      <li>Access: Request a copy of your personal data</li>
      <li>Correction: Update or correct your information through the app</li>
      <li>Deletion: Request permanent deletion of your account and data</li>
      <li>Opt-Out: Disable location sharing or other features at any time</li>
    </ul>
    <h2>8. Contact Information</h2>
    <p>For privacy concerns, data requests, or account deletion:<br />
    Email: <a href="mailto:aerapp369@gmail.com">aerapp369@gmail.com</a><br />
    We will respond to all privacy-related inquiries within 7 business days.</p>
    <h2>9. Changes to This Policy</h2>
    <p>We may update this privacy policy as our services evolve. Significant changes will be communicated through the app or via email. Continued use of the app after changes constitutes acceptance of the updated policy.</p>
    <h2>Questions?</h2>
    <p>If you have any questions about this privacy policy or how we handle your data, please contact us at <a href="mailto:aerapp369@gmail.com">aerapp369@gmail.com</a></p>
  </div>
);

export default PrivacyPolicyView;
