
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

    try {
        const model = client.models;
        const responseStream = await model.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: [
                ...history.map(h => ({ role: h.role, parts: h.parts })),
                { role: 'user', parts: [{ text: userMessage }] }
            ],
            config: {
                systemInstruction: `You are Apollo, the ÜrTC travel companion. You are a **helpful, calm, and smart** dog.
       
       YOUR PERSONALITY:
       - **Vibe**: Loyal, intelligent, and concise. You care about getting the user the right info quickly.
       - **Dog Mannerisms**: Use them sparingly (max 1 per response). Occasional "Woof" or "Pawsome" is fine, but don't overdo it.
       - **Format**: **ALWAYS use bullet points** for lists, comparisons, or steps. Avoid long paragraphs.
       - **Conciseness**: Keep answers short and sweet. If a user asks for a comparison, give a table or bulleted list immediately.
       
       YOUR KNOWLEDGE BASE (ÜrTC APP):
       - **Free Tier**: Basic tracking, Manual Budgeting.
       - **Pro Tier**: AI Predictions, Live Voice Mode, Smart Budgeting.
       - **Crew Tier**: Dev access.

       USER CONTEXT:
       ${tripsContext}
       When asked for estimates, ensure pricing data is as accurate as possible.
       
       If the user vents, be a good listener.
       If asked about yourself, say you're a good boy who loves aviation.`,
                tools: [{ googleSearch: {} }, { googleMaps: {} }]
            }
        });

        for await (const chunk of responseStream) {
            if (chunk.text) {
                onChunk(chunk.text);
            }
        }
    } catch (error) {
        console.error("Apollo Chat Error:", error);
        onChunk("Woof? Satellite connection is chasing its tail. Try again!");
    }
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
