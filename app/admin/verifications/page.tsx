"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Building2, LoaderCircle, ShieldCheck, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";

type RequestRow = {
  id: string; organization_id: string; registration_reference: string;
  notes: string; created_at: string;
  organization?: { name: string; website_url: string | null; industry: string; country: string } | null;
};

export default function EmployerVerificationReviewPage() {
  const [rows, setRows] = useState<RequestRow[]>([]);
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
      setError("Access denied. This page is restricted to platform reviewers."); setLoading(false); return;
    }
    setAuthorized(true);
    const { data, error: queryError } = await db.from("wc_organization_verification_requests")
      .select("id,organization_id,registration_reference,notes,created_at,organization:wc_organizations(name,website_url,industry,country)")
      .eq("status", "pending").order("created_at", { ascending: true });
    if (queryError) setError(queryError.message);
    else setRows((data || []) as unknown as RequestRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function decide(id: string, decision: "verified" | "rejected") {
    const db = createClient(); if (!db) return;
    setBusy(id); setError(""); setNotice("");
    const { error: rpcError } = await db.rpc("wc_review_organization_verification", {
      p_request_id: id, p_decision: decision, p_reviewer_note: ""
    });
    if (rpcError) setError(rpcError.message);
    else { setNotice(decision === "verified" ? "Company verified. Its employer jobs can now be published." : "Verification rejected."); await load(); }
    setBusy("");
  }

  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
    <div className="mx-auto max-w-4xl">
      <Link href="/jobs" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16}/> Back to Jobs</Link>
      <header className="mb-7 flex items-start gap-3">
        <div className="rounded-2xl bg-emerald-400/10 p-3 text-emerald-300"><ShieldCheck size={25}/></div>
        <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-300">WorldConnect Admin</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">Employer verification queue</h1><p className="mt-2 text-sm text-slate-400">Review submitted company information before enabling verified employer publishing.</p></div>
      </header>
      {error && <div role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}
      {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</div>}
      {loading ? <div className="flex items-center gap-2 py-12 text-slate-400"><LoaderCircle className="animate-spin"/> Loading verification requests…</div>
      : !authorized ? <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">Reviewer authorization is required.</div>
      : rows.length === 0 ? <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center"><BadgeCheck className="mx-auto mb-3 text-emerald-300" size={32}/><h2 className="font-semibold">No pending requests</h2><p className="mt-1 text-sm text-slate-400">New company verification submissions will appear here.</p></div>
      : <div className="space-y-4">{rows.map(row => <article key={row.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><Building2 className="mt-1 text-slate-400"/><div><h2 className="text-lg font-semibold">{row.organization?.name || "Company"}</h2><p className="text-sm text-slate-400">{[row.organization?.industry,row.organization?.country].filter(Boolean).join(" · ") || "Company details not provided"}</p>{row.organization?.website_url && <a className="mt-1 inline-block text-sm text-sky-300 underline" href={row.organization.website_url} target="_blank" rel="noreferrer">Company website</a>}</div></div><span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs text-amber-200">Pending review</span></div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs uppercase text-slate-500">Registration reference</dt><dd className="mt-1 break-words">{row.registration_reference || "Not supplied"}</dd></div><div><dt className="text-xs uppercase text-slate-500">Submitted</dt><dd className="mt-1">{new Date(row.created_at).toLocaleString()}</dd></div></dl>
        {row.notes && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-950 p-3 text-sm text-slate-300">{row.notes}</p>}
        <div className="mt-5 flex flex-wrap gap-2"><button disabled={!!busy} onClick={() => void decide(row.id,"verified")} className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50">{busy===row.id?<LoaderCircle className="animate-spin" size={16}/>:<BadgeCheck size={16}/>} Approve & verify</button><button disabled={!!busy} onClick={() => void decide(row.id,"rejected")} className="inline-flex items-center gap-2 rounded-xl border border-rose-500/40 px-4 py-2.5 text-sm font-semibold text-rose-200 disabled:opacity-50"><XCircle size={16}/> Reject</button></div>
      </article>)}</div>}
      <p className="mt-8 text-xs leading-5 text-slate-500">Verification is a manual trust decision. Review the registration reference and independently validate the company before approval. Reviewer access is assigned through trusted Supabase Auth app metadata only.</p>
    </div>
  </main>;
}
