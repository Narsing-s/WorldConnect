# WorldConnect — Advanced Platform Upgrade Roadmap

Product direction: a privacy-first global professional network combining social discovery, jobs, recruiter workflows, career development, mentorship and community learning.

This plan is additive. Preserve existing routes, database records, member content and working flows. Do not add duplicate top-level navigation. A feature is complete only when its UI, authorization, migration, tests, documentation and deployed configuration are verified.

## Current implementation on main

The repository contains authentication, profiles, persistent social features, communities, private conversations, external job discovery and synchronization, private job applications and candidate preferences, a browser-side Career Assistant, employer/recruiter workspaces, member blocks, content reports, reviewer audit events, private storage for new chat attachments, and a database migration enforcing blocks across key social and messaging surfaces.

Source presence is not proof of production deployment. Production readiness depends on applying required SQL migrations to the intended Supabase project, configuring Vercel/GitHub secrets and passing CI plus live two-account tests.

## Phase 1 — Security and production readiness

Implemented in source:
- [x] Owner-scoped job applications, candidate preferences and career workspace.
- [x] Employer workspace, verified-company publishing and membership-scoped collaboration.
- [x] Member-controlled blocks and content-report intake.
- [x] Reviewer-only moderation queue and immutable status audit events.
- [x] Private storage bucket for new chat attachments.
- [x] Database-level block enforcement migration across key profile/feed/comment/like/follow/community/opportunity/conversation/notification surfaces.
- [x] Source-level platform verifier for critical migrations and authorization invariants.

Still required before production claims:
- [ ] Inspect live Supabase migration history and apply only missing migrations in dependency order.
- [ ] Verify block enforcement with two test accounts across every route and storage policy.
- [ ] Migrate legacy public chat attachments and sensitive media with a verified object backfill. Do not revoke old public access until every reference and object is verified.
- [ ] Complete report appeals, reviewer decision controls and documented retention/abuse-response procedures.
- [ ] Add account data export/deletion with server-authorized Auth, database and Storage cleanup.
- [ ] Add session/device management and optional MFA UX using Supabase Auth; never expose service-role credentials to the browser.
- [ ] Add rate limits and abuse controls to public/authenticated write endpoints.
- [ ] Add SQL integration and browser end-to-end tests for two-account isolation.
- [ ] Verify production environment variables and job-sync secrets without exposing values.

## Phase 2 — Career intelligence

Implemented: browser-side resume review and skill extraction, explainable job matching, role-based skill-gap suggestions, curated interview practice, and consent-based private workspace persistence.

Next:
- [ ] Optional provider-backed resume feedback with explicit consent, provider disclosure, retention limits and cost controls.
- [ ] Job-description-specific resume suggestions.
- [ ] Seniority-aware mock interviews and feedback.
- [ ] Curated learning paths with progress tracking and source attribution.
- [ ] Label generated advice as suggestions; never fabricate experience or guarantee hiring.

## Phase 3 — Recruiter and employer experience

Implemented: organization workspace, verification submission, verified-company job publishing, candidate applications, recruiter pipeline, application event history, invitations, interview scheduling and candidate-controlled profile-section consent.

Next:
- [ ] Complete reviewer verification operations and audit workflows.
- [ ] Add interview reminders and candidate-controlled calendar integrations.
- [ ] Add recruiter activity notifications with opt-in controls.
- [ ] Add organization ownership recovery and employee offboarding.

## Phase 4 — Professional growth and community

- [x] Opt-in mentorship discovery by skills, language and region, with private consent-based requests and mentor-controlled accept/decline; scheduling remains a later enhancement.
- [ ] Events/webinars with registration and reminders.
- [ ] Referral requests/offers with abuse prevention and transparent status.
- [ ] Skill endorsements with rate limits and relationship context.
- [ ] Topic subscriptions, followed-only/discovery feed modes and explainable feed controls.
- [ ] Community learning paths and project-based challenges.

Keep these capabilities inside existing Jobs, Profile, Messages and Communities areas rather than adding a top-level tab for every feature.

## Phase 5 — Scale, mobile and operations

- [ ] Durable background queues with retry/backoff, idempotency and dead-letter handling.
- [ ] Job-provider health dashboard and sync diagnostics.
- [ ] Query profiling, indexes, cursor pagination and load tests.
- [ ] File validation, private buckets, signed URLs and verified legacy-media migration.
- [ ] PWA installability, offline-safe shell and opt-in push notifications.
- [ ] Low-bandwidth mobile experience and responsive performance budgets.
- [ ] Telugu, Hindi and English localization foundation.
- [ ] Accessibility audit: keyboard navigation, focus, labels, contrast and screen-reader behavior.
- [ ] Centralized error monitoring, structured redacted logs and operational alerts.
- [ ] Privacy policy, terms, export/deletion workflow, retention policy and incident response.

## Required release gates

1. Additive migration only; inspect schema dependencies and avoid destructive assumptions.
2. Enforce least-privilege RLS and SQL grants together.
3. Add loading, empty, success and failure states to every UI flow.
4. Test signed-out access, owner access and cross-account denial.
5. Run lint, platform verification and production build.
6. Run browser and SQL integration tests where UI/database boundaries are involved.
7. Verify in the intended deployment before calling a feature production-ready.

## Supabase migration order

For a fresh project, use the ordered list in Production Readiness. For an existing project, inspect the actual schema and migration history first and apply only missing scripts. Do not blindly rerun one-off repair scripts.

## Non-negotiable engineering rules

- No demo users, seeded social posts, fake jobs or fabricated company verification.
- No service-role keys in browser bundles, public environment variables, logs or API responses.
- No broad unrestricted authenticated-write RLS policies.
- No breaking schema changes without a migration and backward-compatible rollout.
- No duplicate UI sections or nonfunctional buttons.
- Keep existing member content and IDs intact.
- Never claim protection or production readiness until every relevant route, database policy, storage policy and test enforces it.
- Repository commits cannot apply SQL to Supabase or change Vercel secrets; those are separate privileged operations.


## Current branch delivery — Mentorship marketplace

Branch: `feat/mentorship-marketplace`.

Implemented in source:
- Opt-in mentor profiles; profiles remain undiscoverable until the member explicitly enables requests.
- Member-controlled headline, bio, skills, languages, region and availability.
- Private mentorship requests with weekly, monthly or one-time cadence.
- Mentor accept/decline, requester withdrawal and participant completion actions.
- Database-enforced participant-only request reads, one active request per member pair, and block-aware discovery/request creation.
- Primary navigation entry reuses the existing global navigation; no new top-level menu group is introduced.

Release gate still pending: apply the new migration only to the verified WorldConnect Supabase project, then run two-account live RLS tests and confirm the Vercel preview. Repository source checks do not prove live database activation.
