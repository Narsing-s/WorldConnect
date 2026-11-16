"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, CalendarClock, ExternalLink, LoaderCircle, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase";

type Application = {
  id: string;
  job_external_id: string;
  status: string;
  notes: string;
  follow_up_at: string | null;
  interview_at: string | null;
  applied_at: string | null;
  updated_at: string;
  wc_jobs: {
    title: string;
    company: string;
    location: string;
    application_url: string;
    source: string;
    status: string;
  } | null;
};

const statuses = [
  ["saved", "Saved"],
  ["applied", "Applied"],
  ["interview", "Interview"],
  ["offer", "Offer"],
  ["rejected", "Rejected"],
  ["withdrawn", "Withdrawn"],
] as const;

export default function JobTrackerPage() {
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setError("Connect Supabase to use your private job tracker.");
      setLoading(false);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Please sign in to view your saved jobs and applications.");
      setLoading(false);
      return;
    }
    const { data, error: queryError } = await supabase
      .from("wc_job_applications")
      .select("id,job_external_id,status,notes,follow_up_at,interview_at,applied_at,updated_at,wc_jobs(title,company,location,application_url,source,status)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (queryError) setError("Could not load your tracker. Apply the job tracker SQL migration in Supabase and try again.");
    else {
      setItems((data || []) as unknown as Application[]);
      setError("");
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function updateItem(item: Application, changes: Partial<Application>) {
    const supabase = createClient();
    if (!supabase) return;
    setBusyId(item.id);
    setError("");
    setNotice("");
    const { error: updateError } = await supabase
      .from("wc_job_applications")
      .update(changes)
      .eq("id", item.id);
    if (updateError) setError(updateError.message);
    else {
      setNotice("Application updated.");
      await load();
    }
    setBusyId("");
  }

  async function removeItem(item: Application) {
    const supabase = createClient();
    if (!supabase) return;
    setBusyId(item.id);
    const { error: deleteError } = await supabase
      .from("wc_job_applications")
      .delete()
      .eq("id", item.id);
    if (deleteError) setError(deleteError.message);
    else {
      setItems(current => current.filter(entry => entry.id !== item.id));
      setNotice("Job removed from your tracker.");
    }
    setBusyId("");
  }

  return (
    <main className="feature-page">
      <Link href="/jobs" className="feature-back"><ArrowLeft size={16}/> Back to Job Hub</Link>
      <header className="feature-heading">
        <span><BriefcaseBusiness size={22}/></span>
        <div><h1>My Job Tracker</h1><p>Keep saved vacancies, application progress and follow-up dates in one private place.</p></div>
      </header>
      <section className="feature-section">
        <div className="feature-toolbar">
          <strong>{items.length} saved {items.length === 1 ? "job" : "jobs"}</strong>
          <button className="feature-secondary" onClick={() => { setLoading(true); void load(); }} disabled={loading}>Refresh</button>
        </div>
        {error && <p className="feature-notice" role="alert">{error}</p>}
        {notice && <p className="feature-notice" role="status">{notice}</p>}
        {loading && <p className="feature-notice"><LoaderCircle className="auth-spin" size={16}/> Loading your tracker…</p>}
        {!loading && !error && items.length === 0 && (
          <div className="empty-state"><BriefcaseBusiness size={24}/><strong>Your tracker is empty</strong><span>Open Job Hub and save a vacancy to start tracking it here.</span><Link className="feature-primary" href="/jobs">Explore jobs</Link></div>
        )}
        <div className="opportunity-list">
          {items.map(item => (
            <article className="opportunity-card" key={item.id}>
              <div className="opportunity-meta"><span>{item.wc_jobs?.source || "Job listing"}</span><time>Updated {new Date(item.updated_at).toLocaleDateString()}</time></div>
              <h2>{item.wc_jobs?.title || "Listing no longer available"}</h2>
              <strong>{item.wc_jobs?.company || "Company unavailable"}</strong>
              <p>{item.wc_jobs?.location || "Location not available"}</p>
              <div className="jobs-filters">
                <label>Application status
                  <select value={item.status} disabled={busyId === item.id} onChange={event => void updateItem(item, { status: event.target.value })}>
                    {statuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                  </select>
                </label>
                <label>Applied date
                  <input type="date" value={item.applied_at ? item.applied_at.slice(0, 10) : ""} disabled={busyId === item.id} onChange={event => void updateItem(item, { applied_at: event.target.value ? new Date(event.target.value + "T12:00:00").toISOString() : null })}/>
                </label>
                <label>Follow-up date
                  <input type="date" value={item.follow_up_at ? item.follow_up_at.slice(0, 10) : ""} disabled={busyId === item.id} onChange={event => void updateItem(item, { follow_up_at: event.target.value ? new Date(event.target.value + "T12:00:00").toISOString() : null })}/>
                </label>
                <label>Interview date
                  <input type="date" value={item.interview_at ? item.interview_at.slice(0, 10) : ""} disabled={busyId === item.id} onChange={event => void updateItem(item, { interview_at: event.target.value ? new Date(event.target.value + "T12:00:00").toISOString() : null })}/>
                </label>
                <label>Private notes
                  <textarea rows={2} maxLength={4000} defaultValue={item.notes} disabled={busyId === item.id} onBlur={event => { if (event.target.value !== item.notes) void updateItem(item, { notes: event.target.value }); }}/>
                </label>
              </div>
              <div className="opportunity-footer">
                {item.wc_jobs?.application_url && <a href={item.wc_jobs.application_url} target="_blank" rel="noopener noreferrer">Open original listing <ExternalLink size={14}/></a>}
                <button className="feature-secondary" disabled={busyId === item.id} onClick={() => void removeItem(item)}><Trash2 size={14}/> Remove</button>
              </div>
            </article>
          ))}
        </div>
      </section>
      <p className="feature-notice"><CalendarClock size={14}/> Your notes and application details are visible only to your account.</p>
    </main>
  );
}
