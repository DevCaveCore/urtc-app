import React, { useState, useEffect } from 'react';
import { X, Bell, BellRing, Trash2, Plus, Loader2 } from 'lucide-react';
import { doc, setDoc, deleteDoc, getDocs, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { fetchAlerts, createAlert, deleteAlert, fetchAlertEndpoint, setAlertEndpoint } from '../services/apiService';
import { enableFlightPush, ALERTS_WEBHOOK_URL } from '../services/notificationService';
import { db } from '../services/firebaseClient';
import { FlightAlert, UserAccount } from '../types';

interface FlightAlertsModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: UserAccount | null;
    // Prefill from the flight the user was just looking at
    prefillIdent?: string;
}

// Valid AeroAPI alert events. Delay + gate-change alerts arrive bundled
// inside the departure/arrival events, so this set covers everything.
const ALERT_EVENTS = ['filed', 'departure', 'arrival', 'cancelled', 'diverted'];

const isRealUser = (u: UserAccount | null): boolean =>
    !!u && !u.id.startsWith('guest') && !u.id.startsWith('code-');

export const FlightAlertsModal: React.FC<FlightAlertsModalProps> = ({ isOpen, onClose, user, prefillIdent }) => {
    const [alerts, setAlerts] = useState<FlightAlert[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [pushReady, setPushReady] = useState<boolean | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [ident, setIdent] = useState('');
    const [origin, setOrigin] = useState('');
    const [destination, setDestination] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Show only THIS user's alerts: the AeroAPI account is shared across all
    // users, so we intersect it with the flight_alerts ownership records.
    const loadAlerts = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const [accountAlerts, ownedSnap] = await Promise.all([
                fetchAlerts(),
                getDocs(query(collection(db, 'flight_alerts'), where('uid', '==', user.id)))
            ]);
            const ownedIds = new Set(ownedSnap.docs.map(d => d.id));
            setAlerts(accountAlerts.filter(a => ownedIds.has(String(a.id))));
        } catch (e) {
            console.error(e);
            // An outage must not masquerade as the "No alerts yet" empty state
            setError("Couldn't load your alerts just now — check your connection and reopen this sheet.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setError(null);
            if (prefillIdent) setIdent(prefillIdent);
            loadAlerts();
            // Register this device for pushes as soon as the sheet opens
            if (isRealUser(user)) {
                enableFlightPush(user!.id).then(setPushReady).catch(() => setPushReady(false));
            } else {
                setPushReady(false);
            }
        }
    }, [isOpen]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isRealUser(user)) {
            setError('Sign in to create flight alerts — Apollo needs to know whose tail to wag.');
            return;
        }
        setIsSubmitting(true);
        setError(null);
        try {
            // AeroAPI requires an account-wide delivery URL before any alert
            // can be created — register ours once, automatically.
            const ep = await fetchAlertEndpoint();
            if (!ep?.url) await setAlertEndpoint(ALERTS_WEBHOOK_URL);

            const newAlert: Partial<FlightAlert> = {
                events: ALERT_EVENTS,
                channels: [{ channel_type: 'webhook', target_url: ALERTS_WEBHOOK_URL }]
            };
            if (ident) newAlert.ident = ident;
            if (origin) newAlert.origin = origin;
            if (destination) newAlert.destination = destination;

            const created = await createAlert(newAlert);
            if (!created || created.id == null) {
                setError('Could not create the alert. Please try again in a moment.');
                return;
            }
            // Record ownership so the webhook knows whose devices to push to
            await setDoc(doc(db, 'flight_alerts', String(created.id)), {
                uid: user!.id,
                ident: ident || null,
                origin: origin || null,
                destination: destination || null,
                createdAt: serverTimestamp(),
            });
            setIdent('');
            setOrigin('');
            setDestination('');
            await loadAlerts();
        } catch (e) {
            console.error(e);
            setError('Could not create the alert. Please try again in a moment.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteAlert(id);
            await deleteDoc(doc(db, 'flight_alerts', String(id))).catch(() => {});
            await loadAlerts();
        } catch (e) {
            console.error(e);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#202124] w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-gray-200 dark:border-white/10 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-white/5">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2"><Bell className="text-brand-orange" /> Flight Alerts</h3>
                        <p className="text-sm text-gray-500">Delays, gate changes, departures & arrivals — pushed to this device</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-8 flex-1">
                    {/* Push status */}
                    {pushReady === false && (
                        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                            <BellRing size={16} />
                            Notifications are blocked or unsupported on this device — alerts will still be tracked, but nothing can be delivered here. Check your browser's notification permission for this site.
                        </div>
                    )}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm rounded-xl px-4 py-3">
                            {error}
                        </div>
                    )}

                    {/* Create Alert Form */}
                    <div className="bg-gray-50 dark:bg-white/5 p-5 rounded-2xl border border-gray-200 dark:border-white/10">
                        <h4 className="font-bold mb-4 flex items-center gap-2">Create New Alert</h4>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Flight Number (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. UAL100"
                                        value={ident}
                                        onChange={(e) => setIdent(e.target.value.toUpperCase())}
                                        className="w-full bg-white dark:bg-[#151921] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Origin (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. ATL"
                                        value={origin}
                                        onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                                        className="w-full bg-white dark:bg-[#151921] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Destination (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. JFK"
                                        value={destination}
                                        onChange={(e) => setDestination(e.target.value.toUpperCase())}
                                        className="w-full bg-white dark:bg-[#151921] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange focus:outline-none"
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={isSubmitting || (!ident && !origin && !destination)}
                                className="bg-brand-orange hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition disabled:opacity-50"
                            >
                                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Create Alert
                            </button>
                        </form>
                    </div>

                    {/* Active Alerts List */}
                    <div>
                        <h4 className="font-bold mb-4 flex items-center gap-2">Your Active Alerts</h4>
                        {isLoading ? (
                            <div className="flex justify-center p-8">
                                <Loader2 size={24} className="animate-spin text-brand-orange" />
                            </div>
                        ) : alerts.length === 0 ? (
                            <div className="text-center p-8 bg-gray-50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-300 dark:border-white/20 text-gray-500">
                                No alerts yet — add a flight above and Apollo will keep watch.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {alerts.map(alert => (
                                    <div key={alert.id} className="bg-white dark:bg-brand-surface border border-gray-200 dark:border-white/10 rounded-xl p-4 flex justify-between items-center shadow-sm">
                                        <div>
                                            <div className="font-bold text-sm">
                                                {alert.ident && <span className="mr-3">Flight: <span className="text-brand-orange">{alert.ident}</span></span>}
                                                {alert.origin && <span className="mr-3">Origin: <span className="text-brand-blue">{alert.origin}</span></span>}
                                                {alert.destination && <span>Dest: <span className="text-brand-blue">{alert.destination}</span></span>}
                                                {!alert.ident && !alert.origin && !alert.destination && 'Global Alert (All Flights)'}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">Watching: departures, arrivals, delays, gate changes, cancellations</div>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(alert.id)}
                                            className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition"
                                            title="Delete Alert"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
