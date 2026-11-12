"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Send, Search, LoaderCircle, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase";

type Thread={id:string;userId:string;label:string;username:string;last:string;lastAt:string};
type ProfileSummary={id:string;display_name:string|null;username:string|null;avatar_url?:string|null};
type Message={id:string;conversation_id:string;sender_id:string;body:string;created_at:string};

export default function MessagesPage(){
 const [userId,setUserId]=useState("");
 const [threads,setThreads]=useState<Thread[]>([]);
 const [selected,setSelected]=useState("");
 const [messages,setMessages]=useState<Message[]>([]);
 const [query,setQuery]=useState("");
 const [results,setResults]=useState<ProfileSummary[]>([]);
 const [searching,setSearching]=useState(false);
 const [draft,setDraft]=useState("");
 const [notice,setNotice]=useState("Loading inbox…");
 const [busyId,setBusyId]=useState("");

 async function load(){
  const supabase=createClient();
  if(!supabase){setNotice("Connect Supabase and run the database setup to enable messages.");return;}
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){window.location.href="/login";return;}
  setUserId(user.id);
  const {data:mine,error}=await supabase.from("wc_conversation_members").select("conversation_id").eq("user_id",user.id);
  if(error){setNotice(error.message);return;}
  const ids=(mine||[]).map(x=>x.conversation_id);
  if(!ids.length){
   setThreads([]);
   const requested=new URLSearchParams(window.location.search).get("conversation");
   if(requested)setSelected(requested);
   setNotice("Your inbox is empty. Search for a member to start a conversation.");
   return;
  }
  const [{data:members},{data:allMessages}]=await Promise.all([
   supabase.from("wc_conversation_members").select("conversation_id,user_id").in("conversation_id",ids),
   supabase.from("wc_messages").select("id,conversation_id,sender_id,body,created_at").in("conversation_id",ids).order("created_at",{ascending:false})
  ]);
  const otherIds=Array.from(new Set((members||[]).filter(x=>x.user_id!==user.id).map(x=>x.user_id)));
  const profileResult=otherIds.length?await supabase.from("wc_profiles").select("id,display_name,username").in("id",otherIds):{data:[] as ProfileSummary[]};
  const profiles=(profileResult.data||[]) as ProfileSummary[];
  const next=ids.map(id=>{
   const other=(members||[]).find(x=>x.conversation_id===id&&x.user_id!==user.id);
   const profile=profiles.find(x=>x.id===other?.user_id);
   const last=(allMessages||[]).find(x=>x.conversation_id===id);
   return{id,userId:other?.user_id||"",label:profile?.display_name||profile?.username||"WorldConnect member",username:profile?.username||"",last:last?.body||"Start the conversation",lastAt:last?.created_at||"1970-01-01T00:00:00.000Z"};
  }).sort((a,b)=>Date.parse(b.lastAt)-Date.parse(a.lastAt));
  setThreads(next);
  setNotice("");
  const requested=new URLSearchParams(window.location.search).get("conversation");
  if(requested&&ids.includes(requested))setSelected(requested);
  else if(!selected&&next[0])setSelected(next[0].id);
  if(selected&&!ids.includes(selected))setSelected(next[0]?.id||"");
 }
 useEffect(()=>{void load();},[]);

 useEffect(()=>{
  if(!selected||!userId)return;
  const supabase=createClient();if(!supabase)return;
  supabase.from("wc_messages").select("id,conversation_id,sender_id,body,created_at").eq("conversation_id",selected).order("created_at",{ascending:true})
   .then(({data,error})=>{if(error)setNotice(error.message);else setMessages((data||[]) as Message[]);});
 },[selected,userId]);

 async function searchMembers(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const term=query.trim().replace(/^@/,"").replace(/[,%()]/g," ").replace(/\s+/g," ");
  if(!term){setResults([]);setNotice("Enter a member name or username to search.");return;}
  const supabase=createClient();if(!supabase)return;
  setSearching(true);setNotice("");
  // Query each indexed profile field separately so user input never becomes
  // part of a PostgREST .or() expression.
  const safe=term.replace(/[%_]/g,"").trim();
  if(!safe){setSearching(false);setResults([]);setNotice("Enter a valid member name or username.");return;}
  const [usernameResult,nameResult]=await Promise.all([
   supabase.from("wc_profiles").select("id,display_name,username,avatar_url").neq("id",userId).ilike("username",`%${safe}%`).order("username",{ascending:true}).limit(20),
   supabase.from("wc_profiles").select("id,display_name,username,avatar_url").neq("id",userId).ilike("display_name",`%${safe}%`).order("display_name",{ascending:true}).limit(20)
  ]);
  setSearching(false);
  const error=usernameResult.error||nameResult.error;
  if(error){setResults([]);setNotice("Member search failed: "+error.message);return;}
  const unique=new Map<string,ProfileSummary>();
  for(const person of [...(usernameResult.data||[]),...(nameResult.data||[])])unique.set(person.id,person as ProfileSummary);
  const data=Array.from(unique.values()).sort((a,b)=>(a.display_name||a.username||"").localeCompare(b.display_name||b.username||"")).slice(0,20);
  setResults(data);
  if(!data.length)setNotice("No registered member matched that name. Try their username.");
 }

 async function start(person:ProfileSummary){
  const supabase=createClient();if(!supabase)return;
  if(!userId){window.location.href="/login";return;}
  if(person.id===userId){setNotice("You cannot start a conversation with yourself.");return;}
  setBusyId(person.id);setNotice("");
  const existing=threads.find(thread=>thread.userId===person.id);
  if(existing){setSelected(existing.id);setBusyId("");setResults([]);setQuery("");return;}
  const {data:conversationId,error}=await supabase.rpc("wc_start_conversation",{target_user:person.id});
  setBusyId("");
  if(error){setNotice("Could not start conversation: "+error.message);return;}
  setResults([]);setQuery("");
  await load();
  setSelected(conversationId as string);
  window.history.replaceState(null,"",`/messages?conversation=${conversationId}`);
  setNotice("Conversation ready. Send your first message.");
 }

 async function send(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!draft.trim()||!selected)return;
  const supabase=createClient();if(!supabase)return;
  const body=draft.trim();
  const {error}=await supabase.from("wc_messages").insert({conversation_id:selected,sender_id:userId,body});
  if(error){setNotice(error.message);return;}
  setDraft("");
  const {data}=await supabase.from("wc_messages").select("id,conversation_id,sender_id,body,created_at").eq("conversation_id",selected).order("created_at",{ascending:true});
  setMessages((data||[]) as Message[]);
  await load();
 }
 const active=threads.find(x=>x.id===selected);
 return <main className="feature-page">
  <Link href="/" className="feature-back"><ArrowLeft size={16}/> WorldConnect</Link>
  <header className="feature-heading"><span><MessageCircle size={22}/></span><div><h1>Messages</h1><p>Find registered members and start private conversations.</p></div></header>
  <form className="message-start" onSubmit={searchMembers}>
   <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by name or @username…" aria-label="Search registered members" required/>
   <button className="feature-primary" disabled={searching}>{searching?<LoaderCircle className="auth-spin"/>:<Search size={15}/>} Search</button>
  </form>
  {results.length>0&&<section className="message-search-results" aria-label="Member search results">
   <div className="feature-toolbar"><strong>Matching members</strong><span>{results.length} found</span></div>
   {results.map(person=><div className="message-search-person" key={person.id}>
    {person.avatar_url?<img src={person.avatar_url} alt=""/>:<span className="message-search-avatar"><UserRound size={18}/></span>}
    <Link href={`/members/${encodeURIComponent(person.username||"")}`}><strong>{person.display_name||person.username}</strong><small>@{person.username}</small></Link>
    <button className="feature-primary" disabled={busyId===person.id} onClick={()=>void start(person)}>{busyId===person.id?<LoaderCircle className="auth-spin"/>:"Message"}</button>
   </div>)}
  </section>}
  {notice&&<p className="feature-notice" role="status">{notice}</p>}
  <section className="messages-layout">
   <aside className="thread-list">{threads.map(thread=><button key={thread.id} className={selected===thread.id?"thread-active":""} onClick={()=>setSelected(thread.id)}><strong>{thread.label}</strong><small>@{thread.username}</small><span>{thread.last}</span></button>)}</aside>
   <div className="chat-panel">{active?<><header><Link href={`/members/${encodeURIComponent(active.username)}`}><strong>{active.label}</strong></Link><small>@{active.username}</small></header><div className="chat-messages">{messages.map(message=><div key={message.id} className={message.sender_id===userId?"message-own":"message-other"}>{message.body}<time>{new Date(message.created_at).toLocaleString()}</time></div>)}</div><form className="chat-compose" onSubmit={send}><input value={draft} onChange={e=>setDraft(e.target.value)} maxLength={4000} placeholder="Write a message…" required/><button className="feature-primary" aria-label="Send message"><Send size={16}/></button></form></>:<div className="chat-empty"><MessageCircle size={28}/><strong>Select a conversation</strong><span>Search for a member above to start chatting.</span></div>}</div>
  </section>
 </main>;
}
