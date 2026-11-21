-- Migration 004: Education v3 (tags, review metadata, author delete) + AI quota.
-- Idempotent. NOT yet run on production.

-- ============================================================ education_resources
alter table public.education_resources add column if not exists tags text[] not null default '{}';
alter table public.education_resources add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.education_resources add column if not exists reviewed_at timestamptz;
alter table public.education_resources add column if not exists review_note text;

alter table public.education_resources drop constraint if exists education_tags_max5;
alter table public.education_resources add constraint education_tags_max5 check (cardinality(tags) <= 5);
alter table public.education_resources drop constraint if exists education_review_note_len;
alter table public.education_resources add constraint education_review_note_len check (char_length(review_note) <= 500);

create index if not exists education_tags_gin_idx on public.education_resources using gin (tags);

-- Authors may delete their own resources until they are approved.
drop policy if exists "education_author_delete_own" on public.education_resources;
create policy "education_author_delete_own" on public.education_resources for delete to authenticated
  using (author_id = (select auth.uid()) and status <> 'approved');

-- ============================================================ AI quota (Studio / Chatbot)
create table if not exists public.ai_usage(
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  kind text not null check (kind in ('chat','studio')),
  count int not null default 0,
  primary key (user_id, day, kind));
alter table public.ai_usage enable row level security;
drop policy if exists "read own usage" on public.ai_usage;
create policy "read own usage" on public.ai_usage for select to authenticated using (user_id = (select auth.uid()));

-- Called by API routes with the caller's JWT; atomically consumes one unit or returns false.
create or replace function public.consume_ai_quota(p_kind text, p_limit int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v int;
begin
  if auth.uid() is null then return false; end if;
  insert into public.ai_usage(user_id, day, kind, count) values (auth.uid(), current_date, p_kind, 1)
  on conflict (user_id, day, kind) do update set count = public.ai_usage.count + 1
  returning count into v;
  if v > p_limit then
    update public.ai_usage set count = count - 1 where user_id = auth.uid() and day = current_date and kind = p_kind;
    return false;
  end if;
  return true;
end $$;
revoke all on function public.consume_ai_quota(text, int) from public, anon;
grant execute on function public.consume_ai_quota(text, int) to authenticated;
