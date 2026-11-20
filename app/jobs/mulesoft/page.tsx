"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, ExternalLink, MapPin, RefreshCw, Search, Clock3, Layers3 } from "lucide-react";
import "./mulesoft.css";

type MuleJob = {
  id: string; title: string; company: string; location: string; remote: boolean;
  description: string; url: string; postedAt: string | null; source: string;
  tags: string[]; salary: string | null; experience: string;
  indiaRelevance: "India role" | "Remote - India eligibility to verify";
};
type ProviderDiagnostic = { provider: string; fetched: number; matched: number; available: boolean };
type ResponseData = { jobs: MuleJob[]; errors: string[]; diagnostics?: ProviderDiagnostic[]; updatedAt: string | null; persisted?: boolean; setupNotice?: string };

const cities = ["All India", "Hyderabad", "Bengaluru", "Pune", "Chennai", "Mumbai", "Remote"];

export default function MuleSoftJobsPage() {
  const [jobs, setJobs] = useState<MuleJob[]>([]);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("All India");
  const [age, setAge] = useState("Any time");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [persisted, setPersisted] = useState(false);
  const [diagnostics, setDiagnostics] = useState<ProviderDiagnostic[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setNotice("");
    try {
      const params = new URLSearchParams();
      if (city !== "All India") params.set("location", city);
      const response = await fetch("/api/jobs/mulesoft?" + params.toString(), { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load the MuleSoft openings feed.");
      const data = await response.json() as ResponseData;
      setJobs(data.jobs || []); setUpdatedAt(data.updatedAt || ""); setPersisted(Boolean(data.persisted)); setDiagnostics(data.diagnostics || []);
      const messages = [...(data.errors || []), data.setupNotice || ""].filter(Boolean);
      setNotice(messages.slice(0, 2).join(" "));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "MuleSoft jobs could not be loaded.");
    } finally { setLoading(false); }
  }, [city]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const interval = window.setInterval(() => { void load(); }, 10 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [load]);

  const visible = useMemo(() => jobs.filter(job => {
    const text = [job.title, job.company, job.description, job.location, ...job.tags].join(" ").toLowerCase();
    const posted = job.postedAt ? Date.parse(job.postedAt) : NaN;
    const days = Number.isFinite(posted) ? (Date.now() - posted) / 86400000 : Infinity;
    const ageOk = age === "Any time" || (Number.isFinite(posted) && days <= (age === "24 hours" ? 1 : age === "7 days" ? 7 : 30));
    return (!query || text.includes(query.toLowerCase())) && ageOk;
  }), [jobs, query, age]);

  const indiaCount = jobs.filter(job => job.indiaRelevance === "India role").length;
  const remoteCount = jobs.length - indiaCount;

  return <main className="feature-page mulesoft-page">
    <Link href="/jobs" className="feature-back"><ArrowLeft size={16}/> Back to Job Hub</Link>
    <header className="feature-heading"><span><BriefcaseBusiness size={22}/></span><div><h1>MuleSoft openings</h1><p>Dedicated integration-career feed across India and remote roles. Listings link back to their original job source.</p></div></header>
    <section className="mulesoft-summary">
      <article><span>Total matching openings</span><strong>{jobs.length}</strong></article>
      <article><span>India-based roles</span><strong>{indiaCount}</strong></article>
      <article><span>Remote - eligibility to verify</span><strong>{remoteCount}</strong></article>
    </section>
    <section className="feature-section">
      <div className="mulesoft-toolbar">
        <label><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search MuleSoft Developer, API, Anypoint…"/></label>
        <label><MapPin size={15}/><select value={city} onChange={e=>setCity(e.target.value)}>{cities.map(item=><option key={item}>{item}</option>)}</select></label>
        <label><Clock3 size={15}/><select value={age} onChange={e=>setAge(e.target.value)}><option>Any time</option><option>24 hours</option><option>7 days</option><option>30 days</option></select></label>
        <button className="feature-secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Refresh</button>
      </div>
      <div className="feature-toolbar"><strong>{visible.length} openings shown</strong><span className="mulesoft-feed-state"><Layers3 size={14}/>{persisted ? "Saved feed" : "Live discovery"}</span></div>
      {notice && <p className="feature-notice" role="status">{notice}</p>}
      {diagnostics.length > 0 && <div className="feature-notice" aria-label="Job source diagnostics"><strong>Source health</strong><ul>{diagnostics.map(item=><li key={item.provider}>{item.provider}: {item.available ? "available" : "unavailable"} · {item.fetched} fetched · {item.matched} matched</li>)}</ul></div>}
      {loading && <p className="feature-notice">Searching MuleSoft-specific job sources…</p>}
      <div className="opportunity-list">
        {visible.map(job=><article className="opportunity-card" key={job.id}>
          <div className="opportunity-meta"><span>{job.source}</span><time>{job.postedAt ? new Date(job.postedAt).toLocaleDateString() : "Posting date not provided"}</time></div>
          <h2>{job.title}</h2><strong>{job.company || "Employer not listed"}</strong>
          <p>{job.description || "Open the original source for the full job description."}</p>
          <div className="mulesoft-job-facts">
            <span><MapPin size={14}/>{job.location}{job.remote ? " · Remote" : ""}</span>
            <span><BriefcaseBusiness size={14}/>{job.experience}</span>
            {job.salary && <span>{job.salary}</span>}
          </div>
          <div className="mulesoft-job-footer"><span className={job.indiaRelevance === "India role" ? "mulesoft-india-tag" : "mulesoft-remote-tag"}>{job.indiaRelevance}</span><a href={job.url} target="_blank" rel="noopener noreferrer">View original &amp; apply <ExternalLink size={14}/></a></div>
          {job.tags.length > 0 && <div className="job-tags">{job.tags.slice(0,5).map(tag=><span key={tag}>{tag}</span>)}</div>}
        </article>)}
      </div>
      {!loading && visible.length === 0 && <div className="empty-state"><BriefcaseBusiness size={24}/><strong>No MuleSoft openings found for this filter</strong><span>Try All India or a wider posting date. A provider may not expose all vacancies.</span></div>}
      {updatedAt && <p className="feature-notice">Last checked {new Date(updatedAt).toLocaleString()}.</p>}
      <p className="feature-notice">Listings are collected from public feeds supported by connected providers. Some employer portals (including login-only job boards) do not expose public feeds. Verify that each vacancy is still open and that remote roles accept applicants in India.</p>
    </section>
  </main>;
}
