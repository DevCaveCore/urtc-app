import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Star, MapPin, Clock, Phone, Globe, PlusCircle, Navigation,
    Sparkles, Loader2, ExternalLink, Quote
} from 'lucide-react';
import { Place } from '../types';

export interface PlaceReview {
    author: string;
    rating: number;
    text: string;
    relativeTime: string;
}

export interface PlaceDetails {
    photos: string[];
    userRatingCount?: number;
    openNow?: boolean;
    hoursToday?: string;
    phone?: string;
    website?: string;
    mapsUrl?: string;
    address?: string;
    editorialSummary?: string;
    reviews: PlaceReview[];
}

/** Pull the rich record for a place from Google Places (new API). */
export const fetchPlaceDetails = async (placeId: string): Promise<PlaceDetails | null> => {
    const g = (window as any).google;
    if (!g?.maps?.places?.Place || !placeId) return null;
    try {
        const place = new g.maps.places.Place({ id: placeId });
        await place.fetchFields({
            fields: [
                'photos', 'userRatingCount', 'regularOpeningHours', 'nationalPhoneNumber',
                'websiteURI', 'googleMapsURI', 'formattedAddress', 'editorialSummary', 'reviews',
            ],
        });
        const hours = place.regularOpeningHours;
        const todayIdx = new Date().getDay();
        return {
            photos: (place.photos || []).slice(0, 6).map((p: any) => p.getURI({ maxWidth: 900 })),
            userRatingCount: place.userRatingCount ?? undefined,
            openNow: hours?.isOpen ? hours.isOpen() : undefined,
            hoursToday: hours?.weekdayDescriptions?.[(todayIdx + 6) % 7] || undefined,
            phone: place.nationalPhoneNumber || undefined,
            website: place.websiteURI || undefined,
            mapsUrl: place.googleMapsURI || undefined,
            address: place.formattedAddress || undefined,
            editorialSummary: place.editorialSummary || undefined,
            reviews: (place.reviews || []).slice(0, 4).map((r: any) => ({
                author: r.authorAttribution?.displayName || 'A traveler',
                rating: r.rating || 0,
                text: r.text || '',
                relativeTime: r.relativePublishTimeDescription || '',
            })),
        };
    } catch (e) {
        console.warn('place details failed', e);
        return null;
    }
};

const Stars: React.FC<{ rating: number; size?: number }> = ({ rating, size = 13 }) => (
    <span className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
            <Star
                key={i}
                size={size}
                className={i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-white/15'}
            />
        ))}
    </span>
);

interface PlaceDetailSheetProps {
    place: Place | null;
    onClose: () => void;
    onSaveToTrip: (place: Place) => void;
    /** Apollo's one-paragraph take; undefined while loading */
    aiSummary?: string;
    aiLoading?: boolean;
}

/**
 * The stop-before-you-leave sheet: everything a traveler needs to decide —
 * photos, rating, hours, what Apollo thinks, and real reviews — so opening
 * Google Maps becomes a choice, not the only way to learn anything.
 */
export const PlaceDetailSheet: React.FC<PlaceDetailSheetProps> = ({ place, onClose, onSaveToTrip, aiSummary, aiLoading }) => {
    const [details, setDetails] = useState<PlaceDetails | null>(null);
    const [loading, setLoading] = useState(false);
    const [photoIdx, setPhotoIdx] = useState(0);

    useEffect(() => {
        if (!place) { setDetails(null); setPhotoIdx(0); return; }
        let alive = true;
        setLoading(true);
        setDetails(null);
        setPhotoIdx(0);
        fetchPlaceDetails(place.id).then(d => {
            if (alive) { setDetails(d); setLoading(false); }
        });
        return () => { alive = false; };
    }, [place?.id]);

    // Escape closes; body scroll locks while open
    useEffect(() => {
        if (!place) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
    }, [place, onClose]);

    if (typeof document === 'undefined') return null;

    const photos = details?.photos?.length ? details.photos : (place?.image ? [place.image] : []);
    const mapsHref = details?.mapsUrl || place?.websiteUrl
        || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place?.name || '')}`;

    return createPortal(
        <AnimatePresence>
            {place && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ y: '100%', opacity: 0.6 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: '100%', opacity: 0.6 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
                        onClick={e => e.stopPropagation()}
                        className="w-full sm:max-w-lg bg-[#0f1115] border border-white/10 rounded-t-[28px] sm:rounded-[28px] shadow-2xl max-h-[92vh] sm:max-h-[86vh] flex flex-col overflow-hidden"
                    >
                        {/* Photo header */}
                        <div className="relative h-56 shrink-0 bg-[#151921]">
                            {photos.length > 0 ? (
                                <img src={photos[photoIdx]} alt={place.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center"><MapPin size={40} className="text-white/15" /></div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0f1115] via-transparent to-black/30" />

                            {/* grab handle (mobile) */}
                            <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/40" />

                            <button
                                onClick={onClose}
                                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur border border-white/15 flex items-center justify-center text-white hover:bg-black/80 transition"
                                aria-label="Close"
                            >
                                <X size={17} />
                            </button>

                            {photos.length > 1 && (
                                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                                    {photos.map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setPhotoIdx(i)}
                                            className={`h-1.5 rounded-full transition-all ${i === photoIdx ? 'w-5 bg-white' : 'w-1.5 bg-white/40'}`}
                                            aria-label={`Photo ${i + 1}`}
                                        />
                                    ))}
                                </div>
                            )}

                            <div className="absolute bottom-4 left-5 right-16">
                                <h2 className="font-display text-2xl font-bold text-white leading-tight drop-shadow-lg">{place.name}</h2>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                                        <Stars rating={place.rating} />
                                        {place.rating?.toFixed(1)}
                                        {details?.userRatingCount ? <span className="text-white/60 font-medium">({details.userRatingCount.toLocaleString()})</span> : null}
                                    </span>
                                    {details?.openNow !== undefined && (
                                        <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full ${details.openNow ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                                            {details.openNow ? 'Open now' : 'Closed'}
                                        </span>
                                    )}
                                    <span className="text-[10px] font-bold text-white/70 bg-white/10 border border-white/15 px-2 py-0.5 rounded-full">{place.priceDisplay}</span>
                                </div>
                            </div>
                        </div>

                        {/* Scrollable body */}
                        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
                            {/* Apollo's take */}
                            <div className="rounded-2xl bg-gradient-to-br from-brand-orange/12 to-[#FFB800]/8 border border-brand-orange/25 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles size={13} className="text-brand-orange" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-orange">Apollo's take</span>
                                </div>
                                {aiLoading ? (
                                    <div className="flex items-center gap-2 text-sm text-white/45">
                                        <Loader2 size={14} className="animate-spin" /> Sniffing this one out…
                                    </div>
                                ) : (
                                    <p className="text-sm text-white/80 leading-relaxed">
                                        {aiSummary || details?.editorialSummary || `A ${place.category.toLowerCase()} worth a look while you're nearby.`}
                                    </p>
                                )}
                            </div>

                            {/* Facts */}
                            <div className="space-y-2">
                                {(details?.address || place.description) && (
                                    <div className="flex items-start gap-3 text-sm">
                                        <MapPin size={15} className="text-brand-blue shrink-0 mt-0.5" />
                                        <span className="text-white/70 leading-snug">{details?.address || place.description}</span>
                                    </div>
                                )}
                                {details?.hoursToday && (
                                    <div className="flex items-start gap-3 text-sm">
                                        <Clock size={15} className="text-brand-blue shrink-0 mt-0.5" />
                                        <span className="text-white/70">{details.hoursToday}</span>
                                    </div>
                                )}
                                {place.durationText && (
                                    <div className="flex items-start gap-3 text-sm">
                                        <Navigation size={15} className="text-brand-blue shrink-0 mt-0.5" />
                                        <span className="text-white/70">{place.durationText} away{place.distanceText ? ` · ${place.distanceText}` : ''}</span>
                                    </div>
                                )}
                                {details?.phone && (
                                    <a href={`tel:${details.phone}`} className="flex items-start gap-3 text-sm group">
                                        <Phone size={15} className="text-brand-blue shrink-0 mt-0.5" />
                                        <span className="text-white/70 group-hover:text-brand-orange transition">{details.phone}</span>
                                    </a>
                                )}
                                {details?.website && (
                                    <a href={details.website} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 text-sm group">
                                        <Globe size={15} className="text-brand-blue shrink-0 mt-0.5" />
                                        <span className="text-white/70 group-hover:text-brand-orange transition truncate">Official website</span>
                                        <ExternalLink size={11} className="text-white/30 mt-1" />
                                    </a>
                                )}
                            </div>

                            {/* Reviews */}
                            {loading && (
                                <div className="flex items-center gap-2 text-xs text-white/35 py-2">
                                    <Loader2 size={13} className="animate-spin" /> Loading reviews…
                                </div>
                            )}
                            {details?.reviews && details.reviews.length > 0 && (
                                <div className="space-y-2 pt-1">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-white/35">What people say</div>
                                    {details.reviews.map((r, i) => (
                                        <div key={i} className="rounded-2xl bg-white/[0.035] border border-white/[0.07] p-3.5">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <Stars rating={r.rating} size={11} />
                                                <span className="text-[11px] font-bold text-white/70">{r.author}</span>
                                                <span className="text-[10px] text-white/30 ml-auto">{r.relativeTime}</span>
                                            </div>
                                            <p className="text-[13px] text-white/65 leading-relaxed line-clamp-4">
                                                <Quote size={11} className="inline text-white/20 mr-1 -mt-0.5" />
                                                {r.text}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="shrink-0 border-t border-white/[0.07] bg-[#0f1115] p-4 pb-safe flex gap-2.5">
                            <button
                                onClick={() => onSaveToTrip(place)}
                                className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-brand-orange to-red-500 text-white font-black text-sm shadow-lg shadow-brand-orange/25 flex items-center justify-center gap-2 press"
                            >
                                <PlusCircle size={16} /> Save to Trip
                            </button>
                            <a
                                href={mapsHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-5 py-3.5 rounded-2xl bg-white/[0.06] border border-white/12 text-white font-bold text-sm flex items-center justify-center gap-2 press hover:border-brand-blue/50 transition"
                            >
                                <Navigation size={15} className="text-brand-blue" /> Directions
                            </a>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};
