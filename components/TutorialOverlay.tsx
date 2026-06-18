
import React, { useState } from 'react';
import { X, ArrowRight, CheckCircle, Plane, Sparkles, Map } from 'lucide-react';

interface TutorialOverlayProps {
    onClose: () => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ onClose }) => {
    const [step, setStep] = useState(0);

    const steps = [
        {
            title: "Welcome to ÜrTC",
            desc: "Your ultimate AI-powered travel companion. Let's show you around quickly.",
            icon: <Plane size={48} className="text-brand-orange" />
        },
        {
            title: "Meet Apollo",
            desc: "Tap the center dog icon to chat with Apollo. He can find flights, plan budgets, and even tell jokes.",
            icon: <Sparkles size={48} className="text-brand-orange" />
        },
        {
            title: "Explore Cities",
            desc: "Use the Explore tab to find hotels, food, and attractions with smart price estimates.",
            icon: <Map size={48} className="text-brand-orange" />
        },
        {
            title: "Your Plans",
            desc: "Use the Plans tab to manage itineraries and save places. Sync Travel coming soon in Version 1.3!",
            icon: <CheckCircle size={48} className="text-brand-orange" />
        }
    ];

    return (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-[#151921] w-full max-w-sm rounded-[2rem] p-8 border border-white/10 shadow-2xl relative overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-orange/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>

                <div className="relative z-10 text-center">
                    <div className="w-20 h-20 mx-auto bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-6 ring-4 ring-brand-orange/10">
                        {steps[step].icon}
                    </div>

                    <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-3">{steps[step].title}</h2>
                    <p className="text-gray-500 dark:text-gray-400 leading-relaxed mb-8">{steps[step].desc}</p>

                    <div className="flex gap-2 justify-center mb-8">
                        {steps.map((_, i) => (
                            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-brand-orange' : 'w-2 bg-gray-300 dark:bg-white/10'}`}></div>
                        ))}
                    </div>

                    <button
                        onClick={() => {
                            if (step < steps.length - 1) setStep(step + 1);
                            else onClose();
                        }}
                        className="w-full bg-brand-orange text-white py-3.5 rounded-xl font-bold text-lg hover:bg-orange-600 transition shadow-lg flex items-center justify-center gap-2"
                    >
                        {step < steps.length - 1 ? (
                            <>Next <ArrowRight size={18} strokeWidth={3} /></>
                        ) : (
                            <>Get Started <CheckCircle size={18} strokeWidth={3} /></>
                        )}
                    </button>

                    <button onClick={onClose} className="mt-4 text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-white transition">Skip Tutorial</button>
                </div>
            </div>
        </div>
    );
};
