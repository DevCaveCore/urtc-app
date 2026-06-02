
import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Trash2, Bot, User, HelpCircle, Volume2, Loader2, Lock, Plane } from 'lucide-react';
import { ChatMessage, UserTier } from '../types';
import { streamApolloResponse, generateSpeech } from '../services/geminiService';
import { EnhancedApolloDogIcon } from './ApolloDog';
import { getActiveUser } from '../services/authService';

interface ApolloChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApolloChat: React.FC<ApolloChatProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [msgCount, setMsgCount] = useState(0);
  const [limitReached, setLimitReached] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const user = getActiveUser();

  useEffect(() => {
    const saved = localStorage.getItem('apollo_chat_history');
    if (saved) {
      try {
        setMessages(JSON.parse(saved).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
      } catch (e) { console.error(e); }
    } else {
      setMessages([{
        id: 'welcome',
        text: "Woof! I'm Apollo 🐾. Welcome to **Beta 4.0**! I have new powers: I can Search the web, check Maps for prices, and even Speak! Ask me anything.",
        sender: 'apollo',
        timestamp: new Date()
      }]);
    }

    // Check message limits
    checkLimits();
  }, []);

  useEffect(() => {
    if (messages.length > 0) localStorage.setItem('apollo_chat_history', JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const checkLimits = () => {
    const today = new Date().toDateString();
    const storageKey = `apollo_limit_${user.id}_${today}`;
    const count = parseInt(localStorage.getItem(storageKey) || '0');
    setMsgCount(count);

    if (user.tier === UserTier.Guest && count >= 5) setLimitReached(true);
    else if (user.tier === UserTier.Free && count >= 10) setLimitReached(true);
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
    setMessages([{ id: Date.now().toString(), text: "Memory cleared! 🐾 What now?", sender: 'apollo', timestamp: new Date() }]);
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
      (part.startsWith('**') && part.endsWith('**')) ? <strong key={index} className="font-bold text-white">{part.slice(2, -2)}</strong> : <span key={index}>{part}</span>
    );
  };

  const handleSend = async (textOverride?: string) => {
    if (limitReached && user.tier !== UserTier.Pro && user.tier !== UserTier.Crew) return;

    const textToSend = textOverride || input;
    if (!textToSend.trim() || isThinking) return;

    incrementCount();
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0B0E14] border border-white/10 sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col h-[90vh] sm:h-[700px]">
        <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between z-10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center border border-white/10 bg-brand-orange/10 overflow-hidden relative">
              <EnhancedApolloDogIcon size={32} interactive={true} wagOnHover={true} className="mt-1" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg leading-tight">Apollo AI <span className="text-[10px] bg-brand-orange px-1.5 py-0.5 rounded text-white font-mono uppercase">BETA 4.0</span></h3>
              <p className="text-[10px] text-gray-400 flex items-center gap-1 font-medium">
                <Sparkles size={10} className="text-brand-orange" />
                {limitReached ? 'Daily Limit Reached' : `${user.tier === UserTier.Guest ? 5 - msgCount : (user.tier === UserTier.Free ? 10 - msgCount : '∞')} msgs left`}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={handleClearHistory} className="p-2 hover:bg-white/10 rounded-full transition text-gray-400 hover:text-white"><Trash2 size={18} /></button>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition text-white"><X className="w-6 h-6" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gradient-to-b from-[#0B0E14] to-brand-blue/5 scrollbar-hide">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex w-full gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start items-end'}`}>
              {msg.sender === 'apollo' && <div className="w-8 h-8 rounded-full bg-brand-surface border border-white/10 flex items-center justify-center shrink-0 overflow-hidden"><EnhancedApolloDogIcon size={20} /></div>}
              <div className={`max-w-[85%] p-4 text-sm leading-relaxed shadow-lg relative group ${msg.sender === 'user' ? 'bg-gradient-to-br from-brand-orange to-red-500 text-white rounded-2xl rounded-tr-sm' : 'bg-white/5 border border-white/10 text-gray-200 rounded-2xl rounded-tl-sm'}`}>
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
            <div className="flex justify-center my-4">
              <div className="bg-white/10 border border-white/10 rounded-xl p-4 text-center max-w-xs">
                <Lock className="mx-auto text-gray-400 mb-2" size={24} />
                <p className="text-white font-bold text-sm mb-1">Daily Limit Reached</p>
                <p className="text-gray-400 text-xs mb-3">Upgrade to Pro to continue chatting with Apollo.</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
        <div className="p-4 bg-brand-surface/80 backdrop-blur-xl border-t border-white/10 pb-safe">
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
            <button onClick={() => handleSend("What is the difference between Pro and Free tiers?")} disabled={limitReached} className="bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full text-xs text-brand-orange border border-brand-orange/20 whitespace-nowrap flex items-center gap-1 transition disabled:opacity-50"><Sparkles size={12} /> Pro vs Free</button>
            <button onClick={() => handleSend("How can I track a flight?")} disabled={limitReached} className="bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full text-xs text-gray-400 hover:text-white border border-white/5 whitespace-nowrap transition disabled:opacity-50"><Plane size={12} /> Flight Tracking</button>
            <button onClick={() => handleSend("Give me 3 helpful travel tips.")} disabled={limitReached} className="bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full text-xs text-gray-400 hover:text-white border border-white/5 whitespace-nowrap transition disabled:opacity-50"><HelpCircle size={12} /> Trip Tips</button>
          </div>
          <div className="flex gap-2 items-center bg-black/40 border border-white/10 rounded-full px-2 py-2 focus-within:border-brand-orange/50 transition-colors">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder={limitReached ? "Limit reached..." : "Ask Apollo anything..."} disabled={isThinking || limitReached} className="flex-1 bg-transparent px-4 py-2 text-white placeholder-gray-500 focus:outline-none disabled:opacity-50" />
            <button onClick={() => handleSend()} disabled={!input.trim() || isThinking || limitReached} className="p-3 bg-brand-orange text-white rounded-full disabled:opacity-50 hover:bg-orange-600 transition shadow-lg"><Send size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};