import React, { useState } from 'react';
import { Info, Shield, Star, Crown, Lock, CreditCard, Type, User, LogOut, Code, CheckCircle, Settings, FileText, Check, X, ArrowRight, Gauge, Loader2, Users, Building, Globe, AlertTriangle } from 'lucide-react';
import { UserTier, UserAccount } from '../types';
import { LoginView } from './auth/LoginView';
import { RegisterView } from './auth/RegisterView';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { redeemAccessCode, logout, getActiveUser, setStatsForNerds, updateUserTier } from '../services/authService';
import { useLanguage } from '../i18n/context';
import { PrivacyPolicy as PrivacyPolicyDoc, TermsOfService as TermsOfServiceDoc } from './LegalDocuments';

const stripePromise = loadStripe('pk_live_51TUeysRqoflFtIgs5AqotIPRZ1Q6sWjxcdtXeEKYhT8Au7rdYJJ8JIaTdmohYZ7028erR55De0nJ2eo3WOXB3wF500XZknvsPh');

interface AboutViewProps {
 currentUser: UserAccount;
 onUserUpdate: (user: UserAccount) => void;
 textSize: 'sm' | 'base' | 'lg';
 onTextSizeChange: (size: 'sm' | 'base' | 'lg') => void;
}

export const AboutView: React.FC<AboutViewProps> = React.memo(({ currentUser, onUserUpdate, textSize, onTextSizeChange }) => {
 const { language, setLanguage, t } = useLanguage();
 const [activeTab, setActiveTab] = useState<'access' | 'settings' | 'info'>('access');
 const [showLogin, setShowLogin] = useState(false);
 const [showRegister, setShowRegister] = useState(false);
 const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
 const [accessCode, setAccessCode] = useState('');
 const [codeError, setCodeError] = useState('');

 const [showContactForm, setShowContactForm] = useState(false);
 const [contactEmail, setContactEmail] = useState('');
 const [contactSubject, setContactSubject] = useState('Small Business Inquiry');
 const [contactSent, setContactSent] = useState(false);

 const [showCancelModal, setShowCancelModal] = useState(false);
 const [cancelReason, setCancelReason] = useState('Too expensive');
 const [cancelFeedback, setCancelFeedback] = useState('');

 const [showPrivacy, setShowPrivacy] = useState(false);
 const [showTerms, setShowTerms] = useState(false);

  const handleLogout = async () => {
    await logout();
    onUserUpdate(getActiveUser()); // Reset to Guest
  };

 const handleCodeRedeem = () => {
    try {
        const newUser = redeemAccessCode(accessCode);
        onUserUpdate(newUser);
        setAccessCode('');
        setCodeError('');
    } catch (e) {
        setCodeError('Invalid Access Code');
    }
 };

 const handleCancelSubscription = () => {
    // Simulate local downgrade (In-App Cancellation)
    const downgradedUser = { ...currentUser, tier: UserTier.Free };
    onUserUpdate(downgradedUser);
    setShowCancelModal(false);
    setSelectedPlan(null);
    alert('Your subscription has been successfully cancelled.');
 };

 // Attach the user's identity to a Stripe Payment Link so the webhook
 // can upgrade the right account the moment payment completes.
 const checkoutUrl = (base: string) => {
    if (!currentUser?.id || currentUser.id.startsWith('guest')) return base;
    const params = new URLSearchParams({ client_reference_id: currentUser.id });
    if (currentUser.email) params.set('prefilled_email', currentUser.email);
    return `${base}?${params.toString()}`;
 };

 const getFeatures = (tier: string) => {
    switch (tier) {
        case UserTier.Guest:
            return [
                "Live flight tracking — search any flight, airport, route, or tail number",
                "Airport departure boards & delay alerts",
                "Explore nearby food & attractions with live weather",
                "Apollo AI travel companion (15 messages)",
                "Ad-supported"
            ];
        case UserTier.Free:
            return [
                "Everything in Bronze",
                "Live flight maps with weather radar",
                "Trip planning with itineraries & budgets",
                "Save flights & places to your trips",
                "Trips synced across all your devices",
                "Apollo AI travel companion (15 messages/day)",
                "Ad-supported"
            ];
        case UserTier.Diamond:
            return [
                "Everything in Silver — with zero ads",
                "Unlimited Apollo AI chat + Live Voice mode",
                "AI-predicted departure & arrival times",
                "Smart Budgeting — AI builds your trip budget",
                "AI Smart Notes & your Digital Flight Bag",
                "Real-time flight alerts (delays, gates, cancellations)",
                "Shared trip planning for up to 5 people",
                "Family budget sync",
                "First access to new features"
            ];
        case UserTier.Professional:
            return [
                "All Diamond Features",
                "Enterprise Dashboards",
                "Priority Support",
                "Crew Badge",
                "API Integrations",
                "Dedicated Account Manager",
                "Custom Deployment"
            ];
        default: return [];
    }
 };

 const renderCard = (tier: string, title: string, price: string, colorClass: string, icon: React.ReactNode, isActive: boolean) => (
    <div 
        onClick={() => setSelectedPlan(tier)}
        className={`relative overflow-hidden rounded-2xl p-6 border transition-all duration-300 cursor-pointer group ${isActive ? 'border-white/50 shadow-2xl scale-[1.02]' : 'border-transparent opacity-80 hover:opacity-100 hover:scale-[1.01] hover:border-white/10'} ${colorClass}`}
    >
        <div className="relative z-10 flex justify-between items-start">
            <div>
                <h3 className="text-2xl font-black italic tracking-tighter text-white">{title}</h3>
                <p className="text-sm font-bold text-white/80">{price}</p>
                {isActive ? (
                    <div className="mt-2 inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase"><CheckCircle size={10} /> Active Plan</div>
                ) : (
                    <div className="mt-2 inline-flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded text-[10px] font-bold text-white/70 uppercase group-hover:bg-white/20 transition-colors">Tap for details</div>
                )}
            </div>
            <div className="text-white/90 transform group-hover:scale-110 transition-transform duration-300">{icon}</div>
        </div>
        {/* Shimmer Effect for Gold/Crew */}
        {(tier === UserTier.Diamond || tier === UserTier.Professional) && <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent skew-x-12 animate-shimmer pointer-events-none"></div>}
    </div>
 );

 return (
   <div className="h-full flex flex-col pb-24 animate-in fade-in">
     {/* Tab Navigation */}
     <div className="px-6 pt-2 pb-4">
         <div className="flex p-1 bg-gray-200 dark:bg-white/5 rounded-xl border border-gray-300 dark:border-white/10">
            <button onClick={() => setActiveTab('access')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${activeTab === 'access' ? 'bg-white dark:bg-[#151921] text-brand-orange shadow' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}><CreditCard size={14}/> Subscriptions</button>
            <button onClick={() => setActiveTab('settings')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${activeTab === 'settings' ? 'bg-white dark:bg-[#151921] text-brand-orange shadow' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}><Settings size={14}/> Settings</button>
            <button onClick={() => setActiveTab('info')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${activeTab === 'info' ? 'bg-white dark:bg-[#151921] text-brand-orange shadow' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}><FileText size={14}/> Info</button>
         </div>
     </div>

     <div className="px-6 flex-1 overflow-y-auto scrollbar-hide">
         {/* TAB 1: ACCESS & PLANS */}
         {activeTab === 'access' && (
             <div className="space-y-6">
                 {/* Current User Header */}
                 <div className="flex items-center justify-between">
                     <div>
                         <h2 className="text-xl font-bold text-gray-900 dark:text-white">Your Subscriptions</h2>
                         <p className="text-xs text-gray-500">Current Status: <span className="text-brand-orange font-bold uppercase">{currentUser.tier}</span></p>
                     </div>
                     {currentUser.tier !== UserTier.Guest ? (
                         <button onClick={handleLogout} className="text-xs font-bold text-red-500 flex items-center gap-1 bg-red-500/10 px-3 py-1.5 rounded-full hover:bg-red-500 hover:text-white transition"><LogOut size={12} /> Logout</button>
                     ) : (
                         <button onClick={() => setShowLogin(true)} className="text-xs font-bold text-brand-blue flex items-center gap-1 bg-brand-blue/10 px-3 py-1.5 rounded-full hover:bg-brand-blue hover:text-white transition"><User size={12} /> Login</button>
                     )}
                 </div>
                 
                 {/* Tier Cards Stack */}
                 <div className="space-y-4">
                     {renderCard(UserTier.Guest, "BRONZE", "Guest", "bg-gradient-to-br from-[#CD7F32] to-[#8B4513]", <Shield size={32} />, currentUser.tier === UserTier.Guest)}
                     {renderCard(UserTier.Free, "SILVER", "Standard", "bg-gradient-to-br from-[#C0C0C0] to-[#708090]", <User size={32} />, currentUser.tier === UserTier.Free)}

                     {/* Diamond Unified Modal Trigger */}
                     {renderCard(UserTier.Diamond, "DIAMOND", "Diamond", "bg-gradient-to-br from-[#E0FFFF] via-[#8DE2FF] to-[#3AB0FF]", <Star size={32} fill="white" />, currentUser.tier === UserTier.Diamond)}

                     {/* Professional Trigger */}
                     {renderCard(UserTier.Professional, "PROFESSIONAL", "Professional", "bg-gradient-to-br from-[#9D50BB] to-[#6E48AA]", <Crown size={32} />, currentUser.tier === UserTier.Professional)}
                 </div>

                 {/* Access Code Input */}
                 <div className="bg-gray-100 dark:bg-white/5 p-4 rounded-xl space-y-3">
                     <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                         <Code size={16} />
                         <span className="text-xs font-bold uppercase tracking-wider">Redeem Access Code</span>
                     </div>
                     <div className="flex gap-2">
                         <input 
                            type="text" 
                            placeholder="Enter Code (e.g. AB123)" 
                            className="flex-1 bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white font-mono uppercase focus:border-brand-orange outline-none"
                            value={accessCode}
                            onChange={(e) => setAccessCode(e.target.value)}
                         />
                         <button onClick={handleCodeRedeem} className="bg-brand-orange text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-orange-600 transition">Apply</button>
                     </div>
                     {codeError && <p className="text-[10px] text-red-500 font-bold">{codeError}</p>}
                 </div>
             </div>
         )}

         {/* TAB 2: SETTINGS */}
         {activeTab === 'settings' && (
             <div className="space-y-6">
                 <h2 className="text-xl font-bold text-gray-900 dark:text-white">App Preferences</h2>
                 
                 <div className="bg-white dark:bg-[#151921] p-4 rounded-2xl border border-gray-200 dark:border-white/10 space-y-4 shadow-sm">
                     
                     <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-white/10">
                        <div className="flex items-center gap-2 text-gray-700 dark:text-white"><Globe size={18}/><span className="text-sm font-bold">Language</span></div>
                        <select 
                            value={language}
                            onChange={(e) => setLanguage(e.target.value as any)}
                            className="bg-gray-100 dark:bg-black/20 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:border-brand-orange"
                        >
                            <option value="en">English</option>
                            <option value="es">Español</option>
                            <option value="fr">Français</option>
                            <option value="de">Deutsch</option>
                            <option value="zh">中文</option>
                        </select>
                     </div>

                     <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 text-gray-700 dark:text-white"><Type size={18}/><span className="text-sm font-bold">Text Size</span></div>
                        <div className="flex bg-gray-100 dark:bg-black/20 p-1 rounded-lg">
                            <button onClick={() => onTextSizeChange('sm')} className={`px-3 py-1 rounded-md text-xs font-bold transition ${textSize === 'sm' ? 'bg-white dark:bg-white/10 text-brand-orange shadow' : 'text-gray-400'}`}>A</button>
                            <button onClick={() => onTextSizeChange('base')} className={`px-3 py-1 rounded-md text-sm font-bold transition ${textSize === 'base' ? 'bg-white dark:bg-white/10 text-brand-orange shadow' : 'text-gray-400'}`}>A</button>
                            <button onClick={() => onTextSizeChange('lg')} className={`px-3 py-1 rounded-md text-lg font-bold transition ${textSize === 'lg' ? 'bg-white dark:bg-white/10 text-brand-orange shadow' : 'text-gray-400'}`}>A</button>
                        </div>
                    </div>
                </div>

                {/* Admin Settings Panel */}
                {currentUser.tier === UserTier.Dev && (
                    <div className="mt-8 space-y-4">
                        <h2 className="text-xl font-bold text-red-500 flex items-center gap-2">
                            <Shield size={20} /> Admin Settings
                        </h2>
                        <div className="bg-red-500/10 p-4 rounded-2xl border border-red-500/30 space-y-4">
                            <div className="flex flex-col gap-2">
                                <button 
                                    onClick={() => {
                                        if (window.confirm("WARNING: This will delete all local storage data. Continue?")) {
                                            localStorage.clear();
                                            window.location.reload();
                                        }
                                    }} 
                                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-xl text-sm transition"
                                >
                                    Factory Reset All App Data
                                </button>
                                <button 
                                    onClick={() => {
                                        alert("Mocking background sync pulse...");
                                        // A dummy admin action
                                    }} 
                                    className="bg-white/10 hover:bg-white/20 text-red-400 font-bold py-2 px-4 rounded-xl text-sm transition border border-red-500/30"
                                >
                                    Trigger Background Sync Pulse
                                </button>
                            </div>
                        </div>
                    </div>
                )}

             </div>
          )}

          {/* TAB 3: INFO & LEGAL */}
         {activeTab === 'info' && (
             <div className="space-y-4">
                 {/* Version Badge */}
                 <div className="flex justify-between items-center">
                     <h2 className="text-xl font-bold text-gray-900 dark:text-white">About & Legal</h2>
                     <div className="bg-brand-orange/10 text-brand-orange px-3 py-1 rounded-full text-xs font-bold border border-brand-orange/30 shadow-sm">
                         v1.1.0
                     </div>
                 </div>

                 {/* About Card */}
                 <div className="bg-white dark:bg-[#151921] p-5 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
                    <h3 className="font-bold text-white mb-3 flex items-center gap-2 text-sm"><Info size={16} className="text-brand-orange" /> About ÜrTC</h3>
                    <div className="space-y-3 text-xs text-gray-400 leading-relaxed">
                      <p>
                        <strong className="text-white">ÜrTC</strong> is built to give travelers a unified, intelligent way to track flights, plan trips, and manage money on the go.
                      </p>
                      <p>
                        We believe travel should be about the destination, not the logistics. By combining real-time flight tracking, intuitive itinerary planning, and a dedicated AI assistant into a single elegant interface, ÜrTC replaces the clutter of juggling multiple apps so you can focus on the journey.
                      </p>
                      <div className="flex items-center gap-3 pt-3 border-t border-white/5">
                        <div className="w-2 h-2 rounded-full bg-brand-orange shrink-0"></div>
                        <div><strong className="text-white text-xs">Apollo AI</strong> <span className="text-gray-500">— Your friendly travel companion 🐶</span></div>
                      </div>
                    </div>
                 </div>

                 {/* Data Sources Card */}
                 <div className="bg-white dark:bg-[#151921] p-5 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
                    <h3 className="font-bold text-white mb-3 flex items-center gap-2 text-sm"><Shield size={16} className="text-brand-blue" /> Data Sources & Credits</h3>
                    <div className="space-y-2.5 text-xs text-gray-400">
                      <div className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-orange mt-1.5 shrink-0"></div>
                        <div><strong className="text-gray-300">Flight Data</strong> — FlightAware® AeroAPI</div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-blue mt-1.5 shrink-0"></div>
                        <div><strong className="text-gray-300">Weather</strong> — <a href="https://openweathermap.org/" target="_blank" rel="noopener noreferrer" className="text-brand-orange hover:underline">OpenWeather</a></div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0"></div>
                        <div><strong className="text-gray-300">Maps & Places</strong> — Google Maps Platform</div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0"></div>
                        <div><strong className="text-gray-300">AI Assistant</strong> — Google Gemini</div>
                      </div>
                    </div>
                 </div>

                 {/* Feedback Card */}
                 <div className="bg-white dark:bg-[#151921] p-5 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
                    <h3 className="font-bold text-white mb-2 text-sm">Feedback & Support</h3>
                    <p className="text-xs text-gray-500 mb-2">Notice a bug? Have an idea? Let us know.</p>
                    <a href="mailto:admin@cavecoredynamics.org" className="text-brand-orange font-bold text-sm hover:underline">admin@cavecoredynamics.org</a>
                 </div>

                 {/* Legal Section */}
                 <div className="space-y-3">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><FileText size={14} /> Legal</h3>
                    
                    {/* Privacy Policy Accordion */}
                    <div className="bg-white dark:bg-[#151921] rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
                      <button 
                        onClick={() => setShowPrivacy(!showPrivacy)}
                        className="w-full flex justify-between items-center p-4 text-sm font-bold text-white hover:bg-white/5 transition"
                      >
                        <span className="flex items-center gap-2"><Shield size={14} className="text-brand-orange" /> Privacy Policy</span>
                        <span className="text-gray-500 text-xs">{showPrivacy ? '▲' : '▼'}</span>
                      </button>
                      {showPrivacy && (
                        <div className="px-5 pb-5 border-t border-white/5">
                          <PrivacyPolicyDoc />
                        </div>
                      )}
                    </div>

                    {/* Terms of Service Accordion */}
                    <div className="bg-white dark:bg-[#151921] rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
                      <button 
                        onClick={() => setShowTerms(!showTerms)}
                        className="w-full flex justify-between items-center p-4 text-sm font-bold text-white hover:bg-white/5 transition"
                      >
                        <span className="flex items-center gap-2"><FileText size={14} className="text-brand-blue" /> Terms of Service</span>
                        <span className="text-gray-500 text-xs">{showTerms ? '▲' : '▼'}</span>
                      </button>
                      {showTerms && (
                        <div className="px-5 pb-5 border-t border-white/5">
                          <TermsOfServiceDoc />
                        </div>
                      )}
                    </div>
                 </div>

                 {/* Copyright Footer */}
                 <div className="text-center text-[10px] text-gray-600 pt-2 pb-4">
                     <p>© 2026 Cave Core Dynamics™. All rights reserved.</p>
                     <p className="mt-1">Contains AeroAPI data © FlightAware LLC 2026.</p>
                 </div>
             </div>
         )}
     </div>

     {/* CANCEL SUBSCRIPTION MODAL */}
     {showCancelModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-[#151921] border border-red-500/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                <div className="p-6 border-b border-white/10 relative">
                    <button onClick={() => setShowCancelModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white transition"><X size={20}/></button>
                    <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2"><AlertTriangle className="text-red-500" /> Cancel Subscription</h3>
                    <p className="text-xs text-gray-400">We're sorry to see you go. Please let us know why you are cancelling.</p>
                </div>
                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Reason for Cancellation</label>
                        <select 
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-red-500 transition-colors"
                        >
                            <option value="Too expensive">Too expensive</option>
                            <option value="Not traveling enough">Not traveling enough right now</option>
                            <option value="Missing features">Missing features I need</option>
                            <option value="Found a better alternative">Found a better alternative</option>
                            <option value="Technical issues/Bugs">Technical issues / Bugs</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Additional Feedback</label>
                        <textarea 
                            value={cancelFeedback}
                            onChange={(e) => setCancelFeedback(e.target.value)}
                            placeholder="Help us improve ÜrTC..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-red-500 transition-colors h-24 resize-none"
                        ></textarea>
                    </div>
                </div>
                <div className="p-4 bg-white/5 flex gap-3">
                    <button onClick={() => setShowCancelModal(false)} className="flex-1 py-3 bg-white/10 text-white rounded-xl font-bold text-sm hover:bg-white/20 transition">Keep My Plan</button>
                    <button onClick={handleCancelSubscription} className="flex-1 py-3 bg-red-500/20 text-red-500 rounded-xl font-bold text-sm hover:bg-red-500 hover:text-white transition">Cancel & Submit</button>
                </div>
            </div>
        </div>
     )}

     {/* PLAN DETAILS MODAL */}
     {selectedPlan && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="w-full max-w-sm bg-[#151921] border border-white/20 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
                <div className="p-6 pb-2 relative">
                    <button onClick={() => setSelectedPlan(null)} className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-gray-400 hover:text-white transition"><X size={20}/></button>
                    <h3 className="text-3xl font-black italic tracking-tighter text-white mb-1">{selectedPlan}</h3>
                    <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">
                        {selectedPlan === UserTier.Diamond ? "Premium" : selectedPlan === UserTier.Professional ? "Enterprise" : "Standard"}
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 pt-2">
                    <ul className="space-y-3">
                        {getFeatures(selectedPlan).map((feat, i) => (
                            <li key={i} className="flex items-start gap-3 text-gray-300 text-sm">
                                <div className="mt-0.5 bg-brand-orange/20 p-1 rounded-full text-brand-orange"><Check size={10} strokeWidth={3} /></div>
                                {feat}
                            </li>
                        ))}
                    </ul>

                    {/* Diamond Tier Pricing Options */}
                    {selectedPlan === UserTier.Diamond && (
                        <div className="mt-6 space-y-2 border-t border-white/10 pt-4">
                            <h4 className="text-sm font-bold text-white mb-2">Choose your billing cycle:</h4>
                            <p className="text-[10px] text-center text-sky-300 bg-sky-400/10 border border-sky-400/20 rounded-lg py-1.5 px-2 mb-1">New accounts get 7 days of Diamond free — no card needed.</p>
                            {(!currentUser?.id || currentUser.id.startsWith('guest')) && (
                                <p className="text-[10px] text-center text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg py-1.5 px-2">Create a free account first so we can activate Diamond on it after checkout.</p>
                            )}
                            <a href={checkoutUrl("https://buy.stripe.com/3cIaEZcrV6NY4MadX87IY06")} target="_blank" rel="noopener noreferrer" className="block w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-center text-white text-sm font-bold transition">
                                Weekly: {new Intl.NumberFormat(navigator.language || 'en-US', { style: 'currency', currency: 'USD' }).format(4.99)}/wk
                            </a>
                            <a href={checkoutUrl("https://buy.stripe.com/3cIbJ3dvZ4FQceCaKW7IY00")} target="_blank" rel="noopener noreferrer" className="block w-full py-2.5 bg-white/5 hover:bg-white/10 border border-brand-orange/50 rounded-xl text-center text-white text-sm font-bold shadow-[0_0_15px_rgba(255,92,26,0.2)] transition">
                                Monthly: {new Intl.NumberFormat(navigator.language || 'en-US', { style: 'currency', currency: 'USD' }).format(13.99)}/mo (Recommended)
                            </a>
                            <a href={checkoutUrl("https://buy.stripe.com/6oUcN70JdgoyguS8CO7IY05")} target="_blank" rel="noopener noreferrer" className="block w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-center text-white text-sm font-bold transition">
                                Annually: {new Intl.NumberFormat(navigator.language || 'en-US', { style: 'currency', currency: 'USD' }).format(129.99)}/yr <span className="ml-2 text-[9px] font-black bg-green-500 text-white px-2 py-0.5 rounded-full align-middle">BEST VALUE · SAVE 23%</span>
                            </a>
                            <p className="text-[10px] text-center text-gray-500 mt-2">Prices are localized at checkout based on your region.</p>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-white/5 border-t border-white/10">
                    {currentUser.tier === selectedPlan ? (
                        <div className="space-y-3">
                            <button className="w-full py-3 bg-brand-orange/20 text-brand-orange rounded-xl font-bold cursor-default flex items-center justify-center gap-2 border border-brand-orange/30">
                                <CheckCircle size={16} /> Current Plan
                            </button>
                            {/* Upgrade / Cancel options if they are on a paid tier */}
                            {(selectedPlan === UserTier.Diamond || selectedPlan === UserTier.Professional) && (
                                <div className="flex gap-2">
                                    <button onClick={() => {}} className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition">Change Plan</button>
                                    <button onClick={() => setShowCancelModal(true)} className="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg text-xs font-bold transition">Cancel Plan</button>
                                </div>
                            )}
                        </div>
                    ) : (
                        selectedPlan === UserTier.Diamond ? (
                            <p className="text-xs text-center text-gray-500">Select a billing cycle above to subscribe securely via Stripe.</p>
                        ) : selectedPlan === UserTier.Professional ? (
                            <a href="mailto:sales@cavecoredynamics.org" className="w-full py-3 bg-[#635BFF] hover:bg-[#5851E5] text-white rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2">
                                Contact Sales <ArrowRight size={16} />
                            </a>
                        ) : selectedPlan === UserTier.Free ? (
                            <button onClick={() => { setSelectedPlan(null); setShowLogin(true); }} className="w-full py-3 bg-brand-blue text-white rounded-xl font-bold shadow-lg hover:scale-[1.02] active:scale-[0.98] transition">
                                Login / Sign Up Free
                            </button>
                        ) : (
                            <button onClick={() => { setSelectedPlan(null); handleLogout(); }} className="w-full py-3 bg-gray-700 text-white rounded-xl font-bold">
                                Continue as Guest
                            </button>
                        )
                    )}
                </div>
             </div>
         </div>
     )}

     {/* Auth Modals */}
     {showLogin && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
             <div className="w-full max-w-sm relative">
                 <button onClick={() => setShowLogin(false)} className="absolute top-2 right-2 text-gray-500 z-10"><LogOut size={20}/></button>
                 <LoginView onSuccess={(u) => { onUserUpdate(u); setShowLogin(false); }} onRegisterClick={() => { setShowLogin(false); setShowRegister(true); }} />
             </div>
         </div>
     )}
     {showRegister && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
             <div className="w-full max-w-sm relative">
                 <RegisterView onSuccess={(u) => { onUserUpdate(u); setShowRegister(false); }} onLoginClick={() => { setShowRegister(false); setShowLogin(true); }} />
             </div>
         </div>
     )}
   </div>
 );
});
