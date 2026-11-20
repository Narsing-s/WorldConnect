import { collectJobs, type Job } from "@/lib/job-feeds";

const SEARCH_TERMS = [
  "MuleSoft",
  "Mule 4",
  "MuleSoft Developer",
  "MuleSoft Integration",
  "MuleSoft Support",
  "Anypoint Platform",
];

const ROLE_PATTERN = /mulesoft|mule\s*4|anypoint\s*(platform|studio)|mule\s*runtime/i;
const INDIA_PATTERN = /india|hyderabad|bengaluru|bangalore|pune|chennai|mumbai|noida|gurugram|gurgaon|delhi|kolkata/i;
const GLOBAL_REMOTE_PATTERN = /worldwide|anywhere|global|remote/i;
const OTHER_REGION_PATTERN = /united states|\busa\b|\bus\b|canada|united kingdom|\buk\b|europe|germany|france|netherlands|ireland|australia|new zealand|singapore|japan/i;

export type MuleSoftJob = Job & {
  indiaRelevance: "India role" | "Remote - India eligibility to verify";
  experience: string;
};

function experienceLabel(job: Job): string {
  const text = [job.title, job.company, job.description, ...job.tags].join(" ");
  const match = text.match(/(?:\b)(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*years?/i);
  if (match) return `${match[1]}–${match[2]} years`;
  const plus = text.match(/(\d{1,2})\s*\+\s*years?/i);
  if (plus) return `${plus[1]}+ years`;
  if (/fresher|entry[- ]level|graduate/i.test(text)) return "Entry level";
  return "Not stated";
}

function canonicalUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "ref", "source"].forEach(key => url.searchParams.delete(key));
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

export async function collectMuleSoftJobs(): Promise<{ jobs: MuleSoftJob[]; errors: string[]; diagnostics: Array<{provider:string;fetched:number;matched:number;available:boolean}> }> {
  const results = await Promise.all(SEARCH_TERMS.map(term => collectJobs(term, "")));
  const errors = Array.from(new Set(results.flatMap(result => result.errors)));
  const diagnosticMap = new Map<string, {provider:string;fetched:number;matched:number;available:boolean}>();
  for (const result of results) for (const item of result.diagnostics) {
    const current = diagnosticMap.get(item.provider) || {provider:item.provider,fetched:0,matched:0,available:false};
    current.fetched += item.fetched; current.matched += item.matched; current.available ||= item.available;
    diagnosticMap.set(item.provider,current);
  }
  const byUrl = new Map<string, MuleSoftJob>();

  for (const result of results) {
    for (const job of result.jobs) {
      const text = [job.title, job.description, ...job.tags].join(" ");
      if (!ROLE_PATTERN.test(text) || !job.url.startsWith("https://")) continue;

      const location = job.location || "Not specified";
      const indiaRole = INDIA_PATTERN.test(location);
      const worldwideRemote = job.remote && GLOBAL_REMOTE_PATTERN.test(location) && !OTHER_REGION_PATTERN.test(location);
      if (!indiaRole && !worldwideRemote) continue;

      const normalized: MuleSoftJob = {
        ...job,
        indiaRelevance: indiaRole ? "India role" : "Remote - India eligibility to verify",
        experience: experienceLabel(job),
        tags: Array.from(new Set(job.tags.map(tag => tag.trim()).filter(Boolean))),
      };
      const key = canonicalUrl(job.url);
      const current = byUrl.get(key);
      if (!current || (Date.parse(normalized.postedAt || "") || 0) > (Date.parse(current.postedAt || "") || 0)) {
        byUrl.set(key, normalized);
      }
    }
  }

  const jobs = Array.from(byUrl.values()).sort((a, b) =>
    (Date.parse(b.postedAt || "") || 0) - (Date.parse(a.postedAt || "") || 0)
  );
  return { jobs: jobs.slice(0, 300), errors, diagnostics: Array.from(diagnosticMap.values()) };
}
