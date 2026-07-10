import { getActiveUser } from './authService';
import { fetchTrips } from './tripService';

// Apollo's brain — Claude (Anthropic) via the /apollo Firebase Function proxy.
// The API key lives server-side; the client never sees it.

const buildSystemPrompt = async (): Promise<string> => {
    let tripsContext = 'The user has no trips currently planned.';
    try {
        const user = getActiveUser();
        if (user && user.id) {
            const trips = await fetchTrips(user.id);
            if (trips && trips.length > 0) {
                tripsContext = `The user has ${trips.length} trip(s): ` + JSON.stringify(trips.map(t => ({
                    name: t.name,
                    flights: (t.flights || []).map((f: any) => `${f.airline} ${f.flight_number} to ${f.arrival_airport}`),
                    budget: (t.budget_categories || []).reduce((a: number, c: any) => a + (c.planned || 0), 0)
                })));
            }
        }
    } catch (e) { console.error('Failed to load trips context', e); }

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

CONCIERGE BEHAVIOR:
- When the user asks about "my flight", their trip, delays, or timing, USE the flight context above — answer with its actual status, gate, and times instead of asking which flight.
- If their flight is delayed, be proactive: mention the new time, and suggest what the delay means for connections, food time, or ground plans.
- Connect the dots across the app: if they ask what to do near the airport during a delay, use their last browsed city and suggest the Explore tab.
- ${tripsContext}`;
};

type GeminiStyleHistory = { role: string; parts: { text: string }[] }[];

export const streamApolloResponse = async (
    userMessage: string,
    history: GeminiStyleHistory,
    onChunk: (text: string) => void
) => {
    try {
        const system = await buildSystemPrompt();

        // Convert Gemini-style history to Anthropic messages (merge consecutive same-role turns)
        const raw = [
            ...history.map(h => ({
                role: h.role === 'model' ? 'assistant' : 'user',
                content: (h.parts || []).map(p => p.text).join('\n').trim()
            })),
            { role: 'user', content: userMessage }
        ].filter(m => m.content);

        const messages: { role: string; content: string }[] = [];
        for (const m of raw) {
            const last = messages[messages.length - 1];
            if (last && last.role === m.role) last.content += '\n' + m.content;
            else messages.push({ ...m });
        }
        // Anthropic requires the first message to be from the user
        while (messages.length && messages[0].role !== 'user') messages.shift();
        if (messages.length === 0) messages.push({ role: 'user', content: userMessage });

        const res = await fetch('/apollo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ system, messages, max_tokens: 1024 })
        });

        if (!res.ok || !res.body) {
            console.error('Apollo proxy error:', res.status, await res.text().catch(() => ''));
            onChunk("Woof… my brain is offline right now. Give it a moment and try again.");
            return;
        }

        // Parse the Anthropic SSE stream
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (!line.startsWith('data:')) continue;
                const data = line.slice(5).trim();
                if (!data || data === '[DONE]') continue;
                try {
                    const ev = JSON.parse(data);
                    if (ev.type === 'content_block_delta' && ev.delta?.text) onChunk(ev.delta.text);
                } catch { /* partial JSON across chunks is fine to skip */ }
            }
        }
    } catch (e) {
        console.error('streamApolloResponse error:', e);
        onChunk("Woof… something went wrong on my end. Try that again?");
    }
};
