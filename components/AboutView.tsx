
import React, { useState } from 'react';
import { Info, Shield, Star, Crown, Lock, CreditCard, Type, User, LogOut, Code, CheckCircle, Settings, FileText, Check, X, ArrowRight, Gauge, Loader2, Users, Building } from 'lucide-react';
import { UserTier, UserAccount } from '../types';
import { LoginView } from './auth/LoginView';
import { RegisterView } from './auth/RegisterView';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { redeemAccessCode, logout, getActiveUser, getStatsForNerds, setStatsForNerds, updateUserTier } from '../services/authService';

const stripePromise = loadStripe('pk_live_51TUeysRqoflFtIgs5AqotIPRZ1Q6sWjxcdtXeEKYhT8Au7rdYJJ8JIaTdmohYZ7028erR55De0nJ2eo3WOXB3wF500XZknvsPh');

const CheckoutForm = ({ selectedPlan, stripeEmail, setStripeEmail, onSuccess }: any) => {
    const stripe = useStripe();
    const elements = useElements();
    const [stripeProcessing, setStripeProcessing] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setStripeProcessing(true);
        setErrorMsg('');

        const cardElement = elements.getElement(CardElement);

        if (!cardElement) {
            setStripeProcessing(false);
            return;
        }

        const {error, paymentMethod} = await stripe.createPaymentMethod({
            type: 'card',
            card: cardElement,
            billing_details: {
                email: stripeEmail,
            },
        });

        if (error) {
            setErrorMsg(error.message || 'Payment failed');
            setStripeProcessing(false);
        } else {
            console.log('PaymentMethod', paymentMethod);
            // Simulate backend confirmation success
            setTimeout(() => {
                onSuccess();
            }, 1000);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-500">Email Address</label>
                <input required type="email" value={stripeEmail} onChange={e => setStripeEmail(e.target.value)} placeholder="traveler@example.com" className="w-full bg-[#0f1115] border border-white/10 focus:border-[#8DE2FF]/50 focus:ring-1 focus:ring-[#8DE2FF]/50 rounded-xl p-4 text-sm text-white outline-none transition-all shadow-inner placeholder-gray-600" />
            </div>
            <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-500">Card Information</label>
                <div className="bg-[#0f1115] border border-white/10 focus-within:border-[#8DE2FF]/50 focus-within:ring-1 focus-within:ring-[#8DE2FF]/50 rounded-xl p-4 shadow-inner transition-all">
                    <CardElement options={{
                        style: {
                            base: {
                                fontSize: '16px',
                                color: '#ffffff',
                                '::placeholder': {
                                    color: '#6b7280',
                                },
                                iconColor: '#8DE2FF',
                            },
                            invalid: {
                                color: '#ef4444',
                                iconColor: '#ef4444',
                            },
                        },
                    }} />
                </div>
            </div>
            
            {errorMsg && <div className="text-red-500 text-xs font-bold">{errorMsg}</div>}



            <button 
                disabled={!stripe || stripeProcessing}
                type="submit"
                className="w-full py-4 mt-2 bg-gradient-to-r from-[#E0FFFF] via-[#8DE2FF] to-[#3AB0FF] text-black rounded-xl font-black shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
                {stripeProcessing ? <Loader2 size={18} className="animate-spin" /> : `Pay ${selectedPlan === 'Diamond Single' ? '$13.99' : '$22.99'}`}
            </button>
        </form>
    );
};

interface AboutViewProps {
 currentUser: UserAccount;
 onUserUpdate: (user: UserAccount) => void;
 textSize: 'sm' | 'base' | 'lg';
 onTextSizeChange: (size: 'sm' | 'base' | 'lg') => void;
}

export const AboutView: React.FC<AboutViewProps> = ({ currentUser, onUserUpdate, textSize, onTextSizeChange }) => {
 const [activeTab, setActiveTab] = useState<'access' | 'settings' | 'info'>('access');
 const [showLogin, setShowLogin] = useState(false);
 const [showRegister, setShowRegister] = useState(false);
 const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
 const [accessCode, setAccessCode] = useState('');
 const [codeError, setCodeError] = useState('');

 const [statsNerd, setStatsNerd] = useState(getStatsForNerds());
 const [showStripe, setShowStripe] = useState(false);
 const [stripeEmail, setStripeEmail] = useState('');
 const [stripeCard, setStripeCard] = useState('');
 const [stripeProcessing, setStripeProcessing] = useState(false);
 const [showContactForm, setShowContactForm] = useState(false);
 const [contactEmail, setContactEmail] = useState('');
 const [contactSubject, setContactSubject] = useState('Small Business Inquiry');
 const [contactSent, setContactSent] = useState(false);

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

 const getFeatures = (tier: string) => {
    switch (tier) {
        case UserTier.Guest:
            return [
                "Standard Flight Tracker (By ID/Route)",
                "Basic AI Synthesis (Apollo AI)",
                "Smart Query Parsing",
                "Standard Ad State (Interstitial Engine)"
            ];
        case UserTier.Free:
            return [
                "Standard Flight Tracker (By ID/Route)",
                "Basic AI Synthesis (Apollo AI)",
                "Smart Query Parsing",
                "Standard Ad State (Interstitial Engine)",
                "Sync Trips Across Devices"
            ];
        case 'Pro Single':
            return [
                "Zero-Latency / Ad-Free Engine",
                "Stats for Nerds Mode (Live Telemetry)",
                "Persistent Notes Panel (Digital Flight Bag)",
                "Advanced Swipe Navigation & Scale Engine",
                "Advanced AI Planners (Smart Budgeting)",
                "AI Smart Notes"
            ];
        case 'Pro Family':
            return [
                "All Pro Single Features",
                "Up to 5 Family Members",
                "Shared Trip Planning",
                "Family Budget Sync"
            ];
        case 'Crew Small Enterprises':
            return [
                "All Pro Features",
                "Enterprise Dashboards",
                "Priority Support",
                "Crew Badge",
                "Developer Debug Tools"
            ];
        case 'Crew Corporations':
            return [
                "All Enterprise Features",
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
        {(tier === UserTier.Pro || tier === UserTier.Crew) && <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent skew-x-12 animate-shimmer pointer-events-none"></div>}
    </div>
 );

 return (
   <div className="h-full flex flex-col pb-24 animate-in fade-in">
     {/* Tab Navigation */}
     <div className="px-6 pt-2 pb-4">
         <div className="flex p-1 bg-gray-200 dark:bg-white/5 rounded-xl border border-gray-300 dark:border-white/10">
            <button onClick={() => setActiveTab('access')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${activeTab === 'access' ? 'bg-white dark:bg-[#151921] text-brand-orange shadow' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}><CreditCard size={14}/> Plans</button>
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
                         <h2 className="text-xl font-bold text-gray-900 dark:text-white">Your Wallet</h2>
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

                     {/* Diamond Pro Modal Trigger */}
                     {renderCard('Diamond', "DIAMOND", "Diamond", "bg-gradient-to-br from-[#E0FFFF] via-[#8DE2FF] to-[#3AB0FF]", <Star size={32} fill="white" />, currentUser.tier === UserTier.Pro)}

                     {/* Professional Markdown Trigger */}
                     {renderCard('ProfessionalDocs', "PROFESSIONAL", "Professional", "bg-gradient-to-br from-[#9D50BB] to-[#6E48AA]", <Crown size={32} />, currentUser.tier === UserTier.Crew)}
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

                     <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 text-gray-700 dark:text-white"><Type size={18}/><span className="text-sm font-bold">Text Size</span></div>
                        <div className="flex bg-gray-100 dark:bg-black/20 p-1 rounded-lg">
                            <button onClick={() => onTextSizeChange('sm')} className={`px-3 py-1 rounded-md text-xs font-bold transition ${textSize === 'sm' ? 'bg-white dark:bg-white/10 text-brand-orange shadow' : 'text-gray-400'}`}>A</button>
                            <button onClick={() => onTextSizeChange('base')} className={`px-3 py-1 rounded-md text-sm font-bold transition ${textSize === 'base' ? 'bg-white dark:bg-white/10 text-brand-orange shadow' : 'text-gray-400'}`}>A</button>
                            <button onClick={() => onTextSizeChange('lg')} className={`px-3 py-1 rounded-md text-lg font-bold transition ${textSize === 'lg' ? 'bg-white dark:bg-white/10 text-brand-orange shadow' : 'text-gray-400'}`}>A</button>
                        </div>
                    </div>
                     <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 text-gray-700 dark:text-white"><Gauge size={18}/><span className="text-sm font-bold">Stats for Nerds</span></div>
                        <button 
                            onClick={() => {
                                if (currentUser.tier === UserTier.Pro || currentUser.tier === UserTier.Crew || currentUser.tier === UserTier.Dev) {
                                    const next = !statsNerd;
                                    setStatsNerd(next);
                                    setStatsForNerds(next);
                                } else {
                                    alert("Stats for Nerds requires Diamond, Professional, or Dev tier.");
                                }
                            }}
                            className={`w-12 h-6 rounded-full transition-colors relative ${statsNerd ? 'bg-brand-orange' : 'bg-gray-300 dark:bg-white/20'}`}
                        >
                            <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${statsNerd ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </button>
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

         {/* TAB 3: INFO */}
         {activeTab === 'info' && (
             <div className="space-y-6">
                 <h2 className="text-xl font-bold text-gray-900 dark:text-white">Info & Credits</h2>

                 {/* Crew Bios */}
                 <div className="bg-white dark:bg-[#151921] p-5 rounded-2xl border border-gray-200 dark:border-white/10 text-left shadow-lg">
                    <h3 className="font-bold text-brand-orange mb-4 flex items-center gap-2"><Info size={16} /> The Crew</h3>
                    <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                      <p>An organizational Psychologist with years of experience in Professional Travel, ensuring your journey is stress-free.</p>
                      <p>Followed by a young Techie and Business Buff that loves to turn imagination into the real world, building the systems that guide you.</p>
                      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-white/10">
                        <div className="mt-1 w-2 h-2 rounded-full bg-brand-orange shrink-0"></div>
                        <div><strong className="text-gray-900 dark:text-white block">Apollo AI</strong><span className="text-gray-500 dark:text-gray-400 text-xs">The friendly Companion that can help with everything for travel. 🐶</span></div>
                      </div>
                      
                      <div className="pt-4 border-t border-gray-200 dark:border-white/10">
                          <h4 className="font-bold text-gray-900 dark:text-white mb-1">Feedback & Support</h4>
                          <p className="text-xs text-gray-500 mb-2">Notice a bug? Have an idea? Let us know!</p>
                          <a href="mailto:feedback@cavecoredynamics.org" className="text-brand-orange font-bold text-sm hover:underline break-all">feedback@cavecoredynamics.org</a>
                      </div>
                    </div>
                 </div>

                 {/* Data Sources */}
                 <div className="bg-white dark:bg-[#151921] p-5 rounded-2xl border border-gray-200 dark:border-white/10 text-xs text-gray-600 dark:text-gray-300 leading-relaxed space-y-4">
                    <p><strong>ÜrTC (Your Travel Companion)</strong> is built by <strong>Cave Core Dynamics™</strong> to give travelers a unified, intelligent way to track flights, plan trips, and manage money on the go.</p>
                    
                    <div className="space-y-2">
                        <p className="text-brand-orange font-bold uppercase tracking-widest text-[10px]">Flight Data</p>
                        <p>Real-time and historical flight information is provided by <strong>FlightAware® AeroAPI</strong>.</p>
                    </div>

                    <div className="space-y-2">
                        <p className="text-brand-orange font-bold uppercase tracking-widest text-[10px]">Weather & Maps</p>
                        <p>Location services, maps, and places data powered by <strong>Google Maps Platform</strong>.</p>
                        <p>Weather data provided by <strong>OpenWeather</strong>.</p>
                    </div>

                    <div className="space-y-2">
                        <p className="text-brand-orange font-bold uppercase tracking-widest text-[10px]">AI Assistant</p>
                        <p>Apollo AI conversations and insights are powered by <strong>Google’s Gemini models</strong>.</p>
                    </div>

                    <div className="pt-4 border-t border-gray-200 dark:border-white/10 text-[10px] opacity-70">
                        <p>© 2025 Cave Core Dynamics™. All rights reserved.</p>
                    </div>
                </div>
             </div>
         )}
     </div>

     {/* PLAN DETAILS MODAL */}
     {selectedPlan && selectedPlan !== 'Gold' && selectedPlan !== 'CrewDocs' && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="w-full max-w-sm bg-[#151921] border border-white/20 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
                <div className="p-6 pb-2 relative">
                    <button onClick={() => setSelectedPlan(null)} className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-gray-400 hover:text-white transition"><X size={20}/></button>
                    <h3 className="text-3xl font-black italic tracking-tighter text-white mb-1">{selectedPlan}</h3>
                    <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">
                        {selectedPlan.includes('Pro') ? "Premium" : selectedPlan.includes('Crew') ? "Enterprise" : "Standard"}
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
                </div>

                <div className="p-4 bg-white/5 border-t border-white/10">
                    {currentUser.tier === selectedPlan ? (
                        <button className="w-full py-3 bg-white/10 text-white/50 rounded-xl font-bold cursor-default flex items-center justify-center gap-2">
                            <CheckCircle size={16} /> Current Plan
                        </button>
                    ) : (
                        selectedPlan.includes('Diamond') ? (
                            <button onClick={() => setShowStripe(true)} className="w-full py-3 bg-gradient-to-r from-brand-orange to-red-500 text-white rounded-xl font-bold shadow-lg shadow-brand-orange/20 hover:scale-[1.02] active:scale-[0.98] transition flex items-center justify-center gap-2">
                                Subscribe for {selectedPlan === 'Diamond Single' ? '$13.99' : '$22.99'}/mo <ArrowRight size={16} />
                            </button>
                        ) : selectedPlan.includes('Professional') ? (
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

     {/* DIAMOND SUB-SELECTION MODAL */}
     {selectedPlan === 'Diamond' && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="w-full max-w-md bg-[#151921] border border-[#8DE2FF]/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
                 <div className="p-6 pb-4 relative border-b border-white/10">
                     <button onClick={() => setSelectedPlan(null)} className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-gray-400 hover:text-white transition"><X size={20}/></button>
                     <h3 className="text-3xl font-black italic tracking-tighter text-[#8DE2FF] mb-1">DIAMOND</h3>
                     <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">Select Your Service (with applicable taxes to each tier in Diamond)</p>
                 </div>
                 <div className="p-6 space-y-4 overflow-y-auto">
                     <div 
                         onClick={() => setSelectedPlan('Diamond Single')}
                         className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#8DE2FF]/50 rounded-2xl p-5 cursor-pointer transition group"
                     >
                         <h4 className="text-xl font-bold text-white mb-1 flex items-center justify-between">Diamond Single <span className="text-brand-orange text-sm group-hover:scale-105 transition">$13.99/mo</span></h4>
                         <p className="text-[10px] text-gray-500 mb-2 font-bold tracking-widest uppercase">Or $350 Lifetime</p>
                         <p className="text-xs text-gray-400 mb-3">A premium, ad-free flight experience with Apollo as your personal, hyper-focused co-pilot.</p>
                         <ul className="text-xs text-gray-300 space-y-1">
                             <li>• Lightning-fast, ad-free tracking</li>
                             <li>• Deep-dive flight analytics (Stats for Nerds)</li>
                             <li>• Digital flight bag for your personal notes</li>
                         </ul>
                     </div>
                     <div 
                         onClick={() => setSelectedPlan('Diamond Family')}
                         className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#8DE2FF]/50 rounded-2xl p-5 cursor-pointer transition group"
                     >
                         <h4 className="text-xl font-bold text-white mb-1 flex items-center justify-between">Diamond Family <span className="text-brand-orange text-sm group-hover:scale-105 transition">$22.99/mo</span></h4>
                         <p className="text-[10px] text-gray-500 mb-2 font-bold tracking-widest uppercase">Or $248.88/Year</p>
                         <p className="text-xs text-gray-400 mb-3">Perfect for packs! Keep up to 5 travelers synced on the same journey without breaking a sweat.</p>
                         <ul className="text-xs text-gray-300 space-y-1">
                             <li>• Everything in Diamond Single</li>
                             <li>• Link up to 5 family members (the whole pack)</li>
                             <li>• Shared itineraries & budget syncing</li>
                         </ul>
                     </div>
                 </div>
              </div>
         </div>
     )}

     {/* PROFESSIONAL MARKDOWN MODAL */}
     {selectedPlan === 'ProfessionalDocs' && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="w-full max-w-2xl bg-[#0f1115] border border-[#9D50BB]/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[85vh]">
                 <div className="p-4 md:p-6 pb-4 relative border-b border-white/10 bg-[#151921]">
                     <button onClick={() => setSelectedPlan(null)} className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-gray-400 hover:text-white transition"><X size={20}/></button>
                     <h3 className="text-2xl md:text-3xl font-black italic tracking-tighter text-[#9D50BB] mb-1">PROFESSIONAL ACCESS</h3>
                     <p className="text-gray-400 text-xs md:text-sm font-bold uppercase tracking-widest font-mono">Service_Overview.md</p>
                 </div>
                 <div className="flex-1 overflow-y-auto p-4 md:p-6 text-sm text-gray-300 font-mono space-y-4 leading-relaxed selection:bg-[#9D50BB]/30">
                     <p className="text-[#9D50BB] font-bold"># ürTC™ (Travel Evolved) — Subscription & Service Architecture</p>
                     <p><span className="text-gray-500">Parent Entity:</span> CaveCore Dynamics LLC (CCD)</p>
                     
                     <div className="h-px bg-white/10 my-4" />
                     
                     <p className="text-white font-bold">3. Professional Access (Enterprise & Pack Networks)</p>
                     <p className="text-xs text-gray-400 italic">The ultimate command center for active flight crews, large travel packs, and enterprise coordinators.</p>
                     
                     <p><span className="text-[#9D50BB] font-bold">Core Purpose:</span> Keeps everyone's itineraries, budgets, and live flight tracking perfectly synchronized, with Apollo fetching the latest updates.</p>

                     <p className="text-white font-bold mt-6 mb-2">Key Features & Capabilities:</p>
                     
                     <ul className="space-y-3">
                         <li><strong className="text-brand-orange">Pack Synchronization:</strong> Connects your whole crew under a single subscription. Apollo seamlessly fetches and merges everyone's boarding passes, budgets, and itineraries in real-time.</li>
                         <li><strong className="text-brand-orange">ApolloLive (Voice Mode):</strong> Unlocks Apollo's real-time voice assistance. Just speak, and your trusty co-pilot will fetch flight deck updates completely hands-free.</li>
                         <li><strong className="text-brand-orange">Dynamic Process Island:</strong> A persistent heads-up display. Apollo keeps a watchful eye on delays, gate changes, and airtime, always staying one step ahead.</li>
                         <li><strong className="text-brand-orange">Global Airspace Telemetry:</strong> Full access to live radar, tracking every waypoint, latitude, and heading like a bloodhound.</li>
                     </ul>

                     <div className="h-px bg-white/10 my-6" />

                     {currentUser.tier === UserTier.Dev ? (
                         <>
                             <p className="text-white font-bold">Pricing Tiers:</p>
                             <div className="flex flex-col sm:flex-row gap-4 mt-2">
                         <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex-1">
                             <p className="font-bold text-[#9D50BB]">Crew Tools – Small Businesses</p>
                             <p className="text-[10px] text-gray-500 mb-2 font-bold tracking-widest uppercase">1–25 Members</p>
                             <p className="text-xl text-white font-black my-1">$524.25<span className="text-xs text-gray-500 font-normal">/Month</span></p>
                             <p className="text-[10px] text-gray-500 mb-2 font-bold tracking-widest uppercase">Or $5,352.75/Year</p>
                             <button onClick={() => { setContactSubject("Small Business Inquiry"); setShowContactForm(true); setContactSent(false); }} className="text-xs bg-[#9D50BB] text-white px-3 py-1.5 rounded-lg inline-block mt-2 hover:bg-[#8644a0]">Contact Sales</button>
                         </div>
                         <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex-1">
                             <p className="font-bold text-[#9D50BB]">Crew Tools – Corporations</p>
                             <p className="text-[10px] text-gray-500 mb-2 font-bold tracking-widest uppercase">25–150+ Members</p>
                             <p className="text-xl text-white font-black my-1">$3,448.50<span className="text-xs text-gray-500 font-normal">/Month</span></p>
                             <p className="text-[10px] text-gray-500 mb-2 font-bold tracking-widest uppercase">Or $37,243.80/Year</p>
                             <button onClick={() => { setContactSubject("Corporate Inquiry"); setShowContactForm(true); setContactSent(false); }} className="text-xs bg-[#9D50BB] text-white px-3 py-1.5 rounded-lg inline-block mt-2 hover:bg-[#8644a0]">Contact Sales</button>
                         </div>
                             </div>
                         </>
                     ) : (
                         <div className="mt-4 flex flex-col items-center justify-center p-6 bg-white/5 border border-white/10 rounded-2xl">
                             <p className="text-white font-bold text-lg mb-2">Enterprise Solutions</p>
                             <p className="text-gray-400 text-center mb-4">Contact our sales team to discuss custom pricing for your organization.</p>
                             <button onClick={() => { setContactSubject("Enterprise Inquiry"); setShowContactForm(true); setContactSent(false); }} className="w-full sm:w-auto px-6 py-3 bg-[#9D50BB] text-white rounded-xl font-bold shadow-lg hover:scale-[1.02] active:scale-[0.98] transition">Contact Sales</button>
                         </div>
                     )}

                     {/* Inline Contact Form */}
                     {showContactForm && (
                         <div className="mt-6 bg-[#151921] p-6 rounded-2xl border border-[#9D50BB]/30 animate-in slide-in-from-bottom-4">
                             {contactSent ? (
                                 <div className="text-center py-6">
                                     <div className="inline-flex bg-green-500/20 text-green-500 p-3 rounded-full mb-3"><CheckCircle size={24} /></div>
                                     <h4 className="text-lg font-bold text-white">Inquiry Sent</h4>
                                     <p className="text-sm text-gray-400 mt-2">A CaveCore Dynamics representative will contact you shortly.</p>
                                     <button onClick={() => { setShowContactForm(false); setContactSent(false); }} className="mt-4 text-xs font-bold text-gray-500 hover:text-white">Close</button>
                                 </div>
                             ) : (
                                 <form onSubmit={(e) => { e.preventDefault(); setContactSent(true); }} className="space-y-4">
                                     <div className="flex items-center justify-between mb-2">
                                         <h4 className="font-bold text-[#9D50BB]">Contact CaveCore Sales</h4>
                                         <button type="button" onClick={() => setShowContactForm(false)} className="text-gray-500 hover:text-white"><X size={16} /></button>
                                     </div>
                                     <div className="space-y-1">
                                         <label className="text-[10px] uppercase font-bold text-gray-500">Email Address</label>
                                         <input required type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="coordinator@airline.com" className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white outline-none focus:border-[#9D50BB] transition-colors" />
                                     </div>
                                     <div className="space-y-1">
                                         <label className="text-[10px] uppercase font-bold text-gray-500">Subject</label>
                                         <select value={contactSubject} onChange={e => setContactSubject(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white outline-none focus:border-[#9D50BB] appearance-none transition-colors">
                                             <option value="Small Business Inquiry">Small Business Inquiry (1-25 Seats)</option>
                                             <option value="Corporate Inquiry">Corporate Inquiry (25-150+ Seats)</option>
                                             <option value="Other Enterprise Request">Other Enterprise Request</option>
                                         </select>
                                     </div>
                                     <button type="submit" className="w-full py-3 bg-[#9D50BB] hover:bg-[#8644a0] text-white rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 mt-2">
                                         Send Inquiry <ArrowRight size={16} />
                                     </button>
                                 </form>
                             )}
                         </div>
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

     {/* Stripe Checkout Mock */}
     {showStripe && (
         <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
             <div className="w-full max-w-sm bg-white dark:bg-[#151921] border border-gray-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl relative">
                 <button onClick={() => setShowStripe(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={20}/></button>
                 <div className="flex items-center gap-2 text-[#635BFF] mb-4">
                     <CreditCard size={24} />
                     <span className="font-bold text-lg tracking-tight">Stripe Checkout</span>
                     <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto uppercase">LIVE MODE</span>
                 </div>
                 
                 <p className="text-sm font-bold text-gray-900 dark:text-white mb-6">Upgrade to {selectedPlan} - {selectedPlan === 'Diamond Single' ? '$13.99' : '$22.99'}/month</p>
                 
                 <Elements stripe={stripePromise}>
                     <CheckoutForm 
                         selectedPlan={selectedPlan}
                         stripeEmail={stripeEmail}
                         setStripeEmail={setStripeEmail}
                         onSuccess={async () => {
                             await updateUserTier(currentUser.id, UserTier.Pro);
                             onUserUpdate({...currentUser, tier: UserTier.Pro});
                             setShowStripe(false);
                             setSelectedPlan(null);
                         }}
                     />
                 </Elements>
                 
                 <p className="text-center text-[10px] text-gray-400 mt-4 flex items-center justify-center gap-1"><Lock size={10} /> Secure payment by Stripe</p>
             </div>
         </div>
     )}

   </div>
 );
};
