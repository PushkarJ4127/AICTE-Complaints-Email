-- Direct AICTE public-portal intake.
-- Anonymous citizens cannot INSERT into public.complaints (RLS). CPGRAMS already
-- uses ingest_external_complaint. Direct filings must use the same pattern so
-- AICTE-2026-XXXXX records actually land in the Central Grievance Registry.

ALTER TABLE public.complaints DROP CONSTRAINT IF EXISTS complaints_source_portal_check;
ALTER TABLE public.complaints
  ADD CONSTRAINT complaints_source_portal_check
  CHECK (source_portal IS NULL OR source_portal IN ('CPGRAMS', 'CSS', 'DIRECT'));

-- Keep the existing CPGRAMS/CSS RPC, but also accept DIRECT so older clients can reuse it.
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
  IF COALESCE(btrim(p_source_portal), '') NOT IN ('CPGRAMS', 'CSS', 'DIRECT') THEN
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

CREATE OR REPLACE FUNCTION public.ingest_direct_complaint(
  p_institution_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_category TEXT,
  p_priority TEXT DEFAULT 'Normal',
  p_complainant_name TEXT DEFAULT NULL,
  p_complainant_email TEXT DEFAULT NULL,
  p_complainant_phone TEXT DEFAULT NULL,
  p_complainant_type TEXT DEFAULT 'Student',
  p_student_roll_no TEXT DEFAULT NULL,
  p_department_code TEXT DEFAULT 'PGRC',
  p_original_language TEXT DEFAULT NULL,
  p_original_text TEXT DEFAULT NULL,
  p_evidence JSONB DEFAULT '[]'::jsonb
)
RETURNS SETOF public.complaints
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_department_id UUID;
  v_complaint_id UUID;
  v_reference TEXT;
BEGIN
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

  SELECT d.id INTO v_department_id
  FROM public.departments d
  WHERE d.code = COALESCE(NULLIF(btrim(p_department_code), ''), 'PGRC')
  LIMIT 1;

  IF v_department_id IS NULL THEN
    SELECT d.id INTO v_department_id FROM public.departments d WHERE d.code = 'PGRC' LIMIT 1;
  END IF;
  IF v_department_id IS NULL THEN
    RAISE EXCEPTION 'PGRC department is missing; apply seed data first';
  END IF;

  v_reference := 'DIRECT/' || to_char(now(), 'YYYY') || '/' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);

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
    NULLIF(btrim(p_student_roll_no), ''), 'DIRECT', v_reference
  ) RETURNING id INTO v_complaint_id;

  BEGIN
    UPDATE public.complaints
    SET
      original_language = NULLIF(btrim(p_original_language), ''),
      original_text = NULLIF(btrim(p_original_text), ''),
      evidence = COALESCE(p_evidence, '[]'::jsonb)
    WHERE id = v_complaint_id;
  EXCEPTION
    WHEN undefined_column THEN
      NULL;
  END;

  RETURN QUERY SELECT c.* FROM public.complaints c WHERE c.id = v_complaint_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'This grievance could not be registered because the generated case number is already in use. Please retry.';
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_direct_complaint(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingest_direct_complaint(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) TO anon, authenticated;

COMMENT ON FUNCTION public.ingest_direct_complaint(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) IS 'Secure public intake for the AICTE grievance portal. Writes to public.complaints with status Received and source_portal DIRECT.';
