"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Globe2, LoaderCircle, Save, LogOut, Camera } from "lucide-react";
import { createClient } from "@/lib/supabase";

type Profile = { username: string; display_name: string; bio: string; avatar_url: string | null; country: string | null };

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>({ username: "", display_name: "", bio: "", avatar_url: null, country: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setError("Connect Supabase before editing your profile."); setLoading(false); return; }
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const [profileResult, followersResult, followingResult] = await Promise.all([
        supabase.from("wc_profiles").select("username,display_name,bio,avatar_url,country").eq("id", user.id).maybeSingle(),
        supabase.from("wc_follows").select("follower_id", { count: "exact", head: true }).eq("following_id", user.id),
        supabase.from("wc_follows").select("following_id", { count: "exact", head: true }).eq("follower_id", user.id)
      ]);
      const { data, error: readError } = profileResult;
      if (!followersResult.error) setFollowerCount(followersResult.count || 0);
      if (!followingResult.error) setFollowingCount(followingResult.count || 0);
      if (readError) setError(readError.message);
      else if (data) setProfile({ ...data, country: data.country || "" });
      else setError("Your profile is not ready yet. Run the WorldConnect SQL setup in Supabase.");
      setLoading(false);
    });
  }, [router]);

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Choose an image file for your profile photo."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Profile photos must be 10 MB or smaller."); return; }
    const supabase = createClient();
    if (!supabase) { setError("Supabase is not connected."); return; }
    setUploadingAvatar(true); setError(""); setMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/login"); return; }
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/avatars/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("worldconnect-media").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) setError(`Profile photo upload failed: ${uploadError.message}`);
    else {
      const url = supabase.storage.from("worldconnect-media").getPublicUrl(path).data.publicUrl;
      setProfile(current => ({ ...current, avatar_url: url }));
      setMessage("Profile photo uploaded. Save your profile to apply it.");
    }
    setUploadingAvatar(false);
  }

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
      {loading ? <div className="profile-loading"><LoaderCircle className="auth-spin"/> Loading profile…</div> : <>
      <div className="profile-social-stats" aria-label="Your social connections">
        <div><strong>{followerCount.toLocaleString()}</strong><span>Followers</span></div>
        <div><strong>{followingCount.toLocaleString()}</strong><span>Following</span></div>
      </div>
      <form onSubmit={save} className="profile-form">
        <label>Username<input value={profile.username} readOnly /></label>
        <label>Display name<input value={profile.display_name} maxLength={60} required onChange={e=>setProfile(p=>({...p,display_name:e.target.value}))}/></label>
        <label>Country or city<input value={profile.country || ""} maxLength={80} placeholder="e.g. Hyderabad, India" onChange={e=>setProfile(p=>({...p,country:e.target.value}))}/></label>
        <label>About you<textarea value={profile.bio} maxLength={300} rows={4} placeholder="Tell the community a little about yourself…" onChange={e=>setProfile(p=>({...p,bio:e.target.value}))}/></label>
        <div className="profile-avatar-control"><span className="profile-avatar-preview">{profile.avatar_url ? <img src={profile.avatar_url} alt="Profile photo preview"/> : <Globe2 size={28}/>}</span><div><strong>Profile photo</strong><p>Choose a photo from your device (up to 10 MB).</p><input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={uploadAvatar}/><button type="button" className="profile-avatar-button" disabled={uploadingAvatar} onClick={()=>avatarInputRef.current?.click()}><Camera size={15}/>{uploadingAvatar ? "Uploading…" : "Choose photo"}</button></div></div>
        <label>Or use a profile photo URL<input type="url" value={profile.avatar_url || ""} placeholder="https://…" onChange={e=>setProfile(p=>({...p,avatar_url:e.target.value}))}/></label>
        {error&&<div className="auth-alert error" role="alert">{error}</div>}
        {message&&<div className="auth-alert success" role="status">{message}</div>}
        <button className="auth-submit" disabled={saving}>{saving?<LoaderCircle className="auth-spin"/>:<Save size={17}/>} Save profile</button>
      </form></>}
      <button className="profile-logout" onClick={signOut}><LogOut size={16}/> Sign out</button>
    </section>
  </main>;
}
