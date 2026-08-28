import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Radar, Ticket, Notebook, MessageCircle } from 'lucide-react';

interface TutorialOverlayProps {
    onClose: () => void;
    /** Ends the tour by opening Apollo with a starter prompt — the activation moment. */
    onAskApollo?: (prompt: string) => void;
}

const STARTER_PROMPT = "Plan me a long weekend somewhere warm — ask me a couple of questions first.";

/**
 * First-run tour. Deliberately short, and it does not end on a dead
 * "Get Started" button: the last step hands the user to Apollo with a real
 * prompt, because a new user who never talks to him never sees the product.
 */
export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ onClose, onAskApollo }) => {
    const [step, setStep] = useState(0);

    const steps = [
        {
            eyebrow: 'Travel Commerce',
            title: 'This is ÜrTC',
            desc: 'Track the flight, book the next one, and keep the whole trip in one place. Apollo — your AI companion — does the legwork.',
            icon: <MessageCircle size={26} />,
            art: (
                <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-brand-orange/50 shrink-0 shadow-lg shadow-brand-orange/20">
                        <img src="/assets/apollo_pilot.jpg" alt="Apollo" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 rounded-2xl rounded-tl-sm bg-white/[0.06] border border-white/10 px-3.5 py-2.5 text-[13px] text-white/75 leading-snug">
                        Where are we headed? I can find it, price it, and book it. 🐾
                    </div>
                </div>
            ),
        },
        {
            eyebrow: 'Flights tab',
            title: 'Track anything that flies',
            desc: 'A flight number, an airport, a city, or a whole route. Live gates, baggage, delays in plain English — and AI-predicted landing times.',
            icon: <Radar size={26} />,
            art: (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
                    <div className="flex items-center justify-between mb-2.5">
                        <span className="text-[11px] font-bold text-white/70">Delta 1182</span>
                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-full">On time</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-display text-xl font-bold text-white">ATL</span>
                        <div className="flex-1 h-[3px] bg-white/10 rounded-full relative">
                            <div className="absolute left-0 top-0 h-[3px] w-3/5 rounded-full bg-brand-orange shadow-[0_0_8px_rgba(255,92,26,0.6)]" />
                        </div>
                        <span className="font-display text-xl font-bold text-white">AVL</span>
                    </div>
                </div>
            ),
        },
        {
            eyebrow: 'Book Travel',
            title: 'Apollo finds the right fare',
            desc: 'Tell him the trip and a budget. He searches live airline inventory and ranks it by price, time, comfort and what you actually like — then explains his pick.',
            icon: <Ticket size={26} />,
            art: (
                <div className="rounded-2xl border border-brand-orange/40 bg-brand-orange/[0.07] p-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-black uppercase tracking-wider text-white bg-gradient-to-r from-brand-orange to-red-500 px-2 py-0.5 rounded-full">Apollo's pick</span>
                        <span className="font-display text-lg font-bold text-white">$238</span>
                    </div>
                    <div className="text-[11px] text-white/60">Nonstop · fits your budget · flexible</div>
                </div>
            ),
        },
        {
            eyebrow: 'Trips',
            title: 'Everything lands in one plan',
            desc: 'Flights, places you saved, notes and a budget that shows what you can still spend per day. Ask Apollo to add to it and he just does it.',
            icon: <Notebook size={26} />,
            art: (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
                    <div className="text-[11px] font-bold text-white mb-2">LA Long Weekend</div>
                    <div className="flex h-2 rounded-full overflow-hidden bg-white/5">
                        <div className="w-[37%] bg-[#8b5cf6]" />
                        <div className="w-[26%] bg-[#3AB0FF]" />
                        <div className="w-[11%] bg-[#FF6B35]" />
                        <div className="w-[6%] bg-[#34d399]" />
                    </div>
                    <div className="text-[10px] text-white/45 mt-2">Safe to spend ≈ $62/day</div>
                </div>
            ),
        },
    ];

    const isLast = step === steps.length - 1;
    const s = steps[step];

    const finish = () => {
        if (onAskApollo) onAskApollo(STARTER_PROMPT);
        onClose();
    };

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[140] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div
                initial={{ y: '100%', opacity: 0.5 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 32 }}
                className="w-full sm:max-w-sm bg-[#12151b] rounded-t-[32px] sm:rounded-[32px] border border-white/10 shadow-2xl relative overflow-hidden"
            >
                <div className="absolute -top-24 -right-16 w-64 h-64 bg-brand-orange/15 rounded-full blur-[70px] pointer-events-none" />
                <div className="sm:hidden pt-2.5 flex justify-center"><div className="w-10 h-1 rounded-full bg-white/25" /></div>

                <div className="relative z-10 p-7 pt-5">
                    <div className="flex items-center gap-2.5 mb-5">
                        <div className="w-10 h-10 rounded-2xl bg-brand-orange/12 border border-brand-orange/25 flex items-center justify-center text-brand-orange shrink-0">
                            {s.icon}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-orange">{s.eyebrow}</span>
                        <button onClick={onClose} className="ml-auto text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-white/70 transition">
                            Skip
                        </button>
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 24 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -24 }}
                            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <h2 className="font-display text-[26px] leading-tight font-bold text-white mb-2.5">{s.title}</h2>
                            <p className="text-sm text-white/55 leading-relaxed mb-5">{s.desc}</p>
                            <div className="mb-6">{s.art}</div>
                        </motion.div>
                    </AnimatePresence>

                    <div className="flex gap-1.5 mb-5">
                        {steps.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setStep(i)}
                                aria-label={`Step ${i + 1}`}
                                className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-7 bg-brand-orange' : 'w-1.5 bg-white/15 hover:bg-white/30'}`}
                            />
                        ))}
                    </div>

                    <button
                        onClick={() => (isLast ? finish() : setStep(step + 1))}
                        className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 press transition-all ${
                            isLast
                                ? 'bg-gradient-to-r from-brand-orange to-red-500 text-white shadow-lg shadow-brand-orange/30'
                                : 'bg-white/[0.07] border border-white/12 text-white hover:border-brand-orange/40'
                        }`}
                    >
                        {isLast ? <>Ask Apollo to plan something <ArrowRight size={16} strokeWidth={3} /></> : <>Next <ArrowRight size={15} strokeWidth={3} /></>}
                    </button>

                    {isLast && (
                        <button onClick={onClose} className="w-full mt-3 text-[11px] font-bold uppercase tracking-widest text-white/30 hover:text-white/60 transition">
                            I'll look around first
                        </button>
                    )}
                </div>
            </motion.div>
        </div>,
        document.body
    );
};
