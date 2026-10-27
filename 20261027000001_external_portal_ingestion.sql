-- External portal ingestion support for the shared AICTE complaint registry.
-- Run AFTER 20261024000001_public_grievance_portal.sql and 20261026000001_clusters_multilingual_evidence.sql.
-- This migration intentionally does not grant anonymous table SELECT/INSERT on complaints.

ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS source_portal TEXT,
  ADD COLUMN IF NOT EXISTS external_reference_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'complaints_source_portal_check'
      AND conrelid = 'public.complaints'::regclass
  ) THEN
    ALTER TABLE public.complaints
      ADD CONSTRAINT complaints_source_portal_check
      CHECK (source_portal IS NULL OR source_portal IN ('CPGRAMS', 'CSS'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_complaints_external_reference_unique
  ON public.complaints (source_portal, external_reference_id)
  WHERE external_reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_complaints_source_portal_created_at
  ON public.complaints (source_portal, created_at DESC);

GRANT SELECT ON TABLE public.institutions, public.departments TO anon, authenticated;
DROP POLICY IF EXISTS "Public intake can view institutions" ON public.institutions;
CREATE POLICY "Public intake can view institutions"
  ON public.institutions FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Public intake can view departments" ON public.departments;
CREATE POLICY "Public intake can view departments"
  ON public.departments FOR SELECT TO anon USING (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'complaints'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Could not add complaints to supabase_realtime; enable it in Supabase Dashboard if live refresh is needed.';
END $$;
