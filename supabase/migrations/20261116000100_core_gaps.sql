-- 002: close the real gaps found by comparing production (2026-11-16 snapshot) with the app's needs.
-- Idempotent. Run AFTER schema.sql. Before running on production, run the PRE-CHECK below:
--   select reporter_id, post_id, count(*) from public.reports group by 1,2 having count(*) > 1;
-- If it returns rows, the unique index at the end is skipped safely (see DO block) — clean duplicates later.

-- 1) Community: authors can delete their own uploads.
--    Needed to roll back a failed post (T1.3) and to avoid orphan files.
drop policy if exists "delete own community files" on storage.objects;
create policy "delete own community files" on storage.objects for delete to authenticated
  using (bucket_id = 'community-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 2) Comments: admins can remove abusive comments (currently only the author can).
drop policy if exists "admin_delete_comments" on public.comments;
create policy "admin_delete_comments" on public.comments for delete to authenticated
  using ((select public.is_admin()));

-- 3) Reports: keep a handling trail (NOTE §3.4) and bound the reason length.
alter table public.reports add column if not exists handled_by uuid references auth.users(id) on delete set null;
alter table public.reports add column if not exists handled_at timestamptz;
alter table public.reports drop constraint if exists reports_reason_len;
alter table public.reports add constraint reports_reason_len check (char_length(reason) <= 1000) not valid;

-- 4) One report per user per post (anti-spam). Skipped with a notice if duplicates exist.
do $$
begin
  if exists (select 1 from public.reports group by reporter_id, post_id having count(*) > 1) then
    raise notice 'reports has duplicates; unique index NOT created. Clean them up and re-run.';
  else
    create unique index if not exists reports_reporter_post_uniq on public.reports(reporter_id, post_id);
  end if;
end $$;
