
import { Weather, Place, Flight, NewsArticle, FlightPosition, FlightSchedule, GateInfo, AustralianAirspace, HourlyForecast, DailyForecast, AirportConditions } from '../types';
import { fetchGeminiNews } from './geminiService';
import { API_KEYS } from '../config';

const handleApiError = (error: any, fallback: any) => {
  console.warn("API Call Failed:", error);
  throw error;
};

export const fetchRealWeather = async (city: string): Promise<Weather> => {
  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEYS.OWM}&units=imperial`
    );
    if (!response.ok) throw new Error('Weather API Error');
    const data = await response.json();
    
    // Also fetch 5-day / 3-hour forecast to extract some hourly data
    const forecastResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${API_KEYS.OWM}&units=imperial`
    );
    let hourly: HourlyForecast[] = [];
    let daily: DailyForecast[] = [];
    
    if (forecastResponse.ok) {
        const forecastData = await forecastResponse.json();
        // Parse hourly (3-hour intervals)
        hourly = forecastData.list.slice(0, 8).map((item: any) => ({
            time: new Date(item.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            temp: Math.round(item.main.temp),
            condition: item.weather[0].main,
            icon: item.weather[0].icon
        }));
        
        // Parse daily (naive approach: group by day)
        const daysMap: any = {};
        forecastData.list.forEach((item: any) => {
            const date = new Date(item.dt * 1000).toLocaleDateString();
            if (!daysMap[date]) daysMap[date] = { minTemp: 1000, maxTemp: -1000, conditions: {} };
            daysMap[date].minTemp = Math.min(daysMap[date].minTemp, item.main.temp_min);
            daysMap[date].maxTemp = Math.max(daysMap[date].maxTemp, item.main.temp_max);
            daysMap[date].conditions[item.weather[0].main] = (daysMap[date].conditions[item.weather[0].main] || 0) + 1;
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
      city: data.name,
      temp: Math.round(data.main.temp),
      condition: data.weather[0].main,
      humidity: data.main.humidity,
      wind: Math.round(data.wind.speed),
      hourly,
      daily
    };
  } catch (error) {
    console.error("fetchRealWeather error:", error);
    throw error;
  }
};
export const fetchRealPlaces = async (city: string, lat?: number, lng?: number): Promise<Place[]> => {
  // Currently we use Google Places SDK in the UI instead.
  // We return an empty array here since mocks are disabled.
  return [];
};

export const fetchRealFlights = async (query: string, flightDate?: string, airlineFilter?: string): Promise<Flight[]> => {
  try {
    const q = (query || "DL1182").toUpperCase().replace(/\s/g, '');
    let url = "";
    
    let isHistorical = false;
    let dateParams = "";
    if (flightDate) {
        // flightDate is YYYY-MM-DD
        const start = `${flightDate}T00:00:00Z`;
        const end = `${flightDate}T23:59:59Z`;
        dateParams = `?start=${start}&end=${end}`;

        const flightTime = new Date(flightDate).getTime();
        const tenDaysAgo = Date.now() - (10 * 24 * 60 * 60 * 1000);
        if (flightTime < tenDaysAgo) {
            isHistorical = true;
        }
    }

    // Smart Query Parsing: If it has digits, it's a flight ident (DL1182). Else, it's an airport code (ATL).
    const hasDigits = /\d/.test(q);
    const basePath = isHistorical ? "/aeroapi/history" : "/aeroapi";

    if (hasDigits) {
      url = `${basePath}/flights/${q}${dateParams}`;
    } else {
      const airportCode = q.length === 3 ? `K${q}` : q; 
      url = `${basePath}/airports/${airportCode}/flights/${isHistorical ? 'departures' : 'scheduled_departures'}${dateParams}`;
    }

    const response = await fetch(url, {
      headers: {
        'x-apikey': API_KEYS.FLIGHTAWARE,
        'Accept': 'application/json; charset=UTF-8'
      }
    });

    if (!response.ok) throw new Error('FlightAware API Error');
    const data = await response.json();
    
    let flightsArray = data.flights || data.scheduled_departures || [];

    if (airlineFilter && airlineFilter !== 'ALL') {
        flightsArray = flightsArray.filter((rawFlight: any) => {
            const f = rawFlight.segments ? rawFlight.segments[0] : rawFlight;
            return f.operator === airlineFilter || (f.ident && f.ident.startsWith(airlineFilter));
        });
    }

    return flightsArray.map((rawFlight: any, i: number) => {
      const f = rawFlight.segments ? rawFlight.segments[0] : rawFlight;
      // Calculate real duration from timestamps
      let durationMinutes: number | null = null;
      if (f.scheduled_out && f.scheduled_in) {
        const dep = new Date(f.scheduled_out).getTime();
        const arr = new Date(f.scheduled_in).getTime();
        if (arr > dep) durationMinutes = Math.round((arr - dep) / 60000);
      }
      return {
        id: f.ident || `flight-${i}`,
        ident: f.ident,
        flightNumber: f.ident,
        airline: f.operator || "Unknown",
        status: f.status || "Scheduled",
        departureAirport: f.origin?.code || f.origin || "Unknown",
        arrivalAirport: f.destination?.code || f.destination || "Unknown",
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
        aircraft: f.aircraft_type,
        progress: f.progress_percent || 0,
        delayMinutes: f.departure_delay || 0,
        durationMinutes,
      };
    });
  } catch (error) {
    console.error("fetchRealFlights error:", error);
    return [];
  }
};

export const fetchRandomFlight = async (): Promise<Flight | null> => {
  try {
    const response = await fetch(
      `/aeroapi/airports/KATL/flights/scheduled_departures`,
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
      id: f.ident,
      ident: f.ident,
      flightNumber: f.ident,
      airline: f.operator || "Unknown",
      status: f.status || "En Route",
      departureAirport: f.origin?.code || "ATL",
      arrivalAirport: f.destination?.code || "JFK",
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
    if (!origin) return [];
    
    let isHistorical = false;
    let dateParams = "";
    if (flightDate) {
        const start = `${flightDate}T00:00:00Z`;
        const end = `${flightDate}T23:59:59Z`;
        dateParams = `?start=${start}&end=${end}`;

        const flightTime = new Date(flightDate).getTime();
        const tenDaysAgo = Date.now() - (10 * 24 * 60 * 60 * 1000);
        if (flightTime < tenDaysAgo) {
            isHistorical = true;
        }
    }

    const basePath = isHistorical ? "/aeroapi/history" : "/aeroapi";
    
    let url = `${basePath}/airports/${origin}/flights/${isHistorical ? 'departures' : 'scheduled_departures'}${dateParams}`;
    if (dest) {
        url = `${basePath}/airports/${origin}/flights/to/${dest}${dateParams}`;
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
        flights = flights.filter((f: any) => (f.destination?.code || f.destination) === dest);
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
      origin: f.origin?.code || origin,
      destination: f.destination?.code || dest,
      airline: f.operator || "Unknown",
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
        fetch(`/aeroapi/airports/${code}/weather`, { headers: { 'x-apikey': API_KEYS.FLIGHTAWARE } })
    ]);
    const delays = delaysRes.ok ? await delaysRes.json() : null;
    const weather = weatherRes.ok ? await weatherRes.json() : null;
    
    return {
        airportCode: code,
        delayIndex: delays?.delay_index || 0,
        delayReasons: delays?.reasons || [],
        weather: weather?.observations?.[0]?.conditions || 'Clear',
        temp: weather?.observations?.[0]?.temp_air || 0,
        visibility: weather?.observations?.[0]?.visibility || '10 miles',
        wind: weather?.observations?.[0]?.wind_speed ? `${weather.observations[0].wind_speed} kts` : 'Calm'
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
