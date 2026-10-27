# AICTE Dashboard + CPGRAMS portal — shared backend build

This package connects the original AICTE complaint dashboard and standalone CPGRAMS simulator to the same Supabase `public.complaints` table.

- AICTE dashboard: `http://localhost:3000/`
- CPGRAMS portal: `http://localhost:3000/cpgrams.html`

CPGRAMS/CSS intake uses the secure `ingest_external_complaint` PostgreSQL RPC. It does **not** grant anonymous users general read access to `public.complaints`. The RPC creates the complaint and returns only the row created by that call. It tags the source portal/reference and routes the complaint to PGRC.

## Setup from a new Supabase project

In Supabase SQL Editor, run in this order:

1. `20261023000001_initial_schema.sql`
2. `20261023000002_rls_policies.sql`
3. `20261023000003_triggers_and_functions.sql`
4. `20261023000004_seed_data.sql`
5. `20261023000005_fix_auth_identities.sql` (if using demo auth users)
6. `20261024000001_public_grievance_portal.sql` — this package contains the **safe RPC-based version**. Do not use an older version that creates an anonymous `SELECT ... USING (true)` policy on complaints.
7. `20261026000001_clusters_multilingual_evidence.sql`
8. `20261027000001_external_portal_ingestion.sql`

If steps 1–5 were already applied, do not repeat them; apply steps 6–8 from this package.

## Configure the frontend

1. Copy `.env.example` to `.env`.
2. Set both values to the same Supabase project for both portals:
   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
   ```
3. Never place a `service_role` or secret key in `.env` for this browser app.
4. Double-click `RUN-LOCAL.bat`, or in this folder run `npm install` once and then `npm run dev`.
5. Open `/cpgrams.html`, submit a test grievance, then sign into the dashboard and check **All Complaints**.

## Demo limitations

- This is a simulator, not a live integration with the Government of India's CPGRAMS service.
- The demo OTP is client-side and is not real identity verification. Before real use, move anonymous intake behind a server/Edge Function with CAPTCHA, rate limiting, abuse protection, proper auth/authorisation, privacy review, and audit controls.
- Dashboard visibility remains subject to the authenticated RLS policies, including department assignment and user role.
