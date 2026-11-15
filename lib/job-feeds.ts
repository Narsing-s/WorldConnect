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
fetch("https://jobicy.com/api/v2/remote-jobs?count=50"+(query?"&tag="+encodeURIComponent(query):""),{cache:"no-store",headers:{Accept:"application/json"},signal:AbortSignal.timeout(15000)}),
fetch("https://jobsforceindia.com/api/public/v1/jobs?per_page=20&page=1"+(query?"&q="+encodeURIComponent(query):""),{cache:"no-store",headers:{Accept:"application/json"},signal:AbortSignal.timeout(15000)})]);
const [rem,arb,rok,jcy,india]=await Promise.all([
safeJson<{jobs?:Array<Record<string,unknown>>}>(rs[0]),safeJson<{data?:Array<Record<string,unknown>>}>(rs[1]),
safeJson<Array<Record<string,unknown>>>(rs[2]),safeJson<{jobs?:Array<Record<string,unknown>>}>(rs[3]),safeJson<{results?:Array<Record<string,unknown>>}>(rs[4])]);
const jobs:Job[]=[],errors:string[]=[];
let indiaRows=india?.results||[];
let indiaItRows:Record<string,unknown>[]=[];
try{
 const itResponses=await Promise.allSettled(Array.from({length:10},(_,index)=>fetch("https://jobsforceindia.com/api/public/v1/jobs?"+new URLSearchParams({category:"IT",per_page:"20",page:String(index+1)}),{cache:"no-store",headers:{Accept:"application/json"},signal:AbortSignal.timeout(15000)})));
 const itData=await Promise.all(itResponses.map(response=>safeJson<{results?:Array<Record<string,unknown>>}>(response)));
 const itById=new Map<string,Record<string,unknown>>();
 for(const result of itData)for(const row of result?.results||[])itById.set(String(row.id||row.url),row);
 indiaItRows=Array.from(itById.values());
}catch{/* Keep the general India feed if the IT-specific request fails. */}
try{
 const catalogResponse=await fetch("https://jobsforceindia.com/api/public/v1/catalog",{cache:"no-store",headers:{Accept:"application/json"},signal:AbortSignal.timeout(10000)});
 if(catalogResponse.ok){
  const catalog=await catalogResponse.json() as {categories?:Array<{name?:string}>};
  const categories=(catalog.categories||[]).map(item=>String(item.name||"")).filter(Boolean).slice(0,20);
  const categoryResponses=await Promise.allSettled(categories.map(category=>fetch("https://jobsforceindia.com/api/public/v1/jobs?"+new URLSearchParams({category,per_page:"20",page:"1",...(query?{q:query}:{})}),{cache:"no-store",headers:{Accept:"application/json"},signal:AbortSignal.timeout(15000)})));
  const categoryData=await Promise.all(categoryResponses.map(response=>safeJson<{results?:Array<Record<string,unknown>>}>(response)));
  const byId=new Map<string,Record<string,unknown>>();
  for(const row of indiaRows)byId.set(String(row.id||row.url),row);
  for(const result of categoryData)for(const row of result?.results||[])byId.set(String(row.id||row.url),row);
  indiaRows=Array.from(byId.values());
 }
}catch{/* Keep the general India feed if category discovery is unavailable. */}

for(const x of rem?.jobs||[]){const j:Job={id:"remotive-"+x.id,title:String(x.title||""),company:String(x.company_name||""),location:String(x.candidate_required_location||"Remote"),remote:true,description:stripHtml(x.description).slice(0,1200),url:safeUrl(x.url),postedAt:normalizePostedAt(x.publication_date),source:"Remotive",tags:[String(x.category||""),String(x.job_type||"")].filter(Boolean),salary:String(x.salary||"")||null};if(j.url&&matches(j,query.toLowerCase(),location.toLowerCase()))jobs.push(j);}
for(const x of arb?.data||[]){const j:Job={id:"arbeitnow-"+(x.slug||x.id||x.url),title:String(x.title||""),company:String(x.company_name||""),location:String(x.location||(x.remote?"Remote":"Not specified")),remote:Boolean(x.remote),description:stripHtml(x.description).slice(0,1200),url:safeUrl(x.url),postedAt:normalizePostedAt(x.created_at),source:"Arbeitnow",tags:Array.isArray(x.tags)?x.tags.map(String):[],salary:null};if(j.url&&matches(j,query.toLowerCase(),location.toLowerCase()))jobs.push(j);}
for(const x of(rok||[]).filter(x=>x.position||x.title)){const j:Job={id:"remoteok-"+(x.id||x.url),title:String(x.position||x.title||""),company:String(x.company||""),location:String(x.location||"Remote"),remote:true,description:stripHtml(x.description).slice(0,1200),url:safeUrl(x.url||(x.slug?"https://remoteok.com/remote-jobs/"+x.slug:"")),postedAt:normalizePostedAt(x.date),source:"Remote OK",tags:Array.isArray(x.tags)?x.tags.map(String):[],salary:x.salary?String(x.salary):null};if(j.url&&matches(j,query.toLowerCase(),location.toLowerCase()))jobs.push(j);}
for(const x of jcy?.jobs||[]){const j:Job={id:"jobicy-"+(x.id||x.url),title:String(x.jobTitle||""),company:String(x.companyName||""),location:String(x.jobGeo||"Remote"),remote:true,description:stripHtml(x.jobDescription).slice(0,1200),url:safeUrl(x.url),postedAt:normalizePostedAt(x.pubDate),source:"Jobicy",tags:[String(x.jobIndustry||""),String(x.jobType||"")].filter(Boolean),salary:x.annualSalaryMin||x.annualSalaryMax?(String(x.salaryCurrency||"")+" "+String(x.annualSalaryMin||"")+"-"+String(x.annualSalaryMax||"")).trim():null};if(j.url&&matches(j,query.toLowerCase(),location.toLowerCase()))jobs.push(j);}
for(const x of [...indiaRows,...indiaItRows]){
 const loc=(x.location&&typeof x.location==="object"?x.location:{}) as Record<string,unknown>;
 const hiring=(x.hiring&&typeof x.hiring==="object"?x.hiring:{}) as Record<string,unknown>;
 const salary=(x.salary&&typeof x.salary==="object"?x.salary:{}) as Record<string,unknown>;
 const exp=(x.experience&&typeof x.experience==="object"?x.experience:{}) as Record<string,unknown>;
 const place=[loc.city,loc.state,loc.country||"India"].filter(Boolean).map(String).join(", ");
 const j:Job={id:"jobsforceindia-"+String(x.id||x.url),title:String(x.title||""),company:String(hiring.display||hiring.employer||hiring.name||"Employer not specified"),location:place||"India",remote:Boolean(loc.remote)||String(x.work_mode||"").toLowerCase()==="remote",description:stripHtml(x.summary||"").slice(0,1200),url:safeUrl(x.apply_url||x.url),postedAt:normalizePostedAt(x.posted_date),source:"JobsForce India",tags:[String(x.category||""),String(x.job_type||""),String(exp.label||"")].filter(Boolean),salary:String(salary.label||"")||null};
 if(j.url&&matches(j,query.toLowerCase(),location.toLowerCase()))jobs.push(j);
}
if(!rem)errors.push("Remotive feed is temporarily unavailable.");if(!arb)errors.push("Arbeitnow feed is temporarily unavailable.");if(!rok)errors.push("Remote OK feed is temporarily unavailable.");if(!jcy)errors.push("Jobicy feed is temporarily unavailable.");if(!india)errors.push("JobsForce India feed is temporarily unavailable.");
const unique=Array.from(new Map(jobs.map(j=>[j.url,j])).values()).sort((a,b)=>(Date.parse(b.postedAt||"")||0)-(Date.parse(a.postedAt||"")||0));
const indiaIT=unique.filter(job=>job.source==="JobsForce India"&&/\\bit\\b|software|developer|engineer|programmer|technology|data|cloud|devops|qa|testing|network|security/i.test([job.title,...job.tags,job.description].join(" ")));
const otherJobs=unique.filter(job=>!indiaIT.includes(job));
return{jobs:[...indiaIT.slice(0,100),...otherJobs].slice(0,250),errors};}
