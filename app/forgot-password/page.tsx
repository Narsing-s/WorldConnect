"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Globe2, LoaderCircle, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    const supabase = createClient();
    if (!supabase) {
      setError("Backend is not connected. Please try again later.");
      setBusy(false);
      return;
    }
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: "https://worldconnect-plum.vercel.app/auth/callback?next=/reset-password",
      });
      if (resetError) throw resetError;
      setMessage("If an account exists for that email, a password reset link has been sent. Check your inbox and Spam/Junk folder.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the password reset email. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-glow auth-glow-one"/><div className="auth-glow auth-glow-two"/>
      <Link href="/login" className="auth-back"><ArrowLeft size={17}/> Back to sign in</Link>
      <section className="auth-card">
        <Link href="/" className="auth-brand"><span><Globe2 size={25}/></span>world<b>connect</b></Link>
        <div className="auth-eyebrow">ACCOUNT RECOVERY</div>
        <h1>Forgot password?</h1>
        <p className="auth-subtitle">Enter the email address linked to your account. We’ll send you a secure link to choose a new password.</p>
        <form onSubmit={submit} className="auth-form" style={{marginTop:26}}>
          <label>Email address<div className="auth-input"><Mail size={17}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required/></div></label>
          {error && <div className="auth-alert error" role="alert">{error}</div>}
          {message && <div className="auth-alert success" role="status">{message}</div>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="auth-spin" size={17}/> Sending link…</> : "Send password reset link"}</button>
        </form>
        <p className="auth-legal">For your security, this page does not reveal whether an email address has an account.</p>
      </section>
    </main>
  );
}
