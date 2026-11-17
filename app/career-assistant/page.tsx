"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BrainCircuit, BriefcaseBusiness, CheckCircle2, CircleAlert, ClipboardCheck, FileText, GraduationCap, LoaderCircle, LockKeyhole, Save, Sparkles, Target, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import "./career-assistant.css";

type Job = { id:string; title:string; company:string; location:string; description:string; url:string; tags:string[]; remote:boolean };
type JobResponse = { jobs?:Job[] };
type Analysis = { skills:string[]; score:number; sections:string[]; missingSections:string[]; words:number };
const skillBank = ["JavaScript","TypeScript","React","Next.js","Node.js","Python","Java","C#",".NET","SQL","PostgreSQL","MySQL","MongoDB","Supabase","REST API","GraphQL","API design","MuleSoft","DataWeave","Anypoint Platform","AWS","Azure","GCP","Docker","Kubernetes","Git","GitHub Actions","CI/CD","HTML","CSS","Tailwind CSS","Figma","Agile","Scrum","Excel","Power BI","Tableau","SAP","Salesforce","Selenium","Playwright","Jest","Communication","Leadership","Project management","Data analysis","Machine learning","Cybersecurity","Networking","AutoCAD","Revit","SolidWorks","PLC","HVAC","Quality assurance","Supply chain"];
const roleSkills:Record<string,string[]> = {
  software:["JavaScript","TypeScript","React","Node.js","SQL","Git","REST API","Testing","CI/CD"],
  developer:["JavaScript","TypeScript","Java","Python","SQL","Git","REST API","Testing"],
  mulesoft:["MuleSoft","DataWeave","Anypoint Platform","REST API","API design","SQL","Git","CI/CD"],
  data:["SQL","Python","Excel","Power BI","Data analysis","Tableau"],
  cloud:["AWS","Azure","Docker","Kubernetes","CI/CD","Networking","Git"],
  design:["Figma","Communication","Project management"],
  civil:["AutoCAD","Revit","Project management","Quality assurance"],
  mechanical:["SolidWorks","AutoCAD","HVAC","Quality assurance"],
  default:["Communication","Problem solving","Project management","Excel","SQL"]
};
const questionSets:Record<string,string[]> = {
  software:["Walk me through a project you built and the decisions you made.","How do you debug a production issue you cannot reproduce locally?","How do you design and test a reliable REST API?","Describe a performance bottleneck you investigated.","How do you review code and prevent regressions?"],
  mulesoft:["Explain API-led connectivity and when you use System, Process and Experience APIs.","How do you handle errors and retries in a Mule 4 flow?","Explain a DataWeave transformation you implemented and how you tested it.","How would you design an idempotent batch integration?","How do you monitor and troubleshoot a CloudHub deployment?"],
  data:["How do you validate data quality before analysis?","Explain a dashboard or analysis that changed a decision.","How do you optimize a slow SQL query?","How do you communicate uncertainty in a dataset?","Describe how you automate a recurring report."],
  default:["Tell me about yourself and the role you are targeting.","Describe a difficult problem you solved from start to finish.","How do you prioritize competing deadlines?","Tell me about feedback you received and how you acted on it.","What would you aim to achieve in your first 90 days?"]
};
function analyzeResume(text:string):Analysis {
  const normalized=text.toLowerCase();
  const skills=skillBank.filter(skill=>normalized.includes(skill.toLowerCase()));
  const checks=[["Contact details",/[\w.+-]+@[\w.-]+\.[a-z]{2,}/.test(normalized)||/\+?\d[\d ()-]{7,}\d/.test(text)],["Professional summary",/summary|objective|profile/.test(normalized)],["Work experience",/experience|employment|responsibilit|worked at/.test(normalized)],["Education",/education|university|college|degree|bachelor|master/.test(normalized)],["Skills",/skills|technologies|technical stack/.test(normalized)||skills.length>=3],["Achievements",/achieved|improved|reduced|increased|delivered|saved/.test(normalized)||/\d+%/.test(normalized)] ] as const;
  const sections=checks.filter(([,ok])=>ok).map(([name])=>name);
  const missingSections=checks.filter(([,ok])=>!ok).map(([name])=>name);
  return {skills,score:Math.round(sections.length/checks.length*100),sections,missingSections,words:text.trim()?text.trim().split(/\s+/).length:0};
}
function roleKey(role:string){const r=role.toLowerCase();return /mulesoft|integration/.test(r)?"mulesoft":/data|analyst|analytics/.test(r)?"data":/cloud|devops|platform/.test(r)?"cloud":/design|ux|ui/.test(r)?"design":/civil|construction/.test(r)?"civil":/mechanical|manufacturing/.test(r)?"mechanical":/developer|software|engineer|frontend|backend|full.?stack/.test(r)?"software":"default";}
function scoreJob(job:Job,role:string,skills:string[]){const text=[job.title,job.description,...(job.tags||[])].join(" ").toLowerCase();const roleMatch=role.trim()&&job.title.toLowerCase().includes(role.toLowerCase().split(" ")[0]);const matched=skills.filter(s=>text.includes(s.toLowerCase()));const score=Math.min(98,Math.round((matched.length/Math.max(1,Math.min(skills.length,6)))*75)+(roleMatch?25:0));return {score,matched};}

export default function CareerAssistantPage(){
 const [resume,setResume]=useState("");const [role,setRole]=useState("");const [consent,setConsent]=useState(false);const [analysis,setAnalysis]=useState<Analysis|null>(null);const [jobs,setJobs]=useState<Job[]>([]);const [loadingJobs,setLoadingJobs]=useState(false);const [saving,setSaving]=useState(false);const [loadingSaved,setLoadingSaved]=useState(true);const [notice,setNotice]=useState("");const [error,setError]=useState("");const [saved,setSaved]=useState(false);
 const db=useMemo(()=>createClient(),[]);
 useEffect(()=>{let active=true;void(async()=>{if(!db){setLoadingSaved(false);return;}const {data:{user}}=await db.auth.getUser();if(!user){setLoadingSaved(false);return;}const {data,error:e}=await db.from("wc_career_workspaces").select("resume_text,target_role").eq("user_id",user.id).maybeSingle();if(active&&data){setResume(data.resume_text||"");setRole(data.target_role||"");setSaved(true);}if(active&&e&&!/does not exist|schema cache/i.test(e.message))setError(e.message);if(active)setLoadingSaved(false);})();return()=>{active=false;};},[db]);
 const skills=useMemo(()=>analysis?.skills||[],[analysis]);
 const targets=roleSkills[roleKey(role)]||roleSkills.default;
 const gaps=targets.filter(s=>!skills.some(found=>found.toLowerCase()===s.toLowerCase()));
 const rankedJobs=useMemo(()=>jobs.map(job=>({...job,...scoreJob(job,role,skills)})).sort((a,b)=>b.score-a.score).slice(0,6),[jobs,role,skills]);
 const questions=questionSets[roleKey(role)]||questionSets.default;
 function runAnalysis(){setError("");setNotice("");if(resume.trim().length<80){setError("Add at least 80 characters so the review has enough context.");return;}if(!role.trim()){setError("Enter the role you are targeting.");return;}const result=analyzeResume(resume);setAnalysis(result);setSaved(false);setNotice("Resume review completed locally in your browser. Nothing was sent to an AI provider.");setLoadingJobs(true);void fetch("/api/jobs").then(r=>{if(!r.ok)throw new Error("Job listings are temporarily unavailable.");return r.json() as Promise<JobResponse>;}).then(data=>setJobs(data.jobs||[])).catch(e=>setError(e instanceof Error?e.message:"Could not load current jobs.")).finally(()=>setLoadingJobs(false));}
 async function saveWorkspace(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!db){setError("Connect Supabase before saving your private workspace.");return;}if(!consent){setError("Confirm that you want to store this resume in your private WorldConnect workspace.");return;}if(!analysis){setError("Review your resume before saving.");return;}setSaving(true);setError("");setNotice("");const {data:{user}}=await db.auth.getUser();if(!user){setError("Please sign in again.");setSaving(false);return;}const {error:e2}=await db.from("wc_career_workspaces").upsert({user_id:user.id,resume_text:resume.trim(),target_role:role.trim(),consent_at:new Date().toISOString()},{onConflict:"user_id"});if(e2)setError(e2.message.includes("wc_career_workspaces")?"Apply supabase/migrations/20261120_private_career_workspace.sql in Supabase, then try again.":e2.message);else{setSaved(true);setNotice("Your resume workspace is saved privately to your account.");}setSaving(false);}
 async function deleteWorkspace(){if(!db)return;const {data:{user}}=await db.auth.getUser();if(!user)return;const {error:e}=await db.from("wc_career_workspaces").delete().eq("user_id",user.id);if(e){setError(e.message);return;}setResume("");setRole("");setAnalysis(null);setJobs([]);setSaved(false);setConsent(false);setNotice("Your saved resume workspace was deleted.");}
 return <main className="career-page">
  <Link href="/" className="career-back"><ArrowLeft size={16}/> Back to WorldConnect</Link>
  <header className="career-hero"><div className="career-kicker"><Sparkles size={14}/> CAREER GROWTH STUDIO</div><h1>Turn your experience into your next opportunity.</h1><p>Review your resume, uncover skill gaps, discover relevant openings and prepare for interviews — in one private workspace.</p><div className="career-privacy"><LockKeyhole size={15}/> Resume review runs in your browser. No external AI provider receives your resume.</div></header>
  <div className="career-grid">
   <section className="career-panel career-input-panel"><div className="career-panel-heading"><span className="career-icon"><FileText size={19}/></span><div><h2>Resume review</h2><p>Paste your resume text to get started.</p></div></div>
    <form onSubmit={e=>{e.preventDefault();runAnalysis();}}><label className="career-label">Target role<input value={role} maxLength={120} onChange={e=>setRole(e.target.value)} placeholder="e.g. MuleSoft Developer, Data Analyst"/></label><label className="career-label">Resume text<textarea value={resume} onChange={e=>setResume(e.target.value)} maxLength={25000} rows={13} placeholder="Paste your resume text here. Include your summary, skills, work experience, projects and education…"/></label><div className="career-counter">{resume.length.toLocaleString()} / 25,000 characters</div>
     {error&&<p className="career-alert error" role="alert"><CircleAlert size={15}/>{error}</p>}{notice&&<p className="career-alert success" role="status"><CheckCircle2 size={15}/>{notice}</p>}
     <button className="career-primary" type="submit"><BrainCircuit size={17}/> Review my resume</button>
    </form>
    {analysis&&<form className="career-save-form" onSubmit={saveWorkspace}><label className="career-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>I agree to store this resume in my private WorldConnect account. Only my signed-in account can access it.</span></label><button className="career-secondary" disabled={saving||loadingSaved||!consent}><Save size={15}/>{saving?"Saving…":saved?"Update private workspace":"Save private workspace"}</button>{saved&&<button type="button" className="career-delete" onClick={()=>void deleteWorkspace()}><Trash2 size={14}/> Delete saved resume</button>}</form>}
    {loadingSaved&&<small className="career-muted">Checking your saved workspace…</small>}
   </section>
   <section className="career-panel career-results"><div className="career-panel-heading"><span className="career-icon"><ClipboardCheck size={19}/></span><div><h2>Resume insights</h2><p>Clear, evidence-based checks — not fabricated claims.</p></div></div>
    {!analysis?<div className="career-empty"><Target size={27}/><strong>Your review will appear here</strong><span>Paste your resume and choose a target role to see your strengths and next steps.</span></div>:<>
     <div className="career-score"><div><strong>{analysis.score}%</strong><span>Resume section coverage</span></div><div className="career-score-track"><i style={{width:analysis.score+"%"}}/></div></div>
     <div className="career-stat-row"><div><strong>{analysis.words}</strong><span>Words</span></div><div><strong>{skills.length}</strong><span>Recognized skills</span></div><div><strong>{analysis.sections.length}/6</strong><span>Sections found</span></div></div>
     <h3>Skills found in your resume</h3><div className="career-chips">{skills.length?skills.map(s=><span key={s}>{s}</span>):<small>No known skills detected yet. Add a clearly labelled skills section.</small>}</div>
     <h3>Sections to strengthen</h3><ul className="career-check-list">{analysis.missingSections.map(s=><li key={s}><CircleAlert size={14}/>{s}</li>)}{!analysis.missingSections.length&&<li><CheckCircle2 size={14}/>All six core sections were detected.</li>}</ul>
    </>}
   </section>
  </div>
  {analysis&&<div className="career-lower-grid">
   <section className="career-panel"><div className="career-panel-heading"><span className="career-icon"><GraduationCap size={19}/></span><div><h2>Skill-gap plan</h2><p>Common skills for {role} compared with your resume.</p></div></div><div className="career-chips">{gaps.map(s=><span className="gap-chip" key={s}>{s}</span>)}{!gaps.length&&<span className="good-chip">Your resume covers this starter skill set.</span>}</div><p className="career-disclaimer">These are role-based suggestions, not a judgment of your ability. Add a skill only when you genuinely have it.</p></section>
   <section className="career-panel"><div className="career-panel-heading"><span className="career-icon"><BriefcaseBusiness size={19}/></span><div><h2>Relevant job openings</h2><p>Matches are ranked using role title and skills found in your resume.</p></div></div>{loadingJobs?<p className="career-muted"><LoaderCircle className="auth-spin"/> Loading current openings…</p>:rankedJobs.length?rankedJobs.map(job=><article className="career-job" key={job.id}><div><strong>{job.title}</strong><span>{job.company||"Company not listed"} · {job.location}</span><small>{job.matched.length} matching skills: {job.matched.slice(0,4).join(", ")||"Role title match"}</small></div><b>{job.score}%</b><a href={job.url} target="_blank" rel="noreferrer">View</a></article>):<p className="career-muted">No current job matches are available. Visit <Link href="/jobs">Jobs</Link> to browse all listings.</p>}</section>
  </div>}
  {analysis&&<section className="career-panel career-interview"><div className="career-panel-heading"><span className="career-icon"><BrainCircuit size={19}/></span><div><h2>Interview practice</h2><p>Starter questions for {role}. Practice aloud and use the prompts to structure real examples.</p></div></div><ol>{questions.map((q,i)=><li key={q}><span>{String(i+1).padStart(2,"0")}</span>{q}</li>)}</ol></section>}
  <footer className="career-footnote">Privacy first · Browser-based resume review · No resume is sent to an AI service · Job match scores are indicative, not hiring predictions.</footer>
 </main>;
}
