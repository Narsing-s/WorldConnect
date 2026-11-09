"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Compass, Search, Users, UserPlus, UserCheck, Globe2 } from "lucide-react";
import { createClient } from "@/lib/supabase";

type Member = { id: string; username: string; display_name: string | null; bio: string | null; country: string | null; avatar_url: string | null };
type Community = { id: string; name: string; description: string; created_at: string };

export default function ExplorePage() {
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery(params.get("q") || "");
    const supabase = createClient();
    if (!supabase) {
      setNotice("Connect Supabase to discover members and communities.");
      setLoading(false);
      return;
    }
    let active = true;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const [memberResult, communityResult, followResult] = await Promise.all([
        supabase.from("wc_profiles").select("id,username,display_name,bio,country,avatar_url").order("created_at", { ascending: false }).limit(100),
        supabase.from("wc_communities").select("id,name,description,created_at").order("created_at", { ascending: false }).limit(100),
        user ? supabase.from("wc_follows").select("following_id").eq("follower_id", user.id) : Promise.resolve({ data: [], error: null })
      ]);
      if (!active) return;
      setUserId(user?.id || "");
      if (memberResult.error) setNotice("Could not load members: " + memberResult.error.message);
      else setMembers((memberResult.data || []).filter((member: Member) => member.id !== user?.id) as Member[]);
      if (communityResult.error) setNotice("Could not load communities: " + communityResult.error.message);
      else setCommunities((communityResult.data || []) as Community[]);
      if (followResult.error) setNotice("Could not load your following list: " + followResult.error.message);
      else setFollowing((followResult.data || []).map((item: { following_id: string }) => item.following_id));
      setLoading(false);
    }
    void load().catch((error: unknown) => {
      if (active) {
        setNotice(error instanceof Error ? error.message : "Could not load Explore.");
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleMembers = useMemo(() => members.filter(member =>
    !normalizedQuery || [member.username, member.display_name, member.bio, member.country]
      .some(value => (value || "").toLowerCase().includes(normalizedQuery))
  ), [members, normalizedQuery]);
  const visibleCommunities = useMemo(() => communities.filter(community =>
    !normalizedQuery || (community.name + " " + community.description).toLowerCase().includes(normalizedQuery)
  ), [communities, normalizedQuery]);

  async function toggleFollow(memberId: string) {
    if (!userId) { window.location.assign("/login"); return; }
    const supabase = createClient();
    if (!supabase) return;
    const isFollowing = following.includes(memberId);
    setBusyId(memberId);
    const result = isFollowing
      ? await supabase.from("wc_follows").delete().eq("follower_id", userId).eq("following_id", memberId)
      : await supabase.from("wc_follows").insert({ follower_id: userId, following_id: memberId });
    setBusyId("");
    if (result.error) { setNotice("Could not update follow: " + result.error.message); return; }
    setFollowing(current => isFollowing ? current.filter(id => id !== memberId) : [...current, memberId]);
  }

  return (
    <main className="feature-page explore-page">
      <Link href="/" className="feature-back"><ArrowLeft size={16}/> WorldConnect</Link>
      <header className="feature-heading"><span><Compass size={22}/></span><div><h1>Explore</h1><p>Discover people, interests and communities around the world.</p></div></header>
      <label className="explore-search"><Search size={18}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search people, skills, places or communities…"/></label>
      {notice && <p className="feature-notice" role="status">{notice}</p>}
      {loading && <p className="feature-notice">Loading discovery results…</p>}
      <section className="explore-section">
        <div className="feature-toolbar"><strong>People to connect with</strong><span>{visibleMembers.length} members</span></div>
        {!loading && visibleMembers.length === 0 && <p className="feature-notice">No matching members found. Try another search.</p>}
        <div className="explore-member-grid">
          {visibleMembers.map(member => (
            <article className="explore-member-card" key={member.id}>
              <img className="explore-avatar" src={member.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377d6b?w=120&h=120&fit=crop&crop=faces"} alt=""/>
              <div className="explore-member-copy"><strong>{member.display_name || member.username}</strong><span>@{member.username}</span><small>{member.country || "WorldConnect member"}</small>{member.bio && <p>{member.bio}</p>}</div>
              <button className={following.includes(member.id) ? "feature-secondary" : "feature-primary"} disabled={busyId === member.id} onClick={() => void toggleFollow(member.id)}>
                {following.includes(member.id) ? <><UserCheck size={15}/> Following</> : <><UserPlus size={15}/> Follow</>}
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="explore-section">
        <div className="feature-toolbar"><strong>Communities</strong><span>{visibleCommunities.length} spaces</span></div>
        {!loading && visibleCommunities.length === 0 && <p className="feature-notice">No matching communities found.</p>}
        <div className="community-list">
          {visibleCommunities.map(community => (
            <article className="community-card" key={community.id}>
              <div className="community-symbol"><Users size={20}/></div>
              <div className="community-copy"><h2>{community.name}</h2><p>{community.description}</p></div>
              <Link className="feature-secondary explore-open-community" href={`/communities?space=${encodeURIComponent(community.name)}`}>Open community</Link>
            </article>
          ))}
        </div>
        <Link className="explore-all-communities" href="/communities"><Globe2 size={16}/> Browse all communities and join a space</Link>
      </section>
    </main>
  );
}
