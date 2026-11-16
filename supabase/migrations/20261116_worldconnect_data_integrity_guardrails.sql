-- WorldConnect additive data-integrity guardrails.
-- Safe to apply after 20261116_job_application_tracker.sql and
-- 20261117_candidate_job_preferences.sql. Existing rows are not rewritten.
-- NOT VALID constraints protect new/changed rows immediately while allowing
-- existing data to be reviewed separately before optional validation.

create or replace function public.wc_text_array_values_valid(
  values_to_check text[],
  max_item_length integer
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(
    bool_and(
      item is not null
      and btrim(item) <> ''
      and char_length(btrim(item)) <= max_item_length
    ),
    true
  )
  from unnest(values_to_check) as item;
$$;

alter table public.wc_candidate_preferences
  add constraint wc_candidate_preferences_titles_values_valid
    check (public.wc_text_array_values_valid(target_titles, 100)) not valid,
  add constraint wc_candidate_preferences_skills_values_valid
    check (public.wc_text_array_values_valid(skills, 80)) not valid,
  add constraint wc_candidate_preferences_locations_values_valid
    check (public.wc_text_array_values_valid(locations, 100)) not valid,
  add constraint wc_candidate_preferences_modes_values_valid
    check (
      public.wc_text_array_values_valid(work_modes, 20)
      and work_modes <@ array['Remote', 'Hybrid', 'On-site']::text[]
    ) not valid;

create or replace function public.wc_candidate_preferences_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wc_candidate_preferences_updated_at
  on public.wc_candidate_preferences;
create trigger wc_candidate_preferences_updated_at
  before update on public.wc_candidate_preferences
  for each row
  execute function public.wc_candidate_preferences_touch_updated_at();

-- Keep the private application tracker protected against blank/oversized notes
-- even if a client bypasses the application UI.
alter table public.wc_job_applications
  add constraint wc_job_applications_notes_nonblank_or_empty
    check (notes = '' or char_length(btrim(notes)) > 0) not valid;

-- Explicitly document and reinforce the intended grants for private tables.
revoke all on public.wc_candidate_preferences from anon;
revoke all on public.wc_job_applications from anon;
grant select, insert, update on public.wc_candidate_preferences to authenticated;
grant select, insert, update, delete on public.wc_job_applications to authenticated;
