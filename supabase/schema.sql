-- TICare initial community schema; run in Supabase SQL editor.
create extension if not exists pgcrypto;
create table if not exists public.profiles(id uuid primary key references auth.users(id) on delete cascade,display_name text not null default 'Thành viên',role text not null default 'member' check(role in('member','admin')),created_at timestamptz default now());
create or replace function public.new_profile() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1)));return new;end;$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.new_profile();
create table if not exists public.posts(id uuid primary key default gen_random_uuid(),author_id uuid not null references auth.users(id) on delete cascade,title text not null check(char_length(title) between 3 and 150),body text not null check(char_length(body) between 5 and 20000),category text not null,status text not null default 'published' check(status in('published','hidden','removed')),created_at timestamptz not null default now());
create table if not exists public.post_attachments(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.posts(id) on delete cascade,storage_path text not null,filename text not null,mime_type text,size_bytes bigint,created_at timestamptz default now());
create table if not exists public.comments(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.posts(id) on delete cascade,author_id uuid not null references auth.users(id) on delete cascade,body text not null check(char_length(body) between 1 and 3000),created_at timestamptz default now());
create table if not exists public.reports(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.posts(id) on delete cascade,reporter_id uuid not null references auth.users(id) on delete cascade,reason text not null,status text not null default 'pending' check(status in('pending','reviewed','dismissed')),created_at timestamptz default now());
create index if not exists posts_created_idx on public.posts(created_at desc);
create index if not exists comments_post_idx on public.comments(post_id);
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin')$$;
alter table public.profiles enable row level security;alter table public.posts enable row level security;alter table public.post_attachments enable row level security;alter table public.comments enable row level security;alter table public.reports enable row level security;
create policy "public profiles" on public.profiles for select using(true);
create policy "own profile" on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()) and role='member');
create policy "read public posts" on public.posts for select using(status='published' or author_id=(select auth.uid()) or public.is_admin());
create policy "write own posts" on public.posts for insert to authenticated with check(author_id=(select auth.uid()) and status='published');
create policy "delete own posts" on public.posts for delete to authenticated using(author_id=(select auth.uid()) or public.is_admin());
create policy "read attachments" on public.post_attachments for select using(exists(select 1 from public.posts p where p.id=post_id and (p.status='published' or p.author_id=(select auth.uid()) or public.is_admin())));
create policy "attach to own post" on public.post_attachments for insert to authenticated with check(exists(select 1 from public.posts p where p.id=post_id and p.author_id=(select auth.uid())));
create policy "read comments" on public.comments for select using(exists(select 1 from public.posts p where p.id=post_id and p.status='published'));
create policy "write comments" on public.comments for insert to authenticated with check(author_id=(select auth.uid()) and exists(select 1 from public.posts p where p.id=post_id and p.status='published'));
create policy "read own reports" on public.reports for select to authenticated using(reporter_id=(select auth.uid()) or public.is_admin());
create policy "create reports" on public.reports for insert to authenticated with check(reporter_id=(select auth.uid()));
-- Public storage bucket for community files in this demo. DO NOT upload sensitive documents.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('community-files','community-files',false,8388608,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
create policy "upload own community files" on storage.objects for insert to authenticated with check(bucket_id='community-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "read community files" on storage.objects for select using(bucket_id='community-files' and exists(select 1 from public.post_attachments a join public.posts p on p.id=a.post_id where a.storage_path=name and (p.status='published' or p.author_id=(select auth.uid()) or public.is_admin())));
-- Grant admin manually from Supabase SQL editor: update public.profiles set role='admin' where id='YOUR-USER-UUID';
-- Note: production moderation, scanning uploads, rate limits and more policies are required before public launch.
