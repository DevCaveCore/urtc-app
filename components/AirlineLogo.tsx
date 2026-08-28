import React, { useMemo, useState } from 'react';
import { Plane } from 'lucide-react';

// The flight feed speaks ICAO ("DAL"); the world's logo assets speak IATA ("DL").
const ICAO_TO_IATA: Record<string, string> = {
    DAL: 'DL', AAL: 'AA', UAL: 'UA', SWA: 'WN', JBU: 'B6', ASA: 'AS',
    FFT: 'F9', NKS: 'NK', HAL: 'HA', AAY: 'G4', ENY: 'MQ', SKW: 'OO',
    RPA: 'YX', EDV: '9E', JIA: 'OH', BAW: 'BA', DLH: 'LH', AFR: 'AF',
    KLM: 'KL', UAE: 'EK', QTR: 'QR', THY: 'TK', SIA: 'SQ', CPA: 'CX',
    ANA: 'NH', JAL: 'JL', KAL: 'KE', QFA: 'QF', RYR: 'FR', EZY: 'U2',
    ACA: 'AC', WJA: 'WS', AMX: 'AM', VOI: 'Y4', IBE: 'IB', VIR: 'VS',
};

const NAME_TO_IATA: Record<string, string> = {
    'delta air lines': 'DL', 'delta': 'DL',
    'american airlines': 'AA', 'american': 'AA',
    'united airlines': 'UA', 'united': 'UA',
    'southwest airlines': 'WN', 'southwest': 'WN',
    'jetblue airways': 'B6', 'jetblue': 'B6',
    'alaska airlines': 'AS', 'alaska': 'AS',
    'frontier airlines': 'F9', 'frontier': 'F9',
    'spirit airlines': 'NK', 'spirit': 'NK',
    'hawaiian airlines': 'HA', 'hawaiian': 'HA',
    'allegiant air': 'G4', 'allegiant': 'G4',
    'envoy air': 'MQ', 'skywest airlines': 'OO', 'republic airways': 'YX',
    'endeavor air': '9E', 'psa airlines': 'OH',
    'british airways': 'BA', 'lufthansa': 'LH', 'air france': 'AF',
    'klm': 'KL', 'emirates': 'EK', 'qatar airways': 'QR',
    'turkish airlines': 'TK', 'singapore airlines': 'SQ', 'cathay pacific': 'CX',
    'all nippon airways': 'NH', 'japan airlines': 'JL', 'korean air': 'KE',
    'qantas': 'QF', 'ryanair': 'FR', 'easyjet': 'U2',
    'air canada': 'AC', 'westjet': 'WS', 'aeroméxico': 'AM', 'aeromexico': 'AM',
    'volaris': 'Y4', 'iberia': 'IB', 'virgin atlantic': 'VS',
};

// Resolve an IATA code from whatever identity we happen to have.
export const resolveAirlineIata = (opts: { iata?: string; icao?: string; ident?: string; name?: string }): string | null => {
    if (opts.iata && /^[A-Z0-9]{2}$/.test(opts.iata.toUpperCase())) return opts.iata.toUpperCase();
    if (opts.icao) {
        const hit = ICAO_TO_IATA[opts.icao.toUpperCase()];
        if (hit) return hit;
    }
    if (opts.ident) {
        const id = opts.ident.trim().toUpperCase();
        const icaoMatch = id.match(/^([A-Z]{3})\d/);
        if (icaoMatch && ICAO_TO_IATA[icaoMatch[1]]) return ICAO_TO_IATA[icaoMatch[1]];
        const iataMatch = id.match(/^([A-Z][A-Z0-9])\d/);
        if (iataMatch) return iataMatch[1];
    }
    if (opts.name) {
        const hit = NAME_TO_IATA[opts.name.trim().toLowerCase()];
        if (hit) return hit;
    }
    return null;
};

interface AirlineLogoProps {
    /** Airline display name, e.g. "Delta Air Lines" */
    name?: string;
    /** Flight ident like "DAL1182" or "DL1182" — the airline is inferred from the prefix */
    ident?: string;
    /** Explicit codes when known */
    iata?: string;
    icao?: string;
    /** Avatar diameter in px */
    size?: number;
    className?: string;
}

/**
 * Real airline emblem in a white avatar chip, falling back to the plane icon
 * for carriers we can't identify. Logos come from Duffel's public asset CDN.
 */
export const AirlineLogo: React.FC<AirlineLogoProps> = ({ name, ident, iata, icao, size = 40, className = '' }) => {
    const [failed, setFailed] = useState(false);
    const code = useMemo(() => resolveAirlineIata({ iata, icao, ident, name }), [iata, icao, ident, name]);

    if (!code || failed) {
        return (
            <div
                className={`rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center border border-gray-200 dark:border-white/10 shrink-0 ${className}`}
                style={{ width: size, height: size }}
            >
                <Plane size={Math.round(size * 0.45)} className="text-gray-500 dark:text-gray-300" />
            </div>
        );
    }

    return (
        <div
            className={`rounded-full bg-white flex items-center justify-center border border-gray-200 dark:border-white/20 shadow-sm overflow-hidden shrink-0 ${className}`}
            style={{ width: size, height: size }}
            title={name || code}
        >
            <img
                src={`https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/${code}.svg`}
                alt={name || code}
                loading="lazy"
                style={{ width: Math.round(size * 0.68), height: Math.round(size * 0.68), objectFit: 'contain' }}
                onError={() => setFailed(true)}
            />
        </div>
    );
};
