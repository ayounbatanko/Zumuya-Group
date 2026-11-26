-- ZUMUYA GROUP — 20 : harmonisation des droits rapports / journal
-- À exécuter après la migration 19. Relançable.
-- Compatibilité avec les clés de permissions historiques `report` et `reports`.

create or replace function public.z_hosp_can(p_org uuid,p_permission text default null)
returns boolean
language sql stable security definer set search_path=public as $$
 select public.z_hosp_is_owner(p_org) or exists(
   select 1
   from public.z_hospitality_team m
   where m.org_id=p_org and m.user_id=auth.uid() and m.status='active'
     and (
       p_permission is null
       or m.permissions ? p_permission
       or (p_permission='reports' and m.permissions ? 'report')
       or (p_permission='report' and m.permissions ? 'reports')
       or m.permissions ? 'all'
     )
 );
$$;
revoke all on function public.z_hosp_can(uuid,text) from public;
grant execute on function public.z_hosp_can(uuid,text) to authenticated;

drop policy if exists rg_activity_read_own on public.rg_activity_events;
create policy rg_activity_read_own on public.rg_activity_events for select to authenticated
using (
  actor_id=auth.uid()
  or public.rg_is_platform_owner()
  or (org_id is not null and exists(
    select 1 from public.rg_organizations o
    where o.id=rg_activity_events.org_id and o.owner_id=auth.uid()
  ))
  or (org_id is not null and public.z_hosp_can(rg_activity_events.org_id,'reports'))
);

comment on function public.z_hosp_can(uuid,text) is
'Contrôle des permissions ZUMUYA restaurant/hôtel ; accepte report et reports pour compatibilité.';
