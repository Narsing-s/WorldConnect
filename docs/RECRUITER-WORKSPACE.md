# Recruiter and Employer Workspace

Phase 3 adds an employer workspace at `/recruiter` and a verified-company job board at `/employer-jobs`.

## Capabilities
- A signed-in member can create one initial organization workspace; the creator becomes its owner.
- Owners can submit a verification request with a registration reference and notes. A request becomes pending; it is never automatically approved.
- Only organizations whose verification status is explicitly set to `verified` by an authorized WorldConnect reviewer can publish jobs visible on the public employer board.
- Unverified employers may save drafts but cannot publish.
- Candidates apply through a database function; duplicate applications and applications to one's own employer are rejected.
- Recruiters update the applicant pipeline through a permission-checked function. Status changes are recorded in an append-only event table.
- Candidates can read their own applications and recruiters can read applications for jobs in their organization. Candidate resumes and private career workspaces are not exposed to recruiters in this phase.

## Apply migration
Apply `supabase/migrations/20261121_employer_workspace.sql` in Supabase SQL Editor after the Phase 1 and Phase 2 migrations. It is additive and does not modify the existing job feed or existing application tracker.

## Verification operations
The verification request table is intentionally not writable by ordinary authenticated clients. An authorized platform reviewer must validate the organization independently and then update the organization's `verification_status` to `verified` or `rejected`, and update the corresponding request's `status` and `reviewed_at`. Do not grant this capability to employer accounts. Establish a documented reviewer/admin process before accepting real verification submissions.

## Validation
Run `npm run lint`, `npm run verify:platform`, and `npm run build`. Before launch, test with at least two candidate accounts and two unrelated employer accounts: cross-organization applicant visibility, duplicate applications, unauthorized pipeline changes, draft visibility, unverified publishing, and verification review.
