
import React, { useState, useEffect } from 'react';
import { Plane, Building2, Moon, Sun, Mic, Info, Notebook, WifiOff, Home, X, Clock, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';
import { HomeView } from './components/HomeView';
import { Tab, BudgetItem, UserTier, Note, Theme, Pass, Flight, UserAccount } from './types';
import { FlightView } from './components/FlightView';
import { CityView } from './components/CityView';
import { ApolloView } from './components/ApolloView';
import { ItineraryView } from './components/ItineraryView';
import { EnhancedApolloDogIcon } from './components/ApolloDog';
import { ApolloLive } from './components/ApolloLive';
import { DynamicIsland } from './components/DynamicIsland';
import { AboutView } from './components/AboutView';
import { InterstitialAd } from './components/InterstitialAd';
import { getActiveUser, logout, setActiveUser } from './services/authService';
import { fetchRealFlights } from './services/apiService';
import { supabase } from './services/supabaseClient';

const SplashScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[100] bg-brand-dark flex flex-col items-center justify-between overflow-hidden py-12">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-blue/20 via-brand-dark to-brand-dark" />

      <div className="flex-1 flex flex-col items-center justify-center relative z-20 space-y-8">
        {/* Jumping Aviator Apollo */}
        <div className="animate-bounce duration-1000">
          <img
            src="/assets/apollo_pilot.jpg"
            alt="Apollo the Aviator Dog"
            className="w-48 h-48 rounded-full shadow-2xl border-4 border-brand-orange object-cover animate-pulse-slow"
          />
        </div>

        <div className="text-center space-y-4">
          <div className="opacity-0 animate-fade-in-text [animation-delay:0.3s] space-y-2">
            <h1 className="text-6xl font-black tracking-tighter text-white drop-shadow-2xl">Ür<span className="text-brand-orange">TC</span></h1>
            <p className="text-2xl font-bold text-gray-200 tracking-widest uppercase">Travel Evolved</p>
          </div>

          <div className="opacity-0 animate-fade-in-text [animation-delay:1.0s]">
            <p className="text-brand-orange font-mono text-sm uppercase tracking-wider bg-brand-orange/10 px-4 py-2 rounded-full inline-block border border-brand-orange/20">
              Powered by Apollo AI
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-20 opacity-0 animate-fade-in-text [animation-delay:1.5s]">
        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Cave Core Dynamics™</p>
      </div>
    </div>
  );
};

const TAB_ORDER = [Tab.Home, Tab.Flights, Tab.Explore, Tab.Apollo, Tab.Itinerary, Tab.About];

const AppContent: React.FC = () => {
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

  const handleTabChange = (newTab: Tab) => {
    const currentIndex = TAB_ORDER.indexOf(activeTab);
    const newIndex = TAB_ORDER.indexOf(newTab);
    setDirection(newIndex > currentIndex ? 1 : -1);
    setActiveTab(newTab);
  };

  const addToBudget = (item: BudgetItem) => setBudgetItems(prev => [...prev, item]);
  const handleViewDestination = (city: string) => {
    setDirection(1);
    setExploreCity(city);
    setActiveTab(Tab.Explore);
  };
  const handleTabSelect = (tab: Tab) => { handleTabChange(tab); };

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      const currentIndex = TAB_ORDER.indexOf(activeTab);
      if (currentIndex < TAB_ORDER.length - 1) handleTabChange(TAB_ORDER[currentIndex + 1]);
    },
    onSwipedRight: () => {
      const currentIndex = TAB_ORDER.indexOf(activeTab);
      if (currentIndex > 0) handleTabChange(TAB_ORDER[currentIndex - 1]);
    },
    preventScrollOnSwipe: true,
    trackMouse: true
  });

  const renderContent = () => {
    switch (activeTab) {
      case Tab.Home: return <HomeView user={user} onNavigate={handleTabChange} onExplore={handleViewDestination} budgetItems={budgetItems} budgetLimit={budgetLimit} />;
      case Tab.Flights: return <FlightView onAddToBudget={addToBudget} userTier={user.tier} onViewCity={handleViewDestination} onTrackFlight={setTrackedActivity} />;
      case Tab.Explore: return <CityView onAddToBudget={addToBudget} initialCity={exploreCity} onCityChange={setExploreCity} theme={theme} />;
      case Tab.Itinerary: return <ItineraryView notes={notes} onAddNote={n => setNotes(p => [n, ...p])} onDeleteNote={id => setNotes(p => p.filter(n => n.id !== id))} passes={passes} onAddPass={p => setPasses(prev => [p, ...prev])} onDeletePass={id => setPasses(prev => prev.filter(p => p.id !== id))} budgetItems={budgetItems} budgetLimit={budgetLimit} onUpdateLimit={setBudgetLimit} userTier={user.tier} />;
      case Tab.Apollo: return <ApolloView userTier={user.tier} onBack={() => handleTabChange(Tab.Home)} />;
      case Tab.About: return <AboutView currentUser={user} onUserUpdate={setUser} textSize={textSize} onTextSizeChange={setTextSize} />;
      default: return <HomeView user={user} onNavigate={handleTabChange} onExplore={handleViewDestination} />;
    }
  };

  return (
    <div className={theme}>
      {showSplash ? (
        <SplashScreen onComplete={() => setShowSplash(false)} />
      ) : (
        <div
          className={`min-h-screen ${theme === 'amoled' ? 'bg-black text-white' : (theme === 'light' ? 'bg-gray-100 text-gray-900' : 'bg-brand-dark text-white')} font-sans selection:bg-brand-orange selection:text-white transition-colors duration-500`}
        >
          {/* Ambient Glows */}
          {theme === 'dark' && <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10"><div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-brand-orange/5 rounded-full blur-[120px]" /><div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-brand-blue/5 rounded-full blur-[120px]" /></div>}

          <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto min-h-screen relative bg-transparent pb-20">
            <AnimatePresence>
              {trackedActivity && (
                <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }}>
                  <DynamicIsland activity={trackedActivity} alertMessage={alertMessage} onClose={() => setTrackedActivity(null)} />
                </motion.div>
              )}
            </AnimatePresence>

            {isOffline && <div className="fixed top-0 left-0 w-full z-[60] bg-red-500/90 backdrop-blur-md text-white text-xs font-bold text-center py-1.5 flex justify-center gap-2"><WifiOff size={12} /> Offline Mode</div>}

            {/* Interstitial Ad Modal */}
            {showInterstitial && (
              <InterstitialAd
                onClose={() => setShowInterstitial(false)}
                onUpgrade={() => {
                  setShowInterstitial(false);
                  handleTabChange(Tab.About);
                }}
              />
            )}

            <header className="sticky top-0 z-30 pt-3 pb-2 px-6 bg-white/80 dark:bg-brand-dark/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/5 transition-all duration-300 text-gray-900 dark:text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative"><div className="absolute inset-0 bg-brand-orange/20 blur-md rounded-full"></div><div className="relative bg-gradient-to-br from-brand-orange to-red-500 w-8 h-8 rounded-lg flex items-center justify-center shadow-lg transform rotate-3"><Plane size={16} className="text-white" /></div></div>
                  <div><h1 className="text-xl font-bold tracking-tight leading-none">Ür<span className="text-brand-orange">TC</span></h1><div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full animate-pulse ${user.tier === UserTier.Pro || user.tier === UserTier.Crew || user.tier === UserTier.Dev ? 'bg-green-500' : 'bg-gray-500'}`}></span><p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">{user.tier === UserTier.Dev ? 'DEV ACCESS' : user.tier === UserTier.Pro ? 'DIAMOND ACCESS' : user.tier === UserTier.Crew ? 'PROFESSIONAL ACCESS' : user.tier === UserTier.Free ? 'SILVER' : 'BRONZE'}</p></div></div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-white/5 px-2 py-1 rounded-lg border border-gray-200 dark:border-white/10">
                    <Clock size={10} />
                    <span>{currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    <span className="text-brand-orange">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <button onClick={() => handleThemeChange(theme === 'dark' ? 'light' : 'dark')} className="p-2 text-gray-500 dark:text-gray-400 hover:text-brand-orange hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition">{theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}</button>
                  <button onClick={() => setShowLive(true)} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-brand-orange hover:bg-brand-orange hover:text-white transition shadow-lg active:scale-95"><Mic size={16} /></button>
                </div>
              </div>
              {/* Mobile date/time bar */}
              <div className="sm:hidden flex items-center justify-center gap-2 mt-1.5 text-[10px] font-mono text-gray-400 dark:text-gray-500">
                <Calendar size={10} />
                <span>{currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                <span className="text-brand-orange font-bold">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </header>

            {/* Ad Banner for Guest/Free */}
            {(user.tier === UserTier.Guest || user.tier === UserTier.Free) && (
              <div className="mx-4 mt-2 p-2 bg-gray-200 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg text-center">
                <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">ADVERTISEMENT</p>
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Upgrade to Pro to remove ads & unlock Apollo AI</p>
              </div>
            )}

            <main className="px-4 pt-4 relative z-10 overflow-hidden" {...handlers}>
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={activeTab}
                  custom={direction}
                  initial={{ x: direction > 0 ? 200 : -200, opacity: 0, scale: 0.98 }}
                  animate={{ x: 0, opacity: 1, scale: 1 }}
                  exit={{ x: direction > 0 ? -200 : 200, opacity: 0, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
                  className="h-full min-h-[80vh]"
                >
                  {renderContent()}
                </motion.div>
              </AnimatePresence>
            </main>

            {/* Main Bottom Navigation - 6 Column Grid */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-brand-surface/95 backdrop-blur-xl border-t border-gray-200 dark:border-white/10 px-1 py-2 grid grid-cols-6 items-end pb-safe z-40 rounded-t-3xl">
              <button onClick={() => handleTabSelect(Tab.Home)} className={`flex flex-col items-center gap-1 p-2 ${activeTab === Tab.Home ? 'text-brand-orange' : 'text-gray-400'}`}>
                <Home size={22} />
                <span className="text-[8px] font-bold uppercase">Home</span>
              </button>

              <button onClick={() => handleTabSelect(Tab.Flights)} className={`flex flex-col items-center gap-1 p-2 ${activeTab === Tab.Flights ? 'text-brand-orange' : 'text-gray-400'}`}>
                <Plane size={22} />
                <span className="text-[8px] font-bold uppercase">Flights</span>
              </button>

              <button onClick={() => handleTabSelect(Tab.Explore)} className={`flex flex-col items-center gap-1 p-2 ${activeTab === Tab.Explore ? 'text-brand-orange' : 'text-gray-400'}`}>
                <Building2 size={22} />
                <span className="text-[8px] font-bold uppercase">City</span>
              </button>

              {/* Central Tab - Apollo AI */}
              <div className="flex justify-center relative -top-6">
                <button onClick={() => handleTabSelect(Tab.Apollo)} className="group flex flex-col items-center">
                  <div className={`p-1 rounded-full border-4 border-gray-100 dark:border-brand-dark shadow-2xl transition-transform active:scale-95 ${activeTab === Tab.Apollo ? 'bg-brand-orange' : 'bg-gray-800'}`}>
                    <img
                      src="/assets/apollo_pilot.jpg"
                      alt="Apollo"
                      className={`w-10 h-10 rounded-full object-cover animate-wag ${activeTab === Tab.Apollo ? 'scale-110' : 'opacity-80 grayscale'}`}
                    />
                  </div>
                  <span className={`text-[8px] font-bold uppercase mt-1 ${activeTab === Tab.Apollo ? 'text-brand-orange' : 'text-gray-400'}`}>Apollo</span>
                </button>
              </div>

              <button onClick={() => handleTabSelect(Tab.Itinerary)} className={`flex flex-col items-center gap-1 p-2 ${activeTab === Tab.Itinerary ? 'text-brand-orange' : 'text-gray-400'}`}>
                <Notebook size={22} />
                <span className="text-[8px] font-bold uppercase">Plans</span>
              </button>

              <button onClick={() => handleTabSelect(Tab.About)} className={`flex flex-col items-center gap-1 p-2 ${activeTab === Tab.About ? 'text-brand-orange' : 'text-gray-400'}`}>
                <Info size={22} />
                <span className="text-[8px] font-bold uppercase">About</span>
              </button>
            </div>

            {showLive && <ApolloLive isOpen={showLive} onClose={() => setShowLive(false)} />}
          </div>
        </div>
      )}
    </div>
  );
};

export default AppContent;
