-- ============================================================================
-- DEMO DATA: a "mass complaint" for the Mass Complaints screen
-- Run AFTER migration 20261026000001_clusters_multilingual_evidence.sql.
-- Creates 9 similar lab-fee complaints at one institution plus 2 unrelated
-- ones, so officers can open "Mass Complaints" and merge them.
-- Safe to delete afterwards:  DELETE FROM public.complaints WHERE complainant_email LIKE '%@demo-mass.example';
-- ============================================================================
DO $$
DECLARE
    v_inst UUID;
    v_pgrc UUID;
    v_rb   UUID;
    i INT;
    names TEXT[] := ARRAY['Riya Mehta','Karan Singh','Pooja Jain','Aman Verma','Neha Gupta','Rahul Yadav','Sneha Rao','Vikas Sharma','Anjali Das'];
    titles TEXT[] := ARRAY[
        'Extra lab development fee of Rs. 25,000',
        'Hall ticket withheld for lab fee',
        'Illegal lab charges',
        'Unauthorised lab fee collection',
        'Compulsory lab development fee',
        'Lab fee extortion before exams',
        'Extra fee not in prospectus',
        'Hall ticket blocked, lab fee',
        'Lab development fee demanded in cash'];
    descs TEXT[] := ARRAY[
        'The college is collecting an additional lab development fee of Rs. 25,000 from every second year student. Hall ticket will be withheld if we do not pay.',
        'Management said no hall ticket until we pay Rs. 25,000 lab development fee which is not part of the approved AICTE fee structure.',
        'We are forced to pay 25,000 rupees as lab development charges. Students who refused were threatened with exam debarment.',
        'Additional lab fee Rs 25,000 is being demanded from all students of 2nd year, otherwise they say we cannot sit in the semester exam.',
        'College asked everyone to pay lab development fee of Rs. 25,000 within one week or the hall ticket will not be issued.',
        'Department head demanded Rs. 25,000 lab development fee from each student under threat of withholding hall tickets.',
        'The lab development fee of Rs 25,000 was never mentioned in the prospectus. Hall ticket is blocked for those who have not paid.',
        'My hall ticket is not released because I did not pay the Rs. 25,000 lab development fee demanded by the college office.',
        'The accounts office is demanding Rs. 25,000 lab development fee in cash, with no receipt, before issuing hall tickets.'];
BEGIN
    SELECT id INTO v_inst FROM public.institutions ORDER BY institution_name LIMIT 1;
    SELECT id INTO v_pgrc FROM public.departments WHERE code = 'PGRC' LIMIT 1;
    SELECT id INTO v_rb   FROM public.departments WHERE code = 'RB' LIMIT 1;
    IF v_inst IS NULL OR v_pgrc IS NULL THEN
        RAISE EXCEPTION 'Seed institutions and departments first (run the main seed).';
    END IF;

    FOR i IN 1..9 LOOP
        INSERT INTO public.complaints
            (institution_id, title, description, category, priority, status, assigned_department_id,
             received_at, complainant_name, complainant_email, complainant_phone, complainant_type, student_roll_no, created_by)
        VALUES
            (v_inst, titles[i], descs[i], 'Fee Cap Violation', 'Normal', 'Received', v_pgrc,
             now() - ((10 - i) || ' days')::interval, names[i], lower(split_part(names[i], ' ', 1)) || '@demo-mass.example',
             '+91 90000 0000' || i, 'Student', '2024-BT-' || lpad(i::text, 3, '0'), NULL);
    END LOOP;

    -- Two unrelated complaints at the same college that must NOT be grouped
    INSERT INTO public.complaints
        (institution_id, title, description, category, priority, status, assigned_department_id,
         received_at, complainant_name, complainant_email, complainant_type, created_by)
    VALUES
        (v_inst, 'Ragging in boys hostel', 'Seniors are ragging first year students at night in hostel block B.',
         'Ragging & Student Harassment', 'Normal', 'Received', COALESCE(v_rb, v_pgrc), now() - interval '4 days',
         'Mohit Kumar', 'mohit@demo-mass.example', 'Student', NULL),
        (v_inst, 'Visiting faculty salary pending', 'Visiting faculty have not been paid for four months.',
         'Faculty Deficiency & Non-Payment of Remuneration', 'Normal', 'Under Review', COALESCE(v_rb, v_pgrc), now() - interval '12 days',
         'Dr. S. Iyer', 'iyer@demo-mass.example', 'Faculty', NULL);
END $$;
