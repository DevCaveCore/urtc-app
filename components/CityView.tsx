import React, { useState, useEffect, useRef } from 'react';
import { CloudRain, Sun, Wind, Droplets, MapPin, Star, DollarSign, Map as MapIcon, Plus, Search, Loader2, Navigation, ExternalLink, Thermometer, Car, Train, Newspaper, ChevronDown, List, Bookmark, Trash2 } from 'lucide-react';
import { Weather, Place, BudgetItem, NewsArticle, Theme } from '../types';
import { fetchRealWeather, fetchRealWeatherByCoords, fetchAirQuality, fetchTravelNews } from '../services/apiService';
import { getTransitRates } from '../services/mockService';
import { getActiveUser } from '../services/authService';
import { db } from '../services/firebaseClient';
import { collection, query, where, getDocs, setDoc, deleteDoc, doc } from 'firebase/firestore';
import { SwipeToDelete } from './SwipeToDelete';
import { fetchTrips, updateTrip } from '../services/tripService';
import { Trip } from '../types';
import { PlaceDetailSheet } from './PlaceDetailSheet';
import { SaveToTripSheet } from './SaveToTripSheet';
import { generatePlaceInsight } from '../services/geminiService';

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

// Straight-line distance between two coordinates in miles
const haversineMiles = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
    const R = 3958.8;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
};

// Rough walking time: ~20 minutes per mile
const walkMins = (miles: number): number => Math.max(1, Math.round(miles * 20));

// Nearby feed category filters
const NEARBY_FILTERS: Record<string, { emoji: string; food?: string[]; see?: string[] }> = {
    'All':     { emoji: '✨', food: ['restaurant', 'cafe', 'bakery', 'bar'], see: ['tourist_attraction', 'museum', 'park', 'art_gallery', 'amusement_park', 'zoo'] },
    'Coffee':  { emoji: '☕', food: ['cafe', 'coffee_shop', 'bakery'] },
    'Eat':     { emoji: '🍜', food: ['restaurant'] },
    'Drinks':  { emoji: '🍸', food: ['bar', 'night_club'] },
    'Parks':   { emoji: '🌳', see: ['park', 'botanical_garden', 'hiking_area'] },
    'Museums': { emoji: '🖼️', see: ['museum', 'art_gallery', 'performing_arts_theater'] },
    'Shops':   { emoji: '🛍️', see: ['shopping_mall', 'book_store', 'clothing_store', 'gift_shop'] },
};

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
    // Tapping a place opens OUR detail sheet first — reviews, photos, Apollo's
    // take — instead of ejecting straight into Google/Apple Maps.
    const [detailPlace, setDetailPlace] = useState<Place | null>(null);
    const [aiSummary, setAiSummary] = useState<string | undefined>();
    const [aiLoading, setAiLoading] = useState(false);
    const [hasInitializedLocation, setHasInitializedLocation] = useState(false);
    const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [nearbyFood, setNearbyFood] = useState<Place[]>([]);
    const [nearbyAttractions, setNearbyAttractions] = useState<Place[]>([]);
    const [isLoadingNearby, setIsLoadingNearby] = useState(false);
    const lastNearbyCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
    const nearbyReqIdRef = useRef(0);
    const userMarkerRef = useRef<any>(null);
    // Where the map should center once it's actually created (it may not exist yet
    // when geolocation resolves, since the map div only mounts on the Map tab)
    const pendingCenterRef = useRef<{ lat: number; lng: number; zoom: number } | null>(null);
    const [nearbyFilter, setNearbyFilter] = useState<string>('All');
    const [airQuality, setAirQuality] = useState<{ aqi: number; category: string } | null>(null);

    const mapRef = useRef<HTMLDivElement>(null);
    const googleMapRef = useRef<any>(null);
    const geocoderRef = useRef<any>(null);
    const placeMarkersRef = useRef<any[]>([]); // cleared per search — markers used to pile up forever

    const [travelMode, setTravelMode] = useState('DRIVING');

    useEffect(() => {
        const loadSavedPlaces = async () => {
            try {
                const user = getActiveUser();
                if (user && !user.id.startsWith('guest')) {
                    const q = query(collection(db, 'saved_places'), where('user_id', '==', user.id));
                    const snapshot = await getDocs(q);
                    const loadedPlaces: Place[] = [];
                    snapshot.forEach(doc => {
                        loadedPlaces.push(doc.data().place_data as Place);
                    });
                    setSavedPlaces(loadedPlaces);
                } else {
                    const stored = localStorage.getItem('urtc_saved_places');
                    if (stored) setSavedPlaces(JSON.parse(stored));
                }
            } catch (e) {
                console.error('Saved places failed to load:', e);
                localStorage.removeItem('urtc_saved_places'); // corrupt local data — reset
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
                await deleteDoc(doc(db, 'saved_places', `${user.id}_${place.id}`));
            }
        } else {
            newSaved = [...savedPlaces, place];
            if (user && !user.id.startsWith('guest')) {
                await setDoc(doc(db, 'saved_places', `${user.id}_${place.id}`), { user_id: user.id, place_data: place });
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
                const startCenter = pendingCenterRef.current || (userCoords ? { ...userCoords, zoom: 15 } : { lat: 33.7490, lng: -84.3880, zoom: 13 });
                googleMapRef.current = new window.google.maps.Map(mapRef.current, {
                    center: { lat: startCenter.lat, lng: startCenter.lng },
                    zoom: startCenter.zoom,
                    mapId: "DEMO_MAP_ID",
                    disableDefaultUI: true,
                });
                geocoderRef.current = new window.google.maps.Geocoder();
            } catch (e) { console.error(e); }
        }
    }, [mapRef.current, mapReady, activeTab]);

    // Fetch what's physically around the user right now (food + attractions)
    const fetchNearbyPlaces = async (coords: { lat: number; lng: number }, filterKey?: string) => {
        if (!window.google?.maps?.places?.Place?.searchNearby) return;
        const reqId = ++nearbyReqIdRef.current; // ignore stale responses from rapid filter taps
        setIsLoadingNearby(true);
        try {
            const filter = NEARBY_FILTERS[filterKey || nearbyFilter] || NEARBY_FILTERS['All'];
            const base = {
                fields: ['id', 'displayName', 'types', 'rating', 'priceLevel', 'photos', 'location', 'formattedAddress', 'googleMapsURI', 'websiteURI'],
                locationRestriction: { center: coords, radius: 1600 }, // ~1 mile walking range
                maxResultCount: 12,
                rankPreference: 'POPULARITY'
            };
            const [foodRes, attrRes] = await Promise.all([
                filter.food ? window.google.maps.places.Place.searchNearby({ ...base, includedTypes: filter.food }) : Promise.resolve({ places: [] }),
                filter.see ? window.google.maps.places.Place.searchNearby({ ...base, includedTypes: filter.see }) : Promise.resolve({ places: [] })
            ]);
            const mapPlace = (p: any, i: number, cat: 'Food' | 'Attraction'): Place & { distanceMiles?: number } => {
                const price = estimatePriceDetails(p);
                const loc = p.location;
                const lat = typeof loc?.lat === 'function' ? loc.lat() : loc?.lat;
                const lng = typeof loc?.lng === 'function' ? loc.lng() : loc?.lng;
                const miles = (lat != null && lng != null) ? haversineMiles(coords, { lat, lng }) : undefined;
                return {
                    id: p.id,
                    name: p.displayName,
                    category: cat,
                    rating: p.rating || 4.3,
                    priceLevel: price.level,
                    priceEstimate: price.estimate,
                    priceDisplay: price.display,
                    image: p.photos && p.photos.length > 0 ? p.photos[0].getURI({ maxWidth: 400 }) : `https://picsum.photos/200/200?random=${i}`,
                    coordinates: (lat != null && lng != null) ? { lat, lng } as any : { x: 0, y: 0 },
                    description: p.formattedAddress || '',
                    websiteUrl: p.googleMapsURI || p.websiteURI || `https://www.google.com/search?q=${encodeURIComponent(p.displayName)}`,
                    distanceText: miles != null ? `${miles.toFixed(1)} mi` : undefined,
                    durationText: miles != null ? `${walkMins(miles)} min walk` : undefined,
                    distanceMiles: miles
                };
            };
            if (reqId !== nearbyReqIdRef.current) return; // a newer request superseded this one
            const byDistance = (a: any, b: any) => (a.distanceMiles ?? 99) - (b.distanceMiles ?? 99);
            setNearbyFood(((foodRes?.places) || []).map((p: any, i: number) => mapPlace(p, i, 'Food')).sort(byDistance));
            setNearbyAttractions(((attrRes?.places) || []).map((p: any, i: number) => mapPlace(p, i + 20, 'Attraction')).sort(byDistance));
            lastNearbyCoordsRef.current = coords;
        } catch (e) {
            console.error('Nearby search failed', e);
        } finally {
            if (reqId === nearbyReqIdRef.current) setIsLoadingNearby(false);
        }
    };

    // Initial Location Detection — anchors weather, map, and the nearby feed to the same spot
    useEffect(() => {
        if (!mapReady || hasInitializedLocation) return;
        setHasInitializedLocation(true);

        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    const coords = { lat: latitude, lng: longitude };
                    setUserCoords(coords);
                    fetchNearbyPlaces(coords);
                    fetchAirQuality(latitude, longitude).then(setAirQuality).catch(() => {});
                    pendingCenterRef.current = { ...coords, zoom: 15 };
                    if (googleMapRef.current) {
                        googleMapRef.current.setCenter(coords);
                        googleMapRef.current.setZoom(15);
                    }
                    const geocoder = new window.google.maps.Geocoder();
                    geocoder.geocode({ location: coords }, (results: any[], status: any) => {
                        if (status === 'OK' && results[0]) {
                            const cityComp = results[0].address_components.find((c: any) => c.types.includes('locality'));
                            const stateComp = results[0].address_components.find((c: any) => c.types.includes('administrative_area_level_1'));
                            const countryComp = results[0].address_components.find((c: any) => c.types.includes('country'));
                            
                            let detectedCity = '';
                            if (cityComp) detectedCity += cityComp.long_name;
                            if (stateComp && countryComp?.short_name === 'US') detectedCity += `, ${stateComp.short_name}`;
                            else if (countryComp) detectedCity += `, ${countryComp.short_name}`;
                            
                            handleCityChange(detectedCity || initialCity, coords);
                        } else {
                            handleCityChange(initialCity, coords);
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

    // Follow the user as they walk — refresh the nearby feed after ~250m of movement
    useEffect(() => {
        if (!mapReady || !("geolocation" in navigator)) return;
        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setUserCoords(coords);
                const last = lastNearbyCoordsRef.current;
                if (last && haversineMiles(last, coords) > 0.15) {
                    fetchNearbyPlaces(coords);
                }
            },
            () => { /* silently ignore — initial detection already handled fallback */ },
            { enableHighAccuracy: false, maximumAge: 30000 }
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, [mapReady]);

    // "You are here" dot on the map
    useEffect(() => {
        if (userCoords && googleMapRef.current && window.google?.maps?.marker?.AdvancedMarkerElement) {
            if (!userMarkerRef.current) {
                const dot = document.createElement('div');
                dot.style.cssText = 'width:16px;height:16px;background:#4285F4;border:3px solid white;border-radius:50%;box-shadow:0 0 12px rgba(66,133,244,0.8)';
                userMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
                    map: googleMapRef.current,
                    position: userCoords,
                    title: 'You are here',
                    content: dot,
                    zIndex: 999
                });
                // First time we know where the user is: snap the map to them
                googleMapRef.current.setCenter(userCoords);
                googleMapRef.current.setZoom(15);
            } else {
                userMarkerRef.current.position = userCoords;
            }
        }
    }, [userCoords, mapReady, activeTab]);

    // City Autocomplete — debounced (was one Places API call per keystroke)
    // and stale-response-proof (a slow early response can't overwrite a newer one).
    useEffect(() => {
        if (!cityInput || !window.google) return;
        let cancelled = false;
        const timer = setTimeout(() => {
            const autocompleteService = new window.google.maps.places.AutocompleteService();
            autocompleteService.getPlacePredictions({ input: cityInput, types: ['(cities)'] }, (predictions: any[], status: any) => {
                if (cancelled) return;
                if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                    setCitySuggestions(predictions.map(p => p.description));
                    setShowCitySuggestions(true);
                }
            });
        }, 300);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [cityInput]);

    const handleCityChange = async (city: string, coords?: { lat: number; lng: number }) => {
        setCurrentCity(city);
        setCitySelectorOpen(false);
        setShowCitySuggestions(false);
        setCityInput(''); // Reset input after selection
        setPlaces([]); // Instantly clear old results
        if (onCityChange) onCityChange(city);
        // Track for Apollo proactive tips
        localStorage.setItem('urtc_last_city', city.split(',')[0].trim());

        // ONE anchor for the whole tab. Everything below — weather, the map,
        // the list, and the "Around You Now" rails — is resolved from these
        // coordinates, so changing the city can't leave one panel in Atlanta
        // while another is in Tokyo.
        let anchor = coords || null;
        try {
            if (!anchor) {
                // Geocode independently of the map: the map only exists once the
                // Map tab has been opened, and the list must work regardless.
                if (!geocoderRef.current && window.google?.maps?.Geocoder) {
                    geocoderRef.current = new window.google.maps.Geocoder();
                }
                if (geocoderRef.current) {
                    anchor = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
                        geocoderRef.current.geocode({ address: city }, (results: any[], status: any) => {
                            if (status === 'OK' && results?.[0]) {
                                const l = results[0].geometry.location;
                                resolve({ lat: l.lat(), lng: l.lng() });
                            } else resolve(null);
                        });
                    });
                }
            }

            if (anchor) {
                setUserCoords(anchor);
                pendingCenterRef.current = { ...anchor, zoom: 13 };
                if (googleMapRef.current) googleMapRef.current.setCenter(anchor);
            }

            // Weather from the same anchor whenever we have it
            const weatherData = anchor
                ? await fetchRealWeatherByCoords(anchor.lat, anchor.lng)
                : await fetchRealWeather(city);
            setWeather(weatherData);

            // Re-anchor the nearby rails too — they used to stay on the old city
            if (anchor) {
                fetchAirQuality(anchor.lat, anchor.lng).then(setAirQuality).catch(() => {});
                fetchNearbyPlaces(anchor);
            }

            performSearch(searchQuery || "Attractions", anchor || undefined);
        } catch (e) { /* a partial city switch is still better than none */ }
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

    // Open a place in the in-app detail sheet and ask Apollo for his take
    const openPlace = (place: Place) => {
        setDetailPlace(place);
        setAiSummary(undefined);
        setAiLoading(true);
        generatePlaceInsight(place.name, currentCity, place.category, place.rating, place.priceDisplay)
            .then(text => { setAiSummary(text || undefined); })
            .finally(() => setAiLoading(false));
    };

    const performSearch = async (query: string, locationOverride?: any) => {
        setIsSearching(true);

        // If Google Maps Places library is available
        if (window.google && window.google.maps && window.google.maps.places) {
            const center = locationOverride
                || userCoords
                || (googleMapRef.current ? googleMapRef.current.getCenter() : null);
            const fullQuery = dietaryFilter ? `${dietaryFilter} ${query}` : query;
            // With real coordinates, a radius bias finds the right places far
            // better than tacking " in <city>" onto the text — that string
            // fights the geo signal and is why searches needed exact wording.
            const request: any = center
                ? {
                    textQuery: fullQuery,
                    fields: ['id', 'displayName', 'types', 'rating', 'userRatingCount', 'priceLevel', 'photos', 'location', 'formattedAddress', 'googleMapsURI', 'websiteURI', 'regularOpeningHours'],
                    locationBias: { center, radius: 20000 },
                    isOpenNow: false,
                    maxResultCount: 20,
                }
                : {
                    textQuery: `${fullQuery} in ${currentCity}`,
                    fields: ['id', 'displayName', 'types', 'rating', 'userRatingCount', 'priceLevel', 'photos', 'location', 'formattedAddress', 'googleMapsURI', 'websiteURI', 'regularOpeningHours'],
                    maxResultCount: 20,
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

                    // Update Map Markers if map is active — clear the previous
                    // search's markers first or every search stacks more pins.
                    if (googleMapRef.current) {
                        placeMarkersRef.current.forEach((m: any) => { m.map = null; });
                        placeMarkersRef.current = places.map((p: any) =>
                            new window.google.maps.marker.AdvancedMarkerElement({
                                map: googleMapRef.current,
                                position: p.location,
                                title: p.displayName
                            })
                        );
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
                        {airQuality && (
                            <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl text-center min-w-[50px]" title={airQuality.category}>
                                <div className={`mx-auto mb-1 w-3 h-3 rounded-full ${airQuality.aqi >= 80 ? 'bg-green-400' : airQuality.aqi >= 60 ? 'bg-yellow-300' : airQuality.aqi >= 40 ? 'bg-orange-400' : 'bg-red-500'}`} />
                                <div className="font-bold text-xs">AQI {airQuality.aqi}</div>
                            </div>
                        )}
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

                {/* Required OpenWeather Attribution (must be visible where weather data is displayed) */}
                <div className="mt-2 pt-2 border-t border-white/10 text-center relative z-10">
                    <a href="https://openweathermap.org/" target="_blank" rel="noopener noreferrer" className="text-[9px] text-white/30 hover:text-white/50 transition">
                        Weather by OpenWeather
                    </a>
                </div>
            </div>

            {/* Around You Now — live nearby feed */}
            {(userCoords || nearbyFood.length > 0 || nearbyAttractions.length > 0 || isLoadingNearby) && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-orange opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-orange"></span>
                            </span>
                            Around You Now
                        </h3>
                        {isLoadingNearby && <Loader2 size={14} className="animate-spin text-brand-orange" />}
                    </div>

                    {/* Category chips */}
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {Object.entries(NEARBY_FILTERS).map(([key, f]) => (
                            <button
                                key={key}
                                onClick={() => { setNearbyFilter(key); if (userCoords) fetchNearbyPlaces(userCoords, key); }}
                                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${nearbyFilter === key
                                    ? 'bg-brand-orange text-white border-brand-orange shadow-lg shadow-brand-orange/30 scale-105'
                                    : 'bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:border-brand-orange/40'}`}
                            >
                                {f.emoji} {key}
                            </button>
                        ))}
                    </div>

                    {/* Closest Gem — best nearby pick, big card */}
                    {(() => {
                        const all = [...nearbyFood, ...nearbyAttractions].filter(p => p.distanceText);
                        if (all.length === 0) return null;
                        const score = (p: any) => (p.rating || 4) - parseFloat(p.distanceText || '9') * 1.5;
                        const gem = all.reduce((a, b) => (score(b) > score(a) ? b : a));
                        return (
                            <button
                                onClick={() => openPlace(gem)}
                                className="relative block w-full h-44 rounded-3xl overflow-hidden group shadow-xl border border-black/5 dark:border-white/10 text-left press press-card"
                            >
                                <img src={gem.image} alt={gem.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/10" />
                                <div className="absolute top-3 left-3 bg-brand-orange text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-lg">
                                    ✦ Closest Gem
                                </div>
                                <div className="absolute top-3 right-3 bg-black/50 backdrop-blur px-2 py-0.5 rounded-full text-[11px] font-bold text-white flex items-center gap-1">
                                    <Star size={10} className="text-yellow-400 fill-yellow-400" /> {Number(gem.rating).toFixed(1)}
                                </div>
                                <div className="absolute bottom-0 inset-x-0 p-4">
                                    <div className="text-white font-black text-xl leading-tight line-clamp-1">{gem.name}</div>
                                    <div className="text-[11px] text-white/90 mt-1.5 flex items-center gap-3 font-bold">
                                        <span className="text-green-400">{gem.priceDisplay}</span>
                                        {gem.durationText && <span className="flex items-center gap-1"><Navigation size={10} /> {gem.durationText}</span>}
                                        <span className="opacity-70">{gem.category}</span>
                                    </div>
                                </div>
                            </button>
                        );
                    })()}

                    {nearbyFood.length > 0 && (
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-1 mb-2">{nearbyFilter === 'All' ? 'Grab a Bite' : `${NEARBY_FILTERS[nearbyFilter]?.emoji} ${nearbyFilter} Near You`}</div>
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">
                                {nearbyFood.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => openPlace(p)}
                                        className="relative min-w-[160px] w-40 h-52 rounded-3xl overflow-hidden snap-start shrink-0 group shadow-lg border border-black/5 dark:border-white/10 text-left press press-card"
                                    >
                                        <img src={p.image} alt={p.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
                                        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur px-2 py-0.5 rounded-full text-[10px] font-bold text-white flex items-center gap-1">
                                            <Star size={9} className="text-yellow-400 fill-yellow-400" /> {Number(p.rating).toFixed(1)}
                                        </div>
                                        <button
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSavePlace(p); }}
                                            className="absolute top-2 left-2 bg-black/50 backdrop-blur p-1.5 rounded-full text-white hover:bg-brand-orange transition"
                                            title="Save place"
                                        >
                                            <Bookmark size={11} className={savedPlaces.some(sp => sp.id === p.id) ? 'fill-brand-orange text-brand-orange' : ''} />
                                        </button>
                                        <div className="absolute bottom-0 inset-x-0 p-3">
                                            <div className="text-white font-bold text-sm leading-tight line-clamp-2">{p.name}</div>
                                            <div className="text-[10px] text-white/90 mt-1.5 flex items-center gap-2 font-bold">
                                                <span className="text-green-400">{p.priceDisplay}</span>
                                                {p.durationText && <span className="flex items-center gap-1"><Navigation size={9} /> {p.durationText}</span>}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {!isLoadingNearby && nearbyFood.length === 0 && nearbyAttractions.length === 0 && (
                        <div className="text-center py-6 bg-gray-50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
                            <p className="text-sm text-gray-500">Nothing within a mile for this filter.</p>
                            <button onClick={() => { setNearbyFilter('All'); if (userCoords) fetchNearbyPlaces(userCoords, 'All'); }} className="mt-2 text-xs font-bold text-brand-orange hover:underline">Show everything nearby</button>
                        </div>
                    )}

                    {nearbyAttractions.length > 0 && (
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-1 mb-2">{nearbyFilter === 'All' ? 'Things to See' : `${NEARBY_FILTERS[nearbyFilter]?.emoji} ${nearbyFilter} Near You`}</div>
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">
                                {nearbyAttractions.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => openPlace(p)}
                                        className="relative min-w-[160px] w-40 h-52 rounded-3xl overflow-hidden snap-start shrink-0 group shadow-lg border border-black/5 dark:border-white/10 text-left press press-card"
                                    >
                                        <img src={p.image} alt={p.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
                                        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur px-2 py-0.5 rounded-full text-[10px] font-bold text-white flex items-center gap-1">
                                            <Star size={9} className="text-yellow-400 fill-yellow-400" /> {Number(p.rating).toFixed(1)}
                                        </div>
                                        <button
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSavePlace(p); }}
                                            className="absolute top-2 left-2 bg-black/50 backdrop-blur p-1.5 rounded-full text-white hover:bg-brand-orange transition"
                                            title="Save place"
                                        >
                                            <Bookmark size={11} className={savedPlaces.some(sp => sp.id === p.id) ? 'fill-brand-orange text-brand-orange' : ''} />
                                        </button>
                                        <div className="absolute bottom-0 inset-x-0 p-3">
                                            <div className="text-white font-bold text-sm leading-tight line-clamp-2">{p.name}</div>
                                            <div className="text-[10px] text-white/90 mt-1.5 flex items-center gap-2 font-bold">
                                                <span className="text-green-400">{p.priceDisplay}</span>
                                                {p.durationText && <span className="flex items-center gap-1"><Navigation size={9} /> {p.durationText}</span>}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

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
                        <div
                            key={place.id}
                            onClick={() => openPlace(place)}
                            className="bg-white dark:bg-[#151921] p-3 rounded-2xl border border-gray-200 dark:border-white/5 flex gap-4 group hover:border-brand-orange/30 transition shadow-sm relative overflow-hidden cursor-pointer press press-card"
                        >
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
                                                onClick={(e) => {
                                                    e.stopPropagation();
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
                                    <span className="text-xs font-bold text-brand-blue flex items-center gap-1">
                                        Details <ChevronDown size={11} className="-rotate-90" />
                                    </span>
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
                            <div onClick={() => openPlace(place)} className="bg-white dark:bg-[#151921] p-3 rounded-2xl border border-brand-orange/30 flex gap-4 group shadow-sm relative overflow-hidden cursor-pointer press press-card">
                                <div className="w-24 h-24 rounded-xl bg-gray-200 dark:bg-gray-800 shrink-0 overflow-hidden relative">
                                    <img src={place.image} alt={place.name} className="w-full h-full object-cover" />
                                    <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white flex items-center gap-1"><Star size={8} className="text-brand-orange fill-current" /> {place.rating}</div>
                                </div>
                                <div className="flex-1 flex flex-col justify-between py-1">
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <h4 className="text-gray-900 dark:text-white font-bold text-lg leading-tight">{place.name}</h4>
                                            <button onClick={(e) => { e.stopPropagation(); toggleSavePlace(place); }} className="p-2 bg-red-500/10 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition shrink-0 active:scale-95"><Trash2 size={16} /></button>
                                        </div>
                                        <p className="text-gray-500 dark:text-gray-400 text-xs mt-1 line-clamp-1">{place.description}</p>
                                    </div>
                                    <div className="flex justify-between items-center border-t border-gray-200 dark:border-white/5 pt-2 mt-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white px-1.5 py-0.5 rounded">
                                                {Array(place.priceLevel).fill('$').join('')}
                                            </span>
                                        </div>
                                        <span className="text-xs font-bold text-brand-blue flex items-center gap-1">
                                            Details <ChevronDown size={11} className="-rotate-90" />
                                        </span>
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
                    {/* Snap back to the user's real position */}
                    <button
                        onClick={() => {
                            if (!googleMapRef.current) return;
                            if (userCoords) {
                                googleMapRef.current.setCenter(userCoords);
                                googleMapRef.current.setZoom(15);
                            } else if ("geolocation" in navigator) {
                                navigator.geolocation.getCurrentPosition((pos) => {
                                    const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                                    setUserCoords(coords);
                                    googleMapRef.current.setCenter(coords);
                                    googleMapRef.current.setZoom(15);
                                });
                            }
                        }}
                        title="Center on my location"
                        className="absolute bottom-4 right-4 bg-white text-[#4285F4] p-3 rounded-full shadow-xl border border-gray-200 hover:scale-110 active:scale-95 transition-transform"
                    >
                        <Navigation size={18} className="fill-[#4285F4]" />
                    </button>
                </div>
            )}

            {/* ── Exclusive Partner Deals & Ad Space ── */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-white/10 space-y-4 px-2">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-display text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Star size={15} className="text-brand-orange" /> Exclusive Partner Deals
                    </h2>
                </div>
                <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
                    <a
                        href="https://hub.stay22.com/referral/cavecoredynamics/travel"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 w-64 rounded-2xl overflow-hidden relative group shadow-lg shadow-black/20 press block"
                    >
                        <img
                            src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=300&fit=crop"
                            alt="Hotels"
                            className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                        <div className="absolute top-2 left-2 bg-brand-orange text-white text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                            Stay22
                        </div>
                        <div className="absolute bottom-3 left-3 right-3 text-left">
                            <p className="font-display font-bold text-white text-sm leading-tight">Book the Best Hotels</p>
                            <p className="text-white/60 text-[10px] mt-0.5 flex items-center gap-1">Get up to 20% off stays <ExternalLink size={10}/></p>
                        </div>
                    </a>

                    <a
                        href="https://www.discovercars.com/?a_aid=CaveCoreDynamics"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 w-64 rounded-2xl overflow-hidden relative group shadow-lg shadow-black/20 press block"
                    >
                        <img
                            src="https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=600&h=300&fit=crop"
                            alt="Rental Cars"
                            className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                        <div className="absolute top-2 left-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                            DiscoverCars
                        </div>
                        <div className="absolute bottom-3 left-3 right-3 text-left">
                            <p className="font-display font-bold text-white text-sm leading-tight">Rent a Car Anywhere</p>
                            <p className="text-white/60 text-[10px] mt-0.5 flex items-center gap-1">Compare prices & save <ExternalLink size={10}/></p>
                        </div>
                    </a>
                </div>

                {/* ── Ad Space Placeholder (Silver & Dev Only) ── */}
                {getActiveUser() && (getActiveUser()?.tier === 'Silver' || getActiveUser()?.tier === 'Dev') && (
                    <div className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both border border-dashed border-gray-400 dark:border-white/20 bg-gray-100 dark:bg-white/5 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[100px] relative overflow-hidden text-center">
                        <div className="text-gray-500 dark:text-white/40 text-[10px] font-mono tracking-widest uppercase mb-1">Advertisement Space</div>
                        <p className="text-gray-700 dark:text-white/60 text-xs font-medium">Unskippable 15s Video Ad goes here</p>
                        {getActiveUser()?.tier === 'Dev' && (
                            <div className="absolute top-2 right-2 bg-amber-500/20 text-amber-500 dark:text-amber-400 text-[9px] font-mono px-2 py-0.5 rounded border border-amber-500/30">
                                DEV PREVIEW
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Rich place detail — reviews, photos, Apollo's take — before Maps */}
            <PlaceDetailSheet
                place={detailPlace}
                onClose={() => setDetailPlace(null)}
                aiSummary={aiSummary}
                aiLoading={aiLoading}
                onSaveToTrip={(p) => { setDetailPlace(null); setPlaceToSave(p); }}
            />

            {/* Save to a trip — and create one right here if none exists */}
            <SaveToTripSheet
                itemLabel={placeToSave?.name || null}
                kind="place"
                userId={getActiveUser()?.id || 'guest'}
                suggestedTripName={currentCity ? `${currentCity.split(',')[0]} Trip` : undefined}
                onClose={() => setPlaceToSave(null)}
                onPick={async (trip) => {
                    if (!placeToSave) return;
                    const newItem = { id: Date.now().toString(), type: placeToSave.category as any, label: placeToSave.name, planned: placeToSave.priceEstimate };
                    const aiNote = {
                        id: `note-${Date.now()}`,
                        tripName: trip.name,
                        city: currentCity,
                        stateCountry: '',
                        title: `Saved: ${placeToSave.name}`,
                        content: `${placeToSave.name} — a ${placeToSave.category.toLowerCase()} rated ${placeToSave.rating} stars, around ${placeToSave.priceDisplay}. ${placeToSave.description || ''}`,
                        date: new Date(),
                        isAiGenerated: true,
                    };
                    await updateTrip(trip.id, {
                        budget_categories: [...(trip.budget_categories || []), newItem] as any,
                        places: [...(trip.places || []), placeToSave] as any,
                        notes: [...(trip.notes || []), aiNote] as any,
                    });
                    try { window.dispatchEvent(new CustomEvent('urtc-trips-changed')); } catch { /* ignore */ }
                }}
            />
        </div >
    );
});
