# WorldConnect 🌍

**One world. Millions of connections.**

WorldConnect is a responsive global community platform built with Next.js, TypeScript, Tailwind CSS and Supabase.

## Features

- Email/password registration, sign-in and sign-out
- Member profile editor and profile photo upload
- Community feed with persistent member-created text, photo and video posts
- No seeded/demo feed posts; an empty feed is shown until real members publish
- Persistent appreciations (likes), comments, follows and saved posts
- Community discovery, community creation and join/leave actions
- Private member-to-member conversations
- Community opportunity board for jobs, collaborations, volunteering, events and learning
- Live external job search from Remotive, Arbeitnow, Remote OK and Jobicy through a server-side API route
- Job-board directory with direct links to major India and international employment sites
- Search filters for source and location type; applications open on the original provider website
- Search jobs by role, skills and location; apply on the original job provider website
- Automatic six-hour sync into persistent Supabase job storage, duplicate-safe updates and stale-listing expiry
- Share WorldConnect through LinkedIn, WhatsApp, Telegram, email and the device share sheet
- In-app notifications for likes, comments, follows and messages
- Share posts with the device share sheet, with clipboard fallback and direct links
- Post owner delete and member report actions
- Responsive desktop and mobile navigation

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
5. Run `npm run dev` and open http://localhost:3000.

## Supabase setup (required for community features)

1. Open the Supabase SQL Editor for the project.
2. Run the complete `supabase/schema.sql` script from this repository.
3. In Supabase Authentication → URL Configuration, set the Site URL to your deployed app URL and add redirect URLs for localhost and your deployed `/auth/callback` URL.
4. Enable email/password authentication and configure the email provider/confirmation settings you want.
5. Set the two public Supabase environment variables in Vercel and redeploy.

The optional `supabase/remove-demo-content-and-integrations.sql` is an audit-only script. It does not delete member content.

## Jobs and social sharing

- `/jobs` aggregates public feeds from Remotive, Arbeitnow, Remote OK and Jobicy server-side, with keyword/location search and source/location filters. It also provides a direct-link directory for Naukri, LinkedIn Jobs, Indeed, Foundit, Instahyre, Cutshort, TimesJobs, Shine, Freshersworld, Wellfound, Glassdoor, Remote OK, We Work Remotely, Jobicy, Remotive, Arbeitnow, Dice and ZipRecruiter.
- Job-board directory links open the providers' own websites. Only the four public feeds are aggregated automatically; other providers do not expose a supported public feed here and are not scraped. Listings and availability depend on provider feeds and terms.
- `/integrations` provides user-initiated sharing through official LinkedIn, WhatsApp, Telegram and email share flows.
- Direct LinkedIn feed access/automatic publishing, WhatsApp Business API messaging and Telegram bot notifications require separate app registration, approval and credentials. No account is falsely marked as connected.
- No third-party API secret is required for the four public job feeds. If a provider is unavailable, the page reports it rather than displaying fabricated listings.

## Deploy

Import this repository into Vercel, configure the Supabase public environment variables, and deploy the `main` branch.

## Security

Row-level security is enabled on WorldConnect data tables. Keep the Supabase service-role key private and never expose secrets in `NEXT_PUBLIC_*` variables.
