"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Send, Search, LoaderCircle, UserRound, Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase";

type Thread={id:string;userId:string;label:string;username:string;last:string;lastAt:string;unreadCount:number};
type ProfileSummary={id:string;display_name:string|null;username:string|null;avatar_url?:string|null};
type Message={id:string;conversation_id:string;sender_id:string;body:string;created_at:string;attachment_url?:string|null;attachment_name?:string|null;attachment_type?:string|null;delivery_status?:"sending"|"sent"|"failed"};

export default function MessagesPage(){
 const [userId,setUserId]=useState("");
 const [threads,setThreads]=useState<Thread[]>([]);
 const [selected,setSelected]=useState("");
 const [messages,setMessages]=useState<Message[]>([]);
 const [loadingHistory,setLoadingHistory]=useState(false);
 const [query,setQuery]=useState("");
 const [results,setResults]=useState<ProfileSummary[]>([]);
 const [searching,setSearching]=useState(false);
 const [draft,setDraft]=useState("");
 const [notice,setNotice]=useState("Loading inbox…");
 const [busyId,setBusyId]=useState("");
 const [onlineIds,setOnlineIds]=useState<string[]>([]);
 const [uploading,setUploading]=useState(false);
 const [realtimeState,setRealtimeState]=useState<"connecting"|"connected"|"fallback">("connecting");
 const attachmentInput=useRef<HTMLInputElement>(null);

 async function load(){
  const supabase=createClient();
  if(!supabase){setNotice("Connect Supabase and run the database setup to enable messages.");return;}
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){window.location.href="/login";return;}
  setUserId(user.id);
  const {data:mine,error}=await supabase.from("wc_conversation_members").select("conversation_id,last_read_at").eq("user_id",user.id);
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
   supabase.from("wc_conversation_members").select("conversation_id,user_id,last_read_at").in("conversation_id",ids),
   supabase.from("wc_messages").select("id,conversation_id,sender_id,body,created_at").in("conversation_id",ids).order("created_at",{ascending:false})
  ]);
  const otherIds=Array.from(new Set((members||[]).filter(x=>x.user_id!==user.id).map(x=>x.user_id)));
  const profileResult=otherIds.length?await supabase.from("wc_profiles").select("id,display_name,username").in("id",otherIds):{data:[] as ProfileSummary[]};
  const profiles=(profileResult.data||[]) as ProfileSummary[];
  const unreadCounts=await Promise.all(ids.map(async id=>{
   const ownMember=(mine||[]).find(x=>x.conversation_id===id);
   let request=supabase.from("wc_messages").select("id",{count:"exact",head:true})
    .eq("conversation_id",id).neq("sender_id",user.id);
   if(ownMember?.last_read_at)request=request.gt("created_at",ownMember.last_read_at);
   const result=await request;
   return [id,result.count||0] as const;
  }));
  const unreadByConversation=new Map(unreadCounts);
  const next=ids.map(id=>{
   const other=(members||[]).find(x=>x.conversation_id===id&&x.user_id!==user.id);
   const profile=profiles.find(x=>x.id===other?.user_id);
   const last=(allMessages||[]).find(x=>x.conversation_id===id);
   return{id,userId:other?.user_id||"",label:profile?.display_name||profile?.username||"WorldConnect member",username:profile?.username||"",last:last?.body||"Start the conversation",lastAt:last?.created_at||"1970-01-01T00:00:00.000Z",unreadCount:unreadByConversation.get(id)||0};
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
  if(!userId)return;
  const supabase=createClient();if(!supabase)return;
  const channel=supabase.channel("wc-online-presence",{config:{presence:{key:userId}}});
  const refresh=()=>setOnlineIds(Object.keys(channel.presenceState()));
  channel.on("presence",{event:"sync"},refresh).on("presence",{event:"join"},refresh).on("presence",{event:"leave"},refresh).subscribe(async status=>{
   if(status==="SUBSCRIBED"){await channel.track({user_id:userId,online_at:new Date().toISOString()});refresh();}
  });
  return()=>{void supabase.removeChannel(channel);};
 },[userId]);

 async function markConversationRead(conversationId:string){
  if(!userId||!conversationId)return;
  const supabase=createClient();if(!supabase)return;
  const readAt=new Date().toISOString();
  const {error}=await supabase.from("wc_conversation_members")
   .update({last_read_at:readAt})
   .eq("conversation_id",conversationId).eq("user_id",userId);
  if(!error)setThreads(current=>current.map(thread=>thread.id===conversationId?{...thread,unreadCount:0}:thread));
 }

 useEffect(()=>{
  if(!selected||!userId)return;
  void markConversationRead(selected);
 },[selected,userId]);

 useEffect(()=>{
  if(!userId)return;
  const supabase=createClient();if(!supabase)return;
  const channel=supabase.channel("wc-inbox-unread-"+userId)
   .on("postgres_changes",{event:"INSERT",schema:"public",table:"wc_messages"},payload=>{
    const incoming=payload.new as Message;
    if(incoming.sender_id===userId)return;
    if(incoming.conversation_id===selected){
     void markConversationRead(incoming.conversation_id);
    }else{
     setThreads(current=>current.map(thread=>thread.id===incoming.conversation_id
      ?{...thread,last:incoming.body,lastAt:incoming.created_at,unreadCount:thread.unreadCount+1}:thread));
    }
   }).subscribe(status=>{
    setRealtimeState(status==="SUBSCRIBED"?"connected":"fallback");
   });
  // Poll as a delivery fallback if Realtime is disabled, disconnected, or delayed.
  const fallbackPoll=window.setInterval(async()=>{
   const {data}=await supabase.from("wc_messages")
    .select("id,conversation_id,sender_id,body,created_at,attachment_url,attachment_name,attachment_type")
    .eq("conversation_id",selected).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(100);
   if(!data)return;
   const latest=(data as Message[]).reverse();
   setMessages(current=>{
    const unique=new Map<string,Message>();
    for(const message of [...current,...latest])unique.set(message.id,message);
    return Array.from(unique.values()).sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)||a.id.localeCompare(b.id));
   });
  },4000);
  return()=>{window.clearInterval(fallbackPoll);void supabase.removeChannel(channel);};
 },[userId,selected]);

 useEffect(()=>{
  if(!selected||!userId)return;
  const supabase=createClient();if(!supabase)return;
  let active=true;
  setMessages([]);
  setLoadingHistory(true);
  setNotice("");
  const fetchCompleteHistory=async()=>{
   const collected:Message[]=[];
   let cursor:Message|undefined;
   const pageSize=500;
   while(active){
    let request=supabase.from("wc_messages")
     .select("id,conversation_id,sender_id,body,created_at,attachment_url,attachment_name,attachment_type")
     .eq("conversation_id",selected)
     .order("created_at",{ascending:false})
     .order("id",{ascending:false})
     .limit(pageSize);
    if(cursor){
     request=request.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
    }
    const {data,error}=await request;
    if(!active)return;
    if(error){setNotice("Could not load chat history: "+error.message);break;}
    const page=(data||[]) as Message[];
    collected.push(...page);
    if(active){
     setMessages(current=>{
      const unique=new Map<string,Message>();
      for(const message of [...current,...page])unique.set(message.id,message);
      return Array.from(unique.values()).sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)||a.id.localeCompare(b.id));
     });
    }
    if(page.length<pageSize)break;
    cursor=page[page.length-1];
   }
   if(active)setLoadingHistory(false);
  };
  void fetchCompleteHistory();
  const channel=supabase.channel("wc-chat-"+selected)
   .on("postgres_changes",{event:"INSERT",schema:"public",table:"wc_messages",filter:`conversation_id=eq.${selected}`},payload=>{
    const incoming=payload.new as Message;
    if(incoming.sender_id===userId)return;
    setMessages(current=>current.some(message=>message.id===incoming.id)?current:[...current,incoming].sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)||a.id.localeCompare(b.id)));
   })
   .subscribe();
  return()=>{active=false;void supabase.removeChannel(channel);};
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

 async function persistTextMessage(message:Message){
  const supabase=createClient();if(!supabase)return false;
  setMessages(current=>current.map(item=>item.id===message.id?{...item,delivery_status:"sending"}:item));
  const payload={id:message.id,conversation_id:message.conversation_id,sender_id:userId,body:message.body};
  const {data,error}=await supabase.from("wc_messages").insert(payload)
   .select("id,conversation_id,sender_id,body,created_at,attachment_url,attachment_name,attachment_type").single();
  if(!error&&data){
   setMessages(current=>current.map(item=>item.id===message.id?{...data as Message,delivery_status:"sent"}:item));
   return true;
  }
  // A timeout can happen after the database committed. Verify by the stable UUID
  // before showing failure, so retries never create duplicate messages.
  const {data:existing}=await supabase.from("wc_messages")
   .select("id,conversation_id,sender_id,body,created_at,attachment_url,attachment_name,attachment_type")
   .eq("id",message.id).maybeSingle();
  if(existing){
   setMessages(current=>current.map(item=>item.id===message.id?{...existing as Message,delivery_status:"sent"}:item));
   return true;
  }
  setMessages(current=>current.map(item=>item.id===message.id?{...item,delivery_status:"failed"}:item));
  setNotice("Message not delivered: "+(error?.message||"Please check your connection and retry."));
  return false;
 }
 async function retryMessage(message:Message){
  setNotice("");
  await persistTextMessage(message);
 }
 async function send(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!draft.trim()||!selected)return;
  const body=draft.trim();
  const optimistic:Message={id:crypto.randomUUID(),conversation_id:selected,sender_id:userId,body,created_at:new Date().toISOString(),delivery_status:"sending"};
  setMessages(current=>[...current,optimistic]);
  setDraft("");
  setNotice("");
  setThreads(current=>current.map(thread=>thread.id===selected?{...thread,last:body,lastAt:optimistic.created_at}:thread));
  await persistTextMessage(optimistic);
 }
 const active=threads.find(x=>x.id===selected);
 const totalUnread=threads.reduce((sum,thread)=>sum+thread.unreadCount,0);
 const isOnline=(id:string)=>onlineIds.includes(id);

 async function attachFile(event:React.ChangeEvent<HTMLInputElement>){
  const file=event.target.files?.[0];event.target.value="";if(!file||!selected||!userId)return;
  if(!file.type.startsWith("image/")&&!file.type.startsWith("video/")){setNotice("Please attach an image or video.");return;}
  if(file.size>50*1024*1024){setNotice("Attachment must be 50 MB or smaller.");return;}
  const supabase=createClient();if(!supabase)return;
  const conversationAtSend=selected;
  const body=draft.trim()||file.name;
  const temporaryId=`pending-file-${crypto.randomUUID()}`;
  const previewUrl=URL.createObjectURL(file);
  const optimistic:Message={id:temporaryId,conversation_id:conversationAtSend,sender_id:userId,body,created_at:new Date().toISOString(),attachment_url:previewUrl,attachment_name:file.name,attachment_type:file.type};
  setMessages(current=>[...current,optimistic]);
  setUploading(true);setNotice("");
  const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-100)||"attachment";
  const path=`${userId}/messages/${Date.now()}-${safeName}`;
  const {error:uploadError}=await supabase.storage.from("worldconnect-media").upload(path,file,{contentType:file.type,upsert:false});
  if(uploadError){
   URL.revokeObjectURL(previewUrl);setMessages(current=>current.filter(message=>message.id!==temporaryId));
   setUploading(false);setNotice("Attachment upload failed: "+uploadError.message);return;
  }
  const {data:publicData}=supabase.storage.from("worldconnect-media").getPublicUrl(path);
  const {data,error:messageError}=await supabase.from("wc_messages")
   .insert({conversation_id:conversationAtSend,sender_id:userId,body,attachment_url:publicData.publicUrl,attachment_name:file.name,attachment_type:file.type})
   .select("id,conversation_id,sender_id,body,created_at,attachment_url,attachment_name,attachment_type")
   .single();
  setUploading(false);
  if(messageError||!data){
   URL.revokeObjectURL(previewUrl);setMessages(current=>current.filter(message=>message.id!==temporaryId));
   setNotice("File uploaded, but the message could not be saved: "+(messageError?.message||"No message record was returned"));return;
  }
  URL.revokeObjectURL(previewUrl);
  setMessages(current=>current.map(message=>message.id===temporaryId?data as Message:message));
  setDraft("");
  setThreads(current=>current.map(thread=>thread.id===conversationAtSend?{...thread,last:body,lastAt:data.created_at}:thread));
 }
 return <main className="feature-page">
  <Link href="/" className="feature-back"><ArrowLeft size={16}/> WorldConnect</Link>
  <header className="feature-heading"><span><MessageCircle size={22}/></span><div><h1>Messages <span className="message-total-count">{totalUnread}</span></h1><p>Find registered members and start private conversations.</p></div></header>
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
   <aside className="thread-list">{threads.map(thread=><button key={thread.id} className={selected===thread.id?"thread-active":""} onClick={()=>setSelected(thread.id)}><strong><i className={isOnline(thread.userId)?"presence-dot is-online":"presence-dot"} aria-label={isOnline(thread.userId)?"Online":"Offline"}/>{thread.label}{thread.unreadCount>0&&<em className="thread-count" aria-label={`${thread.unreadCount} unread messages`}>{thread.unreadCount}</em>}</strong><small>@{thread.username} · {isOnline(thread.userId)?"Online":"Offline"}</small><span>{thread.last}</span></button>)}</aside>
   <div className="chat-panel">{active?<><header><Link href={`/members/${encodeURIComponent(active.username)}`}><strong><i className={isOnline(active.userId)?"presence-dot is-online":"presence-dot"}/>{active.label}</strong></Link><small>@{active.username} · {isOnline(active.userId)?"Online":"Offline"} · {realtimeState==="connected"?"Live updates":"Syncing messages"}</small></header><div className="chat-messages">{loadingHistory&&<p className="chat-history-loading">Loading complete chat history…</p>}{messages.map(message=><div key={message.id} className={message.sender_id===userId?"message-own":"message-other"}>{message.attachment_url&&message.attachment_type?.startsWith("image/")&&<a href={message.attachment_url} target="_blank" rel="noreferrer"><img className="chat-attachment-image" src={message.attachment_url} alt={message.attachment_name||"Image attachment"}/></a>}{message.attachment_url&&message.attachment_type?.startsWith("video/")&&<video className="chat-attachment-video" src={message.attachment_url} controls preload="metadata"/>}{message.body}<time>{new Date(message.created_at).toLocaleString()}{message.sender_id===userId&&message.delivery_status==="sending"?" · Sending…":message.sender_id===userId&&message.delivery_status==="sent"?" · Sent":""}</time>{message.sender_id===userId&&message.delivery_status==="failed"&&<button type="button" className="message-retry" onClick={()=>void retryMessage(message)}>Not delivered · Retry</button>}</div>)}</div><form className="chat-compose" onSubmit={send}><input value={draft} onChange={e=>setDraft(e.target.value)} maxLength={4000} placeholder="Write a message…"/><input ref={attachmentInput} type="file" accept="image/*,video/*" hidden onChange={attachFile}/><button type="button" className="chat-attach" aria-label="Attach image or video" title="Attach image or video" disabled={uploading} onClick={()=>attachmentInput.current?.click()}><Paperclip size={17}/></button><button className="feature-primary" aria-label="Send message" disabled={uploading||!draft.trim()}>{uploading?<LoaderCircle className="auth-spin"/>:<Send size={16}/>}</button></form></>:<div className="chat-empty"><MessageCircle size={28}/><strong>Select a conversation</strong><span>Search for a member above to start chatting.</span></div>}</div>
  </section>
 </main>;
}
