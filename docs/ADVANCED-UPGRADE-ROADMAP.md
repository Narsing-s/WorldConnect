# WorldConnect — Advanced Upgrade Roadmap

**Product direction:** an AI-assisted professional network combining a reliable social community, a global job marketplace, and career-development tools.

This roadmap is additive. Preserve existing routes, database records, member content, and working flows. Do not create duplicate navigation tabs or replace current features without a migration and a clear product reason.

## Current implementation on main

The repository already includes:
- Authentication, member profiles, password recovery, and profile photo upload.
- Persistent posts, likes, comments, follows, saved posts, notifications, and private conversations.
- Communities and a community opportunity board.
- External job discovery, automatic job synchronization, saved applications, and a private application tracker.
- Private candidate preferences with explainable, browser-side job matching.
- Professional portfolio entries for skills, projects, certifications, and experience.
- Additive Supabase migrations for data integrity and notification/query hardening.

These features are implemented in source; production readiness still depends on applying the matching SQL scripts to the correct Supabase project and passing CI plus live smoke tests.

## Phase 1 — Production readiness

### Automated repository checks
- Run ESLint on every pull request and push to main.
- Run a dependency-free platform verifier for critical migration files, owner-only RLS invariants, notification update grants, and server-only service-role configuration.
- Run the Next.js production build after the checks above.
- Keep checks additive; do not seed demo users, posts, or fake job listings.

### Supabase migration order

For a new Supabase project, apply:
1. `supabase/schema.sql`
2. `supabase/jobs-auto-sync.sql`
3. `supabase/migrations/20261116_job_application_tracker.sql`
4. `supabase/migrations/20261117_candidate_job_preferences.sql`
5. `supabase/migrations/20261116_worldconnect_data_integrity_guardrails.sql`
6. `supabase/migrations/20261118_platform_hardening.sql`
7. `supabase/migrations/20261119_professional_portfolio.sql`

For an existing project, compare the live schema before applying any script. Apply each missing migration once, in the order above. The data-integrity guardrails depend on both the tracker and candidate-preferences tables even though the filename date sorts earlier. Do not blindly rerun one-off repair scripts.

### Production deployment checklist

- Confirm Vercel Production points to the intended Supabase project.
- Configure `NEXT_PUBLIC_SUPABASE_URL` and the publishable/anon key as public client configuration only.
- Configure `SUPABASE_SERVICE_ROLE_KEY` only as a server-side Vercel environment variable; never prefix it with `NEXT_PUBLIC_`.
- Configure `JOBS_SYNC_SECRET` in Vercel and the matching GitHub Actions secret, plus `WORLDCONNECT_APP_URL`.
- Run one manual job-sync workflow and confirm the API returns success and a completed sync-run record is written.
- Verify signed-out users cannot read private applications or preferences.
- Verify one member cannot read or update another member's applications, preferences, or messages.
- Verify notification recipients can acknowledge notifications but cannot rewrite notification identity or content.
- Test signup, login, password recovery, profile updates, posts, likes, comments, follows, saved posts, messaging, communities, jobs, tracker, and portfolio on the deployed URL.
- Check Vercel and GitHub Actions logs for errors without exposing secrets or personal data.

### Acceptance criteria

- Lint, platform verification, and production build pass in GitHub Actions.
- RLS and grants are both least-privilege; neither is treated as a substitute for the other.
- Job-sync provider failures do not erase previously imported listings.
- Private candidate and application data is never exposed to anonymous users.
- Existing member content and IDs remain intact.
- All key flows have loading, empty, success, and failure states.

## Phase 2 — AI career assistant

- Resume parsing into a draft profile, with explicit user approval before saving.
- Explainable job-to-profile matching and missing-skill analysis.
- Resume suggestions tailored to a selected job description; never fabricate experience.
- Interview practice by role and seniority, with follow-up questions and feedback.
- Skill-gap analysis and learning paths linked to target roles.

**Privacy requirements:** resumes are private by default; never send a resume to an external model without clear user action and disclosure; do not retain unnecessary raw resume text; label generated content as suggestions; never imply guaranteed hiring.

## Phase 3 — Recruiter and employer workspace

- Organization profiles and separate recruiter/company roles.
- Employer verification with an auditable review process.
- Job creation, editing, closing, and applicant pipeline.
- Candidate search only where the member has explicitly allowed visibility.
- Shortlisting, interview invitations, and recruiter-to-candidate messaging.

## Phase 4 — Professional growth and community

- Events, webinars, mentorship, and referral requests.
- Skill endorsements with anti-spam controls.
- Topic discovery and user-controlled feed recommendations.
- Community learning paths and professional sessions.

Keep these capabilities inside existing Jobs, Profile, Messages, and Communities areas rather than adding a top-level tab for every feature.

## Phase 5 — Scale and operational excellence

- Durable background queues, retry/backoff, and dead-letter handling.
- Provider health dashboard and sync diagnostics.
- Query profiling, pagination, and load testing.
- File validation, private storage buckets, and signed URLs.
- Accessibility, mobile performance, and PWA improvements.
- Privacy policy, terms, account export/deletion, retention rules, and abuse response.

## Non-negotiable engineering rules

- No demo users, seeded social posts, fake job listings, or fabricated company verification.
- No service-role keys in browser bundles, public environment variables, logs, or API responses.
- No broad unrestricted authenticated-write RLS policies.
- No breaking schema changes without a migration and backward-compatible rollout.
- No duplicate UI sections or nonfunctional buttons.
- Keep existing member content and IDs intact.
- Every new feature needs loading, empty, success, and failure states plus tests.
