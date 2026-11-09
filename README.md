# WorldConnect 🌍

**One world. Millions of connections.**

WorldConnect is a responsive global community platform built with Next.js, TypeScript, Tailwind CSS and Supabase.

## Features

- Email/password registration, sign-in and sign-out
- Member profile editor (display name, username, bio, country and profile photo upload from device or avatar URL)
- Community feed with persistent text, photo and video posts
- Device photo/video picker with upload to Supabase Storage; profile photo picker and preview
- Persistent appreciations (likes), comments, follows and saved posts
- Community discovery, community creation and join/leave actions
- Private member-to-member conversations
- Opportunity board for jobs, collaborations, volunteering, events and learning
- In-app notifications for likes, comments, follows and messages
- Share posts with the device share sheet, with clipboard fallback and direct links that scroll to the shared post
- Post owner delete and member report actions
- Responsive desktop and mobile navigation

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
5. Run `npm run dev` and open http://localhost:3000.

## Supabase setup (required)

The application requires a Supabase project for accounts and durable social features.

1. Open the Supabase SQL Editor for the project.
2. Run the complete `supabase/schema.sql` script from this repository. It creates the WorldConnect-prefixed tables, indexes, RLS policies, profile signup trigger, private conversation helper/RPC, notification triggers, opportunity board and media bucket.
3. In Supabase Authentication → URL Configuration, set the Site URL to your deployed app URL and add redirect URLs for:
   - `http://localhost:3000/auth/callback`
   - `https://YOUR-DEPLOYED-DOMAIN/auth/callback`
4. Enable email/password authentication and configure the email provider/confirmation settings you want.
5. Set the two public Supabase environment variables in Vercel and redeploy.

Only the Supabase publishable/anon key belongs in browser environment variables. Never expose a service-role key in this repository or client code.

## Important behavior

- Without Supabase environment variables, the home page can display its sample feed, but account-backed actions are unavailable.
- Sample feed entries are demonstration content and are read-only. Posts created by signed-in members are stored in Supabase.
- Photo/video uploads use the `worldconnect-media` Storage bucket created by the SQL setup. The current upload limit is 50 MB per file.
- Messages, communities, saved posts, notifications and opportunities require the SQL setup to have been applied successfully.
- WorldConnect uses a separate `wc_` namespace for its database objects so it does not overwrite unrelated application tables.

## Deploy

Import this repository into Vercel, configure the two `NEXT_PUBLIC_SUPABASE_*` environment variables, and deploy the `main` branch.

## CI

GitHub Actions runs the Next.js production build for pushes and pull requests targeting `main`.

## Security

Row-level security is enabled on WorldConnect data tables. Keep the Supabase service-role key private and review database policies before opening the platform to a large public audience.
