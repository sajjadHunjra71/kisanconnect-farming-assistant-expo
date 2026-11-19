-- Users may update their own profile row (RLS), but must never change `role` or `created_at`.
-- A column-level REVOKE is not enough on Supabase because `authenticated` holds a table-level
-- UPDATE grant, so enforce it with a trigger. Runs as the caller (security invoker), so API
-- requests run as `authenticated`/`anon`; the service role and the SQL editor (postgres) may still change roles.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and current_user in ('authenticated', 'anon') then
    raise exception 'role can only be changed by the server' using errcode = '42501';
  end if;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists profiles_protect_columns on public.profiles;
create trigger profiles_protect_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();
