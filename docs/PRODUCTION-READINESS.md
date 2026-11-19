# WorldConnect production-readiness checklist

This checklist distinguishes repository source checks from live environment verification. A green GitHub build does not prove that Supabase migrations, Vercel variables, storage policies or provider credentials are configured correctly.

## 1. CI quality gates

Run locally or in GitHub Actions:

    npm install
    npm run lint
    npm run verify:platform
    npm run build

The platform verifier checks selected source-level invariants. It is not a substitute for a full SQL policy audit, database integration tests, browser tests or penetration testing.

## 2. Supabase migration order

For a fresh Supabase project, apply these scripts one at a time:

1. supabase/schema.sql
2. supabase/jobs-auto-sync.sql
3. supabase/migrations/20261116_job_application_tracker.sql
4. supabase/migrations/20261117_candidate_job_preferences.sql
5. supabase/migrations/20261116_worldconnect_data_integrity_guardrails.sql
6. supabase/migrations/20261118_platform_hardening.sql
7. supabase/migrations/20261119_professional_portfolio.sql
8. supabase/migrations/20261120_private_career_workspace.sql
9. supabase/migrations/20261121_employer_workspace.sql
10. supabase/migrations/20261122_employer_collaboration.sql
11. supabase/migrations/20261123_trust_safety_foundation.sql
12. supabase/migrations/20261124_moderation_audit_trail.sql
13. supabase/migrations/20261125_private_chat_attachments.sql
14. supabase/migrations/20261126_enforce_member_blocks.sql
15. supabase/migrations/20261127_mentorship_marketplace.sql

The data-integrity guardrails have a date-based filename that sorts before candidate preferences, but depend on both the tracker and candidate-preferences tables. Apply them after both dependencies.

For an existing project, inspect live schema and migration history first. Apply only missing scripts. Do not blindly rerun one-off repair scripts or assume a file in GitHub has been applied to Supabase.

## 3. Environment configuration

Vercel:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy anon key)
- SUPABASE_SERVICE_ROLE_KEY (server-only; never NEXT_PUBLIC_)
- JOBS_SYNC_SECRET

GitHub Actions repository secrets:
- WORLDCONNECT_APP_URL — deployed HTTPS base URL without a trailing slash
- JOBS_SYNC_SECRET — same value as the Vercel server secret

Never paste credentials into source files, issues, pull requests, chat or build logs. Rotate any key that has been exposed.

## 4. Two-account live smoke-test matrix

Use two separate test accounts and real sign-in sessions. Do not use real resumes or sensitive personal data.

| Area | Check | Expected result |
|---|---|---|
| Authentication | Sign up, sign in, sign out, password recovery | Correct session lifecycle; no secret in browser |
| Social feed | Create post, like, comment, save, refresh | Content persists and only authorized actions succeed |
| Profile | Update profile and portfolio | Owner can edit; public fields follow intended visibility |
| Messaging | Send messages and upload private attachments | Only conversation members can read messages and signed URLs |
| Blocks | Block/unblock in both directions | Both accounts lose access to protected social/chat surfaces |
| Communities | Create, join, leave | Membership persists; blocked-member visibility is filtered |
| Job sync | Run manual GitHub Actions workflow | Sync recorded; provider failures do not erase existing listings |
| Job tracker | Save job and update status/notes/dates | Account A cannot read or mutate Account B records |
| Preferences | Save target roles, skills, locations and work modes | Private to owner |
| Career workspace | Save and delete after explicit consent | Owner-only; no external provider receives resume without separate consent |
| Employer workspace | Create organization and submit verification | Unverified organization cannot publish |
| Recruiter applications | Apply and advance pipeline | Candidate/recruiter scopes enforced; duplicate/self-applications rejected |
| Notifications | Mark own notification read | Recipient can update read state only |
| Moderation | Submit report and review as trusted reviewer | Reporter history private; reviewer actions audited |

## 5. Legacy media migration safety

The existing public media bucket must not be disabled merely because a private bucket exists. A safe migration requires:
1. Inventory every database reference to the old bucket, including posts, profiles and chat attachments.
2. Identify sensitive media and classify content intentionally public versus private.
3. Copy objects to the correct private destination using a trusted server-side migration process.
4. Verify object count, byte size, MIME type and checksum where available.
5. Update database references transactionally or in resumable batches.
6. Verify signed-URL access with authorized and unauthorized accounts.
7. Keep a rollback manifest until migration is confirmed.
8. Only then consider removing legacy public access for objects no longer intended to be public.

Do not attempt this as a blind SQL-only migration: object bytes must be copied and verified through Storage APIs or a trusted migration worker.

## 6. Release gate

A release is ready only when GitHub Actions lint, platform verification and production build are green; required SQL scripts are applied to the intended Supabase project; manual job sync succeeds; two-account privacy/block tests pass; storage access tests pass; and no unresolved production errors, permission failures or exposed credentials remain.

## 7. Known limits

- The repository verifier checks selected source patterns; it does not connect to Supabase.
- GitHub CI does not prove Vercel environment variables are correct.
- Provider availability and job freshness depend on external providers.
- Legacy public-media migration requires a trusted process with Storage access.
- Account export/deletion, session management, MFA UX, appeals, mentorship, events, referrals, PWA and operational monitoring are not complete until their full implementation and tests exist.


## Mentorship marketplace rollout

The mentorship migration depends on `wc_is_blocked_between(uuid, uuid)` from the member-block migration. Apply it only after the block-enforcement migration is present in the intended project. Then verify opt-in discovery, private request visibility, accept/decline/withdraw/complete permissions, duplicate active-request prevention and blocked-member denial with two independent test accounts. No live WorldConnect Supabase project was available through the connected project list at the time this branch was prepared; do not infer deployment from the repository migration file.
