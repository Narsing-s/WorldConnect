# WorldConnect 🌍

**One world. Millions of connections.**

A responsive global community platform starter built with Next.js, TypeScript, Tailwind CSS and Supabase.

## Run locally

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Add your Supabase project URL and publishable/anon key.
5. Run `npm run dev` and open http://localhost:3000.

The app includes a polished interactive front-end preview. Social actions in preview mode use local in-memory state; real accounts, durable posts, messaging and moderation require Supabase credentials and the SQL schema in `supabase/schema.sql`.

## Supabase setup

Run the SQL schema in the Supabase SQL Editor. Configure email authentication and redirect URLs for your local and deployed domains. Only use the publishable/anon key in the browser; never expose a service-role key.

## Deploy

Import this repository into Vercel, set the two `NEXT_PUBLIC_SUPABASE_*` environment variables, and deploy.

## Roadmap

- [x] Responsive social platform foundation
- [x] Interactive feed preview, navigation, composer and discovery UI
- [x] Supabase schema and row-level security starter
- [ ] Production authentication and profile onboarding
- [ ] Persistent posts, likes, comments and follows
- [ ] Real-time messaging and notifications
- [ ] Community moderation and admin console
- [ ] Mobile app client
