"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { createClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import {
  Bell, Bookmark, Compass, Globe2, Hash, Heart, Home, ImagePlus, MessageCircle,
  MoreHorizontal, Plus, Search, Send, ShieldCheck, Sparkles, Users, Video,
  MessageSquareText, ArrowUpRight, X, Menu, Check, Languages, BriefcaseBusiness, UserRound, LogOut
} from "lucide-react";

type Post = { id: number; name: string; handle: string; country: string; time: string; avatar: string; body: string; image?: string; video?: string; likes: number; comments: number; tag: string; verified?: boolean; liked?: boolean };

const initialPosts: Post[] = [
  { id: 1, name: "Amara Okafor", handle: "amara.explores", country: "Lagos, Nigeria", time: "12 min ago", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop&crop=faces", body: "A reminder from Lagos today: the best ideas happen when we make room for different perspectives. What is one thing your city has taught you about community? 🌍", image: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1200&q=85", likes: 248, comments: 36, tag: "Community", verified: true },
  { id: 2, name: "Daniel Kim", handle: "danielbuilds", country: "Seoul, South Korea", time: "38 min ago", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop&crop=faces", body: "Just opened my first open-source project to contributors worldwide. Looking for designers, developers and curious beginners. Let's build something useful together. 💡", likes: 132, comments: 19, tag: "Technology" },
  { id: 3, name: "Sofia Laurent", handle: "sofia.learns", country: "Lyon, France", time: "1 hr ago", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&h=120&fit=crop&crop=faces", body: "This week I'm hosting a free language exchange: French, English, Telugu and Spanish learners welcome. Learning feels easier when we learn together. ✨", likes: 96, comments: 12, tag: "Learning" },
];

const trends = [{tag:"ClimateAction",posts:"18.4K posts"},{tag:"BuildInPublic",posts:"12.8K posts"},{tag:"LearnTogether",posts:"8,240 posts"},{tag:"WorldCulture",posts:"6,190 posts"}];
const people = [
  {name:"Maya Chen",role:"Product designer · Singapore",avatar:"https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=100&h=100&fit=crop&crop=faces"},
  {name:"Arjun Mehta",role:"Open-source mentor · India",avatar:"https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=faces"},
  {name:"Elena Rossi",role:"Educator · Italy",avatar:"https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces"},
];

export default function HomePage() {
  const [tab, setTab] = useState("For you");
  const [posts, setPosts] = useState(initialPosts);
  const [draft, setDraft] = useState("");
  const [following, setFollowing] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [profileName, setProfileName] = useState("Sign in");
  const [commentPost, setCommentPost] = useState<Post | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentsByPost, setCommentsByPost] = useState<Record<number, string[]>>({});
  const [showComposer, setShowComposer] = useState(false);
  const [composerMode, setComposerMode] = useState<"discussion" | "photo" | "video">("discussion");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setProfileName(String(data.user?.user_metadata?.display_name || data.user?.user_metadata?.username || data.user?.email?.split("@")[0] || "Profile"));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setProfileName(String(session?.user?.user_metadata?.display_name || session?.user?.user_metadata?.username || session?.user?.email?.split("@")[0] || "Sign in"));
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!mediaPreview) return;
    return () => URL.revokeObjectURL(mediaPreview);
  }, [mediaPreview]);

  const visiblePosts = useMemo(() => posts.filter(p => !search || (p.body + p.name + p.tag).toLowerCase().includes(search.toLowerCase())), [posts, search]);

  function toggleLike(id: number) {
    setPosts(current => current.map(p => p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p));
  }

  function submitComment() {
    if (!commentPost || !commentDraft.trim()) return;
    const value = commentDraft.trim();
    setCommentsByPost(current => ({ ...current, [commentPost.id]: [...(current[commentPost.id] || []), value] }));
    setPosts(current => current.map(p => p.id === commentPost.id ? { ...p, comments: p.comments + 1 } : p));
    setCommentDraft("");
  }

  async function sharePost(post: Post) {
    const shareUrl = `${window.location.origin}/?post=${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: `WorldConnect · ${post.name}`, text: post.body, url: shareUrl });
      else {
        await navigator.clipboard.writeText(`${post.body}\n${shareUrl}`);
        setNotice("Post text and link copied. You can paste it into any app.");
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") setNotice("Sharing is unavailable here. Copy the page link from your address bar.");
    }
  }

  async function signOut() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    window.location.href = "/";
  }

  function openMediaPicker(kind: "photo" | "video") {
    setComposerMode(kind);
    setShowComposer(true);
    if (kind === "photo") photoInputRef.current?.click();
    else videoInputRef.current?.click();
  }

  function handleMediaChange(event: ChangeEvent<HTMLInputElement>, kind: "photo" | "video") {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (kind === "photo" && !file.type.startsWith("image/")) {
      setNotice("Please choose an image file.");
      return;
    }
    if (kind === "video" && !file.type.startsWith("video/")) {
      setNotice("Please choose a video file.");
      return;
    }
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  }

  function clearMedia() {
    setMediaFile(null);
    setMediaPreview("");
  }

  function closeComposer() {
    setShowComposer(false);
    setDraft("");
    clearMedia();
  }

  function publish() {
    if (!draft.trim() && !mediaFile) return;
    const body = draft.trim() || (composerMode === "photo" ? "Shared a photo." : composerMode === "video" ? "Shared a video." : "");
    const newPost: Post = {
      id: Date.now(),
      name: "You",
      handle: "your.profile",
      country: "Your corner of the world",
      time: "Just now",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377d6b?w=120&h=120&fit=crop&crop=faces",
      body,
      ...(mediaFile && composerMode === "photo" ? { image: mediaPreview } : {}),
      ...(mediaFile && composerMode === "video" ? { video: mediaPreview } : {}),
      likes: 0,
      comments: 0,
      tag: composerMode === "discussion" ? "Discussion" : "Community"
    };
    setPosts(current => [newPost, ...current]);
    setDraft("");
    setMediaFile(null);
    setMediaPreview("");
    setShowComposer(false);
    setNotice("Your post was added to this preview feed. Media is available in this browser session.");
    window.setTimeout(() => setNotice(""), 4500);
  }
  const navItems = [{label:"Home",icon:Home},{label:"Explore",icon:Compass},{label:"Communities",icon:Users},{label:"Messages",icon:MessageCircle},{label:"Opportunities",icon:BriefcaseBusiness},{label:"Saved",icon:Bookmark}];

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark"><Globe2 size={23}/></span><span>world<span className="brand-accent">connect</span></span></a>
        <div className="top-search"><Search size={17}/><input aria-label="Search WorldConnect" placeholder="Search people, topics and communities" value={search} onChange={e=>setSearch(e.target.value)}/><kbd>⌘ K</kbd></div>
        <div className="top-actions"><button className="icon-button mobile-only" aria-label="Open menu" onClick={()=>setMobileMenu(!mobileMenu)}><Menu size={20}/></button><button className="icon-button" aria-label="Language"><Languages size={19}/></button><button className="icon-button notification" aria-label="Notifications" onClick={()=>setNotice("You're all caught up!") }><Bell size={19}/><i/></button><div className="profile-menu"><a className="profile-chip" href="/login" aria-label={user ? `Signed in as ${profileName}. Open profile` : "Sign in to WorldConnect"}><span className="profile-icon"><UserRound size={19}/></span><span>{user ? profileName : "Sign in / Profile"}</span></a>{user&&<button className="profile-signout" onClick={signOut}><LogOut size={14}/> Sign out</button>}</div></div>
      </header>
      <div className="layout">
        <aside className={`left-sidebar ${mobileMenu ? "open" : ""}`}>
          <div className="sidebar-label">MENU</div>
          <nav>{navItems.map(({label,icon:Icon})=><button key={label} className={`nav-link ${(tab===label || (label==="Home" && tab==="For you"))?"active":""}`} onClick={()=>{setTab(label==="Home"?"For you":label);setMobileMenu(false);if(label!=="Home"&&label!=="Explore")setNotice(label+" is coming in the next release.");}}><Icon size={19}/><span>{label}</span>{label==="Messages"&&<b className="nav-count">3</b>}</button>)}</nav>
          <div className="sidebar-divider"/>
          <div className="sidebar-label">YOUR SPACES</div>
          <button className="space-link" onClick={()=>{setTab("Learning Circle");setNotice("Learning Circle preview selected.");}}><span className="space-dot purple">✦</span>Learning Circle</button>
          <button className="space-link" onClick={()=>{setTab("Creators Hub");setNotice("Creators Hub preview selected.");}}><span className="space-dot orange">◈</span>Creators Hub</button>
          <button className="space-link" onClick={()=>{setTab("Tech for Good");setNotice("Tech for Good preview selected.");}}><span className="space-dot green">⌘</span>Tech for Good</button>
          <button className="create-space" onClick={()=>setNotice("Community creation will be enabled with account setup.")}><Plus size={16}/> Create a community</button>
          <div className="sidebar-bottom"><div className="upgrade-card"><div className="upgrade-icon"><Sparkles size={17}/></div><strong>Make an impact</strong><p>Bring your ideas to a global community.</p><button onClick={()=>setNotice("Creator tools are on the roadmap.")}>Explore creator tools <ArrowUpRight size={14}/></button></div><div className="sidebar-footer">About · Guidelines · Privacy<br/>© 2026 WorldConnect</div></div>
        </aside>

        <section className="feed-column">
          <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> THE WORLD, IN ONE PLACE</div><h1>Your world. <em>Your people.</em></h1><p>Ideas travel further when we connect.</p></div><div className="world-orb"><Globe2 size={37}/><span>195+ countries</span></div></div>
          <div className="feed-tabs"><button className={tab==="For you"?"selected":""} onClick={()=>setTab("For you")}>For you</button><button className={tab==="Following"?"selected":""} onClick={()=>setTab("Following")}>Following</button><button className={tab==="Latest"?"selected":""} onClick={()=>setTab("Latest")}>Latest</button><span className="feed-filter"><Sparkles size={14}/> Personalized</span></div>
          <div className="composer">
            <img className="avatar" src="https://images.unsplash.com/photo-1535713875002-d1d0cf377d6b?w=100&h=100&fit=crop&crop=faces" alt="Your avatar"/>
            <button className="composer-prompt" onClick={()=>{setComposerMode("discussion");setShowComposer(true);}}>Share an idea with the world...</button>
            <button className="composer-add" aria-label="Create post" onClick={()=>{setComposerMode("discussion");setShowComposer(true);}}><Plus size={20}/></button>
            <div className="composer-tools">
              <button type="button" onClick={()=>openMediaPicker("photo")}><ImagePlus size={17}/> Photo</button>
              <button type="button" onClick={()=>openMediaPicker("video")}><Video size={17}/> Video</button>
              <button type="button" onClick={()=>{setComposerMode("discussion");setShowComposer(true);}}><MessageSquareText size={17}/> Discussion</button>
            </div>
          </div>
          <input ref={photoInputRef} className="file-picker-input" type="file" accept="image/*" aria-label="Choose a photo from your device" onChange={e=>handleMediaChange(e,"photo")}/>
          <input ref={videoInputRef} className="file-picker-input" type="file" accept="video/*" aria-label="Choose a video from your device" onChange={e=>handleMediaChange(e,"video")}/>
          {notice&&<div className="notice" role="status"><Check size={16}/>{notice}<button aria-label="Dismiss" onClick={()=>setNotice("")}><X size={15}/></button></div>}
          {showComposer&&<div className="modal-backdrop" onClick={closeComposer}><div className="composer-modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-head"><strong>{composerMode==="photo"?"Share a photo":composerMode==="video"?"Share a video":"Start a discussion"}</strong><button className="icon-button" aria-label="Close composer" onClick={closeComposer}><X size={19}/></button></div>
            <textarea autoFocus maxLength={2000} placeholder={composerMode==="discussion"?"Write a paragraph or tell your story...":"Add a caption or tell the story behind your media..."} value={draft} onChange={e=>setDraft(e.target.value)}/>
            {mediaPreview&&<div className="media-preview">
              {composerMode==="photo"?<img src={mediaPreview} alt="Selected photo preview"/>:<video src={mediaPreview} controls playsInline aria-label="Selected video preview"/>}
              <button type="button" className="remove-media" onClick={clearMedia}>Remove attachment</button>
              <span>{mediaFile?.name}</span>
            </div>}
            <div className="modal-foot"><span>{draft.length}/2000</span><button className="primary-button" disabled={!draft.trim()&&!mediaFile} onClick={publish}>Share with the world <Send size={15}/></button></div>
          </div></div>}
          <div className="post-list">{visiblePosts.map(post=><article className="post-card" key={post.id}>
            <div className="post-head"><img className="avatar" src={post.avatar} alt=""/><div className="post-author"><strong>{post.name} {post.verified&&<ShieldCheck className="verified" size={15}/>}</strong><span>@{post.handle} · {post.country}</span></div><span className="post-time">{post.time}</span><button className="icon-button more-button" aria-label="More post options" onClick={()=>setNotice("Post options will be available after sign-in.")}><MoreHorizontal size={20}/></button></div>
            <p className="post-body">{post.body}</p>
            {post.image&&<img className="post-image" src={post.image} alt="Community shared photo"/>}
            {post.video&&<video className="post-video" src={post.video} controls playsInline preload="metadata" aria-label="Community shared video"/>}
            <div className="post-tag"><Hash size={13}/>{post.tag}</div>
            <div className="post-stats"><span>{post.likes.toLocaleString()} appreciations</span><button className="comment-count" onClick={()=>{setCommentPost(post);setCommentDraft("");}}>{post.comments + (commentsByPost[post.id]?.length || 0)} comments</button></div>
            <div className="post-actions"><button className={post.liked?"liked":""} onClick={()=>toggleLike(post.id)}><Heart size={18} fill={post.liked?"currentColor":"none"}/> Appreciate</button><button onClick={()=>{setCommentPost(post);setCommentDraft("");}}><MessageCircle size={18}/> Comment</button><button onClick={()=>sharePost(post)}><Send size={17}/> Share</button><button className="save-action" onClick={()=>setNotice("Saved items will sync after sign-in.")}><Bookmark size={17}/></button></div>
          </article>)}</div>
          {visiblePosts.length===0&&<div className="empty-state"><Search size={24}/><strong>No matching posts</strong><span>Try another keyword to explore the community.</span></div>}
          <div className="end-feed"><span/><Globe2 size={17}/><span/> You're at the edge of this preview <span/></div>
        </section>

        <aside className="right-sidebar">
          <div className="world-card"><div className="world-card-top"><span className="eyebrow">GLOBAL PULSE</span><span className="pulse-live"><i/> LIVE</span></div><div className="pulse-map"><div className="map-grid"/><div className="map-glow"/><span className="map-point p1"/><span className="map-point p2"/><span className="map-point p3"/><span className="map-point p4"/><Globe2 size={77} strokeWidth={.8}/></div><div className="pulse-stats"><div><strong>195+</strong><span>Countries</span></div><div><strong>∞</strong><span>Possibilities</span></div><div><strong>1</strong><span>Community</span></div></div><p>Different places. Shared humanity.</p></div>
          <div className="side-card"><div className="side-heading"><h3>Trending worldwide</h3><button onClick={()=>setTab("Explore")}>See all</button></div>{trends.map((t,i)=><button className="trend-row" key={t.tag} onClick={()=>{setSearch(t.tag.replace("#",""));setTab("Explore");}}><span className="trend-number">0{i+1}</span><span><strong>#{t.tag}</strong><small>{t.posts}</small></span><ArrowUpRight size={15}/></button>)}</div>
          <div className="side-card people-card"><div className="side-heading"><h3>People to discover</h3><button onClick={()=>setTab("Explore")}>Explore</button></div>{people.map(p=><div className="person-row" key={p.name}><img src={p.avatar} alt=""/><span><strong>{p.name}</strong><small>{p.role}</small></span><button className={following.includes(p.name)?"following":""} onClick={()=>setFollowing(v=>v.includes(p.name)?v.filter(n=>n!==p.name):[...v,p.name])}>{following.includes(p.name)?<Check size={15}/>:<Plus size={15}/>}</button></div>)}</div>
          <div className="join-note"><Sparkles size={17}/><p><strong>A bigger world starts with a hello.</strong><br/>Invite a friend to make this community more connected.</p><button onClick={()=>setNotice("Invite links will be available after launch.")}>Invite people <ArrowUpRight size={14}/></button></div>
          <div className="preview-label"><span/> PREVIEW EXPERIENCE · DEMO CONTENT</div>
        </aside>
      </div>
      {commentPost&&<div className="modal-backdrop" onClick={()=>setCommentPost(null)}><section className="composer-modal comment-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><strong>Comments</strong><button className="icon-button" aria-label="Close comments" onClick={()=>setCommentPost(null)}><X size={19}/></button></div><p className="comment-context">Replying to <b>{commentPost.name}</b>: {commentPost.body}</p><div className="comment-list">{(commentsByPost[commentPost.id]||[]).map((comment,index)=><div className="comment-item" key={`${commentPost.id}-${index}`}><span className="comment-avatar"><UserRound size={15}/></span><p><b>{user?.user_metadata?.display_name || "You"}</b><br/>{comment}</p></div>)}{!(commentsByPost[commentPost.id]||[]).length&&<p className="comment-empty">Be the first to join this conversation.</p>}</div><textarea className="comment-input" rows={3} maxLength={1000} placeholder="Write a thoughtful comment..." value={commentDraft} onChange={e=>setCommentDraft(e.target.value)}/><div className="modal-foot"><span>{commentDraft.length}/1000 · Preview comments stay in this session</span><button className="primary-button" disabled={!commentDraft.trim()} onClick={submitComment}>Post comment <Send size={15}/></button></div></section></div>}\n      {commentPost&&<div className="modal-backdrop" onClick={()=>setCommentPost(null)}><section className="composer-modal comment-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><strong>Comments</strong><button className="icon-button" aria-label="Close comments" onClick={()=>setCommentPost(null)}><X size={19}/></button></div><p className="comment-context">Replying to <b>{commentPost.name}</b>: {commentPost.body}</p><div className="comment-list">{(commentsByPost[commentPost.id]||[]).map((comment,index)=><div className="comment-item" key={`${commentPost.id}-${index}`}><span className="comment-avatar"><UserRound size={15}/></span><p><b>{user?.user_metadata?.display_name || "You"}</b><br/>{comment}</p></div>)}{!(commentsByPost[commentPost.id]||[]).length&&<p className="comment-empty">Be the first to join this conversation.</p>}</div><textarea className="comment-input" rows={3} maxLength={1000} placeholder="Write a thoughtful comment..." value={commentDraft} onChange={e=>setCommentDraft(e.target.value)}/><div className="modal-foot"><span>{commentDraft.length}/1000 · Preview comments stay in this session</span><button className="primary-button" disabled={!commentDraft.trim()} onClick={submitComment}>Post comment <Send size={15}/></button></div></section></div>}
      <footer className="mobile-bottom"><button onClick={()=>setTab("For you")}><Home size={19}/><span>Home</span></button><button onClick={()=>setTab("Explore")}><Compass size={19}/><span>Explore</span></button><button onClick={()=>setShowComposer(true)}><Plus size={21}/><span>Create</span></button><button onClick={()=>setNotice("Messages are coming soon.")}><MessageCircle size={19}/><span>Chats</span></button><button onClick={()=>{window.location.href="/login";}}><UserRound size={19}/><span>Profile</span></button></footer>
    </main>
  );
}
