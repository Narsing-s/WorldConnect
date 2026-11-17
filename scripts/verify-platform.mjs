import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const checks = [];

function check(label, fn) {
  try {
    fn();
    checks.push({ label, status: "PASS" });
  } catch (error) {
    checks.push({ label, status: "FAIL", reason: error instanceof Error ? error.message : String(error) });
  }
}

check("Required platform migrations exist", () => {
  for (const path of [
    "supabase/jobs-auto-sync.sql",
    "supabase/migrations/20261116_job_application_tracker.sql",
    "supabase/migrations/20261117_candidate_job_preferences.sql",
    "supabase/migrations/20261116_worldconnect_data_integrity_guardrails.sql",
    "supabase/migrations/20261118_platform_hardening.sql",
    "supabase/migrations/20261119_professional_portfolio.sql",
    "supabase/migrations/20261120_private_career_workspace.sql",
    "supabase/migrations/20261121_employer_workspace.sql",
    "supabase/migrations/20261122_employer_collaboration.sql",
    "supabase/migrations/20261123_trust_safety_foundation.sql",
    "supabase/migrations/20261124_moderation_audit_trail.sql",
    "supabase/migrations/20261125_private_chat_attachments.sql",
    "supabase/migrations/20261126_enforce_member_blocks.sql",
  ]) read(path);
});

check("Private job applications enforce owner-only RLS and no anon access", () => {
  const sql = read("supabase/migrations/20261116_job_application_tracker.sql");
  assert.match(sql, /alter table public\.wc_job_applications enable row level security/i);
  assert.match(sql, /using\s*\(auth\.uid\(\)\s*=\s*user_id\)/i);
  assert.match(sql, /with check\s*\(auth\.uid\(\)\s*=\s*user_id\)/i);
  assert.match(sql, /revoke all on public\.wc_job_applications from anon/i);
});

check("Candidate preferences enforce owner-only RLS and no anon access", () => {
  const sql = read("supabase/migrations/20261117_candidate_job_preferences.sql");
  assert.match(sql, /alter table public\.wc_candidate_preferences enable row level security/i);
  assert.match(sql, /using\s*\(auth\.uid\(\)\s*=\s*user_id\)/i);
  assert.match(sql, /with check\s*\(auth\.uid\(\)\s*=\s*user_id\)/i);
  assert.match(sql, /revoke all on public\.wc_candidate_preferences from anon/i);
});

check("Career workspace is private and owner-only", () => {
  const sql = read("supabase/migrations/20261120_private_career_workspace.sql");
  assert.match(sql, /alter table public\.wc_career_workspaces enable row level security/i);
  assert.match(sql, /using\s*\(auth\.uid\(\)\s*=\s*user_id\)/i);
  assert.match(sql, /with check\s*\(auth\.uid\(\)\s*=\s*user_id\)/i);
  assert.match(sql, /revoke all on public\.wc_career_workspaces from public, anon/i);
  const page = read("app/career-assistant/page.tsx");
  assert.match(page, /No external AI provider receives your resume/);
  assert.match(page, /I agree to store this resume/);
});

check("Employer workspace enforces verified publishing and private applications", () => {
  const sql = read("supabase/migrations/20261121_employer_workspace.sql");
  assert.match(sql, /wc_organizations[\s\S]*verification_status/i);
  assert.match(sql, /verification_status = 'verified'/i);
  assert.match(sql, /revoke all on public\.wc_organizations[\s\S]*from public, anon/i);
  assert.match(sql, /function public\.wc_create_organization/i);
  assert.match(sql, /function public\.wc_apply_to_employer_job/i);
  assert.match(sql, /function public\.wc_update_employer_application/i);
  assert.match(sql, /revoke all on function public\.wc_apply_to_employer_job\(uuid,text\) from public, anon/i);
  assert.match(sql, /wc_employer_application_events/i);
  assert.match(sql, /role='owner'/i);
  assert.match(sql, /status = 'published'/i);
  assert.match(sql, /on conflict\(job_id,candidate_id\) do nothing/i);
  const recruiter = read("app/recruiter/page.tsx");
  const board = read("app/employer-jobs/page.tsx");
  assert.match(recruiter, /wc_submit_organization_verification/);
  assert.match(recruiter, /wc_update_employer_application/);
  assert.match(board, /wc_apply_to_employer_job/);
});


check("Employer collaboration protects invitations, interviews, consent and reviewer decisions", () => {
  const sql = read("supabase/migrations/20261122_employer_collaboration.sql");
  assert.match(sql, /wc_organization_invitations enable row level security/i);
  assert.match(sql, /digest\(v_token,'sha256'\)/i);
  assert.match(sql, /v_email<>v_inv\.invited_email/i);
  assert.match(sql, /wc_schedule_employer_interview/i);
  assert.match(sql, /wc_candidate_grant_profile_consent/i);
  assert.match(sql, /wc_candidate_revoke_profile_consent/i);
  assert.match(sql, /worldconnect_role',''\)='reviewer'/i);
  assert.match(sql, /security_invoker=true/i);
  assert.match(sql, /wc_employer_analytics with \(security_invoker=true\)/i);
  const operations = read("app/recruiter/operations/page.tsx");
  assert.match(operations, /wc_create_organization_invitation/);
  assert.match(operations, /wc_schedule_employer_interview/);
  assert.match(operations, /wc_employer_analytics/);
  assert.match(operations, /wc_revoke_organization_invitation/);
  const sharing = read("app/career-sharing/page.tsx");
  assert.match(sharing, /wc_candidate_grant_profile_consent/);
  assert.match(sharing, /wc_candidate_revoke_profile_consent/);
  const inviteAcceptance = read("app/recruiter/invitations/accept/page.tsx");
  assert.match(inviteAcceptance, /wc_accept_organization_invitation/);
  const admin = read("app/admin/verifications/page.tsx");
  assert.match(admin, /worldconnect_role/);
  assert.match(admin, /wc_review_organization_verification/);
});

check("Notification hardening restricts updates to read_at", () => {
  const sql = read("supabase/migrations/20261118_platform_hardening.sql");
  assert.match(sql, /revoke update on table public\.wc_notifications from authenticated/i);
  assert.match(sql, /grant update \(read_at\) on table public\.wc_notifications to authenticated/i);
  assert.match(sql, /using\s*\(auth\.uid\(\)\s*=\s*recipient_id\)/i);
});

check("Job sync secrets remain server-side", () => {
  const route = read("app/api/jobs/sync/route.ts");
  assert.match(route, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
  const example = read(".env.example");
  assert.doesNotMatch(example, /NEXT_PUBLIC_.*SERVICE_ROLE/i);
});

check("CI runs lint, platform verification, and production build", () => {
  const workflow = read(".github/workflows/ci.yml");
  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /npm run verify:platform/);
  assert.match(workflow, /npm run build/);
});

check("Every tracked SQL migration is non-empty", () => {
  const files = readdirSync(join(root, "supabase/migrations")).filter((name) => name.endsWith(".sql"));
  assert.ok(files.length >= 5, "Expected the existing platform migrations to be present");
  for (const file of files) assert.ok(readFileSync(join(root, "supabase/migrations", file), "utf8").trim().length > 0, file + " is empty");
});

check("CI uses read-only repository permissions and bounded execution", () => {
  const workflow = read(".github/workflows/ci.yml");
  assert.match(workflow, /permissions:\s*contents:\s*read/i);
  assert.match(workflow, /timeout-minutes:\s*20/);
  assert.match(workflow, /cancel-in-progress:\s*true/);
});


check("Trust and safety migration protects blocks and reports", () => {
  const sql = read("supabase/migrations/20261123_trust_safety_foundation.sql");
  assert.ok(sql.includes("alter table public.wc_user_blocks enable row level security"));
  assert.ok(sql.includes("auth.uid() = blocker_id"));
  assert.ok(sql.includes("alter table public.wc_content_reports enable row level security"));
  assert.ok(sql.includes("auth.uid() = reporter_id"));
  assert.ok(sql.includes("worldconnect_role"));
  assert.ok(sql.includes("revoke all on public.wc_content_reports from public, anon"));
  const audit = read("supabase/migrations/20261124_moderation_audit_trail.sql");
  assert.ok(audit.includes("wc_content_report_events"));
  assert.ok(audit.includes("security definer"));
  assert.ok(audit.includes("after insert or update of status"));
  const moderation = read("app/admin/reports/page.tsx");
  assert.ok(moderation.includes("worldconnect_role"));
  assert.ok(moderation.includes("Mark reviewing"));
  assert.ok(moderation.includes("Resolve"));
  const page = read("app/safety/page.tsx");
  assert.ok(page.includes("Submit report"));
  assert.ok(page.includes("Block a member"));
  assert.ok(page.includes("cannot discover each other's profiles"));
  assert.ok(page.includes("previously shared public media URLs"));
  assert.ok(page.includes("Blocking is enforced for authenticated app queries"));
});

check("Member blocks are enforced by RLS across discovery, communities and messaging", () => {
  const sql = read("supabase/migrations/20261126_enforce_member_blocks.sql");
  assert.match(sql, /function public\\.wc_is_blocked_between\\(user_a uuid, user_b uuid\\)/i);
  assert.match(sql, /user_a = auth\\.uid\\(\\) or user_b = auth\\.uid\\(\\)/i);
  for (const table of ["wc_profiles", "wc_posts", "wc_comments", "wc_post_likes", "wc_follows", "wc_communities", "wc_community_members", "wc_opportunities"]) {
    assert.match(sql, new RegExp("drop policy if exists[\\s\\S]{0,120}on public\\." + table, "i"));
  }
  assert.match(sql, /function public\\.wc_is_conversation_member/i);
  assert.match(sql, /function public\\.wc_start_conversation/i);
  assert.match(sql, /wc_is_blocked_between\\(current_user_id, target_user\\)/i);
  assert.match(sql, /Users view their notifications[\\s\\S]*wc_is_blocked_between/i);
  assert.match(sql, /Conversation members read private chat files[\\s\\S]*wc_is_conversation_member/i);
  assert.match(sql, /Conversation members upload private chat files[\\s\\S]*wc_is_conversation_member/i);
  assert.doesNotMatch(sql, /delete\\s+from\\s+public\\.wc_(posts|messages|follows)/i);
});

check("New chat attachments use private storage and signed URLs", () => {
  const sql = read("supabase/migrations/20261125_private_chat_attachments.sql");
  assert.ok(sql.includes("public = false"));
  assert.ok(sql.includes("worldconnect-private-media"));
  assert.ok(sql.includes("wc_conversation_members"));
  assert.ok(sql.includes("file_size_limit"));
  const messages = read("app/messages/page.tsx");
  assert.ok(messages.includes("createSignedUrl"));
  assert.ok(messages.includes("worldconnect-private-media"));
  assert.ok(messages.includes("attachment_display_url"));
  assert.ok(messages.includes("attachment_url:path"));
});

check("Privacy page discloses public media and missing self-service deletion", () => {
  const page = read("app/privacy/page.tsx");
  assert.match(page, /publicly readable/i);
  assert.match(page, /Do not upload identity documents/i);
  assert.match(page, /does not yet provide self-service account export or complete account deletion/i);
  assert.match(page, /private to the signed-in member/i);
});

for (const item of checks) {
  const suffix = item.reason ? ": " + item.reason : "";
  console.log(`[${item.status}] ${item.label}${suffix}`);
}

const failed = checks.filter((item) => item.status === "FAIL").length;
console.log(`\nPlatform verification: ${checks.length - failed}/${checks.length} checks passed.`);
if (failed) process.exitCode = 1;
