import React, { useState, useEffect } from 'react';
import { X, Bell, Trash2, Plus, Loader2 } from 'lucide-react';
import { fetchAlerts, createAlert, deleteAlert } from '../services/apiService';
import { FlightAlert } from '../types';

interface FlightAlertsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const FlightAlertsModal: React.FC<FlightAlertsModalProps> = ({ isOpen, onClose }) => {
    const [alerts, setAlerts] = useState<FlightAlert[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Form state
    const [ident, setIdent] = useState('');
    const [origin, setOrigin] = useState('');
    const [destination, setDestination] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadAlerts = async () => {
        setIsLoading(true);
        try {
            const data = await fetchAlerts();
            setAlerts(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadAlerts();
        }
    }, [isOpen]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const newAlert: Partial<FlightAlert> = {
                events: ['arrival', 'departure', 'cancelled', 'diverted', 'delay'],
                channels: [{ channel_type: 'webhook', target_url: 'https://example.com/webhook' }]
            };
            if (ident) newAlert.ident = ident;
            if (origin) newAlert.origin = origin;
            if (destination) newAlert.destination = destination;

            await createAlert(newAlert);
            setIdent('');
            setOrigin('');
            setDestination('');
            await loadAlerts();
        } catch (e) {
            console.error(e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await deleteAlert(id);
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
                        <p className="text-sm text-gray-500">Manage real-time notifications</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto space-y-8 flex-1">
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
                        <h4 className="font-bold mb-4 flex items-center gap-2">Active Alerts</h4>
                        {isLoading ? (
                            <div className="flex justify-center p-8">
                                <Loader2 size={24} className="animate-spin text-brand-orange" />
                            </div>
                        ) : alerts.length === 0 ? (
                            <div className="text-center p-8 bg-gray-50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-300 dark:border-white/20 text-gray-500">
                                No active alerts found.
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
                                            <div className="text-xs text-gray-500 mt-1">ID: {alert.id}</div>
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
