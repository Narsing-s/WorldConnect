-- Backfill public WorldConnect profiles for accounts that existed before
-- the wc_on_auth_user_created trigger was installed.
-- Safe to run more than once; existing profiles are never overwritten.

do $$
declare
  account record;
  base_username text;
  final_username text;
  clean_display_name text;
begin
  for account in
    select u.id, u.email, u.raw_user_meta_data
    from auth.users u
    where not exists (
      select 1 from public.wc_profiles p where p.id = u.id
    )
  loop
    base_username := lower(regexp_replace(
      coalesce(
        nullif(account.raw_user_meta_data ->> 'username', ''),
        split_part(coalesce(account.email, ''), '@', 1),
        'member'
      ),
      '[^a-z0-9_]', '', 'g'
    ));

    if char_length(base_username) < 3 then
      base_username := 'member';
    end if;

    base_username := left(base_username, 30);
    clean_display_name := coalesce(
      nullif(btrim(account.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(account.raw_user_meta_data ->> 'full_name'), ''),
      base_username
    );

    -- Prefer the requested username; fall back to a stable unique suffix.
    insert into public.wc_profiles (id, username, display_name)
    values (account.id, base_username, clean_display_name)
    on conflict do nothing;

    if not exists (
      select 1 from public.wc_profiles p where p.id = account.id
    ) then
      final_username := left(base_username, 21) || '_' ||
        substr(replace(account.id::text, '-', ''), 1, 8);

      insert into public.wc_profiles (id, username, display_name)
      values (account.id, final_username, clean_display_name)
      on conflict (id) do nothing;
    end if;
  end loop;
end;
$$;

-- Verification: this count should be zero after the backfill.
select count(*) as registered_users_without_profiles
from auth.users u
left join public.wc_profiles p on p.id = u.id
where p.id is null;
