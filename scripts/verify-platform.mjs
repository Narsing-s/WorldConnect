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
    "supabase/migrations/20261120_private_career_workspace.sql",\n    "supabase/migrations/20261121_employer_workspace.sql",
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

for (const item of checks) {
  const suffix = item.reason ? ": " + item.reason : "";
  console.log(`[${item.status}] ${item.label}${suffix}`);
}

const failed = checks.filter((item) => item.status === "FAIL").length;
console.log(`\nPlatform verification: ${checks.length - failed}/${checks.length} checks passed.`);
if (failed) process.exitCode = 1;
