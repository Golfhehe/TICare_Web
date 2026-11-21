-- TICare database schema — baseline migration (001).
-- Reconstructed from the PRODUCTION snapshot taken 2026-11-16
-- (supabase/snapshot_production_part1.csv + part2.csv). Idempotent: safe to re-run.
-- Local: `npx supabase db reset` applies migrations/ in order, then seed.sql.
-- Grant admin manually: update public.profiles set role='admin' where id='<user-uuid>';
-- NOTE: bucket file_size_limit / allowed_mime_types for action-notes and education-resources
--       were not captured in the snapshot; values below are reasonable defaults.

create extension if not exists pgcrypto;

-- ============================================================ tables
create table if not exists public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Thành viên',
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz default now());

create table if not exists public.posts(
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) >= 3 and char_length(title) <= 150),
  body text not null check (char_length(body) >= 5 and char_length(body) <= 20000),
  category text not null,
  status text not null default 'published' check (status in ('published','hidden','removed')),
  created_at timestamptz not null default now());

create table if not exists public.post_attachments(
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  storage_path text not null,
  filename text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz default now());

create table if not exists public.comments(
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) >= 1 and char_length(body) <= 3000),
  created_at timestamptz default now());

create table if not exists public.reports(
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
  created_at timestamptz default now());

create table if not exists public.saved_posts(
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id));

create table if not exists public.action_plans(
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) >= 3 and char_length(title) <= 120),
  status text not null default 'draft' check (status in ('draft','active','done')),
  plan jsonb not null default '{}'::jsonb
    check (jsonb_typeof(plan) = 'object' and pg_column_size(plan) < 250000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());

create table if not exists public.education_resources(
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) >= 1 and char_length(trim(title)) <= 120),
  description text not null default '' check (char_length(description) <= 500),
  audience text not null check (audience in ('mam_non','lop_1','lop_2','lop_3')),
  kind text not null check (kind in ('slide','scratch','document','link')),
  storage_path text,
  external_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  constraint resource_one_source check (
    (kind = 'link' and storage_path is null and external_url ~ '^https://')
    or (kind <> 'link' and storage_path is not null and external_url is null)));

-- ============================================================ indexes
create index if not exists posts_created_idx on public.posts(created_at desc);
create index if not exists posts_author_created_idx on public.posts(author_id, created_at desc);
create index if not exists comments_post_idx on public.comments(post_id);
create index if not exists comments_author_idx on public.comments(author_id);
create index if not exists reports_status_created_idx on public.reports(status, created_at desc);
create index if not exists saved_posts_post_idx on public.saved_posts(post_id);
create index if not exists action_plans_owner_updated_idx on public.action_plans(owner_id, updated_at desc);
create index if not exists education_author_idx on public.education_resources(author_id);
create index if not exists education_status_date_idx on public.education_resources(status, created_at desc);

-- ============================================================ functions & triggers
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$select exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin')$$;

create or replace function public.new_profile() returns trigger
language plpgsql security definer set search_path = public as
$$ begin insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1)));return new;end;$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.new_profile();

-- Members may only change display_name (blocks self-promotion to admin).
create or replace function public.ticare_protect_profile() returns trigger
language plpgsql set search_path = public as $$
BEGIN
  IF auth.uid() IS NOT NULL AND (
    NEW.id IS DISTINCT FROM OLD.id OR
    NEW.role IS DISTINCT FROM OLD.role OR
    NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Only display_name can be changed';
  END IF;
  RETURN NEW;
END; $$;
drop trigger if exists ticare_guard_profile on public.profiles;
create trigger ticare_guard_profile before update on public.profiles for each row execute function public.ticare_protect_profile();

-- Non-admins: no ownership/date change; status only published -> removed (soft delete).
create or replace function public.ticare_protect_post() returns trigger
language plpgsql set search_path = public as $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR
       NEW.author_id IS DISTINCT FROM OLD.author_id OR
       NEW.created_at IS DISTINCT FROM OLD.created_at OR
       (NEW.status IS DISTINCT FROM OLD.status AND
         NOT (OLD.status = 'published' AND NEW.status = 'removed'))
    THEN
      RAISE EXCEPTION 'Not allowed to change protected post fields';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
drop trigger if exists ticare_guard_post on public.posts;
create trigger ticare_guard_post before update on public.posts for each row execute function public.ticare_protect_post();

create or replace function public.ticare_protect_comment() returns trigger
language plpgsql set search_path = public as $$
BEGIN
  IF auth.uid() IS NOT NULL AND (
    NEW.id IS DISTINCT FROM OLD.id OR
    NEW.author_id IS DISTINCT FROM OLD.author_id OR
    NEW.post_id IS DISTINCT FROM OLD.post_id OR
    NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Only comment body can be changed';
  END IF;
  RETURN NEW;
END; $$;
drop trigger if exists ticare_guard_comment on public.comments;
create trigger ticare_guard_comment before update on public.comments for each row execute function public.ticare_protect_comment();

create or replace function public.ticare_action_guard() returns trigger
language plpgsql set search_path = public as $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Cannot change action plan ownership or creation date';
    END IF;
  END IF;
  NEW.updated_at=now();
  RETURN NEW;
END; $$;
drop trigger if exists ticare_action_guard_trigger on public.action_plans;
create trigger ticare_action_guard_trigger before update on public.action_plans for each row execute function public.ticare_action_guard();

-- ============================================================ row level security
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_attachments enable row level security;
alter table public.comments enable row level security;
alter table public.reports enable row level security;
alter table public.saved_posts enable row level security;
alter table public.action_plans enable row level security;
alter table public.education_resources enable row level security;

-- profiles
drop policy if exists "public profiles" on public.profiles;
create policy "public profiles" on public.profiles for select using (true);
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- posts
drop policy if exists "read public posts" on public.posts;
create policy "read public posts" on public.posts for select
  using (status = 'published' or author_id = (select auth.uid()) or public.is_admin());
drop policy if exists "write own posts" on public.posts;
create policy "write own posts" on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()) and status = 'published');
drop policy if exists "member_edit_own_posts" on public.posts;
create policy "member_edit_own_posts" on public.posts for update to authenticated
  using (author_id = (select auth.uid()) and status = 'published')
  with check (author_id = (select auth.uid()) and status in ('published','removed'));
drop policy if exists "admin_moderate_posts" on public.posts;
create policy "admin_moderate_posts" on public.posts for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "delete own posts" on public.posts;
create policy "delete own posts" on public.posts for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_admin());

-- post_attachments
drop policy if exists "read attachments" on public.post_attachments;
create policy "read attachments" on public.post_attachments for select
  using (exists (select 1 from public.posts p where p.id = post_id
    and (p.status = 'published' or p.author_id = (select auth.uid()) or public.is_admin())));
drop policy if exists "attach to own post" on public.post_attachments;
create policy "attach to own post" on public.post_attachments for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())));

-- comments
drop policy if exists "read comments" on public.comments;
create policy "read comments" on public.comments for select
  using (exists (select 1 from public.posts p where p.id = post_id and p.status = 'published'));
drop policy if exists "write comments" on public.comments;
create policy "write comments" on public.comments for insert to authenticated
  with check (author_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id and p.status = 'published'));
drop policy if exists "member_edit_own_comments" on public.comments;
create policy "member_edit_own_comments" on public.comments for update to authenticated
  using (author_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id and p.status = 'published'))
  with check (author_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id and p.status = 'published'));
drop policy if exists "member_delete_own_comments" on public.comments;
create policy "member_delete_own_comments" on public.comments for delete to authenticated
  using (author_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id and p.status = 'published'));

-- reports
drop policy if exists "read own reports" on public.reports;
create policy "read own reports" on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_admin());
drop policy if exists "create reports" on public.reports;
create policy "create reports" on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
drop policy if exists "admin_manage_reports" on public.reports;
create policy "admin_manage_reports" on public.reports for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- saved_posts
drop policy if exists "saved_posts_read_own" on public.saved_posts;
create policy "saved_posts_read_own" on public.saved_posts for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "saved_posts_insert_own" on public.saved_posts;
create policy "saved_posts_insert_own" on public.saved_posts for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id and p.status = 'published'));
drop policy if exists "saved_posts_delete_own" on public.saved_posts;
create policy "saved_posts_delete_own" on public.saved_posts for delete to authenticated
  using (user_id = (select auth.uid()));

-- action_plans (private to owner)
drop policy if exists "action_select_own" on public.action_plans;
create policy "action_select_own" on public.action_plans for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "action_insert_own" on public.action_plans;
create policy "action_insert_own" on public.action_plans for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists "action_update_own" on public.action_plans;
create policy "action_update_own" on public.action_plans for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "action_delete_own" on public.action_plans;
create policy "action_delete_own" on public.action_plans for delete to authenticated using (owner_id = (select auth.uid()));

-- education_resources (moderated)
drop policy if exists "education_public_read" on public.education_resources;
create policy "education_public_read" on public.education_resources for select to anon, authenticated
  using (status = 'approved' or (select auth.uid()) = author_id or (select public.is_admin()));
drop policy if exists "education_member_insert" on public.education_resources;
create policy "education_member_insert" on public.education_resources for insert to authenticated
  with check (author_id = (select auth.uid()) and status = 'pending'
    and (kind = 'link' or storage_path like (auth.uid())::text || '/%'));
drop policy if exists "education_admin_review" on public.education_resources;
create policy "education_admin_review" on public.education_resources for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ============================================================ storage
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values
  ('community-files','community-files',false,8388608,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
insert into storage.buckets(id, name, public, file_size_limit) values
  ('action-notes','action-notes',false,10485760),
  ('education-resources','education-resources',false,52428800)
on conflict (id) do nothing;

-- community-files
drop policy if exists "upload own community files" on storage.objects;
create policy "upload own community files" on storage.objects for insert to authenticated
  with check (bucket_id = 'community-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "read community files" on storage.objects;
create policy "read community files" on storage.objects for select
  using (bucket_id = 'community-files' and exists (
    select 1 from public.post_attachments a join public.posts p on p.id = a.post_id
    where a.storage_path = name and (p.status = 'published' or p.author_id = (select auth.uid()) or public.is_admin())));

-- action-notes: <owner uid>/<action_plan id>/<file>
drop policy if exists "action_notes_owner_read" on storage.objects;
create policy "action_notes_owner_read" on storage.objects for select to authenticated
  using (bucket_id = 'action-notes' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "action_notes_owner_insert" on storage.objects;
create policy "action_notes_owner_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'action-notes' and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.action_plans ap
      where ap.id::text = (storage.foldername(name))[2] and ap.owner_id = (select auth.uid())));
drop policy if exists "action_notes_owner_delete" on storage.objects;
create policy "action_notes_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'action-notes' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- education-resources: <author uid>/<file>
drop policy if exists "education_storage_upload" on storage.objects;
create policy "education_storage_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'education-resources' and (storage.foldername(name))[1] = (auth.uid())::text);
drop policy if exists "education_storage_read" on storage.objects;
create policy "education_storage_read" on storage.objects for select to authenticated
  using (bucket_id = 'education-resources' and (
    (storage.foldername(name))[1] = (auth.uid())::text or (select public.is_admin())
    or exists (select 1 from public.education_resources r where r.storage_path = name and r.status = 'approved')));
drop policy if exists "education_storage_read_public" on storage.objects;
create policy "education_storage_read_public" on storage.objects for select to anon
  using (bucket_id = 'education-resources'
    and exists (select 1 from public.education_resources r where r.storage_path = name and r.status = 'approved'));
drop policy if exists "education_storage_cleanup" on storage.objects;
create policy "education_storage_cleanup" on storage.objects for delete to authenticated
  using (bucket_id = 'education-resources' and (storage.foldername(name))[1] = (auth.uid())::text
    and not exists (select 1 from public.education_resources r where r.storage_path = name and r.status = 'approved'));
