
import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { UserTier } from '../types';

interface InterstitialAdProps {
    onClose: () => void;
    onUpgrade: () => void;
}

export const InterstitialAd: React.FC<InterstitialAdProps> = ({ onClose, onUpgrade }) => {
    const [timeLeft, setTimeLeft] = useState(5);
    const [canClose, setCanClose] = useState(false);

    useEffect(() => {
        if (timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setCanClose(true);
        }
    }, [timeLeft]);

    return (
        <div className="fixed inset-0 z-[100] bg-brand-dark/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-[#1A1E29] border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative">

                {/* Header Image/Banner */}
                <div className="h-48 bg-gradient-to-br from-brand-orange to-red-600 relative overflow-hidden flex items-center justify-center">
                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-overlay"></div>
                    <div className="relative z-10 text-center p-4">
                        <h2 className="text-3xl font-black text-white mb-1 drop-shadow-md">GO PRO</h2>
                        <p className="text-white/90 text-sm font-medium">Unlock the full experience</p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-gray-300">
                            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 shrink-0"><Check size={14} strokeWidth={3} /></div>
                            <span className="text-sm font-medium">Unlimited Apollo AI Chat</span>
                        </div>
                        <div className="flex items-center gap-3 text-gray-300">
                            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 shrink-0"><Check size={14} strokeWidth={3} /></div>
                            <span className="text-sm font-medium">No Ads ever</span>
                        </div>
                        <div className="flex items-center gap-3 text-gray-300">
                            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 shrink-0"><Check size={14} strokeWidth={3} /></div>
                            <span className="text-sm font-medium">Advanced Flight Analytics</span>
                        </div>
                    </div>

                    <button
                        onClick={onUpgrade}
                        className="w-full py-4 bg-white text-black rounded-xl font-black text-lg hover:scale-[1.02] transition-transform active:scale-95 shadow-xl"
                    >
                        UPGRADE NOW
                    </button>

                    <div className="text-center">
                        <button
                            onClick={onClose}
                            disabled={!canClose}
                            className={`text-gray-500 text-xs font-bold uppercase tracking-widest hover:text-white transition ${!canClose ? 'opacity-50 cursor-not-allowed' : 'opacity-100 cursor-pointer'}`}
                        >
                            {canClose ? "Skip to App" : `Skip in ${timeLeft}s`}
                        </button>
                    </div>
                </div>

                {/* Close Button (Hidden initially) */}
                {canClose && (
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition backdrop-blur-md"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>
        </div>
    );
};
