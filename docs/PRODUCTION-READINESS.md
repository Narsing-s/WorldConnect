# WorldConnect production-readiness checklist

This is an operational checklist, not a claim that the live Supabase or Vercel environment has been inspected. Repository checks can validate source-level guardrails; only a live deployment smoke test can prove production configuration and permissions.

## 1. CI quality gates

Run locally or in GitHub Actions:

```bash
npm install
npm run lint
npm run verify:platform
npm run build
```

The platform verifier is intentionally dependency-free and checks selected critical invariants. It is not a substitute for a full SQL policy audit, database integration tests, or penetration testing.

## 2. Supabase setup order

For a fresh project, run the following in the Supabase SQL Editor, one script at a time:

1. `supabase/schema.sql`
2. `supabase/jobs-auto-sync.sql`
3. `supabase/migrations/20261116_job_application_tracker.sql`
4. `supabase/migrations/20261117_candidate_job_preferences.sql`
5. `supabase/migrations/20261116_worldconnect_data_integrity_guardrails.sql`
6. `supabase/migrations/20261118_platform_hardening.sql`
7. `supabase/migrations/20261119_professional_portfolio.sql`

The data-integrity guardrails have a date-based filename that sorts before the candidate-preferences migration, but they depend on both the tracker and candidate-preferences tables. Apply them after both dependencies.

For an existing project, first inspect the live schema and migration history. Apply only missing scripts. Do not blindly rerun one-off fix scripts or assume a file existing in GitHub means it has already been applied to Supabase.

## 3. Required environment configuration

Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy anon key)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never `NEXT_PUBLIC_`)
- `JOBS_SYNC_SECRET`

GitHub Actions repository secrets:
- `WORLDCONNECT_APP_URL` — deployed HTTPS base URL without a trailing slash
- `JOBS_SYNC_SECRET` — exactly the same value as the Vercel server secret

Never paste credentials into source files, issues, pull requests, chat, or build logs. Rotate any key that has been exposed.

## 4. Live smoke-test matrix

Use two separate test accounts and test with real sign-in sessions.

| Area | Check | Expected result |
|---|---|---|
| Authentication | Sign up, sign in, sign out, password recovery | Correct session lifecycle; no secret in browser |
| Social feed | Create post, like, comment, save, refresh | Content persists and only authorized actions succeed |
| Profile | Update profile and portfolio | Owner can edit; public fields follow intended visibility |
| Messaging | Send message between two test accounts | Only conversation members can read messages |
| Communities | Create, join, leave | Membership changes persist; unauthorized writes fail |
| Job sync | Manually run GitHub Actions workflow | Successful run is recorded; provider errors are visible |
| Job tracker | Save job and update status/notes/dates | Account A cannot read or mutate Account B's records |
| Preferences | Save roles, skills, locations and work modes | Preferences are private to their owner |
| Notifications | Mark own notification read | Recipient can update read state only |
| Portfolio | Create, edit and delete entries | Owner-only writes; public read follows product policy |

Do not use real candidate resumes or personal data for test accounts.

## 5. Release gate

A release is ready only when:
- GitHub Actions lint, platform verification, and production build are green.
- The required SQL scripts have been applied to the intended Supabase project.
- The manual job-sync workflow succeeds against the production URL.
- The two-account privacy tests pass.
- No unresolved production errors, permission-denied failures, or exposed credentials remain.

## 6. Known limits

- The repository verifier checks selected source patterns; it does not connect to Supabase.
- GitHub CI does not prove Vercel environment variables are correct.
- Job provider availability and returned listing freshness depend on those providers.
- Full automated browser and database integration tests remain a separate follow-up.
