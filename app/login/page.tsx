"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Globe2, LoaderCircle, Mail, Lock, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setMessage("");
    const supabase = createClient();
    if (!supabase) {
      setError("Backend is not connected yet. Add the Supabase Project URL and Publishable key to your deployment environment.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
        if (cleanUsername.length < 3) throw new Error("Username must contain at least 3 letters or numbers.");
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: { username: cleanUsername, display_name: displayName.trim() || cleanUsername },
          },
        });
        if (authError) throw authError;
        if (data.session) {\n          const { error: greetingError } = await supabase.functions.invoke("send-welcome-email");\n          if (greetingError) setMessage("Your account is ready! Welcome to WorldConnect. (The welcome email could not be sent just now.)");\n          router.replace("/");\n          router.refresh();\n        } else {\n          setMessage("Your account was created, but email confirmation is still enabled in Supabase. Disable Confirm email in Supabase Authentication settings to allow immediate sign-in.");\n        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        router.replace("/");
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-glow auth-glow-one" /><div className="auth-glow auth-glow-two" />
      <Link href="/" className="auth-back"><ArrowLeft size={17}/> Back to WorldConnect</Link>
      <section className="auth-card">
        <Link href="/" className="auth-brand"><span><Globe2 size={25}/></span>world<b>connect</b></Link>
        <div className="auth-eyebrow">YOUR WORLD IS WAITING</div>
        <h1>{mode === "login" ? "Welcome back." : "Find your people."}</h1>
        <p className="auth-subtitle">{mode === "login" ? "Sign in and pick up where your world left off." : "Create your free account and connect across borders."}</p>
        <div className="auth-switch"><button className={mode === "login" ? "active" : ""} onClick={() => {setMode("login");setError("");setMessage("");}}>Sign in</button><button className={mode === "signup" ? "active" : ""} onClick={() => {setMode("signup");setError("");setMessage("");}}>Create account</button></div>
        <form onSubmit={submit} className="auth-form">
          {mode === "signup" && <>
            <label>Display name<div className="auth-input"><UserRound size={17}/><input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="How should people know you?" maxLength={60}/></div></label>
            <label>Username<div className="auth-input"><span className="auth-at">@</span><input value={username} onChange={e=>setUsername(e.target.value)} placeholder="yourname" minLength={3} maxLength={30} required/></div></label>
          </>}
          <label>Email address<div className="auth-input"><Mail size={17}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required/></div></label>
          <label>Password<div className="auth-input"><Lock size={17}/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} required/></div></label>
          {error && <div className="auth-alert error" role="alert">{error}</div>}
          {message && <div className="auth-alert success" role="status">{message}</div>}
          {mode === "login" && <div className="auth-forgot-row"><Link href="/forgot-password">Forgot password?</Link></div>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="auth-spin" size={17}/> Please wait...</> : mode === "login" ? "Sign in to WorldConnect" : "Create my account"}</button>
        </form>
        <p className="auth-legal">By continuing, you agree to help keep WorldConnect respectful, safe and welcoming.</p>
      </section>
      <p className="auth-footer">A more connected world starts with you. 🌍</p>
    </main>
  );
}
