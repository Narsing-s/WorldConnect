"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "./jobs.css";
import { ArrowLeft, BriefcaseBusiness, ExternalLink, MapPin, RefreshCw, Search, Globe2 } from "lucide-react";

type Job = { id: string; title: string; company: string; location: string; remote: boolean; description: string; url: string; postedAt: string | null; source: string; tags: string[]; salary: string | null };
type SearchResponse = { jobs: Job[]; errors: string[]; updatedAt: string; sources?: string[] };
type Board = { name: string; url: string; region: string; kind: string };

const boards: Board[] = [
  { name: "Naukri", url: "https://www.naukri.com/", region: "India", kind: "All roles" },
  { name: "JobsForce India", url: "https://jobsforceindia.com/", region: "India", kind: "IT & Non-IT" },
  { name: "LinkedIn Jobs", url: "https://www.linkedin.com/jobs/", region: "Global", kind: "Professional" },
  { name: "Indeed India", url: "https://in.indeed.com/", region: "India", kind: "All roles" },
  { name: "Foundit", url: "https://www.foundit.in/", region: "India", kind: "All roles" },
  { name: "Instahyre", url: "https://www.instahyre.com/", region: "India", kind: "Technology" },
  { name: "Cutshort", url: "https://cutshort.io/", region: "India", kind: "Technology" },
  { name: " iimjobs", url: "https://www.iimjobs.com/", region: "India", kind: "Management" },
  { name: "TimesJobs", url: "https://www.timesjobs.com/", region: "India", kind: "All roles" },
  { name: "Shine", url: "https://www.shine.com/", region: "India", kind: "All roles" },
  { name: "Freshersworld", url: "https://www.freshersworld.com/", region: "India", kind: "Entry level" },
  { name: "Wellfound", url: "https://wellfound.com/jobs", region: "Global", kind: "Startups" },
  { name: "Glassdoor", url: "https://www.glassdoor.co.in/Job/index.htm", region: "Global", kind: "Company insights" },
  { name: "Remote OK", url: "https://remoteok.com/", region: "Remote", kind: "Remote" },
  { name: "We Work Remotely", url: "https://weworkremotely.com/", region: "Remote", kind: "Remote" },
  { name: "Jobicy", url: "https://jobicy.com/", region: "Remote", kind: "Remote" },
  { name: "Remotive", url: "https://remotive.com/", region: "Remote", kind: "Remote" },
  { name: "Arbeitnow", url: "https://www.arbeitnow.com/", region: "Global", kind: "Technology & more" },
  { name: "Dice", url: "https://www.dice.com/", region: "US", kind: "Technology" },
  { name: "ZipRecruiter", url: "https://www.ziprecruiter.com/", region: "Global", kind: "All roles" },
];

const getJobCategory = (job: Job) => {
  const text = [job.title, job.company, job.description, ...(job.tags || [])].join(" ").toLowerCase();
  if (/\b(mulesoft|software|developer|programmer|programming|frontend|front-end|backend|back-end|full stack|fullstack|devops|cloud engineer|data engineer|data analyst|it support|technical support|system administrator|network engineer|cyber security|cybersecurity|qa engineer|test engineer|web developer|mobile developer|database|java|python|javascript|react|node\.js|\.net|sap|oracle|technology|information technology|it engineer)\b/.test(text)) return "IT & Software";
  if (/\b(civil|structural|site engineer|quantity surveyor|construction|architecture|architect|surveying|geotechnical)\b/.test(text)) return "Civil & Construction";
  if (/\b(mechanical|hvac|automotive|automobile|production engineer|manufacturing engineer|maintenance engineer|tool design|cad engineer)\b/.test(text)) return "Mechanical";
  if (/\b(electrical|power systems|electrical engineer|substation|plc|instrumentation|electrical maintenance)\b/.test(text)) return "Electrical";
  if (/\b(electronics|embedded|vlsi|semiconductor|pcb|firmware|telecommunication|telecom)\b/.test(text)) return "Electronics & Telecom";
  if (/\b(doctor|nurse|nursing|medical|healthcare|pharma|pharmacist|clinical|hospital|lab technician|therapist)\b/.test(text)) return "Healthcare & Pharma";
  if (/\b(accountant|accounting|finance|financial|banking|auditor|tax|payroll|investment)\b/.test(text)) return "Finance & Accounting";
  if (/\b(human resources|\bhr\b|recruiter|recruitment|talent acquisition|admin executive|administration)\b/.test(text)) return "HR & Administration";
  if (/\b(sales|business development|marketing|digital marketing|seo|social media|brand manager|customer success)\b/.test(text)) return "Sales & Marketing";
  if (/\b(teacher|teaching|faculty|professor|trainer|tutor|education|academic)\b/.test(text)) return "Education";
  if (/\b(logistics|supply chain|warehouse|procurement|operations|delivery|transport|inventory)\b/.test(text)) return "Operations & Logistics";
  return "Other Non-IT";
};

export default function JobsPage() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [source, setSource] = useState("All sources");
  const [region, setRegion] = useState("All regions");
  const [category, setCategory] = useState("All categories");
  const [postedWithin, setPostedWithin] = useState("Any time");
  const [experience, setExperience] = useState("Any experience");
  const [minSalary, setMinSalary] = useState("");
  const [maxSalary, setMaxSalary] = useState("");

  const loadJobs = useCallback(async (searchTerm: string, searchLocation: string) => {
    setLoading(true); setNotice("");
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set("q", searchTerm.trim());
      if (searchLocation.trim()) params.set("location", searchLocation.trim());
      const response = await fetch(`/api/jobs?${params.toString()}`);
      if (!response.ok) throw new Error("Job providers could not be reached. Please try again.");
      const data = await response.json() as SearchResponse;
      setJobs(data.jobs || []); setLastUpdated(data.updatedAt || "");
      if (!data.jobs?.length) setNotice(data.errors?.length ? data.errors.join(" ") : "No matching jobs found. Try a broader keyword or location.");
      else if (data.errors?.length) setNotice(data.errors.join(" "));
    } catch (error) {
      setJobs([]); setNotice(error instanceof Error ? error.message : "Could not load jobs.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadJobs("", ""); }, [loadJobs]);
  useEffect(() => {
    const interval = window.setInterval(() => { void loadJobs(query, location); }, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [loadJobs, query, location]);
  function searchJobs(event?: FormEvent) { event?.preventDefault(); void loadJobs(query, location); }

  const visibleJobs = useMemo(() => jobs.filter(job => {
    const now = Date.now();
    const posted = job.postedAt ? Date.parse(job.postedAt) : NaN;
    const ageDays = Number.isFinite(posted) ? (now - posted) / 86400000 : Infinity;
    const text = [job.title, job.description, ...(job.tags || [])].join(" ").toLowerCase();
    const expMatch = text.match(/(?:\\b|^)(fresher|entry[- ]level|intern(?:ship)?|\\d+\\s*[-–to]+\\s*\\d+\\s*years?|\\d+\\+?\\s*years?)(?:\\b|$)/i);
    const expText = (expMatch?.[0] || "").toLowerCase();
    const salaryNumbers = (job.salary || "").replace(/,/g, "").match(/\\d+(?:\\.\\d+)?/g)?.map(Number) || [];
    const salaryValue = salaryNumbers.length ? Math.max(...salaryNumbers) : NaN;
    const min = minSalary.trim() ? Number(minSalary) : null;
    const max = maxSalary.trim() ? Number(maxSalary) : null;
    const expOk = experience === "Any experience" ||
      (experience === "Fresher / Internship" ? /fresher|entry[- ]level|intern/.test(expText) :
       experience === "0–2 years" ? /fresher|entry[- ]level|intern|0\\s*[-–to]+\\s*[12]|1\\s*[-–to]+\\s*2|[01]\\+?\\s*years?/.test(expText) :
       experience === "2–5 years" ? /2\\s*[-–to]+\\s*[345]|3\\s*[-–to]+\\s*5|[234]\\+?\\s*years?/.test(expText) :
       experience === "5–10 years" ? /[5-9]\\s*[-–to]+\\s*10|[5-9]\\+?\\s*years?|10\\+?\\s*years?/.test(expText) :
       /10\\+?\\s*years?/.test(expText));
    return (source === "All sources" || job.source === source) &&
      (region === "All regions" || (region === "Remote" ? job.remote : region === "India" ? /india/i.test(job.location) : region === "United States" ? /united states|\\busa\\b|\\bus\\b/i.test(job.location) : region === "Europe" ? /europe|uk|germany|france|netherlands|ireland/i.test(job.location) : job.location.toLowerCase().includes(region.toLowerCase()))) &&
      (category === "All categories" || getJobCategory(job) === category) &&
      (postedWithin === "Any time" || (Number.isFinite(posted) && ageDays <= (postedWithin === "24 hours" ? 1 : postedWithin === "7 days" ? 7 : 30))) &&
      expOk &&
      (min === null || (Number.isFinite(salaryValue) && salaryValue >= min)) &&
      (max === null || (Number.isFinite(salaryValue) && salaryValue <= max));
  }), [jobs, source, region, category, postedWithin, experience, minSalary, maxSalary]);
  const sources = useMemo(() => ["All sources", ...Array.from(new Set(jobs.map(job => job.source))).sort()], [jobs]);

  return (
    <main className="feature-page">
      <Link href="/" className="feature-back"><ArrowLeft size={16}/> WorldConnect</Link>
      <header className="feature-heading"><span><BriefcaseBusiness size={22}/></span><div><h1>WorldConnect Job Hub</h1><p>Search live job feeds and open trusted job boards from one place. Automatically refreshes every five minutes; saved listings sync every six hours.</p></div></header>

      <section className="feature-section" aria-labelledby="live-jobs-heading">
        <h2 id="live-jobs-heading"><Search size={18}/> Live job search</h2>
        <form className="feature-form jobs-search-form" onSubmit={searchJobs}>
          <label>Role, skill or keyword<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="e.g. MuleSoft Developer, React, Data Analyst"/></label>
          <label>Location<input value={location} onChange={event=>setLocation(event.target.value)} placeholder="e.g. India, Hyderabad, Remote"/></label>
          <button className="feature-primary" disabled={loading}><Search size={16}/> Search jobs</button>
        </form>
        <div className="feature-toolbar"><strong>{visibleJobs.length} matching jobs</strong><button className="feature-secondary" onClick={()=>searchJobs()} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>
        <div className="jobs-filters jobs-advanced-filters">
          <label>Category<select value={category} onChange={event=>setCategory(event.target.value)}>{["All categories","IT & Software","Civil & Construction","Mechanical","Electrical","Electronics & Telecom","Healthcare & Pharma","Finance & Accounting","HR & Administration","Sales & Marketing","Education","Operations & Logistics","Other Non-IT"].map(item=><option key={item}>{item}</option>)}</select></label>
          <label>Location type<select value={region} onChange={event=>setRegion(event.target.value)}><option>All regions</option><option>India</option><option>Remote</option><option>United States</option><option>Europe</option></select></label>
          <label>Date posted<select value={postedWithin} onChange={event=>setPostedWithin(event.target.value)}><option>Any time</option><option>24 hours</option><option>7 days</option><option>30 days</option></select></label>
          <label>Experience<select value={experience} onChange={event=>setExperience(event.target.value)}><option>Any experience</option><option>Fresher / Internship</option><option>0–2 years</option><option>2–5 years</option><option>5–10 years</option><option>10+ years</option></select></label>
          <label>Source<select value={source} onChange={event=>setSource(event.target.value)}>{sources.map(item=><option key={item}>{item}</option>)}</select></label>
          <label>Minimum salary (number)<input type="number" min="0" value={minSalary} onChange={event=>setMinSalary(event.target.value)} placeholder="e.g. 500000"/></label>
          <label>Maximum salary (number)<input type="number" min="0" value={maxSalary} onChange={event=>setMaxSalary(event.target.value)} placeholder="e.g. 1500000"/></label>
          <button type="button" className="feature-secondary" onClick={()=>{setCategory("All categories");setRegion("All regions");setPostedWithin("Any time");setExperience("Any experience");setSource("All sources");setMinSalary("");setMaxSalary("");}}>Clear filters</button>
        </div>
        {notice && <p className="feature-notice" role="status">{notice}</p>}
        {loading && <p className="feature-notice">Searching connected job feeds…</p>}
        <section className="opportunity-list">
          {visibleJobs.map(job=><article className="opportunity-card" key={job.id}>
            <div className="opportunity-meta"><span>{job.source}</span><span className="job-category-label">{getJobCategory(job)}</span><time>{job.postedAt ? new Date(job.postedAt).toLocaleDateString() : "Date not provided"}</time></div>
            <h2>{job.title}</h2><strong>{job.company}</strong>
            <p>{job.description || "Open the original listing to view the complete job description."}</p>
            <div className="opportunity-footer"><span><MapPin size={14}/> {job.location}{job.remote ? " · Remote" : ""}</span>{job.salary && <span>{job.salary}</span>}<a href={job.url} target="_blank" rel="noopener noreferrer">View &amp; apply <ExternalLink size={14}/></a></div>
            {job.tags.length>0 && <div className="job-tags">{job.tags.slice(0,5).map(tag=><span key={tag}>{tag}</span>)}</div>}
          </article>)}
        </section>
        {!loading && visibleJobs.length===0 && <div className="empty-state"><BriefcaseBusiness size={24}/><strong>No jobs to show</strong><span>Change your search or filters, or open a job board below.</span></div>}
        {lastUpdated && <p className="feature-notice">Last refreshed {new Date(lastUpdated).toLocaleTimeString()} · Live feeds: JobsForce India, Remotive, Arbeitnow, Remote OK and Jobicy.</p>}
        <p className="feature-notice">Listings are supplied by third parties. WorldConnect does not host vacancies; verify the employer, location and application details on the source website.</p>
      </section>

      <section className="feature-section" aria-labelledby="boards-heading">
        <h2 id="boards-heading"><Globe2 size={18}/> Job-board directory</h2>
        <p className="feature-notice">Open a job board directly. These links do not imply an API partnership or automatic access to its listings.</p>
        <div className="job-board-grid">
          {boards.map(board=><a className="job-board-card" href={board.url} target="_blank" rel="noopener noreferrer" key={board.name}>
            <span><strong>{board.name.trim()}</strong><small>{board.region} · {board.kind}</small></span><ExternalLink size={16}/>
          </a>)}
        </div>
      </section>
    </main>
  );
}
