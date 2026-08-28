
import { GoogleGenAI, Modality } from "@google/genai";
import { NewsArticle, Flight } from "../types";

import { API_KEYS } from "../config";

let aiClient: GoogleGenAI | null = null;

const getClient = () => {
    if (!aiClient && API_KEYS.GEMINI) {
        aiClient = new GoogleGenAI({ apiKey: API_KEYS.GEMINI });
    }
    return aiClient;
};

import { getActiveUser, hasDiamondAccess } from './authService';
import { fetchTrips } from './tripService';


// ── Apollo's hands: real actions he can take in the app ──
const APOLLO_TOOLS: any = [{
    functionDeclarations: [
        {
            name: 'list_trips',
            description: "List the user's trips with names and what's inside them.",
            parameters: { type: 'OBJECT', properties: {}, required: [] }
        },
        {
            name: 'create_trip',
            description: 'Create a new trip/plan for the user. ALWAYS pass every detail the user has told you (dates, destination, budget, travelers) — details you only say in chat are NOT saved.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    name: { type: 'STRING', description: 'Short trip name, e.g. "Tokyo Spring Adventure"' },
                    destination: { type: 'STRING', description: 'City/place, e.g. "Calais, France"' },
                    start_date: { type: 'STRING', description: 'YYYY-MM-DD' },
                    end_date: { type: 'STRING', description: 'YYYY-MM-DD' },
                    budget_limit: { type: 'NUMBER', description: 'Total trip budget in USD' },
                    travelers_count: { type: 'NUMBER' },
                    duration_days: { type: 'NUMBER' }
                },
                required: ['name']
            }
        },
        {
            name: 'update_trip_details',
            description: "Save or correct an existing trip's metadata: dates, destination, budget limit, travelers, duration. Use whenever the user gives details for a trip that already exists.",
            parameters: {
                type: 'OBJECT',
                properties: {
                    trip_name: { type: 'STRING' },
                    destination: { type: 'STRING' },
                    start_date: { type: 'STRING', description: 'YYYY-MM-DD' },
                    end_date: { type: 'STRING', description: 'YYYY-MM-DD' },
                    budget_limit: { type: 'NUMBER' },
                    travelers_count: { type: 'NUMBER' },
                    duration_days: { type: 'NUMBER' }
                },
                required: ['trip_name']
            }
        },
        {
            name: 'add_trip_note',
            description: "Save a note into a trip (itineraries, packing lists, recommendations, anything worth keeping). Use this whenever you write a plan the user will want later — chat scrolls away, notes don't.",
            parameters: {
                type: 'OBJECT',
                properties: {
                    trip_name: { type: 'STRING' },
                    title: { type: 'STRING', description: 'Short note title, e.g. "Day-by-day photography itinerary"' },
                    content: { type: 'STRING', description: 'The note body (plain text, "- " bullets welcome)' }
                },
                required: ['trip_name', 'title', 'content']
            }
        },
        {
            name: 'open_app_tab',
            description: "Navigate the app for the user — actually opens the tab on their screen. Use when they ask to see their trips, flights, explore, or booking ('show me my trips' → open_app_tab trips).",
            parameters: {
                type: 'OBJECT',
                properties: { tab: { type: 'STRING', description: 'One of: today, flights, explore, trips, about' } },
                required: ['tab']
            }
        },
        {
            name: 'get_flight_status',
            description: 'Look up LIVE data for a flight number (e.g. DAL1182, UA100): route, times, gates, delay, status. Always use this instead of guessing flight facts.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    flight_number: { type: 'STRING', description: 'Flight designator like DAL1182 or DL1182' },
                    date: { type: 'STRING', description: 'Optional date YYYY-MM-DD' }
                },
                required: ['flight_number']
            }
        },
        {
            name: 'add_trip_expenses',
            description: "Add one or more planned expenses to a trip's budget. Use when the user lists places they want to eat, stay, visit, or things they want to do/buy. Estimate a realistic USD cost for each item when the user doesn't give one (say costs are estimates). Write labels that name the thing clearly (e.g. 'Dinner at Nobu Malibu', 'Uber from LAX', 'Getty Museum tickets') — the app auto-files each into Flights/Stays/Food/Transit/Shopping/Experiences by its label.",
            parameters: {
                type: 'OBJECT',
                properties: {
                    trip_name: { type: 'STRING', description: 'Name of an existing trip (from list_trips), or a new one to create' },
                    expenses: {
                        type: 'ARRAY',
                        description: 'The expenses to add',
                        items: {
                            type: 'OBJECT',
                            properties: {
                                label: { type: 'STRING', description: 'Clear name, e.g. "Dinner at Nobu Malibu"' },
                                cost: { type: 'NUMBER', description: 'Cost in USD (realistic estimate if unknown)' }
                            },
                            required: ['label', 'cost']
                        }
                    }
                },
                required: ['trip_name', 'expenses']
            }
        },
        {
            name: 'search_bookable_flights',
            description: 'Search LIVE bookable airline inventory with real prices for a route and dates, ranked by Apollo Smart Score (price, duration, convenience, user preferences, quality, flexibility). Use when the user wants to BOOK, BUY, or price a future flight. Returns the top options with prices and why each is recommended.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    origin: { type: 'STRING', description: '3-letter IATA airport code, e.g. ATL' },
                    destination: { type: 'STRING', description: '3-letter IATA airport code, e.g. LAX' },
                    departure_date: { type: 'STRING', description: 'YYYY-MM-DD' },
                    return_date: { type: 'STRING', description: 'Optional YYYY-MM-DD for round trips' },
                    passengers: { type: 'NUMBER', description: 'Number of travelers, default 1' },
                    cabin: { type: 'STRING', description: 'economy | premium_economy | business | first (default economy)' },
                    total_budget: { type: 'NUMBER', description: 'Optional whole-trip budget ceiling in USD' }
                },
                required: ['origin', 'destination', 'departure_date']
            }
        },
        {
            name: 'add_flight_to_trip',
            description: "Save a flight into one of the user's trips. If the trip doesn't exist yet, call create_trip first.",
            parameters: {
                type: 'OBJECT',
                properties: {
                    trip_name: { type: 'STRING', description: 'Name of an existing trip (from list_trips or create_trip)' },
                    flight_number: { type: 'STRING' },
                    date: { type: 'STRING', description: 'Optional date YYYY-MM-DD' }
                },
                required: ['trip_name', 'flight_number']
            }
        }
    ]
}];

const notifyTripsChanged = () => {
    try { window.dispatchEvent(new CustomEvent('urtc-trips-changed')); } catch { /* SSR safe */ }
};

const executeApolloTool = async (name: string, args: any, userId: string): Promise<any> => {
    try {
        switch (name) {
            case 'list_trips': {
                const trips = await fetchTrips(userId);
                return { trips: trips.map(t => ({ name: t.name, flights: (t.flights || []).length, notes: (t.notes || []).length, archived: !!t.archived })) };
            }
            case 'create_trip': {
                const { createTrip } = await import('./tripService');
                const details: any = {};
                if (args.destination) details.destination = String(args.destination);
                if (args.start_date) details.start_date = String(args.start_date);
                if (args.end_date) details.end_date = String(args.end_date);
                if (args.budget_limit) details.budget_limit = Number(args.budget_limit) || 0;
                if (args.travelers_count) details.travelers_count = Number(args.travelers_count) || 1;
                if (args.duration_days) details.duration_days = Number(args.duration_days) || 0;
                const trip = await createTrip(userId, String(args.name || 'New Trip'), details);
                if (trip) notifyTripsChanged();
                return trip ? { ok: true, trip_name: trip.name, saved_details: Object.keys(details) } : { ok: false, error: 'Could not create trip' };
            }
            case 'update_trip_details': {
                const { updateTrip } = await import('./tripService');
                const trips = await fetchTrips(userId);
                const wanted = String(args.trip_name || '').toLowerCase();
                const trip = trips.find(t => t.name.toLowerCase() === wanted) || trips.find(t => t.name.toLowerCase().includes(wanted));
                if (!trip) return { ok: false, error: 'Trip not found', available_trips: trips.map(t => t.name) };
                const updates: any = {};
                if (args.destination) updates.destination = String(args.destination);
                if (args.start_date) updates.start_date = String(args.start_date);
                if (args.end_date) updates.end_date = String(args.end_date);
                if (args.budget_limit) updates.budget_limit = Number(args.budget_limit) || 0;
                if (args.travelers_count) updates.travelers_count = Number(args.travelers_count) || 1;
                if (args.duration_days) updates.duration_days = Number(args.duration_days) || 0;
                if (!Object.keys(updates).length) return { ok: false, error: 'No details provided' };
                const ok = await updateTrip(trip.id, updates);
                if (ok) notifyTripsChanged();
                return ok ? { ok: true, trip_name: trip.name, saved: Object.keys(updates) } : { ok: false, error: 'Could not save details' };
            }
            case 'add_trip_note': {
                const { updateTrip } = await import('./tripService');
                const trips = await fetchTrips(userId);
                const wanted = String(args.trip_name || '').toLowerCase();
                const trip = trips.find(t => t.name.toLowerCase() === wanted) || trips.find(t => t.name.toLowerCase().includes(wanted));
                if (!trip) return { ok: false, error: 'Trip not found', available_trips: trips.map(t => t.name) };
                const note = {
                    id: (crypto as any).randomUUID ? crypto.randomUUID() : `note-${Date.now()}`,
                    tripName: trip.name,
                    city: trip.destination || '',
                    stateCountry: '',
                    title: String(args.title || 'Apollo note').slice(0, 100),
                    content: String(args.content || '').slice(0, 5000),
                    date: new Date(),
                    isAiGenerated: true,
                };
                const ok = await updateTrip(trip.id, { notes: [...(trip.notes || []), note] as any });
                if (ok) notifyTripsChanged();
                return ok ? { ok: true, trip_name: trip.name, note_title: note.title, hint: 'Tell the user it is saved under the trip\'s Notes tab.' } : { ok: false, error: 'Could not save the note' };
            }
            case 'open_app_tab': {
                const tab = String(args.tab || '').toLowerCase();
                if (!['today', 'home', 'flights', 'explore', 'trips', 'plans', 'about'].includes(tab)) {
                    return { ok: false, error: 'Unknown tab', valid_tabs: ['today', 'flights', 'explore', 'trips', 'about'] };
                }
                try { window.dispatchEvent(new CustomEvent('urtc-navigate', { detail: { tab } })); } catch { /* SSR safe */ }
                return { ok: true, opened: tab, hint: 'The tab is now open on their screen — confirm in one short line.' };
            }
            case 'get_flight_status': {
                const { fetchRealFlights, fetchForesightFlight } = await import('./apiService');
                const flights = await fetchRealFlights(String(args.flight_number || ''), args.date ? String(args.date) : undefined);
                if (!flights.length) return { found: false, hint: 'No flights matched. Check the flight number.' };
                const result: any = {
                    found: true,
                    flights: flights.slice(0, 3).map(f => ({
                        ident: f.flightNumber, airline: f.airline, route: `${f.departureAirport} to ${f.arrivalAirport}`,
                        status: f.status, scheduled_departure: f.departureTime, estimated_departure: f.estimatedDepartureTime,
                        scheduled_arrival: f.arrivalTime, gate: f.gate, terminal: f.terminal, delay_minutes: f.delayMinutes || 0
                    }))
                };
                // Foresight ML predictions — a Diamond perk. Never a blocker if it fails.
                try {
                    if (hasDiamondAccess(getActiveUser())) {
                        const fs = await fetchForesightFlight(flights[0].id);
                        const p = fs?.foresight;
                        if (p && (p.predicted_out || p.predicted_in || p.predicted_on)) {
                            result.flights[0].ai_predicted_departure = p.predicted_out || undefined;
                            result.flights[0].ai_predicted_arrival = p.predicted_in || p.predicted_on || undefined;
                            result.note = 'ai_predicted_* times are Foresight machine-learning predictions — quote them as AI predictions, in local time with timezone.';
                        }
                    }
                    // NOTE: do not advertise AI predictions to free users until the
                    // account has Foresight access — otherwise Diamond can't deliver it.
                } catch (e) { /* predictions are a bonus */ }
                return result;
            }
            case 'add_trip_expenses': {
                const { createTrip, updateTrip } = await import('./tripService');
                const trips = await fetchTrips(userId);
                const wanted = String(args.trip_name || '').toLowerCase();
                let trip = trips.find(t => t.name.toLowerCase() === wanted) || trips.find(t => t.name.toLowerCase().includes(wanted));
                if (!trip) {
                    trip = await createTrip(userId, String(args.trip_name)) || undefined;
                    if (!trip) return { ok: false, error: 'Trip not found and could not be created', available_trips: trips.map(t => t.name) };
                }
                // Dedupe: a reworded confirmation must never double-count the
                // budget (this exact bug once added $8,900 twice).
                const existing = new Set((trip.budget_categories || []).map((b: any) =>
                    `${String(b.label || '').trim().toLowerCase()}|${b.planned}`));
                const rawAdditions = (Array.isArray(args.expenses) ? args.expenses : [])
                    .map((e: any, i: number) => ({
                        id: (crypto as any).randomUUID ? crypto.randomUUID() : `budget-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
                        type: 'Other',
                        label: String(e.label || 'Expense').slice(0, 80),
                        planned: Math.max(0, Number(e.cost) || 0),
                    }))
                    .filter((e: any) => e.label && e.planned >= 0);
                const additions = rawAdditions.filter((e: any) => !existing.has(`${e.label.trim().toLowerCase()}|${e.planned}`));
                const skipped = rawAdditions.length - additions.length;
                if (!additions.length) {
                    return skipped > 0
                        ? { ok: true, added: 0, skipped_duplicates: skipped, note: 'Those expenses are already in the budget — do NOT re-add them. Just answer the user.' }
                        : { ok: false, error: 'No valid expenses provided' };
                }
                const ok = await updateTrip(trip.id, { budget_categories: [...(trip.budget_categories || []), ...additions] as any });
                if (ok) notifyTripsChanged();
                return ok
                    ? { ok: true, trip_name: trip.name, added: additions.length, skipped_duplicates: skipped, total_added_usd: additions.reduce((s: number, e: any) => s + e.planned, 0), note: 'Tell the user the expenses are filed by category in the trip\'s Budget tab, and that any costs you estimated are estimates they can edit with the pencil. NEVER call this tool again just to reformat or restate a budget.' }
                    : { ok: false, error: 'Could not save the expenses' };
            }
            case 'search_bookable_flights': {
                const { searchFlightOffers, BookingEngineError } = await import('./travelCommerceService');
                const params = {
                    origin: String(args.origin || '').toUpperCase().slice(0, 3),
                    destination: String(args.destination || '').toUpperCase().slice(0, 3),
                    departureDate: String(args.departure_date || ''),
                    returnDate: args.return_date ? String(args.return_date) : undefined,
                    passengers: Number(args.passengers) || 1,
                    cabin: (['economy', 'premium_economy', 'business', 'first'].includes(String(args.cabin)) ? String(args.cabin) : 'economy') as any,
                    totalBudget: args.total_budget ? Number(args.total_budget) : undefined,
                };
                // Pre-load the Book tab so "book it" is one tap away for the user
                try {
                    localStorage.setItem('urtc_booking_prefill', JSON.stringify({
                        origin: params.origin, destination: params.destination,
                        departureDate: params.departureDate, returnDate: params.returnDate,
                        passengers: params.passengers, cabin: params.cabin, budget: params.totalBudget,
                        autoSearch: true,
                    }));
                } catch { /* non-critical */ }
                try {
                    const offers = await searchFlightOffers(params);
                    if (!offers.length) return { found: false, hint: 'No bookable flights for that route/date. Suggest nearby dates or airports.' };
                    return {
                        found: true,
                        options: offers.slice(0, 4).map(o => ({
                            tag: o.tags?.[0] || null,
                            airline: o.airlineName,
                            total_price: `${o.totalAmount.toFixed(2)} ${o.currency}`,
                            nonstop: o.maxStops === 0,
                            stops: o.maxStops,
                            departure: o.slices[0]?.departureTime,
                            arrival: o.slices[0]?.arrivalTime,
                            duration_minutes: o.totalDurationMinutes,
                            refundable: o.refundable,
                            why_recommended: o.whyRecommended,
                            smart_score: o.smartScore,
                        })),
                        note: 'These are LIVE bookable fares. Summarize the top pick and why. Then tell the user: to complete the booking, open the Flights tab and tap "Book Travel" — the search is already loaded there for them. You cannot complete the purchase in chat.',
                    };
                } catch (e: any) {
                    if (e instanceof BookingEngineError && e.code === 'NOT_CONFIGURED') {
                        return { available: false, message: 'The booking engine is not switched on yet. Tell the user booking inside the app is coming very soon, and offer flight-tracking help meanwhile.' };
                    }
                    throw e;
                }
            }
            case 'add_flight_to_trip': {
                const { createTrip, addFlightToTrip } = await import('./tripService');
                const trips = await fetchTrips(userId);
                const wanted = String(args.trip_name || '').toLowerCase();
                let trip = trips.find(t => t.name.toLowerCase() === wanted) || trips.find(t => t.name.toLowerCase().includes(wanted));
                if (!trip) {
                    trip = await createTrip(userId, String(args.trip_name)) || undefined;
                    if (!trip) return { ok: false, error: 'Trip not found and could not be created', available_trips: trips.map(t => t.name) };
                }
                const { fetchRealFlights } = await import('./apiService');
                const flights = await fetchRealFlights(String(args.flight_number || ''), args.date ? String(args.date) : undefined);
                const f = flights[0];
                const ok = await addFlightToTrip(
                    userId, trip.id,
                    f?.flightNumber || String(args.flight_number).toUpperCase(),
                    f?.departureTime || (args.date ? String(args.date) : ''),
                    f?.airline || '', f?.departureAirport || '', f?.arrivalAirport || ''
                );
                if (ok) notifyTripsChanged();
                return ok
                    ? { ok: true, trip_name: trip.name, saved_flight: f ? { ident: f.flightNumber, route: `${f.departureAirport} to ${f.arrivalAirport}`, status: f.status, departure: f.departureTime } : { ident: String(args.flight_number).toUpperCase() } }
                    : { ok: false, error: 'Could not save the flight' };
            }
            default:
                return { error: `Unknown tool: ${name}` };
        }
    } catch (e: any) {
        console.error('Apollo tool error', name, e);
        return { error: e?.message || 'Tool execution failed' };
    }
};

const APOLLO_SYSTEM_PROMPT = (tripsContext: string) => {
    const lastCity = localStorage.getItem('urtc_last_city') || 'unknown';
    let flightCtx = 'none';
    try {
        const raw = localStorage.getItem('urtc_last_flight_context');
        if (raw) {
            const fc = JSON.parse(raw);
            // Only treat it as current if viewed within the last 48h
            if (fc.viewed_at && Date.now() - new Date(fc.viewed_at).getTime() < 48 * 60 * 60 * 1000) {
                flightCtx = JSON.stringify(fc);
            }
        }
    } catch (e) { /* ignore */ }
    const today = new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return `You are Apollo, the AI companion at the heart of ÜrTC — the travel commerce app. A smart, loyal dog who happens to be a world-class travel expert. ÜrTC's identity: "a Travel Commerce app, with Apollo, the AI Companion" — people don't just plan here, they track, book, and manage real travel, with you beside them the whole way.

PERSONALITY:
- Warm, sharp, and genuinely useful. You get people the right answer fast.
- Dog mannerisms: at most one subtle touch per response ("pawsome", a single "woof"). Never more. No asterisk actions.
- Keep responses short. Lead with the answer, then supporting detail.
- FORMATTING: the chat renders **bold**, "- " bullet lines, and "1." numbered lines — nothing else. Use "- " bullets for lists (the user LIKES bullets). No headers, no tables, no links-as-markdown.
- Convert times to the local time of the relevant airport/city and say the timezone (e.g. "4:16 PM ET"). Never show raw UTC.

JUDGMENT — think like a person, not a menu:
- Read what they actually want, not just the words. "Where should I eat tonight?" wants two or three real suggestions, not a question back. "Can you show me my trips?" wants the tab OPENED. "What's my budget looking like?" wants the number and a verdict, not a tour.
- Take the smallest action that answers them. Don't open a tab they're already looking at, don't re-list trips you just listed, don't re-search something you searched a moment ago — answer from what you already know.
- One tool call is better than three. Only reach for a tool when it gets real data or changes something; never call one to decorate an answer you could already give.
- Navigate when SEEING it is the point (their trips, a booking screen, a place on the map). Stay put when the answer is just words — telling someone the weather doesn't require moving them anywhere.
- Ask a clarifying question only when you genuinely cannot act without it. If a sensible default exists, take it and say what you assumed.
- If they seem frustrated or something failed, say so plainly in one line and offer the next move. Never pretend an action worked.

GOLDEN RULE — SAVE WHAT YOU SAY:
- Anything you only say in chat is NOT saved. If you tell the user their trip has dates, a budget, or an itinerary, you MUST have called the tool that saves it (create_trip with details / update_trip_details / add_trip_note / add_trip_expenses). Never claim something is saved unless a tool confirmed ok:true.
- NEVER re-call a saving tool just to reformat, summarize, or restate — that duplicates data. Reformatting is chat-only.

TRAVEL EXPERTISE:
- Give specific, actionable advice: real neighborhoods, dishes, transit lines, timing tips.
- For prices, give realistic current ranges and say they're estimates. Never invent exact prices for specific businesses.
- Flag safety/scam/weather considerations when genuinely relevant.
- If you don't know something current (e.g., today's flight status), say so and point to the app's Flights tab (live real-time data) instead of guessing. Never mention FlightAware or any external flight-tracking website — ÜrTC's Flights tab IS the flight tracker.

APP KNOWLEDGE (ÜrTC):
- Flights tab: live flight tracking, airport boards, delays — plus "Book Travel" mode with live bookable fares ranked by your Smart Score.
- Explore tab: nearby food & attractions with prices and weather.
- Plans tab: trips, itineraries, budgets.
- Tiers: Silver/free (basic tracking, manual budgets, 15 Apollo chats/day), Diamond (real-time flight alerts pushed to your device, no ads, unlimited Apollo), Professional (everything in Diamond, for industry users).
- If flight data ever includes ai_predicted_* fields, those are machine-learning predictions — quote them as AI predictions, in local time with timezone. Never promise AI predictions when the data doesn't include them.

CONTEXT:
- Today: ${today}
- User's last browsed city: ${lastCity}
- Flight the user most recently viewed (treat as "my flight" when they say that): ${flightCtx}

YOUR HANDS (TOOLS) — you can actually DO things, not just talk:
- get_flight_status: ALWAYS use this when the user mentions a flight number — answer from real data, never guess.
- search_bookable_flights: when the user wants to BOOK or price a trip ("I need to fly ATL to LAX Friday, under $1000"), interpret their request into origin/destination/dates/budget and USE THIS — real prices, never estimates. Present the top pick with its price and why, then point them to Flights tab → Book Travel (their search is already loaded there). You cannot take payment in chat.
- create_trip / update_trip_details / add_flight_to_trip / list_trips: when the user asks you to plan, create, save, or track something — DO IT, then confirm in one friendly line what you did. Never say you can't create trips. When they give dates, destination, budget, or travelers, SAVE them via create_trip's fields or update_trip_details — every time, no exceptions.
- add_trip_note: after writing any itinerary or plan longer than a few lines, save it as a note on the trip (title + content) so it survives past the chat. Confirm: "saved to your trip's Notes."
- add_trip_expenses: when the user lists places or plans with costs, turn the raw list into labeled expenses with realistic estimated costs and file them ONCE — the Budget tab organizes them by category automatically. Confirm totals and remind them estimates are editable. Never call it again to reformat.
- open_app_tab: when the user asks to SEE something (their trips, the booking screen, explore), open the tab for them and say you did — don't give walking directions to a tab you can open yourself.
- After get_flight_status for a flight the user cares about, offer once: "want me to save this to a trip?" — and use add_flight_to_trip if they say yes.
- Typical flow: user says "add DL1182 to my Tokyo trip" → get_flight_status → add_flight_to_trip → confirm with the flight's real status.
- Typical booking flow: "get me to LA next weekend under $800" → search_bookable_flights → summarize top options with real prices → "tap Book Travel in the Flights tab to grab it".

COMPANION BEHAVIOR:
- When the user asks about "my flight", their trip, delays, or timing, USE the flight context above — answer with its actual status, gate, and times instead of asking which flight. If the context includes predicted_departure/predicted_arrival, those are Foresight AI predictions (Diamond perk) — use them for "when will I actually land" questions.
- If their flight is delayed, be proactive: mention the new time, and suggest what the delay means for connections, food time, or ground plans.
- Connect the dots across the app: if they ask what to do near the airport during a delay, use their last browsed city and suggest the Explore tab.
- ${tripsContext}`;
};

export const streamApolloResponse = async (
    userMessage: string,
    history: { role: string; parts: { text: string }[] }[],
    onChunk: (text: string) => void
) => {
    const client = getClient();
    if (!client) {
        onChunk("Woof! My connection's a bit ruff (API Key missing).");
        return;
    }

    let tripsContext = "The user has no trips currently planned.";
    try {
        const user = getActiveUser();
        if (user && user.id) {
            const trips = await fetchTrips(user.id);
            if (trips && trips.length > 0) {
                tripsContext = `The user has ${trips.length} trips. Context: ` + JSON.stringify(trips.map(t => ({
                    name: t.name,
                    flights: (t.flights || []).map((f: any) => `${f.airline} ${f.flight_number} to ${f.arrival_airport}`),
                    budget: (t.budget_categories || []).reduce((a: number, c: any) => a + (c.planned || 0), 0)
                })));
            }
        }
    } catch (e) { console.error("Failed to load trips context", e); }

    // Clean the history: drop empty turns, cap at the last 20 to stay under token limits
    const contents = [
        ...history
            .filter(h => h.parts?.[0]?.text?.trim())
            .slice(-20)
            .map(h => ({ role: h.role === 'model' ? 'model' : 'user', parts: h.parts })),
        { role: 'user', parts: [{ text: userMessage }] }
    ];

    const systemInstruction = APOLLO_SYSTEM_PROMPT(tripsContext);

    // Round 1: agent mode with tools — Apollo can look up flights and edit trips.
    // (Google Search grounding can't be combined with function tools, so tool mode
    // runs first and we fall back to search-grounded chat if it fails.)
    let toolsRan = false; // tools have side effects — never silently re-answer after they fired
    try {
        const user = getActiveUser();
        const userId = user?.id || 'guest';
        const convo: any[] = [...contents];
        for (let turn = 0; turn < 5; turn++) {
            const resp: any = await client.models.generateContent({
                model: 'gemini-3.6-flash',
                contents: convo,
                config: { systemInstruction, temperature: 0.7, tools: APOLLO_TOOLS }
            });
            const cand = resp.candidates?.[0];
            const parts = cand?.content?.parts || [];
            const calls = parts.filter((p: any) => p.functionCall);
            if (calls.length > 0) {
                toolsRan = true;
                convo.push(cand.content);
                for (const c of calls) {
                    const result = await executeApolloTool(c.functionCall.name, c.functionCall.args || {}, userId);
                    convo.push({ role: 'user', parts: [{ functionResponse: { name: c.functionCall.name, response: { result } } }] });
                }
                continue; // let him read the tool results and keep working
            }
            const text = resp.text;
            if (text) { onChunk(text); return; }
            break;
        }
        if (toolsRan) {
            // The work happened but the model never wrote a closing line —
            // falling through to search-chat would redo tool calls blind.
            onChunk("Done! Check your Plans tab — everything's saved. 🐾");
            return;
        }
    } catch (error) {
        console.error('Apollo agent mode failed, falling back to chat:', error);
        if (toolsRan) {
            onChunk("I got part of that done before my connection hiccuped — check your Plans tab to see what saved, then ask me to finish the rest.");
            return;
        }
    }

    // Fallbacks: search-grounded chat, then plain chat.
    const attempts: Array<{ tools?: any[] }> = [
        { tools: [{ googleSearch: {} }] },
        {}
    ];

    for (let i = 0; i < attempts.length; i++) {
        try {
            const responseStream = await client.models.generateContentStream({
                model: 'gemini-3.6-flash',
                contents,
                config: {
                    systemInstruction,
                    temperature: 0.7,
                    ...attempts[i]
                }
            });

            let emitted = false;
            for await (const chunk of responseStream) {
                if (chunk.text) {
                    emitted = true;
                    onChunk(chunk.text);
                }
            }
            if (emitted) return; // success
        } catch (error) {
            console.error(`Apollo Chat Error (attempt ${i + 1}):`, error);
        }
    }

    onChunk("Woof… I couldn't reach my brain just now. Give it a few seconds and ask again — if it keeps happening, the daily free AI quota may be used up.");
};

/**
 * Apollo's one-paragraph verdict on a place, for the detail sheet.
 * Deliberately short — it sits above the real reviews, not instead of them.
 */
export const generatePlaceInsight = async (
    name: string, city: string, category: string, rating?: number, priceDisplay?: string
): Promise<string | null> => {
    const client = getClient();
    if (!client) return null;
    // Cache per place for the session: browsing back and forth through the
    // same few spots must not bill us for the same sentence twice.
    const cacheKey = `urtc_place_ai_${name}|${city}`.slice(0, 180);
    try {
        const hit = sessionStorage.getItem(cacheKey);
        if (hit) return hit;
    } catch { /* private mode — just skip the cache */ }
    try {
        const response = await client.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: [{
                role: 'user',
                parts: [{
                    text: `You are Apollo, a warm and sharp travel companion (a golden retriever with world-class travel knowledge).
Give your take on "${name}" in ${city} — a ${category}${rating ? `, rated ${rating}/5` : ''}${priceDisplay ? `, price ${priceDisplay}` : ''}.

Rules:
- 2 sentences maximum, under 40 words total.
- Say what it's genuinely good for and one practical tip (best time, what to order, what to skip, how long to allow).
- Plain text only. No markdown, no bullet points, no emoji.
- At most one light dog-ism, and only if it fits naturally. Usually none.
- If you don't actually know this specific place, speak generally about that kind of spot in that city rather than inventing details.`
                }]
            }],
            // No maxOutputTokens: this model spends tokens thinking first, so a
            // tight cap truncates the answer to a fragment. The prompt does the
            // limiting instead.
            config: { temperature: 0.7 }
        });
        const text = response.text?.trim() || null;
        // Never show (or cache) a fragment — a truncated or echoed prompt is
        // worse than falling back to the place's own editorial summary.
        const usable = text && text.length >= 40 && /[.!?]$/.test(text) ? text : null;
        if (usable) { try { sessionStorage.setItem(cacheKey, usable); } catch { /* ignore */ } }
        return usable;
    } catch (e) {
        console.error('Place insight error', e);
        return null;
    }
};

export const fetchGeminiNews = async (city: string): Promise<NewsArticle[]> => {
    const client = getClient();
    if (!client) return [];

    try {
        const response = await client.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: [{
                role: 'user',
                parts: [{
                    text: `Perform a Google Search to find 3 distinct, high-quality, and recent travel articles or guides for ${city}. Return RAW JSON array. Fields: title, source, publishedAt, url, imageUrl (empty string).`
                }]
            }],
            config: { tools: [{ googleSearch: {} }] }
        });

        let text = response.text;
        if (!text) return [];
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const articles = JSON.parse(text);
        return articles.map((a: any, i: number) => ({
            id: `ai-news-${i}`,
            title: a.title,
            source: a.source || "City Guide",
            url: a.url || "#",
            publishedAt: a.publishedAt || "Recently",
            imageUrl: `https://source.unsplash.com/400x300/?${encodeURIComponent(city)},travel&sig=${i}`
        }));
    } catch (e) {
        console.error("Gemini News Error:", e);
        return [];
    }
};

export const getBudgetPlan = async (destination: string, days: number, travelers: number) => {
    const client = getClient();
    if (!client) return null;

    try {
        const response = await client.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: [{
                role: 'user',
                parts: [{
                    text: `Create a realistic travel budget for ${travelers} people visiting ${destination} for ${days} days. Return a RAW JSON object with estimated costs (numbers only) for these exact keys: "flight", "hotel", "food", "attraction", "other".`
                }]
            }],
            config: { responseMimeType: "application/json" }
        });
        const text = response.text;
        if (!text) return null;
        return JSON.parse(text);
    } catch (e) {
        console.error("Budget Plan Error:", e);
        return null;
    }
};

export const generateAiNote = async (trip: any) => {
    const client = getClient();
    if (!client) return null;
    try {
        const flightsStr = trip.flights?.map((f: any) => `${f.arrival_airport || 'TBD'}`).join(', ') || 'Unknown destinations';
        const totalBudget = (trip.budget_categories || []).reduce((acc: number, curr: any) => acc + (curr.planned || 0), 0);
        const budgetDetails = (trip.budget_categories || []).map((b: any) => `${b.label}: $${b.planned}`).join(', ');

        const response = await client.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: [{
                role: 'user',
                parts: [{
                    text: `Generate a helpful, creative, and cute travel insight for the trip "${trip.name}".
                    Destinations involved: ${flightsStr}.
                    Total Budget: $${totalBudget}.
                    Budget Breakdown: ${budgetDetails || 'None yet'}.
                    
                    Return a JSON object with two fields: "title" (a catchy header) and "content" (a 3-4 sentence useful tip about places to save money, a cute insight about the destination, or budget optimization advice based on their spending).`
                }]
            }],
            config: { responseMimeType: "application/json" }
        });
        const text = response.text;
        if (!text) return null;
        return JSON.parse(text);
    } catch (e) {
        console.error("AI Note Error", e);
        return null;
    }
}

export const generateSpeech = async (text: string): Promise<string | null> => {
    const client = getClient();
    if (!client) return null;
    try {
        const response = await client.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } }
            }
        });
        const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return audioData ? `data:audio/mp3;base64,${audioData}` : null;
    } catch (e) {
        console.error("TTS Error:", e);
        return null;
    }
};

export const generateTripStory = async (trip: any): Promise<string | null> => {
    const client = getClient();
    if (!client) return null;
    try {
        const flightsStr = trip.flights?.map((f: any) => `${f.airline} ${f.flight_number} on ${f.flight_date} from ${f.departure_airport || 'TBD'} to ${f.arrival_airport || 'TBD'}`).join(', ') || 'No flights booked yet.';
        
        const response = await client.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: [{
                role: 'user',
                parts: [{
                    text: `You are Apollo, a creative travel AI. Write a detailed, story-like summary for a trip named "${trip.name}". 
                    
Here are the trip details:
- Flights: ${flightsStr}
- Budget Items Count: ${trip.budget_categories?.length || 0}
- Notes Count: ${trip.notes?.length || 0}

Write a beautiful, exciting 3-4 paragraph narrative about this upcoming journey, formatted in Markdown. Include some tailored advice based on the destinations if known. Be very descriptive and paint a picture of the experience.`
                }]
            }]
        });
        return response.text || null;
    } catch (e) {
        console.error("Trip Story Error", e);
        return null;
    }
};

export const fetchFutureFlightFromGemini = async (flightNumber: string, date: string): Promise<Flight[]> => {
    const client = getClient();
    if (!client) return [];
    try {
        const response = await client.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: [{
                role: 'user',
                parts: [{
                    text: `Use Google Search to find the flight schedule for ${flightNumber} on or around ${date}. 
                    If it's too far in the future, predict it based on standard daily schedules. 
                    Return a single JSON object (NOT an array) representing the flight with these exact keys:
                    "ident": "${flightNumber}",
                    "airline": "Name of Airline",
                    "departureAirport": "Origin Airport Code (e.g. ATL)",
                    "arrivalAirport": "Destination Airport Code",
                    "departureTime": "ISO 8601 string for departure on ${date}",
                    "arrivalTime": "ISO 8601 string for arrival",
                    "aircraft": "Aircraft type if known, or 'TBD'"
                    Do not use markdown blocks, return RAW JSON.`
                }]
            }],
            config: { responseMimeType: "application/json" }
        });

        let text = response.text || "";
        if (!text) return [];
        text = text.replace(/```(?:json)?/gi, '').trim();
        const f = JSON.parse(text);
        
        let durationMinutes: number | null = null;
        if (f.departureTime && f.arrivalTime) {
            const dep = new Date(f.departureTime).getTime();
            const arr = new Date(f.arrivalTime).getTime();
            if (arr > dep) durationMinutes = Math.round((arr - dep) / 60000);
        }

        const flight: Flight = {
            id: `gemini-${Date.now()}`,
            ident: f.ident || flightNumber,
            flightNumber: f.ident || flightNumber,
            airline: f.airline || "Unknown",
            status: "Scheduled (Future)" as any,
            departureAirport: f.departureAirport || "TBD",
            arrivalAirport: f.arrivalAirport || "TBD",
            departureTime: f.departureTime || "",
            arrivalTime: f.arrivalTime || "",
            estimatedDepartureTime: "",
            actualDepartureTime: "",
            estimatedArrivalTime: "",
            actualArrivalTime: "",
            gate: "",
            terminal: "",
            gateDestination: "",
            terminalDestination: "",
            aircraft: f.aircraft || "TBD",
            progress: 0,
            delayMinutes: 0,
            durationMinutes
        };
        return [flight];
    } catch (e) {
        console.error("Future Flight Gemini Error:", e);
        return [];
    }
};

export const generateBudgetInsight = async (trip: any): Promise<string> => {
    const client = getClient();
    if (!client) return "Apollo couldn't connect. API Key missing.";

    const destination = trip.destination || "Unknown Destination";
    const budgetLimit = trip.budget_limit || 0;
    const durationDays = trip.duration_days || 1;
    const travelers = trip.travelers_count || 1;
    
    const items = trip.budget_categories || [];
    const totalSpent = items.reduce((sum: number, item: any) => sum + (item.planned || 0), 0);
    const remaining = budgetLimit - totalSpent;

    const itemsStr = items.map((i: any) => `- ${i.label}: $${i.planned}`).join("\n");

    const prompt = `You are Apollo AI, a highly intelligent and friendly travel companion. 
The user is planning a trip to ${destination} for ${durationDays} days with ${travelers} traveler(s).
Their total budget is $${budgetLimit}. They have spent $${totalSpent} so far, leaving $${remaining}.

Here are their specific expenses:
${itemsStr || "No expenses added yet."}

Analyze this budget considering the typical costs in ${destination}. 
- Are they over or under budget? 
- Will $${remaining} be enough for the remaining days for ${travelers} people? 
- What typical costs in ${destination} (like food or transport) should they watch out for?

Provide a concise, helpful, and slightly playful insight (1-2 paragraphs max).`;

    try {
        const model = client.models;
        const response = await model.generateContent({
            model: 'gemini-3.6-flash',
            contents: prompt
        });
        return response.text || "Apollo couldn't generate an insight right now.";
    } catch (error) {
        console.error("Budget insight error:", error);
        return "Apollo encountered an error generating your budget insight.";
    }
};
