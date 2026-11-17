"use client";
import { useEffect,useState } from "react";
import Link from "next/link";

import { CheckCircle2,LoaderCircle,ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase";
export default function AcceptRecruiterInvitationPage(){
 const [status,setStatus]=useState("Checking invitation…");const [error,setError]=useState("");
 useEffect(()=>{let active=true;void(async()=>{const token=new URLSearchParams(window.location.search).get("token");if(!token){setError("Invitation token is missing.");return;}const db=createClient();if(!db){setError("Supabase is not configured.");return;}const {data:{user}}=await db.auth.getUser();if(!user){setError("Sign in with the email address that received this invitation, then reopen this link.");return;}const {error:e}=await db.rpc("wc_accept_organization_invitation",{p_token:token});if(!active)return;if(e)setError(e.message);else setStatus("Invitation accepted. You are now a recruiter for this company.");})();return()=>{active=false;};},[]);
 return <main className="min-h-screen bg-slate-950 px-4 py-16 text-slate-100"><div className="mx-auto max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center"><ShieldCheck className="mx-auto mb-4 text-emerald-300" size={34}/><h1 className="text-2xl font-bold">Join employer team</h1>{error?<p role="alert" className="mt-4 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>:<p role="status" className="mt-4 text-sm text-slate-300"><CheckCircle2 className="mr-1 inline text-emerald-300"/>{status}</p>}<Link href="/recruiter" className="mt-6 inline-block rounded-xl bg-sky-300 px-4 py-3 text-sm font-semibold text-slate-950">Open recruiter workspace</Link></div></main>;
}
