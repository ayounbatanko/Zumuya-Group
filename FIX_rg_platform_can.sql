-- Correction immédiate : renommage du paramètre de rg_platform_can
-- À exécuter EN PREMIER dans le SQL Editor

drop function if exists public.rg_platform_can(text);

create or replace function public.rg_platform_can(p_permission text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $func$
  select public.rg_is_platform_owner()
  or exists (
    select 1
    from public.rg_platform_team_members m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and (p_permission is null or p_permission = any(m.permissions))
  );
$func$;

revoke all on function public.rg_platform_can(text) from public;
grant execute on function public.rg_platform_can(text) to authenticated;
