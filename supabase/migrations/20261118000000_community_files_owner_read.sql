-- 003: let uploaders read (and therefore delete) their OWN files in community-files.
-- Found by scripts/rls-smoke.mjs: storage.remove() first SELECTs the object; the existing
-- "read community files" policy only exposes files already linked in post_attachments, so a
-- file uploaded for a post whose attachment insert failed could never be cleaned up
-- (remove() returned [] silently, leaving an orphan). Idempotent.
drop policy if exists "read own community files" on storage.objects;
create policy "read own community files" on storage.objects for select to authenticated
  using (bucket_id = 'community-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
