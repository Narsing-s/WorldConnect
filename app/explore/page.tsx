"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Compass, Search, UserPlus, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase";

type Member = { id: string; username: string; display_name: string | null; bio: string | null; country: string | null; avatar_url: string | null };
type FeedPost = { id: string; body: string; image_url: string | null; video_url: string | null; created_at: string; author: { username: string; display_name: string | null } | null };
type FollowRow = { follower_id: string; following_id: string };
type FollowCounts = { followers: number; following: number };

export default function ExplorePage() {
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [followCounts, setFollowCounts] = useState<Record<string, FollowCounts>>({});
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery(params.get("q") || "");
    const supabase = createClient();
    if (!supabase) {
      setNotice("Connect Supabase to discover members and posts.");
      setLoading(false);
      return;
    }
    const client = supabase;
    let active = true;
    async function load() {
      const { data: { user } } = await client.auth.getUser();
      const [memberResult, postResult, followResult, allFollowsResult] = await Promise.all([
        client.from("wc_profiles").select("id,username,display_name,bio,country,avatar_url").order("created_at", { ascending: false }).limit(100),
        client.from("wc_posts").select("id,body,image_url,video_url,created_at,author:wc_profiles!wc_posts_author_id_fkey(username,display_name)").order("created_at", { ascending: false }).limit(100),
        user ? client.from("wc_follows").select("following_id").eq("follower_id", user.id) : Promise.resolve({ data: [], error: null }),
        client.from("wc_follows").select("follower_id,following_id"),
      ]);
      if (!active) return;
      setUserId(user?.id || "");
      if (memberResult.error) setNotice("Could not load members: " + memberResult.error.message);
      else setMembers((memberResult.data || []).filter((member: Member) => member.id !== user?.id) as Member[]);
      if (postResult.error) setNotice("Could not load posts: " + postResult.error.message);
      else setPosts((postResult.data || []) as unknown as FeedPost[]);
      if (followResult.error) setNotice("Could not load your following list: " + followResult.error.message);
      else setFollowing((followResult.data || []).map((item: { following_id: string }) => item.following_id));
      if (allFollowsResult.error) setNotice("Could not load connection counts: " + allFollowsResult.error.message);
      else {
        const counts: Record<string, FollowCounts> = {};
        for (const row of (allFollowsResult.data || []) as FollowRow[]) {
          counts[row.following_id] ??= { followers: 0, following: 0 };
          counts[row.follower_id] ??= { followers: 0, following: 0 };
          counts[row.following_id].followers += 1;
          counts[row.follower_id].following += 1;
        }
        setFollowCounts(counts);
      }
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
  const visiblePosts = useMemo(() => posts.filter(post => !normalizedQuery || post.body.toLowerCase().includes(normalizedQuery)), [posts, normalizedQuery]);

  async function toggleFollow(memberId: string) {
    if (!userId) { window.location.assign("/login"); return; }
    const supabase = createClient();
    if (!supabase) return;
    const isFollowing = following.includes(memberId);
    const previousFollowing = following;
    const previousCounts = followCounts;
    setBusyId(memberId);
    setFollowing(current => isFollowing ? current.filter(id => id !== memberId) : [...current, memberId]);
    setFollowCounts(current => {
      const currentMember = current[memberId] || { followers: 0, following: 0 };
      return { ...current, [memberId]: { ...currentMember, followers: Math.max(0, currentMember.followers + (isFollowing ? -1 : 1)) } };
    });
    const result = isFollowing
      ? await supabase.from("wc_follows").delete().eq("follower_id", userId).eq("following_id", memberId)
      : await supabase.from("wc_follows").insert({ follower_id: userId, following_id: memberId });
    setBusyId("");
    if (result.error) {
      setFollowing(previousFollowing);
      setFollowCounts(previousCounts);
      setNotice("Could not update follow: " + result.error.message);
    }
  }

  return (
    <main className="feature-page explore-page">
      <Link href="/" className="feature-back"><ArrowLeft size={16}/> WorldConnect</Link>
      <header className="feature-heading"><span><Compass size={22}/></span><div><h1>Explore</h1><p>Discover people and public posts from around the world.</p></div></header>
      <label className="explore-search"><Search size={18}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search people or posts…"/></label>
      {notice && <p className="feature-notice" role="status">{notice}</p>}
      {loading && <p className="feature-notice">Loading discovery results…</p>}
      <section className="explore-section">
        <div className="feature-toolbar"><strong>People to connect with</strong><span>{visibleMembers.length} members</span></div>
        {!loading && visibleMembers.length === 0 && <p className="feature-notice">No matching members found. Try another search.</p>}
        <div className="explore-member-grid">
          {visibleMembers.map(member => (
            <article className="explore-member-card" key={member.id}>
              <Link className="explore-profile-avatar-link" href={`/members/${encodeURIComponent(member.username)}`} aria-label={`View ${member.display_name || member.username} profile`}><img className="explore-avatar" src={member.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377d6b?w=120&h=120&fit=crop&crop=faces"} alt=""/></Link>
              <div className="explore-member-copy"><Link className="explore-member-profile-link" href={`/members/${encodeURIComponent(member.username)}`}><strong>{member.display_name || member.username}</strong><span>@{member.username}</span></Link><small>{member.country || "WorldConnect member"}</small><div className="explore-follow-stats"><span><strong>{(followCounts[member.id]?.followers || 0).toLocaleString()}</strong> followers</span><span><strong>{(followCounts[member.id]?.following || 0).toLocaleString()}</strong> following</span></div>{member.bio && <p>{member.bio}</p>}</div>
              <button className={following.includes(member.id) ? "feature-secondary" : "feature-primary"} disabled={busyId === member.id} onClick={() => void toggleFollow(member.id)}>
                {following.includes(member.id) ? <><UserCheck size={15}/> Following</> : <><UserPlus size={15}/> Follow</>}
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="explore-section">
        <div className="feature-toolbar"><strong>Posts and discussions</strong><span>{visiblePosts.length} posts</span></div>
        {!loading && visiblePosts.length === 0 && <p className="feature-notice">No matching posts found.</p>}
        <div className="explore-post-list">
          {visiblePosts.map(post => <article className="explore-post-card" key={post.id}>
            <div><strong>{post.author?.display_name || post.author?.username || "WorldConnect member"}</strong><small>{new Date(post.created_at).toLocaleString()}</small></div>
            <p>{post.body}</p>
            {post.image_url && <img src={post.image_url} alt="Shared community post"/>}
            {post.video_url && <span className="explore-video-label">Video post</span>}
            <Link href={`/?post=${post.id}`}>Open discussion</Link>
          </article>)}
        </div>
      </section>
    </main>
  );
}
