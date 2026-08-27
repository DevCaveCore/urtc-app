import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plane, Loader2, ArrowRight, ArrowLeftRight, Calendar, Search, Sparkles, Clock,
    CheckCircle, AlertTriangle, X, ChevronDown, ChevronUp, Users, Luggage,
    ShieldCheck, BadgeCheck, Zap, PiggyBank, Gem, ArrowLeft, Ticket, RefreshCw
} from 'lucide-react';
import { UserAccount } from '../types';
import {
    FlightOffer, FlightSearchParams, PassengerDetails, Booking, BookingState, OfferTag,
    searchFlightOffers, revalidateOffer, bookFlight, addBookingToTrips, BookingEngineError
} from '../services/travelCommerceService';
import { getAirportSuggestions } from '../services/mockService';
import { CalendarPicker } from './CalendarPicker';
import { AirlineLogo } from './AirlineLogo';

// ───────────────────────── helpers ─────────────────────────

const fmtMoney = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(amount);

const fmtMoneyExact = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);

const fmtTime = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch { return '--:--'; }
};

const fmtDay = (iso: string) => {
    try { return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }); } catch { return ''; }
};

const fmtDuration = (mins: number) => {
    const h = Math.floor(mins / 60), m = mins % 60;
    return h ? `${h}h ${m}m` : `${m}m`;
};

const TAG_STYLE: Record<OfferTag, { label: string; cls: string; icon: React.ReactNode }> = {
    BEST_OVERALL: { label: 'Apollo’s Pick', cls: 'bg-gradient-to-r from-brand-orange to-red-500 text-white', icon: <Sparkles size={11} /> },
    CHEAPEST: { label: 'Cheapest', cls: 'bg-emerald-500 text-white', icon: <PiggyBank size={11} /> },
    FASTEST: { label: 'Fastest', cls: 'bg-brand-blue text-white', icon: <Zap size={11} /> },
    BEST_VALUE: { label: 'Best Value', cls: 'bg-purple-500 text-white', icon: <Gem size={11} /> },
};

const STATE_LABELS: Partial<Record<BookingState, string>> = {
    REVALIDATING: 'Confirming today’s price with the airline…',
    PRICE_CONFIRMED: 'Price confirmed',
    PAYMENT_PENDING: 'Processing payment…',
    BOOKING_PENDING: 'Issuing your ticket with the airline…',
    CONFIRMED: 'Booking confirmed',
    PRICE_CHANGED: 'The price changed since your search',
    PAYMENT_FAILED: 'Payment failed',
    BOOKING_FAILED: 'Booking failed',
};

export interface BookingPrefill {
    origin?: string;
    destination?: string;
    departureDate?: string;
    returnDate?: string;
    passengers?: number;
    cabin?: FlightSearchParams['cabin'];
    budget?: number;
    autoSearch?: boolean;
}

interface BookingViewProps {
    user: UserAccount;
}

type Stage = 'search' | 'results' | 'checkout' | 'confirmed';

const emptyPassenger = (email: string): PassengerDetails => ({
    title: 'mr', givenName: '', familyName: '', bornOn: '', gender: 'm', email, phone: '',
});

// ───────────────────────── component ─────────────────────────

export const BookingView: React.FC<BookingViewProps> = React.memo(({ user }) => {
    const [stage, setStage] = useState<Stage>('search');

    // Search form
    const [origin, setOrigin] = useState('');
    const [destination, setDestination] = useState('');
    const [departureDate, setDepartureDate] = useState('');
    const [returnDate, setReturnDate] = useState('');
    const [passengers, setPassengers] = useState(1);
    const [cabin, setCabin] = useState<FlightSearchParams['cabin']>('economy');
    const [budget, setBudget] = useState('');
    const [showCalendar, setShowCalendar] = useState(false);
    const [activeInput, setActiveInput] = useState<'origin' | 'dest' | null>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);

    // Results
    const [offers, setOffers] = useState<FlightOffer[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [notConfigured, setNotConfigured] = useState(false);
    const [expandedOffer, setExpandedOffer] = useState<string | null>(null);
    const [lastParams, setLastParams] = useState<FlightSearchParams | null>(null);

    // Checkout
    const [selectedOffer, setSelectedOffer] = useState<FlightOffer | null>(null);
    const [bookingState, setBookingState] = useState<BookingState>('SEARCHED');
    const [checkoutError, setCheckoutError] = useState('');
    const [oldTotal, setOldTotal] = useState<number | null>(null);
    const [pax, setPax] = useState<PassengerDetails[]>([]);

    // Confirmation
    const [booking, setBooking] = useState<Booking | null>(null);
    const [tripName, setTripName] = useState<string | null>(null);

    // Apollo (or the flight tracker) can hand us a prefilled search
    useEffect(() => {
        try {
            const raw = localStorage.getItem('urtc_booking_prefill');
            if (!raw) return;
            localStorage.removeItem('urtc_booking_prefill');
            const p: BookingPrefill = JSON.parse(raw);
            if (p.origin) setOrigin(p.origin.toUpperCase());
            if (p.destination) setDestination(p.destination.toUpperCase());
            if (p.departureDate) setDepartureDate(p.departureDate);
            if (p.returnDate) setReturnDate(p.returnDate);
            if (p.passengers) setPassengers(p.passengers);
            if (p.cabin) setCabin(p.cabin);
            if (p.budget) setBudget(String(p.budget));
            if (p.autoSearch && p.origin && p.destination && p.departureDate) {
                runSearch({
                    origin: p.origin, destination: p.destination, departureDate: p.departureDate,
                    returnDate: p.returnDate, passengers: p.passengers || 1, cabin: p.cabin || 'economy',
                    totalBudget: p.budget,
                });
            }
        } catch { /* bad prefill — ignore */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!activeInput) { setSuggestions([]); return; }
        const q = activeInput === 'origin' ? origin : destination;
        setSuggestions(q.length > 0 ? getAirportSuggestions(q).slice(0, 5) : []);
    }, [origin, destination, activeInput]);

    const applySuggestion = (val: string) => {
        const code = val.split(' - ')[0];
        if (activeInput === 'origin') setOrigin(code); else setDestination(code);
        setSuggestions([]);
        setActiveInput(null);
    };

    const runSearch = async (params: FlightSearchParams) => {
        setIsSearching(true);
        setSearchError('');
        setNotConfigured(false);
        setOffers([]);
        setStage('results');
        setLastParams(params);
        try {
            const results = await searchFlightOffers(params);
            setOffers(results);
            if (results.length === 0) setSearchError('No flights found for that route and date. Try nearby dates or airports.');
        } catch (e: any) {
            if (e instanceof BookingEngineError && e.code === 'NOT_CONFIGURED') setNotConfigured(true);
            else setSearchError(e?.message || 'Search failed. Please try again.');
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const o = origin.trim().toUpperCase().slice(0, 3);
        const d = destination.trim().toUpperCase().slice(0, 3);
        if (o.length !== 3 || d.length !== 3) { setSearchError('Enter 3-letter airport codes, like ATL and LAX.'); setStage('results'); return; }
        if (o === d) { setSearchError('Departure and destination are the same airport — pick two different ones.'); setStage('results'); return; }
        if (!departureDate) { setShowCalendar(true); return; }
        const todayStr = new Date().toISOString().split('T')[0];
        if (departureDate < todayStr) { setSearchError('That departure date is in the past — pick today or later.'); setStage('results'); return; }
        runSearch({
            origin: o, destination: d, departureDate, returnDate: returnDate || undefined,
            passengers, cabin, totalBudget: budget ? parseFloat(budget) : undefined,
        });
    };

    // ── Checkout flow: SELECTED → REVALIDATING → PRICE_CONFIRMED/PRICE_CHANGED ──
    const startCheckout = async (offer: FlightOffer) => {
        setSelectedOffer(offer);
        setStage('checkout');
        setCheckoutError('');
        setOldTotal(null);
        setPax(Array.from({ length: offer.passengerIds.length || passengers }, () => emptyPassenger(user.email || '')));
        setBookingState('REVALIDATING');
        try {
            const { offer: fresh, priceChanged, oldTotal: prev } = await revalidateOffer(offer);
            setSelectedOffer(fresh);
            if (priceChanged) { setOldTotal(prev); setBookingState('PRICE_CHANGED'); }
            else setBookingState('PRICE_CONFIRMED');
        } catch (e: any) {
            if (e instanceof BookingEngineError && e.code === 'OFFER_EXPIRED') {
                setCheckoutError('That fare expired while you were browsing. Search again for live prices.');
                setBookingState('EXPIRED');
            } else {
                setCheckoutError(e?.message || 'Could not confirm the price.');
                setBookingState('BOOKING_FAILED');
            }
        }
    };

    const paxValid = useMemo(() =>
        pax.length > 0 && pax.every(p =>
            p.givenName.trim() && p.familyName.trim() && /^\d{4}-\d{2}-\d{2}$/.test(p.bornOn) &&
            /\S+@\S+\.\S+/.test(p.email) && p.phone.trim().length >= 10
        ), [pax]);

    const confirmAndBook = async () => {
        if (!selectedOffer || !paxValid) return;
        setCheckoutError('');
        setBookingState('PAYMENT_PENDING');
        let done: Booking;
        try {
            setBookingState('BOOKING_PENDING');
            const phone = (p: string) => (p.startsWith('+') ? p : `+1${p.replace(/\D/g, '')}`);
            done = await bookFlight(selectedOffer, pax.map(p => ({ ...p, phone: phone(p.phone) })));
        } catch (e: any) {
            const msg = e?.message || 'The airline could not complete this booking.';
            setCheckoutError(msg);
            setBookingState(/payment|balance|insufficient|sign in/i.test(msg) ? 'PAYMENT_FAILED' : 'BOOKING_FAILED');
            return;
        }
        // The ticket is issued and paid from here on — trip bookkeeping failing
        // must NEVER tell the customer their booking failed.
        setBooking(done);
        setBookingState('CONFIRMED');
        setStage('confirmed');
        try {
            const name = await addBookingToTrips(done);
            setTripName(name);
        } catch { setTripName(null); }
    };

    const updatePax = (i: number, field: keyof PassengerDetails, value: string) => {
        setPax(prev => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
    };

    // ───────────────────────── render pieces ─────────────────────────

    const renderSliceRow = (offer: FlightOffer, sliceIdx: number) => {
        const s = offer.slices[sliceIdx];
        if (!s) return null;
        return (
            <div key={sliceIdx} className="flex items-center justify-between">
                <div className="text-center w-20">
                    <div className="text-xl font-black text-gray-900 dark:text-white tracking-tighter">{s.origin}</div>
                    <div className="text-xs text-gray-500 font-bold">{fmtTime(s.departureTime)}</div>
                    <div className="text-[9px] text-gray-400">{fmtDay(s.departureTime)}</div>
                </div>
                <div className="flex-1 px-3 flex flex-col items-center">
                    <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-1">
                        <Clock size={10} /> {fmtDuration(s.durationMinutes)}
                    </div>
                    <div className="w-full border-t-2 border-dashed border-gray-300 dark:border-white/20 relative">
                        <Plane size={14} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-brand-orange bg-white dark:bg-brand-surface px-0.5" />
                    </div>
                    <div className={`text-[10px] font-bold mt-1 ${s.stops === 0 ? 'text-emerald-500' : 'text-orange-400'}`}>
                        {s.stops === 0 ? 'Nonstop' : `${s.stops} stop${s.stops > 1 ? 's' : ''}${s.segments[0] ? ` · ${s.segments[0].destination}` : ''}`}
                    </div>
                </div>
                <div className="text-center w-20">
                    <div className="text-xl font-black text-gray-900 dark:text-white tracking-tighter">{s.destination}</div>
                    <div className="text-xs text-gray-500 font-bold">{fmtTime(s.arrivalTime)}</div>
                    <div className="text-[9px] text-gray-400">{fmtDay(s.arrivalTime)}</div>
                </div>
            </div>
        );
    };

    const renderOfferCard = (offer: FlightOffer, i: number) => {
        const isHero = offer.tags?.includes('BEST_OVERALL');
        const expanded = expandedOffer === offer.id;
        return (
            <motion.div
                key={offer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.06, 0.4) }}
                className={`bg-white dark:bg-brand-surface border rounded-2xl overflow-hidden shadow-lg transition-all press press-card ${isHero ? 'border-brand-orange/50 ring-1 ring-brand-orange/30' : 'border-gray-200 dark:border-white/10 hover:border-brand-orange/30'}`}
            >
                {(offer.tags?.length || 0) > 0 && (
                    <div className="flex gap-1.5 px-4 pt-3 flex-wrap">
                        {offer.tags!.map(t => (
                            <span key={t} className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full flex items-center gap-1 ${TAG_STYLE[t].cls}`}>
                                {TAG_STYLE[t].icon} {TAG_STYLE[t].label}
                            </span>
                        ))}
                    </div>
                )}
                <div className="p-4 space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <AirlineLogo name={offer.airlineName} iata={offer.airlineIata} size={38} />
                            <div>
                                <div className="text-sm font-bold text-gray-900 dark:text-white">{offer.airlineName}</div>
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{offer.cabin.replace('_', ' ')}</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-black text-gray-900 dark:text-white">{fmtMoney(offer.totalAmount, offer.currency)}</div>
                            <div className="text-[10px] text-gray-500 font-bold">total · {passengers > 1 ? `${passengers} travelers` : '1 traveler'}</div>
                        </div>
                    </div>

                    {offer.slices.map((_, idx) => renderSliceRow(offer, idx))}

                    {isHero && offer.whyRecommended && (
                        <div className="bg-gradient-to-r from-brand-orange/10 to-brand-blue/10 border border-brand-orange/20 rounded-xl p-3">
                            <div className="text-[10px] font-black uppercase tracking-wider text-brand-orange mb-1.5 flex items-center gap-1">
                                <Sparkles size={11} /> Why Apollo picked this one
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {offer.whyRecommended.map(w => (
                                    <span key={w} className="text-[10px] font-bold text-gray-700 dark:text-gray-200 bg-white/60 dark:bg-white/10 px-2 py-0.5 rounded-md">✓ {w}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <AnimatePresence>
                    {expanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="px-4 pb-4 space-y-3">
                                {offer.slices.map((s, si) => (
                                    <div key={si} className="bg-gray-50 dark:bg-black/20 rounded-xl p-3 space-y-2">
                                        <div className="text-[10px] font-black uppercase tracking-wider text-gray-400">{si === 0 ? 'Outbound' : 'Return'}</div>
                                        {s.segments.map((seg, gi) => (
                                            <div key={gi} className="flex items-center gap-3 text-xs">
                                                <AirlineLogo name={seg.airlineName} iata={seg.airlineIata} size={24} />
                                                <div className="font-mono font-bold text-gray-700 dark:text-gray-200 w-16">{seg.flightNumber}</div>
                                                <div className="flex-1 text-gray-600 dark:text-gray-300">{seg.origin} {fmtTime(seg.departureTime)} → {seg.destination} {fmtTime(seg.arrivalTime)}</div>
                                                <div className="text-gray-400">{seg.aircraft || ''}</div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-gray-50 dark:bg-black/20 rounded-xl p-2">
                                        <Luggage size={14} className="mx-auto text-brand-blue mb-1" />
                                        <div className="text-[10px] font-bold dark:text-gray-200">{offer.carryOnBags} carry-on · {offer.checkedBags} checked</div>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-black/20 rounded-xl p-2">
                                        <RefreshCw size={14} className={`mx-auto mb-1 ${offer.changeable ? 'text-emerald-500' : 'text-gray-400'}`} />
                                        <div className="text-[10px] font-bold dark:text-gray-200">{offer.changeable ? 'Changes allowed' : 'No changes'}</div>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-black/20 rounded-xl p-2">
                                        <ShieldCheck size={14} className={`mx-auto mb-1 ${offer.refundable ? 'text-emerald-500' : 'text-gray-400'}`} />
                                        <div className="text-[10px] font-bold dark:text-gray-200">{offer.refundable ? 'Refundable' : 'Non-refundable'}</div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="bg-gray-50 dark:bg-white/5 px-4 py-3 flex justify-between items-center border-t border-gray-200 dark:border-white/5">
                    <button
                        onClick={() => setExpandedOffer(expanded ? null : offer.id)}
                        className="text-xs font-bold text-gray-500 dark:text-gray-300 flex items-center gap-1 hover:text-brand-orange transition"
                    >
                        {expanded ? <>Hide details <ChevronUp size={14} /></> : <>View details <ChevronDown size={14} /></>}
                    </button>
                    <button
                        onClick={() => startCheckout(offer)}
                        className={`px-5 py-2 rounded-xl text-sm font-black transition-all hover:scale-[1.03] active:scale-[0.97] shadow-lg ${isHero ? 'bg-gradient-to-r from-brand-orange to-red-500 text-white shadow-brand-orange/30' : 'bg-brand-blue text-white shadow-brand-blue/20'}`}
                    >
                        Book <ArrowRight size={14} className="inline -mt-0.5" />
                    </button>
                </div>
            </motion.div>
        );
    };

    // ───────────────────────── stages ─────────────────────────

    return (
        <div className="space-y-5 pb-24">
            {/* SEARCH */}
            {(stage === 'search' || stage === 'results') && (
                <div className="bg-white dark:bg-brand-surface/90 backdrop-blur-xl p-4 rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="bg-gradient-to-br from-brand-orange to-red-500 w-7 h-7 rounded-lg flex items-center justify-center shadow"><Ticket size={14} className="text-white" /></div>
                        <div>
                            <h3 className="text-sm font-black text-gray-900 dark:text-white leading-none">Book with Apollo</h3>
                            <p className="text-[10px] text-gray-500">Live fares, ranked by what actually matters to you</p>
                        </div>
                    </div>
                    <form onSubmit={handleSearch} className="space-y-3">
                        <div className="flex gap-2 items-center">
                            <div className="flex-1 relative">
                                <label className="absolute left-3 top-1.5 text-[9px] font-bold uppercase tracking-wider text-brand-orange">From</label>
                                <input
                                    value={origin}
                                    onChange={e => setOrigin(e.target.value.toUpperCase())}
                                    onFocus={() => setActiveInput('origin')}
                                    onBlur={() => setTimeout(() => setActiveInput(null), 200)}
                                    placeholder="ATL"
                                    autoComplete="off"
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-2.5 px-3 pt-6 text-gray-900 dark:text-white font-black text-lg focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                                />
                                {activeInput === 'origin' && suggestions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#151921] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                                        {suggestions.map(s => (
                                            <button type="button" key={s} onMouseDown={() => applySuggestion(s)} className="w-full text-left px-3 py-2 text-xs font-bold text-gray-900 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 border-b border-gray-100 dark:border-white/5 last:border-0">{s}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button type="button" onClick={() => { setOrigin(destination); setDestination(origin); }} className="p-2 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-500 hover:text-brand-orange transition mt-3">
                                <ArrowLeftRight size={14} />
                            </button>
                            <div className="flex-1 relative">
                                <label className="absolute left-3 top-1.5 text-[9px] font-bold uppercase tracking-wider text-brand-blue">To</label>
                                <input
                                    value={destination}
                                    onChange={e => setDestination(e.target.value.toUpperCase())}
                                    onFocus={() => setActiveInput('dest')}
                                    onBlur={() => setTimeout(() => setActiveInput(null), 200)}
                                    placeholder="LAX"
                                    autoComplete="off"
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-2.5 px-3 pt-6 text-gray-900 dark:text-white font-black text-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/50"
                                />
                                {activeInput === 'dest' && suggestions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#151921] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                                        {suggestions.map(s => (
                                            <button type="button" key={s} onMouseDown={() => applySuggestion(s)} className="w-full text-left px-3 py-2 text-xs font-bold text-gray-900 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 border-b border-gray-100 dark:border-white/5 last:border-0">{s}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <button type="button" onClick={() => setShowCalendar(true)} className="w-full flex items-center gap-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 hover:border-brand-orange/30 transition text-left">
                            <Calendar size={16} className="text-brand-orange" />
                            <div className="flex-1">
                                <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Dates</div>
                                <div className="text-sm font-bold text-gray-900 dark:text-white">
                                    {departureDate
                                        ? `${new Date(departureDate + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}${returnDate ? ` – ${new Date(returnDate + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}` : ' · one-way'}`
                                        : 'Pick your travel dates'}
                                </div>
                            </div>
                            <span className="text-[10px] text-gray-400">Change</span>
                        </button>

                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2">
                                <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1"><Users size={9} /> Travelers</div>
                                <div className="flex items-center justify-between mt-0.5">
                                    <button type="button" onClick={() => setPassengers(p => Math.max(1, p - 1))} className="w-6 h-6 rounded-md bg-gray-200 dark:bg-white/10 font-black text-gray-600 dark:text-gray-200">−</button>
                                    <span className="font-black text-gray-900 dark:text-white">{passengers}</span>
                                    <button type="button" onClick={() => setPassengers(p => Math.min(6, p + 1))} className="w-6 h-6 rounded-md bg-gray-200 dark:bg-white/10 font-black text-gray-600 dark:text-gray-200">+</button>
                                </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2">
                                <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Cabin</div>
                                <select value={cabin} onChange={e => setCabin(e.target.value as any)} className="w-full bg-transparent font-bold text-sm text-gray-900 dark:text-white dark:[color-scheme:dark] focus:outline-none mt-1 appearance-none cursor-pointer">
                                    <option value="economy" className="bg-white text-gray-900 dark:bg-[#151921] dark:text-white">Economy</option>
                                    <option value="premium_economy" className="bg-white text-gray-900 dark:bg-[#151921] dark:text-white">Premium</option>
                                    <option value="business" className="bg-white text-gray-900 dark:bg-[#151921] dark:text-white">Business</option>
                                    <option value="first" className="bg-white text-gray-900 dark:bg-[#151921] dark:text-white">First</option>
                                </select>
                            </div>
                            <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2">
                                <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Budget (opt.)</div>
                                <input value={budget} onChange={e => setBudget(e.target.value.replace(/[^\d]/g, ''))} placeholder="$1000" inputMode="numeric" className="w-full bg-transparent font-bold text-sm text-gray-900 dark:text-white focus:outline-none mt-1 placeholder-gray-400" />
                            </div>
                        </div>

                        <button type="submit" disabled={isSearching} className="w-full bg-gradient-to-r from-brand-orange to-red-500 text-white rounded-xl py-3 font-black shadow-lg shadow-brand-orange/30 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50">
                            {isSearching ? <Loader2 className="animate-spin" size={18} /> : <><Search size={18} strokeWidth={3} /> Find My Flights</>}
                        </button>
                    </form>
                </div>
            )}

            {/* RESULTS */}
            {stage === 'results' && (
                <div className="space-y-4">
                    {isSearching && (
                        <div className="bg-white dark:bg-brand-surface border border-gray-200 dark:border-white/10 rounded-2xl p-8 text-center">
                            <div className="inline-flex bg-gradient-to-br from-brand-orange/20 to-brand-blue/20 p-4 rounded-2xl mb-3 animate-pulse"><Sparkles size={28} className="text-brand-orange" /></div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">Apollo is sniffing out live fares…</p>
                            <p className="text-xs text-gray-500 mt-1">Searching real airline inventory and ranking every option.</p>
                        </div>
                    )}
                    {notConfigured && (
                        <div className="bg-gradient-to-r from-brand-orange/10 to-brand-blue/10 border border-brand-orange/20 rounded-2xl p-6 text-center">
                            <div className="inline-flex bg-white dark:bg-white/10 p-3 rounded-2xl mb-3 shadow"><Ticket size={24} className="text-brand-orange" /></div>
                            <h3 className="font-black text-gray-900 dark:text-white">Apollo's booking desk opens soon</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 max-w-sm mx-auto">Live airline inventory is being connected right now. Until then, keep tracking flights and building trips — booking lands here shortly.</p>
                        </div>
                    )}
                    {searchError && !isSearching && !notConfigured && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 text-center">
                            <AlertTriangle size={22} className="text-red-400 mx-auto mb-2" />
                            <p className="text-sm font-bold text-red-400">{searchError}</p>
                        </div>
                    )}
                    {!isSearching && offers.length > 0 && (
                        <>
                            <div className="flex justify-between items-end px-2">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><Sparkles size={16} className="text-brand-orange" /> Apollo's Recommendations</h3>
                                <span className="text-xs font-mono text-brand-orange">{offers.length} OPTIONS</span>
                            </div>
                            {lastParams?.totalBudget ? (
                                <p className="text-[11px] text-gray-500 px-2 -mt-2">Ranked for your {fmtMoney(lastParams.totalBudget, 'USD')} budget — price, time, comfort and flexibility all weighed in.</p>
                            ) : null}
                            {/* Desktop: two columns of offers instead of one long scroll */}
                            <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start">
                                {offers.map((o, i) => renderOfferCard(o, i))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* CHECKOUT */}
            {stage === 'checkout' && selectedOffer && (
                <div className="space-y-4">
                    <button onClick={() => setStage('results')} className="text-xs font-bold text-gray-500 dark:text-gray-300 flex items-center gap-1 hover:text-brand-orange transition px-1">
                        <ArrowLeft size={14} /> Back to results
                    </button>

                    {/* Booking state banner */}
                    <div className={`rounded-2xl p-4 border flex items-center gap-3 ${
                        bookingState === 'PRICE_CONFIRMED' ? 'bg-emerald-500/10 border-emerald-500/20' :
                        bookingState === 'PRICE_CHANGED' ? 'bg-orange-500/10 border-orange-500/20' :
                        ['PAYMENT_FAILED', 'BOOKING_FAILED', 'EXPIRED'].includes(bookingState) ? 'bg-red-500/10 border-red-500/20' :
                        'bg-brand-blue/10 border-brand-blue/20'
                    }`}>
                        {['REVALIDATING', 'PAYMENT_PENDING', 'BOOKING_PENDING'].includes(bookingState)
                            ? <Loader2 size={18} className="animate-spin text-brand-blue shrink-0" />
                            : bookingState === 'PRICE_CONFIRMED' ? <BadgeCheck size={18} className="text-emerald-500 shrink-0" />
                            : <AlertTriangle size={18} className="text-orange-400 shrink-0" />}
                        <div>
                            <div className="text-sm font-bold text-gray-900 dark:text-white">{STATE_LABELS[bookingState] || 'Preparing checkout…'}</div>
                            {bookingState === 'PRICE_CHANGED' && oldTotal !== null && (
                                <div className="text-xs text-gray-500 mt-0.5">
                                    Was {fmtMoneyExact(oldTotal, selectedOffer.currency)} → now <span className="font-bold text-gray-900 dark:text-white">{fmtMoneyExact(selectedOffer.totalAmount, selectedOffer.currency)}</span>. Airlines reprice constantly — this is today's real fare.
                                </div>
                            )}
                            {checkoutError && <div className="text-xs text-red-400 mt-0.5">{checkoutError}</div>}
                        </div>
                    </div>

                    {/* Trip summary */}
                    <div className="bg-white dark:bg-brand-surface border border-gray-200 dark:border-white/10 rounded-2xl p-4 space-y-4">
                        <div className="flex items-center gap-3">
                            <AirlineLogo name={selectedOffer.airlineName} iata={selectedOffer.airlineIata} size={38} />
                            <div className="flex-1">
                                <div className="text-sm font-bold text-gray-900 dark:text-white">{selectedOffer.airlineName}</div>
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{selectedOffer.cabin.replace('_', ' ')}</div>
                            </div>
                            <div className="text-xl font-black text-gray-900 dark:text-white">{fmtMoneyExact(selectedOffer.totalAmount, selectedOffer.currency)}</div>
                        </div>
                        {selectedOffer.slices.map((_, idx) => renderSliceRow(selectedOffer, idx))}
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-gray-600 dark:text-gray-300">
                            <div className="bg-gray-50 dark:bg-black/20 rounded-lg p-2 flex items-center gap-2"><Luggage size={12} className="text-brand-blue" /> {selectedOffer.carryOnBags} carry-on · {selectedOffer.checkedBags} checked bags</div>
                            <div className="bg-gray-50 dark:bg-black/20 rounded-lg p-2 flex items-center gap-2"><ShieldCheck size={12} className={selectedOffer.refundable ? 'text-emerald-500' : 'text-gray-400'} /> {selectedOffer.refundable ? 'Refundable' : 'Non-refundable'}{selectedOffer.changeable ? ' · changes allowed' : ''}</div>
                        </div>
                        {selectedOffer.baseAmount != null && (
                            <div className="text-[11px] text-gray-500 border-t border-gray-200 dark:border-white/10 pt-2 flex justify-between">
                                <span>Fare {fmtMoneyExact(selectedOffer.baseAmount, selectedOffer.currency)} + taxes & fees {fmtMoneyExact(selectedOffer.taxAmount || 0, selectedOffer.currency)}</span>
                                <span className="font-black text-gray-900 dark:text-white">Total {fmtMoneyExact(selectedOffer.totalAmount, selectedOffer.currency)}</span>
                            </div>
                        )}
                    </div>

                    {/* Passenger forms */}
                    {!['EXPIRED', 'REVALIDATING'].includes(bookingState) && (
                        <div className="space-y-3">
                            {pax.map((p, i) => (
                                <div key={i} className="bg-white dark:bg-brand-surface border border-gray-200 dark:border-white/10 rounded-2xl p-4 space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 flex items-center gap-1"><Users size={12} className="text-brand-orange" /> Traveler {i + 1}</h4>
                                    <div className="grid grid-cols-4 gap-2">
                                        <select value={p.title} onChange={e => updatePax(i, 'title', e.target.value)} className="col-span-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-2 py-2.5 text-sm font-bold text-gray-900 dark:text-white dark:[color-scheme:dark] focus:outline-none">
                                            <option value="mr" className="bg-white text-gray-900 dark:bg-[#151921] dark:text-white">Mr</option><option value="ms" className="bg-white text-gray-900 dark:bg-[#151921] dark:text-white">Ms</option><option value="mrs" className="bg-white text-gray-900 dark:bg-[#151921] dark:text-white">Mrs</option>
                                        </select>
                                        <input value={p.givenName} onChange={e => updatePax(i, 'givenName', e.target.value)} placeholder="First name" className="col-span-3 sm:col-span-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/40" />
                                        <input value={p.familyName} onChange={e => updatePax(i, 'familyName', e.target.value)} placeholder="Last name" className="col-span-2 sm:col-span-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/40" />
                                        <select value={p.gender} onChange={e => updatePax(i, 'gender', e.target.value)} className="col-span-2 sm:col-span-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-2 py-2.5 text-sm font-bold text-gray-900 dark:text-white dark:[color-scheme:dark] focus:outline-none">
                                            <option value="m" className="bg-white text-gray-900 dark:bg-[#151921] dark:text-white">Male</option><option value="f" className="bg-white text-gray-900 dark:bg-[#151921] dark:text-white">Female</option>
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <div>
                                            <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500 pl-1">Date of birth</label>
                                            <input type="date" value={p.bornOn} onChange={e => updatePax(i, 'bornOn', e.target.value)} className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-900 dark:text-white focus:outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500 pl-1">Email</label>
                                            <input type="email" value={p.email} onChange={e => updatePax(i, 'email', e.target.value)} placeholder="you@email.com" className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-900 dark:text-white focus:outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold uppercase tracking-wider text-gray-500 pl-1">Phone</label>
                                            <input type="tel" value={p.phone} onChange={e => updatePax(i, 'phone', e.target.value)} placeholder="+1 404 555 1234" className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-900 dark:text-white focus:outline-none" />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <button
                                onClick={confirmAndBook}
                                disabled={!paxValid || ['PAYMENT_PENDING', 'BOOKING_PENDING', 'REVALIDATING'].includes(bookingState)}
                                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl py-3.5 font-black shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-40 disabled:hover:scale-100"
                            >
                                {['PAYMENT_PENDING', 'BOOKING_PENDING'].includes(bookingState)
                                    ? <><Loader2 className="animate-spin" size={18} /> {STATE_LABELS[bookingState]}</>
                                    : <><ShieldCheck size={18} /> Confirm & Book · {fmtMoneyExact(selectedOffer.totalAmount, selectedOffer.currency)}</>}
                            </button>
                            <p className="text-[10px] text-gray-400 text-center px-4">
                                Tickets are issued directly with the airline. By booking you agree to the fare's cancellation terms shown above.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* CONFIRMATION */}
            {stage === 'confirmed' && booking && (
                <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                    <div className="bg-gradient-to-br from-emerald-500/15 to-brand-blue/10 border border-emerald-500/30 rounded-3xl p-6 text-center">
                        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/40 mb-4">
                            <CheckCircle size={32} className="text-white" />
                        </div>
                        <h3 className="text-xl font-black text-gray-900 dark:text-white">Booking Confirmed! 🎉</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Apollo fetched your ticket — it's a good boy thing.</p>
                        {!booking.liveMode && (
                            <div className="mt-3 inline-block bg-amber-500/15 border border-amber-500/30 text-amber-500 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full">Test mode — no real ticket issued</div>
                        )}
                        <div className="mt-4 bg-white dark:bg-black/30 rounded-2xl p-4 border border-gray-200 dark:border-white/10">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Confirmation code</div>
                            <div className="text-3xl font-black font-mono tracking-widest text-brand-orange mt-1">{booking.bookingReference}</div>
                            <div className="text-[10px] text-gray-400 mt-1">Use this code on {booking.offer.airlineName}'s website or app to check in.</div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-brand-surface border border-gray-200 dark:border-white/10 rounded-2xl p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <AirlineLogo name={booking.offer.airlineName} iata={booking.offer.airlineIata} size={36} />
                                <div className="text-sm font-bold text-gray-900 dark:text-white">{booking.offer.airlineName}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] text-gray-500 uppercase font-bold">Total paid</div>
                                <div className="text-lg font-black text-gray-900 dark:text-white">{fmtMoneyExact(booking.totalAmount, booking.currency)}</div>
                            </div>
                        </div>
                        {booking.offer.slices.map((_, idx) => renderSliceRow(booking.offer, idx))}
                        <div className={`rounded-xl p-3 text-xs font-bold flex items-center gap-2 ${tripName ? 'bg-brand-blue/10 text-brand-blue' : 'bg-gray-100 dark:bg-white/5 text-gray-500'}`}>
                            <BadgeCheck size={14} /> {tripName ? `Saved to My Trips as "${tripName}" — track it live in the Plans tab.` : 'Saving to My Trips…'}
                        </div>
                    </div>

                    <button
                        onClick={() => { setStage('search'); setBooking(null); setSelectedOffer(null); setOffers([]); }}
                        className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-3 font-bold text-sm text-gray-700 dark:text-gray-200 hover:border-brand-orange/40 transition"
                    >
                        Book another trip
                    </button>
                </motion.div>
            )}

            {showCalendar && (
                <CalendarPicker
                    isOpen={showCalendar}
                    onClose={() => setShowCalendar(false)}
                    mode="range"
                    initialDeparture={departureDate || new Date().toISOString().split('T')[0]}
                    initialReturn={returnDate}
                    onSelect={(dep, ret) => {
                        setDepartureDate(dep);
                        setReturnDate(ret || '');
                        setShowCalendar(false);
                    }}
                />
            )}
        </div>
    );
});
