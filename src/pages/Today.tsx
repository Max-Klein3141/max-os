import {
  Activity,
  BookOpen,
  Check,
  Eye,
  Flame,
  Lightbulb,
  Moon,
  Plus,
  Quote as QuoteIcon,
  RotateCcw,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Gauge } from "../components/ui/Gauge";
import { LevelSlider } from "../components/ui/LevelSlider";
import { getDailyChallenge } from "../lib/challenges";
import { cn } from "../lib/cn";
import { getDailyLog, recentWins, saveLearning, updateDailyLog } from "../lib/daily";
import { dateKey, greeting, humanDate, longDate, subDays, todayKey } from "../lib/dates";
import { currentStreak, isCompleted, isDue, toggleHabitLog } from "../lib/habits";
import { computeMomentum } from "../lib/momentum";
import { dueCards, markReviewed, rescheduleCard } from "../lib/spacedRep";
import { useDatabase } from "../lib/store";
import type { DailyLog, Habit, HabitLogs, SpacedRepCard } from "../types";
import type { ViewKey } from "../views";

interface TodayProps {
  onNavigate: (key: ViewKey) => void;
}

export default function Today({ onNavigate }: TodayProps) {
  const db = useDatabase();
  const now = new Date();
  const key = todayKey();
  const yKey = dateKey(subDays(now, 1));
  const log = getDailyLog(key);
  const yLog = getDailyLog(yKey);

  const momentum = computeMomentum(db, now);
  const activeHabits = db.habits.filter((h) => !h.archived);
  const dueHabits = activeHabits.filter((h) => isDue(h, now));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-zinc-500">{longDate(now)}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
          {greeting(now)}, Max.
        </h1>
      </header>

      <MomentumPanel momentum={momentum} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <HabitsToday
            habits={dueHabits}
            logKeyDate={key}
            logs={db.habitLogs}
            onNavigate={onNavigate}
          />
          <DailyChallengeCard challenge={getDailyChallenge(db, now)} />
          <SpacedRepReview cards={dueCards(key)} />
        </div>

        <div className="space-y-6">
          <VitalsPanel log={log} yLog={yLog} dateKeyStr={key} />
          <WinPanel dateKeyStr={key} initialWin={log.win ?? ""} logs={db.dailyLogs} />
          <LearningPanel dateKeyStr={key} initialLearning={log.learning ?? ""} />
        </div>
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-zinc-200">{value}</div>
    </div>
  );
}

function MomentumPanel({
  momentum,
}: {
  momentum: ReturnType<typeof computeMomentum>;
}) {
  return (
    <Card className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:gap-8">
      <Gauge value={momentum.score} />
      <div className="flex-1">
        <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
          Today's momentum
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          A live read on how today is going — built from your habits, streaks,
          energy, and wins.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatChip
            label="Habits"
            value={`${momentum.doneToday}/${momentum.dueToday}`}
          />
          <StatChip label="Streak pts" value={`${momentum.streak}/20`} />
          <StatChip label="Energy pts" value={`${momentum.energy}/20`} />
          <StatChip label="Win" value={momentum.win ? "Logged" : "—"} />
        </div>
      </div>
    </Card>
  );
}

function HabitsToday({
  habits,
  logKeyDate,
  logs,
  onNavigate,
}: {
  habits: Habit[];
  logKeyDate: string;
  logs: HabitLogs;
  onNavigate: (key: ViewKey) => void;
}) {
  return (
    <Card className="p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        <Flame size={15} className="text-indigo-400" /> Today's habits
      </h2>
      {habits.length === 0 ? (
        <EmptyState
          icon={Flame}
          title="No habits scheduled today"
          subtitle="Create a habit to start building momentum."
          action={
            <Button size="sm" onClick={() => onNavigate("habits")}>
              <Plus size={14} /> New habit
            </Button>
          }
        />
      ) : (
        <ul className="space-y-1.5">
          {habits.map((habit) => {
            const done = isCompleted(logs, habit.id, logKeyDate);
            const streak = currentStreak(habit, logs);
            return (
              <li key={habit.id}>
                <button
                  type="button"
                  onClick={() => toggleHabitLog(habit.id, logKeyDate)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    done
                      ? "border-zinc-700 bg-zinc-800/50"
                      : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/30",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                      done ? "border-transparent" : "border-zinc-600",
                    )}
                    style={done ? { backgroundColor: habit.color } : undefined}
                  >
                    {done && <Check size={13} className="text-zinc-950" strokeWidth={3} />}
                  </span>
                  <span
                    className={cn(
                      "flex-1 text-sm",
                      done ? "text-zinc-500 line-through" : "text-zinc-100",
                    )}
                  >
                    {habit.name}
                  </span>
                  {streak > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-medium text-amber-400">
                      <Flame size={11} /> {streak}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function DailyChallengeCard({
  challenge,
}: {
  challenge: ReturnType<typeof getDailyChallenge>;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <Card className="p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        <Sparkles size={15} className="text-indigo-400" /> Daily challenge
      </h2>

      {challenge.kind === "quote" && (
        <div>
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
            <QuoteIcon size={12} /> Memorize this
          </div>
          {revealed ? (
            <blockquote className="border-l-2 border-indigo-400 pl-4">
              <p className="text-zinc-100">“{challenge.quote.text}”</p>
              {challenge.quote.author && (
                <footer className="mt-1 text-sm text-zinc-500">
                  — {challenge.quote.author}
                </footer>
              )}
            </blockquote>
          ) : (
            <div>
              <p className="text-sm text-zinc-400">
                Try to recall today's quote from memory, then reveal it to
                check.
              </p>
              <Button size="sm" className="mt-3" onClick={() => setRevealed(true)}>
                <Eye size={14} /> Reveal quote
              </Button>
            </div>
          )}
        </div>
      )}

      {challenge.kind === "reflection" && (
        <div>
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
            <Lightbulb size={12} /> Reflect
          </div>
          <p className="text-lg leading-snug text-zinc-100">{challenge.prompt}</p>
          <p className="mt-2 text-sm text-zinc-500">
            Sit with it for a minute. No need to write anything down.
          </p>
        </div>
      )}

      {challenge.kind === "knowledge" && (
        <div>
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
            <BookOpen size={12} /> Revisit
          </div>
          <p className="font-medium text-zinc-100">{challenge.entry.title}</p>
          {revealed ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-400">
              {challenge.entry.body}
            </p>
          ) : (
            <Button size="sm" className="mt-3" onClick={() => setRevealed(true)}>
              <Eye size={14} /> Show what you saved
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function SpacedRepReview({ cards }: { cards: SpacedRepCard[] }) {
  if (cards.length === 0) return null;
  return (
    <Card className="p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        <RotateCcw size={15} className="text-indigo-400" /> Recall review
      </h2>
      <p className="mb-4 text-sm text-zinc-500">
        {cards.length} learning{cards.length > 1 ? "s" : ""} due for review.
      </p>
      <div className="space-y-3">
        {cards.map((card) => (
          <ReviewCard key={card.id} card={card} />
        ))}
      </div>
    </Card>
  );
}

function ReviewCard({ card }: { card: SpacedRepCard }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="text-sm text-zinc-400">
        What did you learn on{" "}
        <span className="font-medium text-zinc-200">
          {humanDate(card.sourceDate)}
        </span>
        ? <span className="text-zinc-600">(+{card.interval}d)</span>
      </p>
      {shown ? (
        <>
          <p className="mt-2 whitespace-pre-wrap text-zinc-100">{card.learning}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="primary" onClick={() => markReviewed(card.id)}>
              <Check size={14} /> Got it
            </Button>
            <Button size="sm" onClick={() => rescheduleCard(card.id)}>
              <RotateCcw size={14} /> Needs work
            </Button>
          </div>
        </>
      ) : (
        <Button size="sm" className="mt-3" onClick={() => setShown(true)}>
          <Eye size={14} /> Show me
        </Button>
      )}
    </div>
  );
}

function VitalsPanel({
  log,
  yLog,
  dateKeyStr,
}: {
  log: DailyLog;
  yLog: DailyLog;
  dateKeyStr: string;
}) {
  return (
    <Card className="space-y-3 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        <Activity size={15} className="text-indigo-400" /> Energy · Sleep · Stress
      </h2>
      <LevelSlider
        label="Energy"
        icon={Zap}
        accent="#34d399"
        value={log.energy}
        yesterday={yLog.energy}
        onChange={(v) => updateDailyLog(dateKeyStr, { energy: v })}
      />
      <LevelSlider
        label="Sleep"
        icon={Moon}
        accent="#818cf8"
        value={log.sleep}
        yesterday={yLog.sleep}
        onChange={(v) => updateDailyLog(dateKeyStr, { sleep: v })}
      />
      <LevelSlider
        label="Stress"
        icon={Activity}
        accent="#fb923c"
        value={log.stress}
        yesterday={yLog.stress}
        onChange={(v) => updateDailyLog(dateKeyStr, { stress: v })}
      />
    </Card>
  );
}

function WinPanel({
  dateKeyStr,
  initialWin,
  logs,
}: {
  dateKeyStr: string;
  initialWin: string;
  logs: Record<string, DailyLog>;
}) {
  const [win, setWin] = useState(initialWin);

  useEffect(() => {
    const t = setTimeout(() => {
      if (win !== (getDailyLog(dateKeyStr).win ?? "")) {
        updateDailyLog(dateKeyStr, { win });
      }
    }, 500);
    return () => clearTimeout(t);
  }, [win, dateKeyStr]);

  const past = recentWins(logs, 8).filter((w) => w.date !== dateKeyStr);

  return (
    <Card className="p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        <Trophy size={15} className="text-indigo-400" /> Win of the day
      </h2>
      <input
        value={win}
        onChange={(e) => setWin(e.target.value)}
        placeholder="What's your biggest win today?"
        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
      />
      {past.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase tracking-wider text-zinc-600">
            Recent wins
          </p>
          <ul className="max-h-40 space-y-2 overflow-y-auto pr-1">
            {past.map((w) => (
              <li key={w.date} className="flex gap-2 text-sm">
                <span className="shrink-0 text-zinc-600">
                  {humanDate(w.date).replace(/, \d{4}$/, "")}
                </span>
                <span className="text-zinc-400">{w.win}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function LearningPanel({
  dateKeyStr,
  initialLearning,
}: {
  dateKeyStr: string;
  initialLearning: string;
}) {
  const [text, setText] = useState(initialLearning);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      if (text !== (getDailyLog(dateKeyStr).learning ?? "")) {
        saveLearning(dateKeyStr, text);
        setSaved(true);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [text, dateKeyStr]);

  return (
    <Card className="p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        <Lightbulb size={15} className="text-indigo-400" /> Today I learned
      </h2>
      <p className="mb-3 text-xs text-zinc-600">
        Saved learnings resurface for review in 7, 14, and 30 days.
      </p>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        rows={4}
        placeholder="One thing you learned or figured out today…"
        className="min-h-24 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
      />
      {saved && text.trim() && (
        <p className="mt-2 flex items-center gap-1 text-xs text-emerald-400">
          <Check size={12} /> Saved & scheduled for review
        </p>
      )}
    </Card>
  );
}
