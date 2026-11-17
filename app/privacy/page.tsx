import Link from "next/link";
import { ArrowLeft, LockKeyhole, ShieldAlert, BriefcaseBusiness, Database, Image as ImageIcon } from "lucide-react";

const sections = [
  {
    icon: Database,
    title: "Account and profile",
    body: "WorldConnect uses Supabase Authentication for sign-in. Your username, display name, bio, avatar URL and country are stored in the connected Supabase project. Profile visibility follows the current public-profile behavior of the app.",
  },
  {
    icon: ImageIcon,
    title: "Posts, messages and uploaded media",
    body: "Posts, comments, likes, follows, saved posts, community memberships, opportunities and messages are stored in the WorldConnect database. Private message records are protected by conversation-member database policies. Important: the current worldconnect-media storage bucket is publicly readable. Anyone who obtains a media URL may be able to view that uploaded file, including message attachments. Do not upload identity documents, financial records, private resumes or other sensitive files.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Jobs and career information",
    body: "Job listings are collected from external providers and applications open on the provider's website. Saved jobs, application notes, candidate preferences and career-workspace records are intended to be private to the signed-in member through database access policies. Resume review in the current Career Assistant is performed in the browser; do not assume that every future optional AI feature has the same data handling unless its consent notice says so.",
  },
  {
    icon: LockKeyhole,
    title: "Your controls",
    body: "You can update profile information and sign out using the account controls. The current app does not yet provide self-service account export or complete account deletion. Contact the site owner for assistance with a data request; a verified support contact should be published before public launch.",
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
        <p>The current media bucket is publicly readable. Avoid uploading sensitive or confidential files. Private storage and signed attachment URLs are a required security upgrade before WorldConnect should be used for sensitive documents.</p>
      </section>

      {sections.map(({ icon: Icon, title, body }) => (
        <section className="opportunity-card" key={title}>
          <h2><Icon size={18} /> {title}</h2>
          <p>{body}</p>
        </section>
      ))}

      <section className="opportunity-card" aria-label="Safety controls">
        <h2><ShieldAlert size={18} /> Member safety controls</h2>
        <p>Use the <Link href="/safety">Safety Centre</Link> to submit a report or manage your blocked-member list. Blocking is currently recorded as a preference and is not yet enforced across every part of the app.</p>
      </section>

      <p className="feature-notice" role="note">
        This page describes current application behavior and known limitations. It is not legal advice or a substitute for a reviewed privacy policy. The site owner should publish verified contact details, retention periods, hosting information and applicable user-rights procedures before public launch.
      </p>
    </main>
  );
}
