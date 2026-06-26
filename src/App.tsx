import { Menu } from "lucide-react";
import { lazy, Suspense, useState, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import { Sidebar } from "./components/Sidebar";
import type { ViewKey } from "./views";
import { supabase } from './lib/supabase';
import { Auth, ResetPassword } from './lib/Auth';
import { migrateFromLocalStorage, fetchHabits, fetchHabitLogs, fetchDailyLogs, fetchJournalEntries, fetchWeeklyReviews, fetchGoals } from './lib/db';
import { replaceDatabase } from './lib/store';

const Today = lazy(() => import("./pages/Today"));
const Habits = lazy(() => import("./pages/Habits"));
const Journal = lazy(() => import("./pages/Journal"));
const Planner = lazy(() => import("./pages/Planner"));
const Knowledge = lazy(() => import("./pages/Knowledge"));
const Learning = lazy(() => import("./pages/Learning"));
const Analytics = lazy(() => import("./pages/Analytics"));
const WeeklyReview = lazy(() => import("./pages/WeeklyReview"));
const Settings = lazy(() => import("./pages/Settings"));

const VALID_VIEWS: ViewKey[] = [
  "today",
  "habits",
  "journal",
  "planner",
  "knowledge",
  "learning",
  "analytics",
  "weekly",
  "settings",
];

const LAST_VIEW_KEY = "maxos_view";

function renderView(view: ViewKey, navigate: (key: ViewKey) => void) {
  switch (view) {
    case "today":
      return <Today onNavigate={navigate} />;
    case "habits":
      return <Habits />;
    case "journal":
      return <Journal />;
    case "planner":
      return <Planner />;
    case "knowledge":
      return <Knowledge />;
    case "learning":
      return <Learning onNavigate={navigate} />;
    case "analytics":
      return <Analytics />;
    case "weekly":
      return <WeeklyReview />;
    case "settings":
      return <Settings />;
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);
  const [view, setView] = useState<ViewKey>(() => {
    const saved = localStorage.getItem(LAST_VIEW_KEY) as ViewKey | null;
    return saved && VALID_VIEWS.includes(saved) ? saved : "today";
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    async function initializeApp() {
      try {
        setLoading(true);
        
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // Run migration first
          await migrateFromLocalStorage();
          
          // Load all data from Supabase
          const [habits, habitLogs, dailyLogs, journalEntries, weeklyReviews, goals] = await Promise.all([
            fetchHabits(),
            fetchHabitLogs(),
            fetchDailyLogs(),
            fetchJournalEntries(),
            fetchWeeklyReviews(),
            fetchGoals(),
          ]);
          
          // Populate the store with fetched data
          replaceDatabase({
            habits,
            habitLogs,
            dailyLogs,
            journal: journalEntries,
            weeklyReviews,
            goals,
          });
          
          setSession(session);
        }
      } catch (error) {
        console.error("Error initializing app:", error);
      } finally {
        setLoading(false);
      }
    }
    
    initializeApp();
    
    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Arriving via a password-reset link: show the "set new password" screen.
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(session);
    });
    
    return () => {
      subscription?.unsubscribe();
    };
  }, [])

  if (recovery) {
    return <ResetPassword onDone={() => setRecovery(false)} />;
  }

  if (loading || !session) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        {loading ? (
          <div className="text-center">
            <div className="mb-4 text-zinc-400">Loading your Max OS...</div>
            <div className="animate-spin w-8 h-8 border-2 border-zinc-700 border-t-zinc-100 rounded-full mx-auto"></div>
          </div>
        ) : (
          <Auth />
        )}
      </div>
    );
  }

  function navigate(key: ViewKey) {
    setView(key);
    localStorage.setItem(LAST_VIEW_KEY, key);
    setMobileOpen(false);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100">

  
      <Sidebar
        active={view}
        onNavigate={navigate}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-bold uppercase tracking-[0.2em] text-white">
            Max OS
          </span>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-5 py-8 md:px-10">
            <Suspense fallback={<div className="h-1" />}>
              <div key={view} className="animate-fade-in">
                {renderView(view, navigate)}
              </div>
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
