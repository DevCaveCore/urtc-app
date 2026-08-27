import React, { useState, useEffect } from 'react';
import { Plane, Building2, Moon, Sun, Mic, Info, Notebook, WifiOff, Home, X, Clock, Calendar, Shield, Globe, Map, MapPinOff, Settings } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import { HomeView } from './components/HomeView';
import { Tab, BudgetItem, UserTier, Note, Theme, Pass, Flight, UserAccount } from './types';
import { FlightView } from './components/FlightView';
import { CityView } from './components/CityView';
import { ApolloView } from './components/ApolloView';
import { ItineraryView } from './components/ItineraryView';
import { SocialView } from './components/SocialView';
import { EnhancedApolloDogIcon } from './components/ApolloDog';
import { ApolloLive } from './components/ApolloLive';
import { DynamicIsland } from './components/DynamicIsland';
import { AboutView } from './components/AboutView';
import { DiamondTutorialOverlay } from './components/DiamondTutorialOverlay';
import { TutorialOverlay } from './components/TutorialOverlay';
import { getActiveUser, setActiveUser } from './services/authService';
import { auth, db } from './services/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { fetchRealFlights } from './services/apiService';
import { useLanguage } from './i18n/context';
import { AuthGate } from './components/auth/AuthGate';

const SplashScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    // Let the last tagline land (~1.95s) and breathe, then glide out
    const exitTimer = setTimeout(() => setLeaving(true), 2200);
    const doneTimer = setTimeout(() => onComplete(), 2750);
    return () => { clearTimeout(exitTimer); clearTimeout(doneTimer); };
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-[100] bg-brand-ink flex flex-col items-center justify-center overflow-hidden transition-all duration-[550ms] ease-in-out ${leaving ? 'opacity-0 scale-110 blur-md' : 'opacity-100 scale-100'}`}>
      {/* Deep ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-orange/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-brand-blue/8 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 animate-blur-in">
        {/* Apollo ring */}
        <div className="relative">
          <div className="absolute inset-[-8px] rounded-full bg-gradient-to-br from-brand-orange/50 to-brand-blue/30 blur-lg animate-pulse" />
          <div className="relative w-28 h-28 rounded-full border-2 border-brand-orange/60 p-0.5 shadow-2xl">
            <img
              src="/assets/apollo_pilot.jpg"
              alt="Apollo"
              className="w-full h-full rounded-full object-cover"
            />
          </div>
        </div>

        {/* Wordmark */}
        <div className="text-center">
          <h1 className="font-display text-7xl font-bold tracking-tight text-white leading-none">
            Ür<span className="gradient-text">TC</span>
          </h1>

          {/* Taglines take off one after another and the last one lands */}
          <div className="relative h-7 mt-4 w-[300px] mx-auto overflow-hidden">
            {[
              { text: 'Track any flight, live.', delay: '0s', cls: 'phrase-fly' },
              { text: 'Book it in seconds.', delay: '0.55s', cls: 'phrase-fly' },
              { text: 'Travel Commerce, with Apollo.', delay: '1.1s', cls: 'phrase-land' },
            ].map(p => (
              <p
                key={p.text}
                className={`${p.cls} absolute inset-0 flex items-center justify-center whitespace-nowrap text-[13px] font-semibold tracking-[0.16em] uppercase text-white/60`}
                style={{ animationDelay: p.delay }}
              >
                {p.text}
              </p>
            ))}
          </div>

          {/* Contrail under the taglines */}
          <div className="animate-contrail mx-auto mt-1 h-px w-[220px] bg-gradient-to-r from-transparent via-brand-orange/70 to-transparent" />
        </div>

        {/* Maker mark */}
        <p className="text-[10px] font-semibold text-white/25 tracking-[0.25em] uppercase">Cave Core Dynamics</p>
      </div>
    </div>
  );
};

const TAB_ORDER = [Tab.Home, Tab.Flights, Tab.Explore, Tab.Itinerary];

const AppContent: React.FC = () => {
  const { t } = useLanguage();
  const [user, setUser] = useState<UserAccount>(getActiveUser());
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Home);
  const [direction, setDirection] = useState(0);
  const [showSplash, setShowSplash] = useState(true);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [budgetLimit, setBudgetLimit] = useState(2500);
  const [notes, setNotes] = useState<Note[]>([]);
  const [passes, setPasses] = useState<Pass[]>([]);
  // Both preferences survive relaunch — they were being saved but never read back
  const [theme, setTheme] = useState<Theme>(() => {
    const t = localStorage.getItem('urtc_theme');
    return t === 'light' || t === 'amoled' || t === 'dark' ? t : 'dark';
  });
  const [textSize, setTextSize] = useState<'sm' | 'base' | 'lg'>(() => {
    const s = localStorage.getItem('urtc_text_size');
    return s === 'sm' || s === 'lg' ? s : 'base';
  });
  const [exploreCity, setExploreCity] = useState("Atlanta");
  const [showLive, setShowLive] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [trackedActivity, setTrackedActivity] = useState<Flight | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | undefined>();
  const [showTerms, setShowTerms] = useState(() => !localStorage.getItem('urtc_terms_accepted'));
  const [showDiamondTutorial, setShowDiamondTutorial] = useState(false);
  const [runTour, setRunTour] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);

  // Global Geolocation Request
  useEffect(() => {
    if (!showTerms) {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocationDenied(false);
            if (exploreCity === "Atlanta" && window.google) {
                const { latitude, longitude } = position.coords;
                const geocoder = new window.google.maps.Geocoder();
                geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results: any[], status: any) => {
                    if (status === 'OK' && results[0]) {
                        const cityComp = results[0].address_components.find((c: any) => c.types.includes('locality'));
                        const stateComp = results[0].address_components.find((c: any) => c.types.includes('administrative_area_level_1'));
                        const countryComp = results[0].address_components.find((c: any) => c.types.includes('country'));
                        
                        let detectedCity = '';
                        if (cityComp) detectedCity += cityComp.long_name;
                        if (stateComp && countryComp?.short_name === 'US') detectedCity += `, ${stateComp.short_name}`;
                        else if (countryComp) detectedCity += `, ${countryComp.short_name}`;
                        
                        if (detectedCity) setExploreCity(detectedCity);
                    }
                });
            }
          },
          (error) => {
            if (error.code === error.PERMISSION_DENIED) {
              setLocationDenied(true);
            }
          }
        );
      } else {
        setLocationDenied(true);
      }
    }
  }, [showTerms]);

  // Trigger Diamond Tutorial
  useEffect(() => {
    if (user.tier === UserTier.Diamond && !localStorage.getItem('urtc_diamond_tutorial_seen')) {
      setShowDiamondTutorial(true);
    }
  }, [user.tier]);

  const handleCloseDiamondTutorial = () => {
    setShowDiamondTutorial(false);
    localStorage.setItem('urtc_diamond_tutorial_seen', 'true');
  };




  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        const guestUser: UserAccount = {
          id: 'guest',
          username: 'Guest',
          passwordHash: '',
          tier: UserTier.Guest,
          savedTrips: []
        };
        setUser(guestUser);
        setActiveUser(guestUser);
      } else {
        // Fetch profile
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        const profile = userDoc.exists() ? userDoc.data() : null;
        
        const activeUser: UserAccount = {
          id: firebaseUser.uid,
          username: profile?.username || firebaseUser.email?.split('@')[0] || 'Traveler',
          passwordHash: '',
          email: firebaseUser.email || undefined,
          tier: profile?.tier as UserTier || UserTier.Free,
          savedTrips: []
        };
        setUser(activeUser);
        setActiveUser(activeUser);
      }
    });

    return () => unsubscribe();
  }, []);

  // Refresh user state from storage on mount
  useEffect(() => {
    setUser(getActiveUser());
  }, []);

  // Handle Offline Mode
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Flight Alerts Polling System
  useEffect(() => {
      if (!trackedActivity) {
          setAlertMessage(undefined);
          return;
      }
      
      const pollFlight = async () => {
          try {
              const flights = await fetchRealFlights(trackedActivity.ident);
              if (flights && flights.length > 0) {
                  const updatedFlight = flights[0];
                  
                  // Detect changes
                  let alert = '';
                  if (updatedFlight.status !== trackedActivity.status) {
                      alert = `Status changed to ${updatedFlight.status}`;
                  } else if (updatedFlight.gate && updatedFlight.gate !== trackedActivity.gate) {
                      alert = `Gate changed to ${updatedFlight.gate}`;
                  } else if (updatedFlight.delayMinutes && updatedFlight.delayMinutes > (trackedActivity.delayMinutes || 0)) {
                      alert = `Delayed by ${updatedFlight.delayMinutes} mins`;
                  }
                  
                  if (alert) {
                      setAlertMessage(alert);
                      // Banner clears itself — it used to stick until tracking stopped
                      setTimeout(() => setAlertMessage(undefined), 15000);
                  }
                  // Only swap state when something visible changed, otherwise this
                  // effect tears down and recreates its own interval every 10s.
                  const changed = updatedFlight.status !== trackedActivity.status
                      || updatedFlight.gate !== trackedActivity.gate
                      || updatedFlight.progress !== trackedActivity.progress
                      || updatedFlight.delayMinutes !== trackedActivity.delayMinutes;
                  if (changed) setTrackedActivity(updatedFlight);
              }
          } catch (e) {
              console.error("Flight poll failed", e);
          }
      };

      // Poll every 10 seconds for premium telemetry
      const timer = setInterval(pollFlight, 10000);
      return () => clearInterval(timer);
  }, [trackedActivity]);

  // Handle Theme Change
  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('urtc_theme', newTheme);
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') root.classList.remove('dark'); else root.classList.add('dark');
  }, [theme]);

  // Handle Text Size Change (Global Scaling)
  useEffect(() => {
    const root = document.documentElement;
    if (textSize === 'sm') root.style.fontSize = '14px';
    else if (textSize === 'lg') root.style.fontSize = '18px';
    else root.style.fontSize = '16px';
    localStorage.setItem('urtc_text_size', textSize);
  }, [textSize]);

  // Load Saved Data — one corrupt value must never blank the whole app
  useEffect(() => {
    const readJson = (key: string): any => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        localStorage.removeItem(key); // corrupt — drop it and start clean
        return null;
      }
    };
    const savedBudget = readJson('urtc_budget');
    if (savedBudget) setBudgetItems(savedBudget);
    const savedLimit = localStorage.getItem('urtc_budget_limit');
    if (savedLimit && !isNaN(Number(savedLimit))) setBudgetLimit(Number(savedLimit));
    const savedNotes = readJson('urtc_notes');
    if (savedNotes) setNotes(savedNotes);
    const savedPasses = readJson('urtc_passes');
    if (savedPasses) setPasses(savedPasses);
  }, []);

  useEffect(() => { localStorage.setItem('urtc_budget', JSON.stringify(budgetItems)); }, [budgetItems]);
  useEffect(() => { localStorage.setItem('urtc_budget_limit', budgetLimit.toString()); }, [budgetLimit]);
  useEffect(() => { localStorage.setItem('urtc_notes', JSON.stringify(notes)); }, [notes]);
  useEffect(() => { localStorage.setItem('urtc_passes', JSON.stringify(passes)); }, [passes]);

  const [mountedTabs, setMountedTabs] = useState<Set<Tab>>(new Set([Tab.Home]));

  const [showApolloSheet, setShowApolloSheet] = useState(false);

  const handleTabChange = React.useCallback((newTab: Tab) => {
    // Apollo is no longer a tab — it's the concierge sheet, available everywhere
    if (newTab === Tab.Apollo) {
      setMountedTabs(prev => { const s = new Set(prev); s.add(Tab.Apollo); return s; });
      setShowApolloSheet(true);
      return;
    }
    setMountedTabs(prev => { const s = new Set(prev); s.add(newTab); return s; });
    setActiveTab(newTab);
  }, []);

  const addToBudget = React.useCallback((item: BudgetItem) => {
    setBudgetItems(prev => [...prev, item]);
  }, []);

  const handleViewDestination = React.useCallback((city: string) => {
    setDirection(1);
    setExploreCity(city);
    setActiveTab(Tab.Explore);
    setMountedTabs(prev => { const s = new Set(prev); s.add(Tab.Explore); return s; });
  }, []);

  const handleTabSelect = React.useCallback((tab: Tab) => { 
    handleTabChange(tab); 
  }, [handleTabChange]);

  const handleBackToHome = React.useCallback(() => {
    handleTabChange(Tab.Home);
  }, [handleTabChange]);

  const handleExplore = React.useCallback((city: string) => {
    setExploreCity(city);
    handleTabChange(Tab.Explore);
  }, [handleTabChange]);

  const handleStartTour = React.useCallback(() => {
    setRunTour(true);
  }, []);

  // Apollo can steer the app: his open_app_tab tool fires this event
  useEffect(() => {
    const nav = (e: Event) => {
      const tab = (e as CustomEvent).detail?.tab;
      const map: Record<string, Tab> = { today: Tab.Home, home: Tab.Home, flights: Tab.Flights, explore: Tab.Explore, trips: Tab.Itinerary, plans: Tab.Itinerary, about: Tab.About };
      if (tab && map[tab]) {
        setShowApolloSheet(false); // get out of the way so they can see it
        handleTabChange(map[tab]);
      }
    };
    window.addEventListener('urtc-navigate', nav);
    return () => window.removeEventListener('urtc-navigate', nav);
  }, [handleTabChange]);

  const handlers = useSwipeable({
    onSwipedLeft: (e) => {
      if (Math.abs(e.deltaX) < 80 || Math.abs(e.deltaY) > Math.abs(e.deltaX) * 0.6) return;
      const currentIndex = TAB_ORDER.indexOf(activeTab);
      if (currentIndex < TAB_ORDER.length - 1) handleTabChange(TAB_ORDER[currentIndex + 1]);
    },
    onSwipedRight: (e) => {
      if (Math.abs(e.deltaX) < 80 || Math.abs(e.deltaY) > Math.abs(e.deltaX) * 0.6) return;
      const currentIndex = TAB_ORDER.indexOf(activeTab);
      if (currentIndex > 0) handleTabChange(TAB_ORDER[currentIndex - 1]);
    },
    preventScrollOnSwipe: false,
    trackMouse: false,
    delta: 60,
    swipeDuration: 500
  });

  // Tabs that should be full-screen (no header padding)
  const immersiveTabs = [Tab.Wander, Tab.Flights, Tab.Explore];
  const isImmersive = immersiveTabs.includes(activeTab);

  return (
    <div className={theme}>
      {showSplash ? (
        <SplashScreen onComplete={() => setShowSplash(false)} />
      ) : (
        <div className={`min-h-screen animate-in fade-in slide-in-from-bottom-1 duration-700 ${
          theme === 'amoled' ? 'bg-black' :
          theme === 'light' ? 'bg-[#F2F4F7] text-gray-900' :
          'bg-brand-ink text-white'
        } selection:bg-brand-orange selection:text-white transition-colors duration-500`}>

          {/* Ambient depth glows removed for performance */}

          {/* ── Desktop sidebar (≥1024px) — replaces the phone bottom nav ── */}
          <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[232px] z-40 flex-col gap-1.5 px-3.5 py-6 border-r border-white/[0.07] bg-white/[0.02]">
            <div className="flex items-center gap-2.5 px-2 pb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-orange to-orange-700 flex items-center justify-center shadow-lg shadow-brand-orange/30">
                <Plane size={18} className="text-white" />
              </div>
              <span className="font-display text-xl font-bold tracking-tight text-white">Ür<span className="text-brand-orange">TC</span></span>
              <span className="text-[9px] font-black bg-brand-orange/15 text-brand-orange px-1.5 py-0.5 rounded-full">v1.2</span>
            </div>
            {[
              { tab: Tab.Home, icon: <Home size={19} />, label: 'Today' },
              { tab: Tab.Flights, icon: <Plane size={19} />, label: 'Flights' },
              { tab: Tab.Explore, icon: <Building2 size={19} />, label: 'Explore' },
              { tab: Tab.Itinerary, icon: <Notebook size={19} />, label: 'Trips' },
            ].map(({ tab, icon, label }) => (
              <button
                key={`side-${tab}`}
                onClick={() => handleTabChange(tab)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm transition select-none ${
                  activeTab === tab
                    ? 'bg-white/[0.06] border border-brand-orange/25 text-brand-orange font-bold'
                    : 'text-white/55 font-semibold hover:text-white hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                {icon} {label}
              </button>
            ))}
            <div className="flex-1" />
            <button
              onClick={() => handleTabChange(Tab.Apollo)}
              className="rounded-2xl p-3.5 bg-gradient-to-br from-[#FFB800]/15 to-brand-orange/10 border border-[#FFB800]/25 flex items-center gap-2.5 text-left hover:border-[#FFB800]/50 transition"
            >
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-[#FFB800]/50 shrink-0">
                <img src="/assets/apollo_pilot.jpg" alt="Apollo" className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="text-[13px] font-extrabold text-white leading-tight">Ask Apollo</div>
                <div className="text-[10px] text-white/45">Your travel companion</div>
              </div>
            </button>
            <button onClick={() => handleTabChange(Tab.About)} className="flex items-center gap-2.5 px-2 pt-2 text-left group">
              <div className="w-8 h-8 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center text-[13px] font-extrabold text-white shrink-0">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <span className="text-[13px] font-bold text-white flex-1 truncate">{user.username}</span>
              <span className="text-[9px] font-black text-[#8DE2FF] bg-[#3AB0FF]/15 border border-[#3AB0FF]/30 px-2 py-0.5 rounded-full group-hover:border-[#3AB0FF]/60 transition">
                {user.tier === UserTier.Dev ? 'DEV' : user.tier === UserTier.Diamond ? 'DIAMOND' : user.tier === UserTier.Professional ? 'PRO' : user.tier === UserTier.Free ? 'SILVER' : 'BRONZE'}
              </span>
            </button>
          </aside>

          <div className="max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-none mx-auto lg:mx-0 lg:pl-[232px] min-h-screen relative">

            {/* Flight tracking Dynamic Island */}
            {trackedActivity && (
                <div className="fixed top-safe left-4 right-4 z-50 max-w-md mx-auto animate-in fade-in slide-in-from-top-4 duration-300">
                  <DynamicIsland activity={trackedActivity} alertMessage={alertMessage} onClose={() => setTrackedActivity(null)} />
                </div>
            )}
            
            {showDiamondTutorial && <DiamondTutorialOverlay onClose={handleCloseDiamondTutorial} />}
            {runTour && <TutorialOverlay onClose={() => setRunTour(false)} />}

            {/* Offline Banner */}
            {isOffline && (
              <div className="fixed top-0 left-0 w-full z-[60] bg-red-500/90 backdrop-blur-md text-white text-xs font-bold text-center pb-2 pt-safe-header flex justify-center gap-2 items-center">
                <WifiOff size={12} /> No Internet Connection
              </div>
            )}

            {/* ─── Floating Glass Header (non-immersive tabs only) ─── */}
            {!isImmersive && (
              <header className="sticky top-0 z-30 px-4 pt-safe-header pb-3">
                <div className="glass rounded-2xl px-4 py-2.5 flex items-center justify-between">
                  {/* Logo */}
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <div className="absolute inset-0 bg-brand-orange/30 blur-sm rounded-lg" />
                      <div className="relative bg-gradient-to-br from-brand-orange to-orange-700 w-8 h-8 rounded-xl flex items-center justify-center shadow-lg">
                        <Plane size={15} className="text-white" strokeWidth={2.5} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="font-display text-lg font-bold tracking-tight leading-none text-white">
                          Ür<span className="gradient-text">TC</span>
                        </h1>
                        <span className="text-[9px] font-bold bg-brand-orange/20 text-brand-orange px-1.5 py-0.5 rounded-full">v1.1</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          user.tier === UserTier.Diamond || user.tier === UserTier.Professional || user.tier === UserTier.Dev
                            ? 'bg-green-400 animate-pulse' : 'bg-white/20'
                        }`} />
                        <p className="text-[9px] text-white/30 font-medium uppercase tracking-wider">
                          {user.tier === UserTier.Dev ? 'Dev' :
                           user.tier === UserTier.Diamond ? 'Diamond' :
                           user.tier === UserTier.Professional ? 'Professional' :
                           user.tier === UserTier.Free ? 'Silver' : 'Bronze'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleTabChange(Tab.About)}
                      className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/5 transition"
                      title="Settings & plans"
                    >
                      <Settings size={17} />
                    </button>
                    <button
                      onClick={() => handleThemeChange(theme === 'dark' ? 'light' : 'dark')}
                      className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/5 transition"
                    >
                      {theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />}
                    </button>
                    <button
                      onClick={() => setShowLive(true)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-brand-orange/15 border border-brand-orange/25 text-brand-orange hover:bg-brand-orange hover:text-white transition"
                    >
                      <Mic size={15} />
                    </button>
                  </div>
                </div>

              </header>
            )}

            {/* ─── Main Content (lazy-mount: only initialize a tab when first visited, then keep alive) ─── */}
            {/* No z-index here: it would trap every fixed modal inside this
                stacking context BELOW the z-40 bottom nav (sheets rendered
                half-covered and "unscrollable"). Modals manage their own z.
                Swipe handlers were built but never attached — they only fire
                on decisively horizontal gestures (see the deltaY guard). */}
            <main {...handlers} className="relative pb-32 lg:pb-12 lg:max-w-[1180px] lg:mx-auto lg:px-6">
              {locationDenied && (
                <div className="mx-4 mt-2 mb-2 px-3.5 py-2.5 bg-white/[0.04] border border-white/10 rounded-2xl flex items-center gap-2.5 backdrop-blur-sm animate-in slide-in-from-top-4">
                  <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <MapPinOff size={13} className="text-amber-400" />
                  </div>
                  <div className="flex-1 text-[11px] leading-snug text-white/60">
                    <span className="font-bold text-white/80">Location is off</span> — turn it on for live weather and nearby gems.
                  </div>
                  <button
                    onClick={() => setLocationDenied(false)}
                    className="p-1.5 text-white/30 hover:text-white/70 rounded-lg hover:bg-white/5 transition shrink-0"
                    title="Dismiss"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
              <div style={{ display: activeTab === Tab.Home ? 'block' : 'none' }} className={`px-4 pt-3 ${activeTab === Tab.Home ? 'animate-tab-in' : ''}`}>
                {activeTab === Tab.Home && <HomeView user={user} onNavigate={handleTabChange} onExplore={handleExplore} onStartTour={handleStartTour} budgetItems={budgetItems} budgetLimit={budgetLimit} />}
              </div>
              {mountedTabs.has(Tab.Flights) && (
                <div className={`pt-safe-top ${activeTab === Tab.Flights ? 'animate-tab-in' : ''}`} style={{ display: activeTab === Tab.Flights ? 'block' : 'none' }}>
                  <FlightView user={user} onViewCity={handleViewDestination} onTrackFlight={setTrackedActivity} />
                </div>
              )}
              {mountedTabs.has(Tab.Explore) && (
                <div className={`pt-safe-top ${activeTab === Tab.Explore ? 'animate-tab-in' : ''}`} style={{ display: activeTab === Tab.Explore ? 'block' : 'none' }}>
                  <CityView onAddToBudget={addToBudget} initialCity={exploreCity} onCityChange={setExploreCity} theme={theme} />
                </div>
              )}
              {mountedTabs.has(Tab.Wander) && (
                <div className="pt-safe-top" style={{ display: activeTab === Tab.Wander ? 'block' : 'none' }}>
                  <SocialView />
                </div>
              )}
              {mountedTabs.has(Tab.Itinerary) && (
                <div style={{ display: activeTab === Tab.Itinerary ? 'block' : 'none' }} className={`px-4 pt-3 ${activeTab === Tab.Itinerary ? 'animate-tab-in' : ''}`}>
                  <ItineraryView user={user} onAskApollo={() => handleTabChange(Tab.Apollo)} />
                </div>
              )}
              {mountedTabs.has(Tab.About) && (
                <div style={{ display: activeTab === Tab.About ? 'block' : 'none' }} className={`px-4 pt-3 ${activeTab === Tab.About ? 'animate-tab-in' : ''}`}>
                  <AboutView currentUser={user} onUserUpdate={setUser} textSize={textSize} onTextSizeChange={setTextSize} />
                </div>
              )}
            </main>

            <div className="fixed bottom-0 left-0 right-0 z-40 pb-safe pb-4 pt-2 px-4 md:px-8 lg:hidden">
              <div className="pill-nav rounded-[28px] px-2 py-2 flex items-center justify-between relative shadow-2xl shadow-black/50 w-full max-w-md sm:max-w-lg md:max-w-2xl mx-auto">

                {/* Apollo FAB (elevated center) */}
                <div className="absolute left-1/2 -translate-x-1/2 -top-6 flex flex-col items-center">
                  <button
                    id="tab-apollo"
                    onClick={() => handleTabChange(Tab.Apollo)}
                    className={`relative select-none ${showApolloSheet ? 'animate-glow-pulse' : ''}`}
                  >
                    <div className={`absolute inset-0 rounded-full blur-md transition-opacity ${
                      showApolloSheet ? 'bg-brand-orange/60 opacity-100' : 'opacity-0'
                    }`} />
                    <div className={`relative w-14 h-14 rounded-full border-[3px] ${
                      showApolloSheet ? 'border-brand-orange shadow-lg glow-orange' : 'border-brand-orange/40 animate-orb-breathe'
                    } overflow-hidden bg-brand-surface transition-all duration-200`}>
                      <img
                        src="/assets/apollo_pilot.jpg"
                        alt="Apollo"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-brand-surface rounded-full" />
                  </button>
                  <span className={`text-[9px] font-bold uppercase tracking-wider mt-1 ${
                    showApolloSheet ? 'text-brand-orange' : 'text-white/25'
                  }`}>Apollo</span>
                </div>

                {/* Left tabs */}
                {[
                  { tab: Tab.Home, icon: <Home size={22} />, label: 'Today' },
                  { tab: Tab.Flights, icon: <Plane size={22} />, label: 'Flights' },
                ].map(({ tab, icon, label }) => (
                  <button
                    key={tab}
                    id={`tab-${tab}`}
                    onClick={() => handleTabChange(tab)}
                    className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-2xl transition-colors duration-150 relative select-none ${
                      activeTab === tab ? 'text-brand-orange' : 'text-white/40'
                    }`}
                  >
                    {activeTab === tab && (
                      <div className="absolute inset-0 bg-brand-orange/10 rounded-2xl pointer-events-none" />
                    )}
                    <div className={`relative ${activeTab === tab ? 'animate-tab-pop' : ''}`}>{icon}</div>
                    <span className="text-[9px] font-bold uppercase tracking-wide">{label}</span>
                  </button>
                ))}

                {/* Spacer for Apollo */}
                <div className="flex-1 shrink-0" />

                {/* Right tabs */}
                {[
                  { tab: Tab.Explore, icon: <Building2 size={22} />, label: 'Explore' },
                  { tab: Tab.Itinerary, icon: <Notebook size={22} />, label: 'Trips' },
                ].map(({ tab, icon, label }) => (
                  <button
                    key={tab}
                    id={`tab-${tab}`}
                    onClick={() => handleTabChange(tab)}
                    className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-2xl transition-colors duration-150 relative select-none ${
                      activeTab === tab ? 'text-brand-orange' : 'text-white/40'
                    }`}
                  >
                    {activeTab === tab && (
                      <div className="absolute inset-0 bg-brand-orange/10 rounded-2xl pointer-events-none" />
                    )}
                    <div className={`relative ${activeTab === tab ? 'animate-tab-pop' : ''}`}>{icon}</div>
                    <span className="text-[9px] font-bold uppercase tracking-wide">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Apollo Concierge Sheet — slides over any screen ── */}
            {mountedTabs.has(Tab.Apollo) && (
              <div className={`fixed inset-0 z-[90] ${showApolloSheet ? '' : 'pointer-events-none'}`}>
                <div
                  className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${showApolloSheet ? 'opacity-100' : 'opacity-0'}`}
                  onClick={() => setShowApolloSheet(false)}
                />
                <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md sm:max-w-lg md:max-w-2xl bg-[#0f1115] border border-white/10 rounded-t-[32px] shadow-2xl h-[88vh] flex flex-col overflow-hidden transition-transform duration-300 ${showApolloSheet ? 'translate-y-0' : 'translate-y-full'}`}>
                  <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/5 shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-brand-orange/50">
                          <img src="/assets/apollo_pilot.jpg" alt="Apollo" className="w-full h-full object-cover" />
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-[#0f1115] rounded-full" />
                      </div>
                      <div>
                        <div className="text-sm font-black text-white leading-none">Apollo</div>
                        <div className="text-[9px] text-white/40 uppercase tracking-widest mt-1">Your travel companion</div>
                      </div>
                    </div>
                    <button onClick={() => setShowApolloSheet(false)} className="p-2 text-white/40 hover:text-white rounded-full hover:bg-white/10 transition">
                      <X size={18} />
                    </button>
                  </div>
                  {/* The chat owns its own scroll — an outer scroller plus the
                      chat's fixed vh height left a dead band under the composer */}
                  <div className="flex-1 min-h-0 overflow-hidden px-4 pt-2 pb-4">
                    <ApolloView userTier={user.tier} onBack={() => setShowApolloSheet(false)} />
                  </div>
                </div>
              </div>
            )}

            {showLive && <ApolloLive isOpen={showLive} onClose={() => setShowLive(false)} />}
          </div>

          {/* Terms & Agreements Modal */}
          {showTerms && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
              <div className="w-full max-w-lg bg-[#0f1115] border border-white/20 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-white/10 bg-[#151921]">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-brand-orange/20 p-2 rounded-xl"><Shield size={24} className="text-brand-orange" /></div>
                    <div>
                      <h2 className="text-2xl font-black text-white">Terms & Agreements</h2>
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">ÜrTC — Cave Core Dynamics</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 text-sm text-gray-300 leading-relaxed space-y-5 scrollbar-hide">
                  <div className="space-y-3">
                    <h3 className="text-white font-bold text-base">1. Acceptance of Terms</h3>
                    <p>By accessing or using ÜrTC ("the App"), you acknowledge that you have read, understood, and agree to be bound by these Terms & Conditions. If you do not agree, you may not use the App.</p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-white font-bold text-base">2. AI-Generated Content Disclaimer</h3>
                    <p>This application uses <strong className="text-brand-orange">Google Gemini AI</strong> ("Apollo") to generate travel insights, budget recommendations, and conversational responses. <strong>AI can make mistakes.</strong> All AI-generated content is provided for informational purposes only and should not be considered professional travel, financial, or legal advice. Always verify critical information independently.</p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-white font-bold text-base">3. Third-Party Data & APIs</h3>
                    <p>Flight data is sourced from <strong className="text-brand-orange">FlightAware AeroAPI</strong>, weather from <strong>OpenWeather</strong>, and maps from <strong>Google Maps Platform</strong>. Data accuracy, availability, and pricing are controlled by these third-party providers and may change at any time without notice. Cave Core Dynamics is not responsible for inaccuracies in third-party data.</p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-white font-bold text-base">4. No Warranty & Limitation of Liability</h3>
                    <p>The App is provided <strong>"AS IS"</strong> without warranty of any kind. Cave Core Dynamics, its founders, employees, and affiliates shall not be held liable for any direct, indirect, incidental, or consequential damages arising from your use of the App, including but not limited to missed flights, financial losses, or reliance on AI-generated content.</p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-white font-bold text-base">5. Pricing & Subscriptions</h3>
                    <p>Subscription pricing (Diamond, Professional) is subject to change. Current prices are displayed at the time of purchase. By subscribing, you agree to the pricing shown at checkout. Refund policies are governed by the payment processor (Stripe).</p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-white font-bold text-base">6. Cookies & Local Storage</h3>
                    <p>By using this App, you consent to the use of <strong>cookies and browser local storage</strong> to store your preferences, session data, trip information, and authentication tokens. This data is stored locally on your device and is essential for the App to function properly.</p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-white font-bold text-base">7. Privacy & Data</h3>
                    <p>We collect only the data necessary to provide the App's services. Account data is stored securely via Google Cloud (Firebase). We do not sell your personal information to third parties. For full details, contact <a href="mailto:feedback@cavecoredynamics.org" className="text-brand-orange hover:underline">feedback@cavecoredynamics.org</a>.</p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-white font-bold text-base">8. Dispute Resolution</h3>
                    <p>Any disputes arising from your use of this App shall be resolved through binding arbitration in the State of Georgia, United States, in accordance with applicable laws. By using this App, you waive your right to participate in class-action lawsuits.</p>
                  </div>

                  <div className="bg-brand-orange/10 border border-brand-orange/30 rounded-xl p-4 text-xs text-brand-orange">
                    <p className="font-bold mb-1">⚠️ Important Reminder</p>
                    <p>Gemini AI (Apollo) can make mistakes. Flight data from APIs may be delayed or inaccurate. Pricing for third-party services and subscriptions may change over time. Always double-check critical travel information.</p>
                  </div>

                  <p className="text-[10px] text-gray-500 pt-2">Last updated: June 2026 — © Cave Core Dynamics. All rights reserved.</p>
                </div>
                <div className="p-4 bg-[#151921] border-t border-white/10">
                  <button
                    onClick={() => { localStorage.setItem('urtc_terms_accepted', 'true'); setShowTerms(false); }}
                    className="w-full py-3.5 bg-gradient-to-r from-brand-orange to-red-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-brand-orange/20 hover:scale-[1.02] active:scale-[0.97] transition-all"
                  >
                    I Accept — Continue to ÜrTC
                  </button>
                  <p className="text-center text-[10px] text-gray-500 mt-2">By clicking "I Accept" you agree to all terms above including cookies usage.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AppContent;
