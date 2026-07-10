


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
  baggage?: string;
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
  latitude?: number;
  longitude?: number;
  heading?: number;
  altitude?: number;
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
  trialEndsAt?: string; // ISO date — free Diamond trial expiry
  savedTrips: string[]; // IDs of saved trips
  promoOptIn?: boolean;
  rememberMe?: boolean;
  avatarUrl?: string;
  bio?: string;
  isPrivate?: boolean;
}

// === AeroAPI Premium Types ===

export interface ForesightPrediction {
  predicted_out?: string;
  predicted_off?: string;
  predicted_on?: string;
  predicted_in?: string;
  predicted_out_source?: string;
  predicted_off_source?: string;
  predicted_on_source?: string;
  predicted_in_source?: string;
  predicted_taxi_out_duration?: number;
  predicted_taxi_out_duration_source?: string;
}

export interface FlightRouteWaypoint {
  name: string;
  latitude: number;
  longitude: number;
  distance_from_origin: number;
  distance_this_leg: number;
  distance_to_destination: number;
  outbound_course: number;
  type: string;
}

export interface FlightRoute {
  route_distance: string;
  fixes: FlightRouteWaypoint[];
}

export interface AirportInfo {
  code: string;
  code_icao: string;
  code_iata: string;
  name: string;
  city: string;
  state?: string;
  country?: string;
  timezone: string;
  latitude: number;
  longitude: number;
  wiki_url?: string;
  airport_info_url?: string;
}

export interface AirportFlightCounts {
  departed: number;
  enroute: number;
  scheduled_departures: number;
  scheduled_arrivals: number;
}

export interface AirportWeatherForecast {
  conditions: string;
  temp_air: number;
  temp_dewpoint: number;
  temp_perceived: number;
  wind_speed: number;
  wind_direction: number;
  visibility: string;
  cloud_coverage: string;
  pressure: number;
  timestamp: string;
}

export interface NearbyAirport {
  code: string;
  name: string;
  city: string;
  distance: number;
  heading: number;
}

export interface RouteStats {
  route_distance: number;
  avg_duration: number;
  filed_altitude: number;
  last_departure_time: string;
}

export interface OperatorInfo {
  icao: string;
  iata: string;
  name: string;
  callsign: string;
  country: string;
  location: string;
  shortname: string;
}

export interface OperatorFlightCounts {
  airborne: number;
  flights_last_24_hours: number;
}

export interface AircraftOwner {
  name: string;
  location: string;
  location2?: string;
  state?: string;
  website?: string;
}

export interface AircraftTypeInfo {
  type: string;
  manufacturer: string;
  description: string;
  engine_type?: string;
  engine_count?: number;
}

export interface DisruptionCount {
  entity_type: string;
  entity_id?: string;
  delays: number;
  cancellations: number;
  total: number;
}

export interface FlightAlert {
  id: number;
  ident?: string;
  origin?: string;
  destination?: string;
  aircraft_type?: string;
  date_start?: string;
  date_end?: string;
  channels: { target_url: string; channel_type: string }[];
  events: string[];
  enabled: boolean;
}

export interface GlobalDelay {
  airport_code: string;
  delay_index: number;
  reasons: string[];
}