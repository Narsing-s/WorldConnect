import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { collectJobs } from "@/lib/job-feeds";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeJwtClaims(key: string): { role?: string; ref?: string } | null {
  const parts = key.split(".");
  if (parts.length !== 3) return null; // New sb_secret_* keys are opaque.
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return {
      role: typeof payload.role === "string" ? payload.role : undefined,
      ref: typeof payload.ref === "string" ? payload.ref : undefined,
    };
  } catch {
    return null;
  }
}

function databaseError(error: { code?: string; message?: string; details?: string; hint?: string }) {
  return {
    code: error.code ?? "UNKNOWN",
    message: error.message ?? "Unknown database error",
    details: error.details ?? null,
    hint: error.hint ?? null,
  };
}

class JobSyncDatabaseError extends Error {
  constructor(
    public operation: string,
    public diagnostic: ReturnType<typeof databaseError>,
  ) {
    super(diagnostic.message);
    this.name = "JobSyncDatabaseError";
  }
}

export async function POST(req: NextRequest) {
  const expected = process.env.JOBS_SYNC_SECRET;
  const supplied =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    req.headers.get("x-jobs-sync-secret");

  if (
    !expected ||
    !supplied ||
    supplied.length !== expected.length ||
    !Buffer.from(supplied).equals(Buffer.from(expected))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json(
      {
        error: "Server-side Supabase credentials are not configured.",
        action: "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the Vercel Production environment, then redeploy.",
      },
      { status: 503 },
    );
  }

  // Legacy Supabase JWT keys can be checked safely without returning the key.
  // Opaque sb_secret_* keys are validated by Supabase when the request is made.
  const claims = safeJwtClaims(key);
  const urlRef = url.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i)?.[1];
  if (claims?.role && claims.role !== "service_role") {
    return NextResponse.json(
      {
        error: "SUPABASE_SERVICE_ROLE_KEY is not a service_role key.",
        diagnostic: { detectedRole: claims.role },
        action: "Replace the Vercel Production value with the service-role key from the same Supabase project. Do not use the anon or publishable key.",
      },
      { status: 503 },
    );
  }
  if (claims?.ref && urlRef && claims.ref !== urlRef) {
    return NextResponse.json(
      {
        error: "Supabase URL and service-role key belong to different projects.",
        diagnostic: { urlProjectRef: urlRef, keyProjectRef: claims.ref },
        action: "Set both Production variables from the same Supabase project and redeploy.",
      },
      { status: 503 },
    );
  }

  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const run = await db
    .from("wc_job_sync_runs")
    .insert({ status: "running" })
    .select("id")
    .single();

  if (run.error || !run.data) {
    const error = run.error ? databaseError(run.error) : null;
    return NextResponse.json(
      {
        error: "Could not create a job sync run.",
        diagnostic: error,
        action:
          "Confirm supabase/jobs-auto-sync.sql was applied to the same project as NEXT_PUBLIC_SUPABASE_URL. In Vercel Production, verify SUPABASE_SERVICE_ROLE_KEY is that project's service_role secret (not anon/publishable), then redeploy.",
      },
      { status: 500 },
    );
  }

  try {
    const { jobs, errors } = await collectJobs();
    if (!jobs.length && errors.length === 4) {
      throw new Error("All job providers failed; existing jobs were retained.");
    }

    const now = new Date().toISOString();
    const rows = jobs.map((job) => ({
      external_id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      remote: job.remote,
      description: job.description,
      application_url: job.url,
      posted_at: job.postedAt,
      source: job.source,
      tags: job.tags,
      salary: job.salary,
      status: "published",
      last_seen_at: now,
    }));

    let imported = 0;
    let added = 0;
    let updated = 0;
    const jobResults: Array<{
      title: string;
      company: string;
      location: string;
      source: string;
      url: string;
      postedAt: string | null;
      action: "added" | "updated";
    }> = [];

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const externalIds = batch.map((row) => row.external_id);
      const existing = await db
        .from("wc_jobs")
        .select("external_id")
        .in("external_id", externalIds);

      if (existing.error) {
        throw new JobSyncDatabaseError(
          `check existing wc_jobs batch starting at row ${i}`,
          databaseError(existing.error),
        );
      }

      const existingIds = new Set(
        (existing.data ?? []).map((row) => row.external_id),
      );
      const { error } = await db
        .from("wc_jobs")
        .upsert(batch, { onConflict: "external_id" });
      if (error) {
        throw new JobSyncDatabaseError(
          `upsert wc_jobs batch starting at row ${i}`,
          databaseError(error),
        );
      }

      for (const row of batch) {
        const action = existingIds.has(row.external_id) ? "updated" : "added";
        if (action === "added") added += 1;
        else updated += 1;
        jobResults.push({
          title: row.title,
          company: row.company,
          location: row.location,
          source: row.source,
          url: row.application_url,
          postedAt: row.posted_at,
          action,
        });
      }
      imported += batch.length;
    }

    const { error: expiryError } = await db
      .from("wc_jobs")
      .update({ status: "expired" })
      .eq("status", "published")
      .lt(
        "last_seen_at",
        new Date(Date.now() - 30 * 86400000).toISOString(),
      );
    if (expiryError) {
      throw new JobSyncDatabaseError("expire old wc_jobs records", databaseError(expiryError));
    }

    const completedAt = new Date().toISOString();
    const { error: runError } = await db
      .from("wc_job_sync_runs")
      .update({
        status: "completed",
        completed_at: completedAt,
        imported_count: imported,
        provider_errors: errors,
      })
      .eq("id", run.data.id);
    if (runError) {
      throw new JobSyncDatabaseError("mark wc_job_sync_runs completed", databaseError(runError));
    }

    return NextResponse.json({
      success: true,
      imported,
      added,
      updated,
      jobs: jobResults,
      errors,
      completedAt,
    });
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Job sync failed.";
    const diagnostic =
      caught instanceof JobSyncDatabaseError
        ? { operation: caught.operation, ...caught.diagnostic }
        : { operation: "collect job feeds or process sync", code: "APPLICATION_ERROR", message };
    const failureUpdate = await db
      .from("wc_job_sync_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error: `${diagnostic.operation}: ${message}`,
      })
      .eq("id", run.data.id);
    return NextResponse.json(
      {
        error: message,
        diagnostic,
        failureStatusUpdateError: failureUpdate.error
          ? databaseError(failureUpdate.error)
          : null,
      },
      { status: 502 },
    );
  }
}
