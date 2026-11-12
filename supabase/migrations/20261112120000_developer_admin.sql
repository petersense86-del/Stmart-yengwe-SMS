-- Developer accounts: full headteacher-level access alongside the real
-- headteacher. A developer has role 'headteacher' plus is_developer = true, so
-- every existing permission applies unchanged, while the one-headteacher rule
-- and "who is the headteacher" lookups ignore developers.

alter table public.profiles add column if not exists is_developer boolean not null default false;

drop index if exists public.profiles_one_headteacher;
create unique index profiles_one_headteacher on public.profiles (role) where role = 'headteacher' and not is_developer;

-- Only trusted server-side SQL may grant or remove developer status.
create or replace function private.profiles_developer_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.is_developer := old.is_developer;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_developer_guard on public.profiles;
create trigger profiles_developer_guard before update on public.profiles
  for each row execute function private.profiles_developer_guard();
grant execute on function private.profiles_developer_guard() to authenticated;
