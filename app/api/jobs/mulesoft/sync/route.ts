import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { collectMuleSoftJobs } from "@/lib/mulesoft-job-feeds";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function sameSecret(a: string, b: string) {
  return a.length === b.length && Buffer.from(a).equals(Buffer.from(b));
}

export async function POST(req: NextRequest) {
  const expected = process.env.JOBS_SYNC_SECRET;
  const supplied = req.headers.get("authorization")?.replace(/^Bearer\\s+/i, "") ||
    req.headers.get("x-jobs-sync-secret") || "";
  if (!expected || !supplied || !sameSecret(supplied, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Server-side Supabase credentials are not configured." }, { status: 503 });

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const run = await db.from("wc_mulesoft_job_sync_runs").insert({ status: "running" }).select("id").single();
  if (run.error || !run.data) {
    return NextResponse.json({ error: "Could not create a MuleSoft sync run.", diagnostic: run.error?.message }, { status: 500 });
  }

  try {
    const { jobs, errors } = await collectMuleSoftJobs();
    if (!jobs.length && errors.length >= 5) throw new Error("All discovery providers failed; existing MuleSoft listings were retained.");

    let added = 0;
    let updated = 0;
    const details: Array<{ title: string; company: string; location: string; source: string; url: string; action: string }> = [];
    for (let i = 0; i < jobs.length; i += 100) {
      const batch = jobs.slice(i, i + 100).map(job => ({
        external_id: job.id, title: job.title, company: job.company, location: job.location,
        remote: job.remote, description: job.description, application_url: job.url,
        posted_at: job.postedAt, source: job.source, tags: job.tags, salary: job.salary,
        experience: job.experience, india_relevance: job.indiaRelevance, status: "published",
        last_seen_at: new Date().toISOString(),
      }));
      const existing = await db.from("wc_mulesoft_jobs").select("external_id").in("external_id", batch.map(row => row.external_id));
      if (existing.error) throw new Error("Could not check existing MuleSoft jobs: " + existing.error.message);
      const ids = new Set((existing.data || []).map(row => row.external_id));
      const upsert = await db.from("wc_mulesoft_jobs").upsert(batch, { onConflict: "external_id" });
      if (upsert.error) throw new Error("Could not publish MuleSoft jobs: " + upsert.error.message);
      for (const row of batch) {
        const action = ids.has(row.external_id) ? "updated" : "added";
        if (action === "added") added++; else updated++;
        details.push({ title: row.title, company: row.company, location: row.location, source: row.source, url: row.application_url, action });
      }
    }

    const expiry = await db.from("wc_mulesoft_jobs").update({ status: "expired" })
      .eq("status", "published").lt("last_seen_at", new Date(Date.now() - 45 * 86400000).toISOString());
    if (expiry.error) throw new Error("Could not expire stale MuleSoft listings: " + expiry.error.message);

    const completedAt = new Date().toISOString();
    const finish = await db.from("wc_mulesoft_job_sync_runs").update({
      status: "completed", completed_at: completedAt, imported_count: jobs.length,
      added_count: added, updated_count: updated, provider_errors: errors,
    }).eq("id", run.data.id);
    if (finish.error) throw new Error("Could not complete MuleSoft sync run: " + finish.error.message);

    return NextResponse.json({ success: true, imported: jobs.length, added, updated, jobs: details, errors, completedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "MuleSoft sync failed.";
    await db.from("wc_mulesoft_job_sync_runs").update({
      status: "failed", completed_at: new Date().toISOString(), error: message,
    }).eq("id", run.data.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
