"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, ShieldAlert, UserRoundX, Flag, LoaderCircle, Ban } from "lucide-react";
import { createClient } from "@/lib/supabase";
import "./safety.css";

type BlockedMember = { blocked_user_id: string; created_at: string; profile?: { username: string | null; display_name: string | null } | null };
type Report = { id: string; target_type: string; target_id: string; reason: string; status: string; created_at: string };

export default function SafetyPage() {
  const [userId, setUserId] = useState("");
  const [username, setUsername] = useState("");
  const [blocked, setBlocked] = useState<BlockedMember[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [targetType, setTargetType] = useState("profile");
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async (id: string) => {
    const supabase = createClient();
    if (!supabase) return;
    const [blockResult, reportResult] = await Promise.all([
      supabase.from("wc_user_blocks").select("blocked_user_id,created_at").eq("blocker_id", id).order("created_at", { ascending: false }),
      supabase.from("wc_content_reports").select("id,target_type,target_id,reason,status,created_at").eq("reporter_id", id).order("created_at", { ascending: false }).limit(50),
    ]);
    if (blockResult.error || reportResult.error) {
      setError(blockResult.error?.message || reportResult.error?.message || "Could not load safety settings.");
      return;
    }
    const rows = (blockResult.data || []) as BlockedMember[];
    const ids = rows.map((row) => row.blocked_user_id);
    const profiles = ids.length ? await supabase.from("wc_profiles").select("id,username,display_name").in("id", ids) : { data: [] };
    setBlocked(rows.map((row) => ({ ...row, profile: profiles.data?.find((profile) => profile.id === row.blocked_user_id) || null })));
    setReports((reportResult.data || []) as Report[]);
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      const supabase = createClient();
      if (!supabase) { setError("Connect Supabase and apply the safety migration to enable these controls."); setLoading(false); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      if (!active) return;
      setUserId(user.id);
      await refresh(user.id);
      if (active) setLoading(false);
    }
    void init();
    return () => { active = false; };
  }, [refresh]);

  async function blockMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setNotice("");
    const value = username.trim().replace(/^@/, "");
    if (!value) { setError("Enter the member's username."); return; }
    const supabase = createClient(); if (!supabase || !userId) return;
    setBusy(true);
    const found = await supabase.from("wc_profiles").select("id,username").eq("username", value).maybeSingle();
    if (found.error || !found.data) { setError(found.error?.message || "No member found with that username."); setBusy(false); return; }
    if (found.data.id === userId) { setError("You cannot block your own account."); setBusy(false); return; }
    const result = await supabase.from("wc_user_blocks").insert({ blocker_id: userId, blocked_user_id: found.data.id });
    if (result.error) setError(result.error.code === "23505" ? "This member is already blocked." : result.error.message);
    else { setUsername(""); setNotice("Member blocked. You can unblock them below."); await refresh(userId); }
    setBusy(false);
  }

  async function unblock(id: string) {
    const supabase = createClient(); if (!supabase) return;
    setError(""); setNotice("");
    const result = await supabase.from("wc_user_blocks").delete().eq("blocker_id", userId).eq("blocked_user_id", id);
    if (result.error) setError(result.error.message);
    else { setNotice("Member unblocked."); await refresh(userId); }
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setNotice("");
    if (!targetId.trim()) { setError("Enter the ID or username of the item you are reporting."); return; }
    const supabase = createClient(); if (!supabase || !userId) return;
    setBusy(true);
    const result = await supabase.from("wc_content_reports").insert({
      reporter_id: userId, target_type: targetType, target_id: targetId.trim(), reason, details: details.trim(),
    });
    if (result.error) setError(result.error.message);
    else { setTargetId(""); setDetails(""); setNotice("Report submitted. Thank you for helping keep WorldConnect safe."); await refresh(userId); }
    setBusy(false);
  }

  return (
    <main className="feature-page safety-page">
      <Link href="/privacy" className="feature-back"><ArrowLeft size={16} /> Privacy and data safety</Link>
      <header className="feature-heading">
        <span><ShieldCheck size={22} /></span>
        <div><h1>Safety centre</h1><p>Manage blocked members and report content that may violate community guidelines.</p></div>
      </header>

      {notice && <p className="safety-notice" role="status">{notice}</p>}
      {error && <p className="safety-error" role="alert">{error}</p>}
      {loading ? <p className="safety-muted"><LoaderCircle className="safety-spin" size={17} /> Loading your safety settings…</p> : (
        <>
          <section className="opportunity-card safety-card">
            <h2><UserRoundX size={18} /> Block a member</h2>
            <p>Blocking now applies at the database access layer: signed-in members on either side of a block cannot discover each other's profiles, posts, comments, reactions, follows, community memberships, opportunities, notifications or direct conversations. Blocking does not delete existing content or guarantee removal of previously shared public media URLs.</p>
            <form onSubmit={blockMember} className="safety-form">
              <label htmlFor="block-username">Member username</label>
              <div className="safety-inline"><input id="block-username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="e.g. username" maxLength={30} /><button disabled={busy}>{busy ? "Please wait…" : "Block member"}</button></div>
            </form>
            <h3>Blocked members ({blocked.length})</h3>
            {blocked.length ? <ul className="safety-list">{blocked.map((member) => <li key={member.blocked_user_id}><span><strong>{member.profile?.display_name || member.profile?.username || "WorldConnect member"}</strong><small>@{member.profile?.username || "member"}</small></span><button type="button" className="safety-secondary" onClick={() => void unblock(member.blocked_user_id)}>Unblock</button></li>)}</ul> : <p className="safety-muted">You have not blocked anyone.</p>}
          </section>

          <section className="opportunity-card safety-card">
            <h2><Flag size={18} /> Report content or a member</h2>
            <p>Submit a report for review. Include a clear item ID or username so a reviewer can locate it. Do not include passwords, identity documents or other sensitive information.</p>
            <form onSubmit={submitReport} className="safety-form">
              <label htmlFor="report-type">What are you reporting?</label>
              <select id="report-type" value={targetType} onChange={(event) => setTargetType(event.target.value)}>
                <option value="profile">Member profile</option><option value="post">Post</option><option value="comment">Comment</option><option value="message">Message</option><option value="job">Job listing</option><option value="community">Community</option>
              </select>
              <label htmlFor="report-id">Item ID or username</label>
              <input id="report-id" value={targetId} onChange={(event) => setTargetId(event.target.value)} placeholder="Paste the item ID or username" maxLength={160} required />
              <label htmlFor="report-reason">Reason</label>
              <select id="report-reason" value={reason} onChange={(event) => setReason(event.target.value)}>
                <option value="spam">Spam</option><option value="harassment">Harassment or bullying</option><option value="scam_or_fraud">Scam or fraudulent job</option><option value="misinformation">Misleading information</option><option value="inappropriate_content">Inappropriate content</option><option value="impersonation">Impersonation</option><option value="other">Other</option>
              </select>
              <label htmlFor="report-details">Additional details (optional)</label>
              <textarea id="report-details" value={details} onChange={(event) => setDetails(event.target.value)} rows={4} maxLength={2000} placeholder="Explain what happened (up to 2,000 characters)." />
              <button disabled={busy}>{busy ? "Submitting…" : "Submit report"}</button>
            </form>
          </section>

          <section className="opportunity-card safety-card">
            <h2><ShieldAlert size={18} /> Your submitted reports ({reports.length})</h2>
            {reports.length ? <ul className="safety-list">{reports.map((report) => <li key={report.id}><span><strong>{report.target_type} · {report.reason.replaceAll("_", " ")}</strong><small>Reference: {report.target_id} · {new Date(report.created_at).toLocaleDateString()}</small></span><span className="safety-status">{report.status}</span></li>)}</ul> : <p className="safety-muted">You have not submitted any reports.</p>}
          </section>
        </>
      )}
      <p className="safety-footnote"><Ban size={14} /> Blocking is enforced for authenticated app queries and direct-chat access. Existing content is retained, and previously shared public media URLs may remain accessible to anyone who already has the URL.</p>
    </main>
  );
}
