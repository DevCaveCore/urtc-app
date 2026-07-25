import React, { useMemo } from 'react';
import { Plane, Building2, ArrowRight, Play, Sparkles, Zap, Notebook, CreditCard, TrendingUp, Map, Globe, Star, ExternalLink, MessageCircle } from 'lucide-react';
import { UserAccount, UserTier, Tab, BudgetItem } from '../types';
import { hasDiamondAccess, trialDaysLeft } from '../services/authService';

interface HomeViewProps {
    user: UserAccount;
    onNavigate: (tab: Tab) => void;
    onExplore: (city: string) => void;
    onStartTour?: () => void;
    budgetItems?: BudgetItem[];
    budgetLimit?: number;
}

const TRENDING_DESTINATIONS = [
    { city: 'Tokyo', country: 'Japan', img: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&h=300&fit=crop', tag: '🔥 Trending' },
    { city: 'Santorini', country: 'Greece', img: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=400&h=300&fit=crop', tag: '✈️ Popular' },
    { city: 'Bali', country: 'Indonesia', img: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&h=300&fit=crop', tag: '🌴 Tropical' },
    { city: 'Paris', country: 'France', img: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&h=300&fit=crop', tag: '🗼 Iconic' },
    { city: 'Dubai', country: 'UAE', img: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400&h=300&fit=crop', tag: '💎 Luxury' },
    { city: 'New York', country: 'USA', img: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=400&h=300&fit=crop', tag: '🌆 City Life' },
];

const QUICK_ACTIONS = [
    { tab: Tab.Explore, icon: <Building2 size={22} />, label: 'Explore', sub: 'Hotels & food', color: 'from-blue-500/20 to-blue-600/10', accent: 'text-blue-400', border: 'border-blue-500/20' },
    { tab: Tab.Apollo, icon: <Sparkles size={22} />, label: 'Apollo AI', sub: 'Ask anything', color: 'from-brand-orange/20 to-orange-600/10', accent: 'text-brand-orange', border: 'border-brand-orange/20' },
    { tab: Tab.Itinerary, icon: <Notebook size={22} />, label: 'My Plans', sub: 'Trips & notes', color: 'from-emerald-500/20 to-emerald-600/10', accent: 'text-emerald-400', border: 'border-emerald-500/20' },
    { tab: Tab.Wander, icon: <Globe size={22} />, label: 'Wander', sub: 'Travel feed', color: 'from-purple-500/20 to-purple-600/10', accent: 'text-purple-400', border: 'border-purple-500/20' },
    { tab: Tab.About, icon: <CreditCard size={22} />, label: 'Change Plan', sub: 'Plans & perks', color: 'from-amber-500/20 to-amber-600/10', accent: 'text-amber-400', border: 'border-amber-500/20' },
];

export const HomeView: React.FC<HomeViewProps> = React.memo(({ user, onNavigate, onExplore, onStartTour, budgetItems = [], budgetLimit = 0 }) => {
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 5) return 'Up late';
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        if (hour < 21) return 'Good evening';
        return 'Good night';
    };

    // Concierge: surface the flight the user was last watching (48h window)
    const yourFlight = useMemo(() => {
        try {
            const raw = localStorage.getItem('urtc_last_flight_context');
            if (!raw) return null;
            const fc = JSON.parse(raw);
            if (!fc.viewed_at || Date.now() - new Date(fc.viewed_at).getTime() > 48 * 60 * 60 * 1000) return null;
            return fc;
        } catch { return null; }
    }, []);

    const askApollo = (prompt: string) => {
        try { localStorage.setItem('urtc_apollo_prefill', prompt); } catch { /* ignore */ }
        onNavigate(Tab.Apollo);
    };

    const totalSpent = budgetItems.reduce((s, i) => s + i.cost, 0);
    const budgetProgress = budgetLimit > 0 ? Math.min(100, (totalSpent / budgetLimit) * 100) : 0;

    return (
        <div className="space-y-5 pb-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* ── Hero Greeting ── */}
            <div className="relative rounded-3xl overflow-hidden min-h-[200px] shadow-lg shadow-black/20">
                {/* Background image */}
                <img
                    src="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&h=400&fit=crop"
                    alt="Travel"
                    className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Gradient overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />

                {/* Content */}
                <div className="relative z-10 p-6 flex flex-col justify-between h-full min-h-[200px]">
                    {/* Top: tier badge */}
                    <div className="flex justify-between items-start">
                        <div className="glass-light px-3 py-1.5 rounded-full flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${
                                user.tier === UserTier.Diamond || user.tier === UserTier.Dev
                                    ? 'bg-amber-400 animate-pulse' : 'bg-white/30'
                            }`} />
                            <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">
                                {user.tier === UserTier.Dev ? '⚡ Dev' :
                                 user.tier === UserTier.Diamond ? '💎 Diamond' :
                                 user.tier === UserTier.Professional ? '🎯 Professional' :
                                 user.tier === UserTier.Free ? '🥈 Silver' : '🥉 Bronze'}
                            </span>
                        </div>
                        <div className="glass-light w-11 h-11 rounded-2xl flex items-center justify-center">
                            <span className="text-xl font-bold text-white">{user.username.charAt(0).toUpperCase()}</span>
                        </div>
                    </div>

                    {/* Bottom: greeting + XP */}
                    <div>
                        <p className="text-white/50 text-sm font-medium mb-1">{getGreeting()},</p>
                        <h1 className="font-display text-3xl font-bold text-white leading-tight mb-3">
                            {user.username} <span className="text-brand-orange">✈</span>
                        </h1>

                        {/* Tier indicator line */}
                        <div className="flex items-center gap-2">
                            <div className="h-0.5 w-8 bg-gradient-to-r from-brand-orange to-amber-400 rounded-full" />
                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                                {user.tier === UserTier.Dev ? 'Developer' :
                                 user.tier === UserTier.Diamond ? 'Diamond Member' :
                                 user.tier === UserTier.Professional ? 'Professional' :
                                 user.tier === UserTier.Free ? 'Silver Member' : 'Get Started'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Start a Trip CTA ── */}
            <button
                id="tour-home-start"
                onClick={() => onNavigate(Tab.Flights)}
                className="w-full card-elevated p-5 flex items-center justify-between group press"
            >
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-brand-orange/15 border border-brand-orange/20 flex items-center justify-center">
                        <Plane size={22} className="text-brand-orange" />
                    </div>
                    <div className="text-left">
                        <p className="font-display text-base font-bold text-white">Plan Your Next Trip</p>
                        <p className="text-xs text-white/40 mt-0.5">Search flights &amp; track live prices</p>
                    </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-brand-orange/10 flex items-center justify-center group-hover:bg-brand-orange transition-colors duration-200">
                    <ArrowRight size={16} className="text-brand-orange group-hover:text-white transition-colors" />
                </div>
            </button>

            {/* ── Budget Card (when active) ── */}
            {budgetLimit > 0 && (
                <div
                    onClick={() => onNavigate(Tab.Itinerary)}
                    className="card-elevated p-5 cursor-pointer press animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 fill-mode-both"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-[10px] text-white/30 uppercase font-bold tracking-wider mb-1">Trip Budget</p>
                            <p className="font-display text-2xl font-bold text-white">
                                ${totalSpent.toLocaleString()}
                                <span className="text-white/25 text-base font-medium"> / ${budgetLimit.toLocaleString()}</span>
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-white/30 uppercase tracking-wider">Remaining</p>
                            <p className={`font-display text-xl font-bold ${budgetProgress > 90 ? 'text-red-400' : budgetProgress > 70 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                ${Math.max(0, budgetLimit - totalSpent).toLocaleString()}
                            </p>
                        </div>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${
                                budgetProgress > 90 ? 'bg-gradient-to-r from-red-500 to-red-400' :
                                budgetProgress > 70 ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
                                'bg-gradient-to-r from-emerald-500 to-emerald-400'
                            }`}
                            style={{ width: `${budgetProgress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* ── Trial expiry: the conversion moment ── */}
            {(() => {
                const paidTier = user.tier === UserTier.Diamond || user.tier === UserTier.Professional || user.tier === UserTier.Dev;
                if (paidTier) return null;
                const days = trialDaysLeft(user);
                const expired = !!user.trialEndsAt && days === 0 &&
                    (Date.now() - new Date(user.trialEndsAt).getTime()) < 5 * 24 * 60 * 60 * 1000;
                if (days > 0 && days <= 3) {
                    return (
                        <button onClick={() => onNavigate(Tab.About)} className="w-full text-left bg-gradient-to-r from-[#8DE2FF]/15 to-[#3AB0FF]/15 border border-[#3AB0FF]/30 rounded-3xl p-4 flex items-center gap-3 hover:border-[#3AB0FF]/60 transition">
                            <span className="text-2xl">💎</span>
                            <div className="flex-1">
                                <div className="text-sm font-black text-white">{days === 1 ? 'Last day of your Diamond trial' : `${days} days left of Diamond`}</div>
                                <div className="text-[11px] text-white/50 mt-0.5">Keep zero ads, unlimited Apollo & flight alerts — from $4.99</div>
                            </div>
                            <span className="text-[10px] font-black text-[#3AB0FF] whitespace-nowrap">KEEP IT →</span>
                        </button>
                    );
                }
                if (expired) {
                    return (
                        <button onClick={() => onNavigate(Tab.About)} className="w-full text-left bg-white/[0.03] border border-white/10 rounded-3xl p-4 flex items-center gap-3 hover:border-[#3AB0FF]/40 transition">
                            <span className="text-2xl">🐾</span>
                            <div className="flex-1">
                                <div className="text-sm font-black text-white">Apollo misses being unlimited</div>
                                <div className="text-[11px] text-white/50 mt-0.5">Your Diamond trial ended — bring it back from $4.99</div>
                            </div>
                            <span className="text-[10px] font-black text-[#3AB0FF] whitespace-nowrap">RESTORE →</span>
                        </button>
                    );
                }
                return null;
            })()}

            {/* ── Your Flight (concierge memory) ── */}
            {yourFlight && (
                <button
                    onClick={() => onNavigate(Tab.Flights)}
                    className="w-full text-left bg-white/[0.03] border border-white/10 rounded-3xl p-4 flex items-center gap-4 hover:border-brand-orange/40 transition group"
                >
                    <div className="w-11 h-11 rounded-2xl bg-brand-orange/15 border border-brand-orange/25 flex items-center justify-center shrink-0">
                        <Plane size={20} className="text-brand-orange" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-white">{yourFlight.flight}</span>
                            <span className={`text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full ${
                                (yourFlight.status || '').toLowerCase().includes('delay') || (yourFlight.status || '').toLowerCase().includes('cancel')
                                    ? 'bg-orange-500/15 text-orange-400 border border-orange-500/25'
                                    : 'bg-green-500/15 text-green-400 border border-green-500/25'
                            }`}>{yourFlight.status}</span>
                        </div>
                        <div className="text-[11px] text-white/40 font-medium mt-0.5 truncate">
                            {yourFlight.route}{yourFlight.gate ? ` · Gate ${yourFlight.gate}` : ''}
                        </div>
                    </div>
                    <ArrowRight size={16} className="text-white/25 group-hover:text-brand-orange transition shrink-0" />
                </button>
            )}

            {/* ── Ask Apollo (concierge entry) ── */}
            <div className="space-y-2">
                <button
                    onClick={() => askApollo('')}
                    className="w-full flex items-center gap-3 bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3.5 text-left hover:border-brand-orange/40 transition group"
                >
                    <MessageCircle size={16} className="text-brand-orange shrink-0" />
                    <span className="text-sm text-white/35 group-hover:text-white/60 transition">Ask Apollo anything about your trip…</span>
                </button>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                    {[
                        yourFlight ? "How's my flight looking?" : 'Where should I go this weekend?',
                        'Plan my evening nearby',
                        'Build a budget for my next trip'
                    ].map(chip => (
                        <button
                            key={chip}
                            onClick={() => askApollo(chip)}
                            className="shrink-0 text-[11px] font-bold text-white/60 bg-white/[0.04] border border-white/10 px-3.5 py-2 rounded-full hover:border-brand-orange/40 hover:text-brand-orange transition"
                        >
                            {chip}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Quick Actions (horizontal scroll) ── */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150 fill-mode-both">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
                        <Zap size={15} className="text-brand-orange" /> Quick Actions
                    </h2>
                </div>
                <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
                    {QUICK_ACTIONS.map(({ tab, icon, label, sub, color, accent, border }) => (
                        <button
                            key={tab}
                            onClick={() => onNavigate(tab)}
                            className={`flex-shrink-0 w-28 rounded-2xl p-4 bg-gradient-to-br ${color} border ${border} flex flex-col gap-3 press`}
                        >
                            <div className={`${accent}`}>{icon}</div>
                            <div className="text-left">
                                <p className="text-white text-sm font-bold leading-tight">{label}</p>
                                <p className="text-white/40 text-[10px] mt-0.5">{sub}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Exclusive Partner Deals ── */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-175 fill-mode-both">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
                        <Star size={15} className="text-brand-orange" /> Exclusive Partner Deals
                    </h2>
                </div>
                <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
                    <a
                        href="https://hub.stay22.com/referral/cavecoredynamics/travel"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 w-64 rounded-2xl overflow-hidden relative group shadow-lg shadow-black/20 press block"
                    >
                        <img
                            src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=300&fit=crop"
                            alt="Hotels"
                            className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                        <div className="absolute top-2 left-2 bg-brand-orange text-white text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                            Stay22
                        </div>
                        <div className="absolute bottom-3 left-3 right-3 text-left">
                            <p className="font-display font-bold text-white text-sm leading-tight">Book the Best Hotels</p>
                            <p className="text-white/60 text-[10px] mt-0.5 flex items-center gap-1">Get up to 20% off stays <ExternalLink size={10}/></p>
                        </div>
                    </a>

                    <a
                        href="https://www.discovercars.com/?a_aid=CaveCoreDynamics"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 w-64 rounded-2xl overflow-hidden relative group shadow-lg shadow-black/20 press block"
                    >
                        <img
                            src="https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=600&h=300&fit=crop"
                            alt="Rental Cars"
                            className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                        <div className="absolute top-2 left-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                            DiscoverCars
                        </div>
                        <div className="absolute bottom-3 left-3 right-3 text-left">
                            <p className="font-display font-bold text-white text-sm leading-tight">Rent a Car Anywhere</p>
                            <p className="text-white/60 text-[10px] mt-0.5 flex items-center gap-1">Compare prices & save <ExternalLink size={10}/></p>
                        </div>
                    </a>
                </div>
            </div>

            {/* ── Ad Space Placeholder (Silver & Dev Only) ── */}
            {(user.tier === UserTier.Free || user.tier === UserTier.Dev) && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-175 fill-mode-both border border-dashed border-white/20 bg-white/5 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[100px] relative overflow-hidden text-center">
                    <div className="text-white/40 text-[10px] font-mono tracking-widest uppercase mb-1">Advertisement Space</div>
                    <p className="text-white/60 text-xs font-medium">Unskippable 15s Video Ad goes here</p>
                    {user.tier === UserTier.Dev && (
                        <div className="absolute top-2 right-2 bg-amber-500/20 text-amber-400 text-[9px] font-mono px-2 py-0.5 rounded border border-amber-500/30">
                            DEV PREVIEW
                        </div>
                    )}
                </div>
            )}

            {/* ── Trending Destinations ── */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 fill-mode-both">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-display text-base font-bold text-white flex items-center gap-2">
                        <TrendingUp size={15} className="text-brand-orange" /> Trending Now
                    </h2>
                    <button onClick={() => onNavigate(Tab.Explore)} className="text-brand-orange text-xs font-semibold flex items-center gap-1 hover:underline">
                        See all <ArrowRight size={12} />
                    </button>
                </div>
                <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
                    {TRENDING_DESTINATIONS.map(({ city, country, img, tag }) => (
                        <button
                            key={city}
                            onClick={() => onExplore(city)}
                            className="flex-shrink-0 w-40 rounded-2xl overflow-hidden relative group press"
                        >
                            <img
                                src={img}
                                alt={city}
                                className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            <div className="absolute top-3 left-3">
                                <span className="text-[10px] font-bold bg-black/50 backdrop-blur-sm text-white px-2 py-1 rounded-full border border-white/10">
                                    {tag}
                                </span>
                            </div>
                            <div className="absolute bottom-3 left-3 right-3 text-left">
                                <p className="font-display font-bold text-white text-sm leading-tight">{city}</p>
                                <p className="text-white/50 text-[10px]">{country}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Tutorial / Onboarding CTA ── */}
            <div className="relative rounded-3xl overflow-hidden p-5 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-both shadow-lg shadow-black/20">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-blue/25 via-brand-blue/10 to-transparent" />
                <div className="absolute inset-0 border border-brand-blue/20 rounded-3xl" />
                <div className="relative z-10 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-brand-blue/20 border border-brand-blue/30 flex items-center justify-center shrink-0">
                        <Map size={22} className="text-brand-blue" />
                    </div>
                    <div className="flex-1">
                        <p className="font-display font-bold text-white">New to ÜrTC?</p>
                        <p className="text-white/40 text-xs mt-0.5">Take a quick tour of every feature</p>
                    </div>
                    <button
                        onClick={() => onStartTour?.()}
                        className="flex items-center gap-1.5 bg-brand-blue text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg shadow-brand-blue/20 press shrink-0"
                    >
                        <Play size={12} fill="currentColor" /> Tour
                    </button>
                </div>
            </div>
        </div>
    );
});
