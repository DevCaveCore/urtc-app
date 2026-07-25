// ── Affiliate revenue layer ──
// Paste partner IDs here as programs approve you (Travelpayouts, Stay22, Viator...).
// Every builder returns a working link even with no ID (plain search) — the ID
// just turns the same click into commission.

const AFFILIATE_IDS = {
    STAY22: '',        // stay22.com partner ID
    BOOKING_AID: '',   // Booking.com affiliate id (via Travelpayouts)
    VIATOR: '',        // Viator partner id
    GETYOURGUIDE: '',  // GetYourGuide partner id
};

export const hotelSearchUrl = (destination: string, checkin?: string, checkout?: string): string => {
    const base = new URL('https://www.booking.com/searchresults.html');
    base.searchParams.set('ss', destination);
    if (checkin) base.searchParams.set('checkin', checkin.split('T')[0]);
    if (checkout) base.searchParams.set('checkout', checkout.split('T')[0]);
    if (AFFILIATE_IDS.BOOKING_AID) base.searchParams.set('aid', AFFILIATE_IDS.BOOKING_AID);
    return base.toString();
};

export const activitiesUrl = (destination: string): string => {
    const q = encodeURIComponent(destination);
    if (AFFILIATE_IDS.VIATOR) return `https://www.viator.com/searchResults/all?text=${q}&pid=${AFFILIATE_IDS.VIATOR}`;
    if (AFFILIATE_IDS.GETYOURGUIDE) return `https://www.getyourguide.com/s/?q=${q}&partner_id=${AFFILIATE_IDS.GETYOURGUIDE}`;
    return `https://www.getyourguide.com/s/?q=${q}`;
};

export const hasAffiliates = (): boolean => Object.values(AFFILIATE_IDS).some(Boolean);
