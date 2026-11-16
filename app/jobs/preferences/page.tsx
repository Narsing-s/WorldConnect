"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, LoaderCircle, Save, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase";
import "../jobs.css";

type Preferences = {
  target_titles: string[];
  skills: string[];
  locations: string[];
  work_modes: string[];
};

const emptyPreferences: Preferences = { target_titles: [], skills: [], locations: [], work_modes: [] };
const modes = ["Remote", "Hybrid", "On-site"];

function splitValues(value: string, limit: number) {
  return Array.from(new Set(value.split(/[,;\n]/).map(item => item.trim()).filter(Boolean))).slice(0, limit);
}

export default function JobPreferencesPage() {
  const [preferences, setPreferences] = useState<Preferences>(emptyPreferences);
  const [titles, setTitles] = useState("");
  const [skills, setSkills] = useState("");
  const [locations, setLocations] = useState("");
  const [workModes, setWorkModes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setError("Connect Supabase to save job preferences."); setLoading(false); return; }
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Please sign in to manage your job preferences."); setLoading(false); return; }
      const { data, error: queryError } = await supabase.from("wc_candidate_preferences")
        .select("target_titles,skills,locations,work_modes").eq("user_id", user.id).maybeSingle();
      if (queryError) setError("Could not load preferences. Apply the candidate preferences SQL migration in Supabase.");
      else if (data) {
        const loaded = {
          target_titles: data.target_titles || [],
          skills: data.skills || [],
          locations: data.locations || [],
          work_modes: data.work_modes || []
        };
        setPreferences(loaded);
        setTitles(loaded.target_titles.join(", "));
        setSkills(loaded.skills.join(", "));
        setLocations(loaded.locations.join(", "));
        setWorkModes(loaded.work_modes);
      }
      setLoading(false);
    })();
  }, []);

  function toggleMode(mode: string) {
    setWorkModes(current => current.includes(mode) ? current.filter(item => item !== mode) : [...current, mode]);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) { setError("Supabase is not connected."); return; }
    setSaving(true); setError(""); setNotice("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Please sign in again."); setSaving(false); return; }
    const next: Preferences = {
      target_titles: splitValues(titles, 20),
      skills: splitValues(skills, 40),
      locations: splitValues(locations, 20),
      work_modes: workModes.slice(0, 3)
    };
    const { error: saveError } = await supabase.from("wc_candidate_preferences")
      .upsert({ user_id: user.id, ...next }, { onConflict: "user_id" });
    if (saveError) setError(saveError.message.includes("wc_candidate_preferences")
      ? "Apply the candidate preferences SQL migration in Supabase before saving."
      : "Preferences could not be saved: " + saveError.message);
    else { setPreferences(next); setNotice("Your job preferences are saved. Matching scores will appear in Job Hub."); }
    setSaving(false);
  }

  const preferenceCount = preferences.target_titles.length + preferences.skills.length + preferences.locations.length + preferences.work_modes.length;

  return (
    <main className="feature-page">
      <Link href="/jobs" className="feature-back"><ArrowLeft size={16}/> Back to Job Hub</Link>
      <header className="feature-heading">
        <span><Sparkles size={22}/></span>
        <div><h1>Job Match Preferences</h1><p>Tell WorldConnect what you are looking for. Your preferences stay private and are used to calculate transparent job-match scores.</p></div>
      </header>
      {loading ? <p className="feature-notice"><LoaderCircle className="auth-spin" size={16}/> Loading your preferences…</p> : (
        <section className="feature-section">
          <div className="feature-notice">Add terms separated by commas. Matching runs in your browser against available job titles, descriptions, tags and locations; it does not send your profile to an AI provider.</div>
          <form className="feature-form jobs-search-form" onSubmit={save}>
            <label>Target job titles<input value={titles} maxLength={1200} onChange={event => setTitles(event.target.value)} placeholder="e.g. MuleSoft Developer, Integration Engineer"/></label>
            <label>Skills<input value={skills} maxLength={2000} onChange={event => setSkills(event.target.value)} placeholder="e.g. MuleSoft, DataWeave, SQL, REST API"/></label>
            <label>Preferred locations<input value={locations} maxLength={1200} onChange={event => setLocations(event.target.value)} placeholder="e.g. Hyderabad, Bengaluru, Pune, India"/></label>
            <fieldset className="jobs-mode-options">
              <legend>Preferred work modes</legend>
              {modes.map(mode => <label key={mode}><input type="checkbox" checked={workModes.includes(mode)} onChange={() => toggleMode(mode)}/>{mode}</label>)}
            </fieldset>
            {error && <p className="feature-notice" role="alert">{error}</p>}
            {notice && <p className="feature-notice" role="status">{notice}</p>}
            <div className="feature-toolbar"><span>{preferenceCount} saved preference terms</span><button className="feature-primary" disabled={saving}><Save size={16}/>{saving ? "Saving…" : "Save preferences"}</button></div>
          </form>
          <div className="feature-notice"><BriefcaseBusiness size={15}/> Match scores are guidance, not a hiring prediction. Missing job details are not treated as a match.</div>
        </section>
      )}
    </main>
  );
}
