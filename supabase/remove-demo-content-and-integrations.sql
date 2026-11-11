-- WorldConnect demo-content cleanup and integration readiness.
-- This script intentionally does NOT delete any user-created posts, profiles,
-- comments, messages, communities, or opportunities.
-- The frontend no longer seeds demonstration posts. Existing demo posts that
-- were manually inserted into wc_posts cannot be safely identified by schema
-- alone, so review them in the dashboard before deleting anything.

-- Optional audit: list posts with their author information before moderation.
select p.id, p.body, p.created_at, p.author_id, pr.username
from public.wc_posts p
left join public.wc_profiles pr on pr.id = p.author_id
order by p.created_at desc;

-- External job-board listings are fetched server-side and are not stored in
-- Supabase. This avoids mixing third-party listings with member-created posts.
-- No social OAuth tokens are stored in the browser or database by this release.
