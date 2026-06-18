import { supabase } from './supabaseClient';
import { Trip, TripFlight, Note, BudgetCategory, Pass } from '../types';

const MOCK_STORAGE_KEY = 'urtc_mock_trips';

// Helper to get local mock trips
const getMockTrips = (): Trip[] => {
    const data = localStorage.getItem(MOCK_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
};

// Helper to save local mock trips
const saveMockTrips = (trips: Trip[]) => {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(trips));
};

export const fetchTrips = async (userId: string): Promise<Trip[]> => {
    if (userId === 'guest' || userId.startsWith('code-')) {
        return getMockTrips().filter(t => t.user_id === userId);
    }
    const { data, error } = await supabase
        .from('trips')
        .select(`
            *,
            flights:trip_flights(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching trips:', error);
        return [];
    }
    return data || [];
};

export const createTrip = async (userId: string, name: string): Promise<Trip | null> => {
    const newTrip: any = {
        user_id: userId,
        name,
        notes: [],
        budget_categories: [],
        passes: []
    };

    if (userId === 'guest' || userId.startsWith('code-')) {
        const trip = { ...newTrip, id: `mock-trip-${Date.now()}`, flights: [] };
        const trips = getMockTrips();
        saveMockTrips([trip, ...trips]);
        return trip;
    }

    const { data, error } = await supabase
        .from('trips')
        .insert([newTrip])
        .select()
        .single();

    if (error) {
        console.error('Error creating trip:', error);
        alert(`Error: ${error.message}`);
        return null;
    }
    return data;
};

export const deleteTrip = async (tripId: string): Promise<boolean> => {
    if (tripId.startsWith('mock-trip-')) {
        const trips = getMockTrips().filter(t => t.id !== tripId);
        saveMockTrips(trips);
        return true;
    }

    const { error } = await supabase
        .from('trips')
        .delete()
        .eq('id', tripId);
    
    if (error) console.error('Error deleting trip:', error);
    return !error;
};

export const updateTrip = async (tripId: string, updates: Partial<Trip>): Promise<boolean> => {
    if (tripId.startsWith('mock-trip-')) {
        const trips = getMockTrips();
        const index = trips.findIndex(t => t.id === tripId);
        if (index > -1) {
            trips[index] = { ...trips[index], ...updates };
            saveMockTrips(trips);
            return true;
        }
        return false;
    }

    const { error } = await supabase
        .from('trips')
        .update(updates)
        .eq('id', tripId);
    
    if (error) console.error('Error updating trip:', error);
    return !error;
};

export const addFlightToTrip = async (userId: string, tripId: string, flightNumber: string, date: string, airline?: string, departure?: string, arrival?: string): Promise<boolean> => {
    const newFlight: any = {
        trip_id: tripId,
        user_id: userId,
        flight_number: flightNumber,
        airline,
        flight_date: date,
        departure_airport: departure,
        arrival_airport: arrival,
        status: 'Scheduled (Awaiting Live Telemetry)'
    };

    if (tripId.startsWith('mock-trip-')) {
        const trips = getMockTrips();
        const trip = trips.find(t => t.id === tripId);
        if (trip) {
            if (!trip.flights) trip.flights = [];
            trip.flights.push({ ...newFlight, id: `mock-flight-${Date.now()}` });
            saveMockTrips(trips);
            return true;
        }
        return false;
    }

    const { error } = await supabase
        .from('trip_flights')
        .insert([newFlight]);

    if (error) console.error('Error adding flight to trip:', error);
    return !error;
};

export const deleteFlightFromTrip = async (flightId: string): Promise<boolean> => {
    if (flightId.startsWith('mock-flight-')) {
        const trips = getMockTrips();
        for (const trip of trips) {
            if (trip.flights) {
                const initLen = trip.flights.length;
                trip.flights = trip.flights.filter(f => f.id !== flightId);
                if (trip.flights.length !== initLen) {
                    saveMockTrips(trips);
                    return true;
                }
            }
        }
        return false;
    }

    const { error } = await supabase
        .from('trip_flights')
        .delete()
        .eq('id', flightId);
    
    if (error) console.error('Error deleting flight:', error);
    return !error;
};
