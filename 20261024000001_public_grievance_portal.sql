-- SAFE public grievance intake migration for AICTE + CPGRAMS.
-- Apply this instead of any older version of this migration that creates a public
-- SELECT policy on public.complaints. It intentionally does NOT allow anon to read
-- complaint rows. Anonymous submissions go through a narrowly scoped SECURITY DEFINER
-- RPC and receive only the row created by that exact call.

-- Keep new complaint numbers beyond the demo seed range.
SELECT setval(
  'public.complaint_number_seq',
  GREATEST((SELECT last_value FROM public.complaint_number_seq), 1050),
  true
);

-- Public grievances do not have an AICTE officer profile as their creator.
ALTER TABLE public.complaints ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.complaint_assignments ALTER COLUMN assigned_by DROP NOT NULL;

ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS complainant_name TEXT,
  ADD COLUMN IF NOT EXISTS complainant_email TEXT,
  ADD COLUMN IF NOT EXISTS complainant_phone TEXT,
  ADD COLUMN IF NOT EXISTS complainant_type TEXT DEFAULT 'Student',
  ADD COLUMN IF NOT EXISTS student_roll_no TEXT,
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

-- The trigger created in 20261023000003 handles assignments/audit logging.
-- Update it so null public creators are supported after assigned_by is made nullable.
CREATE OR REPLACE FUNCTION public.handle_complaint_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.complaint_assignments (
    complaint_id, department_id, officer_id, assigned_by, assigned_at
  ) VALUES (
    NEW.id, NEW.assigned_department_id, NEW.assigned_officer_id, NEW.created_by, now()
  );

  INSERT INTO public.audit_logs (
    actor_id, action_type, entity_type, entity_id, details
  ) VALUES (
    NEW.created_by,
    'CREATE',
    'complaint',
    NEW.id,
    jsonb_build_object(
      'complaint_number', NEW.complaint_number,
      'title', NEW.title,
      'priority', NEW.priority,
      'status', NEW.status,
      'complainant_name', NEW.complainant_name,
      'complainant_type', NEW.complainant_type,
      'assigned_department_id', NEW.assigned_department_id,
      'source_portal', NEW.source_portal
    )
  );

  IF NEW.assigned_officer_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      recipient_id, complaint_id, notification_type, message
    ) VALUES (
      NEW.assigned_officer_id,
      NEW.id,
      'assignment',
      'New public grievance ' || NEW.complaint_number || ' received: "' || substring(NEW.title from 1 for 40) || '..."'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Reference directories are public, but complaint records are not.
GRANT SELECT ON TABLE public.institutions, public.departments TO anon, authenticated;
DROP POLICY IF EXISTS "Public intake can view institutions" ON public.institutions;
CREATE POLICY "Public intake can view institutions"
  ON public.institutions FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Public intake can view departments" ON public.departments;
CREATE POLICY "Public intake can view departments"
  ON public.departments FOR SELECT TO anon USING (true);

-- Remove the permissive policies/grants used by the earlier demo migration, if present.
DROP POLICY IF EXISTS "Enable public insert for complaints" ON public.complaints;
DROP POLICY IF EXISTS "Enable read access for complaints" ON public.complaints;
DROP POLICY IF EXISTS "Public can read complaints" ON public.complaints;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.complaints FROM anon;

-- Secure ingestion endpoint. The function creates a complaint and returns only the
-- row created in this invocation. It does not grant anonymous SELECT on the table.
CREATE OR REPLACE FUNCTION public.ingest_external_complaint(
  p_source_portal TEXT,
  p_external_reference_id TEXT,
  p_institution_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_category TEXT,
  p_priority TEXT,
  p_complainant_name TEXT DEFAULT NULL,
  p_complainant_email TEXT DEFAULT NULL,
  p_complainant_phone TEXT DEFAULT NULL,
  p_complainant_type TEXT DEFAULT 'Student',
  p_student_roll_no TEXT DEFAULT NULL
)
RETURNS SETOF public.complaints
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_department_id UUID;
  v_complaint_id UUID;
BEGIN
  IF COALESCE(btrim(p_source_portal), '') NOT IN ('CPGRAMS', 'CSS') THEN
    RAISE EXCEPTION 'Unsupported source portal';
  END IF;
  IF COALESCE(btrim(p_external_reference_id), '') = '' OR length(p_external_reference_id) > 120 THEN
    RAISE EXCEPTION 'A valid external reference is required';
  END IF;
  IF COALESCE(btrim(p_title), '') = '' OR length(p_title) > 500 THEN
    RAISE EXCEPTION 'A subject between 1 and 500 characters is required';
  END IF;
  IF COALESCE(btrim(p_description), '') = '' OR length(p_description) > 20000 THEN
    RAISE EXCEPTION 'A description between 1 and 20000 characters is required';
  END IF;
  IF COALESCE(btrim(p_category), '') = '' OR length(p_category) > 120 THEN
    RAISE EXCEPTION 'A valid category is required';
  END IF;
  IF COALESCE(p_priority, '') NOT IN ('Normal', 'High', 'Urgent') THEN
    RAISE EXCEPTION 'Unsupported priority';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.institutions i WHERE i.id = p_institution_id) THEN
    RAISE EXCEPTION 'Institution not found';
  END IF;
  SELECT d.id INTO v_department_id FROM public.departments d WHERE d.code = 'PGRC' LIMIT 1;
  IF v_department_id IS NULL THEN
    RAISE EXCEPTION 'PGRC department is missing; apply seed data first';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.source_portal = p_source_portal
      AND c.external_reference_id = btrim(p_external_reference_id)
  ) THEN
    RAISE EXCEPTION 'This external reference has already been submitted';
  END IF;

  INSERT INTO public.complaints (
    institution_id, title, description, category, priority, status,
    assigned_department_id, assigned_officer_id, received_at, due_at, created_by,
    complainant_name, complainant_email, complainant_phone, complainant_type,
    student_roll_no, source_portal, external_reference_id
  ) VALUES (
    p_institution_id, btrim(p_title), btrim(p_description), btrim(p_category), p_priority,
    'Received', v_department_id, NULL, now(), now() + interval '15 days', NULL,
    NULLIF(btrim(p_complainant_name), ''), NULLIF(lower(btrim(p_complainant_email)), ''),
    NULLIF(btrim(p_complainant_phone), ''), COALESCE(NULLIF(btrim(p_complainant_type), ''), 'Student'),
    NULLIF(btrim(p_student_roll_no), ''), p_source_portal, btrim(p_external_reference_id)
  ) RETURNING id INTO v_complaint_id;

  RETURN QUERY SELECT c.* FROM public.complaints c WHERE c.id = v_complaint_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'This external reference or complaint number has already been submitted';
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_external_complaint(
  TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingest_external_complaint(
  TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO anon, authenticated;

COMMENT ON FUNCTION public.ingest_external_complaint(
  TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) IS 'Secure public intake for CPGRAMS/CSS. Returns only the complaint created by this request; does not permit general anonymous complaint reads.';

-- Realtime is a convenience only; RLS still governs who can read published rows.
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
