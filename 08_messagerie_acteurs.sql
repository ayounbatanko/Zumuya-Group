-- ZUMUYA GROUP — messagerie privée entre clients, vendeurs et partenaires
-- À exécuter après les scripts de base dans Supabase SQL Editor.
create table if not exists public.rg_market_conversations (
  id uuid primary key default gen_random_uuid(),
  subject text not null default 'Nouvelle conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.rg_market_conversation_members (
  conversation_id uuid not null references public.rg_market_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Utilisateur ZUMUYA',
  account_type text,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key(conversation_id,user_id)
);
create table if not exists public.rg_market_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.rg_market_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists rg_market_messages_conversation_date on public.rg_market_messages(conversation_id,created_at);
create index if not exists rg_market_members_user on public.rg_market_conversation_members(user_id,joined_at desc);

alter table public.rg_market_conversations enable row level security;
alter table public.rg_market_conversation_members enable row level security;
alter table public.rg_market_messages enable row level security;
create or replace function public.rg_market_is_member(p_conversation uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.rg_market_conversation_members where conversation_id=p_conversation and user_id=auth.uid());
$$;
revoke all on function public.rg_market_is_member(uuid) from public,anon;
grant execute on function public.rg_market_is_member(uuid) to authenticated;
drop policy if exists market_conversation_member_read on public.rg_market_conversations;
create policy market_conversation_member_read on public.rg_market_conversations for select to authenticated
using(public.rg_market_is_member(id));
drop policy if exists market_members_self_read on public.rg_market_conversation_members;
create policy market_members_self_read on public.rg_market_conversation_members for select to authenticated
using(public.rg_market_is_member(conversation_id));
drop policy if exists market_messages_member_read on public.rg_market_messages;
create policy market_messages_member_read on public.rg_market_messages for select to authenticated
using(public.rg_market_is_member(rg_market_messages.conversation_id));
drop policy if exists market_messages_member_insert on public.rg_market_messages;
create policy market_messages_member_insert on public.rg_market_messages for insert to authenticated
with check(sender_id=auth.uid() and public.rg_market_is_member(rg_market_messages.conversation_id));
grant select on public.rg_market_conversations,public.rg_market_conversation_members,public.rg_market_messages to authenticated;
grant insert on public.rg_market_messages to authenticated;

create or replace function public.rg_market_start_conversation(p_other_user uuid,p_subject text default 'Nouvelle conversation')
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare cid uuid; me_name text; other_name text; me_role text; other_role text;
begin
 if auth.uid() is null then raise exception 'Authentification requise'; end if;
 if p_other_user is null or p_other_user=auth.uid() then raise exception 'Destinataire invalide'; end if;
 select coalesce(raw_user_meta_data->>'name',email,'Utilisateur ZUMUYA'),raw_user_meta_data->>'account_type'
 into other_name,other_role from auth.users where id=p_other_user;
 if not found then raise exception 'Ce compte utilisateur est introuvable'; end if;
 select coalesce(raw_user_meta_data->>'name',email,'Utilisateur ZUMUYA'),raw_user_meta_data->>'account_type'
 into me_name,me_role from auth.users where id=auth.uid();
 insert into public.rg_market_conversations(subject) values(left(coalesce(nullif(trim(p_subject),''),'Nouvelle conversation'),120)) returning id into cid;
 insert into public.rg_market_conversation_members(conversation_id,user_id,display_name,account_type)
 values(cid,auth.uid(),me_name,me_role),(cid,p_other_user,other_name,other_role);
 return cid;
end $$;
revoke all on function public.rg_market_start_conversation(uuid,text) from public,anon;
grant execute on function public.rg_market_start_conversation(uuid,text) to authenticated;

create or replace function public.rg_market_touch_conversation(p_conversation uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.rg_market_conversation_members where conversation_id=p_conversation and user_id=auth.uid()) then raise exception 'Accès refusé'; end if;
 update public.rg_market_conversations set updated_at=now() where id=p_conversation;
 update public.rg_market_conversation_members set last_read_at=now() where conversation_id=p_conversation and user_id=auth.uid();
end $$;
revoke all on function public.rg_market_touch_conversation(uuid) from public,anon;
grant execute on function public.rg_market_touch_conversation(uuid) to authenticated;
notify pgrst,'reload schema';
