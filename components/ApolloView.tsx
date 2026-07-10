

import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Trash2, Bot, User, Volume2, Loader2, Plane, HelpCircle, ChevronLeft } from 'lucide-react';
import { ChatMessage, UserTier } from '../types';
import { streamApolloResponse, generateSpeech } from '../services/geminiService';
import { hasDiamondAccess } from '../services/authService';
import { EnhancedApolloDogIcon } from './ApolloDog';
import { getActiveUser } from '../services/authService';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebaseClient';

interface ApolloViewProps {
  userTier: UserTier;
  onBack?: () => void;
}

export const ApolloView: React.FC<ApolloViewProps> = React.memo(({ userTier, onBack }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');

  // Concierge chips on Today prefill the composer
  useEffect(() => {
    const check = () => {
      try {
        const p = localStorage.getItem('urtc_apollo_prefill');
        if (p) { setInput(p); localStorage.removeItem('urtc_apollo_prefill'); }
      } catch { /* ignore */ }
    };
    check();
    window.addEventListener('focus', check);
    const iv = setInterval(check, 1200);
    return () => { window.removeEventListener('focus', check); clearInterval(iv); };
  }, []);
  const [isThinking, setIsThinking] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [msgCount, setMsgCount] = useState(0);
  const [limitReached, setLimitReached] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [hasShownTip, setHasShownTip] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use getActiveUser for userId to track local storage limits
  const user = getActiveUser();

  useEffect(() => {
    const loadHistory = async () => {
      let loadedMessages: ChatMessage[] | null = null;

      if (user.tier !== UserTier.Guest && user.id !== 'guest') {
        try {
          const docRef = doc(db, 'apolloHistory', user.id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().messages) {
            loadedMessages = docSnap.data().messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
          }
        } catch (e) {
          console.error("Failed to load Firebase history", e);
        }
      }

      if (!loadedMessages) {
        const saved = localStorage.getItem('apollo_chat_history');
        if (saved) {
          try {
            loadedMessages = JSON.parse(saved).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
            if (user.tier !== UserTier.Guest && user.id !== 'guest') {
              setDoc(doc(db, 'apolloHistory', user.id), { messages: JSON.parse(saved) }, { merge: true }).catch(console.error);
            }
          } catch (e) { console.error(e); }
        }
      }

      if (loadedMessages && loadedMessages.length > 0) {
        setMessages(loadedMessages);
      } else {
        setMessages([{
          id: 'welcome',
          text: "Yo! Woof! I'm Apollo 🐾. I'm your travel buddy with the wet nose and the best tips. \n\nI can sniff out cheap flights, help you budget (so you can buy more treats), or just chat. Why did the tourist cross the road? To get to the airport! 😂 What's the plan?",
          sender: 'apollo',
          timestamp: new Date()
        }]);
      }
    };

    loadHistory();
    checkLimits();
  }, [user.id]);

  // Proactive Apollo Tips based on user activity
  useEffect(() => {
    if (hasShownTip || messages.length > 2) return; // Only on fresh/short chats
    const timer = setTimeout(() => {
      // Check what the user has been doing
      const lastCity = localStorage.getItem('urtc_last_city');
      const budgetData = localStorage.getItem('urtc_budget_categories');
      const lastSearch = localStorage.getItem('urtc_last_flight_search');
      
      let tip = '';
      if (lastSearch) {
        tip = `✈️ I noticed you searched for **${lastSearch}** recently! Want me to help you find the best time to fly that route, or tips for a smooth trip?`;
      } else if (lastCity) {
        tip = `🌍 I see you've been exploring **${lastCity}**! Want me to share hidden gems, local food spots, or safety tips for ${lastCity}?`;
      } else if (budgetData) {
        try {
          const cats = JSON.parse(budgetData);
          const total = cats.reduce((s: number, c: any) => s + (c.planned || 0), 0);
          if (total > 0) {
            tip = `💰 Your trip budget is set to **$${total.toLocaleString()}**. Want me to suggest ways to stretch that further, or recommend money-saving travel hacks?`;
          }
        } catch(e) {}
      }
      
      if (tip) {
        setMessages(prev => [...prev, {
          id: `tip-${Date.now()}`,
          text: tip,
          sender: 'apollo' as const,
          timestamp: new Date()
        }]);
        setHasShownTip(true);
      }
    }, 3000); // 3 second delay so it feels natural
    return () => clearTimeout(timer);
  }, [messages.length, hasShownTip]);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('apollo_chat_history', JSON.stringify(messages));
      if (user.tier !== UserTier.Guest && user.id !== 'guest') {
        setDoc(doc(db, 'apolloHistory', user.id), { messages: JSON.parse(JSON.stringify(messages)) }, { merge: true }).catch(console.error);
      }
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages, user.id, isThinking]);

  const checkLimits = () => {
    const today = new Date().toDateString();
    const storageKey = `apollo_limit_${user.id}_${today}`;
    const count = parseInt(localStorage.getItem(storageKey) || '0');
    setMsgCount(count);

    if (user.tier === UserTier.Guest && count >= 15) setLimitReached(true);
    else if (user.tier === UserTier.Free && count >= 15) setLimitReached(true);
    else setLimitReached(false);
  };

  const incrementCount = () => {
    const today = new Date().toDateString();
    const storageKey = `apollo_limit_${user.id}_${today}`;
    const newCount = msgCount + 1;
    localStorage.setItem(storageKey, newCount.toString());
    setMsgCount(newCount);
    checkLimits();
  };

  const handleClearHistory = () => {
    localStorage.removeItem('apollo_chat_history');
    if (user.tier !== UserTier.Guest && user.id !== 'guest') {
      deleteDoc(doc(db, 'apolloHistory', user.id)).catch(console.error);
    }
    setMessages([{ id: Date.now().toString(), text: "Fresh start! 🦴 Ask me for a joke or some hidden travel gems.", sender: 'apollo', timestamp: new Date() }]);
  };

  const handlePlayAudio = async (text: string, id: string) => {
    if (playingAudioId === id) { audioRef.current?.pause(); setPlayingAudioId(null); return; }
    setPlayingAudioId(id);
    const audioUrl = await generateSpeech(text);
    if (audioUrl) {
      if (audioRef.current) audioRef.current.pause();
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setPlayingAudioId(null);
      audioRef.current.play();
    } else { setPlayingAudioId(null); }
  };

  const formatMessage = (text: string) => {
    return text.split(/(\*\*.*?\*\*)/g).map((part, index) =>
      (part.startsWith('**') && part.endsWith('**')) ? <strong key={index} className="font-bold text-brand-orange">{part.slice(2, -2)}</strong> : <span key={index}>{part}</span>
    );
  };

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim() || isThinking) return;

    if (!textOverride && limitReached && !hasDiamondAccess(user)) return;

    if (!textOverride) {
      incrementCount();
    }
    const userMsg: ChatMessage = { id: Date.now().toString(), text: textToSend, sender: 'user', timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    const history = messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
    let fullResponse = "";
    const responseId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: responseId, text: "", sender: 'apollo', timestamp: new Date() }]);

    await streamApolloResponse(userMsg.text, history, (chunk) => {
      fullResponse += chunk;
      setMessages(prev => prev.map(m => m.id === responseId ? { ...m, text: fullResponse } : m));
    });
    setIsThinking(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      {/* Header / Brand Area */}
      <div className="flex items-center justify-between px-2 pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 -ml-2 mr-1 rounded-full text-white hover:bg-white/10 transition">
              <ChevronLeft size={24} />
            </button>
          )}
          <div className="relative">
            <img
              src="/assets/apollo_pilot.jpg"
              alt="Apollo AI"
              className="w-12 h-12 rounded-full object-cover border-2 border-white/10 animate-wag shadow-lg"
            />
            <div className="absolute -bottom-1 -right-1 bg-green-500 w-3 h-3 rounded-full border-2 border-brand-dark"></div>
          </div>
          <div>
            <h2 className="text-xl font-black text-white leading-none">Apollo AI</h2>
            <p className="text-xs text-brand-orange font-bold uppercase tracking-wider flex items-center gap-1">
              {limitReached && !hasDiamondAccess(user) ? 'Limit Reached' : (hasDiamondAccess(user) ? 'Unlimited Access' : `${15 - msgCount} msgs left`)}
            </p>
          </div>
        </div>
        <button onClick={handleClearHistory} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition">
          <Trash2 size={16} />
        </button>
      </div>

      {user.tier === UserTier.Guest && (
        <div className="bg-brand-orange/20 border border-brand-orange/30 p-2 rounded-xl mb-4 text-center text-xs text-brand-orange font-medium flex items-center justify-center gap-2">
          <Sparkles size={12} />
          <span>Login to save your history and get 15 Apollo messages!</span>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-2 scrollbar-hide">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex w-full gap-3 animate-in fade-in slide-in-from-bottom-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start items-end'}`}>
            {msg.sender === 'apollo' && <div className="w-8 h-8 rounded-full bg-brand-surface border border-white/10 flex items-center justify-center shrink-0 overflow-hidden"><EnhancedApolloDogIcon size={20} /></div>}
            <div className={`max-w-[85%] p-4 text-sm leading-relaxed shadow-lg relative group ${msg.sender === 'user' ? 'bg-gradient-to-br from-brand-orange to-red-600 text-white rounded-2xl rounded-tr-sm' : 'bg-white/5 border border-white/10 text-gray-200 rounded-2xl rounded-tl-sm'}`}>
              {formatMessage(msg.text)}
              {msg.sender === 'apollo' && msg.text && (
                <button onClick={() => handlePlayAudio(msg.text, msg.id)} className={`absolute -right-10 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-white/10 transition ${playingAudioId === msg.id ? 'text-brand-orange' : 'text-gray-500 opacity-0 group-hover:opacity-100'}`}>
                  {playingAudioId === msg.id ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
                </button>
              )}
            </div>
            {msg.sender === 'user' && <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0"><User size={16} className="text-gray-300" /></div>}
          </div>
        ))}
        {isThinking && <div className="flex justify-start items-end gap-3"><div className="w-8 h-8 rounded-full bg-brand-surface border border-white/10 flex items-center justify-center shrink-0 overflow-hidden"><EnhancedApolloDogIcon size={20} /></div><div className="bg-white/5 p-4 rounded-2xl rounded-tl-sm"><div className="flex gap-1.5"><span className="w-2 h-2 bg-brand-orange rounded-full animate-bounce" /><span className="w-2 h-2 bg-brand-orange rounded-full animate-bounce delay-75" /><span className="w-2 h-2 bg-brand-orange rounded-full animate-bounce delay-150" /></div></div></div>}

        {limitReached && (
          <div className="text-center p-4 bg-white/5 rounded-xl border border-white/10 mx-4">
            <p className="text-red-400 font-bold text-sm">Daily Message Limit Reached</p>
            <p className="text-gray-500 text-xs mt-1">Upgrade to Diamond in About &gt; Subscriptions to continue.</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Controls */}
      <div className="pt-2 space-y-3">
        {/* Quick Chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button onClick={() => handleSend("What is the difference between Pro and Free tiers?")} disabled={limitReached} className="bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl text-xs font-bold text-brand-orange border border-brand-orange/20 whitespace-nowrap flex items-center gap-1.5 transition disabled:opacity-50"><Sparkles size={12} /> Pro vs Free</button>
          <button onClick={() => handleSend("How can I track a flight?")} disabled={limitReached} className="bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white border border-white/5 whitespace-nowrap flex items-center gap-1.5 transition disabled:opacity-50"><Plane size={12} /> Flight Tracking</button>
          <button onClick={() => handleSend("Give me 3 helpful travel tips.")} disabled={limitReached} className="bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white border border-white/5 whitespace-nowrap flex items-center gap-1.5 transition disabled:opacity-50"><HelpCircle size={12} /> Trip Tips</button>
        </div>

        {/* Input */}
        <div id="tour-apollo-chat" className="flex gap-2 items-center bg-black/40 border border-white/10 rounded-2xl px-2 py-2 focus-within:border-brand-orange/50 transition-colors shadow-lg">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder={limitReached ? "Daily limit reached." : "Ask about trips, money, or life..."} disabled={isThinking || limitReached} className="flex-1 bg-transparent px-4 py-2 text-white placeholder-gray-500 focus:outline-none disabled:opacity-50" />
          <button onClick={() => handleSend()} disabled={!input.trim() || isThinking || limitReached} className="p-3 bg-brand-orange text-white rounded-xl disabled:opacity-50 hover:bg-orange-600 transition shadow-lg"><Send size={18} /></button>
        </div>
      </div>
    </div>
  );
});
