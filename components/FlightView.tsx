import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plane, Clock, AlertTriangle, Loader2, X, ArrowRight, ArrowLeftRight, ExternalLink, MapPin, Calendar, Search, Radar, Globe, CheckCircle, Navigation, Gauge, Hash, LayoutGrid, PlusCircle, Info, Bell, Lock, Share2 } from 'lucide-react';
import { Flight, FlightStatus, BudgetItem, UserTier, FlightSchedule, AirportConditions, UserAccount, Trip, ForesightPrediction, FlightRoute } from '../types';
import { fetchRealFlights, fetchFlightTrack, fetchSchedules, fetchAirportConditions, fetchRandomFlight, fetchFleetFlights, fetchForesightFlight, fetchForesightPosition, fetchFlightPosition, fetchFlightRoute, fetchFlightMapImage, searchFlightsInArea, searchFlightsAdvanced, searchFlightCount, fetchAirportInfo, fetchAirportFlightCounts, fetchAirportForecast, fetchNearbyAirports, fetchNearbyAirportsByLocation, fetchRouteStats, fetchGlobalDelays, fetchOperatorInfo, fetchOperatorFlightCounts, fetchOperatorEnrouteFlights, fetchOperatorScheduledFlights, fetchHistoricalFlight, fetchHistoricalTrack, fetchHistoricalMapImage, fetchLastFlightByTailNumber, fetchAircraftOwner, fetchAircraftType, fetchDisruptionCounts, fetchFutureSchedules, fetchAlerts, createAlert, fetchAlert, updateAlert, deleteAlert, fetchAlertEndpoint, setAlertEndpoint, deleteAlertEndpoint, fetchAeroApiUsage } from '../services/apiService';
import { fetchTrips, addFlightToTrip } from '../services/tripService';
import { getAirportSuggestions, getAirportCoords, getAirlineSuggestions, resolveAirportCode } from '../services/mockService';
import { getStatsForNerds, hasDiamondAccess, trialDaysLeft } from '../services/authService';
import { CalendarPicker } from './CalendarPicker';
import { FlightAlertsModal } from './FlightAlertsModal';

// Common airline name/code mappings (IATA + names -> ICAO)
const AIRLINE_MAP: Record<string, string> = {
    'DELTA': 'DAL', 'DL': 'DAL', 'AMERICAN': 'AAL', 'AA': 'AAL',
    'UNITED': 'UAL', 'UA': 'UAL', 'SOUTHWEST': 'SWA', 'WN': 'SWA',
    'JETBLUE': 'JBU', 'B6': 'JBU', 'ALASKA': 'ASA', 'AS': 'ASA',
    'FRONTIER': 'FFT', 'F9': 'FFT', 'SPIRIT': 'NKS', 'NK': 'NKS',
    'HAWAIIAN': 'HAL', 'HA': 'HAL', 'ALLEGIANT': 'AAY', 'G4': 'AAY',
    'BRITISH': 'BAW', 'BA': 'BAW', 'LUFTHANSA': 'DLH', 'LH': 'DLH',
    'AIR FRANCE': 'AFR', 'AF': 'AFR', 'EMIRATES': 'UAE', 'EK': 'UAE',
    'QATAR': 'QTR', 'QR': 'QTR', 'TURKISH': 'THY', 'TK': 'THY',
    'SINGAPORE': 'SIA', 'SQ': 'SIA', 'CATHAY': 'CPA', 'CX': 'CPA',
    'ANA': 'ANA', 'NH': 'ANA', 'JAL': 'JAL', 'JL': 'JAL',
    'KOREAN': 'KAL', 'KE': 'KAL', 'QANTAS': 'QFA', 'QF': 'QFA',
    'RYANAIR': 'RYR', 'FR': 'RYR', 'EASYJET': 'EZY', 'U2': 'EZY',
};

// Set of known airline ICAO codes for fleet detection
const AIRLINE_ICAO_SET = new Set(Object.values(AIRLINE_MAP));

// Natural language flight number parser
const parseFlightNumber = (input: string): string => {
    const cleaned = input.trim().toUpperCase();
    // Match "Delta 1182", "DL 1182", "DL1182"
    const match = cleaned.match(/^([A-Z\s]+?)\s*(\d+)$/);
    if (match) {
        const airlineText = match[1].trim();
        const flightNum = match[2];
        const icaoCode = AIRLINE_MAP[airlineText];
        if (icaoCode) return `${icaoCode}${flightNum}`;
    }
    return cleaned;
};

// Turn raw feed status + delay data into words a passenger actually wants:
// "Delayed +45m", "Rescheduled", "Cancelled" — not vague codes.
const getDisplayStatus = (f: Flight): string => {
    const s = (f.status || '').toString().toLowerCase();
    if (s.includes('cancel')) return 'Cancelled';
    if (s.includes('divert')) return 'Diverted';
    const delay = f.delayMinutes || 0;
    if (!f.actualDepartureTime && delay >= 180) return 'Rescheduled';
    if (delay >= 15) return `Delayed +${delay < 60 ? `${delay}m` : `${Math.floor(delay / 60)}h ${delay % 60}m`}`;
    if (s.includes('delay')) return 'Delayed';
    if (s.includes('en route') || s.includes('airborne') || s.includes('enroute')) return 'En Route';
    if (s.includes('arrived') || s.includes('landed') || s.includes('gate arrival')) return 'Landed';
    if (s.includes('taxi')) return 'Taxiing';
    if (f.actualDepartureTime) return 'Departed';
    if (s.includes('scheduled') || s === '') return 'On Time';
    return f.status as unknown as string;
};

const isKnownAirport = (code: string): boolean => {
    const c = getAirportCoords(code);
    return c.lat !== 0 || c.lng !== 0;
};

export type SmartSearchResult =
    | { type: 'empty' }
    | { type: 'route'; origin: string; dest: string }
    | { type: 'airport'; code: string; altFleet?: string }
    | { type: 'fleet'; opCode: string; altAirport?: string }
    | { type: 'tail'; tail: string }
    | { type: 'flight'; flight: string };

// Smart Omni-Search parser: one box understands flights, airports, routes, airlines, tails
const parseSmartSearch = (input: string): SmartSearchResult => {
    const cleaned = input.trim().toUpperCase();
    if (!cleaned) return { type: 'empty' };

    // Route (e.g. ATL JFK, ATL-JFK, ATL TO JFK, KATL TO KJFK)
    const routeMatch = cleaned.match(/^([A-Z]{3,4})\s*(?:TO|->)\s*([A-Z]{3,4})$/)
        || cleaned.match(/^([A-Z]{3,4})\s*-\s*([A-Z]{3,4})$/)
        || cleaned.match(/^([A-Z]{3,4})\s+([A-Z]{3,4})$/);
    if (routeMatch && !AIRLINE_MAP[cleaned]) {
        return { type: 'route', origin: routeMatch[1], dest: routeMatch[2] };
    }

    // Tail Number (N-number or international registration like C-FABC, G-ABCD)
    const tailMatch = cleaned.match(/^(N\d[0-9A-Z]{1,4}|[A-Z]{1,2}-[A-Z0-9]{3,5})$/);
    if (tailMatch) return { type: 'tail', tail: tailMatch[0] };

    // Bare 3-letter code: could be an airport (IATA) or an airline (ICAO)
    if (/^[A-Z]{3}$/.test(cleaned)) {
        const isAirline = AIRLINE_ICAO_SET.has(cleaned);
        const isAirport = isKnownAirport(cleaned);
        if (isAirline && !isAirport) return { type: 'fleet', opCode: cleaned };
        if (isAirport && isAirline) return { type: 'airport', code: cleaned, altFleet: cleaned };
        if (isAirport) return { type: 'airport', code: cleaned };
        if (isAirline) return { type: 'fleet', opCode: cleaned };
        return { type: 'airport', code: cleaned }; // default: let AeroAPI resolve it
    }

    // 4-letter code with no digits: ICAO airport (KJFK, EGLL)
    if (/^[A-Z]{4}$/.test(cleaned)) return { type: 'airport', code: cleaned };

    // Airline name or IATA code without a number ("DELTA", "DL") -> fleet
    if (AIRLINE_MAP[cleaned]) return { type: 'fleet', opCode: AIRLINE_MAP[cleaned] };

    // Otherwise, assume Flight Number
    return { type: 'flight', flight: parseFlightNumber(cleaned) };
};

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
    const [dateExplicit, setDateExplicit] = useState(false); // dates are optional — auto mode by default
    const [returnDate, setReturnDate] = useState<string>('');
    const [airlineFilter, setAirlineFilter] = useState('ALL');
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
    const [foresightData, setForesightData] = useState<ForesightPrediction | null>(null);
    const [flightRoute, setFlightRoute] = useState<FlightRoute | null>(null);
    const [radarMapUrl, setRadarMapUrl] = useState<string | null>(null);
    const [showAirportModal, setShowAirportModal] = useState(false);
    const [airportFullInfo, setAirportFullInfo] = useState<any>(null);
    const [operatorInfo, setOperatorInfo] = useState<any>(null);
    const [operatorCounts, setOperatorCounts] = useState<any>(null);
    const [aircraftOwnerInfo, setAircraftOwnerInfo] = useState<any>(null);
    const [aircraftTypeInfo, setAircraftTypeInfo] = useState<any>(null);
    const [disruptionBadge, setDisruptionBadge] = useState<any>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [activeInput, setActiveInput] = useState<'origin' | 'dest' | 'query' | null>(null);
    const [schedules, setSchedules] = useState<FlightSchedule[]>([]);
    const [airportInfo, setAirportInfo] = useState<AirportConditions | null>(null);
    const [viewMode, setViewMode] = useState<'live' | 'schedule'>('live');
    const [searchMode, setSearchMode] = useState<'flight' | 'airport' | 'fleet' | 'tail'>('flight');
    const [isStatsNerd, setIsStatsNerd] = useState(false);
    const [showCalendar, setShowCalendar] = useState(false);
    const [altSuggestion, setAltSuggestion] = useState<{ label: string; query: string } | null>(null);
    const [showUpgradeNudge, setShowUpgradeNudge] = useState<string | null>(null);
    const isPro = hasDiamondAccess(user);
    const trialDays = trialDaysLeft(user);
    const [showAlertsModal, setShowAlertsModal] = useState(false);

    useEffect(() => {
        setIsStatsNerd(getStatsForNerds());
    }, []);


    // Concierge context: remember the flight being viewed so Apollo can talk about it
    useEffect(() => {
        if (!selectedFlight) return;
        try {
            localStorage.setItem('urtc_last_flight_context', JSON.stringify({
                flight: selectedFlight.flightNumber,
                route: `${selectedFlight.departureAirport} to ${selectedFlight.arrivalAirport}`,
                status: getDisplayStatus(selectedFlight),
                scheduled_departure: selectedFlight.departureTime,
                estimated_departure: selectedFlight.estimatedDepartureTime,
                scheduled_arrival: selectedFlight.arrivalTime,
                estimated_arrival: selectedFlight.estimatedArrivalTime,
                gate: selectedFlight.gate, terminal: selectedFlight.terminal,
                arrival_gate: selectedFlight.gateDestination,
                delay_minutes: selectedFlight.delayMinutes || 0,
                viewed_at: new Date().toISOString()
            }));
        } catch (e) { /* storage full — non-critical */ }
    }, [selectedFlight]);

    const mapRef = useRef<HTMLDivElement>(null);
    const googleMapRef = useRef<any>(null);
    const flightPathRef = useRef<any>(null);
    const planeMarkerRef = useRef<any>(null);
    const fleetMarkersRef = useRef<any[]>([]);
    const lastFitFlightIdRef = useRef<string | null>(null);
    const map3dRef = useRef<any>(null);           // photorealistic Map3DElement
    const maps3dLibRef = useRef<any>(null);       // cached maps3d library
    const activeRendererRef = useRef<'2d' | '3d' | null>(null);
    const [use3D, setUse3D] = useState(true);
    // null = not yet attempted, false = library unavailable (key/browser), true = working
    const [map3dSupported, setMap3dSupported] = useState<boolean | null>(null);

    // A newly selected flight must never show the previous flight's details
    // while its own are still loading.
    useEffect(() => {
        setForesightData(null);
        setFlightRoute(null);
        setAircraftOwnerInfo(null);
        setAircraftTypeInfo(null);
        setDisruptionBadge(null);
    }, [selectedFlight?.id]);


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
                // Omni search: suggest both airports and airlines
                setSuggestions([...getAirportSuggestions(query), ...getAirlineSuggestions(query)].slice(0, 6));
            } else {
                setSuggestions(getAirportSuggestions(query));
            }
        } else {
            setSuggestions([]);
        }
    }, [debouncedOrigin, debouncedDest, debouncedQuery, activeInput]);

    useEffect(() => {
        if (!(selectedFlight && mapRef.current && window.google)) return;
        const container = mapRef.current;
        let cancelled = false;

        // (0,0) is our "airport not found" sentinel — drawing it anchors the
        // path in the Gulf of Guinea, so treat it (and any non-finite value)
        // as missing and leave that point off the map entirely.
        const hasCoords = (p: { lat: number; lng: number } | null | undefined): p is { lat: number; lng: number } =>
            !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0);

        // The feed reports altitude in hundreds of feet; the 3D globe wants meters.
        const altMeters = (a: any): number => (typeof a === 'number' && a > 0 ? a * 100 * 0.3048 : 0);

        const origin = getAirportCoords(selectedFlight.departureAirport);
        const dest = getAirportCoords(selectedFlight.arrivalAirport);

        const distMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
            window.google.maps.geometry.spherical.computeDistanceBetween(
                new window.google.maps.LatLng(a.lat, a.lng),
                new window.google.maps.LatLng(b.lat, b.lng)
            );

        // Photorealistic 3D (Google Earth) support — loaded on demand, cached.
        const ensureMaps3d = async (): Promise<any | null> => {
            if (maps3dLibRef.current) return maps3dLibRef.current;
            try {
                const lib = await window.google.maps.importLibrary?.('maps3d');
                if (lib?.Map3DElement) {
                    maps3dLibRef.current = lib;
                    setMap3dSupported(true);
                    return lib;
                }
            } catch (e) { /* library not enabled for this key / unsupported browser */ }
            setMap3dSupported(false);
            return null;
        };

        // Fetch everything the card and map need; returns the drawable path.
        const loadTrackData = async () => {
            type Pt = { lat: number; lng: number; altitude?: number };
            let path: Pt[] = [origin, dest].filter(hasCoords);
            let posRes: any = null;
            try {
                // Try fetchForesightFlight first for predictions
                const foresightDataRes = await fetchForesightFlight(selectedFlight.id);
                if (foresightDataRes && foresightDataRes.foresight && foresightDataRes.foresight.predicted_out) {
                    setForesightData(foresightDataRes.foresight);
                } else {
                    // Fallback to fetchForesightPosition if flight doesn't support full foresight flight endpoint
                    const foresightRes = await fetchForesightPosition(selectedFlight.id);
                    if (foresightRes && foresightRes.foresight && foresightRes.foresight.predicted_out) {
                        setForesightData(foresightRes.foresight);
                    } else {
                        setForesightData(null);
                    }
                }

                const route = await fetchFlightRoute(selectedFlight.id);
                setFlightRoute(route);

                posRes = await fetchFlightPosition(selectedFlight.id);

                if (selectedFlight.tailNumber || selectedFlight.aircraft) {
                    try {
                        const [owner, type, disruptions] = await Promise.all([
                            selectedFlight.tailNumber ? fetchAircraftOwner(selectedFlight.tailNumber) : Promise.resolve(null),
                            selectedFlight.aircraft ? fetchAircraftType(selectedFlight.aircraft) : Promise.resolve(null),
                            fetchDisruptionCounts("airport", selectedFlight.departureAirport)
                        ]);
                        setAircraftOwnerInfo(owner);
                        setAircraftTypeInfo(type);
                        setDisruptionBadge(disruptions);
                    } catch(e) { console.error(e); }
                }

                // Route fixes and track points can carry null coordinates —
                // keep only real positions or the polyline detours to (0,0).
                const validPoints = (pts: any[]): Pt[] => pts
                    .map((p: any) => ({ lat: p.latitude, lng: p.longitude, altitude: altMeters(p.altitude) }))
                    .filter(hasCoords);

                let waypoints: Pt[] = [];
                if (route && route.fixes && route.fixes.length > 0) {
                    waypoints = validPoints(route.fixes);
                }
                if (waypoints.length === 0) {
                    const track = await fetchFlightTrack(selectedFlight.id);
                    if (track && track.length > 0) waypoints = validPoints(track);
                }
                if (waypoints.length > 0) {
                    path = [
                        ...(hasCoords(origin) ? [origin] : []),
                        ...waypoints,
                        ...(hasCoords(dest) ? [dest] : []),
                    ];
                }
            } catch (e) { /* fall through with the straight-line path */ }
            return { path, posRes };
        };

        const render2D = (path: { lat: number; lng: number }[], posRes: any, fit: boolean) => {
            // The map div is remounted per card (and wiped by 3D mode), so rebuild
            // whenever the existing instance isn't attached to this container.
            if (!googleMapRef.current || googleMapRef.current.getDiv() !== container || activeRendererRef.current !== '2d') {
                container.innerHTML = '';
                googleMapRef.current = new window.google.maps.Map(container, {
                    center: { lat: 30, lng: -40 },
                    zoom: 3,
                    disableDefaultUI: true,
                    gestureHandling: 'greedy',
                    backgroundColor: '#17263c',
                    styles: [
                        { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                        { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                        { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
                        { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
                    ]
                });
                flightPathRef.current = null;
                planeMarkerRef.current = null;
                activeRendererRef.current = '2d';
                fit = true;
            }

            if (flightPathRef.current) flightPathRef.current.setMap(null);
            flightPathRef.current = new window.google.maps.Polyline({
                path,
                geodesic: true,
                strokeColor: '#FF6B35',
                strokeOpacity: 1.0,
                strokeWeight: 3,
                map: googleMapRef.current
            });

            if (planeMarkerRef.current) planeMarkerRef.current.setMap(null);
            if (posRes) {
                planeMarkerRef.current = new window.google.maps.Marker({
                    position: { lat: posRes.latitude, lng: posRes.longitude },
                    map: googleMapRef.current,
                    icon: {
                        path: 'M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z',
                        fillColor: '#3B82F6',
                        fillOpacity: 1,
                        strokeWeight: 1,
                        strokeColor: '#FFFFFF',
                        scale: 1.2,
                        rotation: posRes.heading || 0,
                        anchor: new window.google.maps.Point(12, 12)
                    },
                    title: selectedFlight.ident
                });
            }

            if (fit) {
                const bounds = new window.google.maps.LatLngBounds();
                path.forEach(p => bounds.extend(p));
                if (posRes) bounds.extend({ lat: posRes.latitude, lng: posRes.longitude });
                if (!bounds.isEmpty()) googleMapRef.current.fitBounds(bounds, 40);
            }
        };

        const render3D = (lib: any, path: { lat: number; lng: number; altitude?: number }[], posRes: any, fit: boolean) => {
            // Give cruise segments a graceful arc when the feed has no altitude
            // (filed route fixes) — peak scales with route length, in meters.
            let total = 0;
            const cum = path.map((p, i) => {
                if (i > 0) total += distMeters(path[i - 1], path[i]);
                return total;
            });
            const peak = Math.min(11500, Math.max(2500, total * 0.05));
            const path3d = path.map((p, i) => {
                const t = total > 0 ? cum[i] / total : 0;
                return { lat: p.lat, lng: p.lng, altitude: p.altitude && p.altitude > 0 ? p.altitude : peak * 4 * t * (1 - t) };
            });

            if (!map3dRef.current || map3dRef.current.parentElement !== container || activeRendererRef.current !== '3d') {
                container.innerHTML = '';
                const el = new lib.Map3DElement({
                    center: { lat: path3d[0]?.lat ?? 30, lng: path3d[0]?.lng ?? -40, altitude: 0 },
                    range: 15_000_000, // start from space, then fly in
                    tilt: 15,
                    mode: lib.MapMode?.HYBRID ?? 'HYBRID',
                });
                el.style.width = '100%';
                el.style.height = '100%';
                container.appendChild(el);
                map3dRef.current = el;
                googleMapRef.current = null; // its DOM was just wiped
                activeRendererRef.current = '3d';
                fit = true;
            }

            const el = map3dRef.current;
            el.querySelectorAll('gmp-polyline-3d, gmp-marker-3d, gmp-model-3d').forEach((n: Element) => n.remove());

            const ABSOLUTE = lib.AltitudeMode?.ABSOLUTE ?? 'ABSOLUTE';
            if (path3d.length >= 2) {
                el.append(new lib.Polyline3DElement({
                    coordinates: path3d,
                    strokeColor: '#FF6B35',
                    strokeWidth: 6,
                    altitudeMode: ABSOLUTE,
                    geodesic: true,
                    drawsOccludedSegments: true,
                }));
            }
            if (posRes && hasCoords({ lat: posRes.latitude, lng: posRes.longitude })) {
                const alt = altMeters(posRes.altitude);
                const posMode = alt > 0 ? ABSOLUTE : (lib.AltitudeMode?.CLAMP_TO_GROUND ?? 'CLAMP_TO_GROUND');
                if (lib.Model3DElement) {
                    // An actual airplane at the live position. Real-world size would be
                    // an invisible dot at route-framing distance, so scale with route
                    // length. The model's axes need tilt 270 to sit level with the
                    // nose on the heading.
                    const scale = Math.min(4000, Math.max(80, (total || 400_000) / 900));
                    // Cesium_Air sample aircraft (Apache-2.0, from the CesiumJS repo),
                    // self-hosted so it works offline and inside Capacitor.
                    el.append(new lib.Model3DElement({
                        src: '/plane.glb',
                        position: { lat: posRes.latitude, lng: posRes.longitude, altitude: alt },
                        altitudeMode: posMode,
                        orientation: { heading: posRes.heading ?? 0, tilt: 270, roll: 0 },
                        scale,
                    }));
                } else {
                    el.append(new lib.Marker3DElement({
                        position: { lat: posRes.latitude, lng: posRes.longitude, altitude: alt },
                        altitudeMode: posMode,
                        extruded: alt > 0,
                        label: selectedFlight.ident,
                    }));
                }
            }

            if (fit && path3d.length > 0) {
                // Frame the route (or hover near the plane) with a cinematic fly-in
                const focus = posRes
                    ? { lat: posRes.latitude, lng: posRes.longitude }
                    : path3d[Math.floor(path3d.length / 2)];
                const span = hasCoords(origin) && hasCoords(dest) ? distMeters(origin, dest) : total;
                const range = Math.min(9_000_000, Math.max(80_000, span * 1.7));
                el.flyCameraTo({
                    endCamera: { center: { ...focus, altitude: 0 }, tilt: 55, heading: 0, range },
                    durationMillis: 2500,
                });
            }
        };

        const run = async (fit: boolean) => {
            const lib = use3D ? await ensureMaps3d() : null;
            if (cancelled || !container.isConnected) return;
            const { path, posRes } = await loadTrackData();
            if (cancelled || !container.isConnected) return;
            if (lib && use3D) render3D(lib, path, posRes, fit);
            else render2D(path, posRes, fit);
        };

        // Only re-fit the camera when a different flight is selected — background
        // data refreshes of the same flight shouldn't yank the user's view.
        run(lastFitFlightIdRef.current !== selectedFlight.id);
        lastFitFlightIdRef.current = selectedFlight.id;

        // Poll every 10 seconds for live track updates. Timestamps are the
        // reliable in-flight signal; status strings vary ("Taxiing", etc.).
        const inFlight = !!selectedFlight.actualDepartureTime && !selectedFlight.actualArrivalTime;
        const timer = setInterval(() => {
            const s = selectedFlight.status.toLowerCase();
            if (inFlight || s.includes('en route') || s.includes('taxi') || s.includes('boarding')) {
                run(false);
            }
        }, 10000);
        return () => { cancelled = true; clearInterval(timer); };
    }, [selectedFlight, use3D]);

    // Keep the selected flight's card accurate: refetch its live data every 60s
    // until it has landed or been cancelled, and swap in the fresh record only
    // when something the passenger can see actually changed.
    useEffect(() => {
        if (!selectedFlight) return;
        const done = !!selectedFlight.actualArrivalTime || (selectedFlight.status || '').toLowerCase().includes('cancel');
        if (done) return;

        const visibleFields = (f: Flight) => JSON.stringify([
            f.status, f.departureTime, f.arrivalTime,
            f.estimatedDepartureTime, f.estimatedArrivalTime,
            f.actualDepartureTime, f.actualArrivalTime,
            f.gate, f.terminal, f.gateDestination, f.terminalDestination,
            f.baggage, f.progress, f.delayMinutes
        ]);

        const timer = setInterval(async () => {
            try {
                const fresh = await fetchRealFlights(selectedFlight.ident || selectedFlight.flightNumber);
                const updated = fresh.find(f => f.id === selectedFlight.id);
                if (!updated || visibleFields(updated) === visibleFields(selectedFlight)) return;
                setFlights(prev => prev.map(f => (f.id === updated.id ? updated : f)));
                setSelectedFlight(updated);
            } catch (e) { /* transient network failure — next tick retries */ }
        }, 60000);
        return () => clearInterval(timer);
    }, [selectedFlight]);

    // Render Fleet map
    useEffect(() => {
        if (searchMode === 'fleet' && flights.length > 0 && googleMapRef.current && window.google) {
            // Clear old markers
            fleetMarkersRef.current.forEach(m => m.setMap(null));
            fleetMarkersRef.current = [];
            
            const bounds = new window.google.maps.LatLngBounds();
            let addedCount = 0;

            flights.forEach(f => {
                if (f.latitude && f.longitude) {
                    const pos = { lat: f.latitude, lng: f.longitude };
                    bounds.extend(pos);
                    
                    const marker = new window.google.maps.Marker({
                        position: pos,
                        map: googleMapRef.current,
                        icon: {
                            path: 'M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z',
                            fillColor: '#FF6B35',
                            fillOpacity: 1,
                            strokeWeight: 1,
                            strokeColor: '#FFFFFF',
                            scale: 0.8,
                            rotation: f.heading || 0,
                            anchor: new window.google.maps.Point(12, 12)
                        },
                        title: f.ident
                    });
                    
                    marker.addListener('click', () => {
                        setSelectedFlight(f);
                        setSearchMode('flight');
                    });
                    
                    fleetMarkersRef.current.push(marker);
                    addedCount++;
                }
            });
            
            if (addedCount > 0) {
                googleMapRef.current.fitBounds(bounds);
            }
        }
    }, [flights, searchMode]);

    const performSearch = async (overrideQuery?: string) => {
        const rawQuery = overrideQuery ?? searchQuery;
        setIsLoading(true);
        setSearchError('');
        setHasSearched(true);
        setAltSuggestion(null);
        setSelectedFlight(null);
        setOperatorInfo(null);
        setOperatorCounts(null);
        const trackQuery = rawQuery.trim();
        if (trackQuery) localStorage.setItem('urtc_last_flight_search', trackQuery);

        try {
            const parsed = parseSmartSearch(rawQuery);
            // Date is optional: unless the user explicitly picked one, search undated
            // and let relevance sorting surface the current/next flight.
            const effDate = dateExplicit ? flightDate : undefined;

            if (parsed.type === 'empty') {
                setSearchError('Type a flight number, airport code, route (ATL to JFK), airline, or tail number.');
            } else if (parsed.type === 'flight') {
                setSearchMode('flight');
                const results = await fetchRealFlights(parsed.flight, effDate, airlineFilter);
                setFlights(results);
                setSchedules([]);
                setAirportInfo(null);
                if (results.length === 0) setSearchError('No flights found. Try a different flight number or date.');
                else setSelectedFlight(results[0]); // results are relevance-sorted — open the flight they're looking for
            } else if (parsed.type === 'airport') {
                // Airport board: upcoming departures + live conditions
                setSearchMode('airport');
                const [results, scheds, conds] = await Promise.all([
                    fetchRealFlights(parsed.code, effDate, airlineFilter),
                    fetchSchedules(parsed.code, undefined, effDate, airlineFilter),
                    fetchAirportConditions(parsed.code)
                ]);
                setFlights(results);
                setSchedules(scheds);
                setAirportInfo(conds);
                if (parsed.altFleet) setAltSuggestion({ label: `Looking for ${parsed.altFleet} the airline? View its live fleet instead`, query: `fleet:${parsed.altFleet}` });
                if (results.length === 0 && scheds.length === 0) setSearchError(`No departures found for ${parsed.code}. Check the airport code or date.`);
            } else if (parsed.type === 'fleet') {
                setSearchMode('fleet');
                const [results, opInfo, opCounts] = await Promise.all([
                    fetchOperatorEnrouteFlights(parsed.opCode),
                    fetchOperatorInfo(parsed.opCode),
                    fetchOperatorFlightCounts(parsed.opCode)
                ]);
                setFlights(results);
                setOperatorInfo(opInfo);
                setOperatorCounts(opCounts);
                setSchedules([]);
                setAirportInfo(null);
                if (results.length === 0) setSearchError(`No active airborne flights found for airline ${parsed.opCode}.`);
            } else if (parsed.type === 'tail') {
                setSearchMode('tail');
                const results = await fetchLastFlightByTailNumber(parsed.tail);
                setFlights(results);
                setSchedules([]);
                setAirportInfo(null);
                if (results.length === 0) setSearchError(`No recent flights found for tail ${parsed.tail}.`);
            } else if (parsed.type === 'route') {
                setSearchMode('airport');
                let isFuture = false;
                if (effDate) {
                    const flightTime = new Date(effDate + 'T12:00:00Z').getTime();
                    const twoDaysFromNow = Date.now() + (2 * 24 * 60 * 60 * 1000);
                    if (flightTime > twoDaysFromNow) isFuture = true;
                }
                const [results, scheds, conds] = await Promise.all([
                    !isFuture ? fetchRealFlights(parsed.origin, effDate, airlineFilter, parsed.dest) : Promise.resolve([]),
                    isFuture ? fetchFutureSchedules(effDate!, effDate!, parsed.origin, parsed.dest) : fetchSchedules(parsed.origin, parsed.dest, effDate, airlineFilter),
                    fetchAirportConditions(parsed.origin)
                ]);
                setFlights(results);
                setSchedules(scheds);
                setAirportInfo(conds);
                if (results.length === 0 && scheds.length === 0) setSearchError('No flights found for this route.');
            }
        } catch (err) {
            console.error(err);
            setSearchError('Search failed. Please check your connection and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Force a fleet search (used by the "did you mean airline?" chip)
    const performFleetSearch = async (opCode: string) => {
        setIsLoading(true);
        setSearchError('');
        setHasSearched(true);
        setAltSuggestion(null);
        try {
            setSearchMode('fleet');
            const [results, opInfo, opCounts] = await Promise.all([
                fetchOperatorEnrouteFlights(opCode),
                fetchOperatorInfo(opCode),
                fetchOperatorFlightCounts(opCode)
            ]);
            setFlights(results);
            setOperatorInfo(opInfo);
            setOperatorCounts(opCounts);
            setSchedules([]);
            setAirportInfo(null);
            if (results.length === 0) setSearchError(`No active airborne flights found for airline ${opCode}.`);
        } catch (err) {
            console.error(err);
            setSearchError('Search failed. Please check your connection and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleScanOverhead = async () => {
        setIsLoading(true);
        setSearchError('');
        setHasSearched(true);
        setSelectedFlight(null);
        setSearchMode('flight');
        try {
            // Approximate bounds for continental US for demo purposes
            const bounds = { north: 49, south: 24, east: -66, west: -125 };
            const results = await searchFlightsInArea(bounds);
            setFlights(results);
            setSchedules([]);
            setAirportInfo(null);
            if (results.length === 0) {
                setSearchError('No flights found overhead.');
            }
        } catch (err) {
            console.error(err);
            setSearchError('Scan failed. Please check your connection and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const openAirportIntelligence = async () => {
        if (!airportInfo) return;
        setIsLoading(true);
        try {
            const code = airportInfo.airportCode;
            const [info, counts, forecast, nearby, delays] = await Promise.all([
                fetchAirportInfo(code),
                fetchAirportFlightCounts(code),
                fetchAirportForecast(code),
                fetchNearbyAirports(code),
                fetchGlobalDelays()
            ]);
            setAirportFullInfo({ info, counts, forecast, nearby, delays: delays.find(d => d.airport_code === code) });
            setShowAirportModal(true);
        } catch (e) {
            console.error(e);
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

    const getStatusColor = (status: string) => {
        const st = (status || '').toLowerCase();
        if (st.includes('cancel')) return 'text-red-400 bg-red-400/10 border-red-400/20';
        if (st.includes('resched') || st.includes('divert')) return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
        if (st.includes('delay')) return 'text-orange-400 bg-orange-400/10 border-orange-400/20 animate-pulse';
        if (st.includes('en route') || st.includes('departed') || st.includes('taxi')) return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
        if (st.includes('on time') || st.includes('landed')) return 'text-green-400 bg-green-400/10 border-green-400/20';
        return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    };

    const shareFlight = (f: Flight, e: React.MouseEvent) => {
        e.stopPropagation();
        const text = `✈️ ${f.flightNumber}: ${f.departureAirport} → ${f.arrivalAirport} — ${getDisplayStatus(f)}. Tracking live on ÜrTC`;
        const url = 'https://urtc-app.web.app';
        if (navigator.share) {
            navigator.share({ title: `Flight ${f.flightNumber}`, text, url }).catch(() => {});
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(`${text} ${url}`);
            alert('Flight status copied — paste it anywhere!');
        }
    };

    const openGoogleFlights = (f: Flight, e: React.MouseEvent) => {
        e.stopPropagation();
        const query = `Flights from ${f.departureAirport} to ${f.arrivalAirport}`;
        window.open(`https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`, '_blank');
    };

    return (
        <div className="space-y-5 pb-24">
            <div className="flex justify-between items-center mb-2 px-1">
                <h2 className="text-xl font-bold">Flight Data & Tracking</h2>
                {trialDays > 0 && user.tier !== UserTier.Diamond && user.tier !== UserTier.Professional && user.tier !== UserTier.Dev && (
                    <span className="text-[10px] font-black bg-gradient-to-r from-[#8DE2FF] to-[#3AB0FF] text-white px-2.5 py-1 rounded-full shadow">💎 Diamond trial · {trialDays}d left</span>
                )}
                <button 
                    onClick={() => isPro ? setShowAlertsModal(true) : setShowUpgradeNudge('Real-time flight alerts')}
                    className="bg-brand-blue/10 text-brand-blue hover:bg-brand-blue hover:text-white px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1"
                >
                    <Bell size={14} /> Alerts {!isPro && <Lock size={10} className="opacity-70" />}
                </button>
            </div>
            
            {/* Unified Smart Search — one box for flights, airports, routes, airlines & tails */}
            <div id="tour-flight-search" className="bg-white dark:bg-brand-surface/90 backdrop-blur-xl p-4 rounded-2xl border border-gray-200 dark:border-white/10 shadow-xl transition-all duration-300 focus-within:shadow-brand-orange/20 focus-within:border-brand-orange/30">
                <form onSubmit={(e) => { e.preventDefault(); performSearch(); }} className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 relative min-w-[200px]">
                            <label className="absolute left-4 top-2 text-[10px] font-bold uppercase tracking-wider text-brand-orange">
                                Search Anything
                            </label>
                            <input
                                id="flightSearchInput"
                                type="text"
                                placeholder={'Try "Delta 1182", "JFK", "ATL to LAX" or "N123AB"'}
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
                        <button
                            type="button"
                            disabled={isLoading}
                            onClick={handleScanOverhead}
                            title="Scan for all aircraft currently in the sky"
                            className="bg-brand-surface border border-white/10 text-white rounded-xl shadow-lg flex items-center justify-center gap-2 font-bold px-4 py-3 sm:py-0 hover:bg-white/10 transition-all hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50"
                        >
                            <Radar size={20} className="text-brand-orange" /> Scan Skies
                        </button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        {/* Travel Date */}
                        <button
                            type="button"
                            onClick={() => setShowCalendar(true)}
                            className="flex-1 flex items-center gap-3 bg-gray-50/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 rounded-xl px-4 py-3 hover:border-brand-orange/30 transition-all group"
                        >
                            <Calendar size={16} className="text-brand-orange" />
                            <div className="flex-1 text-left">
                                <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Travel Date <span className="text-gray-400 normal-case">(optional)</span></div>
                                <div className="text-sm font-bold text-gray-900 dark:text-white">
                                    {dateExplicit ? new Date(flightDate + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Auto — finds the current flight'}
                                </div>
                            </div>
                            {dateExplicit && (
                                <span
                                    onClick={(e) => { e.stopPropagation(); setDateExplicit(false); }}
                                    className="text-[10px] font-bold text-brand-orange bg-brand-orange/10 px-2 py-1 rounded-lg hover:bg-brand-orange hover:text-white transition"
                                >
                                    Reset
                                </span>
                            )}
                            <div className="text-[10px] text-gray-400 group-hover:text-brand-orange transition">Change</div>
                        </button>

                        {/* Airline Filter (applies to airport & route boards) */}
                        <div className="flex-1 relative">
                            <label className="absolute left-4 top-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">Airline Filter</label>
                            <select
                                className="w-full h-full bg-gray-50/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 rounded-xl py-3 pl-4 pr-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue transition-all font-bold text-sm pt-7 appearance-none cursor-pointer"
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
                    </div>
                </form>

                {/* Helpful tip */}
                <p className="mt-3 text-[11px] text-center text-gray-500 dark:text-white/30">
                    One search does it all: flight number ("Delta 1182") • airport board ("JFK") • route ("ATL to LAX") • airline fleet ("DAL") • tail number ("N123AB")
                </p>
            </div>

            {/* Results Area */}
            <div className="space-y-4">
                {/* Ambiguous query helper (e.g. DAL = Dallas Love Field or Delta Air Lines) */}
                {altSuggestion && !isLoading && (
                    <button
                        onClick={() => performFleetSearch(altSuggestion.query.replace('fleet:', ''))}
                        className="w-full bg-brand-blue/10 border border-brand-blue/20 text-brand-blue rounded-2xl p-3 text-sm font-bold flex items-center justify-center gap-2 hover:bg-brand-blue hover:text-white transition"
                    >
                        <Globe size={16} /> {altSuggestion.label} <ArrowRight size={14} />
                    </button>
                )}
                {/* Empty State — Before any search */}
                {!hasSearched && !isLoading && flights.length === 0 && (
                    <div className="bg-white dark:bg-brand-surface/50 border border-gray-200 dark:border-white/10 rounded-2xl p-8 text-center">
                        <div className="inline-flex bg-gradient-to-br from-brand-orange/20 to-brand-blue/20 text-brand-orange p-4 rounded-2xl mb-4">
                            <Radar size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Search for Flights</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 max-w-xs mx-auto leading-relaxed">
                            Track any flight worldwide in real time. Search by flight number, airport, route, airline, or tail number.
                        </p>
                        <div className="bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-[10px] p-2 rounded-lg max-w-xs mx-auto mb-6 flex items-start gap-2 text-left">
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                            <span>Live tracking covers active and upcoming flights. Planning future travel? Build it in the Plans tab.</span>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2 mb-6">
                            <button onClick={() => { setSearchQuery('DAL1182'); performSearch('DAL1182'); }} className="text-xs font-bold bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 hover:border-brand-orange/30 hover:text-brand-orange transition">
                                DAL1182
                            </button>
                            <button onClick={() => { setSearchQuery('JFK'); performSearch('JFK'); }} className="text-xs font-bold bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 hover:border-brand-orange/30 hover:text-brand-orange transition">
                                JFK departures
                            </button>
                            <button onClick={() => { setSearchQuery('ATL TO LAX'); performSearch('ATL TO LAX'); }} className="text-xs font-bold bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 hover:border-brand-orange/30 hover:text-brand-orange transition">
                                ATL → LAX
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
                        <button onClick={openAirportIntelligence} className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-600 transition flex items-center gap-1">
                            <Info size={14}/> Intelligence
                        </button>
                    </div>
                )}
                
                {/* Airport Intelligence Modal */}
                {showAirportModal && airportFullInfo && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-[#202124] w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl border border-gray-200 dark:border-white/10 flex flex-col max-h-[90vh]">
                            <div className="p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-white/5">
                                <div>
                                    <h3 className="text-xl font-bold flex items-center gap-2"><Globe className="text-brand-orange" /> {airportFullInfo.info?.name || airportInfo?.airportCode}</h3>
                                    <p className="text-sm text-gray-500">{airportFullInfo.info?.city}, {airportFullInfo.info?.timezone}</p>
                                </div>
                                <button onClick={() => setShowAirportModal(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 overflow-y-auto space-y-6">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div className="bg-gray-100 dark:bg-white/5 p-4 rounded-xl">
                                        <div className="text-xs text-gray-500">Departures</div>
                                        <div className="text-2xl font-bold">{airportFullInfo.counts?.scheduled_departures || 0}</div>
                                    </div>
                                    <div className="bg-gray-100 dark:bg-white/5 p-4 rounded-xl">
                                        <div className="text-xs text-gray-500">Arrivals</div>
                                        <div className="text-2xl font-bold">{airportFullInfo.counts?.scheduled_arrivals || 0}</div>
                                    </div>
                                    <div className="bg-gray-100 dark:bg-white/5 p-4 rounded-xl">
                                        <div className="text-xs text-gray-500">En Route</div>
                                        <div className="text-2xl font-bold">{airportFullInfo.counts?.enroute || 0}</div>
                                    </div>
                                    <div className="bg-gray-100 dark:bg-white/5 p-4 rounded-xl">
                                        <div className="text-xs text-gray-500">Delay Index</div>
                                        <div className="text-2xl font-bold">{airportFullInfo.delays?.delay_index || 0}/5</div>
                                    </div>
                                </div>
                                {airportFullInfo.nearby && airportFullInfo.nearby.length > 0 && (
                                    <div>
                                        <h4 className="font-bold mb-3 flex items-center gap-2"><MapPin size={16} className="text-brand-blue" /> Nearby Airports</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {airportFullInfo.nearby.slice(0, 4).map((n: any) => (
                                                <div key={n.code} className="border border-gray-200 dark:border-white/10 rounded-xl p-3 flex justify-between items-center">
                                                    <div>
                                                        <div className="font-bold">{n.code}</div>
                                                        <div className="text-xs text-gray-500">{n.name}</div>
                                                    </div>
                                                    <div className="text-xs font-mono">{n.distance}mi</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
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

                {/* Operator Intelligence Header */}
                {hasSearched && !isLoading && searchMode === 'fleet' && operatorInfo && (
                    <div className="bg-gradient-to-r from-brand-blue/10 to-brand-orange/10 border border-brand-blue/20 rounded-2xl p-6 mb-4 relative overflow-hidden">
                        <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center md:items-start justify-between">
                            <div className="flex items-center gap-4">
                                <div className="bg-white dark:bg-white/10 w-16 h-16 rounded-xl flex items-center justify-center shadow-lg border border-gray-200 dark:border-white/20">
                                    <Globe className="text-brand-blue" size={32} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                                        {operatorInfo.name} <span className="text-sm bg-brand-blue/20 text-brand-blue px-2 py-0.5 rounded uppercase">{operatorInfo.icao}</span>
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        {operatorInfo.city}, {operatorInfo.country} • Callsign: {operatorInfo.callsign}
                                    </p>
                                </div>
                            </div>
                            
                            {operatorCounts && (
                                <div className="flex gap-4">
                                    <div className="bg-white/60 dark:bg-black/20 p-3 rounded-xl backdrop-blur text-center min-w-[90px]">
                                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Airborne Now</div>
                                        <div className="text-2xl font-black text-brand-orange">{operatorCounts.airborne || 0}</div>
                                    </div>
                                    <div className="bg-white/60 dark:bg-black/20 p-3 rounded-xl backdrop-blur text-center min-w-[90px]">
                                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Last 24 Hrs</div>
                                        <div className="text-2xl font-black text-brand-blue">{operatorCounts.flights_last_24_hours || 0}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
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
                
                {/* Live Flight Cards */}
                {(viewMode === 'live' || searchMode === 'flight') && flights.map((flight, i) => (
                    <div
                        key={flight.id + '-' + i}
                        onClick={() => setSelectedFlight(flight === selectedFlight ? null : flight)}
                        className={`w-full text-left bg-white dark:bg-brand-surface border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden hover:border-brand-orange/40 transition-all duration-300 shadow-lg hover:shadow-xl group relative cursor-pointer ${selectedFlight === flight ? 'ring-2 ring-brand-orange' : ''}`}
                    >
                        {/* Map Overlay for Selected Flight */}
                        {selectedFlight === flight && (
                            <div className={`${use3D && map3dSupported !== false ? 'h-96' : 'h-72'} w-full relative bg-gray-900 border-b border-white/10 transition-all`} onClick={(e) => e.stopPropagation()}>
                                <div ref={mapRef} className={`w-full h-full ${use3D && map3dSupported !== false ? '' : 'opacity-80'}`} />
                                <div className="absolute top-2 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-[9px] text-white/80 leading-relaxed">
                                    <span className="text-brand-orange font-black">━</span> Flight path&nbsp;&nbsp;<span className="text-blue-400 font-black">✈</span> Live position
                                </div>
                                {map3dSupported !== false && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setUse3D(v => !v); }}
                                        className="absolute top-2 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-[10px] font-bold text-white/90 hover:bg-black/80 hover:border-brand-orange/40 transition flex items-center gap-1.5"
                                        title={use3D ? 'Switch to the flat map' : 'Switch to the 3D Earth view'}
                                    >
                                        <Globe size={11} className="text-brand-orange" /> {use3D ? '2D Map' : '3D Earth'}
                                    </button>
                                )}
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
                                {(() => { const ds = getDisplayStatus(flight); return (
                                <div className={`px-3 py-1 rounded-full text-[10px] font-extrabold border flex items-center gap-1.5 uppercase tracking-wide ${getStatusColor(ds)}`}>
                                    {ds === 'On Time' && <CheckCircle size={12} />}
                                    {(ds.startsWith('Delayed') || ds === 'Rescheduled' || ds === 'Cancelled') && <AlertTriangle size={12} />}
                                    {ds}
                                </div>
                                ); })()}
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

                        {(() => { const ds = getDisplayStatus(flight); return !isPro && (ds.startsWith('Delayed') || ds === 'Rescheduled' || ds === 'Cancelled') ? (
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowUpgradeNudge('Instant alerts the second a delay, gate, or cancellation changes'); }}
                                className="w-full bg-gradient-to-r from-orange-500/10 to-red-500/10 border-t border-orange-500/20 px-5 py-2.5 flex items-center justify-between text-left hover:from-orange-500/20 hover:to-red-500/20 transition"
                            >
                                <span className="text-[11px] font-bold text-orange-500">😤 Flight trouble? Diamond members knew before the airport screens.</span>
                                <span className="text-[10px] font-black text-brand-orange whitespace-nowrap ml-2">GET ALERTS →</span>
                            </button>
                        ) : null; })()}
                        <div className="bg-gray-50 dark:bg-white/5 px-5 py-3 flex justify-between items-center border-t border-gray-200 dark:border-white/5">
                            <div className="flex gap-4 text-xs font-bold text-gray-500 dark:text-gray-300">
                                <span className="flex items-center gap-1"><MapPin size={10} /> {flight.airline} • {flight.aircraft || 'Aircraft TBD'}</span>
                                <span className="flex items-center gap-1"><Calendar size={10} /> {formatDate(flight.departureTime)}</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={(e) => shareFlight(flight, e)} title="Share this flight" className="text-gray-500 dark:text-gray-300 font-bold text-xs flex items-center gap-1 bg-gray-100 dark:bg-white/5 px-2 py-1 rounded-md border border-gray-200 dark:border-white/10 hover:border-brand-orange/40 hover:text-brand-orange transition">
                                    <Share2 size={10} /> Share
                                </button>
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
                        {selectedFlight === flight && (
                            <div className="bg-gray-50 dark:bg-black/20 p-4 border-t border-gray-200 dark:border-white/10">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <MapPin size={12} className="text-brand-blue" /> Gates & Baggage
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div>
                                        <div className="text-[10px] text-gray-400">Departure Gate</div>
                                        <div className="text-sm font-bold dark:text-white">{flight.gate ? `Gate ${flight.gate}` : 'Not assigned yet'}{flight.terminal ? ` · Terminal ${flight.terminal}` : ''}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-gray-400">Arrival Gate</div>
                                        <div className="text-sm font-bold dark:text-white">{flight.gateDestination ? `Gate ${flight.gateDestination}` : 'Not assigned yet'}{flight.terminalDestination ? ` · Terminal ${flight.terminalDestination}` : ''}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-gray-400">Baggage Claim</div>
                                        <div className="text-sm font-bold dark:text-white">{flight.baggage || 'Posted after landing'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-gray-400">Aircraft</div>
                                        <div className="text-sm font-bold dark:text-white">{flight.aircraft || 'TBD'}{flight.tailNumber ? ` · ${flight.tailNumber}` : ''}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {selectedFlight === flight && foresightData && !isPro && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowUpgradeNudge('AI-predicted departure & arrival times'); }}
                                className="w-full bg-gradient-to-r from-brand-orange/10 to-brand-blue/10 p-4 border-t border-gray-200 dark:border-white/10 text-left relative overflow-hidden group"
                            >
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <Radar size={12} className="text-brand-orange" /> AI-Predicted Times
                                    <span className="ml-auto bg-gradient-to-r from-[#8DE2FF] to-[#3AB0FF] text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1"><Lock size={8} /> DIAMOND</span>
                                </h4>
                                <div className="grid grid-cols-4 gap-4 blur-[6px] select-none pointer-events-none">
                                    {['Leaves Gate', 'Takes Off', 'Lands', 'At Gate'].map(l => (
                                        <div key={l}>
                                            <div className="text-[10px] text-gray-400">{l}</div>
                                            <div className="text-sm font-mono font-bold dark:text-white">8:88 PM</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="absolute inset-x-0 bottom-2 text-center text-[11px] font-bold text-brand-blue group-hover:underline">
                                    Unlock exact AI predictions with Diamond →
                                </div>
                            </button>
                        )}
                        {selectedFlight === flight && foresightData && isPro && (
                            <div className="bg-gradient-to-r from-brand-orange/5 to-brand-blue/5 p-4 border-t border-gray-200 dark:border-white/10">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <Radar size={12} className="text-brand-orange" /> Foresight™ AI Predictions
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div>
                                        <div className="text-[10px] text-gray-400">Leaves Gate</div>
                                        <div className="text-sm font-mono font-bold dark:text-white">{formatTime(foresightData.predicted_out)}</div>
                                        {foresightData.predicted_out_source && <div className="text-[9px] text-gray-400">{foresightData.predicted_out_source}</div>}
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-gray-400">Takes Off</div>
                                        <div className="text-sm font-mono font-bold dark:text-white">{formatTime(foresightData.predicted_off)}</div>
                                        {foresightData.predicted_off_source && <div className="text-[9px] text-gray-400">{foresightData.predicted_off_source}</div>}
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-gray-400">Lands</div>
                                        <div className="text-sm font-mono font-bold dark:text-white">{formatTime(foresightData.predicted_on)}</div>
                                        {foresightData.predicted_on_source && <div className="text-[9px] text-gray-400">{foresightData.predicted_on_source}</div>}
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-gray-400">At Gate</div>
                                        <div className="text-sm font-mono font-bold dark:text-white">{formatTime(foresightData.predicted_in)}</div>
                                        {foresightData.predicted_in_source && <div className="text-[9px] text-gray-400">{foresightData.predicted_in_source}</div>}
                                    </div>
                                </div>
                                {foresightData.predicted_taxi_out_duration ? (
                                    <div className="mt-2 text-[10px] text-gray-500">Estimated taxi before takeoff: <span className="font-bold">{Math.round(foresightData.predicted_taxi_out_duration / 60)} min</span></div>
                                ) : null}
                            </div>
                        )}
                        {selectedFlight === flight && (aircraftOwnerInfo || aircraftTypeInfo || disruptionBadge) && (
                            <div className="bg-gray-50 dark:bg-black/20 p-4 border-t border-gray-200 dark:border-white/10 flex flex-col sm:flex-row gap-4 justify-between">
                                {(aircraftOwnerInfo || aircraftTypeInfo) && (
                                    <div>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Aircraft Info</div>
                                        {aircraftOwnerInfo?.owner?.name ? (
                                            <>
                                                <div className="text-sm font-bold dark:text-white flex items-center gap-1"><Plane size={12} className="text-brand-orange"/> {aircraftOwnerInfo.owner.name}</div>
                                                <div className="text-xs text-gray-500">{aircraftOwnerInfo.owner.location}</div>
                                            </>
                                        ) : aircraftTypeInfo ? (
                                            <>
                                                <div className="text-sm font-bold dark:text-white flex items-center gap-1"><Plane size={12} className="text-brand-orange"/> {aircraftTypeInfo.manufacturer} {aircraftTypeInfo.type}</div>
                                                <div className="text-xs text-gray-500">Engines: {aircraftTypeInfo.engine_count}</div>
                                            </>
                                        ) : null}
                                    </div>
                                )}
                                {disruptionBadge && (
                                    <div>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><AlertTriangle size={10} className="text-red-400" /> Origin Disruptions</div>
                                        <div className="text-sm font-bold dark:text-white">{disruptionBadge.delays} Delays</div>
                                        <div className="text-xs text-gray-500">{disruptionBadge.cancellations} Cancellations</div>
                                    </div>
                                )}
                            </div>
                        )}
                        {isStatsNerd && (
                            <div className="text-[10px] font-mono text-gray-400 p-2 bg-gray-100 dark:bg-black/20 rounded-b-2xl mx-0">
                                API: AeroAPI | Ident: {flight.ident} | Progress: {flight.progress.toFixed(1)}% | Gate: {flight.gate || 'N/A'} | Duration: {flight.durationMinutes || 'N/A'}min
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* ── Ad Space Placeholder (Silver & Dev Only) ── */}
            {(user.tier === UserTier.Free || user.tier === UserTier.Dev) && (
                <div className="mt-4 mb-2 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both border border-dashed border-white/20 bg-white/5 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[100px] relative overflow-hidden text-center mx-2">
                    <div className="text-white/40 text-[10px] font-mono tracking-widest uppercase mb-1">Advertisement Space</div>
                    <p className="text-white/60 text-xs font-medium">Unskippable 15s Video Ad goes here</p>
                    <button onClick={() => setShowUpgradeNudge('An ad-free experience')} className="mt-2 text-[10px] font-bold text-brand-orange hover:underline">Remove ads with Diamond ✨</button>
                    {user.tier === UserTier.Dev && (
                        <div className="absolute top-2 right-2 bg-amber-500/20 text-amber-400 text-[9px] font-mono px-2 py-0.5 rounded border border-amber-500/30">
                            DEV PREVIEW
                        </div>
                    )}
                </div>
            )}

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

            {/* Calendar Picker Modal */}
            {showCalendar && (
                <CalendarPicker
                    isOpen={showCalendar}
                    onClose={() => setShowCalendar(false)}
                    mode={searchMode === 'airport' ? 'range' : 'single'}
                    initialDeparture={flightDate}
                    initialReturn={returnDate}
                    onSelect={(dep, ret) => {
                        setFlightDate(dep);
                        setReturnDate(ret || '');
                        setDateExplicit(true);
                        setShowCalendar(false);
                    }}
                />
            )}

            {/* Diamond upgrade nudge */}
            {showUpgradeNudge && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowUpgradeNudge(null)}>
                    <div className="bg-white dark:bg-[#151921] rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-gray-200 dark:border-white/10 text-center animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-[#E0FFFF] via-[#8DE2FF] to-[#3AB0FF] flex items-center justify-center shadow-lg shadow-blue-400/30 mb-4">
                            <Lock size={24} className="text-white" />
                        </div>
                        <h3 className="font-black text-lg dark:text-white">That's a Diamond feature</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{showUpgradeNudge} — plus zero ads, unlimited Apollo AI, and smart budgeting.</p>
                        <p className="text-xs text-gray-400 mt-3">Upgrade any time in <span className="font-bold">About → Subscriptions</span></p>
                        <button onClick={() => setShowUpgradeNudge(null)} className="mt-5 w-full bg-gradient-to-r from-[#8DE2FF] to-[#3AB0FF] text-white font-bold py-3 rounded-xl shadow-lg hover:opacity-90 transition">
                            Got it
                        </button>
                    </div>
                </div>
            )}

            <FlightAlertsModal isOpen={showAlertsModal} onClose={() => setShowAlertsModal(false)} />
        </div>
    );
});
