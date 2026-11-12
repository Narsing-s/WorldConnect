# WorldConnect — Advanced Upgrade Roadmap

**Product direction:** an AI-assisted professional network that combines a reliable social community, a verified job marketplace, and career-development tools.

This roadmap is additive. Keep existing routes, data, user content, and working flows; do not create duplicate tabs or replace current features without a migration and explicit product reason.

## 1. Current product baseline

The repository currently describes these capabilities:

- Authentication, password recovery, member profiles, and profile photo upload.
- Persistent posts, likes, comments, follows, saved posts, and private conversations.
- Communities and a community opportunity board.
- External job search across four public feeds, a job-board directory, and a six-hour sync workflow.
- In-app notifications, reporting, sharing, and responsive navigation.

**First release gate:** prove that every social action survives refresh and is correctly isolated by Supabase Row Level Security (RLS). Complete the automatic job-sync production credential check before adding more job features.

## 2. Priority roadmap

### P0 — Reliability, security, and observability

- Verify every table has RLS enabled and policies for the intended owner/member roles.
- Audit grants separately from RLS policies; never grant browser roles write access to server-owned job-sync tables.
- Verify Vercel Production uses the matching Supabase project URL and server-only service-role credential.
- Add structured, secret-safe API errors, request correlation IDs, and job-sync run diagnostics.
- Make job ingestion idempotent; preserve existing listings when a provider fails; expire listings only after a successful provider refresh policy.
- Add pagination, input validation, rate limits, and safe error boundaries.
- Add automated tests for signup, posts, likes, comments, follows, saved posts, messages, job search, and job sync.

**Acceptance:** no permission-denied errors in expected flows; unauthorized users cannot mutate another member's data; sync failures are diagnosable without exposing credentials; no content disappears after refresh.

### P1 — Complete the job-seeker experience

- Saved jobs and a personal application tracker: Saved → Applied → Interview → Offer / Rejected.
- Application notes, follow-up dates, interview schedule, and status history.
- Filters for keyword, skills, location, remote/hybrid/on-site, source, date, and employment type where source data supports them.
- Duplicate detection across providers using normalized company/title/location/application URL.
- Listing freshness labels, source attribution, and clear expired-job states.
- Candidate profile completeness indicator and resume/portfolio links.

**Acceptance:** application records are private to their owner; filters are shareable; duplicate jobs do not create duplicate application targets.

### P2 — AI career assistant

- Resume parser and structured profile extraction with user approval before saving.
- Job-to-profile matching with an explainable match score and matched/missing skills.
- Resume suggestions tailored to a selected job description; never fabricate experience.
- Interview practice by role and seniority, with feedback and model-generated follow-up questions.
- Skill-gap analysis and learning paths linked to the user's target roles.

**Acceptance:** AI output is clearly labeled as suggestions; users approve profile changes; private resumes are never public by default; matching does not imply guaranteed hiring.

### P3 — Recruiter and employer workspace

- Separate recruiter/company roles and organization profiles.
- Employer verification workflow and verified job-posting status.
- Job creation, editing, closing, and applicant pipeline.
- Candidate search only with explicit profile visibility/consent.
- Shortlisting, interview invitations, and recruiter-to-candidate messaging.
- Audit trail for recruiter actions and job edits.

**Acceptance:** only authorized organization members manage that organization's jobs and applicants; candidates control profile visibility.

### P4 — Community and professional growth

- Skill endorsements with anti-spam limits.
- Events, webinars, and professional groups.
- Referral requests and referral tracking.
- Company reviews with moderation, evidence/reporting flows, and anti-defamation safeguards.
- Trending and personalized feeds with user controls.
- Post bookmarks, reposts, and topic tags if not already present.

**Acceptance:** each feature has one clear home in the existing navigation; no duplicate Explore/Community destinations.

### P5 — Scale and production readiness

- Background job queue for feed ingestion, notifications, and AI tasks.
- Retry/backoff, provider health dashboard, and dead-letter handling.
- Database indexes and query profiling for feed, jobs, search, and notifications.
- Image/file validation, size limits, private storage buckets, and signed URLs.
- Accessibility, keyboard navigation, mobile performance, and loading/empty/error states.
- Privacy policy, terms, account deletion/export, retention rules, and abuse response process.

**Acceptance:** load tests and security checks pass; slow provider APIs do not block the main app; user data lifecycle is documented.

## 3. Navigation principles

Keep the current primary destinations. Add features inside the relevant existing area:

- **Jobs:** job discovery, saved jobs, application tracker.
- **Profile:** portfolio, resume, skills, visibility controls.
- **Messages:** conversations and interview communication.
- **Communities:** groups, events, referrals, and learning.
- **Notifications:** social, application, and recruiter updates with filters.
- **Admin-only area:** moderation, employer verification, ingestion health, and analytics.

Do not add a separate top-level tab for every sub-feature.

## 4. Suggested database additions

Create migrations only after checking the live schema and existing tables to avoid duplicates.

- `wc_saved_jobs`: member_id, job_id, created_at; unique member/job pair.
- `wc_job_applications`: member_id, job_id, status, applied_at, follow_up_at, notes, created_at, updated_at.
- `wc_job_application_events`: application_id, actor_id, event_type, payload, created_at.
- `wc_companies`: name, slug, website, verification_status, created_at.
- `wc_company_members`: company_id, member_id, role, created_at.
- `wc_candidate_preferences`: member_id, target_titles, skills, locations, work_modes, updated_at.
- `wc_ai_activity`: member_id, task_type, status, created_at, metadata; never store raw secrets or unnecessary resume contents.

Use foreign keys, unique constraints, indexes, RLS, and least-privilege grants. Keep resumes and private application notes in private storage/data access paths.

## 5. Implementation sequence

1. Audit current routes, components, schema, policies, and workflows; produce a keep/change/add matrix.
2. Fix production job sync and verify it with a real workflow run.
3. Add tests and resolve any existing persistence/RLS defects.
4. Deliver P1 job-seeker features.
5. Deliver P2 AI features behind explicit user actions and safe quotas.
6. Add recruiter workflows only after role/organization authorization is designed.
7. Complete performance, accessibility, privacy, and security checks.

## 6. Non-negotiable engineering rules

- No demo users, seeded social posts, fake job listings, or fabricated company verification.
- No service-role keys in browser bundles, public environment variables, logs, or API responses.
- No broad RLS policies such as unrestricted authenticated writes.
- No breaking schema changes without a migration and backward-compatible rollout.
- No duplicate UI sections or nonfunctional buttons.
- Keep all existing member content and IDs intact.
- Every new feature needs loading, empty, success, and failure states plus tests.
