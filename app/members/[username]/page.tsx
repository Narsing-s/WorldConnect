"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Globe2, MessageCircle, UserPlus, UserCheck, LoaderCircle, Image as ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase";

type Profile={id:string;username:string;display_name:string;bio:string;avatar_url:string|null;country:string|null;created_at:string};
type MemberPost={id:string;body:string;image_url:string|null;video_url:string|null;created_at:string;wc_post_likes:{user_id:string}[];wc_comments:{id:string}[]};

export default function MemberProfilePage(){
 const params=useParams<{username:string}>();
 const router=useRouter();
 const username=String(params.username||"").replace(/^@/,"").toLowerCase();
 const [profile,setProfile]=useState<Profile|null>(null);
 const [posts,setPosts]=useState<MemberPost[]>([]);
 const [userId,setUserId]=useState("");
 const [following,setFollowing]=useState(false);
 const [followers,setFollowers]=useState(0);
 const [followingCount,setFollowingCount]=useState(0);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");

 useEffect(()=>{
  let active=true;
  const client=createClient();
  if(!client){setNotice("WorldConnect is not connected to Supabase.");setLoading(false);return;}
  async function load(){
   const {data:{user}}=await client.auth.getUser();
   const {data:member,error}=await client.from("wc_profiles").select("id,username,display_name,bio,avatar_url,country,created_at").eq("username",username).maybeSingle();
   if(!active)return;
   if(error||!member){setNotice(error?.message||"This member profile could not be found.");setLoading(false);return;}
   setProfile(member as Profile);setUserId(user?.id||"");
   const [followersResult,followingResult,postsResult,followResult]=await Promise.all([
    client.from("wc_follows").select("follower_id",{count:"exact",head:true}).eq("following_id",member.id),
    client.from("wc_follows").select("following_id",{count:"exact",head:true}).eq("follower_id",member.id),
    client.from("wc_posts").select("id,body,image_url,video_url,created_at,wc_post_likes(user_id),wc_comments(id)").eq("author_id",member.id).order("created_at",{ascending:false}).limit(50),
    user&&user.id!==member.id?client.from("wc_follows").select("follower_id").eq("follower_id",user.id).eq("following_id",member.id).maybeSingle():Promise.resolve({data:null,error:null})
   ]);
   if(!active)return;
   setFollowers(followersResult.count||0);setFollowingCount(followingResult.count||0);
   setPosts((postsResult.data||[]) as MemberPost[]);
   setFollowing(Boolean(followResult.data));
   if(postsResult.error)setNotice("Profile loaded, but posts could not be loaded: "+postsResult.error.message);
   setLoading(false);
  }
  void load().catch(error=>{if(active){setNotice(error instanceof Error?error.message:"Could not load this profile.");setLoading(false);}});
  return()=>{active=false;};
 },[username]);

 async function toggleFollow(){
  if(!userId){router.push("/login");return;}
  if(!profile||profile.id===userId)return;
  const supabase=createClient();if(!supabase)return;
  setBusy(true);
  const result=following
   ?await supabase.from("wc_follows").delete().eq("follower_id",userId).eq("following_id",profile.id)
   :await supabase.from("wc_follows").insert({follower_id:userId,following_id:profile.id});
  setBusy(false);
  if(result.error){setNotice("Could not update follow: "+result.error.message);return;}
  setFollowing(!following);setFollowers(value=>Math.max(0,value+(following?-1:1)));
 }

 async function messageMember(){
  if(!userId){router.push("/login");return;}
  if(!profile||profile.id===userId)return;
  const supabase=createClient();if(!supabase)return;
  setBusy(true);
  const {data:mine,error}=await supabase.from("wc_conversation_members").select("conversation_id").eq("user_id",userId);
  if(error){setBusy(false);setNotice(error.message);return;}
  const ids=(mine||[]).map(row=>row.conversation_id);
  let conversationId:string|undefined;
  if(ids.length){
   const {data:members}=await supabase.from("wc_conversation_members").select("conversation_id,user_id").in("conversation_id",ids);
   conversationId=(members||[]).find(row=>row.user_id===profile.id)?.conversation_id;
  }
  if(!conversationId){
   const {data,error:startError}=await supabase.rpc("wc_start_conversation",{target_user:profile.id});
   if(startError){setBusy(false);setNotice(startError.message);return;}
   conversationId=data as string;
  }
  setBusy(false);router.push(`/messages?conversation=${conversationId}`);
 }

 if(loading)return <main className="feature-page"><Link href="/" className="feature-back"><ArrowLeft size={16}/> WorldConnect</Link><p className="feature-notice"><LoaderCircle className="auth-spin"/> Loading member profile…</p></main>;
 if(!profile)return <main className="feature-page"><Link href="/" className="feature-back"><ArrowLeft size={16}/> WorldConnect</Link><p className="feature-notice">{notice||"Member not found."}</p></main>;

 const ownProfile=profile.id===userId;
 return <main className="feature-page member-profile-page">
  <Link href="/" className="feature-back"><ArrowLeft size={16}/> Back to WorldConnect</Link>
  <section className="member-profile-card">
   <div className="member-profile-cover"><Globe2 size={42}/></div>
   <div className="member-profile-main">
    <img className="member-profile-avatar" src={profile.avatar_url||"https://images.unsplash.com/photo-1535713875002-d1d0cf377d6b?w=160&h=160&fit=crop&crop=faces"} alt={profile.display_name}/>
    <div className="member-profile-actions">
     {ownProfile?<Link className="feature-primary" href="/profile">Edit profile</Link>:<>
      <button className="feature-secondary" onClick={()=>void toggleFollow()} disabled={busy}>{following?<><UserCheck size={15}/> Following</>:<><UserPlus size={15}/> Follow</>}</button>
      <button className="feature-primary" onClick={()=>void messageMember()} disabled={busy}><MessageCircle size={15}/> Message</button>
     </>}
    </div>
    <h1>{profile.display_name||profile.username}</h1>
    <p className="member-profile-handle">@{profile.username}</p>
    {profile.country&&<p className="member-profile-country"><Globe2 size={14}/>{profile.country}</p>}
    {profile.bio&&<p className="member-profile-bio">{profile.bio}</p>}
    <div className="member-profile-stats"><span><strong>{followers.toLocaleString()}</strong> Followers</span><span><strong>{followingCount.toLocaleString()}</strong> Following</span><span><strong>{posts.length.toLocaleString()}</strong> Posts</span></div>
   </div>
  </section>
  {notice&&<p className="feature-notice" role="status">{notice}</p>}
  <section className="member-profile-posts">
   <div className="feature-toolbar"><strong>Posts by {profile.display_name||profile.username}</strong><span>{posts.length} posts</span></div>
   {!posts.length?<div className="chat-empty"><ImageIcon size={25}/><strong>No posts yet</strong><span>This member has not shared a post yet.</span></div>:posts.map(post=><article className="member-post-card" key={post.id}>
    <time>{new Date(post.created_at).toLocaleString()}</time><p>{post.body}</p>
    {post.image_url&&<img src={post.image_url} alt="Member shared post"/>}
    {post.video_url&&<video src={post.video_url} controls playsInline preload="metadata"/>}
    <div className="member-post-stats"><span>{post.wc_post_likes?.length||0} appreciations</span><span>{post.wc_comments?.length||0} comments</span></div>
   </article>)}
  </section>
 </main>;
}
