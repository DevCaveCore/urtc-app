
import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, Calendar } from 'lucide-react';

interface CalendarPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (departure: string, returnDate?: string) => void;
  mode: 'single' | 'range';
  initialDeparture?: string;
  initialReturn?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const MIN_YEAR = 2011;
const MAX_DATE = new Date();
MAX_DATE.setFullYear(MAX_DATE.getFullYear() + 2);
MAX_DATE.setHours(23, 59, 59, 999);
const MAX_YEAR = MAX_DATE.getFullYear();

/** Format Date → "Jun 22" style */
const pillFormat = (d: Date): string =>
  `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;

/** Parse "YYYY-MM-DD" → Date in local time */
const parseLocal = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Date → "YYYY-MM-DD" */
const toISO = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Are two Date objects the same calendar day? */
const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Is date between start and end (exclusive)? */
const isBetween = (d: Date, start: Date, end: Date): boolean => {
  const t = d.getTime();
  return t > start.getTime() && t < end.getTime();
};

export const CalendarPicker: React.FC<CalendarPickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  mode,
  initialDeparture,
  initialReturn,
}) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Which month is currently displayed
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Selected dates
  const [departure, setDeparture] = useState<Date | null>(null);
  const [returnDate, setReturnDate] = useState<Date | null>(null);

  // Quick-jump picker
  const [showJump, setShowJump] = useState(false);
  const [jumpYear, setJumpYear] = useState(viewYear);

  // Slide direction for month transition
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null);
  const [slideKey, setSlideKey] = useState(0);

  // Closing animation
  const [closing, setClosing] = useState(false);

  // Seed from props on open
  useEffect(() => {
    if (isOpen) {
      setClosing(false);
      if (initialDeparture) {
        const d = parseLocal(initialDeparture);
        setDeparture(d);
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      } else {
        setDeparture(null);
        setViewYear(today.getFullYear());
        setViewMonth(today.getMonth());
      }
      if (initialReturn && mode === 'range') {
        setReturnDate(parseLocal(initialReturn));
      } else {
        setReturnDate(null);
      }
      setShowJump(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Build the calendar grid
  const buildGrid = useCallback(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startDay = firstOfMonth.getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));
    // Fill trailing to complete row
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const cells = buildGrid();

  const canGoBack =
    viewYear > MIN_YEAR || (viewYear === MIN_YEAR && viewMonth > 0);
  const canGoForward =
    viewYear < MAX_YEAR ||
    (viewYear === MAX_YEAR && viewMonth < MAX_DATE.getMonth());

  const goBack = () => {
    if (!canGoBack) return;
    setSlideDir('right');
    setSlideKey((k) => k + 1);
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goForward = () => {
    if (!canGoForward) return;
    setSlideDir('left');
    setSlideKey((k) => k + 1);
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleDayTap = (date: Date) => {
    // Enforce max date
    if (date.getTime() > MAX_DATE.getTime()) return;
    // Enforce min date
    const minDate = new Date(MIN_YEAR, 0, 1);
    if (date.getTime() < minDate.getTime()) return;

    if (mode === 'single') {
      setDeparture(date);
      setReturnDate(null);
    } else {
      // Range mode
      if (!departure || returnDate) {
        // First tap or reset
        setDeparture(date);
        setReturnDate(null);
      } else {
        if (date.getTime() < departure.getTime()) {
          // Tapped before departure → reset to this date
          setDeparture(date);
          setReturnDate(null);
        } else if (sameDay(date, departure)) {
          // Tapped same day → deselect
          setDeparture(null);
          setReturnDate(null);
        } else {
          setReturnDate(date);
        }
      }
    }
  };

  const handleClear = () => {
    setDeparture(null);
    setReturnDate(null);
  };

  const handleDone = () => {
    if (!departure) return;
    onSelect(
      toISO(departure),
      returnDate ? toISO(returnDate) : undefined
    );
    animateClose();
  };

  const animateClose = () => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 250);
  };

  // Jump picker helpers
  const yearRange: number[] = [];
  for (let y = MIN_YEAR; y <= MAX_YEAR; y++) yearRange.push(y);

  const handleJumpSelect = (month: number) => {
    // Clamp to valid range
    let y = jumpYear;
    let m = month;
    if (y === MAX_YEAR && m > MAX_DATE.getMonth()) {
      m = MAX_DATE.getMonth();
    }
    setViewYear(y);
    setViewMonth(m);
    setShowJump(false);
  };

  if (!isOpen) return null;

  const isDayDisabled = (date: Date) =>
    date.getTime() > MAX_DATE.getTime() ||
    date.getTime() < new Date(MIN_YEAR, 0, 1).getTime();

  const getDayClasses = (date: Date): string => {
    const disabled = isDayDisabled(date);
    const isToday = sameDay(date, today);
    const isDepart = departure && sameDay(date, departure);
    const isReturn = returnDate && sameDay(date, returnDate);
    const inRange =
      mode === 'range' &&
      departure &&
      returnDate &&
      isBetween(date, departure, returnDate);

    let base =
      'relative w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center text-sm font-medium rounded-full transition-all duration-150 ';

    if (disabled) {
      base += 'text-white/15 cursor-not-allowed ';
    } else if (isDepart) {
      base +=
        'bg-brand-orange text-white font-bold shadow-lg shadow-brand-orange/30 ';
    } else if (isReturn) {
      base +=
        'bg-brand-blue text-white font-bold shadow-lg shadow-brand-blue/30 ';
    } else if (inRange) {
      base +=
        'bg-gradient-to-r from-brand-orange/20 to-brand-blue/20 text-white/90 ';
    } else {
      base +=
        'text-white/70 hover:bg-white/10 active:bg-white/15 cursor-pointer ';
    }

    return base;
  };

  return (
    <div
      className={`fixed inset-0 z-[90] flex items-center justify-center p-4 transition-all duration-300 ${
        closing
          ? 'opacity-0 scale-95 blur-sm'
          : 'animate-scale-in'
      }`}
      style={{ animation: closing ? undefined : 'scaleIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards, blurIn 0.4s ease-out forwards' }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={animateClose}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col w-full max-w-[400px] bg-[#1c1d21] rounded-3xl p-6 shadow-2xl border border-white/10 mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-brand-orange" />
            <h2 className="text-xl font-display font-bold text-white">
              {mode === 'single' ? 'Select Date' : 'Select Dates'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {(departure || returnDate) && (
              <button
                onClick={handleClear}
                className="text-sm text-white/50 hover:text-white/80 transition font-medium"
              >
                Clear
              </button>
            )}
            <button
              onClick={animateClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center transition"
            >
              <X size={18} className="text-white/60" />
            </button>
          </div>
        </div>

        {/* Selected dates pills */}
        <div className="flex items-center gap-2 mb-6 min-h-[36px] flex-wrap">
          {departure && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-orange/15 border border-brand-orange/30 rounded-full text-sm font-semibold text-brand-orange">
              {pillFormat(departure)}
            </span>
          )}
          {mode === 'range' && departure && returnDate && (
            <>
              <span className="text-white/30 text-sm">→</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-blue/15 border border-brand-blue/30 rounded-full text-sm font-semibold text-brand-blue">
                {pillFormat(returnDate)}
              </span>
            </>
          )}
          {mode === 'range' && departure && !returnDate && (
            <span className="text-white/30 text-sm italic">
              Tap a return date
            </span>
          )}
        </div>

        {/* Month navigator */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={goBack}
            disabled={!canGoBack}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
              canGoBack
                ? 'bg-white/10 hover:bg-white/15 text-white'
                : 'text-white/15 cursor-not-allowed'
            }`}
          >
            <ChevronLeft size={20} />
          </button>

          <button
            onClick={() => {
              setJumpYear(viewYear);
              setShowJump(!showJump);
            }}
            className="text-lg font-display font-bold text-white hover:text-brand-orange transition px-3 py-1 rounded-xl hover:bg-white/5"
          >
            {MONTH_NAMES[viewMonth]} {viewYear}
          </button>

          <button
            onClick={goForward}
            disabled={!canGoForward}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
              canGoForward
                ? 'bg-white/10 hover:bg-white/15 text-white'
                : 'text-white/15 cursor-not-allowed'
            }`}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Year / Month quick-jump panel */}
        {showJump && (
          <div className="bg-brand-elevated border border-white/10 rounded-2xl p-4 mb-5 animate-blur-in">
            {/* Year row */}
            <div className="mb-3">
              <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-2">
                Year
              </p>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {yearRange.map((y) => (
                  <button
                    key={y}
                    onClick={() => setJumpYear(y)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
                      y === jumpYear
                        ? 'bg-brand-orange text-white'
                        : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
            {/* Month grid */}
            <div>
              <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-2">
                Month
              </p>
              <div className="grid grid-cols-4 gap-2">
                {MONTH_SHORT.map((m, i) => {
                  const disabled =
                    jumpYear === MAX_YEAR && i > MAX_DATE.getMonth();
                  return (
                    <button
                      key={m}
                      disabled={disabled}
                      onClick={() => handleJumpSelect(i)}
                      className={`py-2 rounded-xl text-sm font-semibold transition ${
                        disabled
                          ? 'text-white/10 cursor-not-allowed'
                          : i === viewMonth && jumpYear === viewYear
                          ? 'bg-brand-orange/20 text-brand-orange border border-brand-orange/30'
                          : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-2">
          {DAY_LABELS.map((d, i) => (
            <div
              key={i}
              className="text-center text-xs font-semibold text-white/30 uppercase"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div
          key={slideKey}
          className="grid grid-cols-7 gap-y-1 justify-items-center flex-1"
          style={{
            animation: slideDir
              ? `${slideDir === 'left' ? 'slideFromRight' : 'slideFromLeft'} 0.2s ease-out`
              : undefined,
          }}
        >
          {cells.map((date, i) => {
            if (!date) {
              return <div key={`empty-${i}`} className="w-10 h-10 sm:w-11 sm:h-11" />;
            }
            const isToday = sameDay(date, today);
            return (
              <button
                key={`day-${date.getDate()}-${i}`}
                onClick={() => handleDayTap(date)}
                disabled={isDayDisabled(date)}
                className={getDayClasses(date)}
              >
                {date.getDate()}
                {isToday && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-brand-orange" />
                )}
              </button>
            );
          })}
        </div>

        {/* Done button */}
        <div className="mt-6 pb-4">
          <button
            onClick={handleDone}
            disabled={!departure}
            className={`w-full py-4 rounded-2xl font-bold text-lg transition-all duration-200 ${
              departure
                ? 'bg-gradient-to-r from-brand-orange to-[#FF8A50] text-white shadow-lg shadow-brand-orange/25 hover:shadow-brand-orange/40 active:scale-[0.98]'
                : 'bg-white/5 text-white/20 cursor-not-allowed'
            }`}
          >
            Done
          </button>
        </div>
      </div>

      {/* Inline keyframes for month slide */}
      <style>{`
        @keyframes slideFromRight {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideFromLeft {
          from { opacity: 0; transform: translateX(-40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};
