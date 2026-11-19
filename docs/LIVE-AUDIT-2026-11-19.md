# WorldConnect live audit — 2026-11-19

## Scope and safety

Read-only audit of the Supabase project configured by the repository. No live SQL changes, storage changes, user-data changes, or Vercel settings were made during this audit. The project contains both WorldConnect (`wc_*`) and Global Messenger (`gm_*`) objects; follow-up work must remain scoped to WorldConnect.

## Findings

1. The database contains the expected WorldConnect tables, but Supabase migration history currently lists only three Global Messenger migrations. This is schema/migration-history drift and may reflect SQL Editor/manual application. Do not replay the complete schema or historical migrations.
2. `wc_create_activity_notification()` exists, but its three social activity triggers were absent from the live trigger inventory:
   - `wc_notify_post_like` on `wc_post_likes`
   - `wc_notify_comment` on `wc_comments`
   - `wc_notify_follow` on `wc_follows`
   This prevents those actions from generating the expected social activity notifications.
3. Four trigger-only SECURITY DEFINER functions were directly executable by API roles: `wc_create_activity_notification()`, `wc_handle_new_user()`, `wc_log_content_report_event()`, and `wc_notify_message()`. The proposed migration revokes direct EXECUTE while retaining their trigger behavior.
4. `wc_is_blocked_between(uuid,uuid)` is also callable through the anonymous API role. It is retained for now because current public-read RLS policies reference it; the function returns false for anonymous requests and restricts authenticated checks to relationships involving the caller. Remove this exposure only after a role-specific RLS policy refactor.
5. Security Advisor reports additional authenticated-executable SECURITY DEFINER functions. Member-scoped RPCs need individual authorization review; blanket revocation would break intended flows.
6. Performance Advisor reports 28 unindexed foreign keys across the shared database, 26 of which belong to WorldConnect. No indexes were created during this audit.
7. The repository's latest main-branch CI run failed because a privacy-page assertion expected wording that no longer exists. This branch updates the assertion to match the current disclosure.

## Proposed implementation in this branch

- Add `20261127000000_worldconnect_notification_rpc_hardening.sql`.
- Restore the three missing social notification triggers idempotently.
- Revoke direct API execution from trigger-only functions.
- Add source-level verification for the migration.
- Update README, production-readiness and upgrade documentation with migration-history and rollout cautions.

## Required post-merge / operator verification

- Apply the migration only after confirming the live schema baseline.
- Confirm the three triggers exist and point to `wc_create_activity_notification()`.
- Confirm API roles cannot directly execute the four trigger-only functions.
- Confirm inserts into likes, comments and follows create one notification for the intended recipient.
- Run two-account isolation and block-enforcement tests.
- Re-run Supabase Security and Performance Advisors.
