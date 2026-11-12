import { NextRequest, NextResponse } from "next/server";

type Job = {
  id: string; title: string; company: string; location: string; remote: boolean;
  description: string; url: string; postedAt: string | null; source: string;
  tags: string[]; salary: string | null;
};

function clean(value: string | null, max = 100): string { return (value || "").trim().slice(0, max); }
function stripHtml(value: unknown): string {
  return String(value || "").replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}
function matches(job: Job, term: string, place: string): boolean {
  const text = [job.title, job.company, job.description, ...job.tags].join(" ").toLowerCase();
  const location = job.location.toLowerCase();
  return (!term || text.includes(term)) && (!place || location.includes(place) || /worldwide|anywhere/i.test(location) || (job.remote && /remote/i.test(place)));
}
async function safeJson<T>(response: PromiseSettledResult<Response>): Promise<T | null> {
  if (response.status !== "fulfilled" || !response.value.ok) return null;
  try { return await response.value.json() as T; } catch { return null; }
}

export async function GET(request: NextRequest) {
  const query = clean(request.nextUrl.searchParams.get("q"), 80);
  const location = clean(request.nextUrl.searchParams.get("location"), 80);
  const term = query.toLowerCase(); const place = location.toLowerCase();
  const results = await Promise.allSettled([
    fetch("https://remotive.com/api/remote-jobs?search=" + encodeURIComponent(query), { next: { revalidate: 600 }, headers: { Accept: "application/json" } }),
    fetch("https://www.arbeitnow.com/api/job-board-api", { next: { revalidate: 600 }, headers: { Accept: "application/json" } }),
    fetch("https://remoteok.com/api", { next: { revalidate: 600 }, headers: { Accept: "application/json", "User-Agent": "WorldConnectJobHub/1.0 (job discovery)" } }),
    fetch("https://jobicy.com/api/v2/remote-jobs?count=50" + (query ? "&tag=" + encodeURIComponent(query) : ""), { next: { revalidate: 600 }, headers: { Accept: "application/json" } }),
  ]);
  const [remotive, arbeitnow, remoteok, jobicy] = await Promise.all([
    safeJson<{ jobs?: Array<Record<string, unknown>> }>(results[0]),
    safeJson<{ data?: Array<Record<string, unknown>> }>(results[1]),
    safeJson<Array<Record<string, unknown>>>(results[2]),
    safeJson<{ jobs?: Array<Record<string, unknown>> }>(results[3]),
  ]);
  const jobs: Job[] = []; const errors: string[] = [];
  for (const item of remotive?.jobs || []) {
    const job: Job = { id: "remotive-" + item.id, title: String(item.title || ""), company: String(item.company_name || ""),
      location: String(item.candidate_required_location || "Remote"), remote: true, description: stripHtml(item.description).slice(0, 1200),
      url: String(item.url || ""), postedAt: String(item.publication_date || "") || null, source: "Remotive",
      tags: [String(item.category || ""), String(item.job_type || "")].filter(Boolean), salary: String(item.salary || "") || null };
    if (matches(job, term, place)) jobs.push(job);
  }
  for (const item of arbeitnow?.data || []) {
    const job: Job = { id: "arbeitnow-" + (item.slug || item.id || item.url), title: String(item.title || ""), company: String(item.company_name || ""),
      location: String(item.location || (item.remote ? "Remote" : "Not specified")), remote: Boolean(item.remote),
      description: stripHtml(item.description).slice(0, 1200), url: String(item.url || ""),
      postedAt: String(item.created_at || "") || null, source: "Arbeitnow", tags: Array.isArray(item.tags) ? item.tags.map(String) : [], salary: null };
    if (matches(job, term, place)) jobs.push(job);
  }
  for (const item of (remoteok || []).filter(item => item.position || item.title)) {
    const job: Job = { id: "remoteok-" + (item.id || item.url), title: String(item.position || item.title || ""), company: String(item.company || ""),
      location: String(item.location || "Remote"), remote: true, description: stripHtml(item.description).slice(0, 1200),
      url: String(item.url || (item.slug ? "https://remoteok.com/remote-jobs/" + item.slug : "")),
      postedAt: String(item.date || "") || null, source: "Remote OK", tags: Array.isArray(item.tags) ? item.tags.map(String) : [], salary: item.salary ? String(item.salary) : null };
    if (matches(job, term, place)) jobs.push(job);
  }
  for (const item of jobicy?.jobs || []) {
    const job: Job = { id: "jobicy-" + (item.id || item.url), title: String(item.jobTitle || ""), company: String(item.companyName || ""),
      location: String(item.jobGeo || "Remote"), remote: true, description: stripHtml(item.jobDescription).slice(0, 1200),
      url: String(item.url || ""), postedAt: String(item.pubDate || "") || null, source: "Jobicy",
      tags: [String(item.jobIndustry || ""), String(item.jobType || "")].filter(Boolean),
      salary: item.annualSalaryMin || item.annualSalaryMax ? (String(item.salaryCurrency || "") + " " + String(item.annualSalaryMin || "") + "-" + String(item.annualSalaryMax || "")).trim() : null };
    if (matches(job, term, place)) jobs.push(job);
  }
  if (!remotive) errors.push("Remotive feed is temporarily unavailable.");
  if (!arbeitnow) errors.push("Arbeitnow feed is temporarily unavailable.");
  if (!remoteok) errors.push("Remote OK feed is temporarily unavailable.");
  if (!jobicy) errors.push("Jobicy feed is temporarily unavailable.");
  const unique = Array.from(new Map(jobs.filter(job => job.url && /^https:\/\//i.test(job.url)).map(job => [job.url, job])).values())
    .sort((a, b) => (Date.parse(b.postedAt || "") || 0) - (Date.parse(a.postedAt || "") || 0)).slice(0, 100);
  return NextResponse.json({ jobs: unique, sources: ["Remotive", "Arbeitnow", "Remote OK", "Jobicy"], errors, updatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
