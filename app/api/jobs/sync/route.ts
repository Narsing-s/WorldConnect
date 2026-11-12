import { NextRequest,NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { collectJobs } from "@/lib/job-feeds";
export const dynamic="force-dynamic";export const maxDuration=60;
export async function POST(req:NextRequest){
const expected=process.env.JOBS_SYNC_SECRET,supplied=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||req.headers.get("x-jobs-sync-secret");
if(!expected||!supplied||supplied.length!==expected.length||!Buffer.from(supplied).equals(Buffer.from(expected)))return NextResponse.json({error:"Unauthorized"},{status:401});
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return NextResponse.json({error:"Server-side Supabase service credentials are not configured."},{status:503});
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const run=await db.from("wc_job_sync_runs").insert({status:"running"}).select("id").single();
if(run.error||!run.data)return NextResponse.json({error:"Could not create sync run. Apply supabase/jobs-auto-sync.sql first.",details:run.error?.message},{status:500});
try{const{jobs,errors}=await collectJobs();if(!jobs.length&&errors.length===4)throw new Error("All job providers failed; existing jobs were retained.");
const now=new Date().toISOString(),rows=jobs.map(j=>({external_id:j.id,title:j.title,company:j.company,location:j.location,remote:j.remote,description:j.description,application_url:j.url,posted_at:j.postedAt,source:j.source,tags:j.tags,salary:j.salary,status:"published",last_seen_at:now}));
let imported=0;for(let i=0;i<rows.length;i+=100){const{error}=await db.from("wc_jobs").upsert(rows.slice(i,i+100),{onConflict:"external_id"});if(error)throw new Error(error.message);imported+=Math.min(100,rows.length-i);}
const{error:expiryError}=await db.from("wc_jobs").update({status:"expired"}).eq("status","published").lt("last_seen_at",new Date(Date.now()-30*86400000).toISOString());if(expiryError)throw new Error(expiryError.message);
const completedAt=new Date().toISOString(),{error:runError}=await db.from("wc_job_sync_runs").update({status:"completed",completed_at:completedAt,imported_count:imported,provider_errors:errors}).eq("id",run.data.id);if(runError)throw new Error(runError.message);
return NextResponse.json({success:true,imported,errors,completedAt});
}catch(e){const message=e instanceof Error?e.message:"Job sync failed.";await db.from("wc_job_sync_runs").update({status:"failed",completed_at:new Date().toISOString(),error:message}).eq("id",run.data.id);return NextResponse.json({error:message},{status:502});}}
