import React, { useState, useEffect } from 'react';
import { Plane, Building2, Moon, Sun, Mic, Info, Notebook, WifiOff, Home, X, Clock, Calendar, Shield, Globe, Map, MapPinOff } from 'lucide-react';
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
import { InterstitialAd } from './components/InterstitialAd';
import { getActiveUser, logout, setActiveUser } from './services/authService';
import { fetchRealFlights } from './services/apiService';
import { supabase } from './services/supabaseClient';
import { useLanguage } from './i18n/context';
import { AdSenseWidget } from './components/AdSenseWidget';

const SplashScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2200);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[100] bg-brand-ink flex flex-col items-center justify-center overflow-hidden">
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
        <div className="text-center space-y-2">
          <h1 className="font-display text-7xl font-bold tracking-tight text-white leading-none">
            Ür<span className="gradient-text">TC</span>
          </h1>
          <p className="text-white/40 text-sm font-medium tracking-[0.3em] uppercase">Travel Evolved</p>
        </div>

        {/* Powered by badge */}
        <div className="px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md">
          <p className="text-[11px] font-semibold text-white/50 tracking-wider uppercase">Powered by Apollo AI · Cave Core Dynamics™</p>
        </div>
      </div>
    </div>
  );
};

const TAB_ORDER = [Tab.Home, Tab.Flights, Tab.Explore, Tab.Wander, Tab.Apollo, Tab.Itinerary, Tab.About];

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
  const [theme, setTheme] = useState<Theme>('dark');
  const [textSize, setTextSize] = useState<'sm' | 'base' | 'lg'>('base');
  const [exploreCity, setExploreCity] = useState("Atlanta");
  const [showLive, setShowLive] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [trackedActivity, setTrackedActivity] = useState<Flight | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | undefined>();
  const [showInterstitial, setShowInterstitial] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
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

  // Live Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000); // update every 30s
    return () => clearInterval(timer);
  }, []);

  // Interstitial Ad Timer
  useEffect(() => {
    if (user.tier === UserTier.Guest || user.tier === UserTier.Free) {
      const timer = setTimeout(() => {
        setShowInterstitial(true);
      }, 90000); // 90s delay
      return () => clearTimeout(timer);
    }
  }, [user.tier]);

  // Supabase Auth Listener
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        const guestUser: UserAccount = {
          id: 'guest',
          username: 'Guest',
          passwordHash: '',
          tier: UserTier.Guest,
          savedTrips: [],
          xp: 0,
          level: 1
        };
        setUser(guestUser);
        setActiveUser(guestUser);
      } else if (event === 'SIGNED_IN' && session) {
        // Fetch profile
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        const activeUser: UserAccount = {
          id: session.user.id,
          username: profile?.username || session.user.email?.split('@')[0] || 'Traveler',
          passwordHash: '',
          email: session.user.email,
          tier: profile?.tier as UserTier || UserTier.Free,
          savedTrips: [],
          xp: profile?.xp || 0,
          level: profile?.level || 1
        };
        setUser(activeUser);
        setActiveUser(activeUser);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
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
                  }
                  setTrackedActivity(updatedFlight);
              }
          } catch (e) {
              console.error("Flight poll failed", e);
          }
      };

      // Poll every 30 seconds
      const timer = setInterval(pollFlight, 30000);
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
  }, [textSize]);

  // Load Saved Data
  useEffect(() => {
    const savedBudget = localStorage.getItem('urtc_budget');
    if (savedBudget) setBudgetItems(JSON.parse(savedBudget));
    const savedLimit = localStorage.getItem('urtc_budget_limit');
    if (savedLimit) setBudgetLimit(Number(savedLimit));
    const savedNotes = localStorage.getItem('urtc_notes');
    if (savedNotes) setNotes(JSON.parse(savedNotes));
    const savedPasses = localStorage.getItem('urtc_passes');
    if (savedPasses) setPasses(JSON.parse(savedPasses));
  }, []);

  useEffect(() => { localStorage.setItem('urtc_budget', JSON.stringify(budgetItems)); }, [budgetItems]);
  useEffect(() => { localStorage.setItem('urtc_budget_limit', budgetLimit.toString()); }, [budgetLimit]);
  useEffect(() => { localStorage.setItem('urtc_notes', JSON.stringify(notes)); }, [notes]);
  useEffect(() => { localStorage.setItem('urtc_passes', JSON.stringify(passes)); }, [passes]);

  const [mountedTabs, setMountedTabs] = useState<Set<Tab>>(new Set([Tab.Home]));

  const handleTabChange = React.useCallback((newTab: Tab) => {
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
        <div className={`min-h-screen ${
          theme === 'amoled' ? 'bg-black' :
          theme === 'light' ? 'bg-[#F2F4F7]' :
          'bg-brand-ink'
        } text-white selection:bg-brand-orange selection:text-white transition-colors duration-500`}>

          {/* Ambient depth glows */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
            <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-brand-orange/4 rounded-full blur-[140px]" />
            <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-brand-blue/4 rounded-full blur-[140px]" />
          </div>

          <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto min-h-screen relative">

            {/* Flight tracking Dynamic Island */}
            {trackedActivity && (
                <div className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto animate-in fade-in slide-in-from-top-4 duration-300">
                  <DynamicIsland activity={trackedActivity} alertMessage={alertMessage} onClose={() => setTrackedActivity(null)} />
                </div>
            )}
            
            {showDiamondTutorial && <DiamondTutorialOverlay onClose={handleCloseDiamondTutorial} />}
            {runTour && <TutorialOverlay onClose={() => setRunTour(false)} />}

            {/* Offline Banner */}
            {isOffline && (
              <div className="fixed top-0 left-0 w-full z-[60] bg-red-500/90 backdrop-blur-md text-white text-xs font-bold text-center py-2 flex justify-center gap-2 items-center">
                <WifiOff size={12} /> No Internet Connection
              </div>
            )}

            {/* Interstitial Ad */}
            {showInterstitial && (
              <InterstitialAd
                onClose={() => setShowInterstitial(false)}
                onUpgrade={() => { setShowInterstitial(false); handleTabChange(Tab.About); }}
              />
            )}

            {/* ─── Floating Glass Header (non-immersive tabs only) ─── */}
            {!isImmersive && (
              <header className="sticky top-0 z-30 px-4 pt-4 pb-3">
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
                        <span className="text-[9px] font-bold bg-brand-orange/20 text-brand-orange px-1.5 py-0.5 rounded-full">v1.2</span>
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
                    <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-white/30 px-2.5 py-1.5 rounded-xl border border-white/5 bg-white/3">
                      <Clock size={9} />
                      <span className="text-brand-orange font-bold">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
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

                {/* AdSense banner for free users */}
                {(user.tier === UserTier.Guest || user.tier === UserTier.Free) && (
                  <div className="mt-2 rounded-2xl overflow-hidden border border-white/5 bg-white/3">
                    <AdSenseWidget adClient="ca-pub-9455431514273237" adSlot="1234567890" className="w-full" />
                    <p className="text-center text-[9px] text-white/20 pb-1.5 font-medium">
                      Ad ·{' '}
                      <button onClick={() => handleTabChange(Tab.About)} className="text-brand-orange/60 hover:text-brand-orange transition">Remove with Pro</button>
                    </p>
                  </div>
                )}
              </header>
            )}

            {/* ─── Main Content (lazy-mount: only initialize a tab when first visited, then keep alive) ─── */}
            <main className="relative z-10 pb-32">
              {locationDenied && (
                <div className="mx-4 mt-2 mb-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-500 dark:text-red-400 animate-in slide-in-from-top-4">
                  <MapPinOff size={20} className="shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed">
                    <strong className="block font-bold mb-1">Location Services Disabled</strong>
                    UrTC requires location access to auto-detect your city for live weather and map data. Please enable location permissions in your browser/device settings.
                  </div>
                </div>
              )}
              <div style={{ display: activeTab === Tab.Home ? 'block' : 'none' }} className="px-4 pt-3">
                {activeTab === Tab.Home && <HomeView user={user} onNavigate={handleTabChange} onExplore={(city) => { setExploreCity(city); handleTabChange(Tab.Explore); }} onStartTour={() => setRunTour(true)} budgetItems={budgetItems} budgetLimit={budgetLimit} />}
              </div>
              {mountedTabs.has(Tab.Flights) && (
                <div style={{ display: activeTab === Tab.Flights ? 'block' : 'none' }}>
                  <FlightView user={user} onViewCity={handleViewDestination} onTrackFlight={setTrackedActivity} />
                </div>
              )}
              {mountedTabs.has(Tab.Explore) && (
                <div style={{ display: activeTab === Tab.Explore ? 'block' : 'none' }}>
                  <CityView onAddToBudget={addToBudget} initialCity={exploreCity} onCityChange={setExploreCity} theme={theme} />
                </div>
              )}
              {mountedTabs.has(Tab.Wander) && (
                <div style={{ display: activeTab === Tab.Wander ? 'block' : 'none' }}>
                  <SocialView />
                </div>
              )}
              {mountedTabs.has(Tab.Apollo) && (
                <div style={{ display: activeTab === Tab.Apollo ? 'block' : 'none' }} className="px-4 pt-3">
                  <ApolloView userTier={user.tier} onBack={handleBackToHome} />
                </div>
              )}
              {mountedTabs.has(Tab.Itinerary) && (
                <div style={{ display: activeTab === Tab.Itinerary ? 'block' : 'none' }} className="px-4 pt-3">
                  <ItineraryView user={user} />
                </div>
              )}
              {mountedTabs.has(Tab.About) && (
                <div style={{ display: activeTab === Tab.About ? 'block' : 'none' }} className="px-4 pt-3">
                  <AboutView currentUser={user} onUserUpdate={setUser} textSize={textSize} onTextSizeChange={setTextSize} />
                </div>
              )}
            </main>

            <div className="fixed bottom-0 left-0 right-0 z-40 pb-safe pb-4 pt-2 px-4">
              <div className="pill-nav rounded-[28px] px-2 py-2 flex items-center justify-between relative shadow-2xl shadow-black/50 w-full">

                {/* Apollo FAB (elevated center) */}
                <div className="absolute left-1/2 -translate-x-1/2 -top-6 flex flex-col items-center">
                  <button
                    id="tab-apollo"
                    onClick={() => handleTabChange(Tab.Apollo)}
                    className={`relative select-none ${
                      activeTab === Tab.Apollo ? 'animate-glow-pulse' : ''
                    }`}
                  >
                    <div className={`absolute inset-0 rounded-full blur-md transition-opacity ${
                      activeTab === Tab.Apollo ? 'bg-brand-orange/60 opacity-100' : 'opacity-0'
                    }`} />
                    <div className={`relative w-14 h-14 rounded-full border-[3px] ${
                      activeTab === Tab.Apollo
                        ? 'border-brand-orange shadow-lg glow-orange'
                        : 'border-white/10'
                    } overflow-hidden bg-brand-surface transition-all duration-200`}>
                      <img
                        src="/assets/apollo_pilot.jpg"
                        alt="Apollo"
                        className={`w-full h-full object-cover transition-all duration-200 ${
                          activeTab === Tab.Apollo ? '' : 'grayscale opacity-60'
                        }`}
                      />
                    </div>
                  </button>
                  <span className={`text-[9px] font-bold uppercase tracking-wider mt-1 ${
                    activeTab === Tab.Apollo ? 'text-brand-orange' : 'text-white/25'
                  }`}>{t('tabs.apollo')}</span>
                </div>

                {/* Left tabs */}
                {[
                  { tab: Tab.Home, icon: <Home size={22} />, label: t('tabs.home') },
                  { tab: Tab.Flights, icon: <Plane size={22} />, label: t('tabs.flights') },
                  { tab: Tab.Explore, icon: <Building2 size={22} />, label: t('tabs.explore') },
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
                    <div className="relative">{icon}</div>
                    <span className="text-[9px] font-bold uppercase tracking-wide">{label}</span>
                  </button>
                ))}

                {/* Spacer for Apollo */}
                <div className="flex-1 shrink-0" />

                {/* Right tabs */}
                {[
                  { tab: Tab.Wander, icon: <Globe size={22} />, label: t('tabs.wander') },
                  { tab: Tab.Itinerary, icon: <Notebook size={22} />, label: t('tabs.plans') },
                  { tab: Tab.About, icon: <Info size={22} />, label: t('tabs.about') },
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
                    <div className="relative">{icon}</div>
                    <span className="text-[9px] font-bold uppercase tracking-wide">{label}</span>
                  </button>
                ))}
              </div>
            </div>

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
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">ÜrTC — Cave Core Dynamics™</p>
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
                    <p>Flight data is sourced from <strong className="text-brand-orange">FlightAware AeroAPI</strong>, weather from <strong>OpenWeather</strong>, and maps from <strong>Google Maps Platform</strong>. Data accuracy, availability, and pricing are controlled by these third-party providers and may change at any time without notice. Cave Core Dynamics™ is not responsible for inaccuracies in third-party data.</p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-white font-bold text-base">4. No Warranty & Limitation of Liability</h3>
                    <p>The App is provided <strong>"AS IS"</strong> without warranty of any kind. Cave Core Dynamics™, its founders, employees, and affiliates shall not be held liable for any direct, indirect, incidental, or consequential damages arising from your use of the App, including but not limited to missed flights, financial losses, or reliance on AI-generated content.</p>
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
                    <p>We collect only the data necessary to provide the App's services. Account data is stored securely via Supabase. We do not sell your personal information to third parties. For full details, contact <a href="mailto:feedback@cavecoredynamics.org" className="text-brand-orange hover:underline">feedback@cavecoredynamics.org</a>.</p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-white font-bold text-base">8. Dispute Resolution</h3>
                    <p>Any disputes arising from your use of this App shall be resolved through binding arbitration in the State of Georgia, United States, in accordance with applicable laws. By using this App, you waive your right to participate in class-action lawsuits.</p>
                  </div>

                  <div className="bg-brand-orange/10 border border-brand-orange/30 rounded-xl p-4 text-xs text-brand-orange">
                    <p className="font-bold mb-1">⚠️ Important Reminder</p>
                    <p>Gemini AI (Apollo) can make mistakes. Flight data from APIs may be delayed or inaccurate. Pricing for third-party services and subscriptions may change over time. Always double-check critical travel information.</p>
                  </div>

                  <p className="text-[10px] text-gray-500 pt-2">Last updated: June 2026 — © Cave Core Dynamics™. All rights reserved.</p>
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
