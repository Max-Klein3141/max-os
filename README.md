# MAX OS

A personal life operating system — a local-first dashboard for habits,
journaling, planning, knowledge, and reflection. No backend, no login, no
network. Everything lives in your browser's `localStorage`, so it works fully
offline after the first load.

## Getting started

```bash
npm install      # first time only
npm run dev      # start the dev server (prints a localhost URL)
```

Then open the printed URL (usually http://localhost:5173) in your browser.

Other commands:

```bash
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build locally
```

## Sections

- **Today** — momentum score, today's habits, a daily challenge, spaced-repetition
  recall reviews, energy/sleep/stress sliders, win of the day, and a learning log.
- **Habits** — create habits (daily / weekdays / custom days), a 60-day heatmap per
  habit, current & longest streaks, and a 30-day momentum scale.
- **Journal** — one entry per day, auto-saved as you type, with tags and full-text search.
- **Planner & Goals** — a daily to-do list (drag to reorder, priority flags, rollover of
  unfinished tasks) plus short / mid / long-term goals with progress, milestones, target
  dates, and motivational images.
- **Knowledge Base** — a permanent, searchable library of insights, filterable by tag and source.
- **Analytics** — completion rates, momentum over time, vitals trends, journal cadence, a
  streak leaderboard, knowledge growth, and a win feed.
- **Weekly Review** — a structured weekly template with auto-populated habit and vitals stats.
- **Data** — export/import a full JSON backup, manage the challenge-quote pool, and reset.

## How your data works

All data is stored locally under `maxos_*` keys in `localStorage`. Nothing leaves your
machine. Use **Data → Export** regularly to keep a backup, since clearing your browser data
will erase everything. Uploaded goal images are downscaled and stored as base64.

## Tech

React 19 + TypeScript, Vite, Tailwind CSS v4, date-fns, recharts, and lucide-react.
A small `useSyncExternalStore`-based store (`src/lib/store.ts`) keeps every view in sync.
Pages are code-split and lazy-loaded.
