
import React, { useState, useEffect, useRef } from 'react';
import { Plane, Clock, AlertTriangle, Loader2, X, ArrowRight, ArrowLeftRight, ExternalLink, MapPin, Calendar, Search, Radar, Globe, CheckCircle, Navigation, Gauge, Hash, LayoutGrid, PlusCircle, Info } from 'lucide-react';
import { Flight, FlightStatus, BudgetItem, UserTier, FlightSchedule, AirportConditions, UserAccount, Trip } from '../types';
import { fetchRealFlights, fetchFlightTrack, fetchSchedules, fetchAirportConditions, fetchRandomFlight } from '../services/apiService';
import { fetchTrips, addFlightToTrip } from '../services/tripService';
import { getAirportSuggestions, getAirportCoords, getAirlineSuggestions } from '../services/mockService';
import { getStatsForNerds } from '../services/authService';

interface FlightViewProps {
    user: UserAccount;
    onViewCity?: (city: string) => void;
    onTrackFlight?: (flight: Flight) => void;
}

declare global {
    interface Window {
        google: any;
    }
}

// Helper: format duration from minutes
const formatDuration = (mins: number | null | undefined): string => {
    if (!mins || mins <= 0) return '--';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
};

// Helper: format time from ISO string
const formatTime = (iso: string | undefined): string => {
    if (!iso) return '--:--';
    try {
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '--:--';
    }
};

// Helper: format date from ISO string
const formatDate = (iso: string | undefined): string => {
    if (!iso) return '--';
    try {
        return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
        return '--';
    }
};

// Skeleton loader component
const FlightSkeleton: React.FC = () => (
    <div className="bg-white dark:bg-brand-surface border border-gray-200 dark:border-white/10 rounded-3xl p-5 animate-pulse">
        <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-white/10" />
                <div>
                    <div className="w-24 h-4 bg-gray-200 dark:bg-white/10 rounded mb-2" />
                    <div className="w-16 h-3 bg-gray-200 dark:bg-white/10 rounded" />
                </div>
            </div>
            <div className="w-20 h-6 bg-gray-200 dark:bg-white/10 rounded-full" />
        </div>
        <div className="flex items-center justify-between mb-4">
            <div className="w-14 h-8 bg-gray-200 dark:bg-white/10 rounded" />
            <div className="flex-1 mx-4 h-[2px] bg-gray-200 dark:bg-white/10 rounded" />
            <div className="w-14 h-8 bg-gray-200 dark:bg-white/10 rounded" />
        </div>
        <div className="flex justify-between">
            <div className="w-20 h-3 bg-gray-200 dark:bg-white/10 rounded" />
            <div className="w-20 h-3 bg-gray-200 dark:bg-white/10 rounded" />
        </div>
    </div>
);

export const FlightView: React.FC<FlightViewProps> = React.memo(({ user, onViewCity, onTrackFlight }) => {
    const [trips, setTrips] = useState<Trip[]>([]);
    const [isSavingToTrip, setIsSavingToTrip] = useState<Flight | null>(null);
    const [isFetchingTrips, setIsFetchingTrips] = useState(false);

    const handleOpenSaveDialog = async (flight: Flight) => {
        if (user.id === 'guest') {
            alert('Please sign in to save flights to your trips.');
            return;
        }
        setIsSavingToTrip(flight);
        setIsFetchingTrips(true);
        const userTrips = await fetchTrips(user.id);
        setTrips(userTrips);
        setIsFetchingTrips(false);
    };

    const handleSaveToTrip = async (tripId: string) => {
        if (!isSavingToTrip) return;
        const success = await addFlightToTrip(
            user.id,
            tripId,
            isSavingToTrip.flightNumber,
            isSavingToTrip.departureTime || '',
            isSavingToTrip.airline,
            isSavingToTrip.departureAirport,
            isSavingToTrip.arrivalAirport
        );
        if (success) {
            setIsSavingToTrip(null);
            alert('Saved successfully!');
        } else {
            alert('Failed to save flight. Please try again.');
        }
    };

    const [flights, setFlights] = useState<Flight[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [originCity, setOriginCity] = useState('');
    const [destCity, setDestCity] = useState('');
    const [debouncedOrigin, setDebouncedOrigin] = useState('');
    const [debouncedDest, setDebouncedDest] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [flightDate, setFlightDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [returnDate, setReturnDate] = useState<string>('');
    const [airlineFilter, setAirlineFilter] = useState('ALL');
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [activeInput, setActiveInput] = useState<'origin' | 'dest' | 'query' | null>(null);
    const [schedules, setSchedules] = useState<FlightSchedule[]>([]);
    const [airportInfo, setAirportInfo] = useState<AirportConditions | null>(null);
    const [viewMode, setViewMode] = useState<'live' | 'schedule'>('live');
    const [searchMode, setSearchMode] = useState<'flight' | 'airport'>('flight');
    const [isStatsNerd, setIsStatsNerd] = useState(false);

    useEffect(() => {
        setIsStatsNerd(getStatsForNerds());
    }, []);

    const [telemetry, setTelemetry] = useState({ alt: 32000, speed: 450, heading: 90 });

    const mapRef = useRef<HTMLDivElement>(null);
    const googleMapRef = useRef<any>(null);
    const flightPathRef = useRef<any>(null);

    // Live Telemetry Simulation
    useEffect(() => {
        if (!selectedFlight) return;
        const interval = setInterval(() => {
            setTelemetry(prev => ({
                alt: Math.min(42000, Math.max(10000, prev.alt + (Math.random() - 0.5) * 100)),
                speed: Math.min(600, Math.max(300, prev.speed + (Math.random() - 0.5) * 10)),
                heading: (prev.heading + (Math.random() - 0.5) * 2) % 360
            }));
        }, 1000);
        return () => clearInterval(interval);
    }, [selectedFlight]);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedOrigin(originCity);
            setDebouncedDest(destCity);
            setDebouncedQuery(searchQuery);
        }, 300);
        return () => clearTimeout(handler);
    }, [originCity, destCity, searchQuery]);

    // Suggestion Logic
    useEffect(() => {
        if (!activeInput) {
            setSuggestions([]);
            return;
        }
        let query = '';
        if (activeInput === 'origin') query = debouncedOrigin;
        else if (activeInput === 'dest') query = debouncedDest;
        else if (activeInput === 'query') query = debouncedQuery;

        if (query.length > 0) {
            if (activeInput === 'query') {
                setSuggestions(getAirlineSuggestions(query));
            } else {
                setSuggestions(getAirportSuggestions(query));
            }
        } else {
            setSuggestions([]);
        }
    }, [debouncedOrigin, debouncedDest, debouncedQuery, activeInput]);

    useEffect(() => {
        if (selectedFlight && mapRef.current && window.google) {
            if (!googleMapRef.current) {
                googleMapRef.current = new window.google.maps.Map(mapRef.current, {
                    center: { lat: 30, lng: -40 },
                    zoom: 3,
                    mapId: "DEMO_MAP_ID",
                    disableDefaultUI: true,
                    styles: [
                        { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                        { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                        { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
                        { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
                    ]
                });
            }
            
            const renderTrack = async () => {
                const origin = getAirportCoords(selectedFlight.departureAirport);
                const dest = getAirportCoords(selectedFlight.arrivalAirport);

                if (flightPathRef.current) flightPathRef.current.setMap(null);
                
                const bounds = new window.google.maps.LatLngBounds();
                bounds.extend(origin);
                bounds.extend(dest);
                
                try {
                    const track = await fetchFlightTrack(selectedFlight.id);
                    let path = [origin, dest];
                    if (track && track.length > 0) {
                        path = track.map(p => {
                           const pos = { lat: p.latitude, lng: p.longitude };
                           bounds.extend(pos);
                           return pos;
                        });
                        // Add origin/dest endpoints just in case
                        path.unshift(origin);
                        path.push(dest);
                    }
                    
                    flightPathRef.current = new window.google.maps.Polyline({
                        path,
                        geodesic: true,
                        strokeColor: '#FF6B35',
                        strokeOpacity: 1.0,
                        strokeWeight: 3,
                        map: googleMapRef.current
                    });
                } catch (e) {
                    flightPathRef.current = new window.google.maps.Polyline({
                        path: [origin, dest],
                        geodesic: true,
                        strokeColor: '#FF6B35',
                        strokeOpacity: 1.0,
                        strokeWeight: 3,
                        map: googleMapRef.current
                    });
                }

                googleMapRef.current.fitBounds(bounds);
            };
            
            renderTrack();
        }
    }, [selectedFlight]);

    const performSearch = async () => {
        setIsLoading(true);
        setSearchError('');
        setHasSearched(true);
        // Track for Apollo proactive tips
        const trackQuery = searchMode === 'flight' ? searchQuery.trim() : `${originCity} → ${destCity}`;
        if (trackQuery) localStorage.setItem('urtc_last_flight_search', trackQuery);
        try {
            if (searchMode === 'flight') {
                // Flight number search
                const query = searchQuery.trim();
                if (!query) {
                    setSearchError('Enter a flight number (e.g., DAL1182, UAL100)');
                    setIsLoading(false);
                    return;
                }
                const results = await fetchRealFlights(query, flightDate, airlineFilter);
                setFlights(results);
                setSchedules([]);
                setAirportInfo(null);
                if (results.length === 0) {
                    setSearchError('No flights found. Try a different flight number or date.');
                }
            } else {
                // Airport search
                const oCode = originCity.split(' - ')[0].trim();
                const dCode = destCity.split(' - ')[0].trim();
                if (!oCode && !dCode) {
                    setSearchError('Enter at least one airport code (e.g., ATL, JFK)');
                    setIsLoading(false);
                    return;
                }
                const query = oCode || dCode;
                const [results, scheds, conds] = await Promise.all([
                    fetchRealFlights(oCode || dCode, flightDate, airlineFilter, oCode ? dCode : undefined),
                    fetchSchedules(oCode, dCode, flightDate, airlineFilter),
                    oCode ? fetchAirportConditions(oCode) : Promise.resolve(null)
                ]);
                setFlights(results);
                setSchedules(scheds);
                if (conds) setAirportInfo(conds);
                else setAirportInfo(null);
                if (results.length === 0 && scheds.length === 0) {
                    setSearchError('No flights found for this route. Try different airports.');
                }
            }
        } catch (err) {
            console.error(err);
            setSearchError('Search failed. Please check your connection and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        performSearch();
    };

    const handleRandomPreview = async () => {
        setIsLoading(true);
        setHasSearched(true);
        setSearchError('');
        const randFlight = await fetchRandomFlight();
        setIsLoading(false);
        if (randFlight) {
            setIsStatsNerd(true);
            setFlights([randFlight]);
            setSchedules([]);
            setViewMode('live');
            setSearchMode('flight');
            setSearchQuery(randFlight.ident || '');
        } else {
            setSearchError('Could not fetch a random flight. Try again.');
        }
    };

    const handleSwapAirports = () => {
        const temp = originCity;
        setOriginCity(destCity);
        setDestCity(temp);
    };

    const applySuggestion = (val: string) => {
        const code = val.split(' - ')[0];
        if (activeInput === 'origin') {
            setOriginCity(code);
            setTimeout(() => {
                const destInput = document.getElementById('destCityInput');
                if (destInput) destInput.focus();
            }, 100);
        } else if (activeInput === 'dest') {
            setDestCity(code);
        } else if (activeInput === 'query') {
            setSearchQuery(code);
            setTimeout(() => {
                const searchInput = document.getElementById('flightSearchInput');
                if (searchInput) searchInput.focus();
            }, 100);
        }
        setSuggestions([]);
        setActiveInput(null);
    };

    const handleBlur = () => {
        setTimeout(() => setActiveInput(null), 200);
    };

    const getStatusColor = (status: FlightStatus) => {
        switch (status) {
            case FlightStatus.OnTime: return 'text-green-400 bg-green-400/10 border-green-400/20';
            case FlightStatus.Delayed: return 'text-orange-400 bg-orange-400/10 border-orange-400/20 animate-pulse';
            case FlightStatus.Cancelled: return 'text-red-400 bg-red-400/10 border-red-400/20';
            case FlightStatus.EnRoute: return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
            default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
        }
    };

    const openGoogleFlights = (f: Flight, e: React.MouseEvent) => {
        e.stopPropagation();
        const query = `Flights from ${f.departureAirport} to ${f.arrivalAirport}`;
        window.open(`https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`, '_blank');
    };

    return (
        <div className="space-y-5 pb-24">
            {/* Search Mode Toggle */}
            <div className="flex gap-2 p-1 bg-gray-100 dark:bg-white/5 rounded-xl">
                <button
                    onClick={() => { setSearchMode('flight'); setSearchError(''); }}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${searchMode === 'flight' ? 'bg-white dark:bg-brand-surface shadow text-brand-orange' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                    <Hash size={14} /> By Flight #
                </button>
                <button
                    onClick={() => { setSearchMode('airport'); setSearchError(''); }}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${searchMode === 'airport' ? 'bg-white dark:bg-brand-surface shadow text-brand-orange' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                    <LayoutGrid size={14} /> By Airport
                </button>
            </div>

            {/* Search Bar */}
            <div id="tour-flight-search" className="bg-white dark:bg-brand-surface/90 backdrop-blur-xl p-4 rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl transition-all duration-300 focus-within:shadow-brand-orange/20 focus-within:border-brand-orange/30">
                {searchMode === 'flight' ? (
                    <>
                        {/* Flight Number Search */}
                        <form onSubmit={(e) => { e.preventDefault(); performSearch(); }} className="flex flex-col gap-3">
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1 relative min-w-[200px]">
                                    <label className="absolute left-4 top-2 text-[10px] font-bold uppercase tracking-wider text-brand-orange">Flight Number</label>
                                    <input
                                        id="flightQueryInput"
                                        type="text"
                                        placeholder="e.g. DAL1182, UAL100, AAL2345"
                                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-3 pl-4 pr-3 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange transition-all font-bold text-base pt-7"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                                        onFocus={() => setActiveInput('query')}
                                        onBlur={handleBlur}
                                        autoComplete="off"
                                    />
                                    {activeInput === 'query' && suggestions.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#151921] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                                            {suggestions.map(s => (
                                                <button key={s} onMouseDown={() => applySuggestion(s)} className="w-full text-left px-4 py-3 text-sm font-bold text-gray-900 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 border-b border-gray-200 dark:border-white/5 last:border-0 transition-colors flex items-center gap-2">
                                                    <Plane size={14} className="text-brand-orange" /> {s}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="bg-gradient-to-r from-brand-orange to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl shadow-lg shadow-brand-orange/30 flex items-center justify-center gap-2 font-bold transition-all hover:scale-[1.03] active:scale-[0.97] px-8 py-3 sm:py-0 disabled:opacity-50 min-w-[120px]"
                                >
                                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : <><Search size={20} strokeWidth={3} /> Search</>}
                                </button>
                            </div>
                            
                            {/* Sleek Dates Row */}
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <label className="absolute left-3 top-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-500">Departure</label>
                                    <input
                                        type="date"
                                        className="w-full bg-gray-50/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 rounded-lg py-2 pl-3 pr-2 text-gray-900 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-orange/50 transition-all text-sm pt-5"
                                        value={flightDate}
                                        onChange={(e) => setFlightDate(e.target.value)}
                                    />
                                </div>
                                <div className="relative flex-1">
                                    <label className="absolute left-3 top-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-500">Return (Opt)</label>
                                    <input
                                        type="date"
                                        className="w-full bg-gray-50/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 rounded-lg py-2 pl-3 pr-2 text-gray-900 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-orange/50 transition-all text-sm pt-5"
                                        value={returnDate}
                                        onChange={(e) => setReturnDate(e.target.value)}
                                    />
                                </div>
                            </div>
                        </form>
                        
                        {/* Disclaimers & Apollo Message */}
                        <div className="mt-4 space-y-3">
                            <p className="text-xs text-center text-gray-500 dark:text-white/40 italic px-4">
                                Live tracking is available up to 3 days in advance. You can search for future flights and live tracking will activate closer to departure!
                            </p>
                            <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-4 flex gap-3 items-start relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full"></div>
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg mt-0.5">
                                    <span className="text-white text-xs font-bold">A</span>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-indigo-400 dark:text-indigo-300 mb-0.5">Apollo says:</p>
                                    <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                                        Hey there! We are still working on making the flights feature as advanced as possible. More exciting updates are coming soon in the next version! ✨
                                    </p>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Airport Route Search */}
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1 relative min-w-[140px]">
                                    <label className="absolute left-4 top-2 text-[10px] font-bold uppercase tracking-wider text-brand-orange">From</label>
                                    <input
                                        id="originCityInput"
                                        type="text"
                                        placeholder="Code"
                                        className="w-full bg-gray-50 dark:bg-[#202124] border border-gray-200 dark:border-white/10 rounded-xl py-3 pl-4 pr-3 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange transition-all font-bold text-base pt-7"
                                        value={originCity}
                                        onChange={(e) => setOriginCity(e.target.value.toUpperCase())}
                                        onFocus={() => setActiveInput('origin')}
                                        onBlur={handleBlur}
                                        autoComplete="off"
                                    />
                                    {activeInput === 'origin' && suggestions.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#151921] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                                            {suggestions.map(s => (
                                                <button key={s} onMouseDown={() => applySuggestion(s)} className="w-full text-left px-4 py-3 text-sm font-bold text-gray-900 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 border-b border-gray-200 dark:border-white/5 last:border-0 transition-colors flex items-center gap-2">
                                                    <Plane size={14} className="text-brand-orange" /> {s}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-center z-10 -mx-3 py-2 sm:py-0">
                                    <button
                                        onClick={handleSwapAirports}
                                        className="bg-white dark:bg-[#303134] hover:bg-gray-100 dark:hover:bg-[#3c4043] p-2 rounded-full border border-gray-200 dark:border-white/10 shadow-md text-gray-500 dark:text-gray-300 transition-all hover:scale-110 active:scale-95 group"
                                    >
                                        <ArrowLeftRight size={16} className="group-hover:text-brand-orange transition-colors" />
                                    </button>
                                </div>

                                <div className="flex-1 relative min-w-[140px]">
                                    <label className="absolute left-4 top-2 text-[10px] font-bold uppercase tracking-wider text-brand-blue">To</label>
                                    <input
                                        id="destCityInput"
                                        type="text"
                                        placeholder="Code"
                                        className="w-full bg-gray-50 dark:bg-[#202124] border border-gray-200 dark:border-white/10 rounded-xl py-3 pl-4 pr-3 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue transition-all font-bold text-base pt-7"
                                        value={destCity}
                                        onChange={(e) => setDestCity(e.target.value.toUpperCase())}
                                        onFocus={() => setActiveInput('dest')}
                                        onBlur={handleBlur}
                                        autoComplete="off"
                                    />
                                    {activeInput === 'dest' && suggestions.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#151921] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                                            {suggestions.map(s => (
                                                <button key={s} onMouseDown={() => applySuggestion(s)} className="w-full text-left px-4 py-3 text-sm font-bold text-gray-900 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 border-b border-gray-200 dark:border-white/5 last:border-0 transition-colors flex items-center gap-2">
                                                    <Plane size={14} className="text-brand-blue" /> {s}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1 relative">
                                    <label className="absolute left-4 top-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Airline</label>
                                    <select
                                        className="w-full bg-gray-50 dark:bg-[#202124] border border-gray-200 dark:border-white/10 rounded-xl py-3 pl-4 pr-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue transition-all font-bold text-base pt-7 appearance-none cursor-pointer"
                                        value={airlineFilter}
                                        onChange={(e) => setAirlineFilter(e.target.value)}
                                    >
                                        <option value="ALL">All Airlines</option>
                                        <option value="DAL">Delta Air Lines</option>
                                        <option value="AAL">American Airlines</option>
                                        <option value="UAL">United Airlines</option>
                                        <option value="SWA">Southwest Airlines</option>
                                        <option value="JBU">JetBlue Airways</option>
                                        <option value="ASA">Alaska Airlines</option>
                                        <option value="FFT">Frontier Airlines</option>
                                        <option value="HAL">Hawaiian Airlines</option>
                                    </select>
                                </div>
                                <button
                                    onClick={performSearch}
                                    disabled={isLoading}
                                    className="bg-gradient-to-r from-brand-orange to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl shadow-lg shadow-brand-orange/30 flex items-center justify-center gap-2 font-bold transition-all hover:scale-[1.03] active:scale-[0.97] px-8 py-3 sm:py-0 disabled:opacity-50 min-w-[120px]"
                                >
                                    {isLoading ? <Loader2 className="animate-spin" size={18} /> : <><Search size={18} strokeWidth={3} /> Search</>}
                                </button>
                            </div>
                            {/* Sleek Dates Row */}
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <label className="absolute left-3 top-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-500">Departure</label>
                                    <input
                                        type="date"
                                        className="w-full bg-gray-50/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 rounded-lg py-2 pl-3 pr-2 text-gray-900 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-orange/50 transition-all text-sm pt-5"
                                        value={flightDate}
                                        onChange={(e) => setFlightDate(e.target.value)}
                                    />
                                </div>
                                <div className="relative flex-1">
                                    <label className="absolute left-3 top-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-500">Return (Opt)</label>
                                    <input
                                        type="date"
                                        className="w-full bg-gray-50/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 rounded-lg py-2 pl-3 pr-2 text-gray-900 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-orange/50 transition-all text-sm pt-5"
                                        value={returnDate}
                                        onChange={(e) => setReturnDate(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                        
                        {/* Disclaimers & Apollo Message */}
                        <div className="mt-4 space-y-3">
                            <p className="text-xs text-center text-gray-500 dark:text-white/40 italic px-4">
                                Live tracking is available up to 3 days in advance. You can search for future flights and live tracking will activate closer to departure!
                            </p>
                            <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-4 flex gap-3 items-start relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full"></div>
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg mt-0.5">
                                    <span className="text-white text-xs font-bold">A</span>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-indigo-400 dark:text-indigo-300 mb-0.5">Apollo says:</p>
                                    <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                                        Hey there! We are still working on making the flights feature as advanced as possible. More exciting updates are coming soon in the next version! ✨
                                    </p>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ICAO Disclaimer */}
            <div className="bg-white/50 dark:bg-white/5 border border-brand-orange/20 rounded-xl p-3 flex items-start gap-3 shadow-sm">
                <Info size={16} className="text-brand-orange shrink-0 mt-0.5" />
                <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
                    <strong className="text-gray-900 dark:text-gray-300">Flight Code Tip:</strong> We use ICAO codes (the industry standard used by ATC and FlightAware) for the most accurate results. Airlines use 3-letter codes — for example, <span className="text-brand-orange font-bold">DAL</span> (Delta), <span className="text-brand-orange font-bold">UAL</span> (United), <span className="text-brand-orange font-bold">AAL</span> (American), <span className="text-brand-orange font-bold">SWA</span> (Southwest). US airports are prefixed with K (e.g., <span className="text-brand-orange font-bold">KATL</span>, <span className="text-brand-orange font-bold">KLAX</span>, <span className="text-brand-orange font-bold">KJFK</span>). International airports use their standard 4-letter ICAO code (e.g., <span className="text-brand-orange font-bold">EGLL</span> for London Heathrow, <span className="text-brand-orange font-bold">RJTT</span> for Tokyo Haneda).{' '}
                    <a href="https://flightaware.com/about/faq#ident" target="_blank" rel="noopener noreferrer" className="text-brand-blue ml-1 hover:underline font-bold inline-flex items-center gap-0.5">Learn more <ExternalLink size={10}/></a>
                </p>
            </div>

            {/* Results Area */}
            <div className="space-y-4">
                {/* Empty State — Before any search */}
                {!hasSearched && !isLoading && flights.length === 0 && (
                    <div className="bg-white dark:bg-brand-surface/50 border border-gray-200 dark:border-white/10 rounded-2xl p-8 text-center">
                        <div className="inline-flex bg-gradient-to-br from-brand-orange/20 to-brand-blue/20 text-brand-orange p-4 rounded-2xl mb-4">
                            <Radar size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Search for Flights</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 max-w-xs mx-auto leading-relaxed">
                            Track any flight in real time using FlightAware data. Search by flight number or browse airport departures.
                        </p>
                        <div className="bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-[10px] p-2 rounded-lg max-w-xs mx-auto mb-6 flex items-start gap-2 text-left">
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                            <span>FlightAware tracks active and upcoming flights only. It is not designed for future travel booking.</span>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2 mb-6">
                            <button onClick={() => { setSearchMode('flight'); setSearchQuery('DAL1182'); }} className="text-xs font-bold bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 hover:border-brand-orange/30 hover:text-brand-orange transition">
                                DAL1182
                            </button>
                            <button onClick={() => { setSearchMode('airport'); setOriginCity('ATL'); }} className="text-xs font-bold bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 hover:border-brand-orange/30 hover:text-brand-orange transition">
                                ATL departures
                            </button>
                            <button onClick={() => { setSearchMode('flight'); setSearchQuery('UA100'); }} className="text-xs font-bold bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 hover:border-brand-orange/30 hover:text-brand-orange transition">
                                UA100
                            </button>
                        </div>
                        <button
                            onClick={handleRandomPreview}
                            className="text-brand-orange font-bold text-sm flex items-center gap-2 mx-auto hover:underline"
                        >
                            <Plane size={14} /> Track a Random Flight
                        </button>
                    </div>
                )}

                {/* Loading State */}
                {isLoading && (
                    <div className="space-y-4">
                        <FlightSkeleton />
                        <FlightSkeleton />
                        <FlightSkeleton />
                    </div>
                )}

                {/* Error / No Results */}
                {searchError && !isLoading && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
                        <AlertTriangle size={24} className="text-red-400 mx-auto mb-2" />
                        <p className="text-sm font-bold text-red-400">{searchError}</p>
                    </div>
                )}

                {/* Airport Conditions Banner */}
                {airportInfo && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center justify-between">
                        <div>
                            <h4 className="font-bold text-red-500 flex items-center gap-2"><AlertTriangle size={16}/> {airportInfo.airportCode} Conditions</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Delay Index: {airportInfo.delayIndex}/5 • {airportInfo.weather} • {airportInfo.temp}°F</p>
                        </div>
                    </div>
                )}

                {/* View Mode Toggle — only show when we have results */}
                {hasSearched && !isLoading && (flights.length > 0 || schedules.length > 0) && searchMode === 'airport' && (
                    <>
                        <div className="flex gap-2 p-1 bg-gray-100 dark:bg-white/5 rounded-xl">
                            <button onClick={() => setViewMode('live')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${viewMode === 'live' ? 'bg-white dark:bg-brand-surface shadow text-brand-orange' : 'text-gray-500'}`}>Live Board</button>
                            <button onClick={() => setViewMode('schedule')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${viewMode === 'schedule' ? 'bg-white dark:bg-brand-surface shadow text-brand-orange' : 'text-gray-500'}`}>Schedules</button>
                        </div>

                        <div className="flex justify-between items-end px-2">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{viewMode === 'live' ? 'Live Board' : 'Schedules'}</h3>
                            <span className="text-xs font-mono text-brand-orange">{viewMode === 'live' ? flights.length : schedules.length} RESULTS</span>
                        </div>
                    </>
                )}

                {/* Results Count for flight mode */}
                {hasSearched && !isLoading && flights.length > 0 && searchMode === 'flight' && (
                    <div className="flex justify-between items-end px-2">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Results</h3>
                        <span className="text-xs font-mono text-brand-orange">{flights.length} FLIGHTS</span>
                    </div>
                )}

                {/* Schedule Cards */}
                {viewMode === 'schedule' && schedules.length > 0 && schedules.map((sched, i) => (
                    <div key={i} className="w-full text-left bg-white dark:bg-brand-surface border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden p-5 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <div className="text-sm font-bold">{sched.airline} <span className="text-gray-500 ml-2">{sched.ident}</span></div>
                            <div className="text-xs font-mono bg-gray-100 dark:bg-white/5 px-2 py-1 rounded">{sched.aircraft || 'Unknown Aircraft'}</div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="text-center w-20">
                                <div className="text-2xl font-black">{sched.origin}</div>
                                <div className="text-xs text-gray-500 mt-1">{formatTime(sched.departure)}</div>
                            </div>
                            <div className="flex-1 flex items-center justify-center px-4">
                                <div className="w-full border-t-2 border-dashed border-gray-300 dark:border-white/20 relative">
                                    <Plane size={16} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-brand-orange bg-white dark:bg-brand-surface px-1" />
                                </div>
                            </div>
                            <div className="text-center w-20">
                                <div className="text-2xl font-black">{sched.destination}</div>
                                <div className="text-xs text-gray-500 mt-1">{formatTime(sched.arrival)}</div>
                            </div>
                        </div>
                        {isStatsNerd && (
                            <div className="mt-4 pt-2 border-t border-gray-200 dark:border-white/10 text-[10px] font-mono text-gray-400">
                                API: AeroAPI /schedule | Ident: {sched.ident} | Raw Arrival: {sched.arrival}
                            </div>
                        )}
                        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/10 flex justify-between items-center">
                            <span className="text-[10px] text-brand-blue font-bold tracking-wider uppercase">Apollo Proactive</span>
                            <button onClick={() => alert('Apollo Schedule Tracking enabled! We will notify you of any equipment or time changes.')} className="bg-brand-blue/10 text-brand-blue hover:bg-brand-blue hover:text-white px-3 py-1.5 rounded-full text-[10px] font-bold transition flex items-center gap-1">
                                <Radar size={12}/> Track Schedule
                            </button>
                        </div>
                    </div>
                ))}
                
                {/* Apollo Disclaimer */}
                {hasSearched && (
                    <div className="mt-8 mb-4 bg-brand-surface border border-white/10 rounded-2xl p-4 flex gap-4 animate-in fade-in">
                        <img src="/assets/apollo_pilot.jpg" alt="Apollo" className="w-12 h-12 rounded-full border-2 border-brand-orange/50 shrink-0" />
                        <div>
                            <div className="text-brand-orange font-bold text-sm mb-1">Apollo</div>
                            <p className="text-gray-300 text-sm italic">
                                "Hey! We are currently working hard to make our flight systems as advanced as possible. Expect major tracking upgrades in the next update!"
                            </p>
                        </div>
                    </div>
                )}

                {/* Live Flight Cards */}
                {(viewMode === 'live' || searchMode === 'flight') && flights.map((flight, i) => (
                    <div
                        key={flight.id + '-' + i}
                        onClick={() => setSelectedFlight(flight === selectedFlight ? null : flight)}
                        className={`w-full text-left bg-white dark:bg-brand-surface border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden hover:border-brand-orange/40 transition-all duration-300 shadow-lg hover:shadow-xl group relative cursor-pointer ${selectedFlight === flight ? 'ring-2 ring-brand-orange' : ''}`}
                    >
                        {/* Map Overlay for Selected Flight */}
                        {selectedFlight === flight && (
                            <div className="h-48 w-full relative bg-gray-900 border-b border-white/10">
                                <div ref={mapRef} className="w-full h-full opacity-80" />
                                <div className="absolute bottom-2 left-4 flex gap-3">
                                    <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 text-white flex items-center gap-2">
                                        <Navigation size={12} className="text-brand-orange" />
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-gray-400 uppercase font-bold">Alt</span>
                                            <span className="text-xs font-mono font-bold">{Math.round(telemetry.alt).toLocaleString()} ft</span>
                                        </div>
                                    </div>
                                    <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 text-white flex items-center gap-2">
                                        <Gauge size={12} className="text-brand-blue" />
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-gray-400 uppercase font-bold">Speed</span>
                                            <span className="text-xs font-mono font-bold">{Math.round(telemetry.speed)} kts</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="p-5 relative z-10">
                            <div className="flex justify-between items-start mb-5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center border border-gray-200 dark:border-white/10 group-hover:border-brand-orange/20 transition">
                                        <Plane size={18} className="text-gray-500 dark:text-gray-300 group-hover:text-brand-orange transition-colors" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-gray-900 dark:text-white">{flight.airline}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono font-medium">{flight.flightNumber}{flight.aircraft ? ` • ${flight.aircraft}` : ''}</div>
                                    </div>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-[10px] font-extrabold border flex items-center gap-1.5 uppercase tracking-wide ${getStatusColor(flight.status)}`}>
                                    {flight.status === FlightStatus.OnTime && <CheckCircle size={12} />}
                                    {flight.status === FlightStatus.Delayed && <AlertTriangle size={12} />}
                                    {flight.status}
                                </div>
                            </div>

                            <div className="flex items-center justify-between relative mb-5">
                                <div className="text-center w-28">
                                    <div className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">{flight.departureAirport}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 font-bold mt-1">
                                        <span className={flight.actualDepartureTime ? "line-through opacity-70" : ""}>{formatTime(flight.departureTime)}</span>
                                        {flight.actualDepartureTime && <span className="ml-1 text-brand-orange">{formatTime(flight.actualDepartureTime)}</span>}
                                        {!flight.actualDepartureTime && flight.estimatedDepartureTime && <span className="ml-1 text-yellow-500">{formatTime(flight.estimatedDepartureTime)}</span>}
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">
                                        {flight.terminal ? `T${flight.terminal}` : ''} {flight.gate ? `G${flight.gate}` : ''}
                                    </div>
                                </div>

                                <div className="flex-1 px-2 relative flex flex-col items-center">
                                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1 font-bold bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-md">
                                        <Clock size={10} /> {formatDuration(flight.durationMinutes)}
                                    </div>
                                    <div className="w-full h-[3px] bg-gray-200 dark:bg-white/10 rounded-full relative overflow-visible">
                                        <div
                                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-brand-orange/50 to-brand-orange shadow-[0_0_10px_rgba(255,107,53,0.5)] transition-all duration-1000 ease-linear rounded-full"
                                            style={{ width: `${flight.progress}%` }}
                                        />
                                        <div
                                            className="absolute top-1/2 -mt-2 w-4 h-4 bg-white dark:bg-brand-surface rounded-full border-2 border-brand-orange shadow-md transition-all duration-1000 ease-linear flex items-center justify-center z-10"
                                            style={{ left: `${flight.progress}%`, transform: 'translate(-50%, -50%)' }}
                                        >
                                            <div className="w-1.5 h-1.5 bg-brand-orange rounded-full"></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-center w-28">
                                    <div className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">{flight.arrivalAirport}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 font-bold mt-1">
                                        <span className={flight.actualArrivalTime ? "line-through opacity-70" : ""}>{formatTime(flight.arrivalTime)}</span>
                                        {flight.actualArrivalTime && <span className="ml-1 text-brand-orange">{formatTime(flight.actualArrivalTime)}</span>}
                                        {!flight.actualArrivalTime && flight.estimatedArrivalTime && <span className="ml-1 text-yellow-500">{formatTime(flight.estimatedArrivalTime)}</span>}
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">
                                        {flight.terminalDestination ? `T${flight.terminalDestination}` : ''} {flight.gateDestination ? `G${flight.gateDestination}` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 dark:bg-white/5 px-5 py-3 flex justify-between items-center border-t border-gray-200 dark:border-white/5">
                            <div className="flex gap-4 text-xs font-bold text-gray-500 dark:text-gray-300">
                                <span className="flex items-center gap-1"><MapPin size={10} /> {flight.airline} • {flight.aircraft || 'Aircraft TBD'}</span>
                                <span className="flex items-center gap-1"><Calendar size={10} /> {formatDate(flight.departureTime)}</span>
                            </div>
                            <div className="flex gap-2">
                                {onTrackFlight && <button onClick={(e) => { e.stopPropagation(); onTrackFlight(flight); }} className="text-brand-orange font-bold text-xs bg-brand-orange/10 px-2 py-1 rounded-md border border-brand-orange/20 hover:bg-brand-orange hover:text-white transition">Track Live</button>}
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenSaveDialog(flight); }}
                                    className="text-brand-orange font-bold text-xs flex items-center gap-1 hover:underline bg-brand-orange/10 px-2 py-1 rounded-md border border-brand-orange/20"
                                >
                                    Save to Trip <PlusCircle size={10} />
                                </button>
                                <button
                                    onClick={(e) => openGoogleFlights(flight, e)}
                                    className="text-brand-blue font-bold text-xs flex items-center gap-1 hover:underline bg-blue-100 dark:bg-blue-500/10 px-2 py-1 rounded-md border border-blue-200 dark:border-blue-500/20"
                                >
                                    View Price <ExternalLink size={10} />
                                </button>
                            </div>
                        </div>
                        {isStatsNerd && (
                            <div className="text-[10px] font-mono text-gray-400 p-2 bg-gray-100 dark:bg-black/20 rounded-b-2xl mx-0">
                                API: AeroAPI | Ident: {flight.ident} | Progress: {flight.progress.toFixed(1)}% | Gate: {flight.gate || 'N/A'} | Duration: {flight.durationMinutes || 'N/A'}min
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="text-center py-4 text-[10px] text-gray-500 uppercase tracking-widest">
                Flight data provided by FlightAware®
            </div>

            {/* Save to Trip Modal */}
            {isSavingToTrip && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-[#151921] rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-gray-200 dark:border-white/10 animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                                <Plane size={20} className="text-brand-orange" /> Save Flight
                            </h3>
                            <button onClick={() => setIsSavingToTrip(null)} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="bg-gray-50 dark:bg-black/30 rounded-xl p-3 mb-6 border border-gray-200 dark:border-white/5 text-sm font-medium dark:text-gray-300">
                            {isSavingToTrip.airline} {isSavingToTrip.flightNumber}
                        </div>

                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Select a Trip</h4>
                        
                        {isFetchingTrips ? (
                            <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-brand-orange" size={24} /></div>
                        ) : trips.length === 0 ? (
                            <div className="text-center py-6 text-sm text-gray-500">
                                You don't have any trips yet. Create one in the Plans tab!
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {trips.map(trip => (
                                    <button
                                        key={trip.id}
                                        onClick={() => handleSaveToTrip(trip.id)}
                                        className="w-full text-left p-3 rounded-xl border border-gray-200 dark:border-white/10 hover:border-brand-orange/50 hover:bg-brand-orange/5 transition group flex justify-between items-center"
                                    >
                                        <span className="font-bold text-gray-900 dark:text-white">{trip.name}</span>
                                        <PlusCircle size={16} className="text-gray-400 group-hover:text-brand-orange transition-colors" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});
