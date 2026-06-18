


export enum FlightStatus {
  Scheduled = "Scheduled",
  OnTime = "On Time",
  Delayed = "Delayed",
  Cancelled = "Cancelled",
  Boarding = "Boarding",
  EnRoute = "En Route",
  Landed = "Landed"
}

export interface DelayInsight {
  reason: string;
  confidence: number;
  description: string;
}

export interface FlightPosition {
  latitude: number;
  longitude: number;
  altitude: number;
  timestamp: string;
  groundspeed?: number;
  heading?: number;
}

export interface Flight {
  id: string;
  ident: string;
  flightNumber: string;
  airline: string;
  status: FlightStatus;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;
  arrivalTime: string;
  gate?: string;
  terminal?: string;
  gateDestination?: string;
  terminalDestination?: string;
  estimatedDepartureTime?: string;
  actualDepartureTime?: string;
  estimatedArrivalTime?: string;
  actualArrivalTime?: string;
  aircraft?: string;
  tailNumber?: string;
  progress: number;
  delayMinutes?: number;
  durationMinutes?: number | null;
  price?: number;
  insight?: DelayInsight;
  websiteUrl?: string;
  inboundFlight?: {
    flightNumber: string;
    origin: string;
    status: string;
    arrivalTime: string;
  };
  track?: FlightPosition[];
}

export interface Airport {
  code: string;
  name: string;
  city: string;
  state: string;
  tsaWaitMinutes: number;
  isPreCheckOpen: boolean;
  lat?: number;
  lng?: number;
}

export interface HourlyForecast {
  time: string;
  temp: number;
  condition: string;
  icon?: string;
}

export interface DailyForecast {
  date: string;
  minTemp: number;
  maxTemp: number;
  condition: string;
  icon?: string;
}

export interface Weather {
  temp: number;
  condition: string;
  humidity: number;
  wind: number;
  city: string;
  feelsLike?: number;
  hourly?: HourlyForecast[];
  daily?: DailyForecast[];
}

export interface Place {
  id: string;
  name: string;
  category: 'Hotel' | 'Food' | 'Attraction';
  rating: number;
  priceLevel: number;
  image: string;
  priceEstimate: number;
  priceDisplay: string;
  coordinates: { x: number; y: number };
  description: string;
  websiteUrl?: string;
  distanceText?: string;
  durationText?: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  imageUrl?: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'apollo';
  timestamp: Date;
}

export enum Tab {
  Home = 'home',
  Fun = 'fun',
  Flights = 'flights',
  Explore = 'explore',
  Wander = 'wander', // Social Tab
  Apollo = 'apollo', // Center Tab (AI)
  Itinerary = 'itinerary', // Plans (Itinerary + Docs + Auth)
  About = 'about'
}

export interface BudgetItem {
  id: string;
  name: string;
  cost: number;
  category: 'Flight' | 'Food' | 'Attraction' | 'Hotel' | 'Other';
}

export interface Note {
  id: string;
  tripName: string;
  city: string;
  stateCountry: string;
  title: string;
  content: string;
  date: Date;
  isAiGenerated?: boolean;
}

export interface TripFlight {
  id: string;
  trip_id: string;
  flight_number: string;
  airline?: string;
  flight_date: string;
  departure_airport?: string;
  arrival_airport?: string;
  status: string;
}

export interface BudgetCategory {
  id: string;
  type: 'Flight' | 'Hotel' | 'Food' | 'Attraction' | 'Bars & Nightlife' | 'Other'; 
  label: string; 
  planned: number;
  allocated?: number;
}

export interface Trip {
  id: string;
  user_id: string;
  name: string;
  start_date?: string;
  end_date?: string;
  created_at: string;
  archived?: boolean;
  budget_limit?: number;
  destination?: string;
  travelers_count?: number;
  duration_days?: number;
  notes: Note[];
  budget_categories: BudgetCategory[];
  passes: Pass[];
  flights?: TripFlight[]; // Joined dynamically
  places?: Place[]; // Places saved from Explore
}

export interface Pass {
  id: string;
  type: 'Boarding Pass' | 'Hotel' | 'Train' | 'Event' | 'Other';
  provider: string;
  reference: string;
  details: string;
  date?: string;
}

export enum UserTier {
  Guest = "Bronze", // Guest
  Free = "Silver",   // Free
  Diamond = "Diamond",     // Pro
  Professional = "Professional",   // Crew
  Dev = "Dev"      // Dev
}

export type Theme = 'light' | 'dark' | 'amoled';
export type Language = 'en' | 'es' | 'fr' | 'de';

export interface UserPreferences {
  textSize: 'sm' | 'base' | 'lg';
  language: Language;
}

export interface GameState {
  isPlaying: boolean;
  score: number;
  highScore: number;
}

export interface FlightSchedule {
  ident: string;
  departure: string;
  arrival: string;
  origin: string;
  destination: string;
  airline?: string;
  aircraft?: string;
}

export interface AirportConditions {
  airportCode: string;
  delayIndex: number;
  delayReasons?: string[];
  weather: string;
  temp: number;
  visibility: string;
  wind: string;
}

export interface GateInfo {
  gate: string;
  status: string;
  flight: string | null;
}

export interface AustralianAirspace {
  activeFlights: number;
  restrictions: string[];
  weatherAlerts: string[];
}

export interface UserAccount {
  id: string;
  username: string;
  email?: string;
  passwordHash: string;
  tier: UserTier;
  savedTrips: string[]; // IDs of saved trips
  xp: number;
  level: number;
  promoOptIn?: boolean;
  rememberMe?: boolean;
  avatarUrl?: string;
  bio?: string;
  isPrivate?: boolean;
}

export const getRankTitle = (level: number): string => {
  if (level >= 50) return "Captain";
  if (level >= 20) return "First Officer";
  if (level >= 10) return "Flight Crew";
  if (level >= 5) return "Frequent Flyer";
  return "Passenger";
};