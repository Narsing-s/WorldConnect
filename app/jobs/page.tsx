"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, ExternalLink, MapPin, RefreshCw, Search, Globe2 } from "lucide-react";

type Job = { id: string; title: string; company: string; location: string; remote: boolean; description: string; url: string; postedAt: string | null; source: string; tags: string[]; salary: string | null };
type SearchResponse = { jobs: Job[]; errors: string[]; updatedAt: string; sources?: string[] };
type Board = { name: string; url: string; region: string; kind: string };

const boards: Board[] = [
  { name: "Naukri", url: "https://www.naukri.com/", region: "India", kind: "All roles" },
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

export default function JobsPage() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [source, setSource] = useState("All sources");
  const [region, setRegion] = useState("All regions");

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
  function searchJobs(event?: FormEvent) { event?.preventDefault(); void loadJobs(query, location); }

  const visibleJobs = useMemo(() => jobs.filter(job =>
    (source === "All sources" || job.source === source) &&
    (region === "All regions" || (region === "Remote" ? job.remote : job.location.toLowerCase().includes(region.toLowerCase()) || job.location.toLowerCase().includes("worldwide")))
  ), [jobs, source, region]);
  const sources = useMemo(() => ["All sources", ...Array.from(new Set(jobs.map(job => job.source))).sort()], [jobs]);

  return (
    <main className="feature-page">
      <Link href="/" className="feature-back"><ArrowLeft size={16}/> WorldConnect</Link>
      <header className="feature-heading"><span><BriefcaseBusiness size={22}/></span><div><h1>WorldConnect Job Hub</h1><p>Search live job feeds and open trusted job boards from one place.</p></div></header>

      <section className="feature-section" aria-labelledby="live-jobs-heading">
        <h2 id="live-jobs-heading"><Search size={18}/> Live job search</h2>
        <form className="feature-form jobs-search-form" onSubmit={searchJobs}>
          <label>Role, skill or keyword<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="e.g. MuleSoft Developer, React, Data Analyst"/></label>
          <label>Location<input value={location} onChange={event=>setLocation(event.target.value)} placeholder="e.g. India, Hyderabad, Remote"/></label>
          <button className="feature-primary" disabled={loading}><Search size={16}/> Search jobs</button>
        </form>
        <div className="feature-toolbar"><strong>{visibleJobs.length} matching jobs</strong><button className="feature-secondary" onClick={()=>searchJobs()} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>
        <div className="jobs-filters">
          <label>Source<select value={source} onChange={event=>setSource(event.target.value)}>{sources.map(item=><option key={item}>{item}</option>)}</select></label>
          <label>Location type<select value={region} onChange={event=>setRegion(event.target.value)}><option>All regions</option><option>Remote</option><option>India</option><option>United States</option><option>Europe</option></select></label>
        </div>
        {notice && <p className="feature-notice" role="status">{notice}</p>}
        {loading && <p className="feature-notice">Searching connected job feeds…</p>}
        <section className="opportunity-list">
          {visibleJobs.map(job=><article className="opportunity-card" key={job.id}>
            <div className="opportunity-meta"><span>{job.source}</span><time>{job.postedAt ? new Date(job.postedAt).toLocaleDateString() : "Date not provided"}</time></div>
            <h2>{job.title}</h2><strong>{job.company}</strong>
            <p>{job.description || "Open the original listing to view the complete job description."}</p>
            <div className="opportunity-footer"><span><MapPin size={14}/> {job.location}{job.remote ? " · Remote" : ""}</span>{job.salary && <span>{job.salary}</span>}<a href={job.url} target="_blank" rel="noopener noreferrer">View &amp; apply <ExternalLink size={14}/></a></div>
            {job.tags.length>0 && <div className="job-tags">{job.tags.slice(0,5).map(tag=><span key={tag}>{tag}</span>)}</div>}
          </article>)}
        </section>
        {!loading && visibleJobs.length===0 && <div className="empty-state"><BriefcaseBusiness size={24}/><strong>No jobs to show</strong><span>Change your search or filters, or open a job board below.</span></div>}
        {lastUpdated && <p className="feature-notice">Last refreshed {new Date(lastUpdated).toLocaleTimeString()} · Live feeds: Remotive, Arbeitnow, Remote OK and Jobicy.</p>}
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
