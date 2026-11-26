-- ZUMAYA NATIF : modules Restaurant & Hôtel (indépendants de l'ancien moteur ZUMUYA)
create table if not exists public.z_hospitality_team (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.rg_organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 member_kind text not null check(member_kind in ('staff','driver')),
 full_name text not null, phone text, job_title text,
 permissions jsonb not null default '[]'::jsonb,
 status text not null default 'active' check(status in ('active','disabled')),
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), unique(org_id,user_id)
);
create index if not exists z_hosp_team_org_idx on public.z_hospitality_team(org_id,status);
create table if not exists public.z_hospitality_records (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.rg_organizations(id) on delete cascade,
 record_type text not null check(record_type in ('menu_item','order','sale','stock_item','stock_move','room','reservation','promotion','review','delivery','setting')),
 title text not null default '', data jsonb not null default '{}'::jsonb,
 is_public boolean not null default false, created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists z_hosp_records_org_type_idx on public.z_hospitality_records(org_id,record_type,created_at desc);
create index if not exists z_hosp_records_public_idx on public.z_hospitality_records(org_id,record_type) where is_public;
create table if not exists public.z_hospitality_audit (
 id bigint generated always as identity primary key, org_id uuid not null references public.rg_organizations(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null, action text not null, record_type text, record_id uuid,
 details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists z_hosp_audit_org_idx on public.z_hospitality_audit(org_id,created_at desc);

create or replace function public.z_hosp_is_owner(p_org uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.rg_organizations o where o.id=p_org and o.owner_id=auth.uid());
$$;
create or replace function public.z_hosp_can(p_org uuid,p_permission text default null) returns boolean
language sql stable security definer set search_path=public as $$
 select public.z_hosp_is_owner(p_org) or exists(
  select 1 from public.z_hospitality_team m where m.org_id=p_org and m.user_id=auth.uid() and m.status='active'
  and (p_permission is null or m.permissions ? p_permission or m.permissions ? 'all')
 );
$$;
revoke all on function public.z_hosp_is_owner(uuid) from public;
revoke all on function public.z_hosp_can(uuid,text) from public;
grant execute on function public.z_hosp_is_owner(uuid),public.z_hosp_can(uuid,text) to authenticated;

alter table public.z_hospitality_team enable row level security;
alter table public.z_hospitality_records enable row level security;
alter table public.z_hospitality_audit enable row level security;
drop policy if exists z_hosp_team_read on public.z_hospitality_team;
create policy z_hosp_team_read on public.z_hospitality_team for select to authenticated using(public.z_hosp_is_owner(org_id) or user_id=auth.uid());
drop policy if exists z_hosp_team_owner_all on public.z_hospitality_team;
create policy z_hosp_team_owner_all on public.z_hospitality_team for all to authenticated using(public.z_hosp_is_owner(org_id)) with check(public.z_hosp_is_owner(org_id));
drop policy if exists z_hosp_records_read on public.z_hospitality_records;
create policy z_hosp_records_read on public.z_hospitality_records for select to authenticated using(
 public.z_hosp_can(org_id,'reports')
 or public.z_hosp_can(org_id,case record_type
   when 'menu_item' then 'menu'
   when 'order' then 'orders'
   when 'sale' then 'sales'
   when 'stock_item' then 'stock'
   when 'stock_move' then 'stock'
   when 'room' then 'rooms'
   when 'reservation' then 'reservations'
   when 'promotion' then 'promotions'
   when 'review' then 'orders'
   when 'delivery' then 'deliveries'
   else 'settings' end)
);
drop policy if exists z_hosp_records_public_menu on public.z_hospitality_records;
create policy z_hosp_records_public_menu on public.z_hospitality_records for select to anon,authenticated using(record_type='menu_item' and is_public=true and coalesce((data->>'is_available')::boolean,true));
drop policy if exists z_hosp_records_insert on public.z_hospitality_records;
create policy z_hosp_records_insert on public.z_hospitality_records for insert to authenticated with check(public.z_hosp_can(org_id,case record_type when 'menu_item' then 'menu' when 'order' then 'orders' when 'sale' then 'sales' when 'stock_item' then 'stock' when 'stock_move' then 'stock' when 'room' then 'rooms' when 'reservation' then 'reservations' when 'promotion' then 'promotions' when 'delivery' then 'deliveries' else 'settings' end));
drop policy if exists z_hosp_records_update on public.z_hospitality_records;
create policy z_hosp_records_update on public.z_hospitality_records for update to authenticated using(public.z_hosp_can(org_id,case record_type when 'menu_item' then 'menu' when 'order' then 'orders' when 'sale' then 'sales' when 'stock_item' then 'stock' when 'stock_move' then 'stock' when 'room' then 'rooms' when 'reservation' then 'reservations' when 'promotion' then 'promotions' when 'delivery' then 'deliveries' else 'settings' end)) with check(public.z_hosp_can(org_id,case record_type when 'menu_item' then 'menu' when 'order' then 'orders' when 'sale' then 'sales' when 'stock_item' then 'stock' when 'stock_move' then 'stock' when 'room' then 'rooms' when 'reservation' then 'reservations' when 'promotion' then 'promotions' when 'delivery' then 'deliveries' else 'settings' end));
drop policy if exists z_hosp_records_delete on public.z_hospitality_records;
create policy z_hosp_records_delete on public.z_hospitality_records for delete to authenticated using(public.z_hosp_can(org_id,case record_type when 'menu_item' then 'menu' when 'order' then 'orders' when 'sale' then 'sales' when 'stock_item' then 'stock' when 'stock_move' then 'stock' when 'room' then 'rooms' when 'reservation' then 'reservations' when 'promotion' then 'promotions' when 'review' then 'orders' when 'delivery' then 'deliveries' else 'settings' end));
drop policy if exists z_hosp_audit_read on public.z_hospitality_audit;
create policy z_hosp_audit_read on public.z_hospitality_audit for select to authenticated using(public.z_hosp_is_owner(org_id));
revoke insert,update,delete on public.z_hospitality_audit from anon,authenticated;
grant select on public.z_hospitality_audit,public.z_hospitality_team,public.z_hospitality_records to authenticated;
grant select on public.z_hospitality_records to anon;
grant insert,update,delete on public.z_hospitality_records to authenticated;
grant select,insert,update,delete on public.z_hospitality_team to authenticated;

create or replace function public.z_hosp_audit_record() returns trigger language plpgsql security definer set search_path=public as $$
declare v_org uuid; v_id uuid; v_type text; v_action text;
begin
 if tg_op='DELETE' then v_org:=old.org_id;v_id:=old.id;v_type:=old.record_type;v_action:='delete';
 else v_org:=new.org_id;v_id:=new.id;v_type:=new.record_type;v_action:=lower(tg_op); end if;
 insert into public.z_hospitality_audit(org_id,actor_id,action,record_type,record_id,details)
 values(v_org,auth.uid(),v_action,v_type,v_id,jsonb_build_object('title',case when tg_op='DELETE' then old.title else new.title end));
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
drop trigger if exists z_hosp_records_audit on public.z_hospitality_records;
create trigger z_hosp_records_audit after insert or update or delete on public.z_hospitality_records for each row execute function public.z_hosp_audit_record();
revoke all on function public.z_hosp_audit_record() from public;

create or replace function public.z_hosp_audit_team() returns trigger language plpgsql security definer set search_path=public as $$
declare v_action text; v_actor uuid;
begin
 v_action:=case when tg_op='INSERT' then 'create_'||new.member_kind else 'update_member' end;
 v_actor:=coalesce(auth.uid(),new.created_by,old.created_by);
 insert into public.z_hospitality_audit(org_id,actor_id,action,record_type,record_id,details)
 values(coalesce(new.org_id,old.org_id),v_actor,v_action,coalesce(new.member_kind,old.member_kind),coalesce(new.id,old.id),jsonb_build_object('member_name',coalesce(new.full_name,old.full_name),'status',coalesce(new.status,old.status)));
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke all on function public.z_hosp_audit_team() from public;
drop trigger if exists z_hosp_team_audit on public.z_hospitality_team;
create trigger z_hosp_team_audit after insert or update or delete on public.z_hospitality_team for each row execute function public.z_hosp_audit_team();

-- RPC publique sécurisée : le client ne choisit jamais les prix ; ils sont relus dans le catalogue.
create or replace function public.z_hosp_public_order(p_org uuid,p_customer_name text,p_customer_phone text,p_note text,p_items jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_order uuid; v_item jsonb; v_product public.z_hospitality_records; v_qty numeric; v_total numeric:=0; v_lines jsonb:='[]'::jsonb; v_name text; v_price numeric;
begin
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>30 then raise exception 'Panier invalide'; end if;
 if not exists(select 1 from public.rg_organizations where id=p_org and organization_type in ('restaurant','hotel') and verification_status='verified') then raise exception 'Établissement indisponible'; end if;
 for v_item in select * from jsonb_array_elements(p_items) loop
  select * into v_product from public.z_hospitality_records where id=(v_item->>'id')::uuid and org_id=p_org and record_type='menu_item' and is_public=true and coalesce((data->>'is_available')::boolean,true);
  if not found then raise exception 'Un article du panier est indisponible'; end if;
  v_qty:=greatest(1,least(50,coalesce((v_item->>'quantity')::numeric,1)));
  v_name:=v_product.title;v_price:=greatest(0,coalesce((v_product.data->>'price')::numeric,0));
  v_total:=v_total+v_qty*v_price;
  v_lines:=v_lines||jsonb_build_array(jsonb_build_object('id',v_product.id,'title',v_name,'quantity',v_qty,'unit_price',v_price,'line_total',v_qty*v_price));
 end loop;
 insert into public.z_hospitality_records(org_id,record_type,title,data,is_public)
 values(p_org,'order','Commande publique',jsonb_build_object('customer_name',left(coalesce(p_customer_name,''),120),'customer_phone',left(coalesce(p_customer_phone,''),40),'note',left(coalesce(p_note,''),500),'items',v_lines,'total',v_total,'currency','XOF','status','new'),false) returning id into v_order;
 return v_order;
end $$;
revoke all on function public.z_hosp_public_order(uuid,text,text,text,jsonb) from public;
grant execute on function public.z_hosp_public_order(uuid,text,text,text,jsonb) to anon,authenticated;
-- Catalogue public : RPC dédiée pour ne jamais exposer owner_id ou les champs privés des organisations.
drop policy if exists z_hosp_public_org_read on public.rg_organizations;
create or replace function public.z_hosp_public_catalog(p_org uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_org public.rg_organizations; v_items jsonb;
begin
 select * into v_org from public.rg_organizations where id=p_org and organization_type in ('restaurant','hotel') and verification_status='verified';
 if not found then return null; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'data',r.data) order by r.created_at desc),'[]'::jsonb) into v_items
 from public.z_hospitality_records r where r.org_id=p_org and r.record_type='menu_item' and r.is_public=true and coalesce((r.data->>'is_available')::boolean,true);
 return jsonb_build_object('organization',jsonb_build_object('id',v_org.id,'organization_type',v_org.organization_type,'public_name',v_org.public_name,'legal_name',v_org.legal_name,'city',v_org.city,'address',v_org.address,'contact_phone',v_org.contact_phone),'items',v_items);
end $$;
revoke all on function public.z_hosp_public_catalog(uuid) from public;
grant execute on function public.z_hosp_public_catalog(uuid) to anon,authenticated;
