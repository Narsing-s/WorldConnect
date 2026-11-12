export type Job = { id:string; title:string; company:string; location:string; remote:boolean; description:string; url:string; postedAt:string|null; source:string; tags:string[]; salary:string|null };
function stripHtml(value:unknown):string{return String(value||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g," ").trim();}
function safeUrl(value:unknown):string{try{const u=new URL(String(value||""));return u.protocol==="https:"?u.toString():"";}catch{return "";}}
function normalizePostedAt(value:unknown):string|null{
 if(value===null||value===undefined||value==="")return null;
 if(typeof value==="number"||(typeof value==="string"&&/^\\d+(?:\\.\\d+)?$/.test(value.trim()))){
  const numeric=Number(value);
  const milliseconds=numeric<100000000000?numeric*1000:numeric;
  const date=new Date(milliseconds);
  return Number.isFinite(date.getTime())?date.toISOString():null;
 }
 const date=new Date(String(value));
 return Number.isFinite(date.getTime())?date.toISOString():null;
}
function matches(j:Job,q:string,l:string):boolean{const t=[j.title,j.company,j.description,...j.tags].join(" ").toLowerCase(),p=j.location.toLowerCase();return(!q||t.includes(q))&&(!l||p.includes(l)||/worldwide|anywhere/i.test(p)||(j.remote&&/remote/i.test(l)));}
async function safeJson<T>(r:PromiseSettledResult<Response>):Promise<T|null>{if(r.status!=="fulfilled"||!r.value.ok)return null;try{return await r.value.json() as T;}catch{return null;}}
export async function collectJobs(query="",location=""):Promise<{jobs:Job[];errors:string[]}>{
const rs=await Promise.allSettled([
fetch("https://remotive.com/api/remote-jobs?search="+encodeURIComponent(query),{cache:"no-store",headers:{Accept:"application/json"},signal:AbortSignal.timeout(15000)}),
fetch("https://www.arbeitnow.com/api/job-board-api",{cache:"no-store",headers:{Accept:"application/json"},signal:AbortSignal.timeout(15000)}),
fetch("https://remoteok.com/api",{cache:"no-store",headers:{Accept:"application/json","User-Agent":"WorldConnectJobHub/1.0"},signal:AbortSignal.timeout(15000)}),
fetch("https://jobicy.com/api/v2/remote-jobs?count=50"+(query?"&tag="+encodeURIComponent(query):""),{cache:"no-store",headers:{Accept:"application/json"},signal:AbortSignal.timeout(15000)})]);
const [rem,arb,rok,jcy]=await Promise.all([
safeJson<{jobs?:Array<Record<string,unknown>>}>(rs[0]),safeJson<{data?:Array<Record<string,unknown>>}>(rs[1]),
safeJson<Array<Record<string,unknown>>>(rs[2]),safeJson<{jobs?:Array<Record<string,unknown>>}>(rs[3])]);
const jobs:Job[]=[],errors:string[]=[];
for(const x of rem?.jobs||[]){const j:Job={id:"remotive-"+x.id,title:String(x.title||""),company:String(x.company_name||""),location:String(x.candidate_required_location||"Remote"),remote:true,description:stripHtml(x.description).slice(0,1200),url:safeUrl(x.url),postedAt:normalizePostedAt(x.publication_date),source:"Remotive",tags:[String(x.category||""),String(x.job_type||"")].filter(Boolean),salary:String(x.salary||"")||null};if(j.url&&matches(j,query.toLowerCase(),location.toLowerCase()))jobs.push(j);}
for(const x of arb?.data||[]){const j:Job={id:"arbeitnow-"+(x.slug||x.id||x.url),title:String(x.title||""),company:String(x.company_name||""),location:String(x.location||(x.remote?"Remote":"Not specified")),remote:Boolean(x.remote),description:stripHtml(x.description).slice(0,1200),url:safeUrl(x.url),postedAt:normalizePostedAt(x.created_at),source:"Arbeitnow",tags:Array.isArray(x.tags)?x.tags.map(String):[],salary:null};if(j.url&&matches(j,query.toLowerCase(),location.toLowerCase()))jobs.push(j);}
for(const x of(rok||[]).filter(x=>x.position||x.title)){const j:Job={id:"remoteok-"+(x.id||x.url),title:String(x.position||x.title||""),company:String(x.company||""),location:String(x.location||"Remote"),remote:true,description:stripHtml(x.description).slice(0,1200),url:safeUrl(x.url||(x.slug?"https://remoteok.com/remote-jobs/"+x.slug:"")),postedAt:normalizePostedAt(x.date),source:"Remote OK",tags:Array.isArray(x.tags)?x.tags.map(String):[],salary:x.salary?String(x.salary):null};if(j.url&&matches(j,query.toLowerCase(),location.toLowerCase()))jobs.push(j);}
for(const x of jcy?.jobs||[]){const j:Job={id:"jobicy-"+(x.id||x.url),title:String(x.jobTitle||""),company:String(x.companyName||""),location:String(x.jobGeo||"Remote"),remote:true,description:stripHtml(x.jobDescription).slice(0,1200),url:safeUrl(x.url),postedAt:normalizePostedAt(x.pubDate),source:"Jobicy",tags:[String(x.jobIndustry||""),String(x.jobType||"")].filter(Boolean),salary:x.annualSalaryMin||x.annualSalaryMax?(String(x.salaryCurrency||"")+" "+String(x.annualSalaryMin||"")+"-"+String(x.annualSalaryMax||"")).trim():null};if(j.url&&matches(j,query.toLowerCase(),location.toLowerCase()))jobs.push(j);}
if(!rem)errors.push("Remotive feed is temporarily unavailable.");if(!arb)errors.push("Arbeitnow feed is temporarily unavailable.");if(!rok)errors.push("Remote OK feed is temporarily unavailable.");if(!jcy)errors.push("Jobicy feed is temporarily unavailable.");
return{jobs:Array.from(new Map(jobs.map(j=>[j.url,j])).values()).sort((a,b)=>(Date.parse(b.postedAt||"")||0)-(Date.parse(a.postedAt||"")||0)).slice(0,250),errors};}
