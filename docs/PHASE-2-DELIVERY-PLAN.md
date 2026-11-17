# WorldConnect Advanced Upgrade — Phase 2 Delivery Plan

This plan turns the product roadmap into implementation-sized releases. It is deliberately additive: keep current routes, member content, IDs, navigation and business logic intact. Do not create demo users, fake activity, fabricated jobs or placeholder actions.

## Delivery principles

- Ship one vertical slice at a time: schema, RLS, UI, validation, tests, documentation and deployment checks.
- Reuse existing Jobs, Profile, Messages, Communities and Career Assistant surfaces. Do not add a duplicate top-level navigation item for every capability.
- Every private record must be scoped to `auth.uid()` through both RLS and SQL grants. Never trust a client-supplied owner ID.
- Use explicit consent before sharing profile sections, resumes, contact details, calendar data or AI-provider content.
- Every UI flow needs loading, empty, success and recoverable error states, plus keyboard and mobile support.
- External providers must be optional, disclosed, cost-limited and disabled until credentials are configured.
- A GitHub merge is not proof that a Supabase migration or Vercel configuration has been applied.

## Release 2A — Production trust and account controls

**Goal:** close the remaining security and operational gaps before expanding member data flows.

- [ ] Add server-authorized account deletion orchestration covering Auth, owned database records and Storage objects, with a preview/confirmation step, idempotent retries and an audit-safe result. Do not implement deletion as a browser-side cascade.
- [ ] Add session/device inventory and revocation using supported Supabase Auth capabilities; show only data actually returned by the provider.
- [ ] Add optional MFA enrollment, challenge and recovery UX; preserve password-only access when MFA is not enabled.
- [ ] Add endpoint-specific rate limiting and abuse controls for sign-up, messaging, reports, follows, applications and uploads.
- [ ] Complete moderation appeals, reviewer decision controls and immutable reviewer audit history.
- [ ] Add two-account SQL/RLS integration tests and browser end-to-end tests for owner access, cross-account denial, signed-out access and blocked-member behavior.
- [ ] Inventory and safely migrate legacy public media. Copy and verify objects before changing old access policies.

**Acceptance:** no cross-account read/write in the test matrix; account deletion is resumable and reports partial failures; legacy media has a verified rollback manifest; no service-role secret reaches browser bundles.

## Release 2B — Mentorship and referrals

**Goal:** make professional connections actionable without exposing private profile data.

### Mentorship
- [ ] Discover members who explicitly opt in to mentoring.
- [ ] Filter by skills, role, language, region and availability using only fields members have chosen to publish.
- [ ] Let a requester send a short goal and preferred cadence; allow the mentor to accept, decline or withdraw.
- [ ] Keep request details visible only to the requester and mentor; enforce this in RLS.
- [ ] Add scheduling only after both members accept. Calendar integrations must be opt-in and revocable.
- [ ] Provide report, block and cancellation paths consistent with existing trust/safety controls.

### Referrals
- [ ] Let members opt in to offering referrals and choose which employers/roles they can support.
- [ ] Allow a candidate to request a referral against a real job listing.
- [ ] Require the referrer to accept before contact details or a resume are shared.
- [ ] Track requested, accepted, declined, withdrawn and completed states with a timestamped event history.
- [ ] Rate-limit requests and prevent duplicate active requests for the same job/referrer/candidate.
- [ ] Never imply an employee referral guarantees an interview or offer.

**Acceptance:** two-account tests prove private request visibility; no resume/contact sharing before explicit acceptance; duplicate and blocked-member requests are rejected.

## Release 2C — Career intelligence

**Goal:** make Career Assistant useful for a specific role while keeping advice honest and private.

- [ ] Add job-description-specific resume feedback with a clear evidence trail mapping suggestions to supplied job requirements.
- [ ] Add seniority-aware mock interviews with role-specific question sets, answer notes and self-assessment rubrics.
- [ ] Add learning paths with milestones, progress and source attribution; distinguish curated resources from generated suggestions.
- [ ] Keep local/browser analysis as the default. Any external AI provider requires a separate consent action, provider disclosure, retention explanation, redaction and spend limits.
- [ ] Never invent experience, skills, metrics, qualifications or hiring outcomes.
- [ ] Keep saved resume/workspace data owner-only and make sharing a separate, revocable action.

**Acceptance:** tests cover empty/oversized inputs, unsupported claims, consent withdrawal and owner-only workspace access; generated output is labeled as suggestions.

## Release 2D — Events and community learning

- [ ] Add event creation within existing Communities, with organizer permissions and clear public/private visibility.
- [ ] Add registration, cancellation, capacity handling and attendee privacy.
- [ ] Add reminders through an opt-in notification channel; do not require push permission to use the platform.
- [ ] Add learning challenges and project milestones to communities with member-controlled participation.
- [ ] Add timezone-aware event display and accessible calendar export.

**Acceptance:** organizer/member permissions are enforced in SQL; registration is concurrency-safe; reminders are idempotent and respect notification preferences.

## Release 2E — Mobile, reliability and scale

- [ ] Add installable PWA metadata, icons and an offline-safe app shell. Never cache authenticated pages, private messages, resumes or API responses in a public service-worker cache.
- [ ] Add an accessible low-bandwidth mode and responsive performance budgets.
- [ ] Add durable background processing with bounded retries, exponential backoff, idempotency keys and dead-letter visibility.
- [ ] Add job-provider health and sync diagnostics without exposing provider credentials or personal data.
- [ ] Profile expensive queries; add indexes and cursor pagination only after query plans and access patterns are measured.
- [ ] Add centralized error monitoring, structured redacted logs and actionable operational alerts.
- [ ] Establish localization foundations for English, Telugu and Hindi without machine-translating member-authored content.

**Acceptance:** Lighthouse/mobile and accessibility checks are recorded; offline mode never exposes private data; queue retries cannot duplicate side effects; monitoring payloads are redacted.

## Release gates for every slice

1. Inspect existing schema and dependencies before authoring a migration.
2. Use additive, reversible migrations where practical; preserve existing data and IDs.
3. Enable RLS and least-privilege grants for every new table and Storage path.
4. Add source-level verification plus SQL and browser tests for the actual trust boundary.
5. Run `npm run lint`, `npm run verify:platform` and `npm run build`.
6. Apply only missing migrations to the intended Supabase project after inspecting its migration history.
7. Verify Vercel environment configuration and provider credentials without printing secret values.
8. Complete two-account live tests before describing the feature as production-ready.

## Recommended execution order

1. Release 2A security/account controls and production verification.
2. Release 2B mentorship and referrals.
3. Release 2C career intelligence.
4. Release 2D events and community learning.
5. Release 2E PWA, reliability and scale.

This ordering prioritizes member safety before adding new ways to share personal or professional information.
