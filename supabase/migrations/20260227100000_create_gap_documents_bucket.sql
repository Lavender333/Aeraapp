-- Create GAP documents storage bucket (idempotent)
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'gap_documents',
  'gap_documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain']
)
on conflict (id) do nothing;

-- Ensure RLS is enabled for storage.objects (usually already enabled by Supabase)
DO $$
BEGIN
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping ALTER TABLE storage.objects: must be owner of table objects.';
END
$$;

-- Remove old policies if they already exist (safe when not table owner)
DO $$
BEGIN
  BEGIN EXECUTE 'DROP POLICY IF EXISTS gap_documents_insert_own ON storage.objects'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'Skipping drop policy gap_documents_insert_own (insufficient privileges).'; END;
  BEGIN EXECUTE 'DROP POLICY IF EXISTS gap_documents_select_scoped ON storage.objects'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'Skipping drop policy gap_documents_select_scoped (insufficient privileges).'; END;
  BEGIN EXECUTE 'DROP POLICY IF EXISTS gap_documents_update_own ON storage.objects'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'Skipping drop policy gap_documents_update_own (insufficient privileges).'; END;
  BEGIN EXECUTE 'DROP POLICY IF EXISTS gap_documents_delete_own ON storage.objects'; EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'Skipping drop policy gap_documents_delete_own (insufficient privileges).'; END;
END
$$;

-- Applicants can upload to their own folder: <auth.uid()>/<filename>
DO $$
BEGIN
  EXECUTE $policy$
    CREATE POLICY gap_documents_insert_own
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'gap_documents'
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
  $policy$;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping create policy gap_documents_insert_own (insufficient privileges).';
END
$$;

-- Read policy:
-- 1) Owner can read their own documents
-- 2) CORE admin can read all GAP documents
-- 3) Org admins/institution admins can read docs for members in same org
DO $$
BEGIN
  EXECUTE $policy$
    CREATE POLICY gap_documents_select_scoped
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'gap_documents'
      AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR EXISTS (
          SELECT 1
          FROM public.profiles me
          WHERE me.id = auth.uid()
            AND upper(coalesce(me.role::text, '')) = 'ADMIN'
        )
        OR EXISTS (
          SELECT 1
          FROM public.profiles me
          JOIN public.profiles owner
            ON owner.id::text = (storage.foldername(name))[1]
          WHERE me.id = auth.uid()
            AND upper(coalesce(me.role::text, '')) IN ('ORG_ADMIN', 'INSTITUTION_ADMIN')
            AND me.org_id IS NOT NULL
            AND me.org_id = owner.org_id
        )
      )
    )
  $policy$;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping create policy gap_documents_select_scoped (insufficient privileges).';
END
$$;

-- Owners can replace/remove their own files
DO $$
BEGIN
  EXECUTE $policy$
    CREATE POLICY gap_documents_update_own
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'gap_documents'
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'gap_documents'
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
  $policy$;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping create policy gap_documents_update_own (insufficient privileges).';
END
$$;

DO $$
BEGIN
  EXECUTE $policy$
    CREATE POLICY gap_documents_delete_own
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'gap_documents'
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
  $policy$;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping create policy gap_documents_delete_own (insufficient privileges).';
END
$$;
