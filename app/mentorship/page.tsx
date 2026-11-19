"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Check, Clock3, Handshake, LoaderCircle, MapPin, Search, Send, ShieldCheck, UserRound, Users } from "lucide-react";
import { createClient } from "@/lib/supabase";
import "./mentorship.css";

type Profile = { username: string; display_name: string | null; avatar_url: string | null; country: string | null };
type Mentor = {
  user_id: string; headline: string; bio: string; skills: string[]; languages: string[];
  country: string; availability: string; accepting_requests: boolean;
  profile: Profile | Profile[] | null;
};
type Request = {
  id: string; mentor_id: string; requester_id: string; goal: string; cadence: string;
  status: "pending" | "accepted" | "declined" | "withdrawn" | "completed"; created_at: string;
};
const listValue = (value: string, limit: number) => [...new Set(value.split(",").map(item => item.trim()).filter(Boolean))].slice(0, limit);
const profileOf = (mentor: Mentor) => Array.isArray(mentor.profile) ? mentor.profile[0] : mentor.profile;
const mentorDisplayName = (mentor: Mentor) => {
  const profile = profileOf(mentor);
  return profile?.display_name || profile?.username || "WorldConnect member";
};

export default function MentorshipPage() {
  const [userId, setUserId] = useState("");
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState("");
  const [languages, setLanguages] = useState("");
  const [country, setCountry] = useState("");
  const [availability, setAvailability] = useState("Flexible");
  const [accepting, setAccepting] = useState(false);
  const [discoveryQuery, setDiscoveryQuery] = useState("");
  const [goal, setGoal] = useState("");
  const [cadence, setCadence] = useState("monthly");
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (id: string) => {
    const supabase = createClient();
    if (!supabase) return;
    const [profileResult, mentorResult, requestResult] = await Promise.all([
      supabase.from("wc_mentorship_profiles").select("headline,bio,skills,languages,country,availability,accepting_requests").eq("user_id", id).maybeSingle(),
      supabase.from("wc_mentorship_profiles").select("user_id,headline,bio,skills,languages,country,availability,accepting_requests,profile:wc_profiles!wc_mentorship_profiles_user_id_fkey(username,display_name,avatar_url,country)").eq("accepting_requests", true).neq("user_id", id).order("updated_at", { ascending: false }).limit(60),
      supabase.from("wc_mentorship_requests").select("id,mentor_id,requester_id,goal,cadence,status,created_at").or(`requester_id.eq.${id},mentor_id.eq.${id}`).order("created_at", { ascending: false }).limit(60)
    ]);
    if (profileResult.error || mentorResult.error || requestResult.error) {
      setError(profileResult.error?.message || mentorResult.error?.message || requestResult.error?.message || "Could not load mentorship data. Apply the mentorship migration and try again.");
      return;
    }
    const mine = profileResult.data;
    setHeadline(mine?.headline || "");
    setBio(mine?.bio || "");
    setSkills((mine?.skills || []).join(", "));
    setLanguages((mine?.languages || []).join(", "));
    setCountry(mine?.country || "");
    setAvailability(mine?.availability || "Flexible");
    setAccepting(Boolean(mine?.accepting_requests));
    setMentors((mentorResult.data || []) as unknown as Mentor[]);
    setRequests((requestResult.data || []) as Request[]);
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      const supabase = createClient();
      if (!supabase) { setError("Connect the WorldConnect Supabase project and apply the mentorship migration to enable this feature."); setLoading(false); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      if (!active) return;
      setUserId(user.id);
      await load(user.id);
      if (active) setLoading(false);
    }
    void init();
    return () => { active = false; };
  }, [load]);

  const myRequests = useMemo(() => requests.filter(item => item.requester_id === userId), [requests, userId]);
  const incomingRequests = useMemo(() => requests.filter(item => item.mentor_id === userId), [requests, userId]);
  const visibleMentors = useMemo(() => {
    const query = discoveryQuery.trim().toLowerCase();
    if (!query) return mentors;
    return mentors.filter(mentor => {
      const profile = profileOf(mentor);
      return [mentorDisplayName(mentor), profile?.username, mentor.headline, mentor.bio, mentor.country, profile?.country, ...mentor.skills, ...mentor.languages]
        .filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [mentors, discoveryQuery]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase || !userId) return;
    setSaving(true); setError(""); setNotice("");
    const result = await supabase.from("wc_mentorship_profiles").upsert({
      user_id: userId, headline: headline.trim(), bio: bio.trim(), skills: listValue(skills, 12),
      languages: listValue(languages, 8), country: country.trim(), availability, accepting_requests: accepting,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
    if (result.error) setError(result.error.message);
    else { setNotice(accepting ? "Your mentor profile is now discoverable." : "Your mentorship preferences were saved."); await load(userId); }
    setSaving(false);
  }

  async function sendRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMentor) return;
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true); setError(""); setNotice("");
    const { error: requestError } = await supabase.rpc("wc_request_mentorship", {
      p_mentor_id: selectedMentor.user_id, p_goal: goal.trim(), p_cadence: cadence
    });
    if (requestError) setError(requestError.message);
    else { setGoal(""); setSelectedMentor(null); setNotice("Mentorship request sent. Your details remain visible only to you and the mentor."); await load(userId); }
    setSaving(false);
  }

  async function respond(request: Request, action: "accept" | "decline" | "withdraw" | "complete") {
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true); setError(""); setNotice("");
    const { error: actionError } = await supabase.rpc("wc_respond_mentorship_request", { p_request_id: request.id, p_action: action });
    if (actionError) setError(actionError.message);
    else { setNotice(`Request ${action === "accept" ? "accepted" : action === "decline" ? "declined" : action === "withdraw" ? "withdrawn" : "marked complete"}.`); await load(userId); }
    setSaving(false);
  }

  return (
    <main className="feature-page mentorship-page">
      <Link href="/" className="feature-back"><ArrowLeft size={16}/> Back to WorldConnect</Link>
      <header className="feature-heading">
        <span><Handshake size={22}/></span>
        <div><h1>Mentorship network</h1><p>Learn from people who are willing to share their experience. You control whether your profile is discoverable.</p></div>
      </header>

      {notice && <p className="mentor-notice" role="status"><Check size={15}/>{notice}</p>}
      {error && <p className="mentor-error" role="alert">{error}</p>}
      {loading ? <p className="mentor-muted"><LoaderCircle className="mentor-spin" size={17}/> Loading mentorship network…</p> : (
        <>
          <section className="opportunity-card mentor-editor">
            <div className="mentor-section-title"><div><span className="mentor-kicker">YOUR CONTRIBUTION</span><h2>Offer mentorship</h2></div><ShieldCheck size={21}/></div>
            <p className="mentor-muted">Share only professional details you are comfortable publishing. Your profile is hidden from discovery until you opt in.</p>
            <form className="mentor-form" onSubmit={saveProfile}>
              <label>Mentor headline<input value={headline} onChange={event => setHeadline(event.target.value)} maxLength={120} placeholder="e.g. Senior engineer helping early-career developers"/></label>
              <label>About your mentoring<textarea value={bio} onChange={event => setBio(event.target.value)} maxLength={800} rows={3} placeholder="What can you help someone learn?"/></label>
              <div className="mentor-grid">
                <label>Skills (comma separated)<input value={skills} onChange={event => setSkills(event.target.value)} placeholder="MuleSoft, APIs, DataWeave"/></label>
                <label>Languages (comma separated)<input value={languages} onChange={event => setLanguages(event.target.value)} placeholder="English, Telugu, Hindi"/></label>
                <label>Country or region<input value={country} onChange={event => setCountry(event.target.value)} maxLength={80} placeholder="India / Remote"/></label>
                <label>Availability<select value={availability} onChange={event => setAvailability(event.target.value)}><option>Flexible</option><option>Weekdays</option><option>Weekends</option><option>Evenings</option><option>By arrangement</option></select></label>
              </div>
              <label className="mentor-optin"><input type="checkbox" checked={accepting} onChange={event => setAccepting(event.target.checked)}/> Make my mentor profile discoverable and accept requests</label>
              <button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save mentorship profile"}</button>
            </form>
          </section>

          <section className="mentor-discovery">
            <div className="mentor-section-title"><div><span className="mentor-kicker">GROW TOGETHER</span><h2>Discover mentors</h2></div><span className="mentor-count"><Users size={15}/>{mentors.length} available</span></div>
            <label className="mentor-search"><Search size={16}/><input aria-label="Search mentors by skill, language or region" value={discoveryQuery} onChange={event => setDiscoveryQuery(event.target.value)} placeholder="Search skills, languages or region"/></label>
            {visibleMentors.length ? <div className="mentor-cards">{visibleMentors.map(mentor => {
              const profile = profileOf(mentor);
              return <article className="opportunity-card mentor-card" key={mentor.user_id}>
                <div className="mentor-person"><span className="mentor-avatar">{(displayName(mentor).trim()[0] || "W").toUpperCase()}</span><div><strong>{displayName(mentor)}</strong><small>@{profile?.username || "member"}{mentor.country || profile?.country ? ` · ${mentor.country || profile?.country}` : ""}</small></div><UserRound size={18}/></div>
                <h3>{mentor.headline || "Open to sharing professional experience"}</h3>
                <p>{mentor.bio || "This member is open to mentoring conversations."}</p>
                {!!mentor.skills.length && <div className="mentor-tags">{mentor.skills.map(skill => <span key={skill}>{skill}</span>)}</div>}
                <div className="mentor-meta"><span><Clock3 size={14}/>{mentor.availability}</span><span><MapPin size={14}/>{mentor.languages.join(", ") || "Languages not specified"}</span></div>
                <button className="primary-button" onClick={() => setSelectedMentor(mentor)}><Send size={15}/> Request mentorship</button>
              </article>;
            })}</div> : <div className="mentor-empty"><Users size={25}/><strong>{mentors.length ? "No mentors match that search" : "No mentors are listed yet"}</strong><span>{mentors.length ? "Try another skill, language or region." : "When members opt in, their profiles will appear here."}</span></div>}
          </section>

          <section className="opportunity-card mentor-requests">
            <div className="mentor-section-title"><div><span className="mentor-kicker">YOUR CONNECTIONS</span><h2>Mentorship requests</h2></div><CalendarDays size={20}/></div>
            <div className="mentor-request-columns">
              <div><h3>Incoming ({incomingRequests.length})</h3>{incomingRequests.length ? incomingRequests.map(request => <article className="mentor-request" key={request.id}><span className={`mentor-status ${request.status}`}>{request.status}</span><p>{request.goal}</p><small>{request.cadence.replace("_"," ")} · {new Date(request.created_at).toLocaleDateString()}</small>{request.status === "pending" && <div className="mentor-actions"><button disabled={saving} onClick={() => void respond(request,"accept")}>Accept</button><button disabled={saving} onClick={() => void respond(request,"decline")}>Decline</button></div>}{request.status === "accepted" && <button className="mentor-secondary" disabled={saving} onClick={() => void respond(request,"complete")}>Mark complete</button>}</article>) : <p className="mentor-muted">No incoming requests.</p>}</div>
              <div><h3>Sent ({myRequests.length})</h3>{myRequests.length ? myRequests.map(request => <article className="mentor-request" key={request.id}><span className={`mentor-status ${request.status}`}>{request.status}</span><p>{request.goal}</p><small>{request.cadence.replace("_"," ")} · {new Date(request.created_at).toLocaleDateString()}</small>{request.status === "pending" && <button className="mentor-secondary" disabled={saving} onClick={() => void respond(request,"withdraw")}>Withdraw request</button>}{request.status === "accepted" && <button className="mentor-secondary" disabled={saving} onClick={() => void respond(request,"complete")}>Mark complete</button>}</article>) : <p className="mentor-muted">You have not requested mentorship.</p>}</div>
            </div>
          </section>
        </>
      )}

      {selectedMentor && <div className="mentor-modal-backdrop" role="presentation" onClick={() => setSelectedMentor(null)}><section className="mentor-modal" role="dialog" aria-modal="true" aria-labelledby="mentor-request-title" onClick={event => event.stopPropagation()}><div className="mentor-section-title"><div><span className="mentor-kicker">START A CONVERSATION</span><h2 id="mentor-request-title">Request {displayName(selectedMentor)}</h2></div><button type="button" onClick={() => setSelectedMentor(null)} aria-label="Close request">×</button></div><form className="mentor-form" onSubmit={sendRequest}><label>What would you like help with?<textarea rows={4} minLength={10} maxLength={1200} required value={goal} onChange={event => setGoal(event.target.value)} placeholder="Describe your goal, current level and what you hope to achieve."/></label><label>Preferred cadence<select value={cadence} onChange={event => setCadence(event.target.value)}><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="one_off">One-time conversation</option></select></label><p className="mentor-muted">Your request is private to you and this mentor. No resume or contact details are shared automatically.</p><button className="primary-button" disabled={saving || goal.trim().length < 10}><Send size={15}/> Send request</button></form></section></div>}
    </main>
  );
}
