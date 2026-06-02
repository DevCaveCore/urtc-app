import React, { useState } from 'react';
import { Search, Clock, ShieldCheck } from 'lucide-react';

const AIRPORTS = [
  { code: 'ATL', name: 'Atlanta', wait: 42, precheck: true },
  { code: 'LAX', name: 'Los Angeles', wait: 14, precheck: true },
  { code: 'JFK', name: 'New York', wait: 10, precheck: true },
  { code: 'ORD', name: 'Chicago', wait: 8, precheck: true },
];

export const TsaView: React.FC = () => {
  const [search, setSearch] = useState('');
  const filtered = AIRPORTS.filter(a => a.code.includes(search.toUpperCase()) || a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 pb-24">
      <h2 className="text-2xl font-bold text-brand-orange">TSA Wait Times</h2>
      <div className="bg-brand-surface p-2 rounded-xl border border-white/10 flex items-center gap-2">
        <Search className="text-gray-500 ml-2" size={20} />
        <input className="bg-transparent w-full text-white p-2 outline-none" placeholder="Search airport..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="space-y-4">
        {filtered.map(a => (
          <div key={a.code} className="bg-brand-surface p-4 rounded-2xl border border-white/10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-2xl font-black text-white">{a.code} <span className="text-sm font-normal text-gray-400">{a.name}</span></h3>
                <div className="text-xs text-gray-500 uppercase tracking-wider">General Boarding</div>
              </div>
              {a.precheck && <div className="bg-blue-900/50 text-blue-400 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 border border-blue-500/30"><ShieldCheck size={12}/> PreCheck</div>}
            </div>
            <div className="relative pt-2">
               <div className="flex justify-between items-end">
                  <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                     <div className={`h-full rounded-full ${a.wait < 15 ? 'bg-green-500' : a.wait < 30 ? 'bg-orange-500' : 'bg-red-500'}`} style={{width: `${Math.min(a.wait * 2, 100)}%`}}></div>
                  </div>
                  <div className={`ml-4 font-mono text-xl font-bold ${a.wait < 15 ? 'text-green-500' : a.wait < 30 ? 'text-orange-500' : 'text-red-500'}`}>
                    <Clock size={16} className="inline mr-1"/>{a.wait} min
                  </div>
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
