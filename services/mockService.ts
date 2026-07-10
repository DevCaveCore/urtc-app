import { Flight, FlightStatus, Airport, Place, Weather, DelayInsight, FlightSchedule, GateInfo, AustralianAirspace } from '../types';

export const AIRLINE_CODES = [
  { code: "DL", icao: "DAL", name: "Delta Air Lines" },
  { code: "AA", icao: "AAL", name: "American Airlines" },
  { code: "UA", icao: "UAL", name: "United Airlines" },
  { code: "WN", icao: "SWA", name: "Southwest Airlines" },
  { code: "B6", icao: "JBU", name: "JetBlue Airways" },
  { code: "AS", icao: "ASA", name: "Alaska Airlines" },
  { code: "F9", icao: "FFT", name: "Frontier Airlines" },
  { code: "HA", icao: "HAL", name: "Hawaiian Airlines" },
  { code: "AC", icao: "ACA", name: "Air Canada" },
  { code: "WS", icao: "WJA", name: "WestJet" },
  { code: "BA", icao: "BAW", name: "British Airways" },
  { code: "LH", icao: "DLH", name: "Lufthansa" },
  { code: "AF", icao: "AFR", name: "Air France" },
  { code: "EK", icao: "UAE", name: "Emirates" },
  { code: "QF", icao: "QFA", name: "Qantas" }
];
import { EXTENDED_AIRPORTS } from './airportsData';

const BASE_AIRPORTS = [
 { code: "ATL", city: "Atlanta", name: "Hartsfield-Jackson", lat: 33.64, lng: -84.42 },
 { code: "LAX", city: "Los Angeles", name: "Los Angeles Intl", lat: 33.94, lng: -118.40 },
 { code: "JFK", city: "New York", name: "John F. Kennedy", lat: 40.64, lng: -73.77 },
 { code: "ORD", city: "Chicago", name: "O'Hare", lat: 41.97, lng: -87.90 },
 { code: "LHR", city: "London", name: "Heathrow", lat: 51.47, lng: -0.46 },
 { code: "SFO", city: "San Francisco", name: "San Francisco Intl", lat: 37.62, lng: -122.37 },
 { code: "MIA", city: "Miami", name: "Miami Intl", lat: 25.79, lng: -80.28 },
 { code: "SEA", city: "Seattle", name: "Tacoma Intl", lat: 47.45, lng: -122.30 },
 { code: "DXB", city: "Dubai", name: "Dubai Intl", lat: 25.25, lng: 55.36 },
 { code: "HND", city: "Tokyo", name: "Haneda", lat: 35.54, lng: 139.77 },
 { code: "CDG", city: "Paris", name: "Charles de Gaulle", lat: 49.00, lng: 2.55 },
 { code: "AMS", city: "Amsterdam", name: "Schiphol", lat: 52.31, lng: 4.76 },
 { code: "SIN", city: "Singapore", name: "Changi", lat: 1.36, lng: 103.99 },
 { code: "SYD", city: "Sydney", name: "Kingsford Smith", lat: -33.93, lng: 151.17 },
 { code: "DFW", city: "Dallas", name: "Dallas/Fort Worth", lat: 32.89, lng: -97.04 },
 { code: "DEN", city: "Denver", name: "Denver Intl", lat: 39.85, lng: -104.67 },
 { code: "LAS", city: "Las Vegas", name: "Harry Reid", lat: 36.08, lng: -115.15 },
 { code: "CLT", city: "Charlotte", name: "Charlotte Douglas", lat: 35.21, lng: -80.94 },
 { code: "MCO", city: "Orlando", name: "Orlando Intl", lat: 28.43, lng: -81.30 },
 { code: "EWR", city: "Newark", name: "Newark Liberty", lat: 40.68, lng: -74.17 },
 { code: "PHX", city: "Phoenix", name: "Sky Harbor", lat: 33.43, lng: -112.00 },
 { code: "IAH", city: "Houston", name: "George Bush", lat: 29.99, lng: -95.33 },
 { code: "BOS", city: "Boston", name: "Logan Intl", lat: 42.36, lng: -71.00 }
];

const AIRPORTS = [...BASE_AIRPORTS, ...EXTENDED_AIRPORTS];

const DELAY_REASONS: DelayInsight[] = [
 { reason: "Late Incoming Aircraft", confidence: 85, description: "Your plane is arriving late from its previous trip." },
 { reason: "Weather", confidence: 90, description: "Thunderstorms in the flight path." },
 { reason: "ATC Volume", confidence: 60, description: "Air traffic control has paused departures due to volume." },
 { reason: "Crew Availability", confidence: 95, description: "Awaiting flight crew member." }
];

export const generateMockFlights = (count: number): Flight[] => {
 const airlines = ["Delta", "American", "United", "JetBlue", "Southwest", "Emirates", "British Airways", "Lufthansa", "Air France", "Qantas"];
 const statuses = Object.values(FlightStatus);

 return Array.from({ length: count }).map((_, i) => {
   const dep = AIRPORTS[Math.floor(Math.random() * AIRPORTS.length)];
   let arr = AIRPORTS[Math.floor(Math.random() * AIRPORTS.length)];
   while (arr.code === dep.code) {
     arr = AIRPORTS[Math.floor(Math.random() * AIRPORTS.length)];
   }
   
   let status = statuses[Math.floor(Math.random() * statuses.length)];
   if (Math.random() > 0.7) status = FlightStatus.OnTime;
   const isDelayed = status === FlightStatus.Delayed;
   const progress = status === FlightStatus.EnRoute ? Math.floor(Math.random() * 80) + 10 : (status === FlightStatus.Landed ? 100 : 0);
   const airline = airlines[Math.floor(Math.random() * airlines.length)];
   const flightNum = Math.floor(Math.random() * 9000) + 1000;

   return {
     id: `flight-${i}`,
     ident: `FL${flightNum}`,
     flightNumber: `${airline.substring(0, 2).toUpperCase()}${flightNum}`,
     airline: airline,
     status,
     departureAirport: dep.code,
     arrivalAirport: arr.code,
     departureTime: new Date(Date.now() + Math.random() * 86400000).toISOString(),
     arrivalTime: new Date(Date.now() + Math.random() * 172800000).toISOString(),
     gate: `${['A', 'B', 'C', 'T'][Math.floor(Math.random() * 4)]}${Math.floor(Math.random() * 30) + 1}`,
     terminal: `${Math.floor(Math.random() * 5) + 1}`,
     aircraft: ["Boeing 737-MAX", "Airbus A321neo", "Boeing 787-9", "Airbus A350-1000", "Boeing 777-300ER"][Math.floor(Math.random() * 5)],
     tailNumber: `N${Math.floor(Math.random() * 900) + 100}XY`,
     progress,
     delayMinutes: isDelayed ? Math.floor(Math.random() * 120) + 15 : 0,
     price: Math.floor(Math.random() * 600) + 150,
     insight: isDelayed ? DELAY_REASONS[Math.floor(Math.random() * DELAY_REASONS.length)] : undefined,
     websiteUrl: "https://www.google.com/travel/flights",
   };
 });
};

export const getMockFlightById = (ident: string): Flight | null => {
   const mockList = generateMockFlights(1);
   const flight = mockList[0];
   return {
       ...flight,
       id: ident,
       flightNumber: ident,
       airline: "Simulated Airline",
       status: FlightStatus.EnRoute,
       progress: 45
   };
};

export const getAirportSuggestions = (query: string): string[] => {
 if (!query) return [];
 const q = query.toLowerCase();
 return AIRPORTS
   .filter(a => a.code.toLowerCase().includes(q) || a.city.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
   .slice(0, 5)
   .map(a => `${a.code} - ${a.city}`);
};

export const getAirlineSuggestions = (query: string): string[] => {
 if (!query || query.length > 3) return []; // only suggest if they are typing the prefix
 const q = query.toLowerCase();
 return AIRLINE_CODES
   .filter(a => a.code.toLowerCase().startsWith(q) || a.icao.toLowerCase().startsWith(q))
   .slice(0, 5)
   .map(a => `${a.code} - ${a.name}`);
};

export const resolveAirportCode = (query: string): string | null => {
  if (!query) return null;
  const q = query.toLowerCase().trim();
  if (q.length === 3 || q.length === 4) return q.toUpperCase();
  
  const match = AIRPORTS.find(a => 
      a.city.toLowerCase() === q || 
      a.name.toLowerCase() === q ||
      a.city.toLowerCase().includes(q)
  );
  
  return match ? match.code : null;
};

export const getAirportCoords = (code: string) => {
   const c = (code || '').toUpperCase();
   let airport = AIRPORTS.find(a => a.code === c);
   // ICAO fallback: US airports are the IATA code with a K prefix (KATL -> ATL)
   if (!airport && c.length === 4 && c.startsWith('K')) {
      airport = AIRPORTS.find(a => a.code === c.slice(1));
   }
   return airport ? { lat: airport.lat, lng: airport.lng } : { lat: 0, lng: 0 };
};

export const getMockAirports = (): Airport[] => {
 return AIRPORTS.map(a => ({
   code: a.code,
   name: a.name,
   city: a.city,
   state: "INTL",
   tsaWaitMinutes: Math.floor(Math.random() * 45) + 2,
   isPreCheckOpen: Math.random() > 0.1
 }));
};

export const getMockWeather = (city: string): Weather => ({
 city,
 temp: Math.floor(Math.random() * 40) + 50,
 condition: ["Sunny", "Partly Cloudy", "Rainy", "Clear"][Math.floor(Math.random() * 4)],
 humidity: Math.floor(Math.random() * 50) + 30,
 wind: Math.floor(Math.random() * 15) + 2
});

export const getMockPlaces = (): Place[] => [
 {
   id: '1', name: 'Terminal Bistro', category: 'Food', rating: 4.5, priceLevel: 2,
   priceEstimate: 45, priceDisplay: "$20-45", image: 'https://picsum.photos/200/200?random=1',
   coordinates: { x: 30, y: 40 }, description: "Upscale dining with a view of the runway.", websiteUrl: "#"
 },
 {
   id: '2', name: 'Skyline Hotel', category: 'Hotel', rating: 4.2, priceLevel: 3,
   priceEstimate: 210, priceDisplay: "$50-90", image: 'https://picsum.photos/200/200?random=2',
   coordinates: { x: 70, y: 20 }, description: "Luxury stay for the weary traveler.", websiteUrl: "#"
 },
 {
   id: '3', name: 'Aviation Museum', category: 'Attraction', rating: 4.8, priceLevel: 1,
   priceEstimate: 25, priceDisplay: "$10-20", image: 'https://picsum.photos/200/200?random=3',
   coordinates: { x: 50, y: 80 }, description: "Historical aircrafts and flight simulators.", websiteUrl: "#"
 },
];

export const getTransitRates = (city: string) => {
   const baseRate = city.length * 2 + 10;
   return {
       uber: { low: baseRate, high: baseRate + 15 },
       lyft: { low: baseRate - 2, high: baseRate + 12 },
       public: 2.50
   };
};

export const getMockSchedules = (): FlightSchedule[] => [
   { ident: "DL123", departure: new Date().toISOString(), arrival: new Date().toISOString(), origin: "ATL", destination: "LHR" }
];

export const getMockGates = (airportCode: string): GateInfo[] => [
   { gate: "A1", status: "Open", flight: "DL123" },
   { gate: "B4", status: "Closed", flight: null }
];

export const getMockAirspace = (): AustralianAirspace => ({
   activeFlights: 120,
   restrictions: ["R345 Active"],
   weatherAlerts: ["Turbulence over SYD"]
});

// US Cities/States for budget & note autocomplete
const US_LOCATIONS = [
  { city: 'New York', state: 'NY', zip: '10001' },
  { city: 'Los Angeles', state: 'CA', zip: '90001' },
  { city: 'Chicago', state: 'IL', zip: '60601' },
  { city: 'Houston', state: 'TX', zip: '77001' },
  { city: 'Phoenix', state: 'AZ', zip: '85001' },
  { city: 'Philadelphia', state: 'PA', zip: '19101' },
  { city: 'San Antonio', state: 'TX', zip: '78201' },
  { city: 'San Diego', state: 'CA', zip: '92101' },
  { city: 'Dallas', state: 'TX', zip: '75201' },
  { city: 'San Jose', state: 'CA', zip: '95101' },
  { city: 'Austin', state: 'TX', zip: '73301' },
  { city: 'Jacksonville', state: 'FL', zip: '32099' },
  { city: 'Fort Worth', state: 'TX', zip: '76101' },
  { city: 'Columbus', state: 'OH', zip: '43085' },
  { city: 'Charlotte', state: 'NC', zip: '28201' },
  { city: 'Indianapolis', state: 'IN', zip: '46201' },
  { city: 'San Francisco', state: 'CA', zip: '94101' },
  { city: 'Seattle', state: 'WA', zip: '98101' },
  { city: 'Denver', state: 'CO', zip: '80201' },
  { city: 'Nashville', state: 'TN', zip: '37201' },
  { city: 'Oklahoma City', state: 'OK', zip: '73101' },
  { city: 'Las Vegas', state: 'NV', zip: '89101' },
  { city: 'Portland', state: 'OR', zip: '97201' },
  { city: 'Miami', state: 'FL', zip: '33101' },
  { city: 'Atlanta', state: 'GA', zip: '30301' },
  { city: 'Tampa', state: 'FL', zip: '33601' },
  { city: 'Orlando', state: 'FL', zip: '32801' },
  { city: 'Minneapolis', state: 'MN', zip: '55401' },
  { city: 'Honolulu', state: 'HI', zip: '96801' },
  { city: 'Paris', state: 'France', zip: '75000' },
  { city: 'London', state: 'UK', zip: 'EC1A' },
  { city: 'Tokyo', state: 'Japan', zip: '100-0001' },
  { city: 'Dubai', state: 'UAE', zip: '00000' },
  { city: 'Rome', state: 'Italy', zip: '00100' },
  { city: 'Barcelona', state: 'Spain', zip: '08001' },
  { city: 'Amsterdam', state: 'Netherlands', zip: '1011' },
  { city: 'Sydney', state: 'Australia', zip: '2000' },
  { city: 'Singapore', state: 'Singapore', zip: '018956' },
  { city: 'Cancun', state: 'Mexico', zip: '77500' },
  { city: 'Toronto', state: 'Canada', zip: 'M5V' },
];

export const getLocationSuggestions = (query: string): { city: string; state: string; zip: string }[] => {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return US_LOCATIONS.filter(loc =>
    loc.city.toLowerCase().includes(q) ||
    loc.state.toLowerCase().includes(q) ||
    loc.zip.includes(q)
  ).slice(0, 6);
};
