
import { GoogleGenAI, Modality } from "@google/genai";
import { NewsArticle } from "../types";

import { API_KEYS } from "../config";

let aiClient: GoogleGenAI | null = null;

const getClient = () => {
    if (!aiClient && API_KEYS.GEMINI) {
        aiClient = new GoogleGenAI({ apiKey: API_KEYS.GEMINI });
    }
    return aiClient;
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

export const generateAiNote = async (city: string, stateCountry: string, tripName: string) => {
    const client = getClient();
    if (!client) return null;
    try {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{
                role: 'user',
                parts: [{
                    text: `Generate a helpful, creative, and concise travel note for a trip to ${city}, ${stateCountry} (Trip Name: ${tripName}). 
                    Return a JSON object with two fields: "title" (a catchy header) and "content" (a 3-4 sentence useful tip, itinerary idea, or cultural insight).`
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
