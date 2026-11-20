import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { collectMuleSoftJobs, type MuleSoftJob } from "@/lib/mulesoft-job-feeds";

export const dynamic = "force-dynamic";

function publicDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

function fromRow(row: Record<string, unknown>): MuleSoftJob {
  const india = row.india_relevance === "India role";
  const remoteIndia = row.india_relevance === "Remote - India eligibility to verify";
  return {
    id: String(row.external_id), title: String(row.title || ""), company: String(row.company || ""),
    location: String(row.location || "Not specified"), remote: Boolean(row.remote),
    description: String(row.description || ""), url: String(row.application_url || ""),
    postedAt: row.posted_at ? String(row.posted_at) : null, source: String(row.source || ""),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [], salary: row.salary ? String(row.salary) : null,
    experience: String(row.experience || "Not stated"),
    indiaRelevance: india ? "India role" : remoteIndia ? "Remote - India eligibility to verify" : "International role",
  };
}

export async function GET(req: NextRequest) {
  const location = (req.nextUrl.searchParams.get("location") || "").trim().toLowerCase();
  const db = publicDb();
  if (db) {
    const { data, error } = await db.from("wc_mulesoft_jobs").select("*")
      .eq("status", "published").order("posted_at", { ascending: false, nullsFirst: false }).limit(500);
    if (!error && data && data.length > 0) {
      const jobs = data.map(row => fromRow(row as Record<string, unknown>)).filter(job =>
        !location || location === "all" || job.location.toLowerCase().includes(location) ||
        (location === "remote" && job.remote)
      );
      const { data: run } = await db.from("wc_mulesoft_job_sync_runs").select("completed_at,provider_errors,provider_diagnostics")
        .eq("status", "completed").order("completed_at", { ascending: false }).limit(1).maybeSingle();
      return NextResponse.json({ jobs, errors: Array.isArray(run?.provider_errors) ? run.provider_errors : [],
        diagnostics: Array.isArray(run?.provider_diagnostics) ? run.provider_diagnostics : [],
        updatedAt: run?.completed_at || null, persisted: true });
    }
  }
  const result = await collectMuleSoftJobs();
  const jobs = result.jobs.filter(job => !location || location === "all" ||
    job.location.toLowerCase().includes(location) || (location === "remote" && job.remote));
  return NextResponse.json({ ...result, jobs, updatedAt: new Date().toISOString(), persisted: false,
    setupNotice: "Live discovery is available. Apply the MuleSoft jobs migration and configure sync credentials to persist the feed." });
}
