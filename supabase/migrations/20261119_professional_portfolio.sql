-- Additive professional portfolio storage. Public read; owner-only writes.
create table if not exists public.wc_portfolio_entries (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.wc_profiles(id) on delete cascade,
 category text not null check (category in ('skill','project','certification','experience')),
 title text not null check (char_length(btrim(title)) between 1 and 120),
 organization text check (organization is null or char_length(organization)<=120),
 description text not null default '' check (char_length(description)<=2000),
 url text check (url is null or (char_length(url)<=500 and url ~* '^https?://')),
 start_date date, end_date date, is_current boolean not null default false,
 sort_order integer not null default 0, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint wc_portfolio_date_order check(start_date is null or end_date is null or end_date>=start_date)
);
create index if not exists wc_portfolio_entries_user_category_sort_idx on public.wc_portfolio_entries(user_id,category,sort_order,created_at desc);
alter table public.wc_portfolio_entries enable row level security;
drop policy if exists "Portfolio entries are publicly readable" on public.wc_portfolio_entries;
create policy "Portfolio entries are publicly readable" on public.wc_portfolio_entries for select using(true);
drop policy if exists "Users create their own portfolio entries" on public.wc_portfolio_entries;
create policy "Users create their own portfolio entries" on public.wc_portfolio_entries for insert to authenticated with check(auth.uid()=user_id);
drop policy if exists "Users update their own portfolio entries" on public.wc_portfolio_entries;
create policy "Users update their own portfolio entries" on public.wc_portfolio_entries for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "Users delete their own portfolio entries" on public.wc_portfolio_entries;
create policy "Users delete their own portfolio entries" on public.wc_portfolio_entries for delete to authenticated using(auth.uid()=user_id);
revoke all on public.wc_portfolio_entries from anon;
grant select on public.wc_portfolio_entries to anon,authenticated;
grant insert,update,delete on public.wc_portfolio_entries to authenticated;
create or replace function public.wc_portfolio_set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists wc_portfolio_entries_updated_at on public.wc_portfolio_entries;
create trigger wc_portfolio_entries_updated_at before update on public.wc_portfolio_entries for each row execute function public.wc_portfolio_set_updated_at();
