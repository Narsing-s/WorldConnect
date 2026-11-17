# Employer Collaboration and Candidate Privacy (Phase 4)

Apply `supabase/migrations/20261122_employer_collaboration.sql` after the Phase 3 employer workspace migration.

## Included

- **Recruiter invitations:** owners create single-use, seven-day invitation tokens. Only a user signed in with the invited email can accept. Owners can revoke pending invitations.
- **Verification review UI:** `/admin/verifications` displays pending requests to trusted reviewers and provides approve/reject actions. Reviewer role is checked in the UI and enforced again by database RLS/RPC.
- **Interview scheduling backend:** organization members can schedule future interviews against their applications. Candidates and the relevant employer team can read interview details. The SQL rejects past dates and invalid durations.
- **Candidate-controlled profile sharing:** candidates explicitly grant selected sections (basic profile, skills, portfolio, experience, certifications) to a specific organization, optionally tied to an application. Consent expires after 30 days by default and can be revoked. This is an auditable permission record; it does not copy or automatically expose resume files or private Career Assistant content.
- **Employer analytics:** `wc_employer_analytics` aggregates published jobs and application pipeline counts per organization, scoped by caller membership and invoker RLS.

## Secure setup and integration requirements

1. Provision `app_metadata.worldconnect_role = "reviewer"` only through a trusted Supabase administrative environment/service role. Never expose service-role credentials in the browser or add a client-side role editor.
2. Invitation token delivery must be implemented by a trusted server endpoint/email provider. The SQL RPC returns the raw token once and stores only its hash. Do not log the token or send mail from the browser using privileged credentials.
3. Before displaying candidate profile sections to an employer, the application must enforce an active, unexpired consent and select only the approved fields. Consent does not grant blanket access to resumes, messages, or private workspace data.
4. Interview meeting URLs and notes are visible to the candidate and relevant organization members. Do not put passwords or sensitive access codes in notes.
5. Apply this migration once in Supabase SQL Editor after confirming Phase 3 is present.

## Verification checklist

- Owner can invite; non-owner cannot invite or revoke.
- Invite cannot be accepted by a different email, reused, or accepted after expiry.
- Normal users cannot read the verification queue or approve/reject; trusted reviewers can review pending requests only.
- Candidate and relevant employer members can see an interview; unrelated employers cannot.
- Candidate can grant and revoke consent; an employer sees only active consent metadata for its organization.
- Analytics counts match test records and do not reveal another organization's totals.
- Run `npm run lint`, `npm run verify:platform`, and `npm run build`; then test with unrelated accounts in Supabase.
