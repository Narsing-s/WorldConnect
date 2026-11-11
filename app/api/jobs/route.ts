import { NextRequest, NextResponse } from "next/server";

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  description: string;
  url: string;
  postedAt: string | null;
  source: string;
  tags: string[];
  salary: string | null;
};

function clean(value: string | null, max = 100): string {
  return (value || "").trim().slice(0, max);
}

function stripHtml(value: unknown): string {
  return String(value || "").replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

export async function GET(request: NextRequest) {
  const query = clean(request.nextUrl.searchParams.get("q"), 80);
  const location = clean(request.nextUrl.searchParams.get("location"), 80);
  const term = query.toLowerCase();
  const place = location.toLowerCase();

  const [remotiveResult, arbeitnowResult] = await Promise.allSettled([
    fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}`, {
      next: { revalidate: 600 }, headers: { Accept: "application/json" },
    }),
    fetch("https://www.arbeitnow.com/api/job-board-api", {
      next: { revalidate: 600 }, headers: { Accept: "application/json" },
    }),
  ]);

  const jobs: Job[] = [];
  const errors: string[] = [];

  if (remotiveResult.status === "fulfilled" && remotiveResult.value.ok) {
    const payload = await remotiveResult.value.json() as { jobs?: Array<Record<string, unknown>> };
    for (const item of payload.jobs || []) {
      const title = String(item.title || "");
      const company = String(item.company_name || "");
      const description = stripHtml(item.description).slice(0, 1200);
      const tags = [String(item.category || ""), String(item.job_type || "")].filter(Boolean);
      const itemLocation = String(item.candidate_required_location || "Remote");
      if (term && ![title, company, description, ...tags].join(" ").toLowerCase().includes(term)) continue;
      if (place && !itemLocation.toLowerCase().includes(place) && !itemLocation.toLowerCase().includes("worldwide") && !itemLocation.toLowerCase().includes("anywhere")) continue;
      jobs.push({
        id: `remotive-${item.id}`, title, company, location: itemLocation,
        remote: true, description, url: String(item.url || ""), postedAt: String(item.publication_date || "") || null,
        source: "Remotive", tags, salary: String(item.salary || "") || null,
      });
    }
  } else errors.push("Remotive is temporarily unavailable.");

  if (arbeitnowResult.status === "fulfilled" && arbeitnowResult.value.ok) {
    const payload = await arbeitnowResult.value.json() as { data?: Array<Record<string, unknown>> };
    for (const item of payload.data || []) {
      const title = String(item.title || "");
      const company = String(item.company_name || "");
      const description = stripHtml(item.description).slice(0, 1200);
      const tags = Array.isArray(item.tags) ? item.tags.map(String) : [];
      const itemLocation = String(item.location || (item.remote ? "Remote" : "Not specified"));
      if (term && ![title, company, description, ...tags].join(" ").toLowerCase().includes(term)) continue;
      if (place && !itemLocation.toLowerCase().includes(place) && !(item.remote && /remote|worldwide|anywhere/i.test(place))) continue;
      jobs.push({
        id: `arbeitnow-${item.slug || item.id || item.url}`, title, company, location: itemLocation,
        remote: Boolean(item.remote), description, url: String(item.url || ""), postedAt: String(item.created_at || "") || null,
        source: "Arbeitnow", tags, salary: null,
      });
    }
  } else errors.push("Arbeitnow is temporarily unavailable.");

  const unique = Array.from(new Map(jobs.filter(job => job.url).map(job => [job.url, job])).values())
    .sort((a, b) => (Date.parse(b.postedAt || "") || 0) - (Date.parse(a.postedAt || "") || 0))
    .slice(0, 60);

  return NextResponse.json({ jobs: unique, sources: ["Remotive", "Arbeitnow"], errors, updatedAt: new Date().toISOString() }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
