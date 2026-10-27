-- ============================================================================
-- Migration: 20261026000001_clusters_multilingual_evidence.sql
-- Description:
--   1. Mass-complaint clusters  -> affected_count, merged_into, complaint_supporters
--   2. Multilingual intake      -> original_language, original_text
--   3. Evidence + AI check      -> evidence (JSONB) + private storage bucket
-- Safe to run more than once.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. New columns on complaints
-- ----------------------------------------------------------------------------
ALTER TABLE public.complaints
    ADD COLUMN IF NOT EXISTS affected_count    INTEGER NOT NULL DEFAULT 1 CHECK (affected_count >= 1),
    ADD COLUMN IF NOT EXISTS merged_into       UUID REFERENCES public.complaints(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS original_language TEXT,
    ADD COLUMN IF NOT EXISTS original_text     TEXT,
    ADD COLUMN IF NOT EXISTS evidence          JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_complaints_merged_into ON public.complaints(merged_into);
CREATE INDEX IF NOT EXISTS idx_complaints_inst_cat    ON public.complaints(institution_id, category);

COMMENT ON COLUMN public.complaints.affected_count IS 'How many people this case represents (1 = single complaint, N = mass complaint).';
COMMENT ON COLUMN public.complaints.merged_into    IS 'If set, this case was folded into the parent mass-complaint case.';
COMMENT ON COLUMN public.complaints.evidence       IS 'Array of uploaded evidence files with AI-extracted fields and mismatch flags.';

-- ----------------------------------------------------------------------------
-- 2. Supporters: every extra person who joined / was merged into a mass case
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaint_supporters (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id              UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    name                      TEXT NOT NULL,
    email                     TEXT,
    phone                     TEXT,
    roll_no                   TEXT,
    statement                 TEXT,
    evidence                  JSONB NOT NULL DEFAULT '[]'::jsonb,
    source                    TEXT NOT NULL DEFAULT 'joined' CHECK (source IN ('joined', 'merged')),
    original_complaint_number TEXT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supporters_complaint ON public.complaint_supporters(complaint_id);
ALTER TABLE public.complaint_supporters ENABLE ROW LEVEL SECURITY;

-- Contains personal details, so only signed-in officers can read it.
DROP POLICY IF EXISTS "Officers can read supporters" ON public.complaint_supporters;
CREATE POLICY "Officers can read supporters"
    ON public.complaint_supporters FOR SELECT TO authenticated USING (true);

-- Officers merging cases insert directly. The public goes through join_complaint_cluster().
DROP POLICY IF EXISTS "Officers can add supporters" ON public.complaint_supporters;
CREATE POLICY "Officers can add supporters"
    ON public.complaint_supporters FOR INSERT TO authenticated WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 3. Public "join this complaint" function (anonymous citizens)
--    Inserts the supporter and bumps affected_count atomically.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_complaint_cluster(
    p_complaint_id UUID,
    p_name         TEXT,
    p_email        TEXT,
    p_phone        TEXT,
    p_roll_no      TEXT,
    p_statement    TEXT,
    p_evidence     JSONB DEFAULT '[]'::jsonb
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.complaints WHERE id = p_complaint_id AND merged_into IS NULL) THEN
        RAISE EXCEPTION 'Complaint not found or already merged';
    END IF;

    -- One person can join a case only once
    IF p_email IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.complaint_supporters
        WHERE complaint_id = p_complaint_id AND lower(email) = lower(p_email)
    ) THEN
        RAISE EXCEPTION 'You have already joined this complaint';
    END IF;

    INSERT INTO public.complaint_supporters (complaint_id, name, email, phone, roll_no, statement, evidence, source)
    VALUES (p_complaint_id, p_name, p_email, p_phone, p_roll_no, p_statement, COALESCE(p_evidence, '[]'::jsonb), 'joined');

    UPDATE public.complaints
       SET affected_count = affected_count + 1
     WHERE id = p_complaint_id
 RETURNING affected_count INTO v_count;

    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_complaint_cluster(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Private storage bucket for evidence files (best effort)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence', 'evidence', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can upload evidence" ON storage.objects;
CREATE POLICY "Public can upload evidence"
    ON storage.objects FOR INSERT TO anon, authenticated
    WITH CHECK (bucket_id = 'evidence');

DROP POLICY IF EXISTS "Officers can read evidence" ON storage.objects;
CREATE POLICY "Officers can read evidence"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'evidence');
