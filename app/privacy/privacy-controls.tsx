"use client";

import { useEffect, useState } from "react";
import { Download, FileJson, LoaderCircle, ShieldCheck, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import "./privacy.css";

type ExportTable = {
  name: string;
  load: (supabase: ReturnType<typeof createClient>, userId: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
};

const exportTables: ExportTable[] = [
  { name: "profile", load: (db, id) => db!.from("wc_profiles").select("*").eq("id", id) },
  { name: "posts", load: (db, id) => db!.from("wc_posts").select("*").eq("author_id", id) },
  { name: "comments", load: (db, id) => db!.from("wc_comments").select("*").eq("author_id", id) },
  { name: "likes", load: (db, id) => db!.from("wc_post_likes").select("*").eq("user_id", id) },
  { name: "follows", load: (db, id) => db!.from("wc_follows").select("*").or(`follower_id.eq.${id},following_id.eq.${id}`) },
  { name: "blocked_members", load: (db, id) => db!.from("wc_user_blocks").select("*").eq("blocker_id", id) },
  { name: "content_reports", load: (db, id) => db!.from("wc_content_reports").select("*").eq("reporter_id", id) },
  { name: "job_applications", load: (db, id) => db!.from("wc_job_applications").select("*").eq("user_id", id) },
  { name: "candidate_preferences", load: (db, id) => db!.from("wc_candidate_preferences").select("*").eq("user_id", id) },
  { name: "career_workspace", load: (db, id) => db!.from("wc_career_workspaces").select("*").eq("user_id", id) },
  { name: "portfolio_entries", load: (db, id) => db!.from("wc_portfolio_entries").select("*").eq("user_id", id) },
  { name: "community_memberships", load: (db, id) => db!.from("wc_community_members").select("*").eq("user_id", id) },
  { name: "employer_applications_as_candidate", load: (db, id) => db!.from("wc_employer_applications").select("*").eq("candidate_id", id) },
  { name: "profile_sharing_consents", load: (db, id) => db!.from("wc_candidate_profile_consents").select("*").eq("candidate_id", id) },
];

export default function PrivacyControls() {
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadUser() {
      const db = createClient();
      if (!db) {
        if (active) { setError("Connect Supabase to use account privacy controls."); setLoading(false); }
        return;
      }
      const { data, error: authError } = await db.auth.getUser();
      if (!active) return;
      if (authError || !data.user) {
        setError("Sign in to export or manage your private career data.");
      } else {
        setUserId(data.user.id);
        setEmail(data.user.email || "");
      }
      setLoading(false);
    }
    void loadUser();
    return () => { active = false; };
  }, []);

  async function exportData() {
    const db = createClient();
    if (!db || !userId) { setError("Sign in before exporting your data."); return; }
    setBusy(true); setError(""); setNotice("");
    const payload: Record<string, unknown> = {
      product: "WorldConnect",
      exported_at: new Date().toISOString(),
      account: { id: userId, email },
      data: {},
    };
    const data = payload.data as Record<string, unknown>;
    const skipped: string[] = [];
    for (const table of exportTables) {
      const result = await table.load(db, userId);
      if (result.error) skipped.push(table.name);
      else data[table.name] = result.data || [];
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `worldconnect-data-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setNotice(skipped.length
      ? `Your export was downloaded. Some sections could not be read (often because a migration is not applied): ${skipped.join(", ")}. Check the Supabase setup before treating this as a complete export.`
      : "Your account data export has been downloaded.");
    setBusy(false);
  }

  async function deleteCareerWorkspace() {
    const db = createClient();
    if (!db || !userId) return;
    const confirmed = window.confirm("Delete your private Career Assistant workspace, including the resume text and target role saved there? This cannot be undone. This does not delete your account or job applications.");
    if (!confirmed) return;
    setBusy(true); setError(""); setNotice("");
    const result = await db.from("wc_career_workspaces").delete().eq("user_id", userId);
    if (result.error) setError(`Could not delete the career workspace: ${result.error.message}`);
    else setNotice("Your private Career Assistant workspace was deleted.");
    setBusy(false);
  }

  return (
    <section className="opportunity-card privacy-controls" aria-labelledby="privacy-controls-title">
      <h2 id="privacy-controls-title"><ShieldCheck size={18} /> Your data controls</h2>
      <p>Export the account data available to your signed-in session, or delete your private Career Assistant workspace. Database row-level security still controls which records can be included.</p>
      {notice && <p className="privacy-feedback" role="status">{notice}</p>}
      {error && <p className="privacy-feedback privacy-feedback-error" role="alert">{error}</p>}
      {loading ? <p className="privacy-muted"><LoaderCircle size={16} className="privacy-spin" /> Checking your account…</p> : userId ? (
        <>
          <div className="privacy-control-row">
            <span><FileJson size={19} /><span><strong>Download your data</strong><small>JSON export of profile, social activity, safety records and available career data.</small></span></span>
            <button type="button" onClick={() => void exportData()} disabled={busy}><Download size={15} /> {busy ? "Working…" : "Export data"}</button>
          </div>
          <div className="privacy-control-row">
            <span><Trash2 size={19} /><span><strong>Delete private career workspace</strong><small>Removes saved resume text and target role. Other account data stays unchanged.</small></span></span>
            <button type="button" className="privacy-danger" onClick={() => void deleteCareerWorkspace()} disabled={busy}>{busy ? "Working…" : "Delete workspace"}</button>
          </div>
        </>
      ) : <p className="privacy-muted">Sign in to access these controls. Your account is not changed by this page.</p>}
      <p className="privacy-muted">Full account deletion, device/session management and a complete archive of uploaded media require additional server-side workflows and are not represented as available here.</p>
    </section>
  );
}
