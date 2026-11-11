"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, ExternalLink, MapPin, RefreshCw, Search } from "lucide-react";

type Job = { id: string; title: string; company: string; location: string; remote: boolean; description: string; url: string; postedAt: string | null; source: string; tags: string[]; salary: string | null };
type SearchResponse = { jobs: Job[]; errors: string[]; updatedAt: string };

export default function JobsPage() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const loadJobs = useCallback(async (searchTerm: string, searchLocation: string) => {
    setLoading(true);
    setNotice("");
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set("q", searchTerm.trim());
      if (searchLocation.trim()) params.set("location", searchLocation.trim());
      const response = await fetch(`/api/jobs?${params.toString()}`);
      if (!response.ok) throw new Error("Job providers could not be reached. Please try again.");
      const data = await response.json() as SearchResponse;
      setJobs(data.jobs || []);
      setLastUpdated(data.updatedAt || "");
      if (!data.jobs?.length) setNotice(data.errors?.length ? data.errors.join(" ") : "No matching jobs found. Try a broader keyword or location.");
      else if (data.errors?.length) setNotice(data.errors.join(" "));
    } catch (error) {
      setJobs([]);
      setNotice(error instanceof Error ? error.message : "Could not load jobs.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadJobs("", ""); }, [loadJobs]);

  function searchJobs(event?: FormEvent) {
    event?.preventDefault();
    void loadJobs(query, location);
  }

  return (
    <main className="feature-page">
      <Link href="/" className="feature-back"><ArrowLeft size={16}/> WorldConnect</Link>
      <header className="feature-heading"><span><BriefcaseBusiness size={22}/></span><div><h1>Find jobs</h1><p>Search live listings from external job boards. Apply on the original provider website.</p></div></header>
      <form className="feature-form jobs-search-form" onSubmit={searchJobs}>
        <label>Role, skill or keyword<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="e.g. MuleSoft Developer, React, Data Analyst"/></label>
        <label>Location<input value={location} onChange={event=>setLocation(event.target.value)} placeholder="e.g. India, Hyderabad, Remote"/></label>
        <button className="feature-primary" disabled={loading}><Search size={16}/> Search jobs</button>
      </form>
      <div className="feature-toolbar"><strong>{jobs.length} matching jobs</strong><button className="feature-secondary" onClick={()=>searchJobs()} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>
      {notice && <p className="feature-notice" role="status">{notice}</p>}
      {loading && <p className="feature-notice">Searching connected job boards…</p>}
      <section className="opportunity-list">
        {jobs.map(job=><article className="opportunity-card" key={job.id}>
          <div className="opportunity-meta"><span>{job.source}</span><time>{job.postedAt ? new Date(job.postedAt).toLocaleDateString() : "Date not provided"}</time></div>
          <h2>{job.title}</h2><strong>{job.company}</strong>
          <p>{job.description || "Open the original listing to view the complete job description."}</p>
          <div className="opportunity-footer"><span><MapPin size={14}/> {job.location}{job.remote ? " · Remote" : ""}</span>{job.salary && <span>{job.salary}</span>}<a href={job.url} target="_blank" rel="noopener noreferrer">View & apply <ExternalLink size={14}/></a></div>
          {job.tags.length>0 && <div className="job-tags">{job.tags.slice(0,5).map(tag=><span key={tag}>{tag}</span>)}</div>}
        </article>)}
      </section>
      {!loading && jobs.length===0 && <div className="empty-state"><BriefcaseBusiness size={24}/><strong>No jobs to show</strong><span>Change your search terms or try Remote.</span></div>}
      {lastUpdated && <p className="feature-notice">Last refreshed {new Date(lastUpdated).toLocaleTimeString()} · Listings are provided by Remotive and Arbeitnow.</p>}
      <p className="feature-notice">WorldConnect does not host these vacancies. Always verify the employer and application details on the source website.</p>
    </main>
  );
}
