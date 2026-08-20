-- Ensure production has the private bucket used by damage assessments.
-- Object paths are always scoped as: <authenticated-user-id>/<timestamp>.jpg

INSERT INTO storage.buckets (id, name, public)
VALUES ('assessment_photos', 'assessment_photos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Users can upload own assessment photos" ON storage.objects;
CREATE POLICY "Users can upload own assessment photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'assessment_photos'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can view own assessment photos" ON storage.objects;
CREATE POLICY "Users can view own assessment photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'assessment_photos'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own assessment photos" ON storage.objects;
CREATE POLICY "Users can delete own assessment photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'assessment_photos'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Institution admins can view org assessment photos" ON storage.objects;
CREATE POLICY "Institution admins can view org assessment photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'assessment_photos'
    AND public.is_institution_admin()
    AND EXISTS (
      SELECT 1
      FROM public.damage_assessments da
      WHERE da.photo_path = name
        AND public.org_in_scope(da.org_id)
    )
  );

DROP POLICY IF EXISTS "Admins can view all assessment photos" ON storage.objects;
CREATE POLICY "Admins can view all assessment photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'assessment_photos'
    AND public.is_admin()
  );
