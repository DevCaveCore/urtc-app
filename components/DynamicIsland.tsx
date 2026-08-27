import React, { useState } from 'react';
import { Plane, X } from 'lucide-react';
import { Flight } from '../types';

interface DynamicIslandProps {
 activity: Flight;
 alertMessage?: string;
 onClose: () => void;
}

export const DynamicIsland: React.FC<DynamicIslandProps> = ({ activity, alertMessage, onClose }) => {
 const [expanded, setExpanded] = useState(false);
 
 React.useEffect(() => {
     if (alertMessage) {
         setExpanded(true);
         const timer = setTimeout(() => setExpanded(false), 5000);
         return () => clearTimeout(timer);
     }
 }, [alertMessage]);

 if (!activity) return null;

 return (
   <div
     className={`fixed left-1/2 -translate-x-1/2 z-[70] transition-all duration-300 ease-spring ${expanded ? 'top-2 w-[92%] max-w-sm h-40 rounded-[32px]' : 'top-2 w-32 h-8 rounded-full'} bg-black text-white flex flex-col overflow-hidden shadow-2xl cursor-pointer border border-white/10`}
     onClick={() => setExpanded(!expanded)}
     onMouseLeave={() => { if (!alertMessage) setExpanded(false); }}
   >
       <div className={`flex items-center justify-between px-3 h-8 w-full ${expanded ? 'opacity-0 h-0' : 'opacity-100'}`}>
           <div className="w-4 h-4 relative"><Plane size={12} className="text-brand-orange" /></div>
           <div className="flex gap-1"><div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"/><div className="w-1 h-1 bg-green-500 rounded-full animate-pulse delay-75"/></div>
       </div>

       <div className={`p-4 flex flex-col justify-between h-full transition-opacity duration-300 ${expanded ? 'opacity-100' : 'opacity-0 hidden'}`}>
            <div className="flex justify-between items-start">
                <div className="flex gap-3">
                    <div className="bg-white/10 p-2 rounded-xl"><Plane size={20} className="text-brand-orange" /></div>
                    <div>
                        <h4 className="font-bold text-sm">{activity.airline} {activity.flightNumber}</h4>
                        <p className="text-xs text-gray-400">To {activity.arrivalAirport} • {activity.gate ? `Gate ${activity.gate}` : 'Gate TBD'}</p>
                        {/* The island could never be dismissed — onClose existed but was unwired */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
                            className="mt-1.5 text-[10px] font-bold text-white/40 hover:text-white flex items-center gap-1 transition"
                        >
                            <X size={10} /> Stop tracking
                        </button>
                    </div>
                </div>
                <div className="text-right">
                    <div className={`font-mono font-bold ${activity.delayMinutes && activity.delayMinutes > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {activity.delayMinutes && activity.delayMinutes > 0 ? `Delayed ${activity.delayMinutes}m` : activity.status}
                    </div>
                    {alertMessage && <div className="text-[10px] text-brand-orange mt-1 font-bold animate-pulse">{alertMessage}</div>}
                </div>
            </div>
            <div className="relative w-full h-1.5 bg-white/20 rounded-full mt-2">
                <div className="absolute top-0 left-0 h-full bg-brand-orange rounded-full transition-all duration-1000" style={{ width: `${activity.progress}%` }}></div>
            </div>
       </div>
   </div>
 );
};
