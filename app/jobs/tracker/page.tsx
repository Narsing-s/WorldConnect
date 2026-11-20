"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, CalendarClock, ExternalLink, LoaderCircle, Plus, RefreshCw, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import "./tracker.css";

const OWNER_EMAIL = "narsingbeesetti006@gmail.com";
const statuses = [
  ["saved", "Saved"], ["applied", "Applied"], ["assessment", "Assessment"],
  ["interview", "Interview"], ["selected", "Selected"], ["offer", "Offer"],
  ["rejected", "Rejected"], ["withdrawn", "Withdrawn"],
] as const;

type Application = {
  id: string; status: string; notes: string; follow_up_at: string | null;
  interview_at: string | null; applied_at: string | null; updated_at: string;
  company_name: string; job_title: string; location: string; application_url: string;
  wc_jobs?: { title: string; company: string; location: string; application_url: string } | null;
};

const dateInput = (value: string | null) => value ? value.slice(0, 10) : "";
const toIso = (value: string) => value ? new Date(value + "T12:00:00").toISOString() : null;

export default function JobTrackerPage() {
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [allowed, setAllowed] = useState(false);
  const [email, setEmail] = useState("");
  const [form, setForm] = useState({ company_name: "", job_title: "", location: "Hyderabad, India", status: "applied", applied_at: new Date().toISOString().slice(0, 10), application_url: "", interview_at: "", follow_up_at: "", notes: "" });
  const supabase = useMemo(() => createClient(), []);

  const load = useCallback(async () => {
    if (!supabase) { setError("WorldConnect backend is not connected."); setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const signedEmail = (user?.email || "").toLowerCase();
    setEmail(signedEmail);
    if (signedEmail !== OWNER_EMAIL) { setAllowed(false); setLoading(false); setError(user ? "This private career workspace is restricted to its owner account." : "Please sign in with the owner account to continue."); return; }
    setAllowed(true);
    const { data, error: queryError } = await supabase.from("wc_job_applications")
      .select("id,status,notes,follow_up_at,interview_at,applied_at,updated_at,company_name,job_title,location,application_url,wc_jobs(title,company,location,application_url)")
      .order("updated_at", { ascending: false });
    if (queryError) setError("Could not load the private tracker. Apply the private career tracker SQL migration in Supabase first.");
    else { setItems((data || []) as unknown as Application[]); setError(""); }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  async function addApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !allowed) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || (user.email || "").toLowerCase() !== OWNER_EMAIL) { setError("Owner account verification failed."); return; }
    setBusyId("new"); setError(""); setNotice("");
    const { error: insertError } = await supabase.from("wc_job_applications").insert({
      user_id: user.id, job_external_id: null, ...form,
      applied_at: toIso(form.applied_at), interview_at: toIso(form.interview_at),
      follow_up_at: toIso(form.follow_up_at), reminder_email: OWNER_EMAIL
    });
    if (insertError) setError(insertError.message);
    else {
      setNotice("Application added to your private tracker.");
      setForm({ company_name: "", job_title: "", location: "Hyderabad, India", status: "applied", applied_at: new Date().toISOString().slice(0, 10), application_url: "", interview_at: "", follow_up_at: "", notes: "" });
      await load();
    }
    setBusyId("");
  }

  async function updateItem(item: Application, changes: Partial<Application>) {
    if (!supabase || !allowed) return;
    setBusyId(item.id); setError(""); setNotice("");
    const { error: updateError } = await supabase.from("wc_job_applications").update(changes).eq("id", item.id);
    if (updateError) setError(updateError.message);
    else { setNotice("Application updated."); await load(); }
    setBusyId("");
  }

  async function removeItem(item: Application) {
    if (!supabase || !allowed || !window.confirm("Remove this application from your tracker?")) return;
    setBusyId(item.id);
    const { error: deleteError } = await supabase.from("wc_job_applications").delete().eq("id", item.id);
    if (deleteError) setError(deleteError.message);
    else { setItems(current => current.filter(entry => entry.id !== item.id)); setNotice("Application removed."); }
    setBusyId("");
  }

  const count = (status: string) => items.filter(item => item.status === status).length;
  const companies = new Set(items.map(item => (item.company_name || item.wc_jobs?.company || "").trim().toLowerCase()).filter(Boolean)).size;
  const displayCompany = (item: Application) => item.company_name || item.wc_jobs?.company || "Company not set";
  const displayTitle = (item: Application) => item.job_title || item.wc_jobs?.title || "Position not set";

  return <main className="feature-page career-tracker">
    <Link href="/jobs" className="feature-back"><ArrowLeft size={16}/> Back to Job Hub</Link>
    <header className="feature-heading"><span><BriefcaseBusiness size={22}/></span><div><h1>My Private Career Tracker</h1><p>Personal job-search dashboard. Only the owner account can access these records.</p></div></header>
    {!allowed && !loading && <section className="feature-section"><p className="feature-notice" role="alert">{error}</p><p>Sign in using <strong>{OWNER_EMAIL}</strong> to open this private workspace.</p><Link className="feature-primary" href="/login">Sign in</Link></section>}
    {allowed && <>
      <div className="career-owner-note">Private workspace · {email}</div>
      <section className="career-stats" aria-label="Application summary">
        <article><span>Total applications</span><strong>{items.length}</strong></article>
        <article><span>Companies</span><strong>{companies}</strong></article>
        <article><span>Interviews</span><strong>{count("interview")}</strong></article>
        <article><span>Offers / selected</span><strong>{count("offer") + count("selected")}</strong></article>
      </section>
      <section className="feature-section">
        <h2><Plus size={18}/> Add a job application</h2>
        <form className="career-form" onSubmit={addApplication}>
          <label>Company name<input required maxLength={160} value={form.company_name} onChange={e=>setForm({...form,company_name:e.target.value})} placeholder="e.g. TCS, Accenture"/></label>
          <label>Job position<input required maxLength={160} value={form.job_title} onChange={e=>setForm({...form,job_title:e.target.value})} placeholder="e.g. MuleSoft Developer"/></label>
          <label>Location<input maxLength={160} value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label>
          <label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{statuses.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
          <label>Applied date<input type="date" value={form.applied_at} onChange={e=>setForm({...form,applied_at:e.target.value})}/></label>
          <label>Interview date<input type="date" value={form.interview_at} onChange={e=>setForm({...form,interview_at:e.target.value})}/></label>
          <label>Follow-up date<input type="date" value={form.follow_up_at} onChange={e=>setForm({...form,follow_up_at:e.target.value})}/></label>
          <label>Job link (optional)<input type="url" value={form.application_url} onChange={e=>setForm({...form,application_url:e.target.value})} placeholder="https://…"/></label>
          <label className="career-notes">Notes<textarea rows={2} maxLength={4000} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Recruiter, salary, interview round, next steps…"/></label>
          <button className="feature-primary" disabled={busyId==="new"}>{busyId==="new" ? <LoaderCircle size={16}/> : <Plus size={16}/>} Add application</button>
        </form>
      </section>
      <section className="feature-section">
        <div className="feature-toolbar"><h2>Application history</h2><button className="feature-secondary" onClick={()=>{setLoading(true);void load();}} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>
        {error && <p className="feature-notice" role="alert">{error}</p>}
        {notice && <p className="feature-notice" role="status">{notice}</p>}
        {loading && <p className="feature-notice"><LoaderCircle className="auth-spin" size={16}/> Loading applications…</p>}
        {!loading && items.length===0 && <div className="empty-state"><BriefcaseBusiness size={24}/><strong>No applications recorded yet</strong><span>Add your first company and position above. Your totals will update automatically.</span></div>}
        <div className="opportunity-list">{items.map(item=><article className="opportunity-card" key={item.id}>
          <div className="opportunity-meta"><span>{item.location || item.wc_jobs?.location || "Location not set"}</span><time>Updated {new Date(item.updated_at).toLocaleDateString()}</time></div>
          <h2>{displayTitle(item)}</h2><strong>{displayCompany(item)}</strong>
          <div className="career-inline-fields">
            <label>Status<select value={item.status} disabled={busyId===item.id} onChange={e=>void updateItem(item,{status:e.target.value})}>{statuses.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
            <label>Applied<input type="date" value={dateInput(item.applied_at)} disabled={busyId===item.id} onChange={e=>void updateItem(item,{applied_at:toIso(e.target.value)})}/></label>
            <label>Interview<input type="date" value={dateInput(item.interview_at)} disabled={busyId===item.id} onChange={e=>void updateItem(item,{interview_at:toIso(e.target.value)})}/></label>
            <label>Follow-up<input type="date" value={dateInput(item.follow_up_at)} disabled={busyId===item.id} onChange={e=>void updateItem(item,{follow_up_at:toIso(e.target.value)})}/></label>
          </div>
          <label className="career-notes">Notes<textarea rows={2} defaultValue={item.notes} disabled={busyId===item.id} onBlur={e=>{if(e.target.value!==item.notes)void updateItem(item,{notes:e.target.value});}}/></label>
          <div className="opportunity-footer">{(item.application_url || item.wc_jobs?.application_url) && <a href={item.application_url || item.wc_jobs?.application_url || "#"} target="_blank" rel="noopener noreferrer">Open job link <ExternalLink size={14}/></a>}<button className="feature-secondary" disabled={busyId===item.id} onClick={()=>void removeItem(item)}><Trash2 size={14}/> Remove</button></div>
        </article>)}</div>
      </section>
      <section className="feature-section career-email-info"><h2><CalendarClock size={18}/> Email reminders</h2><p>Reminder destination: <strong>{OWNER_EMAIL}</strong>. Interview and follow-up dates are saved in your tracker. Automatic email delivery still needs a configured mail provider and scheduled sender; it is not activated yet.</p></section>
    </>}
  </main>;
}
