-- ============================================================================
-- MAX OS — Supabase schema
--
-- This script defines every table to match exactly what src/lib/db.ts reads
-- and writes. Run it once in the Supabase dashboard → SQL Editor.
--
-- ⚠️  It DROPS the existing MAX OS tables first, so any data currently in
--     Supabase is reset. That's intentional: the prior tables didn't match the
--     app and the migration mostly failed, so there's little/no good data there.
--     Your localStorage data is preserved and will re-upload on the next reload.
--
-- Notes on id strategy:
--   • habits / goals / todos / knowledge use a TEXT id supplied by the app
--     (the local uid()), so local and cloud ids stay matched.
--   • habit_logs / daily_logs / journal_entries / weekly_reviews / settings use
--     a server-generated uuid plus a UNIQUE natural key (the app upserts/looks
--     them up by user_id + date/week/etc).
-- ============================================================================

drop table if exists public.habit_logs    cascade;
drop table if exists public.daily_logs     cascade;
drop table if exists public.journal_entries cascade;
drop table if exists public.weekly_reviews  cascade;
drop table if exists public.todos           cascade;
drop table if exists public.knowledge       cascade;
drop table if exists public.settings        cascade;
drop table if exists public.habits          cascade;
drop table if exists public.goals           cascade;

-- ── habits ──────────────────────────────────────────────────────────────────
create table public.habits (
  id                 text primary key,
  user_id            uuid not null references auth.users(id) on delete cascade,
  name               text not null,
  description        text,
  frequency          text not null,
  color              text,
  category           text,
  custom_days        jsonb,
  identity_statement text,
  minimum_viable     text,
  goal_id            text,
  archived           boolean not null default false,
  created_at         timestamptz not null default now()
);

-- ── goals ───────────────────────────────────────────────────────────────────
create table public.goals (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  description text,
  horizon     text,
  progress    integer not null default 0,
  image       text,
  milestones  jsonb,
  target_date text,
  created_at  timestamptz not null default now()
);

-- ── habit_logs ──────────────────────────────────────────────────────────────
create table public.habit_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  habit_id   text not null,
  date       text not null,
  completed  boolean not null default false,
  note       text,
  created_at timestamptz not null default now(),
  unique (user_id, habit_id, date)
);

-- ── daily_logs ──────────────────────────────────────────────────────────────
create table public.daily_logs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  date              text not null,
  energy            integer,
  sleep             integer,
  stress            integer,
  wins              text,
  learning          text,
  morning_intention text,
  created_at        timestamptz not null default now(),
  unique (user_id, date)
);

-- ── journal_entries ─────────────────────────────────────────────────────────
create table public.journal_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  date          text not null,
  sections      jsonb,
  content       text,
  goal_progress jsonb,
  tags          jsonb,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (user_id, date)
);

-- ── weekly_reviews ──────────────────────────────────────────────────────────
create table public.weekly_reviews (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  week_start      text not null,
  highlights      text,
  challenges      text,
  lessons         text,
  goal_progress   text,
  next_week_focus text,
  word            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ── todos ───────────────────────────────────────────────────────────────────
create table public.todos (
  id           text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  text         text not null,
  done         boolean not null default false,
  priority     boolean not null default false,
  date         text not null,
  sort_order   integer not null default 0,
  start_min    integer,
  duration_min integer,
  goal_id      text,
  created_at   timestamptz not null default now()
);

-- ── knowledge ───────────────────────────────────────────────────────────────
create table public.knowledge (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  body        text,
  tags        jsonb,
  source      text,
  source_type text,
  created_at  timestamptz not null default now()
);

-- ── settings (one row per user) ─────────────────────────────────────────────
create table public.settings (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ── Row Level Security: each user can only see/modify their own rows ─────────
do $$
declare t text;
begin
  foreach t in array array[
    'habits','goals','habit_logs','daily_logs','journal_entries',
    'weekly_reviews','todos','knowledge','settings'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format(
      'create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t || '_owner', t
    );
  end loop;
end $$;
