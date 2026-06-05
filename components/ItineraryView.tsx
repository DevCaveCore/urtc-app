

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, FileText, WifiOff, Heart, Cookie, PenLine, Calculator, QrCode, X, ChevronDown, Plane, Hotel, Ticket, Train, Sparkles, AlertCircle, Check, Loader2, Utensils, ShoppingBag, MapPin, Globe, Calendar, Lock, Download, ExternalLink } from 'lucide-react';
import { Note, BudgetItem, Pass, UserTier } from '../types';
import { EnhancedApolloDogIcon } from './ApolloDog';
import { getBudgetPlan, generateAiNote } from '../services/geminiService';
import { getLocationSuggestions } from '../services/mockService';
import { SwipeToDelete } from './SwipeToDelete';

interface PlansViewProps {
 notes: Note[];
 onAddNote: (note: Note) => void;
 onDeleteNote: (id: string) => void;
 passes: Pass[];
 onAddPass: (pass: Pass) => void;
 onDeletePass: (id: string) => void;
 budgetItems: BudgetItem[];
 budgetLimit: number;
 onUpdateLimit: (limit: number) => void;
 userTier: UserTier;
}

interface BudgetCategory {
    id: string;
    type: 'Flight' | 'Hotel' | 'Food' | 'Attraction' | 'Other'; 
    label: string; 
    planned: number;
}

export const ItineraryView: React.FC<PlansViewProps> = ({
   notes, onAddNote, onDeleteNote, passes, onAddPass, onDeletePass, budgetItems, budgetLimit, onUpdateLimit, userTier
}) => {
 const [subTab, setSubTab] = useState<'notes' | 'budget' | 'docs'>('notes');
 
 // Docs Logic
 const [isAddingPass, setIsAddingPass] = useState(false);
 const [newPassProvider, setNewPassProvider] = useState('');
 const [newPassRef, setNewPassRef] = useState('');
 const [newPassDetails, setNewPassDetails] = useState('');
 const [passType, setPassType] = useState<Pass['type']>('Boarding Pass');

 // Budget Logic
 const [categories, setCategories] = useState<BudgetCategory[]>([
    { id: '1', type: 'Flight', label: 'Flights', planned: 1000 },
    { id: '2', type: 'Hotel', label: 'Hotels', planned: 800 },
    { id: '3', type: 'Food', label: 'Food & Dining', planned: 400 },
    { id: '4', type: 'Attraction', label: 'Attractions', planned: 200 },
    { id: '5', type: 'Other', label: 'Shopping & Misc', planned: 100 },
 ]);
 const [tripDays, setTripDays] = useState(5);
 const [tripDest, setTripDest] = useState('');
 const [travelerCount, setTravelerCount] = useState(1);
 const [isGeneratingBudget, setIsGeneratingBudget] = useState(false);
 const [aiProposal, setAiProposal] = useState<BudgetCategory[] | null>(null);

 // Notes Logic
 const [isAddingNote, setIsAddingNote] = useState(false);
 const [noteTripName, setNoteTripName] = useState('');
 const [noteCity, setNoteCity] = useState('');
 const [noteState, setNoteState] = useState('');
 const [noteTitle, setNoteTitle] = useState('');
 const [noteContent, setNoteContent] = useState('');
 const [isAiWriting, setIsAiWriting] = useState(false);

 // Location autocomplete
 const [destSuggestions, setDestSuggestions] = useState<{city:string;state:string;zip:string}[]>([]);
 const [showDestSuggestions, setShowDestSuggestions] = useState(false);
 const [noteCitySuggestions, setNoteCitySuggestions] = useState<{city:string;state:string;zip:string}[]>([]);
 const [showNoteCitySuggestions, setShowNoteCitySuggestions] = useState(false);

 const isPro = userTier === UserTier.Pro || userTier === UserTier.Crew;

 useEffect(() => {
     const savedCategories = localStorage.getItem('urtc_budget_categories');
     if (savedCategories) {
         try { setCategories(JSON.parse(savedCategories)); } catch (e) {}
     }
 }, []);

 useEffect(() => {
     localStorage.setItem('urtc_budget_categories', JSON.stringify(categories));
 }, [categories]);

 useEffect(() => {
     const total = categories.reduce((sum, c) => sum + c.planned, 0);
     if (total !== budgetLimit && !aiProposal) {
         onUpdateLimit(total);
     }
 }, [categories]);

 // Location autocomplete for budget destination
 useEffect(() => {
   if (tripDest.length >= 2) {
     setDestSuggestions(getLocationSuggestions(tripDest));
   } else {
     setDestSuggestions([]);
   }
 }, [tripDest]);

 // Location autocomplete for note city
 useEffect(() => {
   if (noteCity.length >= 2) {
     setNoteCitySuggestions(getLocationSuggestions(noteCity));
   } else {
     setNoteCitySuggestions([]);
   }
 }, [noteCity]);

 const calculateActual = (cat: BudgetCategory) => {
     if (cat.type !== 'Other') {
        return budgetItems.filter(i => i.category === cat.type).reduce((acc, item) => acc + item.cost, 0);
     } else {
        return budgetItems.filter(i => i.category === 'Other').reduce((acc, item) => acc + item.cost, 0);
     }
 };

 const updateCategory = (id: string, field: keyof BudgetCategory, value: any) => {
     setCategories(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
 };

 const addCategory = () => {
    const newCat: BudgetCategory = {
        id: Date.now().toString(),
        type: 'Other',
        label: 'New Category',
        planned: 0
    };
    setCategories([...categories, newCat]);
 };

 const removeCategory = (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
 };

 const handleGenerateBudget = async () => {
    if (!isPro) return; // Locked
    if (!tripDest.trim()) return;
    setIsGeneratingBudget(true);
    const data = await getBudgetPlan(tripDest, tripDays, travelerCount);
    setIsGeneratingBudget(false);
    
    if (data) {
        setAiProposal([
            { id: 'ai-1', type: 'Flight', label: 'Flights', planned: data.flight || 0 },
            { id: 'ai-2', type: 'Hotel', label: 'Hotels', planned: data.hotel || 0 },
            { id: 'ai-3', type: 'Food', label: 'Food & Dining', planned: data.food || 0 },
            { id: 'ai-4', type: 'Attraction', label: 'Attractions', planned: data.attraction || 0 },
            { id: 'ai-5', type: 'Other', label: 'Misc & Shopping', planned: data.other || 0 },
        ]);
    }
 };

 const applyAiProposal = () => {
     if (aiProposal) {
         setCategories(aiProposal);
         setAiProposal(null);
     }
 };

 const handleSavePass = () => {
     if (!newPassProvider.trim()) return;
     onAddPass({
         id: Date.now().toString(),
         type: passType,
         provider: newPassProvider,
         reference: newPassRef || 'N/A',
         details: newPassDetails || '',
         date: new Date().toLocaleDateString()
     });
     setNewPassProvider('');
     setNewPassRef('');
     setNewPassDetails('');
     setIsAddingPass(false);
 };

 const handleSaveNote = () => {
    if(!noteTitle.trim()) return;
    onAddNote({
        id: Date.now().toString(),
        tripName: noteTripName || 'My Trip',
        city: noteCity || 'Unknown',
        stateCountry: noteState || '',
        title: noteTitle,
        content: noteContent || 'No details provided.',
        date: new Date(),
        isAiGenerated: false // Resetting this for user edits essentially
    });
    setNoteTitle('');
    setNoteContent('');
    setNoteCity('');
    setNoteState('');
    setNoteTripName('');
    setIsAddingNote(false);
 };

 const handleAiWrite = async () => {
    if (!isPro) return;
    if (!noteCity.trim()) return;
    setIsAiWriting(true);
    const result = await generateAiNote(noteCity, noteState, noteTripName);
    if (result) {
        setNoteTitle(result.title);
        setNoteContent(result.content);
    }
    setIsAiWriting(false);
 };

 const getCategoryIcon = (type: string) => {
    switch (type) {
        case 'Flight': return <Plane size={14} />;
        case 'Hotel': return <Hotel size={14} />;
        case 'Food': return <Utensils size={14} />;
        case 'Attraction': return <Ticket size={14} />;
        default: return <ShoppingBag size={14} />;
    }
 };

 return (
   <div className="space-y-6 pb-24 animate-in fade-in">
     
     {/* Sub-Navigation Tabs */}
     <div className="flex p-1 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 mb-4 shadow-sm">
        <button onClick={() => setSubTab('notes')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${subTab === 'notes' ? 'bg-white dark:bg-[#151921] text-brand-orange shadow' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}><PenLine size={12}/> Notes</button>
        <button onClick={() => setSubTab('budget')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${subTab === 'budget' ? 'bg-white dark:bg-[#151921] text-brand-orange shadow' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}><Calculator size={12}/> Budget</button>
        <button onClick={() => setSubTab('docs')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${subTab === 'docs' ? 'bg-white dark:bg-[#151921] text-brand-orange shadow' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}><FileText size={12}/> Docs</button>
     </div>

     {/* NOTES TAB CONTENT */}
     {subTab === 'notes' && (
         <div className="space-y-6">
             {/* Header Action */}
             <div className="flex justify-between items-center px-1">
                 <div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white">Trip Notebook</h3>
                    <p className="text-xs text-gray-500">Capture ideas or let Apollo guide you.</p>
                 </div>
                 <button 
                    onClick={() => setIsAddingNote(!isAddingNote)}
                    className="bg-brand-orange text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg shadow-brand-orange/20 hover:bg-orange-600 transition active:scale-95 flex items-center gap-2"
                 >
                    {isAddingNote ? <X size={14} /> : <Plus size={14} />} {isAddingNote ? 'Cancel' : 'New Entry'}
                 </button>
             </div>

             {/* Create Note Form */}
             {isAddingNote && (
                 <div className="bg-white dark:bg-[#151921] p-5 rounded-3xl border border-gray-200 dark:border-white/10 shadow-xl space-y-4 animate-in zoom-in-95 origin-top">
                     <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400 ml-1">Trip Name</label>
                            <input 
                                type="text" 
                                placeholder="e.g. Summer Vacay" 
                                className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white focus:border-brand-orange outline-none"
                                value={noteTripName}
                                onChange={e => setNoteTripName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1 relative">
                            <label className="text-[10px] font-bold uppercase text-gray-400 ml-1">City</label>
                            <input 
                                type="text" 
                                placeholder="e.g. Paris" 
                                className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white focus:border-brand-orange outline-none"
                                value={noteCity}
                                onChange={e => { setNoteCity(e.target.value); setShowNoteCitySuggestions(true); }}
                                onFocus={() => setShowNoteCitySuggestions(true)}
                                onBlur={() => setTimeout(() => setShowNoteCitySuggestions(false), 200)}
                            />
                            {showNoteCitySuggestions && noteCitySuggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#0B0E14] border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl">
                                    {noteCitySuggestions.map((loc, i) => (
                                        <button key={i} onMouseDown={() => { setNoteCity(loc.city); setNoteState(loc.state); setShowNoteCitySuggestions(false); }} className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 border-b border-gray-100 dark:border-white/5 last:border-0 flex items-center gap-2">
                                            <MapPin size={10} className="text-brand-orange shrink-0" />
                                            <span className="font-bold text-gray-900 dark:text-white">{loc.city}</span>
                                            <span className="text-gray-500">{loc.state}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                     </div>
                     <div className="space-y-1">
                         <label className="text-[10px] font-bold uppercase text-gray-400 ml-1">State / Country</label>
                         <input 
                            type="text" 
                            placeholder="e.g. France" 
                            className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white focus:border-brand-orange outline-none"
                            value={noteState}
                            onChange={e => setNoteState(e.target.value)}
                         />
                     </div>

                     <div className="pt-2 border-t border-gray-200 dark:border-white/5">
                        <div className="flex justify-between items-center mb-1">
                             <label className="text-[10px] font-bold uppercase text-gray-400 ml-1">Content</label>
                             {noteCity && (
                                 <button 
                                    onClick={handleAiWrite} 
                                    disabled={isAiWriting || !isPro}
                                    className={`text-[10px] font-bold flex items-center gap-1 hover:underline disabled:opacity-50 ${isPro ? 'text-brand-orange' : 'text-gray-500'}`}
                                 >
                                     {isPro ? (isAiWriting ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />) : <Lock size={10} />} Auto-Write with Apollo
                                 </button>
                             )}
                        </div>
                        <input 
                            type="text" 
                            placeholder="Title (e.g. Top Restaurants)" 
                            className="w-full bg-transparent border-b border-gray-200 dark:border-white/10 p-2 text-sm font-bold text-gray-900 dark:text-white focus:border-brand-orange outline-none mb-2 placeholder-gray-500"
                            value={noteTitle}
                            onChange={e => setNoteTitle(e.target.value)}
                        />
                        <textarea 
                            placeholder="Details, list, or ideas..." 
                            className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-xs text-gray-800 dark:text-gray-300 focus:border-brand-orange outline-none min-h-[100px] resize-none"
                            value={noteContent}
                            onChange={e => setNoteContent(e.target.value)}
                        />
                     </div>

                     <button onClick={handleSaveNote} className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition">
                         Save Entry
                     </button>
                 </div>
             )}

             {/* Notes List */}
             <div className="grid gap-4">
                 {notes.map(note => (
                     <SwipeToDelete key={note.id} onDelete={() => onDeleteNote(note.id)}>
                         <div className="bg-white dark:bg-[#151921] p-0 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden group hover:shadow-md transition-all">
                        {/* Note Header Stripe */}
                        <div className="h-1.5 w-full bg-gradient-to-r from-brand-orange to-brand-blue"></div>
                        
                        <div className="p-5">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">{note.tripName || 'Trip'}</span>
                                        {note.city && (
                                            <span className="flex items-center gap-1 text-[10px] text-gray-500 font-bold uppercase">
                                                <MapPin size={10} /> {note.city}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight">{note.title}</h3>
                                </div>
                                <button onClick={() => onDeleteNote(note.id)} className="text-gray-300 hover:text-red-500 p-1 transition"><Trash2 size={16}/></button>
                            </div>
                            
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                                {note.content}
                            </p>

                            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                                <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1"><Calendar size={10} /> {new Date(note.date).toLocaleDateString()}</span>
                                {note.isAiGenerated && <span className="text-[10px] text-brand-blue font-bold flex items-center gap-1"><Sparkles size={10} /> AI Generated</span>}
                            </div>
                        </div>
                     </div>
                 </SwipeToDelete>
                 ))}
                 
                 {notes.length === 0 && !isAddingNote && (
                     <div className="text-center py-12 opacity-50">
                         <FileText className="mx-auto mb-2 text-gray-500" size={32} />
                         <p className="text-xs font-bold text-gray-500">Your notebook is empty</p>
                     </div>
                 )}
             </div>
         </div>
     )}

     {/* BUDGET PLAN TAB CONTENT */}
     {subTab === 'budget' && (
         <div className="space-y-5">
             <div className="text-center pb-2">
                 <h2 className="text-lg font-bold text-gray-900 dark:text-white">Trip Financials</h2>
                 <p className="text-xs text-gray-500">Plan and track your expenses</p>
             </div>

             {/* AI Smart Plan Section */}
             <div className="bg-gradient-to-br from-indigo-900 to-[#151921] p-5 rounded-2xl border border-indigo-500/30 relative overflow-hidden shadow-lg">
                <div className="absolute top-0 right-0 p-3 opacity-10 text-white"><Sparkles size={100} /></div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="text-brand-orange" size={16} />
                        <h3 className="text-white font-bold text-sm uppercase tracking-wide">AI Smart Plan {(!isPro) && "(Pro)"}</h3>
                    </div>

                    {!aiProposal ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="relative">
                                <input 
                                    type="text" 
                                    placeholder="City, state, or zip..." 
                                    className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-brand-orange outline-none disabled:opacity-50"
                                    value={tripDest}
                                    onChange={e => { setTripDest(e.target.value); setShowDestSuggestions(true); }}
                                    onFocus={() => setShowDestSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowDestSuggestions(false), 200)}
                                    disabled={!isPro}
                                />
                                {showDestSuggestions && destSuggestions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#0B0E14] border border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl">
                                        {destSuggestions.map((loc, i) => (
                                            <button key={i} onMouseDown={() => { setTripDest(`${loc.city}, ${loc.state}`); setShowDestSuggestions(false); }} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/10 border-b border-white/5 last:border-0 flex items-center gap-2">
                                                <MapPin size={10} className="text-brand-orange shrink-0" />
                                                <span className="font-bold text-white">{loc.city}</span>
                                                <span className="text-gray-500">{loc.state}</span>
                                                <span className="ml-auto text-gray-600 font-mono text-[10px]">{loc.zip}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                </div>
                                <div className="flex gap-2">
                                    <input 
                                        type="number" 
                                        placeholder="Days" 
                                        className="w-1/2 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-brand-orange outline-none disabled:opacity-50"
                                        value={tripDays}
                                        onChange={e => setTripDays(Number(e.target.value))}
                                        disabled={!isPro}
                                    />
                                    <input 
                                        type="number" 
                                        placeholder="ppl" 
                                        className="w-1/2 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-brand-orange outline-none disabled:opacity-50"
                                        value={travelerCount}
                                        onChange={e => setTravelerCount(Number(e.target.value))}
                                        disabled={!isPro}
                                    />
                                </div>
                            </div>
                            <button 
                                onClick={handleGenerateBudget}
                                disabled={isGeneratingBudget || !isPro}
                                className="w-full bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl py-2 text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isGeneratingBudget ? <Loader2 size={14} className="animate-spin" /> : isPro ? "Generate Estimates" : <span className="flex items-center gap-1"><Lock size={10} /> Pro Feature</span>}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3 animate-in fade-in">
                            <div className="bg-black/30 rounded-xl p-3 border border-white/10">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-gray-300 text-xs font-bold">Proposal for {tripDest}</span>
                                    <span className="text-brand-orange text-xs font-bold">${aiProposal.reduce((a,b)=>a+b.planned,0)}</span>
                                </div>
                                <div className="space-y-1">
                                    {aiProposal.map(p => (
                                        <div key={p.id} className="flex justify-between text-[10px] text-gray-400">
                                            <span>{p.label}</span>
                                            <span>${p.planned}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setAiProposal(null)} className="flex-1 py-2 rounded-xl text-xs font-bold text-gray-400 hover:bg-white/5 border border-transparent">Dismiss</button>
                                <button onClick={applyAiProposal} className="flex-1 py-2 bg-brand-orange text-white rounded-xl text-xs font-bold shadow-lg">Apply Plan</button>
                            </div>
                        </div>
                    )}
                </div>
             </div>

             {/* Stats Summary */}
             <div className="grid grid-cols-2 gap-3">
                 <div className="bg-white dark:bg-[#151921] p-3 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm flex flex-col justify-center">
                     <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Total Budget</span>
                     <span className="text-lg font-black text-gray-900 dark:text-white">${budgetLimit}</span>
                 </div>
                 <div className="bg-white dark:bg-[#151921] p-3 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm flex flex-col justify-center">
                     <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Avg Daily Spend</span>
                     <span className="text-lg font-black text-gray-900 dark:text-white">${Math.round(budgetItems.reduce((a,b)=>a+b.cost,0) / Math.max(1, tripDays))}</span>
                 </div>
             </div>

             {/* Editable Categories List */}
             <div className="space-y-3">
                 <div className="flex justify-between items-center px-1">
                     <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Categories</h3>
                     <button onClick={addCategory} className="text-brand-orange text-xs font-bold flex items-center gap-1 hover:underline"><Plus size={12}/> Add Custom</button>
                 </div>

                 {categories.map((cat) => {
                     const actual = calculateActual(cat);
                     const percentage = Math.min((actual / (cat.planned || 1)) * 100, 100);
                     const isOver = actual > cat.planned;

                     return (
                         <SwipeToDelete key={cat.id} onDelete={() => removeCategory(cat.id)}>
                             <div className="bg-white dark:bg-[#151921] p-3 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm space-y-2 group">
                             <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-gray-300">
                                     {getCategoryIcon(cat.type)}
                                 </div>
                                 <div className="flex-1">
                                     <input 
                                         type="text" 
                                         value={cat.label} 
                                         onChange={(e) => updateCategory(cat.id, 'label', e.target.value)}
                                         className="w-full bg-transparent text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-b focus:border-brand-orange"
                                     />
                                 </div>
                                 <button onClick={() => removeCategory(cat.id)} className="opacity-0 group-hover:opacity-100 p-2 text-gray-300 hover:text-red-500 transition"><Trash2 size={14}/></button>
                             </div>

                             <div className="flex justify-between items-center text-xs">
                                 <div className="flex items-center gap-1">
                                     <span className="text-gray-400">Target: $</span>
                                     <input 
                                         type="number" 
                                         value={cat.planned} 
                                         onChange={(e) => updateCategory(cat.id, 'planned', Number(e.target.value))}
                                         className="w-16 bg-transparent text-gray-700 dark:text-gray-300 font-mono focus:border-b focus:border-brand-orange outline-none"
                                     />
                                 </div>
                                 <div className={`font-mono font-bold ${isOver ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                                     Actual: ${actual}
                                 </div>
                             </div>

                             {/* Progress */}
                             <div className="w-full h-1.5 bg-gray-100 dark:bg-black/30 rounded-full overflow-hidden">
                                 <div 
                                    className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-red-500' : 'bg-brand-orange'}`} 
                                    style={{ width: `${percentage}%` }}
                                 ></div>
                             </div>
                         </SwipeToDelete>
                     );
                 })}
             </div>
         </div>
     )}

     {/* DOCS TAB CONTENT */}
     {subTab === 'docs' && (
         <div className="space-y-4">
            <div className="bg-[#0F141C] p-6 rounded-3xl border border-white/10 shadow-xl flex justify-between items-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-brand-blue/5 group-hover:bg-brand-blue/10 transition-colors"></div>
                <div className="relative z-10">
                     <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 bg-brand-blue/20 rounded-xl text-brand-blue border border-brand-blue/30"><WifiOff size={18} /></div>
                        <h3 className="text-white font-bold text-xl tracking-tight">Digital Wallet</h3>
                     </div>
                    <p className="text-gray-400 text-xs font-medium pl-1">Items here are available offline</p>
                </div>
                <button 
                    onClick={() => setIsAddingPass(!isAddingPass)} 
                    className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 ${isAddingPass ? 'bg-gray-700 rotate-45' : 'bg-brand-blue hover:bg-blue-600 active:scale-95'}`}
                >
                    <Plus size={24} strokeWidth={2.5} />
                </button>
            </div>

            {isAddingPass && (
                 <div className="bg-[#0B0E14] border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl animate-in zoom-in-95">
                     <div className="flex justify-between items-center pb-2 border-b border-white/5">
                        <h4 className="text-white font-bold text-lg">Add New Pass</h4>
                        <button onClick={() => setIsAddingPass(false)} className="text-gray-500 hover:text-white"><X size={18}/></button>
                     </div>
                     
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">Type</label>
                            <div className="relative">
                                <select 
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm outline-none appearance-none focus:border-brand-blue transition-colors"
                                    value={passType} 
                                    onChange={e => setPassType(e.target.value as any)}
                                >
                                    <option>Boarding Pass</option>
                                    <option>Hotel</option>
                                    <option>Event</option>
                                    <option>Train</option>
                                    <option>Other</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-3.5 text-gray-500 pointer-events-none" size={14} />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">Provider</label>
                            <input 
                                type="text" 
                                placeholder="Delta, Hilton..." 
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-brand-blue transition-colors placeholder-gray-600" 
                                value={newPassProvider} 
                                onChange={e => setNewPassProvider(e.target.value)} 
                            />
                        </div>
                     </div>

                     <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">Reference #</label>
                        <input 
                            type="text" 
                            placeholder="Confirmation Code" 
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-brand-blue transition-colors placeholder-gray-600 font-mono tracking-wide" 
                            value={newPassRef} 
                            onChange={e => setNewPassRef(e.target.value)} 
                        />
                     </div>

                     <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">Details</label>
                        <textarea 
                            placeholder="Seat 4A, Terminal 2..." 
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-brand-blue transition-colors placeholder-gray-600 min-h-[80px] resize-none" 
                            value={newPassDetails} 
                            onChange={e => setNewPassDetails(e.target.value)} 
                        />
                     </div>

                     <div className="flex gap-3 pt-2">
                        <button onClick={() => setIsAddingPass(false)} className="flex-1 py-3 text-gray-400 hover:text-white text-sm font-bold transition-colors">Cancel</button>
                        <button onClick={handleSavePass} className="flex-[2] py-3 bg-brand-blue hover:bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-blue/20 transition-all active:scale-95">Save Pass</button>
                     </div>
                 </div>
            )}

            {passes.length === 0 && !isAddingPass ? (
                <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-gray-200 dark:border-white/5 rounded-3xl bg-white/5">
                    <div className="bg-white/5 p-4 rounded-full mb-4 border border-white/5"><QrCode size={32} className="text-gray-400"/></div>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">No passes saved yet</p>
                    <button onClick={() => setIsAddingPass(true)} className="mt-4 text-brand-blue text-sm font-bold hover:underline">Add your first pass</button>
                </div>
            ) : (
                <div className="grid gap-3">
                    {passes.map(pass => (
                        <SwipeToDelete key={pass.id} onDelete={() => onDeletePass(pass.id)}>
                            <div className="bg-white dark:bg-[#151921] rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden group hover:border-brand-blue/30 transition-all shadow-sm">
                            <div className="p-4 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border border-white/5 ${
                                        pass.type === 'Boarding Pass' ? 'bg-orange-500/10 text-orange-500' :
                                        pass.type === 'Hotel' ? 'bg-purple-500/10 text-purple-500' :
                                        'bg-blue-500/10 text-blue-500'
                                    }`}>
                                        {pass.type === 'Boarding Pass' ? <Plane size={20} /> : 
                                         pass.type === 'Hotel' ? <Hotel size={20} /> : 
                                         pass.type === 'Train' ? <Train size={20} /> : <Ticket size={20} />}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-white text-sm">{pass.provider}</h4>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                            <span className="font-mono bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300">{pass.reference}</span>
                                            <span>•</span>
                                            <span>{pass.type}</span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => onDeletePass(pass.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-full transition"><Trash2 size={16}/></button>
                            </div>
                            {/* QR Code */}
                            {pass.reference && pass.reference !== 'N/A' && (
                                <div className="px-4 pb-4">
                                    <div className="bg-white rounded-xl p-4 flex flex-col items-center border border-gray-200 dark:border-white/10">
                                        <img 
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${pass.type}: ${pass.provider} | Ref: ${pass.reference} | ${pass.details}`)}&bgcolor=FFFFFF&color=000000`}
                                            alt={`QR Code for ${pass.provider}`}
                                            className="w-36 h-36 mb-2"
                                        />
                                        <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">{pass.reference}</p>
                                        {pass.details && <p className="text-[10px] text-gray-400 mt-1 text-center">{pass.details}</p>}
                                    </div>
                                </div>
                            )}
                        </div>
                        </SwipeToDelete>
                    ))}
                </div>
            )}
         </div>
     )}

   </div>
 );
};