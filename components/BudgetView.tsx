
import React, { useState, useEffect } from 'react';
import { Wallet, Trash2, PieChart, TrendingUp, AlertCircle, Plane, Bed, Utensils, Ticket, Calendar, Calculator } from 'lucide-react';
import { BudgetItem } from '../types';

interface BudgetViewProps {
 items: BudgetItem[];
 onRemoveItem: (id: string) => void;
 budgetLimit: number;
 onUpdateLimit: (limit: number) => void;
}

export const BudgetView: React.FC<BudgetViewProps> = ({ items, onRemoveItem, budgetLimit, onUpdateLimit }) => {
 const [animate, setAnimate] = useState(false);
 const [tripDays, setTripDays] = useState(5); // Default trip length in days for calculation
 const [enforceBudget, setEnforceBudget] = useState(false);

 useEffect(() => {
   setAnimate(true);
 }, []);

 const totalSpent = items.reduce((sum, item) => sum + item.cost, 0);
 const remaining = budgetLimit - totalSpent;
 const percentage = Math.min((totalSpent / budgetLimit) * 100, 100);
 
 // Daily Allowance Logic
 const dailyAllowance = remaining > 0 ? remaining / tripDays : 0;

 const getCategoryIcon = (cat: string) => {
     switch(cat) {
         case 'Flight': return <Plane size={14} />;
         case 'Hotel': return <Bed size={14} />;
         case 'Food': return <Utensils size={14} />;
         case 'Attraction': return <Ticket size={14} />;
         default: return <Wallet size={14} />;
     }
 };

 return (
   <div className="space-y-6 pb-24 animate-in fade-in">
     {/* Trip Budget Dashboard Card */}
     <div className="bg-white dark:bg-[#151921] p-6 rounded-[32px] border border-gray-200 dark:border-white/5 shadow-xl relative overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-orange/5 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="flex justify-between items-start mb-6">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-orange/10 rounded-xl text-brand-orange">
                <Wallet size={24} /> 
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Trip Budget</h2>
           </div>
           <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-400 uppercase tracking-wide font-bold">Goal</span>
              <div className="flex items-center gap-1 text-lg font-mono text-gray-900 dark:text-white">
                $<input
                   type="number"
                   value={budgetLimit}
                   onChange={(e) => onUpdateLimit(Math.max(0, Number(e.target.value)))}
                   className="bg-transparent w-20 text-right focus:outline-none border-b border-transparent hover:border-brand-orange focus:border-brand-orange transition-colors"
                 />
              </div>
           </div>
        </div>

        <div className="flex flex-col items-center justify-center mb-8 relative">
            {/* Donut Chart */}
            <div className="w-56 h-56 rounded-full flex items-center justify-center relative shadow-2xl transition-all duration-1000 ease-out" 
                 style={{ 
                    background: `conic-gradient(${percentage > 100 ? '#EF4444' : '#FF6B35'} ${animate ? percentage * 3.6 : 0}deg, rgba(128,128,128,0.1) 0deg)` 
                 }}>
                 <div className="w-48 h-48 bg-white dark:bg-[#151921] rounded-full flex flex-col items-center justify-center z-10 shadow-inner">
                     <span className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter">${totalSpent}</span>
                     <span className="text-xs text-gray-500 uppercase tracking-widest font-bold mt-1">Spent</span>
                 </div>
            </div>
             <div className={`mt-6 text-sm font-bold px-4 py-1.5 rounded-full ${remaining < 0 ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' : 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400'}`}>
                 {remaining < 0 ? `-$${Math.abs(remaining)} Over Budget` : `Surplus: +$${remaining}`}
             </div>
             
             {/* Enforce Budget Toggle */}
             <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 font-bold bg-white/50 dark:bg-white/5 px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/10">
                 <input 
                     type="checkbox" 
                     id="enforceBudget" 
                     checked={enforceBudget} 
                     onChange={(e) => setEnforceBudget(e.target.checked)}
                     className="accent-brand-orange w-4 h-4 rounded cursor-pointer"
                 />
                 <label htmlFor="enforceBudget" className="cursor-pointer">Enforce Allocated Budget</label>
             </div>
        </div>

        {/* Daily Allowance Insight */}
        {remaining > 0 && (
             <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/5 flex justify-between items-center">
                 <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-bold">
                    <Calendar size={14} />
                    <span>Based on <input type="number" value={tripDays} onChange={(e) => setTripDays(Math.max(1, Number(e.target.value)))} className="w-8 bg-gray-100 dark:bg-white/5 rounded px-1 text-center text-gray-900 dark:text-white" /> days left</span>
                 </div>
                 <div className="text-right">
                     <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Daily Allowance</div>
                     <div className="text-brand-orange font-bold font-mono">${Math.round(dailyAllowance)} / day</div>
                 </div>
             </div>
        )}
     </div>

     {/* Stats Row */}
     <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#151921] p-4 rounded-2xl border border-gray-200 dark:border-white/5 flex flex-col items-center justify-center shadow-sm hover:shadow-md transition-shadow">
           <div className="mb-2 p-2 bg-blue-100 dark:bg-blue-500/10 rounded-full text-brand-blue">
             <PieChart size={20} />
           </div>
           <span className="text-3xl font-bold text-gray-900 dark:text-white">{items.length}</span>
           <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">Items Saved</span>
        </div>
        <div className="bg-white dark:bg-[#151921] p-4 rounded-2xl border border-gray-200 dark:border-white/5 flex flex-col items-center justify-center shadow-sm hover:shadow-md transition-shadow">
           <div className="mb-2 p-2 bg-green-100 dark:bg-green-500/10 rounded-full text-green-500">
             <TrendingUp size={20} />
           </div>
           <span className="text-3xl font-bold text-gray-900 dark:text-white">${items.length ? Math.round(totalSpent / items.length) : 0}</span>
           <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">Avg Cost</span>
        </div>
     </div>

     {/* Expenses List */}
     <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Expenses</h3>
            {items.length > 0 && <span className="text-xs text-brand-orange font-bold">{items.length} Transactions</span>}
        </div>
        
        {items.length === 0 ? (
           <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl bg-gray-50 dark:bg-white/5">
              <AlertCircle className="mx-auto mb-3 opacity-50" size={32} />
              <p className="text-sm font-medium text-gray-900 dark:text-white">No items tracked yet.</p>
              <p className="text-xs mt-1">Add flights or places to start budgeting.</p>
           </div>
        ) : (
           <div className="space-y-2">
               {items.map((item) => (
               <div key={item.id} className="flex items-center justify-between bg-white dark:bg-[#151921] p-4 rounded-2xl border border-gray-200 dark:border-white/5 hover:border-brand-orange/50 transition group shadow-sm">
                   <div className="flex items-center gap-4 min-w-0">
                       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                           item.category === 'Flight' ? 'bg-orange-100 text-brand-orange dark:bg-brand-orange/20' : 
                           item.category === 'Hotel' ? 'bg-purple-100 text-purple-500 dark:bg-purple-500/20' :
                           item.category === 'Food' ? 'bg-green-100 text-green-500 dark:bg-green-500/20' :
                           'bg-blue-100 text-brand-blue dark:bg-brand-blue/20'
                       }`}>
                           {getCategoryIcon(item.category)}
                       </div>
                       <div className="min-w-0">
                           <div className="font-bold text-gray-900 dark:text-white text-sm truncate">{item.name}</div>
                           <div className="text-xs text-gray-500 font-medium">{item.category}</div>
                       </div>
                   </div>
                   <div className="flex items-center gap-3 shrink-0">
                       <span className="font-mono font-bold text-gray-900 dark:text-white text-lg">${item.cost}</span>
                       <button onClick={() => onRemoveItem(item.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition shrink-0">
                           <Trash2 size={16}/>
                       </button>
                   </div>
               </div>
               ))}
           </div>
        )}
     </div>
   </div>
 );
};
