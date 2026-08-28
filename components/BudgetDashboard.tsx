import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, TrendingDown, TrendingUp, ChevronDown, Pencil, Check, X } from 'lucide-react';

// ── Shared category system: one color language across every budget surface ──
export interface ExpenseCategory {
    key: string;
    label: string;
    emoji: string;
    color: string; // hex
}

const CATEGORIES: ExpenseCategory[] = [
    { key: 'flights', label: 'Flights', emoji: '✈️', color: '#3AB0FF' },
    { key: 'stays', label: 'Stays', emoji: '🏨', color: '#8b5cf6' },
    { key: 'food', label: 'Food & Drink', emoji: '🍽️', color: '#FF6B35' },
    { key: 'transit', label: 'Getting Around', emoji: '🚕', color: '#22d3ee' },
    { key: 'shopping', label: 'Shopping', emoji: '🛍️', color: '#f472b6' },
    { key: 'experiences', label: 'Experiences', emoji: '🎟️', color: '#34d399' },
    { key: 'other', label: 'Other', emoji: '💵', color: '#94a3b8' },
];

export const categorize = (label: string): ExpenseCategory => {
    const l = (label || '').toLowerCase();
    if (/flight|air|plane|baggage/.test(l)) return CATEGORIES[0];
    if (/hotel|stay|airbnb|lodg|hostel|resort/.test(l)) return CATEGORIES[1];
    if (/food|eat|dinner|lunch|breakfast|sushi|restaurant|coffee|bar|drink/.test(l)) return CATEGORIES[2];
    if (/car|uber|lyft|train|transit|gas|taxi|metro|parking|rental/.test(l)) return CATEGORIES[3];
    if (/shop|gift|souvenir|cloth/.test(l)) return CATEGORIES[4];
    if (/ticket|tour|museum|show|park|concert|event|activity|excursion/.test(l)) return CATEGORIES[5];
    return CATEGORIES[6];
};

// Eased count-up so big numbers feel alive without a library
const useCountUp = (target: number, ms = 900): number => {
    const [v, setV] = useState(0);
    useEffect(() => {
        let raf = 0;
        const t0 = performance.now();
        const from = 0;
        const step = (t: number) => {
            const p = Math.min(1, (t - t0) / ms);
            const e = 1 - Math.pow(1 - p, 3);
            setV(from + (target - from) * e);
            if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [target, ms]);
    return v;
};

interface BudgetDashboardProps {
    expenses: { label: string; planned: number }[];
    limit: number;         // 0 = no limit set
    durationDays?: number; // for the per-day figure
}

/**
 * The budget command center: category-colored ring gauge, live numbers,
 * safe-to-spend-per-day, and a color legend that matches the expense rows.
 */
export const BudgetDashboard: React.FC<BudgetDashboardProps> = ({ expenses, limit, durationDays }) => {
    const totalSpent = expenses.reduce((s, e) => s + (e.planned || 0), 0);
    const over = limit > 0 && totalSpent > limit;
    const remaining = limit - totalSpent;

    // Aggregate per category, biggest first
    const slices = useMemo(() => {
        const byCat = new Map<string, { cat: ExpenseCategory; amount: number }>();
        for (const e of expenses) {
            const cat = categorize(e.label);
            const cur = byCat.get(cat.key) || { cat, amount: 0 };
            cur.amount += e.planned || 0;
            byCat.set(cat.key, cur);
        }
        return [...byCat.values()].filter(s => s.amount > 0).sort((a, b) => b.amount - a.amount);
    }, [expenses]);

    // Ring geometry — full circle represents the limit (or total when no limit)
    const R = 74, C = 2 * Math.PI * R;
    const denom = limit > 0 ? Math.max(limit, totalSpent) : (totalSpent || 1);
    let cum = 0;
    const segments = slices.map(s => {
        const frac = s.amount / denom;
        const seg = { color: s.cat.color, frac: Math.max(0, frac - 0.006), start: cum }; // hair gap between arcs
        cum += frac;
        return seg;
    });

    const pctUsed = limit > 0 ? Math.round((totalSpent / limit) * 100) : 100;
    const spentAnim = useCountUp(totalSpent);
    const remainAnim = useCountUp(Math.abs(remaining));
    const perDay = limit > 0 && (durationDays || 0) > 0 && !over ? Math.floor(Math.max(0, remaining) / durationDays!) : null;

    return (
        <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0e1117] p-6 shadow-xl">
            {/* ambient glow follows budget health */}
            <div className={`absolute -top-24 -right-20 w-72 h-72 rounded-full blur-[80px] pointer-events-none ${over ? 'bg-red-500/20' : pctUsed > 85 ? 'bg-amber-500/15' : 'bg-emerald-500/10'}`} />
            <div className="absolute -bottom-28 -left-16 w-64 h-64 rounded-full blur-[80px] bg-brand-blue/10 pointer-events-none" />

            <div className="relative z-10 flex items-center gap-6 flex-wrap sm:flex-nowrap justify-center sm:justify-start">
                {/* ── Ring gauge ── */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.85, rotate: -18 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 120, damping: 16 }}
                    className="relative shrink-0"
                    style={{ width: 190, height: 190 }}
                >
                    <svg width="190" height="190" viewBox="0 0 190 190">
                        <g transform="rotate(-90 95 95)">
                            <circle cx="95" cy="95" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="16" />
                            {segments.map((s, i) => (
                                <motion.circle
                                    key={i}
                                    cx="95" cy="95" r={R} fill="none"
                                    stroke={s.color}
                                    strokeWidth="16"
                                    strokeLinecap="round"
                                    strokeDasharray={`${s.frac * C} ${C}`}
                                    initial={{ strokeDashoffset: -s.start * C + 40, opacity: 0 }}
                                    animate={{ strokeDashoffset: -s.start * C, opacity: 1 }}
                                    transition={{ delay: 0.15 + i * 0.08, type: 'spring', stiffness: 60, damping: 15 }}
                                    style={{ filter: `drop-shadow(0 0 6px ${s.color}55)` }}
                                />
                            ))}
                        </g>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        {limit > 0 ? (
                            <>
                                <div className={`font-display text-4xl font-black leading-none ${over ? 'text-red-400' : 'text-white'}`}>{pctUsed}%</div>
                                <div className="text-[9px] font-bold uppercase tracking-[2px] text-white/35 mt-1.5">of budget</div>
                            </>
                        ) : (
                            <>
                                <div className="font-display text-3xl font-black text-white leading-none">${Math.round(spentAnim).toLocaleString()}</div>
                                <div className="text-[9px] font-bold uppercase tracking-[2px] text-white/35 mt-1.5">planned</div>
                            </>
                        )}
                        {over && <div className="text-[9px] font-black text-red-400 uppercase tracking-wider mt-1 animate-pulse">over budget</div>}
                    </div>
                </motion.div>

                {/* ── Numbers ── */}
                <div className="flex-1 min-w-[200px] space-y-4">
                    <div>
                        <p className="text-[10px] font-bold text-white/35 uppercase tracking-[2px]">Planned spend</p>
                        <p className="font-display text-4xl font-black text-white tracking-tight mt-0.5 tabular-nums">
                            ${Math.round(spentAnim).toLocaleString()}
                            {limit > 0 && <span className="text-white/25 text-lg font-bold"> / ${limit.toLocaleString()}</span>}
                        </p>
                    </div>
                    {limit > 0 && (
                        <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${over ? 'bg-red-500/15 border-red-500/25' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                                {over ? <TrendingUp size={15} className="text-red-400" /> : <TrendingDown size={15} className="text-emerald-400" />}
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-white/35 uppercase tracking-[2px]">{over ? 'Over by' : 'Remaining'}</p>
                                <p className={`font-display text-xl font-black tabular-nums ${over ? 'text-red-400' : 'text-emerald-400'}`}>
                                    ${Math.round(remainAnim).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    )}
                    {perDay !== null && (
                        <div className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-full px-3.5 py-2">
                            <CalendarDays size={12} className="text-brand-orange" />
                            <span className="text-[11px] font-bold text-white/70">Safe to spend <span className="text-white">≈ ${perDay.toLocaleString()}/day</span> · {durationDays} days</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Category legend ── */}
            {slices.length > 0 && (
                <div className="relative z-10 flex gap-2 flex-wrap mt-6 pt-5 border-t border-white/[0.06]">
                    {slices.map(({ cat, amount }) => (
                        <div key={cat.key} className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.08] rounded-full pl-2 pr-3 py-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color, boxShadow: `0 0 8px ${cat.color}88` }} />
                            <span className="text-[10px]">{cat.emoji}</span>
                            <span className="text-[10px] font-bold text-white/60">{cat.label}</span>
                            <span className="text-[10px] font-black text-white tabular-nums">${amount.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ═══════════════ Grouped, expandable, editable expense list ═══════════════
// Apollo (or the user) dumps raw expenses in; they're organized by category.
// Tap a group to drop down its places; pencil to edit any of them in place.

export interface ExpenseItem {
    id: string;
    label: string;
    planned: number;
}

interface ExpenseGroupsProps {
    items: ExpenseItem[];
    onSave: (id: string, label: string, planned: number) => void;
    onDelete: (id: string) => void;
}

export const ExpenseGroups: React.FC<ExpenseGroupsProps> = ({ items, onSave, onDelete }) => {
    const [openGroup, setOpenGroup] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [eLabel, setELabel] = useState('');
    const [eCost, setECost] = useState('');

    const total = items.reduce((s, i) => s + (i.planned || 0), 0);

    const groups = useMemo(() => {
        const map = new Map<string, { cat: ExpenseCategory; items: ExpenseItem[]; sum: number }>();
        for (const it of items) {
            const cat = categorize(it.label);
            const g = map.get(cat.key) || { cat, items: [], sum: 0 };
            g.items.push(it);
            g.sum += it.planned || 0;
            map.set(cat.key, g);
        }
        return [...map.values()].sort((a, b) => b.sum - a.sum);
    }, [items]);

    const startEdit = (it: ExpenseItem) => {
        setEditingId(it.id);
        setELabel(it.label);
        setECost(String(it.planned || ''));
    };

    const commitEdit = () => {
        if (!editingId) return;
        const cost = parseFloat(eCost);
        if (!eLabel.trim() || isNaN(cost) || cost < 0) return;
        onSave(editingId, eLabel.trim(), cost);
        setEditingId(null);
    };

    if (items.length === 0) return null;

    return (
        <div className="space-y-2">
            {groups.map(({ cat, items: gi, sum }) => {
                const share = total > 0 ? Math.round((sum / total) * 100) : 0;
                const open = openGroup === cat.key;
                return (
                    <div key={cat.key} className={`rounded-2xl border overflow-hidden transition-colors ${open ? 'bg-[#12151b]' : 'bg-[#12151b] hover:border-white/15'}`} style={{ borderColor: open ? `${cat.color}55` : 'rgba(255,255,255,0.07)' }}>
                        {/* Group header — tap to drop down the places inside */}
                        <button
                            onClick={() => setOpenGroup(open ? null : cat.key)}
                            onDoubleClick={() => setOpenGroup(cat.key)}
                            className="w-full flex items-center gap-3 p-3.5 text-left"
                        >
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-base shrink-0 border"
                                style={{ background: `${cat.color}1f`, borderColor: `${cat.color}40` }}
                            >
                                {cat.emoji}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-white">{cat.label}</span>
                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md" style={{ color: cat.color, background: `${cat.color}1a` }}>{share}%</span>
                                    <span className="text-[10px] font-bold text-white/30">{gi.length} {gi.length === 1 ? 'item' : 'items'}</span>
                                </div>
                                <div className="mt-1.5 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${share}%`, background: cat.color, boxShadow: `0 0 8px ${cat.color}66` }} />
                                </div>
                            </div>
                            <span className="font-display font-black text-white tabular-nums shrink-0">${sum.toLocaleString()}</span>
                            <ChevronDown size={15} className={`text-white/30 shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown: the individual places */}
                        <AnimatePresence initial={false}>
                            {open && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                                    className="overflow-hidden"
                                >
                                    <div className="px-3.5 pb-3 space-y-1">
                                        {gi.map(it => (
                                            <div key={it.id} className="bg-black/25 border border-white/[0.05] rounded-xl px-3 py-2.5">
                                                {editingId === it.id ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            value={eLabel}
                                                            onChange={e => setELabel(e.target.value)}
                                                            onKeyDown={e => e.key === 'Enter' && commitEdit()}
                                                            autoFocus
                                                            className="flex-1 min-w-0 bg-white/[0.06] border border-white/15 rounded-lg px-2.5 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-brand-orange"
                                                        />
                                                        <div className="relative shrink-0">
                                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-white/40 font-bold">$</span>
                                                            <input
                                                                value={eCost}
                                                                onChange={e => setECost(e.target.value.replace(/[^\d.]/g, ''))}
                                                                onKeyDown={e => e.key === 'Enter' && commitEdit()}
                                                                inputMode="decimal"
                                                                className="w-20 bg-white/[0.06] border border-white/15 rounded-lg pl-5 pr-2 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-brand-orange tabular-nums"
                                                            />
                                                        </div>
                                                        <button onClick={commitEdit} className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 hover:bg-emerald-500 hover:text-white transition shrink-0" title="Save">
                                                            <Check size={14} />
                                                        </button>
                                                        <button onClick={() => setEditingId(null)} className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition shrink-0" title="Cancel">
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cat.color }} />
                                                        <span className="flex-1 text-sm font-bold text-white/80 truncate">{it.label}</span>
                                                        <span className="font-mono font-bold text-sm text-white tabular-nums shrink-0">${(it.planned || 0).toLocaleString()}</span>
                                                        <button onClick={() => startEdit(it)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/35 hover:text-brand-orange hover:bg-white/[0.06] transition shrink-0" title="Edit">
                                                            <Pencil size={13} />
                                                        </button>
                                                        <button onClick={() => onDelete(it.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/35 hover:text-red-400 hover:bg-white/[0.06] transition shrink-0" title="Delete">
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}
        </div>
    );
};
