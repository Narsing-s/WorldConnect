import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { collectJobs, Job } from "@/lib/job-feeds";

export const dynamic = "force-dynamic";

type JobRow = {
  external_id: string;
  title: string;
  company: string | null;
  location: string | null;
  remote: boolean | null;
  description: string | null;
  application_url: string;
  posted_at: string | null;
  source: string;
  tags: string[] | null;
  salary: string | null;
};

function publicDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key
    ? createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
}

function fromRow(r: JobRow): Job {
  return {
    id: String(r.external_id),
    title: r.title,
    company: r.company || "",
    location: r.location || "Not specified",
    remote: Boolean(r.remote),
    description: r.description || "",
    url: r.application_url,
    postedAt: r.posted_at || null,
    source: r.source,
    tags: Array.isArray(r.tags) ? r.tags : [],
    salary: r.salary || null,
  };
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 80);
  const l = (req.nextUrl.searchParams.get("location") || "").trim().slice(0, 80);
  const db = publicDb();

  if (db) {
    const { data, error } = await db
      .from("wc_jobs")
      .select("*")
      .eq("status", "published")
      .order("posted_at", { ascending: false, nullsFirst: false })
      .limit(500);

    if (!error && data) {
      const jobs = (data as JobRow[])
        .map(fromRow)
        .filter((j) => {
          const t = [j.title, j.company, j.description, ...j.tags]
            .join(" ")
            .toLowerCase();
          const p = j.location.toLowerCase();
          return (
            (!q || t.includes(q.toLowerCase())) &&
            (!l ||
              p.includes(l.toLowerCase()) ||
              /worldwide|anywhere/i.test(p) ||
              (j.remote && /remote/i.test(l)))
          );
        })
        .slice(0, 100);

      const { data: sync } = await db
        .from("wc_job_sync_runs")
        .select("completed_at")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return NextResponse.json({
        jobs,
        errors: [],
        updatedAt: sync?.completed_at || null,
        persisted: true,
      });
    }
  }

  const result = await collectJobs(q, l);
  return NextResponse.json({
    ...result,
    updatedAt: new Date().toISOString(),
    persisted: false,
    setupNotice:
      "Automatic publishing is awaiting the database migration and sync credentials.",
  });
}
