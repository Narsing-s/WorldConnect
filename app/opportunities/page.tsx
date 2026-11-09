"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, ExternalLink, Plus, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";

type Opportunity = { id:string; title:string; description:string; opportunity_type:string; location:string; application_url:string|null; created_at:string; wc_profiles?:{display_name:string;username:string}|null };

export default function OpportunitiesPage() {
  const [items,setItems]=useState<Opportunity[]>([]);
  const [userId,setUserId]=useState("");
  const [showForm,setShowForm]=useState(false);
  const [title,setTitle]=useState("");
  const [description,setDescription]=useState("");
  const [kind,setKind]=useState("Job");
  const [location,setLocation]=useState("Remote");
  const [url,setUrl]=useState("");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("Loading opportunities…");

  async function load() {
    const supabase=createClient();
    if(!supabase){setNotice("Connect Supabase and run supabase/schema.sql to enable the opportunity board.");return;}
    const [{data:userData},{data,error}]=await Promise.all([supabase.auth.getUser(),supabase.from("wc_opportunities").select("id,title,description,opportunity_type,location,application_url,created_at,wc_profiles(display_name,username)").order("created_at",{ascending:false}).limit(100)]);
    setUserId(userData.user?.id||"");
    if(error){setNotice("Could not load opportunities: "+error.message);return;}
    setItems((data||[]) as unknown as Opportunity[]);
    setNotice(data?.length ? "" : "No opportunities yet. Be the first to share one.");
  }
  useEffect(()=>{void load();},[]);

  async function publish(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const supabase=createClient();if(!supabase){setNotice("Supabase is not connected.");return;}
    const {data:{user}}=await supabase.auth.getUser();if(!user){window.location.href="/login";return;}
    setBusy(true);
    const {error}=await supabase.from("wc_opportunities").insert({title:title.trim(),description:description.trim(),opportunity_type:kind,location:location.trim()||"Remote",application_url:url.trim()||null,created_by:user.id});
    setBusy(false);if(error){setNotice("Could not publish: "+error.message);return;}
    setTitle("");setDescription("");setUrl("");setShowForm(false);setNotice("Opportunity published.");await load();
  }
  return <main className="feature-page">
    <Link href="/" className="feature-back"><ArrowLeft size={16}/> WorldConnect</Link>
    <header className="feature-heading"><span><BriefcaseBusiness size={22}/></span><div><h1>Opportunities</h1><p>Share jobs, collaborations, volunteering and learning opportunities.</p></div></header>
    <div className="feature-toolbar"><strong>Community board</strong><button className="feature-primary" onClick={()=>userId?setShowForm(v=>!v):window.location.assign("/login")}><Plus size={16}/> Share opportunity</button></div>
    {showForm&&<form className="feature-form" onSubmit={publish}>
      <label>Title<input required minLength={3} maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Junior frontend developer"/></label>
      <label>Type<select value={kind} onChange={e=>setKind(e.target.value)}><option>Job</option><option>Collaboration</option><option>Volunteering</option><option>Event</option><option>Learning</option><option>Other</option></select></label>
      <label>Location<input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Remote or city"/></label>
      <label>Application link<input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…"/></label>
      <label className="feature-wide">Description<textarea required minLength={10} maxLength={3000} rows={4} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe the opportunity, requirements and how to apply."/></label>
      <button className="feature-primary" disabled={busy}>{busy?<LoaderCircle className="auth-spin"/>:"Publish opportunity"}</button>
    </form>}
    {notice&&<p className="feature-notice" role="status">{notice}</p>}
    <section className="opportunity-list">{items.map(item=><article className="opportunity-card" key={item.id}><div className="opportunity-meta"><span>{item.opportunity_type}</span><time>{new Date(item.created_at).toLocaleDateString()}</time></div><h2>{item.title}</h2><p>{item.description}</p><div className="opportunity-footer"><span>{item.location} · {item.wc_profiles?.display_name||"Community member"}</span>{item.application_url&&<a href={item.application_url} target="_blank" rel="noreferrer">Apply / Learn more <ExternalLink size={14}/></a>}{userId===items.find(x=>x.id===item.id)?.wc_profiles?.username&&null}</div></article>)}</section>
  </main>;
}
