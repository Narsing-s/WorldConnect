"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Copy, Globe2, Linkedin, MessageCircle, Send, Share2, Mail, Check } from "lucide-react";

export default function IntegrationsPage() {
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window !== "undefined" ? window.location.origin : "https://your-worldconnect-domain";
  const shareText = "Join me on WorldConnect — connect with people, discover jobs and share ideas around the world.";
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch { setCopied(false); }
  }

  async function nativeShare() {
    if (navigator.share) {
      try { await navigator.share({ title: "WorldConnect", text: shareText, url: shareUrl }); }
      catch (error) { if (error instanceof Error && error.name !== "AbortError") setCopied(false); }
    } else { await copyLink(); }
  }

  return (
    <main className="feature-page">
      <Link href="/" className="feature-back"><ArrowLeft size={16}/> WorldConnect</Link>
      <header className="feature-heading"><span><Globe2 size={22}/></span><div><h1>Integrations & sharing</h1><p>Share WorldConnect posts, jobs and your community with other platforms.</p></div></header>
      <div className="integration-intro"><strong>Share with your network</strong><p>These official share links open the selected service so you can review and send the content yourself. No social account password is stored by WorldConnect.</p></div>
      <section className="integration-grid">
        <article className="opportunity-card integration-card"><div className="integration-icon linkedin"><Linkedin size={24}/></div><h2>LinkedIn</h2><p>Share your WorldConnect link with your professional network using LinkedIn&apos;s share flow.</p><a className="feature-primary" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`} target="_blank" rel="noopener noreferrer">Share on LinkedIn <Share2 size={15}/></a></article>
        <article className="opportunity-card integration-card"><div className="integration-icon whatsapp"><MessageCircle size={24}/></div><h2>WhatsApp</h2><p>Send an invitation to a contact or group using WhatsApp&apos;s share composer.</p><a className="feature-primary" href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`} target="_blank" rel="noopener noreferrer">Share on WhatsApp <Send size={15}/></a></article>
        <article className="opportunity-card integration-card"><div className="integration-icon telegram"><Send size={24}/></div><h2>Telegram</h2><p>Share WorldConnect with a Telegram contact, group or channel.</p><a className="feature-primary" href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`} target="_blank" rel="noopener noreferrer">Share on Telegram <Send size={15}/></a></article>
        <article className="opportunity-card integration-card"><div className="integration-icon email"><Mail size={24}/></div><h2>Email</h2><p>Invite colleagues and friends by email.</p><a className="feature-primary" href={`mailto:?subject=Join%20WorldConnect&body=${encodedText}%20${encodedUrl}`}>Share by email <Mail size={15}/></a></article>
      </section>
      <div className="feature-toolbar"><strong>More sharing options</strong><button className="feature-secondary" onClick={()=>void nativeShare()}><Share2 size={15}/> Open device share sheet</button></div>
      <button className="feature-secondary integration-copy" onClick={()=>void copyLink()}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? "Link copied" : "Copy WorldConnect link"}</button>
      <div className="integration-intro"><strong>About direct account connections</strong><p>LinkedIn feed reading and automatic publishing, WhatsApp Business messaging and Telegram bot notifications require platform-specific approvals, credentials and webhook configuration. This release provides working user-initiated sharing without collecting passwords or pretending accounts are connected. OAuth/API connections can be enabled after their credentials and approvals are supplied.</p></div>
    </main>
  );
}
