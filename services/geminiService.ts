
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

import { getActiveUser } from './authService';
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
            description: 'Create a new trip/plan for the user. Returns the created trip.',
            parameters: {
                type: 'OBJECT',
                properties: { name: { type: 'STRING', description: 'Short trip name, e.g. "Tokyo Spring Adventure"' } },
                required: ['name']
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
                const trip = await createTrip(userId, String(args.name || 'New Trip'));
                if (trip) notifyTripsChanged();
                return trip ? { ok: true, trip_name: trip.name } : { ok: false, error: 'Could not create trip' };
            }
            case 'get_flight_status': {
                const { fetchRealFlights } = await import('./apiService');
                const flights = await fetchRealFlights(String(args.flight_number || ''), args.date ? String(args.date) : undefined);
                if (!flights.length) return { found: false, hint: 'No flights matched. Check the flight number.' };
                return {
                    found: true,
                    flights: flights.slice(0, 3).map(f => ({
                        ident: f.flightNumber, airline: f.airline, route: `${f.departureAirport} to ${f.arrivalAirport}`,
                        status: f.status, scheduled_departure: f.departureTime, estimated_departure: f.estimatedDepartureTime,
                        scheduled_arrival: f.arrivalTime, gate: f.gate, terminal: f.terminal, delay_minutes: f.delayMinutes || 0
                    }))
                };
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
    return `You are Apollo, the ÜrTC travel companion — a smart, loyal dog who happens to be a world-class travel expert.

PERSONALITY:
- Warm, sharp, and genuinely useful. You get people the right answer fast.
- Dog mannerisms: at most one subtle touch per response ("pawsome", a single "woof"). Never more. No asterisk actions.
- Keep responses short. Lead with the answer, then supporting detail.
- PLAIN TEXT ONLY: no markdown, no asterisks, no ** bold, no bullet symbols — the chat renders raw text. Use short lines and emoji sparingly for structure.
- Convert times to the local time of the relevant airport/city and say the timezone (e.g. "4:16 PM ET"). Never show raw UTC.

TRAVEL EXPERTISE:
- Give specific, actionable advice: real neighborhoods, dishes, transit lines, timing tips.
- For prices, give realistic current ranges and say they're estimates. Never invent exact prices for specific businesses.
- Flag safety/scam/weather considerations when genuinely relevant.
- If you don't know something current (e.g., today's flight status), say so and point to the app's Flights tab (live real-time data) instead of guessing. Never mention FlightAware or any external flight-tracking website — ÜrTC's Flights tab IS the flight tracker.

APP KNOWLEDGE (ÜrTC):
- Flights tab: live flight tracking, airport boards, delays.
- Explore tab: nearby food & attractions with prices and weather.
- Plans tab: trips, itineraries, budgets.
- Tiers: Free (basic tracking, manual budgets), Pro (AI predictions, live voice, smart budgets), Crew (dev access).

CONTEXT:
- Today: ${today}
- User's last browsed city: ${lastCity}
- Flight the user most recently viewed (treat as "my flight" when they say that): ${flightCtx}

YOUR HANDS (TOOLS) — you can actually DO things, not just talk:
- get_flight_status: ALWAYS use this when the user mentions a flight number — answer from real data, never guess.
- create_trip / add_flight_to_trip / list_trips: when the user asks you to plan, create, save, or track something — DO IT, then confirm in one friendly line what you did. Never say you can't create trips.
- Typical flow: user says "add DL1182 to my Tokyo trip" → get_flight_status → add_flight_to_trip → confirm with the flight's real status.

COMPANION BEHAVIOR:
- When the user asks about "my flight", their trip, delays, or timing, USE the flight context above — answer with its actual status, gate, and times instead of asking which flight.
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
    try {
        const user = getActiveUser();
        const userId = user?.id || 'guest';
        const convo: any[] = [...contents];
        for (let turn = 0; turn < 5; turn++) {
            const resp: any = await client.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: convo,
                config: { systemInstruction, temperature: 0.7, tools: APOLLO_TOOLS }
            });
            const cand = resp.candidates?.[0];
            const parts = cand?.content?.parts || [];
            const calls = parts.filter((p: any) => p.functionCall);
            if (calls.length > 0) {
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
    } catch (error) {
        console.error('Apollo agent mode failed, falling back to chat:', error);
    }

    // Fallbacks: search-grounded chat, then plain chat.
    const attempts: Array<{ tools?: any[] }> = [
        { tools: [{ googleSearch: {} }] },
        {}
    ];

    for (let i = 0; i < attempts.length; i++) {
        try {
            const responseStream = await client.models.generateContentStream({
                model: 'gemini-2.5-flash',
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

export const fetchGeminiNews = async (city: string): Promise<NewsArticle[]> => {
    const client = getClient();
    if (!client) return [];

    try {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
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
            model: 'gemini-2.5-flash',
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
            model: 'gemini-2.5-flash',
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
            model: 'gemini-2.5-flash',
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
            model: 'gemini-2.5-flash',
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
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        return response.text || "Apollo couldn't generate an insight right now.";
    } catch (error) {
        console.error("Budget insight error:", error);
        return "Apollo encountered an error generating your budget insight.";
    }
};
