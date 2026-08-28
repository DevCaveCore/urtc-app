import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, MapPin, ImagePlus, Check, Sparkles, Bell, Globe2, Camera, Route } from 'lucide-react';
// Note: this whole view is a designed preview of an unbuilt feature. The post,
// its engagement numbers and the photos are illustrative, not real user data.

// Real travel imagery, same CDN the rest of the app already uses.
const COLLAGE = [
    { src: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=500&q=70&auto=format&fit=crop', place: 'Tokyo' },
    { src: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=500&q=70&auto=format&fit=crop', place: 'Santorini' },
    { src: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=500&q=70&auto=format&fit=crop', place: 'Bali' },
    { src: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=500&q=70&auto=format&fit=crop', place: 'Paris' },
    { src: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=500&q=70&auto=format&fit=crop', place: 'Dubai' },
    { src: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=500&q=70&auto=format&fit=crop', place: 'New York' },
    { src: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=500&q=70&auto=format&fit=crop', place: 'Iceland' },
    { src: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=500&q=70&auto=format&fit=crop', place: 'Rome' },
];

// The caption that types itself in the mock composer, then resets.
const DEMO_CAPTION = 'Sunset from Cap Blanc-Nez. Apollo said golden hour was 8:41 — he was right.';

const NOTIFY_KEY = 'urtc_wander_notify';

/** Types a string out character by character, then holds, then restarts. */
const useTypewriter = (text: string, speedMs = 42, holdMs = 2600) => {
    const [out, setOut] = useState('');
    const [done, setDone] = useState(false);
    useEffect(() => {
        let i = 0;
        let holdTimer: ReturnType<typeof setTimeout>;
        const tick = setInterval(() => {
            i += 1;
            setOut(text.slice(0, i));
            if (i >= text.length) {
                clearInterval(tick);
                setDone(true);
                holdTimer = setTimeout(() => { setOut(''); setDone(false); i = 0; }, holdMs);
            }
        }, speedMs);
        return () => { clearInterval(tick); clearTimeout(holdTimer); };
    }, [text, speedMs, holdMs, out === '' && !done ? Math.random() : 0]);
    return { out, done };
};

/** A number that counts up when `active` flips true — the little dopamine tick. */
const useCountUp = (target: number, active: boolean) => {
    const [n, setN] = useState(0);
    useEffect(() => {
        if (!active) { setN(0); return; }
        let cur = 0;
        const step = setInterval(() => {
            cur += Math.max(1, Math.round(target / 14));
            if (cur >= target) { cur = target; clearInterval(step); }
            setN(cur);
        }, 55);
        return () => clearInterval(step);
    }, [target, active]);
    return n;
};

export const SocialView: React.FC = React.memo(() => {
    const { out: caption, done } = useTypewriter(DEMO_CAPTION);
    const likes = useCountUp(128, done);
    const comments = useCountUp(19, done);
    const [notified, setNotified] = useState(false);

    useEffect(() => {
        try { setNotified(localStorage.getItem(NOTIFY_KEY) === '1'); } catch { /* ignore */ }
    }, []);

    const optIn = () => {
        try { localStorage.setItem(NOTIFY_KEY, '1'); } catch { /* ignore */ }
        setNotified(true);
    };

    // Deterministic tilts so the collage looks hand-scattered, not random each render
    const tiles = useMemo(() => COLLAGE.map((c, i) => ({
        ...c,
        rotate: [-6, 4, -3, 7, -5, 3, -7, 5][i % 8],
        delay: i * 0.09,
    })), []);

    return (
        <div className="pb-32 pt-6 px-4 space-y-8">

            {/* ── Hero: drifting collage behind the title ── */}
            <div className="relative rounded-[32px] overflow-hidden border border-white/10 min-h-[330px] flex items-end">
                <div className="absolute inset-0 grid grid-cols-4 gap-1.5 p-1.5 opacity-45">
                    {tiles.map((t, i) => (
                        <motion.div
                            key={t.place}
                            initial={{ opacity: 0, scale: 1.15 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: t.delay, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                            className={`relative rounded-2xl overflow-hidden ${i % 3 === 0 ? 'row-span-2' : ''}`}
                            style={{ rotate: `${t.rotate * 0.35}deg` }}
                        >
                            <img src={t.src} alt={t.place} loading="lazy" className="w-full h-full object-cover" />
                        </motion.div>
                    ))}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#08090C] via-[#08090C]/85 to-[#08090C]/40" />

                <div className="relative z-10 p-6 w-full">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-brand-orange/30 bg-brand-orange/10 mb-3">
                        <Sparkles size={11} className="text-brand-orange" />
                        <span className="text-[10px] font-black text-brand-orange tracking-[0.2em] uppercase">Coming Soon</span>
                    </div>
                    <h1 className="font-display text-4xl font-bold text-white leading-none">Wander</h1>
                    <p className="text-sm text-white/55 mt-2.5 leading-relaxed max-w-sm">
                        The trips you actually took — posted from the itinerary you already built. No captions about nothing. Real routes, real spots, real costs.
                    </p>
                </div>
            </div>

            {/* ── Living mockup: a post writing itself ── */}
            <div>
                <div className="flex items-center gap-2 mb-3 px-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">A peek at posting</span>
                    <span className="flex-1 h-px bg-white/[0.07]" />
                    <span className="flex items-center gap-1 text-[10px] font-bold text-brand-orange">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-orange animate-pulse" /> live preview
                    </span>
                </div>

                <div className="rounded-3xl border border-white/10 bg-[#10131A] overflow-hidden shadow-2xl">
                    {/* composer header */}
                    <div className="flex items-center gap-3 p-4 border-b border-white/[0.06]">
                        <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-brand-orange/40 shrink-0">
                            <img src="/assets/apollo_pilot.jpg" alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-sm font-bold text-white leading-tight">You</div>
                            <div className="text-[11px] text-white/40 flex items-center gap-1">
                                <MapPin size={9} className="text-brand-orange" /> Cap Blanc-Nez, France
                            </div>
                        </div>
                        <div className="ml-auto text-[10px] font-black uppercase tracking-wider text-brand-orange bg-brand-orange/10 border border-brand-orange/25 px-2.5 py-1 rounded-full">
                            From your trip
                        </div>
                    </div>

                    {/* typing caption */}
                    <div className="px-4 pt-3.5 pb-2 min-h-[62px]">
                        <p className="text-[15px] text-white/85 leading-relaxed">
                            {caption}
                            <span className={`inline-block w-[2px] h-[15px] align-middle ml-0.5 bg-brand-orange ${done ? 'opacity-0' : 'animate-pulse'}`} />
                        </p>
                    </div>

                    {/* photos popping in as they "attach" */}
                    <div className="px-4 pb-3 grid grid-cols-3 gap-2">
                        {COLLAGE.slice(0, 3).map((c, i) => (
                            <motion.div
                                key={c.place}
                                initial={{ opacity: 0, y: 14, scale: 0.92 }}
                                animate={done ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0.25, y: 8, scale: 0.96 }}
                                transition={{ delay: done ? i * 0.12 : 0, type: 'spring', stiffness: 260, damping: 22 }}
                                className="aspect-square rounded-xl overflow-hidden border border-white/10 relative"
                            >
                                <img src={c.src} alt="" loading="lazy" className="w-full h-full object-cover" />
                                {!done && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                        <ImagePlus size={15} className="text-white/40" />
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>

                    {/* engagement ticking up once posted */}
                    <div className="flex items-center gap-5 px-4 py-3 border-t border-white/[0.06] bg-white/[0.02]">
                        <span className="flex items-center gap-1.5 text-[13px] font-bold text-white/70">
                            <Heart size={15} className={done ? 'text-red-400 fill-red-400' : 'text-white/25'} />
                            <span className="tabular-nums">{likes}</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-[13px] font-bold text-white/70">
                            <MessageCircle size={15} className={done ? 'text-brand-blue' : 'text-white/25'} />
                            <span className="tabular-nums">{comments}</span>
                        </span>
                        <span className="ml-auto text-[11px] font-bold text-white/30">
                            {done ? 'Posted to Wander' : 'Composing…'}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── What's actually coming ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                    { icon: <Route size={17} />, title: 'Post the real route', body: 'Your itinerary becomes the post — flights, stops and what it cost.' },
                    { icon: <Camera size={17} />, title: 'Photos with places attached', body: 'Every shot pinned to the spot, so someone can actually go there.' },
                    { icon: <Globe2 size={17} />, title: 'Steal a trip', body: 'Like what you see? Apollo rebuilds it as your own plan in one tap.' },
                ].map(f => (
                    <div key={f.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                        <div className="w-9 h-9 rounded-xl bg-brand-orange/12 border border-brand-orange/25 flex items-center justify-center text-brand-orange mb-3">
                            {f.icon}
                        </div>
                        <div className="text-sm font-bold text-white mb-1">{f.title}</div>
                        <p className="text-xs text-white/45 leading-relaxed">{f.body}</p>
                    </div>
                ))}
            </div>

            {/* ── The endliner ── */}
            <div className="relative rounded-[28px] overflow-hidden border border-brand-orange/25 p-8 text-center">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-orange/18 via-transparent to-brand-blue/12" />
                <div className="absolute -top-16 -right-10 w-52 h-52 rounded-full bg-brand-orange/20 blur-[70px]" />
                <div className="relative z-10">
                    <h2 className="font-display text-3xl font-bold text-white leading-none">Are you in?</h2>
                    <p className="text-sm text-white/55 mt-3 max-w-xs mx-auto leading-relaxed">
                        Wander opens to ÜrTC travelers first. Put your name down and Apollo will fetch you the moment it does.
                    </p>
                    {notified ? (
                        <div className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-sm">
                            <Check size={16} /> You're on the list 🐾
                        </div>
                    ) : (
                        <button
                            onClick={optIn}
                            className="mt-6 inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-brand-orange to-red-500 text-white font-black text-sm shadow-lg shadow-brand-orange/30 press"
                        >
                            <Bell size={16} /> Count me in
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});
