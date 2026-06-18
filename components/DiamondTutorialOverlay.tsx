import React, { useState } from 'react';
import { X, ArrowRight, CheckCircle, Diamond, Zap, Notebook, Tag } from 'lucide-react';

interface DiamondTutorialOverlayProps {
    onClose: () => void;
}

export const DiamondTutorialOverlay: React.FC<DiamondTutorialOverlayProps> = ({ onClose }) => {
    const [step, setStep] = useState(0);

    const steps = [
        {
            title: "Welcome to Diamond",
            desc: "You've unlocked the ultimate travel experience. Here is a quick look at your new premium perks.",
            icon: <Diamond size={48} className="text-[#3AB0FF] drop-shadow-[0_0_15px_rgba(58,176,255,0.8)]" />
        },
        {
            title: "VIP Apollo Access",
            desc: "Skip the line. Enjoy unlimited, priority responses from the Apollo AI assistant whenever you need it.",
            icon: <Zap size={48} className="text-[#3AB0FF]" />
        },
        {
            title: "Unlimited Planning",
            desc: "No more limits. Generate as many detailed, AI-driven itineraries and notes as your adventures require.",
            icon: <Notebook size={48} className="text-[#3AB0FF]" />
        },
        {
            title: "Exclusive Deals",
            desc: "Be the first to know. Get early access and advanced alerts for flight drops and hidden hotel discounts.",
            icon: <Tag size={48} className="text-[#3AB0FF]" />
        }
    ];

    return (
        <div className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-500">
            <div className="bg-[#151921] w-full max-w-sm rounded-[2rem] p-8 border border-[#3AB0FF]/30 shadow-[0_0_50px_rgba(58,176,255,0.15)] relative overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#3AB0FF]/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none"></div>

                <div className="relative z-10 text-center">
                    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-[#E0FFFF] via-[#8DE2FF] to-[#3AB0FF] rounded-full flex items-center justify-center mb-6 shadow-xl relative">
                        <div className="absolute inset-1 bg-[#151921] rounded-full"></div>
                        <div className="relative z-10">{steps[step].icon}</div>
                    </div>

                    <h2 className="text-2xl font-black text-white mb-3 italic tracking-tight">{steps[step].title}</h2>
                    <p className="text-gray-300 leading-relaxed mb-8 text-sm">{steps[step].desc}</p>

                    <div className="flex gap-2 justify-center mb-8">
                        {steps.map((_, i) => (
                            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-[#3AB0FF]' : 'w-2 bg-white/10'}`}></div>
                        ))}
                    </div>

                    <button
                        onClick={() => {
                            if (step < steps.length - 1) setStep(step + 1);
                            else onClose();
                        }}
                        className="w-full bg-gradient-to-r from-[#8DE2FF] to-[#3AB0FF] text-[#0A0D14] py-3.5 rounded-xl font-black text-lg hover:opacity-90 transition shadow-[0_0_20px_rgba(58,176,255,0.4)] flex items-center justify-center gap-2"
                    >
                        {step < steps.length - 1 ? (
                            <>Next <ArrowRight size={18} strokeWidth={3} /></>
                        ) : (
                            <>Enter Diamond <CheckCircle size={18} strokeWidth={3} /></>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
