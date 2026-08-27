// ── ÜrTC Travel Commerce Service ─────────────────────────────────────────
// The Smart Booking Model: CCD → ÜrTC → Apollo → Travel Booking Infrastructure.
//
// Architecture:
//   Apollo / UI  →  this service (normalized models + Smart Score ranking)
//                →  TravelProvider interface
//                →  DuffelAdapter → /duffel/** Firebase function (server-side key)
//
// The frontend never sees provider credentials and never touches provider
// objects directly — everything is normalized into ÜrTC's own models, so a
// second supplier can be added later without rebuilding the app.

import { getActiveUser } from './authService';

// ═══════════════════════════════ Normalized models ═══════════════════════

export interface FlightSegment {
    airlineName: string;
    airlineIata: string;
    flightNumber: string;
    origin: string;
    destination: string;
    departureTime: string; // ISO, local to airport
    arrivalTime: string;
    aircraft?: string;
    durationMinutes: number;
}

export interface FlightSlice {
    origin: string;
    destination: string;
    departureTime: string;
    arrivalTime: string;
    durationMinutes: number;
    stops: number;
    segments: FlightSegment[];
}

export interface FlightOffer {
    id: string;
    provider: 'duffel';
    /** What the customer pays, as a number in `currency` */
    totalAmount: number;
    currency: string;
    baseAmount?: number;
    taxAmount?: number;
    airlineName: string;
    airlineIata: string;
    cabin: string;
    slices: FlightSlice[];
    totalDurationMinutes: number;
    maxStops: number;
    refundable: boolean | null;
    changeable: boolean | null;
    carryOnBags: number;
    checkedBags: number;
    expiresAt?: string;
    /** Duffel passenger ids — required to create the order later */
    passengerIds: string[];
    // Smart Recommendation Engine output
    smartScore?: number;
    scoreBreakdown?: Record<string, number>;
    tags?: OfferTag[];
    whyRecommended?: string[];
}

export type OfferTag = 'BEST_OVERALL' | 'CHEAPEST' | 'FASTEST' | 'BEST_VALUE';

export type BookingState =
    | 'SEARCHED' | 'SELECTED' | 'REVALIDATING' | 'PRICE_CONFIRMED'
    | 'PAYMENT_PENDING' | 'PAYMENT_AUTHORIZED' | 'BOOKING_PENDING' | 'CONFIRMED'
    | 'PRICE_CHANGED' | 'PAYMENT_FAILED' | 'BOOKING_FAILED' | 'CANCELLED' | 'EXPIRED';

export interface FlightSearchParams {
    origin: string;          // IATA, e.g. ATL
    destination: string;     // IATA, e.g. LAX
    departureDate: string;   // YYYY-MM-DD
    returnDate?: string;     // YYYY-MM-DD (round trip when present)
    passengers: number;
    cabin: 'economy' | 'premium_economy' | 'business' | 'first';
    totalBudget?: number;    // whole-trip ceiling in USD
}

export interface PassengerDetails {
    title: 'mr' | 'ms' | 'mrs';
    givenName: string;
    familyName: string;
    bornOn: string;          // YYYY-MM-DD
    gender: 'm' | 'f';
    email: string;
    phone: string;           // E.164, e.g. +14045551234
}

export interface Booking {
    id: string;              // provider order id
    provider: 'duffel';
    bookingReference: string; // airline PNR the customer uses at check-in
    state: BookingState;
    offer: FlightOffer;
    passengers: { givenName: string; familyName: string }[];
    totalAmount: number;
    currency: string;
    createdAt: string;
    liveMode: boolean;
}

// ═══════════════════════════════ Provider interface ══════════════════════

export interface TravelProvider {
    searchFlights(params: FlightSearchParams): Promise<FlightOffer[]>;
    getFlightOffer(offerId: string): Promise<FlightOffer | null>;
    createFlightOrder(offer: FlightOffer, passengers: PassengerDetails[]): Promise<Booking>;
    getBooking(orderId: string): Promise<Booking | null>;
}

export class BookingEngineError extends Error {
    constructor(message: string, public code: 'NOT_CONFIGURED' | 'PROVIDER_ERROR' | 'OFFER_EXPIRED' | 'PAYMENT_FAILED' = 'PROVIDER_ERROR') {
        super(message);
    }
}

// ═══════════════════════════════ Duffel adapter ══════════════════════════

const parseIsoDuration = (iso: string | null | undefined): number => {
    if (!iso) return 0;
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!m) return 0;
    return (parseInt(m[1] || '0', 10) * 60) + parseInt(m[2] || '0', 10);
};

const minutesBetween = (a?: string, b?: string): number => {
    if (!a || !b) return 0;
    const ms = new Date(b).getTime() - new Date(a).getTime();
    return ms > 0 ? Math.round(ms / 60000) : 0;
};

const duffelFetch = async (path: string, init?: RequestInit): Promise<any> => {
    const uid = getActiveUser()?.id || 'guest';
    // Live-mode order creation is auth-gated server-side; send the Firebase
    // ID token when we have one so signed-in users pass the money guard.
    let idToken = '';
    try {
        const { auth } = await import('./firebaseClient');
        idToken = (await auth.currentUser?.getIdToken()) || '';
    } catch { /* guest — server decides if that's allowed */ }
    const res = await fetch(`/duffel${path}`, {
        ...init,
        signal: init?.signal ?? AbortSignal.timeout(45000),
        headers: {
            'Content-Type': 'application/json',
            'x-urtc-uid': uid,
            ...(idToken ? { 'x-urtc-auth': idToken } : {}),
            ...(init?.headers || {}),
        },
    });
    const json = await res.json().catch(() => null);
    if (res.status === 503 && json?.error === 'booking_engine_not_configured') {
        throw new BookingEngineError('The booking engine is still warming up — live inventory access has not been switched on yet.', 'NOT_CONFIGURED');
    }
    if (!res.ok) {
        const detail = json?.errors?.[0]?.message || json?.errors?.[0]?.title || json?.error || `HTTP ${res.status}`;
        if (json?.errors?.some((e: any) => /expired|not_found/i.test(e.code || ''))) {
            throw new BookingEngineError(detail, 'OFFER_EXPIRED');
        }
        throw new BookingEngineError(detail, 'PROVIDER_ERROR');
    }
    // A 200 that isn't JSON means the booking backend isn't deployed yet
    // (Firebase Hosting's catch-all served the app shell instead).
    if (!json || typeof json !== 'object') {
        throw new BookingEngineError('The booking engine is not live yet — deploy the duffel function and set its key.', 'NOT_CONFIGURED');
    }
    return json;
};

const normalizeOffer = (o: any, passengerIds: string[], cabin: string): FlightOffer => {
    const slices: FlightSlice[] = (o.slices || []).map((s: any) => {
        const segments: FlightSegment[] = (s.segments || []).map((seg: any) => ({
            airlineName: seg.marketing_carrier?.name || o.owner?.name || 'Airline',
            airlineIata: seg.marketing_carrier?.iata_code || o.owner?.iata_code || '',
            flightNumber: `${seg.marketing_carrier?.iata_code || ''}${seg.marketing_carrier_flight_number || ''}`,
            origin: seg.origin?.iata_code || '',
            destination: seg.destination?.iata_code || '',
            departureTime: seg.departing_at,
            arrivalTime: seg.arriving_at,
            aircraft: seg.aircraft?.name || undefined,
            durationMinutes: parseIsoDuration(seg.duration) || minutesBetween(seg.departing_at, seg.arriving_at),
        }));
        const first = segments[0];
        const last = segments[segments.length - 1];
        return {
            origin: first?.origin || s.origin?.iata_code || '',
            destination: last?.destination || s.destination?.iata_code || '',
            departureTime: first?.departureTime || '',
            arrivalTime: last?.arrivalTime || '',
            durationMinutes: parseIsoDuration(s.duration) || minutesBetween(first?.departureTime, last?.arrivalTime),
            stops: Math.max(0, segments.length - 1),
            segments,
        };
    });

    // Baggage allowance comes per segment-passenger; take the first as representative.
    let carryOn = 0, checked = 0;
    const bags = o.slices?.[0]?.segments?.[0]?.passengers?.[0]?.baggages || [];
    for (const b of bags) {
        if (b.type === 'carry_on') carryOn += b.quantity || 0;
        if (b.type === 'checked') checked += b.quantity || 0;
    }

    return {
        id: o.id,
        provider: 'duffel',
        totalAmount: parseFloat(o.total_amount || '0'),
        currency: o.total_currency || 'USD',
        baseAmount: o.base_amount ? parseFloat(o.base_amount) : undefined,
        taxAmount: o.tax_amount ? parseFloat(o.tax_amount) : undefined,
        airlineName: o.owner?.name || 'Airline',
        airlineIata: o.owner?.iata_code || '',
        cabin,
        slices,
        totalDurationMinutes: slices.reduce((a, s) => a + s.durationMinutes, 0),
        maxStops: slices.reduce((a, s) => Math.max(a, s.stops), 0),
        refundable: o.conditions?.refund_before_departure?.allowed ?? null,
        changeable: o.conditions?.change_before_departure?.allowed ?? null,
        carryOnBags: carryOn,
        checkedBags: checked,
        expiresAt: o.expires_at || undefined,
        passengerIds,
    };
};

class DuffelAdapter implements TravelProvider {
    async searchFlights(params: FlightSearchParams): Promise<FlightOffer[]> {
        const slices: any[] = [{
            origin: params.origin.toUpperCase(),
            destination: params.destination.toUpperCase(),
            departure_date: params.departureDate,
        }];
        if (params.returnDate) {
            slices.push({
                origin: params.destination.toUpperCase(),
                destination: params.origin.toUpperCase(),
                departure_date: params.returnDate,
            });
        }
        const body = {
            data: {
                slices,
                passengers: Array.from({ length: Math.max(1, params.passengers) }, () => ({ type: 'adult' })),
                cabin_class: params.cabin,
                max_connections: 1,
            },
        };
        const json = await duffelFetch('/air/offer_requests?return_offers=true&supplier_timeout=15000', {
            method: 'POST',
            body: JSON.stringify(body),
        });
        const passengerIds = (json.data?.passengers || []).map((p: any) => p.id);
        return (json.data?.offers || []).map((o: any) => normalizeOffer(o, passengerIds, params.cabin));
    }

    async getFlightOffer(offerId: string): Promise<FlightOffer | null> {
        const json = await duffelFetch(`/air/offers/${offerId}`);
        if (!json?.data) return null;
        const passengerIds = (json.data.passengers || []).map((p: any) => p.id);
        return normalizeOffer(json.data, passengerIds, json.data.cabin_class || 'economy');
    }

    async createFlightOrder(offer: FlightOffer, passengers: PassengerDetails[]): Promise<Booking> {
        const body = {
            data: {
                type: 'instant',
                selected_offers: [offer.id],
                payments: [{ type: 'balance', currency: offer.currency, amount: offer.totalAmount.toFixed(2) }],
                passengers: passengers.map((p, i) => ({
                    id: offer.passengerIds[i],
                    title: p.title,
                    given_name: p.givenName,
                    family_name: p.familyName,
                    born_on: p.bornOn,
                    gender: p.gender,
                    email: p.email,
                    phone_number: p.phone,
                })),
            },
        };
        // One idempotency key per checkout attempt: a retry after a timeout
        // must never issue (and pay for) a second ticket.
        const idem = (crypto as any).randomUUID ? crypto.randomUUID() : `ord-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const json = await duffelFetch('/air/orders', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'Idempotency-Key': idem },
        });
        const order = json.data;
        return {
            id: order.id,
            provider: 'duffel',
            bookingReference: order.booking_reference || order.id,
            state: 'CONFIRMED',
            offer,
            passengers: passengers.map(p => ({ givenName: p.givenName, familyName: p.familyName })),
            totalAmount: parseFloat(order.total_amount || String(offer.totalAmount)),
            currency: order.total_currency || offer.currency,
            createdAt: order.created_at || new Date().toISOString(),
            liveMode: !!order.live_mode,
        };
    }

    async getBooking(orderId: string): Promise<Booking | null> {
        const json = await duffelFetch(`/air/orders/${orderId}`);
        return json?.data ? (JSON.parse(localStorage.getItem(BOOKINGS_KEY) || '[]') as Booking[]).find(b => b.id === orderId) || null : null;
    }
}

// The active provider. Swap or multiplex here when new suppliers arrive.
const provider: TravelProvider = new DuffelAdapter();

// ═══════════════════════ Smart Recommendation Engine ═════════════════════

// Configurable weights — deliberately not hard-coded into the scorer.
export const SMART_WEIGHTS: Record<string, number> = {
    price: 0.30,
    duration: 0.20,
    convenience: 0.15,
    preferences: 0.20,
    quality: 0.10,
    flexibility: 0.05,
};

// Deterministic user preference storage — the "learning" seed. Every booking
// bumps airline affinity; airlines the user keeps choosing get a scoring boost.
const PREFS_KEY = 'urtc_travel_prefs';

export interface TravelPreferences {
    preferredAirlines: string[]; // IATA codes
    avoidedAirlines: string[];
    airlineAffinity: Record<string, number>; // learned from actual bookings
    preferNonstop: boolean;
}

export const getTravelPreferences = (): TravelPreferences => {
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        if (raw) return { preferredAirlines: [], avoidedAirlines: [], airlineAffinity: {}, preferNonstop: true, ...JSON.parse(raw) };
    } catch { /* corrupted prefs → defaults */ }
    return { preferredAirlines: [], avoidedAirlines: [], airlineAffinity: {}, preferNonstop: true };
};

export const saveTravelPreferences = (prefs: TravelPreferences) => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
};

const recordAirlineChoice = (iata: string) => {
    if (!iata) return;
    const prefs = getTravelPreferences();
    prefs.airlineAffinity[iata] = (prefs.airlineAffinity[iata] || 0) + 1;
    saveTravelPreferences(prefs);
};

// Rough mainline service-quality heuristic (deterministic placeholder until
// real quality data lands). 50 = unknown carrier.
const AIRLINE_QUALITY: Record<string, number> = {
    DL: 82, B6: 74, AS: 78, UA: 74, AA: 70, WN: 72, HA: 76,
    NK: 40, F9: 42, G4: 44,
    BA: 76, LH: 78, AF: 74, KL: 76, EK: 88, QR: 90, SQ: 92, NH: 88, JL: 86, QF: 82, KE: 80, CX: 84, TK: 78, VS: 80, AC: 72, WS: 70, IB: 70, U2: 55, FR: 45,
};

const normalizeAcross = (values: number[], invert = false): ((v: number) => number) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return () => 70;
    return (v: number) => {
        const t = (v - min) / (max - min);
        return Math.round((invert ? 1 - t : t) * 100);
    };
};

const departureConvenience = (iso: string): number => {
    const h = new Date(iso).getHours();
    if (h >= 8 && h <= 19) return 100;  // civilized daytime departure
    if (h >= 6 && h <= 21) return 70;
    return 30;                           // red-eye / dawn patrol
};

/** Score, tag, and sort offers. Mutates smartScore/tags/whyRecommended on each. */
export const rankOffers = (offers: FlightOffer[], params: FlightSearchParams): FlightOffer[] => {
    if (offers.length === 0) return offers;
    const prefs = getTravelPreferences();

    const priceScoreOf = normalizeAcross(offers.map(o => o.totalAmount), true);
    const durationScoreOf = normalizeAcross(offers.map(o => o.totalDurationMinutes), true);

    for (const o of offers) {
        const price = priceScoreOf(o.totalAmount);
        const duration = durationScoreOf(o.totalDurationMinutes);

        const stopsScore = o.maxStops === 0 ? 100 : o.maxStops === 1 ? 55 : 20;
        const convenience = Math.round(0.6 * stopsScore + 0.4 * departureConvenience(o.slices[0]?.departureTime || ''));

        let preferences = 60;
        if (prefs.preferredAirlines.includes(o.airlineIata)) preferences = 100;
        if ((prefs.airlineAffinity[o.airlineIata] || 0) >= 2) preferences = Math.max(preferences, 90);
        if (prefs.avoidedAirlines.includes(o.airlineIata)) preferences = 0;
        if (params.totalBudget && o.totalAmount > params.totalBudget) preferences = Math.round(preferences * 0.4);

        const quality = AIRLINE_QUALITY[o.airlineIata] ?? 50;
        const flexibility = (o.refundable ? 60 : 0) + (o.changeable ? 40 : 0);

        const breakdown = { price, duration, convenience, preferences, quality, flexibility };
        o.scoreBreakdown = breakdown;
        o.smartScore = Math.round(
            Object.entries(SMART_WEIGHTS).reduce((sum, [k, w]) => sum + w * (breakdown as any)[k], 0)
        );

        const why: string[] = [];
        if (o.maxStops === 0) why.push('Nonstop');
        if (params.totalBudget && o.totalAmount <= params.totalBudget) why.push('Fits your budget');
        if (prefs.preferredAirlines.includes(o.airlineIata) || (prefs.airlineAffinity[o.airlineIata] || 0) >= 2) why.push('An airline you like flying');
        if (departureConvenience(o.slices[0]?.departureTime || '') === 100) why.push('Comfortable departure time');
        if (o.refundable || o.changeable) why.push('Flexible if plans change');
        if (quality >= 75) why.push('Strong service quality');
        if (why.length === 0) why.push('Best balance of price and time in these results');
        o.whyRecommended = why;
        o.tags = [];
    }

    const sorted = [...offers].sort((a, b) => (b.smartScore || 0) - (a.smartScore || 0));

    // Headline picks
    sorted[0].tags!.push('BEST_OVERALL');
    const cheapest = offers.reduce((m, o) => (o.totalAmount < m.totalAmount ? o : m));
    cheapest.tags!.includes('BEST_OVERALL') || cheapest.tags!.push('CHEAPEST');
    const fastest = offers.reduce((m, o) => (o.totalDurationMinutes < m.totalDurationMinutes ? o : m));
    fastest.tags!.length || fastest.tags!.push('FASTEST');
    // Best value: non-price merit per dollar
    const value = offers.reduce((m, o) => {
        const merit = (o1: FlightOffer) => ((o1.scoreBreakdown!.duration + o1.scoreBreakdown!.convenience + o1.scoreBreakdown!.quality) / o1.totalAmount);
        return merit(o) > merit(m) ? o : m;
    });
    value.tags!.length || value.tags!.push('BEST_VALUE');

    return sorted;
};

// ═══════════════════════════ Public commerce API ═════════════════════════

export const searchFlightOffers = async (params: FlightSearchParams): Promise<FlightOffer[]> => {
    const offers = await provider.searchFlights(params);
    return rankOffers(offers, params);
};

/** Revalidate an offer right before checkout. Returns the fresh offer and whether the price moved. */
export const revalidateOffer = async (offer: FlightOffer): Promise<{ offer: FlightOffer; priceChanged: boolean; oldTotal: number }> => {
    const fresh = await provider.getFlightOffer(offer.id);
    if (!fresh) throw new BookingEngineError('This fare has expired — run the search again for current prices.', 'OFFER_EXPIRED');
    fresh.passengerIds = fresh.passengerIds.length ? fresh.passengerIds : offer.passengerIds;
    return { offer: fresh, priceChanged: Math.abs(fresh.totalAmount - offer.totalAmount) >= 0.01, oldTotal: offer.totalAmount };
};

const BOOKINGS_KEY = 'urtc_bookings';

export const getStoredBookings = (): Booking[] => {
    try { return JSON.parse(localStorage.getItem(BOOKINGS_KEY) || '[]'); } catch { return []; }
};

export const bookFlight = async (offer: FlightOffer, passengers: PassengerDetails[]): Promise<Booking> => {
    const booking = await provider.createFlightOrder(offer, passengers);
    // Persist locally (the server keeps its own revenue ledger in Firestore)
    const all = getStoredBookings();
    all.unshift(booking);
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(all.slice(0, 50)));
    recordAirlineChoice(offer.airlineIata);
    return booking;
};

/** Drop a confirmed booking into My Trips so it shows up with the itinerary. */
export const addBookingToTrips = async (booking: Booking, tripName?: string): Promise<string | null> => {
    const { fetchTrips, createTrip, addFlightToTrip } = await import('./tripService');
    const user = getActiveUser();
    const userId = user?.id || 'guest';
    const slice = booking.offer.slices[0];
    if (!slice) return null; // never let bookkeeping throw after a paid booking
    const name = tripName || `${slice.origin} → ${slice.destination} Trip`;

    const trips = await fetchTrips(userId);
    let trip = tripName ? trips.find(t => t.name.toLowerCase() === tripName.toLowerCase()) : trips.find(t => t.name === name);
    if (!trip) trip = (await createTrip(userId, name)) || undefined;
    if (!trip) return null;

    for (const s of booking.offer.slices) {
        for (const seg of s.segments) {
            await addFlightToTrip(userId, trip.id, seg.flightNumber, seg.departureTime, seg.airlineName, seg.origin, seg.destination);
        }
    }
    try { window.dispatchEvent(new CustomEvent('urtc-trips-changed')); } catch { /* SSR safe */ }
    return trip.name;
};
