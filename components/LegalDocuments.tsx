import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const Section: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/5 last:border-0">
      <button onClick={() => setOpen(!open)} className="w-full flex justify-between items-center py-3 text-sm font-bold text-gray-300 hover:text-white transition">
        {title}
        {open ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
      </button>
      {open && <div className="pb-4 text-xs text-gray-400 leading-relaxed space-y-3">{children}</div>}
    </div>
  );
};

export const PrivacyPolicy: React.FC = () => (
  <div className="space-y-0">
    <div className="mb-4">
      <p className="text-xs text-gray-500">Last updated: June 22, 2026</p>
    </div>

    <Section title="1. Information We Collect" defaultOpen={true}>
      <p>We collect the following types of information:</p>
      <ul className="list-disc pl-4 space-y-1">
        <li><strong className="text-gray-300">Account Information:</strong> Email address and username when you create an account via Firebase Authentication.</li>
        <li><strong className="text-gray-300">Location Data:</strong> Approximate and/or precise location data (with your permission) to provide location-based features such as nearby places, weather, and city exploration.</li>
        <li><strong className="text-gray-300">Usage Data:</strong> App usage patterns, feature interactions, and crash reports collected via Firebase Analytics and Crashlytics.</li>
        <li><strong className="text-gray-300">Device Information:</strong> Device identifiers, operating system, browser type, and IP address.</li>
        <li><strong className="text-gray-300">Payment Information:</strong> Subscription and payment data processed securely by Stripe. We do not store your full credit card details.</li>
      </ul>
    </Section>

    <Section title="2. How We Use Your Information">
      <ul className="list-disc pl-4 space-y-1">
        <li>To provide and maintain app functionality (flight tracking, weather, trip planning)</li>
        <li>To authenticate your account and sync data across devices</li>
        <li>To provide location-based features (nearby places, maps, weather)</li>
        <li>To improve app performance and fix bugs</li>
        <li>To process subscription payments</li>
        <li>To send email verification and account-related communications</li>
      </ul>
    </Section>

    <Section title="3. Third-Party Services & Data Sharing">
      <p>We integrate with the following third-party services that may collect or process data:</p>
      <ul className="list-disc pl-4 space-y-1.5">
        <li><strong className="text-gray-300">Google Firebase:</strong> Authentication, database (Firestore), analytics, and hosting.</li>
        <li><strong className="text-gray-300">Google Maps Platform:</strong> Maps, places, and location services. Subject to <a href="https://maps.google.com/help/terms_maps.html" target="_blank" rel="noopener noreferrer" className="text-brand-orange hover:underline">Google Maps Additional Terms</a> and <a href="https://www.google.com/policies/privacy/" target="_blank" rel="noopener noreferrer" className="text-brand-orange hover:underline">Google Privacy Policy</a>.</li>
        <li><strong className="text-gray-300">Google Gemini AI:</strong> AI-powered features (Apollo AI). Conversations are processed by Google's Gemini models.</li>
        <li><strong className="text-gray-300">FlightAware AeroAPI:</strong> Real-time and historical flight data.</li>
        <li><strong className="text-gray-300">OpenWeatherMap:</strong> Weather forecasts and conditions.</li>
        <li><strong className="text-gray-300">ipapi.co:</strong> IP-based geolocation to automatically detect your current city.</li>
        <li><strong className="text-gray-300">Stripe:</strong> Secure payment processing for subscriptions.</li>
        <li><strong className="text-gray-300">Stay22 (Affiliate Partner):</strong> We participate in affiliate marketing programs. These services use tracking technologies to attribute hotel and travel bookings originating from our app.</li>
      </ul>
      <p className="mt-2">For more information on how Google uses data from apps that use their services, visit: <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer" className="text-brand-orange hover:underline">Google Partner Sites Policy</a>.</p>
    </Section>

    <Section title="4. Cookies & Tracking Technologies">
      <p>We and our third-party partners use cookies, mobile advertising identifiers (IDFA/GAID), and similar technologies to:</p>
      <ul className="list-disc pl-4 space-y-1">
        <li>Maintain your authentication session</li>
        <li>Collect usage analytics</li>
        <li>Track affiliate referrals for travel and hotel bookings</li>
        <li>Remember your preferences</li>
      </ul>
    </Section>

    <Section title="5. Your Rights & Choices">
      <p>Depending on your location, you may have the following rights:</p>
      <ul className="list-disc pl-4 space-y-1">
        <li><strong className="text-gray-300">Access:</strong> Request a copy of the personal data we hold about you.</li>
        <li><strong className="text-gray-300">Correction:</strong> Request correction of inaccurate personal data.</li>
        <li><strong className="text-gray-300">Deletion:</strong> Request deletion of your account and associated data.</li>
        <li><strong className="text-gray-300">Opt-out:</strong> Opt out of personalized advertising.</li>
        <li><strong className="text-gray-300">Data Portability:</strong> Request your data in a machine-readable format (GDPR).</li>
        <li><strong className="text-gray-300">Withdraw Consent:</strong> Withdraw consent for data processing at any time (GDPR).</li>
        <li><strong className="text-gray-300">Do Not Sell:</strong> California residents may opt out of data sales under CCPA/CPRA.</li>
      </ul>
      <p className="mt-2">To exercise any of these rights, contact us at <a href="mailto:admin@cavecoredynamics.org" className="text-brand-orange hover:underline">admin@cavecoredynamics.org</a>.</p>
    </Section>

    <Section title="6. Data Retention & Deletion">
      <p>We retain your account data for as long as your account is active. Upon account deletion:</p>
      <ul className="list-disc pl-4 space-y-1">
        <li>Your Firebase Authentication record is permanently deleted.</li>
        <li>Your Firestore profile and saved trips are permanently deleted within 30 days.</li>
        <li>Anonymized analytics data may be retained for app improvement.</li>
      </ul>
    </Section>

    <Section title="7. Security">
      <p>We use industry-standard security measures including encryption in transit (TLS/SSL), Firebase security rules, and secure authentication protocols. No method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.</p>
    </Section>

    <Section title="8. Children's Privacy">
      <p>ÜrTC is intended for users aged 13 and older. We do not knowingly collect personal information from children under 13. If we learn we have collected data from a child under 13, we will delete it promptly. If you believe your child has provided us with personal information, contact us at <a href="mailto:admin@cavecoredynamics.org" className="text-brand-orange hover:underline">admin@cavecoredynamics.org</a>.</p>
    </Section>

    <Section title="9. Changes to This Policy">
      <p>We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy within the app and updating the "Last updated" date. Your continued use of the app after changes constitutes acceptance of the updated policy.</p>
    </Section>

    <Section title="10. Contact Us">
      <p>If you have questions about this Privacy Policy, contact us at:</p>
      <div className="mt-2 bg-white/5 p-3 rounded-xl">
        <p className="font-bold text-gray-300">Cave Core Dynamics™</p>
        <p>3060 Mercer University Dr Ste 110 #951</p>
        <p><a href="mailto:admin@cavecoredynamics.org" className="text-brand-orange hover:underline">admin@cavecoredynamics.org</a></p>
      </div>
    </Section>
  </div>
);

export const TermsOfService: React.FC = () => (
  <div className="space-y-0">
    <div className="mb-4">
      <p className="text-xs text-gray-500">Last updated: June 22, 2026</p>
    </div>

    <Section title="1. Acceptance of Terms" defaultOpen={true}>
      <p>By accessing or using ÜrTC ("the App"), you agree to be bound by these Terms of Service. If you do not agree, do not use the App. The App is operated by Cave Core Dynamics™ ("we", "us", "our").</p>
    </Section>

    <Section title="2. Description of Service">
      <p>ÜrTC is an AI-powered travel companion application that provides flight tracking, city exploration, trip planning, budget management, and AI assistant features. The App uses Google Maps features and content, subject to the <a href="https://maps.google.com/help/terms_maps.html" target="_blank" rel="noopener noreferrer" className="text-brand-orange hover:underline">Google Maps/Google Earth Additional Terms of Service</a> and the <a href="https://www.google.com/policies/privacy/" target="_blank" rel="noopener noreferrer" className="text-brand-orange hover:underline">Google Privacy Policy</a>.</p>
    </Section>

    <Section title="3. User Accounts">
      <ul className="list-disc pl-4 space-y-1">
        <li>You must be at least 13 years old to create an account.</li>
        <li>You are responsible for maintaining the security of your account credentials.</li>
        <li>You agree to provide accurate information during registration.</li>
        <li>We reserve the right to suspend or terminate accounts that violate these Terms.</li>
      </ul>
    </Section>

    <Section title="4. Subscriptions & Payments">
      <ul className="list-disc pl-4 space-y-1">
        <li>The App offers free (Silver) and paid (Diamond, Professional) tiers.</li>
        <li>Paid subscriptions are processed securely by Stripe.</li>
        <li>Subscriptions auto-renew unless cancelled before the renewal date.</li>
        <li>Refunds are handled according to the applicable app store's refund policy or Stripe's policies.</li>
        <li>We reserve the right to change pricing with 30 days' notice.</li>
      </ul>
    </Section>

    <Section title="5. AI Features & Disclaimer">
      <p>Apollo AI features are powered by Google's Gemini models. AI-generated content is provided for informational purposes only and may contain inaccuracies. You should independently verify all travel information, flight data, and recommendations before making decisions. We are not liable for actions taken based on AI-generated content.</p>
    </Section>

    <Section title="6. Data Sources & Accuracy">
      <ul className="list-disc pl-4 space-y-1">
        <li>Flight data is provided by FlightAware® AeroAPI and may experience delays.</li>
        <li>Weather data is provided by OpenWeatherMap and may not reflect real-time conditions.</li>
        <li>Maps and places data is provided by Google Maps Platform.</li>
        <li>We do not guarantee the accuracy, completeness, or timeliness of any third-party data.</li>
      </ul>
    </Section>

    <Section title="7. Advertisements & Affiliate Links">
      <p>Free and Silver tier users will see advertisements served by Google AdMob/AdSense. The App may also display affiliate links to third-party travel services (hotels, rental cars, insurance, etc.). We may earn commissions from affiliate purchases. Affiliate recommendations are clearly identified and do not constitute endorsement.</p>
    </Section>

    <Section title="8. Intellectual Property">
      <p>All content, design, branding, and code in ÜrTC is the intellectual property of Cave Core Dynamics™. You may not copy, modify, distribute, or reverse-engineer the App without written permission. Third-party trademarks (Google Maps, FlightAware, etc.) belong to their respective owners.</p>
    </Section>

    <Section title="9. Limitation of Liability">
      <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, CAVE CORE DYNAMICS™ SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE APP. Our total liability shall not exceed the amount you paid for the App in the preceding 12 months.</p>
    </Section>

    <Section title="10. Termination">
      <p>We may terminate or suspend your access to the App at any time for any reason. Upon termination, your right to use the App ceases immediately. You may delete your account at any time through the App settings.</p>
    </Section>

    <Section title="11. Changes to Terms">
      <p>We reserve the right to modify these Terms at any time. Material changes will be communicated within the App. Continued use after changes constitutes acceptance.</p>
    </Section>

    <Section title="12. Contact">
      <div className="bg-white/5 p-3 rounded-xl">
        <p className="font-bold text-gray-300">Cave Core Dynamics™</p>
        <p>3060 Mercer University Dr Ste 110 #951</p>
        <p><a href="mailto:admin@cavecoredynamics.org" className="text-brand-orange hover:underline">admin@cavecoredynamics.org</a></p>
      </div>
    </Section>
  </div>
);
