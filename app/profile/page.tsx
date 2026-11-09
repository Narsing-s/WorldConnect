"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Globe2, LoaderCircle, Save, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase";

type Profile = { username: string; display_name: string; bio: string; avatar_url: string | null; country: string | null };

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>({ username: "", display_name: "", bio: "", avatar_url: null, country: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setError("Connect Supabase before editing your profile."); setLoading(false); return; }
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const { data, error: readError } = await supabase.from("wc_profiles").select("username,display_name,bio,avatar_url,country").eq("id", user.id).maybeSingle();
      if (readError) setError(readError.message);
      else if (data) setProfile({ ...data, country: data.country || "" });
      else setError("Your profile is not ready yet. Run the WorldConnect SQL setup in Supabase.");
      setLoading(false);
    });
  }, [router]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true); setError(""); setMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/login"); return; }
    const { error: updateError } = await supabase.from("wc_profiles").update({
      display_name: profile.display_name.trim(),
      bio: profile.bio.trim(),
      avatar_url: profile.avatar_url?.trim() || null,
      country: profile.country?.trim() || null
    }).eq("id", user.id);
    if (updateError) setError(updateError.message);
    else setMessage("Your profile has been updated.");
    setSaving(false);
  }

  async function signOut() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return <main className="profile-page">
    <Link href="/" className="profile-back"><ArrowLeft size={17}/> Back to WorldConnect</Link>
    <section className="profile-card">
      <div className="profile-page-brand"><Globe2 size={24}/> world<span>connect</span></div>
      <h1>Your profile</h1>
      <p>Choose how people around the world see you.</p>
      {loading ? <div className="profile-loading"><LoaderCircle className="auth-spin"/> Loading profile…</div> : <form onSubmit={save} className="profile-form">
        <label>Username<input value={profile.username} readOnly /></label>
        <label>Display name<input value={profile.display_name} maxLength={60} required onChange={e=>setProfile(p=>({...p,display_name:e.target.value}))}/></label>
        <label>Country or city<input value={profile.country || ""} maxLength={80} placeholder="e.g. Hyderabad, India" onChange={e=>setProfile(p=>({...p,country:e.target.value}))}/></label>
        <label>About you<textarea value={profile.bio} maxLength={300} rows={4} placeholder="Tell the community a little about yourself…" onChange={e=>setProfile(p=>({...p,bio:e.target.value}))}/></label>
        <label>Profile photo URL<input type="url" value={profile.avatar_url || ""} placeholder="https://…" onChange={e=>setProfile(p=>({...p,avatar_url:e.target.value}))}/></label>
        {error&&<div className="auth-alert error" role="alert">{error}</div>}
        {message&&<div className="auth-alert success" role="status">{message}</div>}
        <button className="auth-submit" disabled={saving}>{saving?<LoaderCircle className="auth-spin"/>:<Save size={17}/>} Save profile</button>
      </form>}
      <button className="profile-logout" onClick={signOut}><LogOut size={16}/> Sign out</button>
    </section>
  </main>;
}
