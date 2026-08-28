import React, { useMemo, useState, useEffect } from 'react';
import { Plane, Building2, ArrowRight, Play, Sparkles, Zap, Notebook, CreditCard, TrendingUp, Map, Globe, Star, ExternalLink, MessageCircle, Radar, Ticket, MapPin, CalendarDays } from 'lucide-react';
import { UserAccount, UserTier, Tab, BudgetItem, Trip } from '../types';
import { hasDiamondAccess, trialDaysLeft } from '../services/authService';
import { fetchTrips } from '../services/tripService';
import { getStoredBookings, Booking } from '../services/travelCommerceService';
import { categorize } from './BudgetDashboard';

interface HomeViewProps {
    user: UserAccount;
    onNavigate: (tab: Tab) => void;
    onExplore: (city: string) => void;
    onStartTour?: () => void;
    budgetItems?: BudgetItem[];
    budgetLimit?: number;
}

// Store builds hide unfinished surfaces (e.g. ad placeholders) until they're real
const isNativeApp = typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.();

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

    // ── Personal context: next trip, latest booking, last explored city ──
    const [nextTrip, setNextTrip] = useState<{ trip: Trip; days: number; label: string; route?: string } | null>(null);

    useEffect(() => {
        let alive = true;
        const dayOf = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
        const load = async () => {
            try {
                const trips = await fetchTrips(user.id);
                if (!alive) return;
                const today = dayOf(Date.now());
                let best: { trip: Trip; when: number; route?: string } | null = null;
                for (const t of trips) {
                    if (t.archived) continue;
                    const flightDates = (t.flights || [])
                        .map(f => ({ when: new Date(f.flight_date).getTime(), route: f.departure_airport && f.arrival_airport ? `${f.departure_airport} → ${f.arrival_airport}` : undefined }))
                        .filter(x => !isNaN(x.when));
                    if (t.start_date) flightDates.push({ when: new Date(t.start_date + 'T12:00:00').getTime(), route: undefined });
                    const upcoming = flightDates.filter(x => dayOf(x.when) >= today).sort((a, b) => a.when - b.when)[0];
                    if (upcoming && (!best || upcoming.when < best.when)) best = { trip: t, when: upcoming.when, route: upcoming.route };
                }
                if (best) {
                    const days = Math.round((dayOf(best.when) - today) / 86400000);
                    setNextTrip({
                        trip: best.trip, days, route: best.route,
                        label: days === 0 ? 'Travel day!' : days === 1 ? 'Tomorrow' : `${days} days to go`,
                    });
                } else setNextTrip(null);
            } catch { /* trips are a bonus on Today */ }
        };
        load();
        window.addEventListener('urtc-trips-changed', load);
        return () => { alive = false; window.removeEventListener('urtc-trips-changed', load); };
    }, [user.id]);

    // Most recent booking, shown for two weeks after purchase
    const latestBooking = useMemo<Booking | null>(() => {
        try {
            const b = getStoredBookings()[0];
            if (!b) return null;
            return (Date.now() - new Date(b.createdAt).getTime()) < 14 * 24 * 60 * 60 * 1000 ? b : null;
        } catch { return null; }
    }, []);

    // Last city browsed in Explore — "pick up where you left off"
    const lastCity = useMemo(() => {
        const c = (localStorage.getItem('urtc_last_city') || '').trim();
        if (!c || c.toLowerCase() === 'unknown') return null;
        return TRENDING_DESTINATIONS.some(d => d.city.toLowerCase() === c.toLowerCase()) ? null : c;
    }, []);

    const totalSpent = budgetItems.reduce((s, i) => s + i.cost, 0);
    const budgetProgress = budgetLimit > 0 ? Math.min(100, (totalSpent / budgetLimit) * 100) : 0;

    // Plain-English budget read — the "financially easy to understand" promise
    const budgetLine = budgetLimit > 0 ? (
        totalSpent === 0 ? 'Nothing spent yet — Apollo can sketch this budget for you.' :
        totalSpent > budgetLimit ? `Over by $${(totalSpent - budgetLimit).toLocaleString()} — ask Apollo where to win it back.` :
        budgetProgress > 90 ? `Cutting it close — $${(budgetLimit - totalSpent).toLocaleString()} left. Spend it like it's the last treat.` :
        budgetProgress > 70 ? `Getting close — $${(budgetLimit - totalSpent).toLocaleString()} left for the rest of the trip.` :
        `On pace — $${(budgetLimit - totalSpent).toLocaleString()} still free for the fun stuff.`
    ) : null;

    // Live flight hero: computed from the concierge memory
    const fmtT = (iso?: string) => iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—';
    const fh = useMemo(() => {
        if (!yourFlight || !yourFlight.route) return null;
        const [dep, arr] = String(yourFlight.route).split(' to ');
        if (!dep || !arr) return null;
        const depT = yourFlight.estimated_departure || yourFlight.scheduled_departure;
        const hasAI = hasDiamondAccess(user) && !!yourFlight.predicted_arrival;
        const arrT = hasAI ? yourFlight.predicted_arrival : (yourFlight.estimated_arrival || yourFlight.scheduled_arrival);
        let progress = 0;
        const d = depT ? new Date(depT).getTime() : 0;
        const a = arrT ? new Date(arrT).getTime() : 0;
        if (d && a && a > d) progress = Math.round(Math.min(100, Math.max(0, ((Date.now() - d) / (a - d)) * 100)));
        const s = (yourFlight.status || '').toLowerCase();
        return { dep, arr, depT, arrT, progress, hasAI, isBad: s.includes('delay') || s.includes('cancel') || s.includes('resched') };
    }, [yourFlight, user]);

    return (
        <div className="space-y-5 pb-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* ── Compact header: calm, official, no brochure ── */}
            <div className="flex items-center justify-between px-1">
                <div>
                    <p className="text-white/40 text-xs font-medium">{getGreeting()},</p>
                    <h1 className="font-display text-2xl font-bold text-white leading-tight">{user.username}</h1>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-white/60 flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                            user.tier === UserTier.Diamond || user.tier === UserTier.Dev
                                ? 'bg-amber-400 animate-pulse' : 'bg-white/30'
                        }`} />
                        {user.tier === UserTier.Dev ? 'Dev' :
                         user.tier === UserTier.Diamond ? 'Diamond' :
                         user.tier === UserTier.Professional ? 'Professional' :
                         user.tier === UserTier.Free ? 'Silver' : 'Bronze'}
                    </span>
                    <div className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
                        <span className="text-base font-bold text-white">{user.username.charAt(0).toUpperCase()}</span>
                    </div>
                </div>
            </div>

            {/* Desktop (≥1024px): two-column dashboard — flight/budget left, Apollo/discovery right */}
            <div className="lg:grid lg:grid-cols-[1.45fr_1fr] lg:gap-6 lg:items-start">
            <div className="space-y-5 min-w-0">
            {/* ── Live flight hero (Flighty-grade) or plan-a-trip CTA ── */}
            {fh && yourFlight ? (
                <button
                    id="tour-home-start"
                    onClick={() => onNavigate(Tab.Flights)}
                    className="w-full text-left card-elevated p-5 press group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold text-white/50 flex items-center gap-1.5">
                            <Plane size={13} className="text-brand-orange" /> {yourFlight.flight}
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full border ${
                            fh.isBad
                                ? 'bg-orange-500/15 text-orange-400 border-orange-500/25'
                                : 'bg-green-500/15 text-green-400 border-green-500/25'
                        }`}>{yourFlight.status}</span>
                    </div>

                    <div className="flex items-center gap-3 mb-1">
                        <div className="text-left">
                            <p className="font-display text-3xl font-bold text-white leading-none">{fh.dep}</p>
                            <p className="text-[11px] text-white/40 mt-1.5 font-medium">{fmtT(fh.depT)}</p>
                        </div>
                        <div className="flex-1 relative h-[3px] bg-white/10 rounded-full mx-1">
                            <div className="absolute left-0 top-0 h-[3px] bg-brand-orange rounded-full transition-all duration-700" style={{ width: `${fh.progress}%` }} />
                            <Plane size={15} className="absolute -top-[7px] text-brand-orange transition-all duration-700" style={{ left: `calc(${Math.min(94, fh.progress)}% - 2px)` }} />
                        </div>
                        <div className="text-right">
                            <p className="font-display text-3xl font-bold text-white leading-none">{fh.arr}</p>
                            <p className={`text-[11px] mt-1.5 font-medium ${fh.hasAI ? 'text-[#3AB0FF] font-bold' : 'text-white/40'}`}>{fmtT(fh.arrT)}</p>
                        </div>
                    </div>

                    <div className="flex gap-2 mt-4 overflow-x-auto hide-scrollbar">
                        {yourFlight.gate && (
                            <span className="shrink-0 text-[10px] font-bold text-white/60 bg-white/[0.05] border border-white/10 px-2.5 py-1 rounded-lg">Gate {yourFlight.gate}</span>
                        )}
                        {yourFlight.terminal && (
                            <span className="shrink-0 text-[10px] font-bold text-white/60 bg-white/[0.05] border border-white/10 px-2.5 py-1 rounded-lg">Terminal {yourFlight.terminal}</span>
                        )}
                        {yourFlight.arrival_gate && (
                            <span className="shrink-0 text-[10px] font-bold text-white/60 bg-white/[0.05] border border-white/10 px-2.5 py-1 rounded-lg">Arrives gate {yourFlight.arrival_gate}</span>
                        )}
                        {fh.hasAI && (
                            <span className="shrink-0 text-[10px] font-black text-[#3AB0FF] bg-[#3AB0FF]/10 border border-[#3AB0FF]/25 px-2.5 py-1 rounded-lg flex items-center gap-1">
                                <Radar size={10} /> AI-predicted
                            </span>
                        )}
                    </div>
                </button>
            ) : (
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
            )}

            {/* ── Your next adventure: personal trip countdown ── */}
            {nextTrip && (
                <button
                    onClick={() => onNavigate(Tab.Itinerary)}
                    className={`w-full text-left rounded-3xl p-5 relative overflow-hidden press animate-in fade-in slide-in-from-bottom-4 duration-500 delay-75 fill-mode-both border ${
                        nextTrip.days === 0 ? 'border-brand-orange/50' : 'border-white/10 hover:border-brand-orange/30'
                    } transition`}
                >
                    <div className={`absolute inset-0 bg-gradient-to-br ${
                        nextTrip.days === 0
                            ? 'from-brand-orange/30 via-red-500/15 to-transparent'
                            : 'from-purple-500/20 via-brand-blue/10 to-transparent'
                    }`} />
                    <div className="relative z-10 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-1 flex items-center gap-1.5">
                                <CalendarDays size={11} className={nextTrip.days === 0 ? 'text-brand-orange' : 'text-purple-300'} />
                                {nextTrip.days === 0 ? 'Today’s the day' : 'Your next adventure'}
                            </p>
                            <p className="font-display text-xl font-bold text-white leading-tight truncate">{nextTrip.trip.name}</p>
                            {nextTrip.route && <p className="text-xs text-white/50 font-bold mt-1">{nextTrip.route}</p>}
                        </div>
                        <div className={`shrink-0 text-center px-4 py-2.5 rounded-2xl border ${
                            nextTrip.days === 0
                                ? 'bg-brand-orange text-white border-brand-orange shadow-lg shadow-brand-orange/30'
                                : 'bg-white/[0.06] text-white border-white/10'
                        }`}>
                            {nextTrip.days > 0 ? (
                                <>
                                    <div className="font-display text-2xl font-black leading-none">{nextTrip.days}</div>
                                    <div className="text-[9px] font-bold uppercase tracking-wider opacity-70 mt-0.5">{nextTrip.days === 1 ? 'day' : 'days'}</div>
                                </>
                            ) : (
                                <div className="font-display text-sm font-black leading-tight">Travel<br/>day! ✈️</div>
                            )}
                        </div>
                    </div>
                </button>
            )}

            {/* ── Latest booking: confirmation at a glance ── */}
            {latestBooking && (
                <button
                    onClick={() => onNavigate(Tab.Itinerary)}
                    className="w-full text-left bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-3 hover:border-emerald-500/40 transition press"
                >
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                        <Ticket size={15} className="text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">
                            {latestBooking.offer.airlineName} · {latestBooking.offer.slices[0]?.origin} → {latestBooking.offer.slices[0]?.destination}
                        </p>
                        <p className="text-[10px] text-white/40 mt-0.5">Confirmation <span className="font-mono font-bold text-emerald-400">{latestBooking.bookingReference}</span>{!latestBooking.liveMode ? ' · test' : ''}</p>
                    </div>
                    <ArrowRight size={14} className="text-white/30 shrink-0" />
                </button>
            )}

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
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden flex">
                        {totalSpent > 0 ? (
                            budgetItems.map((item, i) => {
                                const cat = categorize(item.name || (item as any).category || '');
                                const w = budgetLimit > 0 ? Math.min(100, (item.cost / budgetLimit) * 100) : 0;
                                return (
                                    <div
                                        key={item.id || i}
                                        className="h-full first:rounded-l-full transition-all duration-700"
                                        style={{ width: `${w}%`, background: cat.color, boxShadow: `0 0 6px ${cat.color}55` }}
                                        title={`${item.name}: $${item.cost.toLocaleString()}`}
                                    />
                                );
                            })
                        ) : (
                            <div className="h-full rounded-full bg-white/10" style={{ width: '2%' }} />
                        )}
                    </div>
                    {budgetLine && (
                        <p className="text-xs text-white/50 font-medium mt-3">{budgetLine}</p>
                    )}
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
            </div>

            <div className="space-y-5 mt-5 lg:mt-0 min-w-0">
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
                        fh?.isBad ? 'What does my delay mean for tonight?' :
                        yourFlight ? "How's my flight looking?" : 'Where should I go this weekend?',
                        nextTrip ? (nextTrip.days === 0 ? 'It’s travel day — what should I double-check?' : `What should I pack for ${nextTrip.trip.name}?`) :
                        budgetLimit > 0 ? 'Is my trip budget on track?' : 'Build a budget for my next trip',
                        lastCity ? `Best food in ${lastCity}?` : 'Plan my evening nearby'
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

            {/* ── Ad Space Placeholder (Silver & Dev Only; hidden in store builds until real ads exist) ── */}
            {(user.tier === UserTier.Free || user.tier === UserTier.Dev) && !isNativeApp && (
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
                    {lastCity && (
                        <button
                            onClick={() => onExplore(lastCity)}
                            className="flex-shrink-0 w-40 h-44 rounded-2xl overflow-hidden relative group press border border-brand-orange/30"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-brand-orange/30 via-[#151921] to-brand-blue/20" />
                            <div className="absolute top-3 left-3">
                                <span className="text-[10px] font-bold bg-brand-orange text-white px-2 py-1 rounded-full">
                                    ↩︎ For you
                                </span>
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <MapPin size={30} className="text-brand-orange/70" />
                            </div>
                            <div className="absolute bottom-3 left-3 right-3 text-left">
                                <p className="font-display font-bold text-white text-sm leading-tight">{lastCity}</p>
                                <p className="text-white/50 text-[10px]">Pick up where you left off</p>
                            </div>
                        </button>
                    )}
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
            </div>
        </div>
    );
});
