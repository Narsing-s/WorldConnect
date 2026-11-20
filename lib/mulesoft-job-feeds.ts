import { collectJobs, type Job } from "@/lib/job-feeds";

const ROLE_PATTERN = /mulesoft|mule\\s*4|anypoint\\s*(platform|studio)|mule\\s*runtime/i;

export type MuleSoftJob = Job & {
  indiaRelevance: "India role" | "Remote - India eligibility to verify" | "International role";
  experience: string;
};

function experienceLabel(job: Job): string {
  const text = [job.title, job.company, job.description, ...job.tags].join(" ");
  const match = text.match(/(?:\\b)(\\d{1,2})\\s*(?:-|–|to)\\s*(\\d{1,2})\\s*years?/i);
  if (match) return `${match[1]}–${match[2]} years`;
  const plus = text.match(/(\\d{1,2})\\s*\\+\\s*years?/i);
  if (plus) return `${plus[1]}+ years`;
  if (/fresher|entry[- ]level|graduate/i.test(text)) return "Entry level";
  return "Not stated";
}

function canonicalUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "ref", "source"].forEach(key => url.searchParams.delete(key));
    return url.toString().replace(/\\/$/, "").toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

export async function collectMuleSoftJobs(): Promise<{ jobs: MuleSoftJob[]; errors: string[]; diagnostics: Array<{provider:string;fetched:number;matched:number;available:boolean}> }> {
  // Fetch the broad provider catalogs once, then match MuleSoft roles locally.
  // Querying each provider with a literal "MuleSoft" string missed jobs where
  // the skill appeared in structured tags or differently formatted descriptions.
  const result = await collectJobs("", "");
  const errors = result.errors;
  const byUrl = new Map<string, MuleSoftJob>();
  const diagnosticMap = result.diagnostics.map(item => ({
    ...item,
    matched: result.jobs.filter(job => job.source === item.provider &&
      ROLE_PATTERN.test([job.title, job.company, job.description, ...job.tags].join(" "))).length,
  }));

  for (const job of result.jobs) {
    const text = [job.title, job.company, job.description, ...job.tags].join(" ");
    if (!ROLE_PATTERN.test(text) || !job.url.startsWith("https://")) continue;

    const location = job.location || "Not specified";
    const indiaRole = /india|hyderabad|telangana|bengaluru|bangalore|karnataka|pune|maharashtra|chennai|tamil nadu|mumbai|noida|gurugram|gurgaon|haryana|delhi|kolkata|west bengal|ahmedabad|gujarat|kochi|kerala|jaipur|rajasthan|indore|madhya pradesh|bhubaneswar|odisha|visakhapatnam|andhra pradesh/i.test(location);
    const worldwideRemote = job.remote && /worldwide|anywhere|global|remote/i.test(location);
    const normalized: MuleSoftJob = {
      ...job,
      indiaRelevance: indiaRole ? "India role" : worldwideRemote ? "Remote - India eligibility to verify" : "International role",
      experience: experienceLabel(job),
      tags: Array.from(new Set(job.tags.map(tag => tag.trim()).filter(Boolean))),
    };
    const key = canonicalUrl(job.url);
    const current = byUrl.get(key);
    if (!current || (Date.parse(normalized.postedAt || "") || 0) > (Date.parse(current.postedAt || "") || 0)) {
      byUrl.set(key, normalized);
    }
  }

  const jobs = Array.from(byUrl.values()).sort((a, b) =>
    (Date.parse(b.postedAt || "") || 0) - (Date.parse(a.postedAt || "") || 0)
  );
  return { jobs: jobs.slice(0, 500), errors, diagnostics: diagnosticMap };
}
