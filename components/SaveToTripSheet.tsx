import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, PlusCircle, Loader2, Check, MapPin, Plane } from 'lucide-react';
import { Trip } from '../types';
import { fetchTrips, createTrip } from '../services/tripService';

interface SaveToTripSheetProps {
    /** What's being saved — shown in the title. Null = closed. */
    itemLabel: string | null;
    /** 'place' | 'flight' — only changes the icon and default trip name */
    kind?: 'place' | 'flight';
    userId: string;
    /** Suggested name when creating a trip inline (e.g. the city) */
    suggestedTripName?: string;
    onClose: () => void;
    /** Called with the chosen (or newly created) trip */
    onPick: (trip: Trip) => Promise<void> | void;
}

/**
 * One sheet for "save this to a trip", used from Explore, Flights, anywhere.
 * Crucially it can CREATE a trip inline — no more "go to the Plans tab first".
 * Portaled to <body> so no ancestor transform can trap it off-screen.
 */
export const SaveToTripSheet: React.FC<SaveToTripSheetProps> = ({
    itemLabel, kind = 'place', userId, suggestedTripName, onClose, onPick,
}) => {
    const [trips, setTrips] = useState<Trip[]>([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [busyId, setBusyId] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);

    useEffect(() => {
        if (!itemLabel) { setDone(null); setCreating(false); setNewName(''); return; }
        let alive = true;
        setLoading(true);
        fetchTrips(userId).then(t => {
            if (!alive) return;
            const active = t.filter(x => !x.archived);
            setTrips(active);
            setLoading(false);
            // No trips yet? Open straight into the create field — that's the
            // whole point: never send someone to another tab to get started.
            if (active.length === 0) {
                setCreating(true);
                setNewName(suggestedTripName || '');
            }
        });
        return () => { alive = false; };
    }, [itemLabel, userId, suggestedTripName]);

    useEffect(() => {
        if (!itemLabel) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [itemLabel, onClose]);

    const pick = async (trip: Trip) => {
        setBusyId(trip.id);
        try {
            await onPick(trip);
            setDone(trip.name);
            setTimeout(onClose, 900); // let them see it landed
        } finally {
            setBusyId(null);
        }
    };

    const createAndPick = async () => {
        const name = newName.trim();
        if (!name) return;
        setBusyId('new');
        try {
            const trip = await createTrip(userId, name);
            if (trip) {
                await onPick(trip);
                setDone(trip.name);
                try { window.dispatchEvent(new CustomEvent('urtc-trips-changed')); } catch { /* SSR safe */ }
                setTimeout(onClose, 900);
            }
        } finally {
            setBusyId(null);
        }
    };

    if (typeof document === 'undefined') return null;

    return createPortal(
        <AnimatePresence>
            {itemLabel && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
                        onClick={e => e.stopPropagation()}
                        className="w-full sm:max-w-sm bg-[#151921] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
                    >
                        <div className="sm:hidden pt-2.5 flex justify-center"><div className="w-10 h-1 rounded-full bg-white/25" /></div>

                        <div className="flex items-start justify-between p-5 pb-3 gap-3">
                            <div className="min-w-0">
                                <h3 className="font-bold text-base text-white leading-tight">Save to a trip</h3>
                                <p className="text-xs text-white/45 mt-1 flex items-center gap-1.5 truncate">
                                    {kind === 'flight' ? <Plane size={11} className="shrink-0" /> : <MapPin size={11} className="shrink-0" />}
                                    <span className="truncate">{itemLabel}</span>
                                </p>
                            </div>
                            <button onClick={onClose} className="p-2 -mr-1 -mt-1 text-white/35 hover:text-white rounded-full hover:bg-white/10 transition shrink-0" aria-label="Close">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="px-5 pb-5 space-y-2">
                            {done ? (
                                <div className="py-6 flex flex-col items-center gap-2.5 text-center">
                                    <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                                        <Check size={22} className="text-emerald-400" />
                                    </div>
                                    <div className="text-sm font-bold text-white">Saved to {done}</div>
                                </div>
                            ) : loading ? (
                                <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-brand-orange" size={22} /></div>
                            ) : (
                                <>
                                    {trips.map(trip => (
                                        <button
                                            key={trip.id}
                                            onClick={() => pick(trip)}
                                            disabled={!!busyId}
                                            className="w-full text-left px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-brand-orange/60 transition press flex items-center gap-3 disabled:opacity-50"
                                        >
                                            <span className="flex-1 text-sm font-bold text-white truncate">{trip.name}</span>
                                            {busyId === trip.id
                                                ? <Loader2 size={15} className="animate-spin text-brand-orange shrink-0" />
                                                : <PlusCircle size={15} className="text-white/25 shrink-0" />}
                                        </button>
                                    ))}

                                    {creating ? (
                                        <div className="flex gap-2 pt-1">
                                            <input
                                                autoFocus
                                                value={newName}
                                                onChange={e => setNewName(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && createAndPick()}
                                                placeholder="Name your trip…"
                                                className="flex-1 min-w-0 bg-white/[0.06] border border-white/15 rounded-2xl px-4 py-3 text-sm font-bold text-white placeholder-white/30 focus:outline-none focus:border-brand-orange transition"
                                            />
                                            <button
                                                onClick={createAndPick}
                                                disabled={!newName.trim() || !!busyId}
                                                className="px-4 rounded-2xl bg-gradient-to-r from-brand-orange to-red-500 text-white font-black text-sm shadow-lg shadow-brand-orange/25 disabled:opacity-40 press shrink-0"
                                            >
                                                {busyId === 'new' ? <Loader2 size={15} className="animate-spin" /> : 'Create'}
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => { setCreating(true); setNewName(suggestedTripName || ''); }}
                                            className="w-full px-4 py-3 rounded-2xl border border-dashed border-white/20 text-sm font-bold text-white/60 hover:text-brand-orange hover:border-brand-orange/50 transition press flex items-center justify-center gap-2"
                                        >
                                            <PlusCircle size={15} /> New trip
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};
