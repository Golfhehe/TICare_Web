-- Migration 005 (Dot 4, T4.6): saved Motion Insight sessions (plan contract C2).
-- Aggregated indicators only: no video, no identity. `label` is a teacher-chosen code, never a real name.
-- Idempotent. RLS: owner-only.

create table if not exists public.motion_sessions(
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text check (char_length(label) <= 60),
  source text not null check (source in ('camera','video')),
  started_at timestamptz not null,
  duration_s int not null check (duration_s between 1 and 14400),
  settings jsonb not null default '{}'::jsonb,
  events jsonb not null default '[]'::jsonb check (jsonb_array_length(events) <= 2000),
  series jsonb not null default '[]'::jsonb check (pg_column_size(series) < 500000),
  note text check (char_length(note) <= 2000),
  created_at timestamptz not null default now());

create index if not exists motion_sessions_owner_started_idx on public.motion_sessions(owner_id, started_at desc);

alter table public.motion_sessions enable row level security;
drop policy if exists "own motion sessions" on public.motion_sessions;
create policy "own motion sessions" on public.motion_sessions for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
