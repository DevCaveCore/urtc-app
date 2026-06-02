
import React, { useState } from 'react';
import { Plane, Building2, Search, ArrowRight, Play, Info, Sparkles, Zap, Map, Notebook, CreditCard } from 'lucide-react';
import { UserAccount, UserTier, Tab, getRankTitle, BudgetItem } from '../types';
import { getActiveUser } from '../services/authService';
import { TutorialOverlay } from './TutorialOverlay';

interface HomeViewProps {
    user: UserAccount;
    onNavigate: (tab: Tab) => void;
    onExplore: (city: string) => void;
    budgetItems?: BudgetItem[];
    budgetLimit?: number;
}

export const HomeView: React.FC<HomeViewProps> = ({ user, onNavigate, onExplore, budgetItems = [], budgetLimit = 0 }) => {
    const [showTutorial, setShowTutorial] = useState(false);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    // Gamification Stats
    const rank = getRankTitle(user.level || 1);
    const currentLevelXp = 50 * Math.pow(Math.max(0, (user.level || 1) - 1), 2); // Ensure non-negative for level 1
    const nextLevelXp = 50 * Math.pow((user.level || 1), 2);
    const progress = Math.min(100, Math.max(0, ((user.xp || 0) - currentLevelXp) / (nextLevelXp - currentLevelXp) * 100));



    return (
        <div className="space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex justify-between items-center px-2">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Hi, {user.username}</h1>
                        <span className="bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border border-brand-orange/20">Lvl {user.level || 1} • {rank}</span>
                    </div>

                    {/* XP Bar */}
                    <div className="flex items-center gap-2 mt-1">
                        <div className="w-32 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-brand-orange to-brand-blue" style={{ width: `${progress}% ` }}></div>
                        </div>
                        <p className="text-[10px] font-bold text-gray-400">{(user.xp || 0)} / {nextLevelXp} XP</p>


                    </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-brand-orange text-white flex items-center justify-center font-bold text-lg shadow-lg">
                    {user.username.charAt(0)}
                </div>
            </div>

            {/* Active Trip / Status Card */}
            <div className="bg-gradient-to-br from-brand-dark to-[#151921] border border-white/10 rounded-3xl p-6 relative overflow-hidden shadow-2xl group cursor-pointer transition-transform active:scale-98" onClick={() => onNavigate(Tab.Flights)}>
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Plane size={120} />
                </div>
                <div className="relative z-10">
                    <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/30 px-3 py-1 rounded-full text-green-400 text-[10px] font-bold uppercase tracking-wider mb-4">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        Ready for Takeoff
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-1">No Active Trips</h3>
                    <p className="text-gray-400 text-sm mb-6">Start planning your next adventure today.</p>

                    <button className="bg-brand-orange text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-orange-600 transition shadow-lg">
                        Find Flights <ArrowRight size={16} />
                    </button>
                </div>
            </div>

            {/* Budget Summary Card */}
            {budgetLimit > 0 && (
                <div onClick={() => onNavigate(Tab.Itinerary)} className="bg-white dark:bg-[#151921] border border-gray-200 dark:border-white/10 rounded-2xl p-4 shadow-sm cursor-pointer hover:border-brand-orange/30 transition group">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span className="text-brand-orange">💰</span> Trip Budget
                        </h3>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider group-hover:text-brand-orange transition">View Details →</span>
                    </div>
                    <div className="flex justify-between items-end mb-2">
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Spent</p>
                            <p className="text-lg font-black text-gray-900 dark:text-white">${budgetItems.reduce((s, i) => s + i.cost, 0).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Budget</p>
                            <p className="text-lg font-black text-brand-orange">${budgetLimit.toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${(budgetItems.reduce((s, i) => s + i.cost, 0) / budgetLimit) > 0.9 ? 'bg-red-500' : (budgetItems.reduce((s, i) => s + i.cost, 0) / budgetLimit) > 0.7 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, (budgetItems.reduce((s, i) => s + i.cost, 0) / budgetLimit) * 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 text-right">${Math.max(0, budgetLimit - budgetItems.reduce((s, i) => s + i.cost, 0)).toLocaleString()} remaining</p>
                </div>
            )}

            {/* Quick Actions Grid */}
            <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><Zap size={16} className="text-brand-orange" /> Quick Actions</h2>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => onNavigate(Tab.Explore)} className="bg-white dark:bg-[#151921] p-4 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm hover:border-brand-orange/30 transition text-left flex flex-col gap-3 group">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform"><Building2 size={20} /></div>
                        <div>
                            <span className="block font-bold text-gray-900 dark:text-white">Explore City</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Find hotels & food</span>
                        </div>
                    </button>
                    <button onClick={() => onNavigate(Tab.Apollo)} className="bg-white dark:bg-[#151921] p-4 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm hover:border-brand-orange/30 transition text-left flex flex-col gap-3 group">
                        <div className="w-10 h-10 rounded-full bg-brand-orange/10 flex items-center justify-center text-brand-orange group-hover:scale-110 transition-transform"><Sparkles size={20} /></div>
                        <div>
                            <span className="block font-bold text-gray-900 dark:text-white">Ask Apollo</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">AI Trip Assistant</span>
                        </div>
                    </button>
                    <button onClick={() => onNavigate(Tab.Itinerary)} className="bg-white dark:bg-[#151921] p-4 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm hover:border-brand-orange/30 transition text-left flex flex-col gap-3 group">
                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 group-hover:scale-110 transition-transform"><Notebook size={20} /></div>
                        <div>
                            <span className="block font-bold text-gray-900 dark:text-white">My Plans</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Notes & Budget</span>
                        </div>
                    </button>
                    <button onClick={() => onNavigate(Tab.About)} className="bg-white dark:bg-[#151921] p-4 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm hover:border-brand-orange/30 transition text-left flex flex-col gap-3 group">
                        <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform"><CreditCard size={20} /></div>
                        <div>
                            <span className="block font-bold text-gray-900 dark:text-white">My Wallet</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Plans & Settings</span>
                        </div>
                    </button>
                </div>
            </div>

            {/* Ad Slot (Native) */}
            {(user.tier === UserTier.Guest || user.tier === UserTier.Free) && (
                <div className="bg-gray-100 dark:bg-white/5 rounded-2xl p-4 border border-gray-200 dark:border-white/5 flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-300 dark:bg-white/10 rounded-lg flex items-center justify-center text-xs font-bold text-gray-500">AD</div>
                    <div className="flex-1">
                        <p className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-1">Sponsored</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">Upgrade to Pro for the ultimate travel experience.</p>
                    </div>
                    <button className="text-brand-orange text-xs font-bold hover:underline" onClick={() => onNavigate(Tab.About)}>View Plans</button>
                </div>
            )}

            {/* Tutorial Section */}
            <div className="bg-brand-blue/10 rounded-3xl p-4 border border-brand-blue/20">
                <div className="flex items-center gap-3 mb-2">
                    <div className="bg-brand-blue text-white p-2 rounded-lg">
                        <Info size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-brand-blue">New to ÜrTC?</h3>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 leading-relaxed">
                    Discover how to use Apollo AI to simulate flight prices, find hidden gems in any city, and organize your entire trip in one place.
                </p>
                <button
                    onClick={() => setShowTutorial(true)}
                    className="w-full bg-brand-blue text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-600 transition shadow-lg active:scale-95"
                >
                    <Play size={18} fill="currentColor" /> Start Interactive Tutorial
                </button>
            </div>



            {showTutorial && <TutorialOverlay onClose={() => setShowTutorial(false)} />}
        </div>
    );
};
