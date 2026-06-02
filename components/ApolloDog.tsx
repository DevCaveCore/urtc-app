
import React, { useState, useEffect } from 'react';

interface Props {
 className?: string;
 size?: number;
 interactive?: boolean;
 wagOnHover?: boolean;
 variant?: 'default' | 'aviator';
}

export const EnhancedApolloDogIcon: React.FC<Props> = ({
 className = "",
 size = 60,
 interactive = true,
 wagOnHover = true,
 variant = 'default'
}) => {
 const [isWagging, setIsWagging] = useState(false);
 const [isBlinking, setIsBlinking] = useState(false);

 useEffect(() => {
   const interval = setInterval(() => {
     if (Math.random() > 0.7) {
       setIsBlinking(true);
       setTimeout(() => setIsBlinking(false), 200);
     }
   }, 3500);
   return () => clearInterval(interval);
 }, []);

 const handleMouseEnter = () => {
   if (interactive && wagOnHover) setIsWagging(true);
 };

 const handleMouseLeave = () => {
   if (interactive && wagOnHover) setIsWagging(false);
 };

 const handleClick = () => {
   if (interactive) setIsWagging(!isWagging);
 };

 return (
   <div
     className={`relative inline-block select-none cursor-pointer ${className}`}
     style={{ width: size, height: size }}
     onMouseEnter={handleMouseEnter}
     onMouseLeave={handleMouseLeave}
     onClick={handleClick}
     role="img"
     aria-label="Apollo the Dog"
   >
     <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible drop-shadow-xl">
       <defs>
         <linearGradient id="furGradient" x1="0%" y1="0%" x2="100%" y2="100%">
           <stop offset="0%" stopColor="#C27A38" />
           <stop offset="100%" stopColor="#8B5A2B" />
         </linearGradient>
         <radialGradient id="noseGradient" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#4A3B2A" />
            <stop offset="100%" stopColor="#2A1A10" />
         </radialGradient>
         <radialGradient id="propellerGradient" cx="50%" cy="50%" r="50%">
             <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
             <stop offset="100%" stopColor="rgba(255,255,255,0)" />
         </radialGradient>
       </defs>

       {/* --- LAYER 1: BEHIND DOG (Tail, Scarf) --- */}
       {variant === 'aviator' && (
           <g id="plane-backend">
               {/* Tail Fin Vertical */}
               <path d="M20 90 L 50 90 L 40 40 Q 25 40 20 60 Z" fill="#D32F2F" stroke="#B71C1C" strokeWidth="2" />
               {/* Tail Stabilizer Horizontal */}
               <path d="M10 95 L 60 95 L 50 110 L 10 105 Z" fill="#C62828" stroke="#B71C1C" strokeWidth="2" />
               
               {/* Scarf Blowing in Wind */}
               <path d="M85 110 Q 50 105 10 115 L 5 130 Q 50 125 85 125 Z" fill="#EF5350" stroke="#B71C1C" strokeWidth="1" className="animate-pulse" />
           </g>
       )}

       {/* --- LAYER 2: DOG BODY --- */}
       
       {/* Tail (Only if not aviator) */}
       {variant !== 'aviator' && (
        <path
           d="M130 135 Q 160 110 165 75 Q 155 70 145 75 Q 140 110 130 135"
           fill="#C27A38" stroke="#8B5A2B" strokeWidth="2"
           className={`transition-transform duration-300 origin-[130px_135px] ${isWagging ? 'animate-wag' : ''}`}
        />
       )}

       {/* Body Base */}
       {variant !== 'aviator' ? (
            <ellipse cx="95" cy="120" rx="50" ry="55" fill="url(#furGradient)" />
       ) : (
            // In aviator, body is positioned to sit in cockpit
            <ellipse cx="95" cy="115" rx="40" ry="45" fill="url(#furGradient)" />
       )}
       
       {/* --- LAYER 3: DOG HEAD --- */}
       <g transform={variant === 'aviator' ? "translate(0, -5)" : "translate(0, -15)"}>
           {/* Ears */}
           <path d="M40 55 Q 10 55 15 95 C 20 110, 45 80, 50 65 Z" fill="#8B5A2B" stroke="#6F4E37" strokeWidth="2" />
           <path d="M150 55 Q 180 55 175 95 C 170 110, 145 80, 140 65 Z" fill="#8B5A2B" stroke="#6F4E37" strokeWidth="2" />

           {/* Face Base */}
           <circle cx="95" cy="65" r="48" fill="#C27A38" stroke="#8B5A2B" strokeWidth="2" />
          
           {/* Muzzle */}
           <ellipse cx="95" cy="82" rx="20" ry="16" fill="#E8B486" />
          
           {/* Nose */}
           <path d="M85 76 Q 95 70 105 76 Q 95 90 85 76" fill="url(#noseGradient)" />
           <circle cx="90" cy="78" r="1.5" fill="white" opacity="0.4" />

           {/* Mouth */}
           <path d="M88 88 Q 95 94 102 88" fill="none" stroke="#2A1A10" strokeWidth="2" strokeLinecap="round" />
          
           {/* Tongue */}
           <g transform={`scale(${isWagging || variant === 'aviator' ? 1 : 0})`} style={{ transformOrigin: '95px 88px', transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
               <path d="M92 90 Q 95 102 98 90" fill="#FF8888" stroke="#CC5555" strokeWidth="1" />
           </g>

           {/* Eyes */}
           <g transform={`scale(1 ${isBlinking ? 0.1 : 1})`} style={{ transformOrigin: '95px 60px', transition: 'transform 0.1s' }}>
               <ellipse cx="78" cy="60" rx="5" ry="7" fill="#2A1A10" />
               <circle cx="80" cy="58" r="2" fill="white" />
               <ellipse cx="112" cy="60" rx="5" ry="7" fill="#2A1A10" />
               <circle cx="114" cy="58" r="2" fill="white" />
           </g>

           {/* --- AVIATOR HAT & GOGGLES --- */}
           {variant === 'aviator' && (
               <g id="aviator-hat">
                   {/* Leather Cap Main */}
                   <path d="M48 58 C 48 30 142 30 142 58 C 142 75 135 90 125 90 L 125 80 C 125 80 110 80 95 80 C 80 80 65 80 65 80 L 65 90 C 55 90 48 75 48 58 Z" fill="#5D4037" stroke="#3E2723" strokeWidth="2" />
                   {/* Flaps */}
                   <path d="M48 58 Q 40 70 45 85" stroke="#5D4037" strokeWidth="4" fill="none" />
                   <path d="M142 58 Q 150 70 145 85" stroke="#5D4037" strokeWidth="4" fill="none" />
                   
                   {/* Goggles */}
                   <g transform="translate(0, -8)">
                       {/* Strap */}
                       <path d="M49 60 Q 95 50 141 60" stroke="#263238" strokeWidth="5" fill="none" />
                       {/* Lenses */}
                       <circle cx="75" cy="60" r="16" fill="#81D4FA" stroke="#37474F" strokeWidth="3" opacity="0.9" />
                       <path d="M70 55 L 80 55" stroke="white" strokeWidth="2" opacity="0.4" />
                       <circle cx="115" cy="60" r="16" fill="#81D4FA" stroke="#37474F" strokeWidth="3" opacity="0.9" />
                       <path d="M110 55 L 120 55" stroke="white" strokeWidth="2" opacity="0.4" />
                       {/* Bridge */}
                       <path d="M91 60 L 99 60" stroke="#37474F" strokeWidth="3" />
                   </g>
               </g>
           )}
       </g>

       {/* --- LAYER 4: PLANE FRONT & COCKPIT --- */}
       {variant === 'aviator' && (
           <g id="plane-frontend">
               {/* Cockpit Interior Hole */}
               <ellipse cx="95" cy="115" rx="50" ry="15" fill="#3E2723" stroke="#212121" strokeWidth="1" />
               
               {/* Main Fuselage Body */}
               <path d="M 35 110 Q 100 95 160 115 Q 185 125 185 135 Q 185 155 160 165 Q 100 175 35 145 Q 25 125 35 110 Z" fill="#F44336" stroke="#B71C1C" strokeWidth="3" />
               
               {/* Shiny Highlight on Fuselage */}
               <path d="M 45 115 Q 100 105 155 120" fill="none" stroke="white" strokeWidth="4" opacity="0.3" strokeLinecap="round" />
               
               {/* Main Wing (Side View) */}
               <path d="M 60 135 L 140 135 Q 155 135 150 150 L 55 150 Q 45 135 60 135 Z" fill="#D32F2F" stroke="#B71C1C" strokeWidth="3" />
               
               {/* Propeller Hub */}
               <circle cx="185" cy="135" r="8" fill="#546E7A" stroke="#263238" strokeWidth="2" />
               
               {/* Spinning Propeller Blur */}
               <g transform="translate(185, 135)">
                   <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="0.08s" repeatCount="indefinite" />
                   <ellipse cx="0" cy="0" rx="65" ry="8" fill="url(#propellerGradient)" opacity="0.8" />
                   <ellipse cx="0" cy="0" rx="8" ry="65" fill="url(#propellerGradient)" opacity="0.8" />
               </g>
               
               {/* Landing Gear */}
               <g id="gear">
                   <path d="M 75 160 L 75 180" stroke="#37474F" strokeWidth="4" />
                   <circle cx="75" cy="185" r="10" fill="#212121" stroke="#424242" strokeWidth="2" />
                   
                   <path d="M 125 160 L 125 180" stroke="#37474F" strokeWidth="4" />
                   <circle cx="125" cy="185" r="10" fill="#212121" stroke="#424242" strokeWidth="2" />
               </g>
               
               {/* Scarf Front Knot */}
               <path d="M80 125 Q 95 135 110 125" stroke="#D32F2F" strokeWidth="4" fill="none" strokeLinecap="round" />
           </g>
       )}

       {/* --- STANDARD COLLAR (Not in Aviator) --- */}
       {variant !== 'aviator' && (
           <>
            <path d="M60 110 Q 95 130 130 110" stroke="#2D7DD2" strokeWidth="7" fill="none" strokeLinecap="round" />
            <g transform="translate(95, 122)">
                <circle r="7" fill="#FFD700" stroke="#DAA520" strokeWidth="1" />
                <text x="0" y="2.5" fontSize="7" textAnchor="middle" fill="#8B5A2B" fontWeight="900" fontFamily="sans-serif">A</text>
            </g>
            <path d="M70 165 L 70 135 Q 70 125 80 125 L 85 125 L 85 165 A 5 5 0 0 1 70 165" fill="#C27A38" stroke="#8B5A2B" strokeWidth="1" />
            <path d="M105 165 L 105 135 Q 105 125 115 125 L 120 125 L 120 165 A 5 5 0 0 1 105 165" fill="#C27A38" stroke="#8B5A2B" strokeWidth="1" />
            <path d="M75 165 L 75 158 M 80 165 L 80 158" stroke="#8B5A2B" strokeWidth="1" />
            <path d="M110 165 L 110 158 M 115 165 L 115 158" stroke="#8B5A2B" strokeWidth="1" />
           </>
       )}

     </svg>
   </div>
 );
};

export const ApolloDog = EnhancedApolloDogIcon;
