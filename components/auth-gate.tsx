"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Globe2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";

const publicPaths = new Set([
  "/login", "/forgot-password", "/reset-password", "/about", "/guidelines",
  "/privacy", "/terms", "/auth/callback"
]);

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const isPublic = publicPaths.has(pathname) || pathname.startsWith("/auth/");

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setChecked(true); setUser(null); return; }
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user ?? null);
      setChecked(true);
    }).catch(() => { if (active) setChecked(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setChecked(true);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  if (isPublic) return <>{children}</>;
  if (!checked) {
    return <main className="auth-page"><section className="auth-card" aria-live="polite"><div className="auth-brand"><span><Globe2 size={25}/></span>world<b>connect</b></div><h1>Preparing your world…</h1><p className="auth-subtitle">Checking your secure sign-in session.</p></section></main>;
  }
  if (!user) {
    return (
      <main className="auth-page">
        <div className="auth-glow auth-glow-one" /><div className="auth-glow auth-glow-two" />
        <section className="auth-card">
          <Link href="/" className="auth-brand"><span><Globe2 size={25}/></span>world<b>connect</b></Link>
          <div className="auth-eyebrow">A GLOBAL COMMUNITY</div>
          <h1>Your world starts here.</h1>
          <p className="auth-subtitle">Sign in to see your feed, connect with people, join communities and discover opportunities. WorldConnect content is available to signed-in members.</p>
          <div className="auth-form">
            <Link className="auth-submit" href="/login">Sign in to WorldConnect</Link>
            <Link className="auth-submit" href="/login?mode=signup">Create a free account</Link>
          </div>
          <p className="auth-legal">One world. Millions of connections.</p>
        </section>
      </main>
    );
  }
  return <>{children}</>;
}
