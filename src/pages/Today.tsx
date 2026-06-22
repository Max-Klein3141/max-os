import {
  Activity,
  ArrowRight,
  BookOpen,
  CalendarCheck,
  Check,
  Compass,
  Eye,
  Flame,
  Lightbulb,
  Moon,
  NotebookPen,
  Pencil,
  Plus,
  Quote as QuoteIcon,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { startOfISOWeek } from "date-fns";
import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { LearningCapture, RecallReview } from "../components/learning";
import { ReminderBanner } from "../components/ReminderBanner";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Gauge } from "../components/ui/Gauge";
import { LevelSlider } from "../components/ui/LevelSlider";
import { getDailyChallenge } from "../lib/challenges";
import { cn } from "../lib/cn";
import { getDailyLog, recentWins, updateDailyLog } from "../lib/daily";
import {
  dateKey,
  greeting,
  humanDate,
  isoWeekKey,
  longDate,
  subDays,
  todayKey,
} from "../lib/dates";
import { dismissBanner, getDismissals } from "../lib/dismissals";
import {
  currentStreak,
  hasHabitNote,
  isCompleted,
  isDue,
  previousStreak,
  setHabitNote,
  toggleHabitLog,
} from "../lib/habits";
import { computeMomentum } from "../lib/momentum";
import { dueCards } from "../lib/spacedRep";
import { useDatabase } from "../lib/store";
import { weeklyReviewStatus } from "../lib/weekly";
import type { DailyLog, Goal, Habit, HabitLogs, HabitNotes, Todo } from "../types";
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
  const reviewStatus = weeklyReviewStatus(db.weeklyReviews, now);

  // ── Daily completion checks (drive the warning banners) ──────────────────
  const todayEntry = db.journal[key];
  const journaledToday = Boolean(
    todayEntry &&
      Object.values(todayEntry.sections ?? {}).some((v) => v.trim()),
  );
  const winLogged = Boolean(log.win && log.win.trim());
  const learnedToday =
    db.learningItems.some((i) => i.sourceDate === key) ||
    Boolean(log.learning && log.learning.trim());
  const vitalsRated =
    log.energy !== undefined &&
    log.sleep !== undefined &&
    log.stress !== undefined;
  const habitsRemaining = dueHabits.filter(
    (h) => !isCompleted(db.habitLogs, h.id, key),
  ).length;

  const [dismissed, setDismissed] = useState<string[]>(() => getDismissals(key));
  function dismiss(id: string) {
    setDismissed(dismissBanner(key, id));
  }

  const warnings: DailyWarning[] = [];
  if (!journaledToday)
    warnings.push({
      id: "journal",
      icon: NotebookPen,
      message: "You haven't written today's journal entry.",
      label: "Write it",
      onAction: () => onNavigate("journal"),
    });
  if (habitsRemaining > 0)
    warnings.push({
      id: "habits",
      icon: Flame,
      message: `You have ${habitsRemaining} habit${habitsRemaining > 1 ? "s" : ""} left to check off today.`,
      label: "Show me",
      onAction: () => scrollToWidget("today-habits"),
    });
  if (!vitalsRated)
    warnings.push({
      id: "vitals",
      icon: Activity,
      message: "You haven't rated your energy, sleep & stress today.",
      label: "Rate now",
      onAction: () => scrollToWidget("today-vitals"),
    });
  if (!winLogged)
    warnings.push({
      id: "win",
      icon: Trophy,
      message: "You haven't logged your Win of the Day.",
      label: "Log it",
      onAction: () => scrollToWidget("today-win"),
    });
  if (!learnedToday)
    warnings.push({
      id: "learning",
      icon: Lightbulb,
      message: "You haven't captured a learning today.",
      label: "Capture",
      onAction: () => scrollToWidget("today-learning"),
    });
  const visibleWarnings = warnings.filter((w) => !dismissed.includes(w.id));

  // This week's focus = the "focus for next week" written in last week's review.
  const prevWeek = isoWeekKey(subDays(startOfISOWeek(now), 1));
  const weeklyFocus = db.weeklyReviews[prevWeek]?.focusNext?.trim() ?? "";

  return (
    <div className="space-y-6">
      <IdentityHeadline />

      <header>
        <p className="text-sm text-zinc-500">{longDate(now)}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
          {greeting(now)}, Max.
        </h1>
      </header>

      <WeeklyFocusCallout focus={weeklyFocus} onNavigate={onNavigate} />

      {reviewStatus.state !== "ok" && (
        <WeeklyReviewBanner status={reviewStatus} onNavigate={onNavigate} />
      )}

      {visibleWarnings.length > 0 && (
        <div className="space-y-3">
          {visibleWarnings.map((w) => (
            <ReminderBanner
              key={w.id}
              icon={w.icon}
              onDismiss={() => dismiss(w.id)}
              action={
                <Button size="sm" variant="secondary" onClick={w.onAction}>
                  {w.label}
                </Button>
              }
            >
              {w.message}
            </ReminderBanner>
          ))}
        </div>
      )}

      <MorningIntention dateKeyStr={key} value={log.morningIntention ?? ""} />

      <div id="today-habits">
        <HabitsToday
          habits={dueHabits}
          logKeyDate={key}
          logs={db.habitLogs}
          notes={db.habitNotes}
          goals={db.goals}
          onNavigate={onNavigate}
        />
      </div>

      <GoalsToday todos={db.todos} goals={db.goals} todayKeyStr={key} />

      <MomentumPanel momentum={momentum} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div id="today-vitals">
          <VitalsPanel log={log} yLog={yLog} dateKeyStr={key} />
        </div>
        <div id="today-win">
          <WinPanel dateKeyStr={key} initialWin={log.win ?? ""} logs={db.dailyLogs} />
        </div>
        <DailyChallengeCard challenge={getDailyChallenge(db, now)} />
        <div id="today-learning">
          <LearningCapture dateKeyStr={key} routingHint />
        </div>
      </div>

      <RecallReview cards={dueCards(key)} />
    </div>
  );
}

interface DailyWarning {
  id: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  message: string;
  label: string;
  onAction: () => void;
}

function scrollToWidget(id: string) {
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}

const IDENTITY_KEY = "maxos_identity";

function IdentityHeadline() {
  const [value, setValue] = useState(
    () => localStorage.getItem(IDENTITY_KEY) ?? "",
  );
  const [editing, setEditing] = useState(false);

  function commit(next: string) {
    const trimmed = next.trim();
    setValue(trimmed);
    localStorage.setItem(IDENTITY_KEY, trimmed);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        defaultValue={value}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(e.currentTarget.value);
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder="I am the type of person who…"
        className="w-full border-b border-indigo-400/40 bg-transparent pb-1 text-lg font-medium text-white placeholder:text-zinc-600 focus:outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group block w-full text-left"
      title="Click to edit"
    >
      {value ? (
        <span className="text-lg font-medium text-zinc-200">
          <span className="text-zinc-500">I am the type of person who </span>
          {value}
        </span>
      ) : (
        <span className="text-lg font-medium text-zinc-600 transition-colors group-hover:text-zinc-400">
          Define who you are becoming →
        </span>
      )}
    </button>
  );
}

function WeeklyFocusCallout({
  focus,
  onNavigate,
}: {
  focus: string;
  onNavigate: (key: ViewKey) => void;
}) {
  if (!focus) {
    return (
      <button
        type="button"
        onClick={() => onNavigate("weekly")}
        className="block text-sm text-zinc-500 transition-colors hover:text-zinc-300"
      >
        Set your focus for this week →
      </button>
    );
  }
  return (
    <Card className="border-indigo-400/30 bg-indigo-400/[0.06] p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-400/15 text-indigo-300">
          <Compass size={17} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300/80">
            This week's focus
          </p>
          <p className="mt-1 text-lg font-medium leading-snug text-white">
            {focus}
          </p>
        </div>
      </div>
    </Card>
  );
}

function MorningIntention({
  dateKeyStr,
  value,
}: {
  dateKeyStr: string;
  value: string;
}) {
  const [editing, setEditing] = useState(value.trim() === "");
  const [text, setText] = useState(value);

  function save() {
    const trimmed = text.trim();
    updateDailyLog(dateKeyStr, { morningIntention: trimmed || undefined });
    if (trimmed) setEditing(false);
  }

  if (!editing && value.trim()) {
    return (
      <Card className="flex items-start gap-3 border-indigo-400/25 bg-indigo-400/[0.04] p-5">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-400/15 text-indigo-300">
          <Target size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-indigo-300/70">
            Today's one thing
          </p>
          <p className="mt-1 text-lg font-medium leading-snug text-white">{value}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setText(value);
            setEditing(true);
          }}
          aria-label="Edit today's intention"
          className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          <Pencil size={15} />
        </button>
      </Card>
    );
  }

  return (
    <Card className="border-indigo-400/25 bg-indigo-400/[0.04] p-5">
      <label className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
        <Target size={15} className="text-indigo-300" />
        What's the one thing that makes today a win?
      </label>
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
        }}
        onBlur={save}
        placeholder="Name your single most important target for today…"
        className="mt-3 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-[15px] text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400/50 focus:outline-none"
      />
    </Card>
  );
}

function GoalsToday({
  todos,
  goals,
  todayKeyStr,
}: {
  todos: Todo[];
  goals: Goal[];
  todayKeyStr: string;
}) {
  const linked = todos
    .filter((t) => t.date === todayKeyStr && t.goalId)
    .map((t) => ({ todo: t, goal: goals.find((g) => g.id === t.goalId) }))
    .filter((x): x is { todo: Todo; goal: Goal } => Boolean(x.goal));

  if (linked.length === 0) return null;

  return (
    <Card className="p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        <Target size={15} className="text-indigo-400" /> Moving toward your goals today
      </h2>
      <ul className="space-y-2">
        {linked.map(({ todo, goal }) => (
          <li
            key={todo.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/60 px-3 py-2"
          >
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-sm",
                todo.done ? "text-zinc-500 line-through" : "text-zinc-200",
              )}
            >
              {todo.text}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-indigo-300/90">
              <ArrowRight size={13} /> {goal.title || "Untitled goal"}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function WeeklyReviewBanner({
  status,
  onNavigate,
}: {
  status: ReturnType<typeof weeklyReviewStatus>;
  onNavigate: (key: ViewKey) => void;
}) {
  if (status.state === "ok") return null;
  const message =
    status.state === "dueToday"
      ? `It's Sunday — your weekly review for ${status.week} isn't done yet.`
      : `You haven't done your weekly review for ${status.week}.`;
  return (
    <ReminderBanner
      icon={CalendarCheck}
      action={
        <Button size="sm" variant="secondary" onClick={() => onNavigate("weekly")}>
          Do it now
        </Button>
      }
    >
      {message}
    </ReminderBanner>
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
  notes,
  goals,
  onNavigate,
}: {
  habits: Habit[];
  logKeyDate: string;
  logs: HabitLogs;
  notes: HabitNotes;
  goals: Goal[];
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
            const lapsed = previousStreak(habit, logs);
            const showRecovery =
              streak === 0 &&
              lapsed >= 3 &&
              !hasHabitNote(notes, habit.id, logKeyDate);
            const linkedGoal = habit.goalId
              ? goals.find((g) => g.id === habit.goalId)
              : undefined;
            return (
              <li key={habit.id}>
                <button
                  type="button"
                  onClick={() => toggleHabitLog(habit.id, logKeyDate)}
                  title={
                    habit.minimumViable
                      ? `On a hard day, at least: ${habit.minimumViable}`
                      : undefined
                  }
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
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
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-sm",
                        done ? "text-zinc-500 line-through" : "text-zinc-100",
                      )}
                    >
                      {habit.name}
                    </span>
                    {habit.identityStatement && (
                      <span className="mt-0.5 block text-xs italic text-zinc-500">
                        {habit.identityStatement}
                      </span>
                    )}
                    {linkedGoal && (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-indigo-300/80">
                        <Target size={10} /> {linkedGoal.title || "Untitled goal"}
                      </span>
                    )}
                    {habit.minimumViable && (
                      <span className="mt-0.5 hidden text-xs text-zinc-500 group-hover:block">
                        Hard day floor: {habit.minimumViable}
                      </span>
                    )}
                  </span>
                  {streak >= 2 && (
                    <span
                      title={`${streak}-day streak`}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 self-start rounded-full px-2 py-0.5 text-xs font-medium",
                        streak >= 3
                          ? "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30"
                          : "bg-zinc-800 text-amber-400",
                      )}
                    >
                      <Flame size={11} /> {streak} day streak
                    </span>
                  )}
                </button>
                {showRecovery && (
                  <StreakRecoveryBanner
                    habitId={habit.id}
                    dateKeyStr={logKeyDate}
                    lapsed={lapsed}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function StreakRecoveryBanner({
  habitId,
  dateKeyStr,
  lapsed,
}: {
  habitId: string;
  dateKeyStr: string;
  lapsed: number;
}) {
  const [text, setText] = useState("");

  function submit() {
    setHabitNote(habitId, dateKeyStr, text);
  }

  return (
    <div className="mt-1.5 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
      <p className="text-xs font-medium text-amber-100/90">
        You had a {lapsed}-day streak. Restart?
      </p>
      <div className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="What will you do differently this time?"
          className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-400/50 focus:outline-none"
        />
        <Button size="sm" variant="secondary" onClick={submit}>
          Save
        </Button>
      </div>
    </div>
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
  const logged = Boolean(win.trim());

  return (
    <Card
      className={cn(
        "p-5 transition-all",
        logged
          ? "border-zinc-800"
          : "border-amber-400/40 shadow-[0_0_0_1px_rgba(251,191,36,0.25)] animate-pulse-border",
      )}
    >
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        <Trophy size={15} className="text-indigo-400" /> Win of the day
        {logged && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-emerald-300">
            <Check size={11} /> Logged
          </span>
        )}
      </h2>
      <input
        value={win}
        onChange={(e) => setWin(e.target.value)}
        placeholder="What's your biggest win today?"
        className={cn(
          "w-full rounded-lg border bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none",
          logged
            ? "border-zinc-800 focus:border-indigo-400/50"
            : "border-amber-400/40 focus:border-amber-400/60",
        )}
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
