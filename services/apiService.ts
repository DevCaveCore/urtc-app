
import { Weather, Place, Flight, NewsArticle, FlightPosition, FlightSchedule, GateInfo, AustralianAirspace, HourlyForecast, DailyForecast, AirportConditions, ForesightPrediction, FlightRoute, AirportInfo, AirportFlightCounts, AirportWeatherForecast, NearbyAirport, RouteStats, OperatorInfo, OperatorFlightCounts, AircraftOwner, AircraftTypeInfo, DisruptionCount, FlightAlert, GlobalDelay } from '../types';
import { fetchGeminiNews, fetchFutureFlightFromGemini } from './geminiService';
import { API_KEYS } from '../config';

// The feed's departure_delay field often lags reality. Cross-check it against
// the visible slip between scheduled and estimated/actual departure and trust
// whichever is larger.
const computeDelayMinutes = (f: any): number => {
  const reported = f.departure_delay ? Math.round(f.departure_delay / 60) : 0;
  let observed = 0;
  const sched = f.scheduled_out || f.scheduled_off;
  const est = f.actual_out || f.estimated_out || f.actual_off || f.estimated_off;
  if (sched && est) {
    observed = Math.round((new Date(est).getTime() - new Date(sched).getTime()) / 60000);
  }
  return Math.max(reported, observed, 0);
};

// AeroAPI reports airports as ICAO ("KATL") with the IATA code in code_iata
// ("ATL"). Prefer IATA — it's what travelers recognize and what our airport
// coordinate database is keyed by (a miss there anchors map paths at 0,0).
const airportCode = (a: any, fallback = 'Unknown'): string => {
  if (typeof a === 'string') return a || fallback;
  return a?.code_iata || a?.code || fallback;
};

// Friendly airline names — the feed only carries the ICAO operator code.
const OPERATOR_NAMES: Record<string, string> = {
  DAL: 'Delta Air Lines', AAL: 'American Airlines', UAL: 'United Airlines',
  SWA: 'Southwest Airlines', JBU: 'JetBlue Airways', ASA: 'Alaska Airlines',
  FFT: 'Frontier Airlines', NKS: 'Spirit Airlines', HAL: 'Hawaiian Airlines',
  AAY: 'Allegiant Air', ENY: 'Envoy Air', SKW: 'SkyWest Airlines',
  RPA: 'Republic Airways', EDV: 'Endeavor Air', JIA: 'PSA Airlines',
  BAW: 'British Airways', DLH: 'Lufthansa', AFR: 'Air France',
  KLM: 'KLM', UAE: 'Emirates', QTR: 'Qatar Airways', THY: 'Turkish Airlines',
  SIA: 'Singapore Airlines', CPA: 'Cathay Pacific', ANA: 'All Nippon Airways',
  JAL: 'Japan Airlines', KAL: 'Korean Air', QFA: 'Qantas',
  RYR: 'Ryanair', EZY: 'easyJet', ACA: 'Air Canada', WJA: 'WestJet',
  AMX: 'Aeroméxico', VOI: 'Volaris', IBE: 'Iberia', VIR: 'Virgin Atlantic',
};

const operatorName = (code: string | undefined | null, fallback = 'Unknown'): string =>
  code ? (OPERATOR_NAMES[code] || code) : fallback;

const handleApiError = (error: any, fallback: any) => {
  console.warn("API Call Failed:", error);
  throw error;
};

// Resilient fetch with retry + exponential backoff for flight API reliability
const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 3): Promise<Response> => {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // A hung upstream must not hang the UI forever
      const response = await fetch(url, { signal: AbortSignal.timeout(25000), ...options });
      if (response.ok) return response;
      // Don't retry 4xx client errors (bad request, not found, etc.)
      if (response.status >= 400 && response.status < 500) return response;
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (err: any) {
      lastError = err;
    }
    // Exponential backoff: 1s, 2s, 4s
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  throw lastError || new Error('Fetch failed after retries');
};

// Shared OpenWeather fetch — works with either a city name or exact coordinates,
// so the Explore tab's weather always matches the same location as the places feed.
const fetchWeatherCore = async (locationQuery: string): Promise<Weather> => {
  const response = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?${locationQuery}&appid=${API_KEYS.OWM}&units=imperial`
  );
  if (!response.ok) throw new Error('Weather API Error');
  const data = await response.json();

  // Also fetch 5-day / 3-hour forecast to extract some hourly data
  const forecastResponse = await fetch(
    `https://api.openweathermap.org/data/2.5/forecast?${locationQuery}&appid=${API_KEYS.OWM}&units=imperial`
  );
  let hourly: HourlyForecast[] = [];
  let daily: DailyForecast[] = [];

  if (forecastResponse.ok) {
      const forecastData = await forecastResponse.json();
      // A truncated/error-shaped 200 must not crash the whole Explore tab
      const list: any[] = Array.isArray(forecastData?.list) ? forecastData.list : [];
      // Parse hourly (3-hour intervals)
      hourly = list.slice(0, 8).map((item: any) => ({
          time: new Date(item.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          temp: Math.round(item?.main?.temp ?? 0),
          condition: item?.weather?.[0]?.main ?? 'Clear',
          icon: item?.weather?.[0]?.icon
      }));

      // Parse daily (naive approach: group by day)
      const daysMap: any = {};
      list.forEach((item: any) => {
          const date = new Date(item.dt * 1000).toLocaleDateString();
          const cond = item?.weather?.[0]?.main ?? 'Clear';
          if (!daysMap[date]) daysMap[date] = { minTemp: 1000, maxTemp: -1000, conditions: {} };
          daysMap[date].minTemp = Math.min(daysMap[date].minTemp, item?.main?.temp_min ?? 1000);
          daysMap[date].maxTemp = Math.max(daysMap[date].maxTemp, item?.main?.temp_max ?? -1000);
          daysMap[date].conditions[cond] = (daysMap[date].conditions[cond] || 0) + 1;
      });
      daily = Object.keys(daysMap).slice(0, 5).map(date => {
          const day = daysMap[date];
          const dominantCondition = Object.keys(day.conditions).reduce((a, b) => day.conditions[a] > day.conditions[b] ? a : b);
          return {
              date,
              minTemp: Math.round(day.minTemp),
              maxTemp: Math.round(day.maxTemp),
              condition: dominantCondition
          };
      });
  }

  return {
    city: data?.name ?? '',
    temp: Math.round(data?.main?.temp ?? 0),
    feelsLike: Math.round(data?.main?.feels_like ?? data?.main?.temp ?? 0),
    condition: data?.weather?.[0]?.main ?? 'Clear',
    humidity: data?.main?.humidity ?? 0,
    wind: Math.round(data?.wind?.speed ?? 0),
    hourly,
    daily
  };
};

export const fetchRealWeather = async (city: string): Promise<Weather> => {
  try {
    return await fetchWeatherCore(`q=${encodeURIComponent(city)}`);
  } catch (error) {
    console.error("fetchRealWeather error:", error);
    throw error;
  }
};

export const fetchRealWeatherByCoords = async (lat: number, lng: number): Promise<Weather> => {
  try {
    return await fetchWeatherCore(`lat=${lat}&lon=${lng}`);
  } catch (error) {
    console.error("fetchRealWeatherByCoords error:", error);
    throw error;
  }
};

// Google Air Quality API — Universal AQI (0-100, higher = cleaner air)
export const fetchAirQuality = async (lat: number, lng: number): Promise<{ aqi: number; category: string } | null> => {
  try {
    const res = await fetch(`https://airquality.googleapis.com/v1/currentConditions:lookup?key=${API_KEYS.GOOGLE_MAPS}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: { latitude: lat, longitude: lng } })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const idx = data.indexes?.[0];
    return idx ? { aqi: idx.aqi, category: idx.category || '' } : null;
  } catch (e) { return null; }
};

export const fetchRealPlaces = async (city: string, lat?: number, lng?: number): Promise<Place[]> => {
  // Currently we use Google Places SDK in the UI instead.
  // We return an empty array here since mocks are disabled.
  return [];
};

export const fetchRealFlights = async (query: string, flightDate?: string, airlineFilter?: string, destQuery?: string): Promise<Flight[]> => {
  try {
    const origin = query ? query.toUpperCase().replace(/\s/g, '') : null;
    const dest = destQuery ? destQuery.toUpperCase().replace(/\s/g, '') : null;
    let url = "";
    
    let isHistorical = false;
    let dateParams = "";
    if (flightDate) {
        // flightDate is YYYY-MM-DD. Interpret it as the user's local day, not UTC —
        // otherwise an evening flight on the picked date lands on the next UTC day
        // and vanishes from results (or the previous evening's flight shows instead).
        const localStart = new Date(`${flightDate}T00:00:00`);
        const localEnd = new Date(localStart.getTime() + 24 * 60 * 60 * 1000);
        const toApiTime = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
        dateParams = `?start=${toApiTime(localStart)}&end=${toApiTime(localEnd)}`;

        // Reuse the LOCAL-midnight timestamp — re-parsing "YYYY-MM-DD" with
        // new Date() reads it as UTC and shifts the historical cutoff a day.
        const tenDaysAgo = Date.now() - (10 * 24 * 60 * 60 * 1000);
        if (localStart.getTime() < tenDaysAgo) {
            isHistorical = true;
        }
    }

    const basePath = isHistorical ? "/aeroapi/history" : "/aeroapi";

    if (origin && /\d/.test(origin)) {
      // It's a flight ident (DL1182)
      url = `${basePath}/flights/${origin}${dateParams}`;
    } else if (origin && dest) {
      // Both origin and dest provided
      const airportCode = origin; 
      const destCode = dest;
      url = `${basePath}/airports/${airportCode}/flights/to/${destCode}${dateParams}`;
    } else if (origin && !dest) {
      // Only origin provided (Departures)
      const airportCode = origin; 
      url = `${basePath}/airports/${airportCode}/flights/${isHistorical ? 'departures' : 'scheduled_departures'}${dateParams}`;
    } else if (!origin && dest) {
      // Only dest provided (Arrivals)
      const destCode = dest;
      url = `${basePath}/airports/${destCode}/flights/${isHistorical ? 'arrivals' : 'scheduled_arrivals'}${dateParams}`;
    } else {
      // Fallback
      url = `${basePath}/flights/DL1182${dateParams}`;
    }

    const response = await fetchWithRetry(url, {
      headers: {
        'x-apikey': API_KEYS.FLIGHTAWARE,
        'Accept': 'application/json; charset=UTF-8'
      }
    });

    if (!response.ok) throw new Error('FlightAware API Error');
    const data = await response.json();
    
    let flightsArray = data.flights || data.scheduled_departures || data.scheduled_arrivals || data.departures || data.arrivals || [];

    if (airlineFilter && airlineFilter !== 'ALL') {
        flightsArray = flightsArray.filter((rawFlight: any) => {
            const f = rawFlight.segments ? rawFlight.segments[0] : rawFlight;
            return f.operator === airlineFilter || (f.ident && f.ident.startsWith(airlineFilter));
        });
    }

    if (flightsArray.length === 0 && origin && /\d/.test(origin) && flightDate) {
        console.log("AeroAPI returned no results. Falling back to Apollo Google Flights prediction...");
        return await fetchFutureFlightFromGemini(origin, flightDate);
    }

    const mappedFlights = flightsArray.map((rawFlight: any, i: number) => {
      const f = rawFlight.segments ? rawFlight.segments[0] : rawFlight;
      // Calculate real duration from timestamps
      let durationMinutes: number | null = null;
      if (f.scheduled_out && f.scheduled_in) {
        const dep = new Date(f.scheduled_out).getTime();
        const arr = new Date(f.scheduled_in).getTime();
        if (arr > dep) durationMinutes = Math.round((arr - dep) / 60000);
      }
      return {
        id: f.fa_flight_id || f.ident || `flight-${i}`,
        ident: f.ident,
        flightNumber: f.ident,
        airline: operatorName(f.operator),
        status: f.status || "Scheduled",
        departureAirport: airportCode(f.origin),
        arrivalAirport: airportCode(f.destination),
        departureTime: f.scheduled_out,
        arrivalTime: f.scheduled_in,
        estimatedDepartureTime: f.estimated_out,
        actualDepartureTime: f.actual_out,
        estimatedArrivalTime: f.estimated_in,
        actualArrivalTime: f.actual_in,
        gate: f.gate_origin,
        terminal: f.terminal_origin,
        gateDestination: f.gate_destination,
        terminalDestination: f.terminal_destination,
        baggage: f.baggage_claim,
        aircraft: f.aircraft_type,
        tailNumber: f.registration,
        progress: f.progress_percent || 0,
        delayMinutes: computeDelayMinutes(f),
        durationMinutes: durationMinutes ?? (f.filed_ete ? Math.round(f.filed_ete / 60) : null),
      };
    });

    // No date picked: order by what the passenger most likely wants —
    // in-the-air first, then the next upcoming departure, then recent history.
    if (!flightDate) {
      const now = Date.now();
      const relevance = (fl: any) => {
        const dep = new Date(fl.departureTime || 0).getTime() || 0;
        const out = fl.actualDepartureTime ? new Date(fl.actualDepartureTime).getTime() : 0;
        // Departed but not yet arrived = the flight in the air right now.
        // progress_percent reads 0 while taxiing and 100 on final approach,
        // so it can't be trusted to gate this. The 20h cap guards against
        // stale records that never received an arrival timestamp.
        const active = !!out && !fl.actualArrivalTime && (now - out) < 20 * 60 * 60 * 1000;
        if (active) return -1;
        if (dep >= now) return dep - now;
        return (now - dep) + 1e12;
      };
      mappedFlights.sort((a: any, b: any) => relevance(a) - relevance(b));
    } else {
      // Explicit date: the API returns newest-first — show the day in takeoff order.
      mappedFlights.sort((a: any, b: any) => (new Date(a.departureTime || 0).getTime() || 0) - (new Date(b.departureTime || 0).getTime() || 0));
    }

    return mappedFlights;
  } catch (error) {
    console.error("fetchRealFlights error:", error);
    
    // Ultimate fallback if FlightAware completely fails and we have a date
    if (query && /\d/.test(query) && flightDate) {
      console.log("AeroAPI failed completely. Falling back to Apollo prediction...");
      return await fetchFutureFlightFromGemini(query.toUpperCase().replace(/\s/g, ''), flightDate);
    }
    
    return [];
  }
};

export const fetchFleetFlights = async (operatorCode: string): Promise<Flight[]> => {
  try {
    const url = `/aeroapi/operators/${operatorCode}/flights`;
    const response = await fetchWithRetry(url, {
      headers: {
        'x-apikey': API_KEYS.FLIGHTAWARE,
        'Accept': 'application/json; charset=UTF-8'
      }
    });

    if (!response.ok) throw new Error('FlightAware API Error');
    const data = await response.json();
    
    const flightsArray = [...(data.enroute || []), ...(data.arrivals || []), ...(data.scheduled || []), ...(data.flights || [])];

    // Only return airborne flights (or those with position data)
    return flightsArray
      .filter((f: any) => f.status && f.status.toLowerCase().includes('en route'))
      .map((f: any, i: number) => {
        return {
          id: f.fa_flight_id || f.ident || `fleet-${i}`,
          ident: f.ident,
          flightNumber: f.ident,
          airline: operatorName(f.operator || operatorCode),
          status: f.status || "En Route",
          departureAirport: airportCode(f.origin),
          arrivalAirport: airportCode(f.destination),
          departureTime: f.scheduled_out,
          arrivalTime: f.scheduled_in,
          estimatedDepartureTime: f.estimated_out,
          actualDepartureTime: f.actual_out,
          estimatedArrivalTime: f.estimated_in,
          actualArrivalTime: f.actual_in,
          aircraft: f.aircraft_type,
          progress: f.progress_percent || 0,
          delayMinutes: f.departure_delay || 0,
          durationMinutes: null,
          latitude: f.last_position?.latitude,
          longitude: f.last_position?.longitude,
          heading: f.last_position?.heading,
          altitude: f.last_position?.altitude
        };
    });
  } catch (error) {
    console.error("fetchFleetFlights error:", error);
    return [];
  }
};

export const fetchRandomFlight = async (): Promise<Flight | null> => {
  try {
    let targetAirport = 'KATL'; // Fallback
    try {
        const ipRes = await fetch('https://ipapi.co/json/');
        if (ipRes.ok) {
            const ipData = await ipRes.json();
            const regionalMap: Record<string, string> = {
                'CA': 'KLAX', 'NY': 'KJFK', 'TX': 'KDFW', 'FL': 'KMIA', 
                'IL': 'KORD', 'GA': 'KATL', 'WA': 'KSEA', 'CO': 'KDEN',
                'NV': 'KLAS', 'MA': 'KBOS', 'PA': 'KPHL', 'AZ': 'KPHX',
                'ENG': 'EGLL', 'IDF': 'LFPG', 'HES': 'EDDF', 'TOK': 'RJTT', 'NSW': 'YSSY'
            };
            if (ipData.region_code && regionalMap[ipData.region_code]) {
                targetAirport = regionalMap[ipData.region_code];
            } else if (ipData.country === 'GB') targetAirport = 'EGLL';
            else if (ipData.country === 'FR') targetAirport = 'LFPG';
            else if (ipData.country === 'JP') targetAirport = 'RJTT';
            else if (ipData.country === 'AU') targetAirport = 'YSSY';
            else if (ipData.country === 'DE') targetAirport = 'EDDF';
        }
    } catch (e) {
        console.warn("Could not determine geographic location for random flight, using KATL.");
    }

    const response = await fetch(
      `/aeroapi/airports/${targetAirport}/flights/scheduled_departures`,
      {
        headers: {
          'x-apikey': API_KEYS.FLIGHTAWARE,
          'Accept': 'application/json; charset=UTF-8'
        }
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const flightsArray = data.scheduled_departures || data.flights || [];
    if (!flightsArray || flightsArray.length === 0) return null;
    
    const f = flightsArray[Math.floor(Math.random() * Math.min(flightsArray.length, 10))];
    
    let durationMinutes: number | null = null;
    if (f.scheduled_out && f.scheduled_in) {
      const dep = new Date(f.scheduled_out).getTime();
      const arr = new Date(f.scheduled_in).getTime();
      if (arr > dep) durationMinutes = Math.round((arr - dep) / 60000);
    }
    return {
      id: f.fa_flight_id || f.ident,
      ident: f.ident,
      flightNumber: f.ident,
      airline: operatorName(f.operator),
      status: f.status || "En Route",
      departureAirport: airportCode(f.origin, "ATL"),
      arrivalAirport: airportCode(f.destination, "JFK"),
      departureTime: f.scheduled_out,
      arrivalTime: f.scheduled_in,
      gate: f.gate_origin,
      terminal: f.terminal_origin,
      aircraft: f.aircraft_type,
      progress: f.progress_percent || Math.floor(Math.random() * 60 + 10),
      delayMinutes: 0,
      durationMinutes,
    };
  } catch (e) {
    return null;
  }
};

export const fetchFlightTrack = async (flightId: string): Promise<FlightPosition[]> => {
  try {
    const response = await fetch(
      `/aeroapi/flights/${flightId}/track`,
      {
        headers: {
          'x-apikey': API_KEYS.FLIGHTAWARE,
          'Accept': 'application/json; charset=UTF-8'
        }
      }
    );
    if (!response.ok) throw new Error("Track API Error");
    const data = await response.json();
    return data.positions || [];
  } catch (e) {
    return [];
  }
}

export const fetchTravelNews = async (query: string): Promise<NewsArticle[]> => {
  try {
    const aiNews = await fetchGeminiNews(query);
    if (aiNews && aiNews.length > 0) return aiNews;
    throw new Error("AI News returned empty");
  } catch (error) {
    return [
      {
        id: '1', title: `Weekend Guide: Best food spots in ${query}`, source: 'Local Eats',
        url: '#', publishedAt: 'Today', imageUrl: 'https://picsum.photos/400/300?random=1'
      },
      {
        id: '2', title: `Top 5 Hidden Gems in ${query}`, source: 'Travel Insider',
        url: '#', publishedAt: 'Yesterday', imageUrl: 'https://picsum.photos/400/300?random=2'
      }
    ];
  }
}

export const fetchSchedules = async (origin?: string, dest?: string, flightDate?: string, airlineFilter?: string): Promise<FlightSchedule[]> => {
  try {
    if (!origin && !dest) return [];
    
    let isHistorical = false;
    let dateParams = "";
    if (flightDate) {
        // LOCAL day window, matching fetchRealFlights — the old hard-coded
        // UTC window dropped evening flights for users west of Greenwich.
        const localStart = new Date(`${flightDate}T00:00:00`);
        const localEnd = new Date(localStart.getTime() + 24 * 60 * 60 * 1000);
        const toApiTime = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
        dateParams = `?start=${toApiTime(localStart)}&end=${toApiTime(localEnd)}`;

        const tenDaysAgo = Date.now() - (10 * 24 * 60 * 60 * 1000);
        if (localStart.getTime() < tenDaysAgo) {
            isHistorical = true;
        }
    }

    const basePath = isHistorical ? "/aeroapi/history" : "/aeroapi";
    let url = "";

    if (origin && dest) {
        url = `${basePath}/airports/${origin}/flights/to/${dest}${dateParams}`;
    } else if (origin && !dest) {
        url = `${basePath}/airports/${origin}/flights/${isHistorical ? 'departures' : 'scheduled_departures'}${dateParams}`;
    } else if (!origin && dest) {
        url = `${basePath}/airports/${dest}/flights/${isHistorical ? 'arrivals' : 'scheduled_arrivals'}${dateParams}`;
    }

    const response = await fetch(url, {
      headers: {
        'x-apikey': API_KEYS.FLIGHTAWARE,
        'Accept': 'application/json; charset=UTF-8'
      }
    });
    if (!response.ok) throw new Error('FlightAware API Error');
    const data = await response.json();
    let flights = data.flights || data.scheduled_departures || [];
    
    // Filter by destination if provided and we couldn't use the /to/ endpoint properly
    // But since we use /to/, it should be exact. We'll leave the filter just in case.
    if (dest && !data.flights) {
        // The user types IATA ("LAX") but the feed reports ICAO ("KLAX") — accept either.
        flights = flights.filter((f: any) => f.destination?.code_iata === dest || f.destination?.code === dest || f.destination === dest);
    }

    if (airlineFilter && airlineFilter !== 'ALL') {
        flights = flights.filter((rawFlight: any) => {
            const f = rawFlight.segments ? rawFlight.segments[0] : rawFlight;
            return f.operator === airlineFilter || (f.ident && f.ident.startsWith(airlineFilter));
        });
    }
    
    return flights.map((rawFlight: any) => {
      const f = rawFlight.segments ? rawFlight.segments[0] : rawFlight;
      return {
      ident: f.ident,
      departure: f.scheduled_out,
      arrival: f.scheduled_in,
      origin: airportCode(f.origin, origin),
      destination: airportCode(f.destination, dest),
      airline: operatorName(f.operator),
      aircraft: f.aircraft_type
      };
    });
  } catch (e) {
    console.error("fetchSchedules error:", e);
    return [];
  }
};

export const fetchAirportConditions = async (code: string): Promise<AirportConditions | null> => {
  try {
    // Combine delays and weather info for an airport
    const [delaysRes, weatherRes] = await Promise.all([
        fetch(`/aeroapi/airports/${code}/delays`, { headers: { 'x-apikey': API_KEYS.FLIGHTAWARE } }),
        fetch(`/aeroapi/airports/${code}/weather/observations?temperature_units=F&return_nearby_weather=true`, { headers: { 'x-apikey': API_KEYS.FLIGHTAWARE } })
    ]);
    // A 404 from /delays simply means "no delays reported" — treat as clear
    const delays = delaysRes.ok ? await delaysRes.json() : null;
    const weather = weatherRes.ok ? await weatherRes.json() : null;
    const obs = weather?.observations?.[0];

    // AeroAPI reports delay_secs, not an index. Convert to a friendly 0-5 scale.
    const delaySecs = delays?.delay_secs || 0;
    const delayIndex = Math.min(5, Math.round(delaySecs / 900)); // every 15 min of delay = +1

    return {
        airportCode: code,
        delayIndex,
        delayReasons: (delays?.reasons || []).map((r: any) => r.reason || r.category || '').filter(Boolean),
        weather: obs?.cloud_friendly || obs?.conditions || 'Clear',
        temp: obs?.temp_air ?? 0,
        visibility: obs?.visibility != null ? `${obs.visibility} ${obs.visibility_units || 'mi'}` : '10 miles',
        wind: obs?.wind_speed ? `${obs.wind_speed} ${obs.wind_units || 'kts'}` : 'Calm'
    };
  } catch (e) {
    return null;
  }
};

export const fetchAirportGates = async (code: string): Promise<GateInfo[]> => {
  return [];
};

export const fetchAustralianAirspace = async (): Promise<AustralianAirspace | null> => {
  return null;
};

// ==========================================
// PHASE 1: FORESIGHT ML PREDICTIONS
// ==========================================

export const fetchForesightFlight = async (ident: string, flightDate?: string): Promise<{ flight: Flight; foresight: ForesightPrediction } | null> => {
  try {
    let url = `/aeroapi/foresight/flights/${ident}`;
    if (flightDate) {
      url += `?start=${flightDate}T00:00:00Z&end=${flightDate}T23:59:59Z`;
    }
    const response = await fetchWithRetry(url, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return null;
    const data = await response.json();
    const flights = data.flights || [];
    if (flights.length === 0) return null;
    const f = flights[0];
    return {
      flight: {
        id: f.fa_flight_id || f.ident, ident: f.ident, flightNumber: f.ident,
        airline: operatorName(f.operator), status: f.status || 'Scheduled',
        departureAirport: airportCode(f.origin), arrivalAirport: airportCode(f.destination),
        departureTime: f.scheduled_out, arrivalTime: f.scheduled_in,
        estimatedDepartureTime: f.estimated_out, actualDepartureTime: f.actual_out,
        estimatedArrivalTime: f.estimated_in, actualArrivalTime: f.actual_in,
        gate: f.gate_origin, terminal: f.terminal_origin,
        gateDestination: f.gate_destination, terminalDestination: f.terminal_destination,
        aircraft: f.aircraft_type, tailNumber: f.registration,
        progress: f.progress_percent || 0, delayMinutes: f.departure_delay || 0,
        durationMinutes: f.filed_ete ? Math.round(f.filed_ete / 60) : null,
      },
      foresight: {
        predicted_out: f.predicted_out, predicted_off: f.predicted_off,
        predicted_on: f.predicted_on, predicted_in: f.predicted_in,
        predicted_out_source: f.predicted_out_source, predicted_off_source: f.predicted_off_source,
        predicted_on_source: f.predicted_on_source, predicted_in_source: f.predicted_in_source,
        predicted_taxi_out_duration: f.predicted_taxi_out_duration, predicted_taxi_out_duration_source: f.predicted_taxi_out_duration_source
      }
    };
  } catch (e) { console.error('fetchForesightFlight error:', e); return null; }
};

export const fetchForesightPosition = async (faFlightId: string): Promise<{ position: FlightPosition; foresight: ForesightPrediction } | null> => {
  try {
    const response = await fetch(`/aeroapi/foresight/flights/${faFlightId}/position`, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return null;
    const data = await response.json();
    const lp = data.last_position;
    if (!lp) return null;
    return {
      position: { latitude: lp.latitude, longitude: lp.longitude, altitude: lp.altitude, timestamp: lp.timestamp, groundspeed: lp.groundspeed, heading: lp.heading },
      foresight: { predicted_out: data.predicted_out, predicted_off: data.predicted_off, predicted_on: data.predicted_on, predicted_in: data.predicted_in, predicted_out_source: data.predicted_out_source, predicted_off_source: data.predicted_off_source, predicted_on_source: data.predicted_on_source, predicted_in_source: data.predicted_in_source, predicted_taxi_out_duration: data.predicted_taxi_out_duration, predicted_taxi_out_duration_source: data.predicted_taxi_out_duration_source }
    };
  } catch (e) { console.error('fetchForesightPosition error:', e); return null; }
};

// ==========================================
// PHASE 2: FLIGHT POSITION / ROUTE / MAP
// ==========================================

export const fetchFlightPosition = async (faFlightId: string): Promise<FlightPosition | null> => {
  try {
    const response = await fetch(`/aeroapi/flights/${faFlightId}/position`, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return null;
    const data = await response.json();
    const lp = data.last_position;
    if (!lp) return null;
    return { latitude: lp.latitude, longitude: lp.longitude, altitude: lp.altitude, timestamp: lp.timestamp, groundspeed: lp.groundspeed, heading: lp.heading };
  } catch (e) { console.error('fetchFlightPosition error:', e); return null; }
};

export const fetchFlightRoute = async (faFlightId: string): Promise<FlightRoute | null> => {
  try {
    const response = await fetch(`/aeroapi/flights/${faFlightId}/route`, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) { console.error('fetchFlightRoute error:', e); return null; }
};

export const fetchFlightMapImage = async (faFlightId: string, width = 640, height = 480): Promise<string | null> => {
  try {
    const layers = 'layer_on=radar&layer_on=track&layer_on=airports&layer_on=water&show_airports=true&show_data_block=true&airports_expand_view=true';
    const response = await fetch(`/aeroapi/flights/${faFlightId}/map?width=${width}&height=${height}&${layers}`, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.map || null;
  } catch (e) { console.error('fetchFlightMapImage error:', e); return null; }
};

// ==========================================
// PHASE 3: ADVANCED GEOSPATIAL SEARCH
// ==========================================

export const searchFlightsInArea = async (bounds: { north: number; south: number; east: number; west: number }, filters?: { airline?: string; aboveAltitude?: number; belowAltitude?: number }): Promise<Flight[]> => {
  try {
    let query = `-latlong "${bounds.south} ${bounds.west} ${bounds.north} ${bounds.east}"`;
    if (filters?.airline) query += ` -airline ${filters.airline}`;
    if (filters?.aboveAltitude) query += ` -aboveAltitude ${filters.aboveAltitude}`;
    if (filters?.belowAltitude) query += ` -belowAltitude ${filters.belowAltitude}`;
    const response = await fetch(`/aeroapi/flights/search?query=${encodeURIComponent(query)}`, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.flights || []).map((f: any, i: number) => ({
      id: f.fa_flight_id || f.ident || `search-${i}`, ident: f.ident, flightNumber: f.ident,
      airline: f.ident_icao?.substring(0, 3) || 'Unknown', status: 'En Route',
      departureAirport: airportCode(f.origin), arrivalAirport: airportCode(f.destination),
      departureTime: f.actual_off, arrivalTime: f.actual_on, aircraft: f.aircraft_type,
      progress: 50, delayMinutes: 0, durationMinutes: null,
      latitude: f.last_position?.latitude, longitude: f.last_position?.longitude,
      heading: f.last_position?.heading, altitude: f.last_position?.altitude,
    }));
  } catch (e) { console.error('searchFlightsInArea error:', e); return []; }
};

export const searchFlightsAdvanced = async (query: string): Promise<Flight[]> => {
  try {
    const response = await fetch(`/aeroapi/flights/search/advanced?query=${encodeURIComponent(query)}`, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.flights || []).map((f: any, i: number) => ({
      id: f.fa_flight_id || f.ident || `adv-${i}`, ident: f.ident, flightNumber: f.ident,
      airline: f.ident_icao?.substring(0, 3) || 'Unknown', status: 'En Route',
      departureAirport: airportCode(f.origin), arrivalAirport: airportCode(f.destination),
      departureTime: f.actual_off, arrivalTime: f.actual_on, aircraft: f.aircraft_type,
      progress: 50, delayMinutes: 0, durationMinutes: null,
      latitude: f.last_position?.latitude, longitude: f.last_position?.longitude,
      heading: f.last_position?.heading, altitude: f.last_position?.altitude,
    }));
  } catch (e) { console.error('searchFlightsAdvanced error:', e); return []; }
};

export const searchFlightCount = async (query: string): Promise<number> => {
  try {
    const response = await fetch(`/aeroapi/flights/search/count?query=${encodeURIComponent(query)}`, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return 0;
    const data = await response.json();
    return data.count || 0;
  } catch (e) { return 0; }
};

// ==========================================
// PHASE 4: AIRPORT INTELLIGENCE
// ==========================================

export const fetchAirportInfo = async (code: string): Promise<AirportInfo | null> => {
  try {
    const response = await fetch(`/aeroapi/airports/${code}`, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) { return null; }
};

export const fetchAirportFlightCounts = async (code: string): Promise<AirportFlightCounts | null> => {
  try {
    const response = await fetch(`/aeroapi/airports/${code}/flights/counts`, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) { return null; }
};

export const fetchAirportForecast = async (code: string): Promise<AirportWeatherForecast[] | null> => {
  try {
    const response = await fetch(`/aeroapi/airports/${code}/weather/forecast`, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.decoded_forecast?.lines || [];
  } catch (e) { return null; }
};

export const fetchNearbyAirports = async (code: string, radius = 50): Promise<NearbyAirport[]> => {
  try {
    const response = await fetch(`/aeroapi/airports/${code}/nearby?radius=${radius}`, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.airports || []).map((a: any) => ({ code: a.airport_code || a.code_iata || a.code_icao, name: a.name, city: a.city, distance: a.distance, heading: a.heading }));
  } catch (e) { return []; }
};

export const fetchNearbyAirportsByLocation = async (lat: number, lng: number, radius = 50): Promise<NearbyAirport[]> => {
  try {
    const response = await fetch(`/aeroapi/airports/nearby?latitude=${lat}&longitude=${lng}&radius=${radius}`, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.airports || []).map((a: any) => ({ code: a.airport_code || a.code_iata || a.code_icao, name: a.name, city: a.city, distance: a.distance, heading: a.heading }));
  } catch (e) { return []; }
};

export const fetchRouteStats = async (origin: string, dest: string): Promise<RouteStats | null> => {
  try {
    const response = await fetch(`/aeroapi/airports/${origin}/routes/${dest}`, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) { return null; }
};

export const fetchGlobalDelays = async (): Promise<GlobalDelay[]> => {
  try {
    const response = await fetch('/aeroapi/airports/delays', {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.delays || []).map((d: any) => ({ airport_code: d.airport, delay_index: Math.min(5, Math.round((d.delay_secs || 0) / 900)), reasons: (d.reasons || []).map((r: any) => r.reason || r.category || '').filter(Boolean) }));
  } catch (e) { return []; }
};

// ==========================================
// PHASE 5: OPERATOR INTELLIGENCE
// ==========================================

export const fetchOperatorInfo = async (code: string): Promise<OperatorInfo | null> => {
  try {
    const response = await fetch(`/aeroapi/operators/${code}`, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) { return null; }
};

export const fetchOperatorFlightCounts = async (code: string): Promise<OperatorFlightCounts | null> => {
  try {
    const response = await fetch(`/aeroapi/operators/${code}/flights/counts`, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) { return null; }
};

export const fetchOperatorEnrouteFlights = async (code: string): Promise<Flight[]> => {
  try {
    const response = await fetchWithRetry(`/aeroapi/operators/${code}/flights/enroute`, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.enroute || data.flights || []).map((f: any, i: number) => ({
      id: f.fa_flight_id || f.ident || `enroute-${i}`, ident: f.ident, flightNumber: f.ident,
      airline: operatorName(f.operator || code), status: f.status || 'En Route',
      departureAirport: airportCode(f.origin), arrivalAirport: airportCode(f.destination),
      departureTime: f.scheduled_out, arrivalTime: f.scheduled_in,
      aircraft: f.aircraft_type, progress: f.progress_percent || 0, delayMinutes: f.departure_delay || 0, durationMinutes: null,
      latitude: f.last_position?.latitude, longitude: f.last_position?.longitude,
      heading: f.last_position?.heading, altitude: f.last_position?.altitude,
    }));
  } catch (e) { console.error('fetchOperatorEnrouteFlights error:', e); return []; }
};

export const fetchOperatorScheduledFlights = async (code: string): Promise<Flight[]> => {
  try {
    const response = await fetch(`/aeroapi/operators/${code}/flights/scheduled`, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.scheduled || data.flights || []).map((f: any, i: number) => ({
      id: f.fa_flight_id || f.ident || `sched-${i}`, ident: f.ident, flightNumber: f.ident,
      airline: operatorName(f.operator || code), status: f.status || 'Scheduled',
      departureAirport: airportCode(f.origin), arrivalAirport: airportCode(f.destination),
      departureTime: f.scheduled_out, arrivalTime: f.scheduled_in,
      aircraft: f.aircraft_type, progress: 0, delayMinutes: f.departure_delay || 0, durationMinutes: null,
    }));
  } catch (e) { return []; }
};

// ==========================================
// PHASE 6: FULL HISTORY ACCESS
// ==========================================

export const fetchHistoricalFlight = async (ident: string, flightDate?: string): Promise<Flight[]> => {
  try {
    let url = `/aeroapi/history/flights/${ident}`;
    if (flightDate) url += `?start=${flightDate}T00:00:00Z&end=${flightDate}T23:59:59Z`;
    const response = await fetchWithRetry(url, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.flights || []).map((f: any, i: number) => ({
      id: f.fa_flight_id || f.ident || `hist-${i}`, ident: f.ident, flightNumber: f.ident,
      airline: operatorName(f.operator), status: f.status || 'Landed',
      departureAirport: airportCode(f.origin), arrivalAirport: airportCode(f.destination),
      departureTime: f.scheduled_out, arrivalTime: f.scheduled_in,
      estimatedDepartureTime: f.estimated_out, actualDepartureTime: f.actual_out,
      estimatedArrivalTime: f.estimated_in, actualArrivalTime: f.actual_in,
      gate: f.gate_origin, terminal: f.terminal_origin,
      gateDestination: f.gate_destination, terminalDestination: f.terminal_destination,
      aircraft: f.aircraft_type, tailNumber: f.registration,
      progress: f.progress_percent || 100, delayMinutes: f.departure_delay || 0,
      durationMinutes: f.filed_ete ? Math.round(f.filed_ete / 60) : null,
    }));
  } catch (e) { console.error('fetchHistoricalFlight error:', e); return []; }
};

export const fetchHistoricalTrack = async (faFlightId: string): Promise<FlightPosition[]> => {
  try {
    const response = await fetch(`/aeroapi/history/flights/${faFlightId}/track`, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.positions || [];
  } catch (e) { return []; }
};

export const fetchHistoricalMapImage = async (faFlightId: string, width = 640, height = 480): Promise<string | null> => {
  try {
    const response = await fetch(`/aeroapi/history/flights/${faFlightId}/map?width=${width}&height=${height}&layer_on=track&layer_on=airports&show_airports=true`, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.map || null;
  } catch (e) { return null; }
};

export const fetchLastFlightByTailNumber = async (registration: string): Promise<Flight[]> => {
  try {
    // Live lookup first (covers current + upcoming flights for the aircraft)
    const liveRes = await fetch(`/aeroapi/flights/${registration}?ident_type=registration`, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    let flights: any[] = [];
    if (liveRes.ok) {
      const liveData = await liveRes.json();
      flights = liveData.flights || [];
    }
    // Fall back to the aircraft's last known historical flight
    if (flights.length === 0) {
      const response = await fetch(`/aeroapi/history/aircraft/${registration}/last_flight`, {
        headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
      });
      if (response.ok) {
        const data = await response.json();
        flights = data.flights || [];
      }
    }
    return flights.slice(0, 5).map((f: any, i: number) => ({
      id: f.fa_flight_id || f.ident || `tail-${i}`, ident: f.ident, flightNumber: f.ident,
      airline: operatorName(f.operator), status: f.status || 'Landed',
      departureAirport: airportCode(f.origin), arrivalAirport: airportCode(f.destination),
      departureTime: f.scheduled_out, arrivalTime: f.scheduled_in,
      estimatedDepartureTime: f.estimated_out, actualDepartureTime: f.actual_out,
      estimatedArrivalTime: f.estimated_in, actualArrivalTime: f.actual_in,
      gate: f.gate_origin, terminal: f.terminal_origin,
      gateDestination: f.gate_destination, terminalDestination: f.terminal_destination,
      aircraft: f.aircraft_type, tailNumber: f.registration || registration,
      progress: f.progress_percent || 0, delayMinutes: f.departure_delay ? Math.round(f.departure_delay / 60) : 0,
      durationMinutes: f.filed_ete ? Math.round(f.filed_ete / 60) : null,
    }));
  } catch (e) { console.error('fetchLastFlightByTailNumber error:', e); return []; }
};

// ==========================================
// PHASE 7: AIRCRAFT & DISRUPTION DATA
// ==========================================

export const fetchAircraftOwner = async (registration: string): Promise<AircraftOwner | null> => {
  try {
    const response = await fetch(`/aeroapi/aircraft/${registration}/owner`, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) { return null; }
};

export const fetchAircraftType = async (typeCode: string): Promise<AircraftTypeInfo | null> => {
  try {
    const response = await fetch(`/aeroapi/aircraft/types/${typeCode}`, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) { return null; }
};

export const fetchDisruptionCounts = async (entityType: string, entityId?: string): Promise<DisruptionCount | null> => {
  try {
    let url = `/aeroapi/disruption_counts/${entityType}`;
    if (entityId) url += `/${entityId}`;
    const response = await fetch(url, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) { return null; }
};

// ==========================================
// PHASE 8: FUTURE SCHEDULES
// ==========================================

export const fetchFutureSchedules = async (startDate: string, endDate: string, origin?: string, dest?: string): Promise<FlightSchedule[]> => {
  try {
    let url = `/aeroapi/schedules/${startDate}/${endDate}`;
    const params = new URLSearchParams();
    if (origin) params.append('origin', origin);
    if (dest) params.append('destination', dest);
    if (params.toString()) url += `?${params.toString()}`;

    const response = await fetch(url, {
      headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.scheduled || []).map((s: any) => ({
      ident: s.ident, departure: s.scheduled_out || s.departure,
      arrival: s.scheduled_in || s.arrival, origin: s.origin_iata || s.origin,
      destination: s.destination_iata || s.destination, airline: (s.ident_icao || s.ident || '').replace(/[0-9]+$/, ''), aircraft: s.aircraft_type
    }));
  } catch (e) { console.error('fetchFutureSchedules error:', e); return []; }
};

// ==========================================
// PHASE 9: ALERTS API (Full CRUD)
// ==========================================

const AERO_HEADERS = { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8', 'Content-Type': 'application/json; charset=UTF-8' };

export const fetchAlerts = async (): Promise<FlightAlert[]> => {
  try {
    const response = await fetch('/aeroapi/alerts', { headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' } });
    if (!response.ok) return [];
    const data = await response.json();
    return data.alerts || [];
  } catch (e) { console.error('fetchAlerts error:', e); return []; }
};

export const createAlert = async (alert: Partial<FlightAlert>): Promise<FlightAlert | null> => {
  try {
    const response = await fetch('/aeroapi/alerts', { method: 'POST', headers: AERO_HEADERS, body: JSON.stringify(alert) });
    if (!response.ok) { const err = await response.json().catch(() => null); console.error('createAlert error:', err); return null; }
    return await response.json();
  } catch (e) { console.error('createAlert error:', e); return null; }
};

export const fetchAlert = async (alertId: number): Promise<FlightAlert | null> => {
  try {
    const response = await fetch(`/aeroapi/alerts/${alertId}`, { headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' } });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) { return null; }
};

export const updateAlert = async (alertId: number, updates: Partial<FlightAlert>): Promise<FlightAlert | null> => {
  try {
    const response = await fetch(`/aeroapi/alerts/${alertId}`, { method: 'PUT', headers: AERO_HEADERS, body: JSON.stringify(updates) });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) { return null; }
};

export const deleteAlert = async (alertId: number): Promise<boolean> => {
  try {
    const response = await fetch(`/aeroapi/alerts/${alertId}`, { method: 'DELETE', headers: { 'x-apikey': API_KEYS.FLIGHTAWARE } });
    return response.ok;
  } catch (e) { return false; }
};

export const fetchAlertEndpoint = async (): Promise<{ url: string } | null> => {
  try {
    const response = await fetch('/aeroapi/alerts/endpoint', { headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' } });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) { return null; }
};

export const setAlertEndpoint = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch('/aeroapi/alerts/endpoint', { method: 'PUT', headers: AERO_HEADERS, body: JSON.stringify({ url }) });
    return response.ok;
  } catch (e) { return false; }
};

export const deleteAlertEndpoint = async (): Promise<boolean> => {
  try {
    const response = await fetch('/aeroapi/alerts/endpoint', { method: 'DELETE', headers: { 'x-apikey': API_KEYS.FLIGHTAWARE } });
    return response.ok;
  } catch (e) { return false; }
};

// ==========================================
// ACCOUNT USAGE
// ==========================================

export const fetchAeroApiUsage = async (): Promise<any> => {
  try {
    const response = await fetch('/aeroapi/account/usage', { headers: { 'x-apikey': API_KEYS.FLIGHTAWARE, 'Accept': 'application/json; charset=UTF-8' } });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) { return null; }
};

