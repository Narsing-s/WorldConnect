import Link from "next/link";
import { ArrowLeft, LockKeyhole, ShieldAlert, BriefcaseBusiness, Database, Image as ImageIcon } from "lucide-react";
import PrivacyControls from "./privacy-controls";

const sections = [
  {
    icon: Database,
    title: "Account and profile",
    body: "WorldConnect uses Supabase Authentication for sign-in. Your username, display name, bio, avatar URL and country are stored in the connected Supabase project. Public profile and portfolio fields follow the app's current visibility rules.",
  },
  {
    icon: ImageIcon,
    title: "Posts, messages and uploaded media",
    body: "Posts, comments, likes, follows, community memberships, opportunities and messages are stored in the WorldConnect database. Conversation records and new chat attachments have private access controls when the corresponding Supabase migrations are applied. The legacy worldconnect-media bucket may still contain publicly readable files; anyone with an existing public media URL may be able to view that object. Do not upload identity documents, financial records or confidential files to legacy public-media paths.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Jobs and career information",
    body: "Job listings may be collected from external providers and applications can open on provider websites. Saved applications, candidate preferences and Career Assistant resume text are designed to be private to the signed-in member through database row-level security. The current Career Assistant review runs in the browser; optional future AI services must disclose their own data handling and obtain consent.",
  },
  {
    icon: LockKeyhole,
    title: "Safety and account controls",
    body: "The Safety Centre lets signed-in members submit reports and manage blocks. The latest member-block migration adds database-level filtering across key social and messaging queries once applied to the connected Supabase project. Blocking does not erase existing records or revoke already-shared public media URLs.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="feature-page">
      <Link href="/" className="feature-back"><ArrowLeft size={16} /> WorldConnect</Link>
      <header className="feature-heading">
        <span><LockKeyhole size={22} /></span>
        <div>
          <h1>Privacy and data safety</h1>
          <p>Understand what WorldConnect stores, what is visible, and which controls are currently available.</p>
        </div>
      </header>

      <section className="opportunity-card" aria-label="Important privacy notice">
        <h2><ShieldAlert size={18} /> Before uploading files</h2>
        <p>The legacy media bucket may be publicly readable. Avoid uploading sensitive or confidential files there. New private chat attachments use a separate private bucket when the relevant migrations are applied. A complete legacy-media inventory and migration is still required before sensitive document uploads can be considered safe.</p>
      </section>

      {sections.map(({ icon: Icon, title, body }) => (
        <section className="opportunity-card" key={title}>
          <h2><Icon size={18} /> {title}</h2>
          <p>{body}</p>
        </section>
      ))}

      <PrivacyControls />

      <section className="opportunity-card" aria-label="Safety controls">
        <h2><ShieldAlert size={18} /> Member safety controls</h2>
        <p>Visit the <Link href="/safety">Safety Centre</Link> to submit a report, review your submitted reports or manage blocked members.</p>
      </section>

      <p className="feature-notice" role="note">
        The data export covers the listed account tables that your signed-in session can read; it is not yet a complete archive of every message, uploaded file or external-provider record. Full account deletion, session/device management and legacy-media migration still require additional server-side work. This page describes application behavior, not legal advice or a reviewed privacy policy.
      </p>
    </main>
  );
}
