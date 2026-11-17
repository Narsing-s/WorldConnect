"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Flag, LoaderCircle, ShieldCheck, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";

type ReportRow = {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  created_at: string;
  reporter?: { username: string | null; display_name: string | null } | null;
};

export default function ContentReportReviewPage() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [authorized, setAuthorized] = useState(false);

  const load = useCallback(async () => {
    const db = createClient();
    if (!db) { setError("Supabase is not configured."); setLoading(false); return; }
    const { data: { user } } = await db.auth.getUser();
    if (!user) { setError("Sign in with an authorized reviewer account."); setLoading(false); return; }
    if (user.app_metadata?.worldconnect_role !== "reviewer") {
      setError("Access denied. This queue is restricted to platform reviewers."); setLoading(false); return;
    }
    setAuthorized(true);
    const { data, error: queryError } = await db.from("wc_content_reports")
      .select("id,reporter_id,target_type,target_id,reason,details,status,created_at,reporter:wc_profiles!wc_content_reports_reporter_id_fkey(username,display_name)")
      .in("status", ["open", "reviewing"]).order("created_at", { ascending: true });
    if (queryError) setError(queryError.message);
    else setRows((data || []) as unknown as ReportRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function decide(id: string, status: "reviewing" | "resolved" | "dismissed") {
    const db = createClient(); if (!db) return;
    const { data: { user } } = await db.auth.getUser();
    if (!user || user.app_metadata?.worldconnect_role !== "reviewer") {
      setError("Reviewer authorization is required."); return;
    }
    setBusy(id); setError(""); setNotice("");
    const { error: updateError } = await db.from("wc_content_reports").update({
      status, reviewer_id: user.id, reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (updateError) setError(updateError.message);
    else { setNotice("Report status updated and recorded in the moderation audit trail."); await load(); }
    setBusy("");
  }

  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/verifications" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16}/> Admin tools</Link>
      <header className="mb-7 flex items-start gap-3">
        <div className="rounded-2xl bg-emerald-400/10 p-3 text-emerald-300"><ShieldCheck size={25}/></div>
        <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-300">WorldConnect Admin</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">Content moderation queue</h1><p className="mt-2 text-sm text-slate-400">Review member reports and record each status decision.</p></div>
      </header>
      {error && <div role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}
      {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</div>}
      {loading ? <div className="flex items-center gap-2 py-12 text-slate-400"><LoaderCircle className="animate-spin"/> Loading reports…</div>
      : !authorized ? <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">Reviewer authorization is required.</div>
      : rows.length === 0 ? <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center"><CheckCircle2 className="mx-auto mb-3 text-emerald-300" size={32}/><h2 className="font-semibold">No open reports</h2><p className="mt-1 text-sm text-slate-400">New member reports will appear here.</p></div>
      : <div className="space-y-4">{rows.map(row => <article key={row.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><Flag className="mt-1 text-slate-400"/><div><h2 className="text-lg font-semibold">{row.target_type} · {row.reason.replaceAll("_", " ")}</h2><p className="text-sm text-slate-400">Target: <span className="break-all">{row.target_id}</span></p><p className="text-xs text-slate-500">Reported by {row.reporter?.display_name || row.reporter?.username || "Member"} · {new Date(row.created_at).toLocaleString()}</p></div></div><span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs capitalize text-amber-200">{row.status}</span></div>
        {row.details && <p className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-sm text-slate-300">{row.details}</p>}
        <div className="mt-5 flex flex-wrap gap-2"><button disabled={!!busy} onClick={() => void decide(row.id,"reviewing")} className="inline-flex items-center gap-2 rounded-xl border border-sky-500/40 px-4 py-2.5 text-sm font-semibold text-sky-200 disabled:opacity-50"><Clock3 size={16}/> Mark reviewing</button><button disabled={!!busy} onClick={() => void decide(row.id,"resolved")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"><CheckCircle2 size={16}/> Resolve</button><button disabled={!!busy} onClick={() => void decide(row.id,"dismissed")} className="inline-flex items-center gap-2 rounded-xl border border-rose-500/40 px-4 py-2.5 text-sm font-semibold text-rose-200 disabled:opacity-50"><XCircle size={16}/> Dismiss</button></div>
      </article>)}</div>}
      <p className="mt-8 text-xs leading-5 text-slate-500">Only accounts assigned <code>worldconnect_role=reviewer</code> in trusted Supabase Auth app metadata can access this queue. Status transitions are recorded by a database trigger. Validate reports before taking action against an account or job.</p>
    </div>
  </main>;
}
