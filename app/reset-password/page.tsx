"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Globe2, LoaderCircle, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setMessage("");
    if (password.length < 8) { setError("Your password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("The passwords do not match."); return; }
    const supabase = createClient();
    if (!supabase) { setError("Backend is not connected. Please try again later."); return; }
    setBusy(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("This reset link is invalid or has expired. Request a new password reset link.");
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage("Your password has been updated. You can now sign in with your new password.");
      setPassword(""); setConfirmPassword("");
      window.setTimeout(() => router.replace("/login"), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update your password. Please request a new reset link.");
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
        <div className="auth-eyebrow">SECURE YOUR ACCOUNT</div>
        <h1>Set a new password.</h1>
        <p className="auth-subtitle">Choose a new password with at least 8 characters.</p>
        <form onSubmit={submit} className="auth-form" style={{marginTop:26}}>
          <label>New password<div className="auth-input"><Lock size={17}/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} autoComplete="new-password" required/></div></label>
          <label>Confirm new password<div className="auth-input"><Lock size={17}/><input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Enter password again" minLength={8} autoComplete="new-password" required/></div></label>
          {error && <div className="auth-alert error" role="alert">{error}</div>}
          {message && <div className="auth-alert success" role="status">{message}</div>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="auth-spin" size={17}/> Updating…</> : "Save new password"}</button>
        </form>
      </section>
    </main>
  );
}
