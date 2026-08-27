import { db } from './firebaseClient';
import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  updateDoc,
  query, 
  where, 
  orderBy 
} from 'firebase/firestore';
import { Trip, TripFlight, Note, BudgetCategory, Pass } from '../types';

const MOCK_STORAGE_KEY = 'urtc_mock_trips';

// Helper to get local mock trips
const getMockTrips = (): Trip[] => {
    try {
        const data = localStorage.getItem(MOCK_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        localStorage.removeItem(MOCK_STORAGE_KEY); // corrupt — start clean
        return [];
    }
};

// Helper to save local mock trips
const saveMockTrips = (trips: Trip[]) => {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(trips));
};

export const fetchTrips = async (userId: string): Promise<Trip[]> => {
    if (userId === 'guest' || userId.startsWith('code-')) {
        return getMockTrips().filter(t => t.user_id === userId);
    }
    
    try {
        const tripsRef = collection(db, 'trips');
        const q = query(tripsRef, where('user_id', '==', userId));
        const snapshot = await getDocs(q);
        
        const trips: Trip[] = [];
        snapshot.forEach(doc => {
            trips.push({ id: doc.id, ...doc.data() } as Trip);
        });
        
        // Sort by created_at descending (approximate if we don't have indexes yet)
        return trips.sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA;
        });
    } catch (error) {
        console.error('Error fetching trips:', error);
        return [];
    }
};

export const createTrip = async (userId: string, name: string, details?: Partial<Trip>): Promise<Trip | null> => {
    const newTrip: any = {
        user_id: userId,
        name,
        notes: [],
        budget_categories: [],
        passes: [],
        flights: [],
        created_at: new Date().toISOString(),
        // Optional metadata (dates, destination, budget_limit, travelers…)
        // so Apollo can save the whole plan, not just a name
        ...(details || {})
    };

    if (userId === 'guest' || userId.startsWith('code-')) {
        const trip = { ...newTrip, id: `mock-trip-${Date.now()}` };
        const trips = getMockTrips();
        saveMockTrips([trip, ...trips]);
        return trip;
    }

    try {
        const docRef = await addDoc(collection(db, 'trips'), newTrip);
        return { id: docRef.id, ...newTrip };
    } catch (error: any) {
        console.error('Error creating trip:', error);
        alert(`Error: ${error.message}`);
        return null;
    }
};

export const deleteTrip = async (tripId: string): Promise<boolean> => {
    if (tripId.startsWith('mock-trip-')) {
        const trips = getMockTrips().filter(t => t.id !== tripId);
        saveMockTrips(trips);
        return true;
    }

    try {
        await deleteDoc(doc(db, 'trips', tripId));
        return true;
    } catch (error) {
        console.error('Error deleting trip:', error);
        return false;
    }
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

    try {
        await updateDoc(doc(db, 'trips', tripId), updates);
        return true;
    } catch (error) {
        console.error('Error updating trip:', error);
        return false;
    }
};

export const addFlightToTrip = async (userId: string, tripId: string, flightNumber: string, date: string, airline?: string, departure?: string, arrival?: string): Promise<boolean> => {
    const newFlight: any = {
        id: `flight-${Date.now()}`,
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
            trip.flights.push(newFlight);
            saveMockTrips(trips);
            return true;
        }
        return false;
    }

    try {
        // Fetch current trip to append flight
        const tripRef = doc(db, 'trips', tripId);
        const tripSnap = await getDoc(tripRef);
        if (tripSnap.exists()) {
            const data = tripSnap.data();
            const flights = data.flights || [];
            flights.push(newFlight);
            await updateDoc(tripRef, { flights });
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error adding flight to trip:', error);
        return false;
    }
};

export const deleteFlightFromTrip = async (flightId: string, tripId?: string): Promise<boolean> => {
    // Mock/local trips
    const trips = getMockTrips();
    let changed = false;
    for (const trip of trips) {
        if (trip.flights) {
            const initLen = trip.flights.length;
            trip.flights = trip.flights.filter(f => f.id !== flightId);
            if (trip.flights.length !== initLen) changed = true;
        }
    }
    if (changed) {
        saveMockTrips(trips);
        return true;
    }
    if (tripId?.startsWith('mock-trip-')) return false;

    try {
        // When the caller knows the trip (it always does from the trip view),
        // update that one document instead of scanning the whole collection.
        if (tripId) {
            const tripRef = doc(db, 'trips', tripId);
            const snap = await getDoc(tripRef);
            if (!snap.exists()) return false;
            const flights = (snap.data().flights || []).filter((f: any) => f.id !== flightId);
            await updateDoc(tripRef, { flights });
            return true;
        }
        // Legacy path (no tripId): scan — kept only for old call sites.
        const snapshot = await getDocs(collection(db, 'trips'));
        for (const tripDoc of snapshot.docs) {
            const data = tripDoc.data();
            const flights = data.flights || [];
            const newFlights = flights.filter((f: any) => f.id !== flightId);
            if (flights.length !== newFlights.length) {
                await updateDoc(doc(db, 'trips', tripDoc.id), { flights: newFlights });
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Error deleting flight:', error);
        return false;
    }
};
