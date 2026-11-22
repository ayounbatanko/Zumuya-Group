-- ZUMAYA GROUP — correctif configuration des pôles et catalogue public unifié
-- Migration additive et relançable. Ne supprime aucune donnée métier.

-- 1) RPC manquante / codes UI différents des codes enregistrés dans rg_module_catalog.
create or replace function public.rg_ecosystem_set_module(
  p_module text,
  p_org uuid default null,
  p_configuration jsonb default '{}'::jsonb,
  p_status text default 'active'
) returns void
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_module text;
  v_config jsonb := coalesce(p_configuration,'{}'::jsonb);
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  if p_status not in ('active','paused') then raise exception 'Statut non autorisé.'; end if;
  v_module := case p_module when 'restaurant' then 'restauration' when 'delivery' then 'livraison' else p_module end;
  if not exists(select 1 from public.rg_module_catalog where module_code=v_module and rollout_status='available') then
    raise exception 'Pôle indisponible ou non configuré (%).',v_module;
  end if;
  if p_org is not null then
    if not exists(select 1 from public.rg_organizations where id=p_org and owner_id=v_uid) then
      raise exception 'Organisation non autorisée.';
    end if;
    v_config := v_config || jsonb_build_object('organization_id',p_org);
  end if;
  insert into public.rg_user_modules(user_id,module_code,status,configuration)
  values(v_uid,v_module,p_status,v_config)
  on conflict(user_id,module_code) do update
    set status=excluded.status,
        configuration=public.rg_user_modules.configuration || excluded.configuration,
        updated_at=now();
end;
$$;
grant select,insert,update on public.rg_user_modules to authenticated;
revoke all on function public.rg_ecosystem_set_module(text,uuid,jsonb,text) from public,anon;
grant execute on function public.rg_ecosystem_set_module(text,uuid,jsonb,text) to authenticated;

-- 2) Identifiant stable pour synchroniser les menus dont l'identifiant source est du texte.
alter table public.rg_public_offers add column if not exists source_key text;
create unique index if not exists rg_public_offers_source_key_unique
  on public.rg_public_offers(source_table,source_key)
  where source_table is not null and source_key is not null;

-- 3) Synchronisation des menus Restaurant / Hôtel vers le catalogue central.
create or replace function public.rg_sync_rest_menu_data(p_rest_id text,p_data jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_seller_text text; v_seller uuid; v_module text; v_currency text;
  v_item jsonb; v_idx bigint; v_title text; v_price bigint; v_imgs jsonb;
begin
  delete from public.rg_public_offers where source_table='rg_rests' and source_key like p_rest_id || ':%';
  v_seller_text:=coalesce(p_data->>'ownerAuthId',p_data->>'restaurantOwnerAuthId',p_data->>'portalOwnerId');
  if coalesce(v_seller_text,'') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return; end if;
  v_seller:=v_seller_text::uuid;
  if not exists(select 1 from auth.users where id=v_seller) then return; end if;
  v_module:=case when coalesce(p_data->>'businessType','')='hotel' or coalesce(p_data->'hotel'->>'enabled','false')='true' then 'hotel' else 'restauration' end;
  v_currency:=coalesce(nullif(p_data->>'currency',''),'XOF');
  if jsonb_typeof(p_data->'menu')='array' then
    for v_item,v_idx in select value,ordinality from jsonb_array_elements(p_data->'menu') with ordinality loop
      v_title:=nullif(trim(coalesce(v_item->>'n',v_item->>'name','')),'');
      if v_title is null then continue; end if;
      if coalesce(v_item->>'p','') !~ '^[0-9]+([.][0-9]+)?$' then continue; end if;
      v_price:=round((v_item->>'p')::numeric)::bigint;
      v_imgs:=case when jsonb_typeof(v_item->'imgs')='array' then v_item->'imgs'
                   when nullif(v_item->>'img','') is not null then jsonb_build_array(v_item->>'img') else '[]'::jsonb end;
      insert into public.rg_public_offers(seller_id,module_code,category,title,description,price_minor,currency_code,stock_quantity,media_urls,is_public,source_table,source_key)
      values(v_seller,v_module,'Menu',v_title,coalesce(v_item->>'desc',''),greatest(v_price,0),v_currency,null,v_imgs,true,'rg_rests',p_rest_id||':'||v_idx::text);
    end loop;
  end if;
end;
$$;

create or replace function public.rg_sync_rest_menu_to_public_catalog()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' then
    delete from public.rg_public_offers where source_table='rg_rests' and source_key like old.id || ':%';
    return old;
  end if;
  perform public.rg_sync_rest_menu_data(new.id,new.data);
  return new;
end;
$$;
drop trigger if exists rg_sync_rest_menu_to_public_catalog_trigger on public.rg_rests;
create trigger rg_sync_rest_menu_to_public_catalog_trigger
after insert or update or delete on public.rg_rests
for each row execute function public.rg_sync_rest_menu_to_public_catalog();
revoke all on function public.rg_sync_rest_menu_data(text,jsonb) from public,anon,authenticated;
revoke all on function public.rg_sync_rest_menu_to_public_catalog() from public,anon,authenticated;
do $$ declare r record; begin
  for r in select id,data from public.rg_rests loop
    perform public.rg_sync_rest_menu_data(r.id,r.data);
  end loop;
end $$;

-- 4) Marketplace : une boutique active peut publier sans attendre sa vérification administrative.
create or replace function public.rg_sync_marketplace_public_offer()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_store public.commerce_stores%rowtype;
begin
  if tg_op='DELETE' then
    delete from public.rg_public_offers where source_table='commerce_products' and source_id=old.id;
    return old;
  end if;
  select * into v_store from public.commerce_stores where id=new.store_id;
  if new.status='active' and coalesce(v_store.is_active,false) then
    insert into public.rg_public_offers(seller_id,module_code,category,title,description,price_minor,currency_code,stock_quantity,media_urls,is_public,source_table,source_id)
    values(v_store.owner_id,'marketplace','Marketplace',new.title,coalesce(new.description,''),greatest(0,round(new.price))::bigint,new.currency,new.stock_quantity,
      case when jsonb_typeof(new.media_urls)='array' then new.media_urls else '[]'::jsonb end,true,'commerce_products',new.id)
    on conflict(source_table,source_id) where source_table is not null and source_id is not null
    do update set seller_id=excluded.seller_id,title=excluded.title,description=excluded.description,price_minor=excluded.price_minor,
      currency_code=excluded.currency_code,stock_quantity=excluded.stock_quantity,media_urls=excluded.media_urls,is_public=true,updated_at=now();
  else
    update public.rg_public_offers set is_public=false,updated_at=now() where source_table='commerce_products' and source_id=new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.rg_sync_marketplace_public_offer() from public,anon,authenticated;

-- 5) Table publique dédiée, limitée aux champs nécessaires.
-- Ne jamais exposer directement rg_rests.data : cette table contient aussi des données internes.
do $$ begin
  if exists(select 1 from pg_class where oid=to_regclass('public.rg_public_restaurants') and relkind='v') then
    execute 'drop view public.rg_public_restaurants';
  end if;
end $$;
create table if not exists public.rg_public_restaurants (
  id text primary key,
  seq bigint not null default 0,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.rg_public_restaurants enable row level security;
drop policy if exists rg_public_restaurants_read_public on public.rg_public_restaurants;
create policy rg_public_restaurants_read_public on public.rg_public_restaurants
  for select to anon,authenticated using(true);
revoke all on public.rg_public_restaurants from public;
grant select on public.rg_public_restaurants to anon,authenticated;

create or replace function public.rg_sync_public_restaurant_profile(p_rest_id text,p_seq bigint,p_data jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_public_data jsonb;
begin
  v_public_data:=jsonb_build_object(
    'id',p_rest_id,'name',coalesce(p_data->>'name','Établissement partenaire'),'address',coalesce(p_data->>'address',''),
    'lat',case when coalesce(p_data->>'lat','') ~ '^-?[0-9]+([.][0-9]+)?$' then (p_data->>'lat')::numeric else null end,
    'lng',case when coalesce(p_data->>'lng','') ~ '^-?[0-9]+([.][0-9]+)?$' then (p_data->>'lng')::numeric else null end,
    'currency',coalesce(p_data->>'currency','XOF'),
    'kmPrice',case when coalesce(p_data->>'kmPrice','') ~ '^[0-9]+([.][0-9]+)?$' then (p_data->>'kmPrice')::numeric else 0 end,
    'businessType',case when coalesce(p_data->>'businessType','')='hotel' or coalesce(p_data->'hotel'->>'enabled','false')='true' then 'hotel' else 'restaurant' end,
    'hotel',coalesce(p_data->'hotel','{}'::jsonb),'sub',coalesce(p_data->>'sub','trial'),
    'trialEnd',p_data->'trialEnd','subEnd',p_data->'subEnd','portalOrgId',p_data->'portalOrgId','logo',coalesce(p_data->>'logo',''),
    'menu',coalesce((select jsonb_agg(jsonb_build_object('n',o.title,'desc',o.description,'p',o.price_minor,'imgs',o.media_urls) order by o.source_key)
      from public.rg_public_offers o where o.source_table='rg_rests' and o.source_key like p_rest_id||':%' and o.is_public=true),'[]'::jsonb)
  );
  insert into public.rg_public_restaurants(id,seq,data,updated_at)
  values(p_rest_id,coalesce(p_seq,0),v_public_data,now())
  on conflict(id) do update set seq=excluded.seq,data=excluded.data,updated_at=now();
end;
$$;

create or replace function public.rg_sync_rest_menu_to_public_catalog()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' then
    delete from public.rg_public_offers where source_table='rg_rests' and source_key like old.id || ':%';
    delete from public.rg_public_restaurants where id=old.id;
    return old;
  end if;
  perform public.rg_sync_rest_menu_data(new.id,new.data);
  perform public.rg_sync_public_restaurant_profile(new.id,new.seq,new.data);
  return new;
end;
$$;

drop trigger if exists rg_sync_rest_menu_to_public_catalog_trigger on public.rg_rests;
create trigger rg_sync_rest_menu_to_public_catalog_trigger
after insert or update or delete on public.rg_rests
for each row execute function public.rg_sync_rest_menu_to_public_catalog();
revoke all on function public.rg_sync_rest_menu_data(text,jsonb) from public,anon,authenticated;
revoke all on function public.rg_sync_public_restaurant_profile(text,bigint,jsonb) from public,anon,authenticated;
revoke all on function public.rg_sync_rest_menu_to_public_catalog() from public,anon,authenticated;
do $$ declare r record; begin
  for r in select id,seq,data from public.rg_rests loop
    perform public.rg_sync_rest_menu_data(r.id,r.data);
    perform public.rg_sync_public_restaurant_profile(r.id,r.seq,r.data);
  end loop;
end $$;

grant select on public.rg_public_offers to anon,authenticated;
notify pgrst,'reload schema';
