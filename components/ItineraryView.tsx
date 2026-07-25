import React, { useState, useEffect } from 'react';
import { hasDiamondAccess } from '../services/authService';
import { hotelSearchUrl, activitiesUrl } from '../services/affiliateService';
import { Plus, Trash2, FileText, WifiOff, Heart, Cookie, PenLine, Calculator, QrCode, X, ChevronDown, Plane, Hotel, Ticket, Train, Sparkles, AlertCircle, Check, Loader2, Utensils, ShoppingBag, MapPin, Globe, Calendar, Lock, Download, ExternalLink, Share, Wine, ChevronLeft, CalendarPlus, FileOutput, Archive, RotateCcw } from 'lucide-react';
import { Note, BudgetCategory, Pass, UserTier, Trip, TripFlight, UserAccount } from '../types';
import { fetchTrips, createTrip, updateTrip, deleteTrip, addFlightToTrip, deleteFlightFromTrip } from '../services/tripService';
import { getBudgetPlan, generateAiNote, generateTripStory, generateBudgetInsight } from '../services/geminiService';
import { getLocationSuggestions } from '../services/mockService';
import { SwipeToDelete } from './SwipeToDelete';

const PlansTutorialWidget = () => {
    const [step, setStep] = useState(0);
    const [isVisible, setIsVisible] = useState(true);

    if (!isVisible) return null;

    const steps = [
        {
            icon: <CalendarPlus size={20} className="text-brand-orange" />,
            title: "Create & Manage",
            desc: "Tap the + button to create a new trip. Manage all your active and archived itineraries right here from the dashboard."
        },
        {
            icon: <PenLine size={20} className="text-brand-orange" />,
            title: "Build Your Itinerary",
            desc: "Open a trip to add flights, hotel reservations, links, and custom notes. Let Apollo generate a day-by-day plan for you."
        },
        {
            icon: <Globe size={20} className="text-brand-blue" />,
            title: "Sync Travel",
            desc: "Collaborate with friends on your itineraries in real-time. Coming soon in a future update!"
        }
    ];

    return (
        <div className="bg-white dark:bg-[#151921] border border-gray-200 dark:border-white/10 rounded-3xl p-5 mb-2 relative overflow-hidden shadow-lg animate-in fade-in">
            <button onClick={() => setIsVisible(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 dark:text-gray-500 dark:hover:text-white transition">
                <X size={16} />
            </button>
            <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center shrink-0">
                    {steps[step].icon}
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-gray-900 dark:text-white text-base mb-1">{steps[step].title}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed mb-4">{steps[step].desc}</p>
                    <div className="flex items-center justify-between">
                        <div className="flex gap-1.5">
                            {steps.map((_, i) => (
                                <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-4 bg-brand-orange' : 'w-1.5 bg-gray-200 dark:bg-white/10'}`} />
                            ))}
                        </div>
                        <button 
                            onClick={() => {
                                if (step < steps.length - 1) setStep(step + 1);
                                else setIsVisible(false);
                            }}
                            className="text-brand-orange font-bold text-xs uppercase tracking-wider"
                        >
                            {step < steps.length - 1 ? 'Next' : 'Got it'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface PlansViewProps {
  user: UserAccount;
  onAskApollo?: () => void;
}

// Rotating gradient palette so every trip card feels distinct
const TRIP_GRADIENTS = [
  'from-orange-500/25 via-red-500/10 to-transparent',
  'from-blue-500/25 via-indigo-500/10 to-transparent',
  'from-emerald-500/25 via-teal-500/10 to-transparent',
  'from-purple-500/25 via-fuchsia-500/10 to-transparent',
  'from-amber-500/25 via-yellow-500/10 to-transparent',
];

// Human countdown for a trip based on its earliest flight (or start_date)
const tripTiming = (trip: Trip): { label: string; cls: string } => {
  const deps = (trip.flights || [])
    .map((f: any) => new Date(f.flight_date || f.departure_time || 0).getTime())
    .filter((t: number) => t > 0 && !Number.isNaN(t));
  // Real flight dates are the truth; start_date is only a fallback
  const start = deps.length ? Math.min(...deps) : (trip.start_date ? new Date(trip.start_date).getTime() : 0);
  if (!start) return { label: '✈ Dates TBD', cls: 'bg-white/10 text-white/60 border-white/15' };
  const days = Math.ceil((start - Date.now()) / 86400000);
  if (days > 1) return { label: `🛫 In ${days} days`, cls: 'bg-brand-orange/20 text-brand-orange border-brand-orange/30' };
  if (days === 1) return { label: '🛫 Tomorrow!', cls: 'bg-brand-orange/20 text-brand-orange border-brand-orange/30 animate-pulse' };
  if (days >= -2) return { label: '🌍 Happening now', cls: 'bg-green-500/20 text-green-400 border-green-500/30' };
  return { label: '📁 Past trip', cls: 'bg-white/10 text-white/40 border-white/10' };
};

export const ItineraryView: React.FC<PlansViewProps> = React.memo(({ user, onAskApollo }) => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  
  // Create Trip State
  const [isCreating, setIsCreating] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [tripFilter, setTripFilter] = useState<'active' | 'archived'>('active');

  const isPro = hasDiamondAccess(user);

  useEffect(() => {
    loadTrips();
    // Apollo can create/edit trips from the chat — refresh when he does
    const onTripsChanged = () => loadTrips();
    window.addEventListener('urtc-trips-changed', onTripsChanged);
    return () => window.removeEventListener('urtc-trips-changed', onTripsChanged);
  }, [user.id]);

  const loadTrips = async () => {
    setIsLoading(true);
    const data = await fetchTrips(user.id);
    setTrips(data);
    if (selectedTrip) {
        const updated = data.find(t => t.id === selectedTrip.id);
        if (updated) setSelectedTrip(updated);
    }
    setIsLoading(false);
  };

  const handleCreateTrip = async () => {
    if (!newTripName.trim()) return;
    setIsLoading(true);
    const newTrip = await createTrip(user.id, newTripName);
    if (newTrip) {
        setTrips([newTrip, ...trips]);
        setNewTripName('');
        setIsCreating(false);
    }
    setIsLoading(false);
  };

  const handleDeleteTrip = async (id: string) => {
    await deleteTrip(id);
    setTrips(trips.filter(t => t.id !== id));
    if (selectedTrip?.id === id) setSelectedTrip(null);
  };

  const handleArchiveTrip = async (id: string, archive: boolean) => {
    await updateTrip(id, { archived: archive });
    setTrips(trips.map(t => t.id === id ? { ...t, archived: archive } : t));
  };

  // ----- DASHBOARD VIEW -----
  if (!selectedTrip) {
    const activeTrips = trips.filter(t => !t.archived);
    const archivedTrips = trips.filter(t => t.archived);

    return (
        <div className="space-y-6 pb-24 animate-in fade-in px-2">
            <div id="tour-itinerary-header" className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white">Your Trips</h2>
                    <p className="text-sm text-gray-500">Where to next?</p>
                </div>
                <button 
                    onClick={() => setIsCreating(!isCreating)}
                    className="bg-brand-orange text-white p-3 rounded-full shadow-lg active:scale-95 transition"
                >
                    {isCreating ? <X size={20} /> : <Plus size={20} />}
                </button>
            </div>

            {isCreating && (
                <div className="bg-white dark:bg-[#151921] p-5 rounded-3xl border border-gray-200 dark:border-white/10 shadow-xl space-y-4 animate-in zoom-in-95">
                    <h3 className="font-bold text-lg dark:text-white">Create New Trip</h3>
                    <input 
                        type="text" 
                        placeholder="Trip Name (e.g. Summer in Tokyo)" 
                        className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:border-brand-orange outline-none"
                        value={newTripName}
                        onChange={e => setNewTripName(e.target.value)}
                    />
                    <button onClick={handleCreateTrip} className="w-full py-3 bg-brand-orange text-white rounded-xl font-bold text-sm shadow-lg shadow-brand-orange/20 active:scale-95 transition">
                        {isLoading ? <Loader2 className="animate-spin mx-auto" /> : "Create Trip"}
                    </button>
                </div>
            )}

            {/* Plans Tab Interactive Tutorial / Sync Announcement */}
            <PlansTutorialWidget />

            {user.id === 'guest' && (
                <div className="bg-brand-orange/20 border border-brand-orange/30 p-2 rounded-xl mb-4 text-center text-xs text-brand-orange font-medium flex items-center justify-center gap-2">
                    <Sparkles size={12} />
                    <span>Login to permanently save your itineraries across devices!</span>
                </div>
            )}

            {isLoading && trips.length === 0 ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand-orange" size={32}/></div>
            ) : trips.length === 0 ? (
                <div className="text-center py-14 bg-white/[0.03] border border-dashed border-white/10 rounded-[28px]">
                    <Globe className="mx-auto mb-4 text-gray-600" size={44} />
                    <p className="text-base font-black text-white/80">No trips yet — where are we going?</p>
                    <p className="text-xs text-gray-500 mt-1 mb-5">Create one with the + button, or let the good boy do the digging.</p>
                    <button
                        onClick={() => {
                            try { localStorage.setItem('urtc_apollo_prefill', 'Help me plan a new trip! Ask me a couple of questions about where I want to go, my budget, and dates — then build me a plan.'); } catch { /* ignore */ }
                            onAskApollo?.();
                        }}
                        className="bg-gradient-to-r from-brand-orange to-red-500 text-white font-bold text-sm px-6 py-3 rounded-2xl shadow-lg shadow-brand-orange/25 hover:scale-[1.03] active:scale-95 transition"
                    >
                        🐾 Ask Apollo to plan one
                    </button>
                </div>
            ) : (
                <>
                    {/* Active / Archived Toggle */}
                    <div className="flex p-1 bg-white/5 rounded-xl border border-white/10 shadow-sm">
                        <button 
                            onClick={() => setTripFilter('active')} 
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${tripFilter === 'active' ? 'bg-[#151921] text-brand-orange shadow' : 'text-gray-400'}`}
                        >
                            <Plane size={12}/> Active ({activeTrips.length})
                        </button>
                        <button 
                            onClick={() => setTripFilter('archived')} 
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${tripFilter === 'archived' ? 'bg-[#151921] text-gray-400 shadow' : 'text-gray-500'}`}
                        >
                            <Archive size={12}/> Archived ({archivedTrips.length})
                        </button>
                    </div>

                    {/* Active Trips */}
                    {tripFilter === 'active' && (
                        activeTrips.length === 0 ? (
                            <div className="text-center py-10 opacity-50">
                                <Plane className="mx-auto mb-3 text-gray-500" size={36} />
                                <p className="text-sm font-bold text-gray-500">No active trips.</p>
                                <p className="text-xs text-gray-600 mt-1">Create a new trip or unarchive an old one.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {activeTrips.map(trip => (
                                    <SwipeToDelete key={trip.id} onDelete={() => handleDeleteTrip(trip.id)}>
                                        {(() => { const timing = tripTiming(trip); const i = activeTrips.indexOf(trip); const spent = (trip.budget_categories || []).reduce((a: number, c: any) => a + (c.planned || 0), 0); return (
                                        <div 
                                            onClick={() => setSelectedTrip(trip)}
                                            className="relative overflow-hidden bg-[#12151b] rounded-[28px] border border-white/10 p-6 cursor-pointer group hover:border-brand-orange/30 active:scale-[0.98] transition"
                                        >
                                            <div className={`absolute inset-0 bg-gradient-to-br ${TRIP_GRADIENTS[i % TRIP_GRADIENTS.length]} pointer-events-none`} />
                                            <div className="relative z-10">
                                                <div className="flex items-start justify-between">
                                                    <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border ${timing.cls}`}>{timing.label}</span>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleArchiveTrip(trip.id, true); }}
                                                        className="p-2 bg-black/20 rounded-full text-white/40 hover:text-brand-orange transition border border-white/10"
                                                        title="Archive trip"
                                                    >
                                                        <Archive size={14} />
                                                    </button>
                                                </div>
                                                <h3 className="font-black text-2xl text-white truncate mt-3 group-hover:text-brand-orange transition-colors">{trip.name}</h3>
                                                <div className="flex items-center gap-2 mt-4 flex-wrap">
                                                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-white/60 bg-black/25 border border-white/10 px-2.5 py-1 rounded-full"><Plane size={11}/> {trip.flights?.length || 0} flights</span>
                                                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-white/60 bg-black/25 border border-white/10 px-2.5 py-1 rounded-full"><MapPin size={11}/> {(trip as any).places?.length || 0} places</span>
                                                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-white/60 bg-black/25 border border-white/10 px-2.5 py-1 rounded-full"><PenLine size={11}/> {trip.notes?.length || 0} notes</span>
                                                    {spent > 0 && <span className="flex items-center gap-1.5 text-[11px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full"><Calculator size={11}/> ${spent.toLocaleString()}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        ); })()}
                                    </SwipeToDelete>
                                ))}
                            </div>
                        )
                    )}

                    {/* Archived Trips */}
                    {tripFilter === 'archived' && (
                        archivedTrips.length === 0 ? (
                            <div className="text-center py-10 opacity-50">
                                <Archive className="mx-auto mb-3 text-gray-500" size={36} />
                                <p className="text-sm font-bold text-gray-500">No archived trips.</p>
                                <p className="text-xs text-gray-600 mt-1">Archive trips you've completed to keep things tidy.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {archivedTrips.map(trip => (
                                    <SwipeToDelete key={trip.id} onDelete={() => handleDeleteTrip(trip.id)}>
                                        <div 
                                            onClick={() => setSelectedTrip(trip)}
                                            className="bg-white/50 dark:bg-[#151921]/60 p-5 rounded-3xl border border-gray-200 dark:border-white/5 shadow-sm flex justify-between items-center cursor-pointer active:scale-95 transition opacity-75 hover:opacity-100"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-xl text-gray-500 dark:text-gray-400 truncate">{trip.name}</h3>
                                                <div className="flex items-center gap-3 text-xs text-gray-400 mt-1 font-mono">
                                                    <span className="flex items-center gap-1"><Plane size={12}/> {trip.flights?.length || 0}</span>
                                                    <span className="flex items-center gap-1"><PenLine size={12}/> {trip.notes?.length || 0}</span>
                                                    <span className="flex items-center gap-1"><Calculator size={12}/> {trip.budget_categories?.length || 0}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 ml-2">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleArchiveTrip(trip.id, false); }}
                                                    className="p-2 bg-brand-orange/10 rounded-full text-brand-orange hover:bg-brand-orange/20 transition border border-brand-orange/20"
                                                    title="Unarchive trip"
                                                >
                                                    <RotateCcw size={14} />
                                                </button>
                                                <ChevronRight />
                                            </div>
                                        </div>
                                    </SwipeToDelete>
                                ))}
                            </div>
                        )
                    )}
                </>
            )}
        </div>
    );
  }

  // ----- TRIP DETAILS VIEW -----
  return <TripDetailsView trip={selectedTrip} onBack={() => setSelectedTrip(null)} onUpdate={loadTrips} isPro={isPro} onAskApollo={onAskApollo} />;
});

const ChevronRight = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="m9 18 6-6-6-6"/></svg>;

// ==========================================
// TRIP DETAILS COMPONENT
// ==========================================
const TripDetailsView = ({ trip, onBack, onUpdate, isPro, onAskApollo }: { trip: Trip, onBack: () => void, onUpdate: () => void, isPro: boolean, onAskApollo?: () => void }) => {
    const [subTab, setSubTab] = useState<'flights' | 'budget' | 'notes' | 'places'>('flights');
    const [isGeneratingStory, setIsGeneratingStory] = useState(false);

    // Notes State
    const [newNoteTitle, setNewNoteTitle] = useState('');
    const [newNoteContent, setNewNoteContent] = useState('');
    const [isGeneratingNote, setIsGeneratingNote] = useState(false);

    // Budget State
    const [newBudgetLabel, setNewBudgetLabel] = useState('');
    const [newBudgetCost, setNewBudgetCost] = useState('');
    const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
    const [budgetInsight, setBudgetInsight] = useState<string | null>(null);

    const handleAddNote = async () => {
        if (!newNoteTitle || !newNoteContent) return;
        const newNote = { id: Date.now().toString(), title: newNoteTitle, content: newNoteContent, date: new Date(), city: '', stateCountry: '', tripName: trip.name };
        const updatedNotes = [newNote, ...(trip.notes || [])];
        await updateTrip(trip.id, { notes: updatedNotes });
        setNewNoteTitle('');
        setNewNoteContent('');
        onUpdate();
    };

    const handleDeleteNote = async (noteId: string) => {
        const updated = (trip.notes || []).filter((n: any) => n.id !== noteId);
        await updateTrip(trip.id, { notes: updated });
        onUpdate();
    };

    const handleDeletePlace = async (idx: number) => {
        const updated = [...(trip.places || [])];
        updated.splice(idx, 1);
        await updateTrip(trip.id, { places: updated });
        onUpdate();
    };

    const handleGenerateAiNote = async () => {
        setIsGeneratingNote(true);
        const generated = await generateAiNote(trip);
        setIsGeneratingNote(false);
        if (generated) {
            setNewNoteTitle(generated.title);
            setNewNoteContent(generated.content);
        }
    };

    const handleAddBudget = async () => {
        if (!newBudgetLabel || !newBudgetCost) return;
        const newItem = { id: Date.now().toString(), type: 'Other', label: newBudgetLabel, planned: Number(newBudgetCost) };
        const updatedBudget = [...(trip.budget_categories || []), newItem as any];
        await updateTrip(trip.id, { budget_categories: updatedBudget });
        setNewBudgetLabel('');
        setNewBudgetCost('');
        onUpdate();
    };

    const handleDeleteBudget = async (budgetId: string) => {
        const updatedBudget = (trip.budget_categories || []).filter((b: any) => b.id !== budgetId);
        await updateTrip(trip.id, { budget_categories: updatedBudget });
        onUpdate();
    };
    
    const totalSpent = (trip.budget_categories || []).reduce((acc: number, curr: any) => acc + (curr.planned || 0), 0);

    const handleGenerateInsight = async () => {
        setIsGeneratingInsight(true);
        const insight = await generateBudgetInsight(trip);
        setBudgetInsight(insight);
        setIsGeneratingInsight(false);
    };

    const handleSaveInsightToNotes = async () => {
        if (!budgetInsight) return;
        const newNote = { 
            id: Date.now().toString(), 
            title: 'Apollo Budget Insight', 
            content: budgetInsight, 
            date: new Date(), 
            city: trip.destination || '', 
            stateCountry: '', 
            tripName: trip.name 
        };
        const updatedNotes = [newNote, ...(trip.notes || [])];
        await updateTrip(trip.id, { notes: updatedNotes });
        setBudgetInsight(null);
        alert('Insight saved to Notes!');
        onUpdate();
    };

    const generateICS = (flight: TripFlight) => {
        // Build basic ICS file
        const icsData = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "BEGIN:VEVENT",
            `SUMMARY:Flight ${flight.flight_number} (${flight.airline || 'Airline'})`,
            `DTSTART;VALUE=DATE:${flight.flight_date.replace(/-/g, '')}`,
            `DESCRIPTION:Departure: ${flight.departure_airport || 'TBD'}\\nArrival: ${flight.arrival_airport || 'TBD'}`,
            "END:VEVENT",
            "END:VCALENDAR"
        ].join('\n');

        const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.setAttribute('download', `Flight_${flight.flight_number}.ics`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleGeneratePdf = async () => {
        setIsGeneratingStory(true);
        const story = await generateTripStory(trip);
        setIsGeneratingStory(false);
        
        if (story) {
            // Very basic PDF print mechanism
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(`
                    <html>
                    <head>
                        <title>${trip.name} Itinerary</title>
                        <style>
                            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; max-width: 800px; margin: 0 auto; }
                            h1 { color: #f97316; font-size: 32px; margin-bottom: 10px; }
                            h2 { color: #1e293b; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 30px; }
                            p { font-size: 14px; }
                            .meta { color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
                        </style>
                    </head>
                    <body>
                        <div class="meta">Apollo AI Trip Summary</div>
                        <h1>${trip.name}</h1>
                        <div style="white-space: pre-wrap;">${story}</div>
                        <script>window.print();</script>
                    </body>
                    </html>
                `);
                printWindow.document.close();
            }
        }
    };

    return (
        <div className="space-y-6 pb-24 animate-in slide-in-from-right-8">
            <div className="flex items-center justify-between px-2">
                <button onClick={onBack} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition"><ChevronLeft size={20}/></button>
                <div className="flex gap-2 flex-wrap justify-end">
                    {isPro && (
                        <>
                        <button onClick={() => alert('Invite sent! Your friends can now edit notes and budgets.')} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-brand-blue/20 text-brand-blue px-3 py-1.5 rounded-full border border-brand-blue/30">
                            <Share size={12} /> Invite Friends
                        </button>
                        <button onClick={handleGeneratePdf} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-brand-orange/20 text-brand-orange px-3 py-1.5 rounded-full border border-brand-orange/30">
                            {isGeneratingStory ? <Loader2 size={12} className="animate-spin" /> : <FileOutput size={12} />} PDF Story
                        </button>
                        </>
                    )}
                </div>
            </div>

            <div className="mx-2 relative overflow-hidden rounded-[28px] border border-white/10 bg-[#12151b] p-6">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-orange/20 via-brand-blue/5 to-transparent pointer-events-none" />
                <div className="relative z-10">
                    {(() => { const timing = tripTiming(trip); return (
                        <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border mb-3 ${timing.cls}`}>{timing.label}</span>
                    ); })()}
                    <h2 className="text-3xl font-black text-white tracking-tight">{trip.name}</h2>
                    <p className="text-xs text-white/40 mt-1.5 font-medium">{trip.flights?.length || 0} flights · {(trip as any).places?.length || 0} places · {trip.notes?.length || 0} notes{trip.destination ? ` · ${trip.destination}` : ''}</p>
                    <button
                        onClick={() => {
                            try { localStorage.setItem('urtc_apollo_prefill', `Build me a day-by-day itinerary for my trip "${trip.name}"${trip.destination ? ` to ${trip.destination}` : ''} — use my saved flights and suggest food, sights, and timing around them.`); } catch { /* ignore */ }
                            onAskApollo?.();
                        }}
                        className="mt-4 inline-flex items-center gap-2 bg-gradient-to-r from-brand-orange to-red-500 text-white text-sm font-bold px-5 py-2.5 rounded-2xl shadow-lg shadow-brand-orange/25 hover:scale-[1.03] active:scale-95 transition"
                    >
                        🐾 Plan this trip with Apollo
                    </button>
                </div>
            </div>

            {/* Sub-Navigation Tabs */}
            <div className="flex bg-white/5 border border-white/10 p-1 rounded-2xl backdrop-blur-xl mb-6 mx-2">
                <button 
                    onClick={() => setSubTab('flights')}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${subTab === 'flights' ? 'bg-white/10 text-brand-orange shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                    <Plane size={16}/> Flights
                </button>
                <button 
                    onClick={() => setSubTab('places')}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${subTab === 'places' ? 'bg-white/10 text-brand-orange shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                    <MapPin size={16}/> Places
                </button>
                <button 
                    onClick={() => setSubTab('budget')}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${subTab === 'budget' ? 'bg-white/10 text-brand-orange shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                    <Calculator size={16}/> Budget
                </button>
                <button 
                    onClick={() => setSubTab('notes')}
                    className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${subTab === 'notes' ? 'bg-white/10 text-brand-orange shadow-lg' : 'text-gray-400 hover:text-white'}`}
                >
                    <PenLine size={16}/> Notes
                </button>
            </div>

            {subTab === 'flights' && (
                <div className="space-y-4 px-2">
                    {(trip.flights?.length || 0) > 0 && (
                        <a
                            href={hotelSearchUrl(trip.destination || trip.flights?.[0]?.arrival_airport || trip.name, trip.flights?.[0]?.flight_date)}
                            target="_blank" rel="noopener noreferrer"
                            className="block bg-gradient-to-r from-brand-blue/15 to-brand-orange/10 border border-brand-blue/25 rounded-2xl p-4 hover:border-brand-blue/50 transition group"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-black text-white">🏨 Where are you staying?</div>
                                    <div className="text-[11px] text-gray-400 mt-0.5">Flights are set — Apollo found stays near your arrival.</div>
                                </div>
                                <span className="text-[10px] font-black text-brand-blue whitespace-nowrap group-hover:underline">BROWSE →</span>
                            </div>
                        </a>
                    )}
                    {trip.flights?.length === 0 ? (
                        <div className="text-center py-12 opacity-50 bg-white/5 rounded-3xl border border-white/5">
                            <Plane className="mx-auto mb-2 text-gray-500" size={32} />
                            <p className="text-xs font-bold text-gray-500">No flights saved to this trip.</p>
                            <p className="text-[10px] text-gray-600 mt-1">Search for flights in the Flights tab and tap "Save to Trip"</p>
                        </div>
                    ) : (
                        trip.flights?.map(f => (
                            <SwipeToDelete key={f.id} onDelete={async () => { await deleteFlightFromTrip(f.id); onUpdate(); }}>
                                <div className="bg-[#151921] p-5 rounded-3xl border border-white/10 shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                                {(() => { const d = new Date(f.flight_date); return isNaN(d.getTime()) ? 'Date TBD' : `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`; })()}
                                            </div>
                                            <h4 className="text-lg font-bold text-white">{f.flight_number?.startsWith(f.airline || '~') ? f.flight_number : `${f.airline || ''} ${f.flight_number}`.trim()}</h4>
                                        </div>
                                        <button onClick={() => generateICS(f)} className="p-2 bg-brand-blue/10 text-brand-blue rounded-full border border-brand-blue/30 active:scale-95 transition" title="Add to Calendar">
                                            <CalendarPlus size={16}/>
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm font-mono text-gray-300 mb-4">
                                        <div>{f.departure_airport || 'TBD'}</div>
                                        <div className="flex-1 h-px bg-white/10"></div>
                                        <div>{f.arrival_airport || 'TBD'}</div>
                                    </div>
                                    <div className="bg-brand-orange/10 border border-brand-orange/20 rounded-lg p-2 flex items-center gap-2">
                                        <Plane size={12} className="text-brand-orange" />
                                        <span className="text-[10px] text-brand-orange font-bold uppercase tracking-wider">{f.status || 'Scheduled'}</span>
                                    </div>
                                </div>
                            </SwipeToDelete>
                        ))
                    )}
                </div>
            )}

            {/* BUDGET TAB */}
            {subTab === 'budget' && (
                <div className="space-y-4 px-2">
                    {(() => {
                        const limit = trip.budget_limit || 0;
                        const pct = limit > 0 ? Math.min(100, (totalSpent / limit) * 100) : 0;
                        const over = limit > 0 && totalSpent > limit;
                        return (
                        <div className="bg-[#12151b] p-6 rounded-[28px] border border-white/10 shadow-sm relative overflow-hidden">
                            <div className={`absolute inset-0 bg-gradient-to-br ${over ? 'from-red-500/15' : 'from-brand-orange/15'} via-transparent to-transparent pointer-events-none`} />
                            <div className="relative z-10">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Planned Spend</p>
                                        <div className="text-4xl font-black text-white font-mono tracking-tight mt-1">${(totalSpent || 0).toLocaleString()}</div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{over ? 'Over By' : 'Remaining'}</p>
                                        <div className={`text-xl font-black font-mono mt-1 ${over ? 'text-red-400' : 'text-green-400'}`}>
                                            ${Math.abs((limit) - totalSpent).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                                {limit > 0 ? (
                                    <div className="mt-4">
                                        <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-700 ${over ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-brand-orange/70 to-brand-orange'}`} style={{ width: `${pct}%` }} />
                                        </div>
                                        <div className="flex justify-between mt-1.5 text-[10px] font-bold text-gray-500">
                                            <span>{Math.round(pct)}% of budget</span>
                                            <span>Limit ${limit.toLocaleString()}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="mt-3 text-[11px] text-gray-500">Set a budget limit below and this becomes a live progress meter.</p>
                                )}
                            </div>
                        </div>
                        );
                    })()}

                    <div className="bg-[#151921] p-5 rounded-3xl border border-white/10 shadow-sm relative overflow-hidden">
                        <h4 className="font-bold text-sm text-white mb-3">Trip Context <span className="text-[10px] text-gray-500 font-medium normal-case">— helps Apollo give sharper insights</span></h4>
                        <div className="grid grid-cols-2 gap-3 mb-4 relative z-10">
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold block mb-1">Destination</label>
                                <input type="text" placeholder="e.g. Tokyo" value={trip.destination || ''} onChange={e => updateTrip(trip.id, { destination: e.target.value }).then(onUpdate)} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-brand-orange outline-none transition" />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold block mb-1">Duration (Days)</label>
                                <input type="number" min="1" value={trip.duration_days || ''} onChange={e => updateTrip(trip.id, { duration_days: Number(e.target.value) }).then(onUpdate)} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-brand-orange outline-none transition" />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold block mb-1">Travelers</label>
                                <input type="number" min="1" value={trip.travelers_count || ''} onChange={e => updateTrip(trip.id, { travelers_count: Number(e.target.value) }).then(onUpdate)} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-brand-orange outline-none transition" />
                            </div>
                            <div>
                                <label className="text-[10px] text-brand-orange uppercase tracking-widest font-bold block mb-1">Budget Limit ($)</label>
                                <input type="number" min="0" placeholder="$0" value={trip.budget_limit || ''} onChange={e => updateTrip(trip.id, { budget_limit: Number(e.target.value) }).then(onUpdate)} className="w-full bg-brand-orange/10 border border-brand-orange/30 rounded-xl px-3 py-2 text-sm text-brand-orange font-bold focus:border-brand-orange outline-none transition" />
                            </div>
                        </div>

                    </div>

                    <div className="bg-[#151921] p-5 rounded-3xl border border-white/10 shadow-sm">
                        <h4 className="font-bold text-sm text-white mb-3">Add Expense</h4>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Label (e.g. Sushi)" 
                                className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                                value={newBudgetLabel}
                                onChange={e => setNewBudgetLabel(e.target.value)}
                            />
                            <input 
                                type="number" 
                                placeholder="$0" 
                                className="w-24 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                                value={newBudgetCost}
                                onChange={e => setNewBudgetCost(e.target.value)}
                            />
                            <button onClick={handleAddBudget} className="bg-brand-orange text-white p-2 rounded-xl font-bold active:scale-95 transition"><Plus size={20}/></button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {(trip.budget_categories || []).map((item: any) => (
                            <SwipeToDelete key={item.id} onDelete={() => handleDeleteBudget(item.id)}>
                                {(() => {
                                    const share = totalSpent > 0 ? Math.round(((item.planned || 0) / totalSpent) * 100) : 0;
                                    const l = (item.label || '').toLowerCase();
                                    const emoji = /flight|air|plane/.test(l) ? '✈️' : /hotel|stay|airbnb|lodg/.test(l) ? '🏨' : /food|eat|dinner|lunch|sushi|restaurant|coffee/.test(l) ? '🍽️' : /car|uber|lyft|train|transit|gas/.test(l) ? '🚕' : /shop|gift|souvenir/.test(l) ? '🛍️' : /ticket|tour|museum|show|park/.test(l) ? '🎟️' : '💵';
                                    return (
                                    <div className="bg-[#14171d] border border-white/5 p-4 rounded-2xl relative overflow-hidden">
                                        <div className="absolute inset-y-0 left-0 bg-brand-orange/[0.07] pointer-events-none" style={{ width: `${share}%` }} />
                                        <div className="relative z-10 flex justify-between items-center">
                                            <span className="font-bold text-sm text-gray-200 flex items-center gap-2.5">
                                                <span className="text-base">{emoji}</span> {item.label}
                                                <span className="text-[9px] font-black text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">{share}%</span>
                                            </span>
                                            <div className="flex items-center gap-3">
                                                <span className="font-mono font-bold text-brand-orange">${(item.planned || 0).toLocaleString()}</span>
                                                <button onClick={() => handleDeleteBudget(item.id)} className="text-gray-600 hover:text-red-400/80 transition z-10">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    );
                                })()}
                            </SwipeToDelete>
                        ))}
                    </div>

                    <div className="mt-6">
                        <button onClick={handleGenerateInsight} disabled={isGeneratingInsight} className="w-full py-3.5 bg-gradient-to-r from-brand-orange to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-2xl font-bold shadow-lg shadow-brand-orange/25 active:scale-95 transition flex items-center justify-center gap-2">
                            {isGeneratingInsight ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                            🐾 Ask Apollo to Sniff This Budget
                        </button>
                        
                        {budgetInsight && (
                            <div className="mt-4 bg-purple-500/10 border border-purple-500/20 p-5 rounded-3xl animate-in fade-in slide-in-from-top-4">
                                <div className="flex items-center gap-2 mb-3 text-purple-400 font-bold">
                                    <Sparkles size={16} /> Apollo's Analysis
                                </div>
                                <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap mb-4">
                                    {budgetInsight}
                                </div>
                                <button onClick={handleSaveInsightToNotes} className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-xs font-bold transition flex justify-center items-center gap-2">
                                    <FileText size={14} /> Save to Notes
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {subTab === 'places' && (trip.destination || trip.name) && (
                <div className="px-2 mb-4">
                    <a
                        href={activitiesUrl(trip.destination || trip.name)}
                        target="_blank" rel="noopener noreferrer"
                        className="block bg-gradient-to-r from-purple-500/15 to-brand-orange/10 border border-purple-500/25 rounded-2xl p-4 hover:border-purple-400/50 transition group"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm font-black text-white">🎟️ Things to do{trip.destination ? ` in ${trip.destination}` : ''}</div>
                                <div className="text-[11px] text-gray-400 mt-0.5">Tours, tickets & experiences — book ahead, skip the lines.</div>
                            </div>
                            <span className="text-[10px] font-black text-purple-300 whitespace-nowrap group-hover:underline">EXPLORE →</span>
                        </div>
                    </a>
                </div>
            )}
            {subTab === 'places' && (
                <div className="space-y-4 px-2">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold dark:text-white text-gray-900">Places To Go</h3>
                    </div>
                    
                    {!trip.places || trip.places.length === 0 ? (
                        <div className="text-center py-12 bg-white/5 rounded-3xl border border-white/10">
                            <MapPin className="mx-auto text-gray-500 mb-3" size={32}/>
                            <p className="text-gray-400 font-bold">No places saved yet.</p>
                            <p className="text-sm text-gray-500 mt-1">Go to the Explore tab and tap "Save to Trip" to add places here.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {trip.places.map((place: any, idx: number) => (
                                <div key={idx} className="flex bg-white dark:bg-[#151921] rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 shadow-sm relative group active:scale-[0.98] transition">
                                    {place.image ? (
                                        <div className="w-24 h-24 shrink-0 bg-gray-200 dark:bg-white/5 relative">
                                            <img src={place.image} alt={place.name} className="w-full h-full object-cover" />
                                        </div>
                                    ) : (
                                        <div className="w-24 h-24 shrink-0 bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                                            <MapPin size={24} className="text-gray-400" />
                                        </div>
                                    )}
                                    
                                    <div className="p-3 flex-1 flex flex-col justify-center min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-gray-900 dark:text-white text-sm truncate pr-2">{place.name}</h4>
                                            <button onClick={() => handleDeletePlace(idx)} className="text-gray-400 hover:text-red-400/80 transition z-10 shrink-0">
                                                <X size={16} />
                                            </button>
                                        </div>
                                        
                                        <div className="flex items-center gap-2 mt-1 mb-1.5">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-orange/10 text-brand-orange uppercase">{place.category}</span>
                                            <span className="text-xs text-gray-500 flex items-center gap-0.5">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-400"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                                                {place.rating}
                                            </span>
                                        </div>
                                        
                                        <p className="text-xs text-gray-500 truncate">{place.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* NOTES TAB */}
            {subTab === 'notes' && (
                <div className="space-y-4 px-2">
                    <div className="bg-[#151921] p-5 rounded-3xl border border-white/10 shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-sm text-white">Quick Note</h4>
                            <div className="flex items-center gap-2">
                                <span className="bg-white/10 text-gray-300 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><Share size={10}/> Shared</span>
                                {isPro && (
                                    <button onClick={handleGenerateAiNote} className="flex items-center gap-1 text-[10px] font-bold text-brand-orange bg-brand-orange/10 px-2 py-1 rounded-lg">
                                        {isGeneratingNote ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} AI Idea
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="space-y-2 mb-3">
                            <input 
                                type="text" 
                                placeholder="Title" 
                                className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-bold"
                                value={newNoteTitle}
                                onChange={e => setNewNoteTitle(e.target.value)}
                            />
                            <textarea 
                                placeholder="Write something..." 
                                className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-300 h-24 resize-none"
                                value={newNoteContent}
                                onChange={e => setNewNoteContent(e.target.value)}
                            />
                        </div>
                        <button onClick={handleAddNote} className="w-full py-3 bg-white/10 hover:bg-brand-orange text-white rounded-xl font-bold text-sm transition">Save Note</button>
                    </div>

                    <div className="space-y-3">
                        {(trip.notes || []).map((note: any) => (
                            <SwipeToDelete key={note.id} onDelete={() => handleDeleteNote(note.id)}>
                                <div className="bg-gradient-to-br from-[#1a1f2b] to-[#151921] border border-white/10 p-5 rounded-3xl relative">
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="font-bold text-white text-lg">{note.title}</h4>
                                        <button onClick={() => handleDeleteNote(note.id)} className="text-gray-500 hover:text-red-400/80 transition">
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <p className="text-sm text-gray-400 whitespace-pre-wrap">{note.content}</p>
                                </div>
                            </SwipeToDelete>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
