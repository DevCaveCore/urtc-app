
import React, { useState, useEffect, useRef } from 'react';
import { CloudRain, Sun, Wind, Droplets, MapPin, Star, DollarSign, Map as MapIcon, Plus, Search, Loader2, Navigation, ExternalLink, Thermometer, Car, Train, Newspaper, ChevronDown, List, Bookmark, Trash2 } from 'lucide-react';
import { Weather, Place, BudgetItem, NewsArticle, Theme } from '../types';
import { fetchRealWeather, fetchTravelNews } from '../services/apiService';
import { getTransitRates } from '../services/mockService';
import { getActiveUser } from '../services/authService';
import { supabase } from '../services/supabaseClient';
import { SwipeToDelete } from './SwipeToDelete';

interface CityViewProps {
    onAddToBudget: (item: BudgetItem) => void;
    initialCity?: string;
    onCityChange?: (city: string) => void;
    theme?: Theme;
}

declare global {
    interface Window {
        google: any;
    }
}

const PRESET_CITIES = ["Atlanta, GA, USA", "Brookhaven, GA, USA", "New York, NY, USA", "London, UK", "Tokyo, Japan", "Paris, France"];

export const CityView: React.FC<CityViewProps> = ({ onAddToBudget, initialCity = "Atlanta", onCityChange, theme = 'dark' }) => {
    const [currentCity, setCurrentCity] = useState(initialCity);
    const [weather, setWeather] = useState<Weather | null>(null);
    const [places, setPlaces] = useState<Place[]>([]);
    const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
    const [activeTab, setActiveTab] = useState<'map' | 'list' | 'saved'>('list');
    const [searchQuery, setSearchQuery] = useState('');
    const [citySelectorOpen, setCitySelectorOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    const [cityInput, setCityInput] = useState('');
    const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
    const [showCitySuggestions, setShowCitySuggestions] = useState(false);

    const mapRef = useRef<HTMLDivElement>(null);
    const googleMapRef = useRef<any>(null);
    const geocoderRef = useRef<any>(null);

    useEffect(() => {
        handleCityChange(initialCity);
        const loadSavedPlaces = async () => {
            const user = getActiveUser();
            if (user && !user.id.startsWith('guest')) {
                const { data } = await supabase.from('saved_places').select('place_data').eq('user_id', user.id);
                if (data) {
                    setSavedPlaces(data.map(row => row.place_data));
                }
            } else {
                const stored = localStorage.getItem('urtc_saved_places');
                if (stored) setSavedPlaces(JSON.parse(stored));
            }
        };
        loadSavedPlaces();
    }, []);

    const toggleSavePlace = async (place: Place) => {
        const isSaved = savedPlaces.some(p => p.id === place.id);
        const user = getActiveUser();
        
        let newSaved;
        if (isSaved) {
            newSaved = savedPlaces.filter(p => p.id !== place.id);
            if (user && !user.id.startsWith('guest')) {
                await supabase.from('saved_places').delete().eq('user_id', user.id).eq('place_data->>id', place.id);
            }
        } else {
            newSaved = [...savedPlaces, place];
            if (user && !user.id.startsWith('guest')) {
                await supabase.from('saved_places').insert({ user_id: user.id, place_data: place });
            }
        }
        
        setSavedPlaces(newSaved);
        if (!user || user.id.startsWith('guest')) {
            localStorage.setItem('urtc_saved_places', JSON.stringify(newSaved));
        }
    };

    useEffect(() => {
        const checkGoogle = setInterval(() => {
            if (window.google && window.google.maps && window.google.maps.places) {
                setMapReady(true);
                clearInterval(checkGoogle);
            }
        }, 500);
        return () => clearInterval(checkGoogle);
    }, []);

    useEffect(() => {
        if (mapReady && !googleMapRef.current && mapRef.current) {
            try {
                googleMapRef.current = new window.google.maps.Map(mapRef.current, {
                    center: { lat: 33.7490, lng: -84.3880 },
                    zoom: 13,
                    mapId: "DEMO_MAP_ID",
                    disableDefaultUI: true,
                });
                geocoderRef.current = new window.google.maps.Geocoder();
            } catch (e) { console.error(e); }
        }
    }, [mapRef.current, mapReady, activeTab]);

    // City Autocomplete logic using Google Places
    useEffect(() => {
        if (!cityInput || !window.google) return;
        const autocompleteService = new window.google.maps.places.AutocompleteService();
        autocompleteService.getPlacePredictions({ input: cityInput, types: ['(cities)'] }, (predictions: any[], status: any) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                setCitySuggestions(predictions.map(p => p.description));
                setShowCitySuggestions(true);
            }
        });
    }, [cityInput]);

    const handleCityChange = async (city: string) => {
        setCurrentCity(city);
        setCitySelectorOpen(false);
        setShowCitySuggestions(false);
        setCityInput(''); // Reset input after selection
        if (onCityChange) onCityChange(city);
        // Track for Apollo proactive tips
        localStorage.setItem('urtc_last_city', city.split(',')[0].trim());

        try {
            const weatherData = await fetchRealWeather(city);
            setWeather(weatherData);

            if (geocoderRef.current && googleMapRef.current) {
                geocoderRef.current.geocode({ address: city }, (results: any[], status: any) => {
                    if (status === 'OK' && results[0]) {
                        const location = results[0].geometry.location;
                        googleMapRef.current.setCenter(location);
                        performSearch("Attractions", location);
                    }
                });
            } else {
                performSearch("Attractions");
            }
        } catch (e) { }
    };

    // Smart Price Estimation Logic
    const estimatePriceDetails = (p: any) => {
        const level = p.priceLevel;
        const types = p.types || [];

        // 1. Direct Price Level Mapping (Google API)
        if (level) {
            if (level === 'PRICE_LEVEL_FREE') return { display: 'Free', estimate: 0, level: 1 };
            if (level === 'PRICE_LEVEL_INEXPENSIVE') return { display: '$10-25', estimate: 15, level: 1 }; // $
            if (level === 'PRICE_LEVEL_MODERATE') return { display: '$30-60', estimate: 45, level: 2 };    // $$
            if (level === 'PRICE_LEVEL_EXPENSIVE') return { display: '$70-120', estimate: 90, level: 3 };  // $$$
            if (level === 'PRICE_LEVEL_VERY_EXPENSIVE') return { display: '$150+', estimate: 200, level: 4 }; // $$$$
        }

        // 2. Fallback: Type-Based Inference
        if (types.includes('park')) return { display: 'Free', estimate: 0, level: 1 };
        if (types.includes('church') || types.includes('place_of_worship')) return { display: 'Free', estimate: 0, level: 1 };

        if (types.includes('museum') || types.includes('art_gallery')) return { display: '$15-30', estimate: 25, level: 2 };
        if (types.includes('zoo') || types.includes('aquarium')) return { display: '$30-50', estimate: 40, level: 2 };
        if (types.includes('amusement_park')) return { display: '$60-100', estimate: 80, level: 3 };

        if (types.includes('bakery') || types.includes('cafe')) return { display: '$5-15', estimate: 10, level: 1 };
        if (types.includes('bar') || types.includes('night_club')) return { display: '$20-60', estimate: 40, level: 2 };
        if (types.includes('restaurant')) return { display: '$25-50', estimate: 35, level: 2 }; // Default restaurant

        if (types.includes('lodging')) return { display: '$100-300', estimate: 150, level: 3 };

        // 3. Unknown Fallback
        return { display: 'Ask for Price', estimate: 20, level: 2 };
    };

    const performSearch = async (query: string, locationOverride?: any) => {
        setIsSearching(true);

        // If Google Maps Places library is available
        if (window.google && window.google.maps && window.google.maps.places) {
            const center = locationOverride || (googleMapRef.current ? googleMapRef.current.getCenter() : null);
            const request = {
                textQuery: query + " in " + currentCity,
                fields: ['id', 'displayName', 'types', 'rating', 'priceLevel', 'photos', 'location', 'formattedAddress', 'googleMapsURI', 'websiteURI'],
                locationBias: center,
            };

            try {
                const { places } = await window.google.maps.places.Place.searchByText(request);
                if (places) {
                    const mapped = places.map((p: any, i: number) => {
                        const priceDetails = estimatePriceDetails(p);
                        return {
                            id: p.id,
                            name: p.displayName,
                            category: p.types?.includes('food') ? 'Food' : p.types?.includes('lodging') ? 'Hotel' : 'Attraction',
                            rating: p.rating || 4.5,
                            priceLevel: priceDetails.level,
                            priceEstimate: priceDetails.estimate,
                            priceDisplay: priceDetails.display,
                            image: p.photos && p.photos.length > 0 ? p.photos[0].getURI({ maxWidth: 400 }) : `https://picsum.photos/200/200?random=${i}`,
                            coordinates: p.location,
                            description: p.formattedAddress,
                            websiteUrl: p.googleMapsURI || p.websiteURI || `https://www.google.com/search?q=${encodeURIComponent(p.displayName + " " + currentCity)}`
                        };
                    });
                    setPlaces(mapped);

                    // Update Map Markers if map is active
                    if (googleMapRef.current) {
                        places.forEach((p: any) => {
                            new window.google.maps.marker.AdvancedMarkerElement({
                                map: googleMapRef.current,
                                position: p.location,
                                title: p.displayName
                            });
                        });
                    }
                }
            } catch (e) { console.error(e); }
        } else {
            // Fallback
            setPlaces([
                { id: '1', name: 'Centennial Park', category: 'Attraction', rating: 4.8, priceLevel: 1, image: 'https://picsum.photos/200/200?random=1', priceEstimate: 0, priceDisplay: 'Free', coordinates: { x: 0, y: 0 }, description: 'Beautiful public park', websiteUrl: 'https://www.google.com/search?q=Centennial+Park+Atlanta' },
                { id: '2', name: 'City Museum', category: 'Attraction', rating: 4.6, priceLevel: 2, image: 'https://picsum.photos/200/200?random=2', priceEstimate: 25, priceDisplay: '$25', coordinates: { x: 0, y: 0 }, description: 'History and art', websiteUrl: 'https://www.google.com/search?q=City+Museum' },
                { id: '3', name: 'Downtown Bistro', category: 'Food', rating: 4.4, priceLevel: 2, image: 'https://picsum.photos/200/200?random=3', priceEstimate: 45, priceDisplay: '$30-60', coordinates: { x: 0, y: 0 }, description: 'Local cuisine', websiteUrl: 'https://www.google.com/search?q=Downtown+Bistro' },
            ]);
        }
        setIsSearching(false);
    };

    return (
        <div className="space-y-6 pb-24 animate-in fade-in">
            {/* Large Weather Card */}
            <div className="bg-gradient-to-br from-[#007AFF] to-[#0055B3] rounded-[32px] p-6 text-white shadow-2xl relative overflow-visible">
                {/* Cloud Decor */}
                <div className="absolute -right-10 -top-10 text-white/10 pointer-events-none"><CloudRain size={200} /></div>

                {/* City Search & Selector */}
                <div className="relative z-50">
                    <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-sm font-bold hover:bg-white/30 transition cursor-pointer" onClick={() => setCitySelectorOpen(!citySelectorOpen)}>
                        <MapPin size={14} />
                        <span>{currentCity}</span>
                        <ChevronDown size={14} />
                    </div>

                    {/* Auto-populate Dropdown Section */}
                    {citySelectorOpen && (
                        <div className="absolute top-12 left-0 w-64 bg-white dark:bg-[#151921] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden animate-in zoom-in-95 origin-top-left">
                            <div className="p-2 border-b border-gray-200 dark:border-white/5">
                                <input
                                    type="text"
                                    className="w-full bg-gray-100 dark:bg-black/20 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white outline-none"
                                    placeholder="Search any city..."
                                    value={cityInput}
                                    onChange={(e) => setCityInput(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="max-h-48 overflow-y-auto scrollbar-hide">
                                {showCitySuggestions ? citySuggestions.map(c => (
                                    <button key={c} onClick={() => handleCityChange(c)} className="w-full text-left px-4 py-3 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 border-b border-gray-200 dark:border-white/5 last:border-0">
                                        {c}
                                    </button>
                                )) : PRESET_CITIES.map(c => (
                                    <button key={c} onClick={() => handleCityChange(c)} className="w-full text-left px-4 py-3 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 border-b border-gray-200 dark:border-white/5 last:border-0">
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-between items-end relative z-10">
                    <div>
                        <div className="text-7xl font-black tracking-tighter">{weather?.temp || '--'}°</div>
                        <div className="text-xl font-medium opacity-90">{weather?.condition || 'Loading...'}</div>
                        <div className="text-sm opacity-75">Feels like {weather ? (weather.feelsLike ?? weather.temp ?? '--') : '--'}°</div>
                    </div>
                    <div className="flex gap-2">
                        <div className="bg-white/20 backdrop-blur-md p-2 rounded-2xl text-center min-w-[60px]">
                            <Droplets size={14} className="mx-auto mb-1 opacity-80" />
                            <div className="text-[10px] font-bold uppercase opacity-70">Hum</div>
                            <div className="font-bold text-sm">{weather?.humidity}%</div>
                        </div>
                        <div className="bg-white/20 backdrop-blur-md p-2 rounded-2xl text-center min-w-[60px]">
                            <Wind size={14} className="mx-auto mb-1 opacity-80" />
                            <div className="text-[10px] font-bold uppercase opacity-70">Wind</div>
                            <div className="font-bold text-sm">{weather?.wind}</div>
                        </div>
                    </div>
                </div>

                {/* Hourly Forecast */}
                {weather?.hourly && weather.hourly.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-white/20 relative z-10">
                        <div className="text-xs font-bold uppercase tracking-widest mb-3 opacity-80">Hourly Forecast</div>
                        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x">
                            {weather.hourly.map((hour, idx) => (
                                <div key={idx} className="flex flex-col items-center min-w-[60px] bg-black/10 rounded-xl p-2 snap-center">
                                    <span className="text-[10px] opacity-80 mb-1">{hour.time.replace(':00', '')}</span>
                                    <span className="text-lg font-bold mb-1">{hour.temp}°</span>
                                    <span className="text-[10px] uppercase font-bold text-brand-orange">{hour.condition.substring(0, 4)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Daily Forecast */}
                {weather?.daily && weather.daily.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/20 relative z-10">
                        <div className="text-xs font-bold uppercase tracking-widest mb-3 opacity-80">5-Day Forecast</div>
                        <div className="space-y-2">
                            {weather.daily.map((day, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm font-bold bg-black/10 rounded-lg px-3 py-2">
                                    <span className="w-24">{new Date(day.date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                                    <span className="flex-1 text-center opacity-80 uppercase text-[10px] tracking-wider">{day.condition}</span>
                                    <span className="w-20 text-right">
                                        <span className="opacity-60">{day.minTemp}°</span> / {day.maxTemp}°
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Search & Toggle */}
            <div className="space-y-3">
                <div className="relative">
                    <Search className="absolute left-4 top-3.5 text-gray-500" size={20} />
                    <input
                        type="text"
                        placeholder={`Find food, hotels in ${currentCity.split(',')[0]}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && performSearch(searchQuery)}
                        className="w-full bg-white dark:bg-[#151921] border border-gray-200 dark:border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-gray-900 dark:text-white focus:border-brand-orange outline-none transition-all shadow-sm"
                    />
                </div>

                <div className="flex p-1 bg-white dark:bg-[#151921] border border-gray-200 dark:border-white/10 rounded-xl shadow-sm">
                    <button
                        onClick={() => setActiveTab('map')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'map' ? 'bg-gray-900 dark:bg-white text-white dark:text-black' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        <MapIcon size={14} /> MAP
                    </button>
                    <button
                        onClick={() => setActiveTab('list')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'list' ? 'bg-gray-900 dark:bg-white text-white dark:text-black' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        <List size={14} /> LIST
                    </button>
                    <button
                        onClick={() => setActiveTab('saved')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'saved' ? 'bg-gray-900 dark:bg-white text-white dark:text-black' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        <Bookmark size={14} /> SAVED
                    </button>
                </div>
            </div>

            {/* Content Views */}
            {activeTab === 'list' ? (
                <div className="space-y-4">
                    <div className="flex justify-between items-end px-1">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Top Picks</h3>
                        <span className="text-xs font-mono text-brand-orange">{places.length} RESULTS</span>
                    </div>

                    {isSearching ? (
                        <div className="py-12 flex justify-center"><Loader2 size={32} className="animate-spin text-brand-orange" /></div>
                    ) : places.map((place, i) => (
                        <div key={place.id} className="bg-white dark:bg-[#151921] p-3 rounded-2xl border border-gray-200 dark:border-white/5 flex gap-4 group hover:border-brand-orange/30 transition shadow-sm relative overflow-hidden">


                            <div className="w-24 h-24 rounded-xl bg-gray-200 dark:bg-gray-800 shrink-0 overflow-hidden relative">
                                <img src={place.image} alt={place.name} className="w-full h-full object-cover" />
                                <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white flex items-center gap-1"><Star size={8} className="text-brand-orange fill-current" /> {place.rating}</div>
                            </div>
                            <div className="flex-1 flex flex-col justify-between py-1">
                                <div>
                                    <div className="flex justify-between items-start">
                                        <h4 className="text-gray-900 dark:text-white font-bold text-lg leading-tight">{place.name}</h4>
                                        <div className="flex gap-2">
                                            <button onClick={() => toggleSavePlace(place)} className={`p-2 rounded-full transition shrink-0 active:scale-95 ${savedPlaces.some(p => p.id === place.id) ? 'bg-brand-orange text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white hover:bg-brand-orange hover:text-white'}`}><Bookmark size={16} /></button>
                                            <button onClick={() => onAddToBudget({ id: place.id, name: place.name, cost: place.priceEstimate, category: place.category })} className="p-2 bg-gray-100 dark:bg-white/10 rounded-full text-gray-500 dark:text-white hover:bg-brand-orange transition shrink-0 active:scale-95"><Plus size={16} /></button>
                                        </div>
                                    </div>
                                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-1 line-clamp-1">{place.description}</p>
                                </div>
                                <div className="flex justify-between items-center border-t border-gray-200 dark:border-white/5 pt-2 mt-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white px-1.5 py-0.5 rounded">
                                            {Array(place.priceLevel).fill('$').join('')}
                                        </span>
                                        <span className={`${place.priceEstimate === 0 ? 'text-green-500' : 'text-gray-900 dark:text-gray-200'} font-mono text-xs font-bold`}>
                                            {place.priceDisplay}
                                        </span>
                                    </div>
                                    <a href={place.websiteUrl} target="_blank" rel="noopener noreferrer" className={`text-xs font-bold hover:underline ${place.id === '2' ? 'text-brand-orange flex items-center gap-1' : 'text-brand-blue'}`}>
                                        {place.id === '2' ? (
                                            <>Book Now <ExternalLink size={10} /></>
                                        ) : 'Visit'}
                                    </a>
                                </div>
                            </div>
                        </div>
                    ))}

                </div>
            ) : activeTab === 'saved' ? (
                <div className="space-y-4">
                    <div className="flex justify-between items-end px-1">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Saved Places</h3>
                        <span className="text-xs font-mono text-brand-orange">{savedPlaces.length} SAVED</span>
                    </div>

                    {savedPlaces.length === 0 ? (
                        <div className="py-12 text-center text-gray-500 dark:text-gray-400 font-bold">
                            <Bookmark className="mx-auto mb-2 opacity-50" size={32} />
                            No saved places yet.
                        </div>
                    ) : savedPlaces.map((place, i) => (
                        <SwipeToDelete key={place.id} onDelete={() => toggleSavePlace(place)}>
                            <div className="bg-white dark:bg-[#151921] p-3 rounded-2xl border border-brand-orange/30 flex gap-4 group shadow-sm relative overflow-hidden">
                                <div className="w-24 h-24 rounded-xl bg-gray-200 dark:bg-gray-800 shrink-0 overflow-hidden relative">
                                    <img src={place.image} alt={place.name} className="w-full h-full object-cover" />
                                    <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white flex items-center gap-1"><Star size={8} className="text-brand-orange fill-current" /> {place.rating}</div>
                                </div>
                                <div className="flex-1 flex flex-col justify-between py-1">
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <h4 className="text-gray-900 dark:text-white font-bold text-lg leading-tight">{place.name}</h4>
                                            <button onClick={() => toggleSavePlace(place)} className="p-2 bg-red-500/10 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition shrink-0 active:scale-95"><Trash2 size={16} /></button>
                                        </div>
                                        <p className="text-gray-500 dark:text-gray-400 text-xs mt-1 line-clamp-1">{place.description}</p>
                                    </div>
                                    <div className="flex justify-between items-center border-t border-gray-200 dark:border-white/5 pt-2 mt-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white px-1.5 py-0.5 rounded">
                                                {Array(place.priceLevel).fill('$').join('')}
                                            </span>
                                        </div>
                                        <a href={place.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-brand-blue flex items-center gap-1 hover:underline">
                                            View on Google <ExternalLink size={10} />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </SwipeToDelete>
                    ))}
                </div>
            ) : (
                <div className="w-full aspect-[3/4] bg-white dark:bg-[#151921] rounded-3xl border border-gray-200 dark:border-white/10 overflow-hidden relative shadow-xl">
                    <div ref={mapRef} className="w-full h-full" />
                    <button onClick={() => performSearch("Attractions")} className="absolute top-4 left-1/2 -translate-x-1/2 bg-brand-dark/90 backdrop-blur text-white px-4 py-2 rounded-full text-xs font-bold shadow-xl border border-white/20 flex items-center gap-2">
                        <Search size={14} /> Search This Area
                    </button>
                </div>
            )
            }

            <div className="text-center py-4 text-[10px] text-gray-400 dark:text-gray-600 uppercase tracking-widest">
                Places data provided by Google
            </div>
        </div >
    );
};
