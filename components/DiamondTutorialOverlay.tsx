import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Bell, Radar, Sparkles, BadgeCheck, Gem } from 'lucide-react';

interface DiamondTutorialOverlayProps {
    onClose: () => void;
    /** Optional: jump straight to setting up alerts, the perk worth the money. */
    onOpenAlerts?: () => void;
}

/**
 * Shown once when an account becomes Diamond. Every perk here maps to a real
 * shipped feature — the old version promised vague "exclusive deals" the app
 * never had, which is the fastest way to make a paid tier feel like a con.
 */
export const DiamondTutorialOverlay: React.FC<DiamondTutorialOverlayProps> = ({ onClose, onOpenAlerts }) => {
    const [step, setStep] = useState(0);

    const steps = [
        {
            eyebrow: 'Welcome to Diamond',
            title: "You're in. Here's what changed.",
            desc: "Four things switched on the moment you upgraded. This takes twenty seconds, then Apollo gets out of your way.",
            icon: <Gem size={24} />,
            art: (
                <div className="rounded-2xl border border-[#3AB0FF]/30 bg-gradient-to-br from-[#8DE2FF]/10 to-[#3AB0FF]/10 p-4 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#3AB0FF]/50 shrink-0">
                        <img src="/assets/apollo_pilot.jpg" alt="Apollo" className="w-full h-full object-cover" />
                    </div>
                    <p className="text-[13px] text-white/75 leading-snug">Good call. Now I can actually watch your flights for you.</p>
                </div>
            ),
        },
        {
            eyebrow: 'The one that matters',
            title: 'Alerts before the airport knows',
            desc: 'Delays, gate changes and cancellations pushed to your phone the second the airline files them — usually before the board updates.',
            icon: <Bell size={24} />,
            art: (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
                    <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0">
                            <Bell size={14} className="text-orange-400" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[12px] font-bold text-white leading-tight">DAL1182 — Gate changed</div>
                            <div className="text-[11px] text-white/45 mt-0.5">Now B14. You have 38 minutes.</div>
                        </div>
                    </div>
                </div>
            ),
        },
        {
            eyebrow: 'No more guessing',
            title: 'AI-predicted arrival times',
            desc: "Machine-learning predictions for when your flight actually pushes back, wheels up, and reaches the gate — not the airline's optimistic schedule.",
            icon: <Radar size={24} />,
            art: (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 grid grid-cols-2 gap-3">
                    {[['Leaves gate', '8:52 PM'], ['At gate', '10:34 PM']].map(([l, v]) => (
                        <div key={l}>
                            <div className="text-[9px] uppercase tracking-wider text-white/35 font-bold">{l}</div>
                            <div className="text-sm font-mono font-bold text-[#3AB0FF]">{v}</div>
                        </div>
                    ))}
                </div>
            ),
        },
        {
            eyebrow: 'Unlimited',
            title: 'Apollo never taps out',
            desc: 'No daily message cap and no ads anywhere. Plan a whole trip in one sitting — he can create it, price it, and book it without stopping.',
            icon: <Sparkles size={24} />,
            art: (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 flex items-center gap-2 flex-wrap">
                    {['Unlimited chat', 'Zero ads', 'Live voice mode', 'Priority booking'].map(t => (
                        <span key={t} className="text-[10px] font-bold text-[#8DE2FF] bg-[#3AB0FF]/12 border border-[#3AB0FF]/25 px-2.5 py-1 rounded-full">{t}</span>
                    ))}
                </div>
            ),
        },
    ];

    const isLast = step === steps.length - 1;
    const s = steps[step];

    const finish = () => {
        if (onOpenAlerts) onOpenAlerts();
        onClose();
    };

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[140] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div
                initial={{ y: '100%', opacity: 0.5 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 32 }}
                className="w-full sm:max-w-sm bg-[#0f141b] rounded-t-[32px] sm:rounded-[32px] border border-[#3AB0FF]/25 shadow-2xl relative overflow-hidden"
            >
                <div className="absolute -top-28 -right-16 w-72 h-72 bg-[#3AB0FF]/20 rounded-full blur-[80px] pointer-events-none" />
                <div className="sm:hidden pt-2.5 flex justify-center"><div className="w-10 h-1 rounded-full bg-white/25" /></div>

                <div className="relative z-10 p-7 pt-5">
                    <div className="flex items-center gap-2.5 mb-5">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#8DE2FF] to-[#3AB0FF] flex items-center justify-center text-white shrink-0 shadow-lg shadow-[#3AB0FF]/30">
                            {s.icon}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8DE2FF]">{s.eyebrow}</span>
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
                            <h2 className="font-display text-[25px] leading-tight font-bold text-white mb-2.5">{s.title}</h2>
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
                                className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-7 bg-[#3AB0FF]' : 'w-1.5 bg-white/15 hover:bg-white/30'}`}
                            />
                        ))}
                    </div>

                    <button
                        onClick={() => (isLast ? finish() : setStep(step + 1))}
                        className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 press transition-all ${
                            isLast
                                ? 'bg-gradient-to-r from-[#8DE2FF] to-[#3AB0FF] text-[#06131f] shadow-lg shadow-[#3AB0FF]/30'
                                : 'bg-white/[0.07] border border-white/12 text-white hover:border-[#3AB0FF]/40'
                        }`}
                    >
                        {isLast ? <><BadgeCheck size={16} strokeWidth={3} /> Set up my first alert</> : <>Next <ArrowRight size={15} strokeWidth={3} /></>}
                    </button>

                    {isLast && (
                        <button onClick={onClose} className="w-full mt-3 text-[11px] font-bold uppercase tracking-widest text-white/30 hover:text-white/60 transition">
                            Later
                        </button>
                    )}
                </div>
            </motion.div>
        </div>,
        document.body
    );
};
