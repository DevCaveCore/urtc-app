
import React from 'react';
import { Sparkles } from 'lucide-react';

interface AdPlaceholderProps {
    className?: string;
    showLabel?: boolean;
}

export const AdPlaceholder: React.FC<AdPlaceholderProps> = ({ className = "", showLabel = true }) => {
    return (
        <div className={`relative w-full aspect-[4/3] bg-gradient-to-br from-brand-blue/10 to-brand-orange/5 rounded-2xl border-2 border-dashed border-brand-orange/20 overflow-hidden flex flex-col items-center justify-center p-6 ${className}`}>
            {/* Fallback visual if image matches logic but file is missing, or just the component structure */}
            <div className="text-center space-y-3 z-10">
                <div className="bg-brand-orange text-white text-xs font-black px-3 py-1 rounded-full inline-block mb-2 shadow-lg animate-pulse">
                    COMING SOON
                </div>
                <h3 className="text-xl font-black text-brand-dark dark:text-white leading-none">
                    Advertise Here
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[200px] mx-auto">
                    Reach thousands of travelers with your brand.
                </p>
            </div>

            {/* Apollo Picket Sign Image Layer */}
            <img
                src="/assets/apollo_ad_picket.png"
                alt="Apollo holding sign"
                className="absolute -bottom-4 -right-4 w-32 object-contain opacity-90 rotate-[-5deg] hover:rotate-0 transition-transform duration-300"
                onError={(e) => {
                    // Hide image on error so we see the fallback text cleanly
                    (e.target as HTMLImageElement).style.display = 'none';
                }}
            />

            {showLabel && (
                <div className="absolute top-2 right-2 bg-gray-200 dark:bg-white/10 text-[9px] font-bold text-gray-500 px-1.5 py-0.5 rounded">
                    SPONSORED
                </div>
            )}
        </div>
    );
};
