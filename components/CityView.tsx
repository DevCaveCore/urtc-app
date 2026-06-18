
import React, { useState, useEffect, useRef } from 'react';
import { CloudRain, Sun, Wind, Droplets, MapPin, Star, DollarSign, Map as MapIcon, Plus, Search, Loader2, Navigation, ExternalLink, Thermometer, Car, Train, Newspaper, ChevronDown, List, Bookmark, Trash2 } from 'lucide-react';
import { Weather, Place, BudgetItem, NewsArticle, Theme } from '../types';
import { fetchRealWeather, fetchTravelNews } from '../services/apiService';
import { getTransitRates } from '../services/mockService';
import { getActiveUser } from '../services/authService';
import { supabase } from '../services/supabaseClient';
import { SwipeToDelete } from './SwipeToDelete';
import { fetchTrips, updateTrip } from '../services/tripService';
import { Trip } from '../types';

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

export const CityView: React.FC<CityViewProps> = React.memo(({ onAddToBudget, initialCity = "Atlanta", onCityChange, theme = 'dark' }) => {
    const [currentCity, setCurrentCity] = useState(initialCity);
    const [weather, setWeather] = useState<Weather | null>(null);
    const [places, setPlaces] = useState<Place[]>([]);
    const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
    const [activeTab, setActiveTab] = useState<'map' | 'list' | 'saved'>('list');
    const [searchQuery, setSearchQuery] = useState('');
    const [dietaryFilter, setDietaryFilter] = useState('');
    const [baseLocation, setBaseLocation] = useState('');
    const [citySelectorOpen, setCitySelectorOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    const [cityInput, setCityInput] = useState('');
    const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
    const [showCitySuggestions, setShowCitySuggestions] = useState(false);
    const [userTrips, setUserTrips] = useState<Trip[]>([]);
    const [placeToSave, setPlaceToSave] = useState<Place | null>(null);
    const [hasInitializedLocation, setHasInitializedLocation] = useState(false);

    const mapRef = useRef<HTMLDivElement>(null);
    const googleMapRef = useRef<any>(null);
    const geocoderRef = useRef<any>(null);

    const [travelMode, setTravelMode] = useState('DRIVING');

    useEffect(() => {
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
        const loadTrips = async () => {
            const user = getActiveUser();
            if (user) {
                const trips = await fetchTrips(user.id);
                setUserTrips(trips);
            }
        };
        loadTrips();
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

    // Initial Location Detection
    useEffect(() => {
        if (!mapReady || hasInitializedLocation) return;
        setHasInitializedLocation(true);

        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    const geocoder = new window.google.maps.Geocoder();
                    geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results: any[], status: any) => {
                        if (status === 'OK' && results[0]) {
                            const cityComp = results[0].address_components.find((c: any) => c.types.includes('locality'));
                            const stateComp = results[0].address_components.find((c: any) => c.types.includes('administrative_area_level_1'));
                            const countryComp = results[0].address_components.find((c: any) => c.types.includes('country'));
                            
                            let detectedCity = '';
                            if (cityComp) detectedCity += cityComp.long_name;
                            if (stateComp && countryComp?.short_name === 'US') detectedCity += `, ${stateComp.short_name}`;
                            else if (countryComp) detectedCity += `, ${countryComp.short_name}`;
                            
                            handleCityChange(detectedCity || initialCity);
                        } else {
                            handleCityChange(initialCity);
                        }
                    });
                },
                () => handleCityChange(initialCity),
                { timeout: 5000 }
            );
        } else {
            handleCityChange(initialCity);
        }
    }, [mapReady, hasInitializedLocation]);

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
        setPlaces([]); // Instantly clear old results
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
        if (level !== undefined && level !== null) {
            if (level === 0 || level === 'PRICE_LEVEL_FREE') return { display: 'Free', estimate: 0, level: 1 };
            if (level === 1 || level === 'PRICE_LEVEL_INEXPENSIVE') return { display: '$10-25', estimate: 15, level: 1 };
            if (level === 2 || level === 'PRICE_LEVEL_MODERATE') return { display: '$30-60', estimate: 45, level: 2 };
            if (level === 3 || level === 'PRICE_LEVEL_EXPENSIVE') return { display: '$70-120', estimate: 90, level: 3 };
            if (level === 4 || level === 'PRICE_LEVEL_VERY_EXPENSIVE') return { display: '$150+', estimate: 200, level: 4 };
        }

        // 2. Fallback: Type-Based Inference
        if (types.includes('park') || types.includes('natural_feature')) return { display: 'Free', estimate: 0, level: 1 };
        if (types.includes('church') || types.includes('place_of_worship')) return { display: 'Free', estimate: 0, level: 1 };
        if (types.includes('museum') || types.includes('art_gallery')) return { display: '$20-35', estimate: 25, level: 2 };
        if (types.includes('zoo') || types.includes('aquarium')) return { display: '$35-50', estimate: 45, level: 2 };
        if (types.includes('amusement_park')) return { display: '$80-150', estimate: 100, level: 3 };
        if (types.includes('tourist_attraction')) return { display: '$20-50', estimate: 35, level: 2 };

        if (types.includes('bakery') || types.includes('cafe') || types.includes('coffee_shop')) return { display: '$5-15', estimate: 10, level: 1 };
        if (types.includes('bar') || types.includes('night_club')) return { display: '$20-60', estimate: 40, level: 2 };
        if (types.includes('restaurant') || types.includes('food')) return { display: '$25-75', estimate: 45, level: 2 };

        if (types.includes('lodging') || types.includes('hotel')) return { display: '$120-250/nt', estimate: 180, level: 3 };

        // 3. Unknown Fallback
        return { display: 'Varies', estimate: 30, level: 2 };
    };

    const performSearch = async (query: string, locationOverride?: any) => {
        setIsSearching(true);

        // If Google Maps Places library is available
        if (window.google && window.google.maps && window.google.maps.places) {
            const center = locationOverride || (googleMapRef.current ? googleMapRef.current.getCenter() : null);
            const fullQuery = dietaryFilter ? `${dietaryFilter} ${query}` : query;
            const request = {
                textQuery: fullQuery + " in " + currentCity,
                fields: ['id', 'displayName', 'types', 'rating', 'priceLevel', 'photos', 'location', 'formattedAddress', 'googleMapsURI', 'websiteURI'],
                locationBias: center,
            };

            try {
                const { places } = await window.google.maps.places.Place.searchByText(request);
                if (places) {
                    let mapped = places.map((p: any, i: number) => {
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

                    if (baseLocation && window.google.maps.DistanceMatrixService) {
                        const service = new window.google.maps.DistanceMatrixService();
                        const destinations = places.map((p:any) => p.location);
                        try {
                            const response: any = await new Promise((resolve, reject) => {
                                service.getDistanceMatrix({
                                    origins: [baseLocation + ' in ' + currentCity],
                                    destinations: destinations,
                                    travelMode: travelMode,
                                }, (res: any, status: any) => {
                                    if (status === 'OK') resolve(res);
                                    else reject(status);
                                });
                            });
                            
                            if (response?.rows?.[0]) {
                                const elements = response.rows[0].elements;
                                mapped = mapped.map((m: any, idx: number) => {
                                    if (elements[idx]?.status === 'OK') {
                                        return {
                                            ...m,
                                            distanceText: elements[idx].distance.text,
                                            durationText: elements[idx].duration.text
                                        };
                                    }
                                    return m;
                                });
                            }
                        } catch (e) {
                            console.error('Distance matrix error', e);
                        }
                    }

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
            {/* Compact Weather Card */}
            <div id="explore-weather" className="bg-gradient-to-br from-[#007AFF] to-[#0055B3] rounded-3xl p-4 text-white shadow-2xl relative overflow-visible">
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

                <div className="mt-4 flex justify-between items-center relative z-10">
                    <div>
                        <div className="flex items-end gap-2">
                            <div className="text-4xl font-black tracking-tighter leading-none">{weather?.temp || '--'}°</div>
                            <div className="text-base font-medium opacity-90 mb-0.5">{weather?.condition || 'Loading...'}</div>
                        </div>
                        <div className="text-xs opacity-75 mt-0.5">Feels like {weather ? (weather.feelsLike ?? weather.temp ?? '--') : '--'}°</div>
                    </div>
                    <div className="flex gap-2">
                        <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl text-center min-w-[50px]">
                            <Droplets size={12} className="mx-auto mb-1 opacity-80" />
                            <div className="font-bold text-xs">{weather?.humidity}%</div>
                        </div>
                        <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl text-center min-w-[50px]">
                            <Wind size={12} className="mx-auto mb-1 opacity-80" />
                            <div className="font-bold text-xs">{weather?.wind}</div>
                        </div>
                    </div>
                </div>

                {/* Hourly Forecast */}
                {weather?.hourly && weather.hourly.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/20 relative z-10">
                        <div className="text-xs font-bold uppercase tracking-widest mb-2 opacity-80">Hourly Forecast</div>
                        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide snap-x">
                            {weather.hourly.map((hour, idx) => (
                                <div key={idx} className="flex flex-col items-center min-w-[50px] bg-black/10 rounded-xl p-1.5 snap-center">
                                    <span className="text-[9px] opacity-80 mb-0.5">{hour.time.replace(':00', '')}</span>
                                    <span className="text-sm font-bold mb-0.5">{hour.temp}°</span>
                                    <span className="text-[9px] uppercase font-bold text-brand-orange">{hour.condition.substring(0, 4)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Daily Forecast */}
                {weather?.daily && weather.daily.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-white/20 relative z-10">
                        <div className="text-[10px] font-bold uppercase tracking-widest mb-2 opacity-80">5-Day Forecast</div>
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x">
                            {weather.daily.map((day, idx) => (
                                <div key={idx} className="flex flex-col items-center min-w-[55px] bg-black/10 rounded-xl p-1.5 snap-center">
                                    <span className="text-[9px] opacity-80 mb-0.5">{new Date(day.date).toLocaleDateString([], { weekday: 'short' })}</span>
                                    <span className="text-xs font-bold mb-0.5">{day.maxTemp}°</span>
                                    <span className="text-[8px] opacity-60 mb-0.5">{day.minTemp}°</span>
                                    <span className="text-[8px] uppercase font-bold text-brand-orange whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">{day.condition.substring(0, 5)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Search & Toggle */}
            <div className="space-y-3">
                <div className="relative flex items-center">
                    <Search className="absolute left-4 text-gray-500" size={20} />
                    <input
                        type="text"
                        placeholder={`Search in ${currentCity.split(',')[0]} (Press Enter)`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && performSearch(searchQuery)}
                        className="w-full bg-white dark:bg-[#151921] border border-gray-200 dark:border-white/10 rounded-2xl py-3.5 pl-12 pr-24 text-gray-900 dark:text-white focus:border-brand-orange outline-none transition-all shadow-sm"
                    />
                    <button 
                        onClick={() => performSearch(searchQuery)}
                        className="absolute right-2 bg-brand-orange hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
                    >
                        Search
                    </button>
                </div>

                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex-1 relative">
                            <MapPin className="absolute left-4 top-3 text-brand-orange" size={16} />
                            <input
                                type="text"
                                placeholder="Base Location (e.g. Hotel Name)"
                                value={baseLocation}
                                onChange={(e) => setBaseLocation(e.target.value)}
                                className="w-full bg-white dark:bg-[#151921] border border-gray-200 dark:border-white/10 rounded-xl py-2.5 pl-12 pr-4 text-sm text-gray-900 dark:text-white focus:border-brand-orange outline-none transition-all shadow-sm"
                            />
                        </div>
                        <div className="w-1/3 relative">
                            <select
                                value={travelMode}
                                onChange={(e) => setTravelMode(e.target.value)}
                                className="w-full bg-white dark:bg-[#151921] border border-gray-200 dark:border-white/10 rounded-xl py-2.5 pl-4 pr-8 text-sm text-gray-900 dark:text-white focus:border-brand-orange outline-none transition-all shadow-sm appearance-none cursor-pointer"
                            >
                                <option value="DRIVING">Driving</option>
                                <option value="TRANSIT">Transit</option>
                                <option value="WALKING">Walking</option>
                                <option value="BICYCLING">Bicycling</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-3 text-gray-500 pointer-events-none" size={16} />
                        </div>
                    </div>
                    <div className="relative">
                        <select
                            value={dietaryFilter}
                            onChange={(e) => setDietaryFilter(e.target.value)}
                            className="w-full bg-white dark:bg-[#151921] border border-gray-200 dark:border-white/10 rounded-xl py-2.5 pl-4 pr-8 text-sm text-gray-900 dark:text-white focus:border-brand-orange outline-none transition-all shadow-sm appearance-none cursor-pointer"
                        >
                            <option value="">Any Diet</option>
                            <option value="Vegetarian">Vegetarian</option>
                            <option value="Vegan">Vegan</option>
                            <option value="Gluten-Free">Gluten-Free</option>
                            <option value="Halal">Halal</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-3 text-gray-500 pointer-events-none" size={16} />
                    </div>
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
                    ) : places.length === 0 ? (
                        <div className="py-16 text-center bg-gray-50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-300 dark:border-white/10">
                            <Search className="mx-auto text-gray-300 dark:text-white/20 mb-3" size={32} />
                            <h4 className="text-gray-900 dark:text-white font-bold text-base mb-1">Ready to explore?</h4>
                            <p className="text-gray-500 dark:text-gray-400 text-xs px-8">
                                Type a restaurant, hotel, or attraction in the search bar above and click "Search" to find places.
                            </p>
                        </div>
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
                                            <button 
                                                onClick={() => {
                                                    toggleSavePlace(place);
                                                    setPlaceToSave(place);
                                                }} 
                                                className={`px-3 py-1.5 rounded-full font-bold text-xs flex items-center gap-1.5 transition active:scale-95 ${savedPlaces.some(p => p.id === place.id) ? 'bg-brand-orange text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white hover:bg-brand-orange hover:text-white'}`}
                                            >
                                                <Bookmark size={14} className={savedPlaces.some(p => p.id === place.id) ? 'fill-current' : ''} />
                                                {savedPlaces.some(p => p.id === place.id) ? 'Saved' : 'Save to Trip'}
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-1 line-clamp-1">{place.description}</p>
                                    {(place.distanceText || place.durationText) && (
                                        <div className="flex items-center gap-2 mt-1.5 text-[10px] font-bold text-gray-500">
                                            <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded text-gray-700 dark:text-gray-300"><Navigation size={10} className="text-brand-orange" /> {place.distanceText}</div>
                                            <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded text-gray-700 dark:text-gray-300"><Car size={10} className="text-brand-blue" /> {place.durationText}</div>
                                        </div>
                                    )}
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
                    <button onClick={() => performSearch(searchQuery || "Attractions")} className="absolute top-4 left-1/2 -translate-x-1/2 bg-brand-dark/90 backdrop-blur text-white px-4 py-2 rounded-full text-xs font-bold shadow-xl border border-white/20 flex items-center gap-2">
                        <Search size={14} /> Search This Area
                    </button>
                </div>
            )
            }

            {/* Trip Selection Modal */}
            {placeToSave && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-[#151921] rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-gray-200 dark:border-white/10 p-5 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Save {placeToSave.name} to Trip</h3>
                            <button onClick={() => setPlaceToSave(null)} className="p-2 text-gray-400 hover:text-white transition"><Trash2 size={20}/></button>
                        </div>
                        
                        {userTrips.length === 0 ? (
                            <p className="text-sm text-gray-500">You don't have any active trips. Create one in the Plans tab first!</p>
                        ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {userTrips.map(trip => (
                                    <button 
                                        key={trip.id}
                                        onClick={async () => {
                                            const newItem = { id: Date.now().toString(), type: placeToSave.category as any, label: placeToSave.name, planned: placeToSave.priceEstimate };
                                            const updatedBudget = [...(trip.budget_categories || []), newItem];
                                            const updatedPlaces = [...(trip.places || []), placeToSave];
                                            
                                            const aiNote = {
                                                id: Date.now().toString(),
                                                tripName: trip.name,
                                                city: trip.name,
                                                stateCountry: '',
                                                title: `Itinerary: ${placeToSave.name}`,
                                                content: `I've added ${placeToSave.name} to your itinerary! It's a highly-rated ${placeToSave.category.toLowerCase()} (${placeToSave.rating} stars). Expected cost is around ${placeToSave.priceDisplay}. Be sure to check it out!`,
                                                date: new Date(),
                                                isAiGenerated: true
                                            };
                                            const updatedNotes = [...(trip.notes || []), aiNote];

                                            await updateTrip(trip.id, { budget_categories: updatedBudget, places: updatedPlaces, notes: updatedNotes });
                                            setPlaceToSave(null);
                                            alert(`Added ${placeToSave.name} to ${trip.name}! Apollo also created an itinerary note for you.`);
                                        }}
                                        className="w-full text-left px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-brand-orange transition active:scale-95 text-sm font-bold dark:text-white"
                                    >
                                        {trip.name}
                                    </button>
                                ))}
                            </div>
                        )}
                        <button onClick={() => setPlaceToSave(null)} className="w-full py-3 bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white rounded-xl font-bold text-sm transition mt-2">Close</button>
                    </div>
                </div>
            )}
        </div >
    );
});
