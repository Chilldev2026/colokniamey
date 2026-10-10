-- 1050_communiques.sql
-- Module A4 : communiqués (RGA13, RGA14, RGA28). Un communiqué a un niveau, une cible et une période d'affichage.
-- Il est affiché aux utilisateurs concernés dans la zone de communiqué du layout (M0).
--
-- Droits : tout admin crée et modifie les communiqués d'information ou d'avertissement ; le niveau « critique » est réservé
-- au super-admin (RGA28), vérifié par les politiques d'écriture. Un communiqué critique ne peut pas être masqué (RGA14).
-- Création, modification et suppression sont journalisées (RGA06).

create type public.niveau_communique as enum ('information', 'avertissement', 'critique');
create type public.cible_communique as enum ('tous', 'etudiants', 'proprietaires');

create table public.communiques (
  id bigint generated always as identity primary key,
  titre text not null check (char_length(btrim(titre)) between 3 and 100),
  message text not null check (char_length(btrim(message)) between 3 and 500),
  niveau public.niveau_communique not null default 'information',
  cible public.cible_communique not null default 'tous',
  debut timestamptz not null default now(),
  fin timestamptz not null,
  cree_par uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint communiques_periode check (fin > debut)
);
create index communiques_periode_idx on public.communiques (debut, fin);

create table public.communiques_masques (
  user_id uuid not null references auth.users (id) on delete cascade,
  communique_id bigint not null references public.communiques (id) on delete cascade,
  primary key (user_id, communique_id)
);

-- RG45 : les textes passent par le contrôle de S (blocage seulement : le texte est écrit par un admin, il n'y a pas de revue)
create trigger communiques_1_texte before insert or update on public.communiques
  for each row execute function public.controler_colonnes_texte('communique', 'prive', 'cree_par', 'titre', 'message');

create function public.preparer_communique()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.cree_par := old.cree_par;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
create trigger communiques_0_preparation before insert or update on public.communiques
  for each row execute function public.preparer_communique();

-- RGA06 : journalisation, sans le texte (aucune donnée inutile dans le journal)
create function public.journaliser_communique()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ligne public.communiques := case when tg_op = 'DELETE' then old else new end;
begin
  perform public.journaliser('communique_' || lower(tg_op), 'communique', v_ligne.id::text,
    jsonb_build_object('niveau', v_ligne.niveau, 'cible', v_ligne.cible));
  return null;
end;
$$;
create trigger communiques_9_journal after insert or update or delete on public.communiques
  for each row execute function public.journaliser_communique();

-- RLS : lecture et écriture réservées aux admins ; le public passe par communiques_actifs()
alter table public.communiques enable row level security;
alter table public.communiques_masques enable row level security;
revoke all on table public.communiques, public.communiques_masques from anon, authenticated;
grant select, delete on public.communiques to authenticated;
grant insert (titre, message, niveau, cible, debut, fin) on public.communiques to authenticated;
grant update (titre, message, niveau, cible, debut, fin) on public.communiques to authenticated;

create policy communiques_lecture_admin on public.communiques for select to authenticated using (public.est_admin());
-- RGA28 : un admin ne crée, ne modifie ni ne supprime un communiqué critique ; le super-admin le peut
create policy communiques_creation on public.communiques for insert to authenticated
  with check (public.est_admin() and (niveau <> 'critique' or public.est_super_admin()));
create policy communiques_modification on public.communiques for update to authenticated
  using (public.est_admin() and (niveau <> 'critique' or public.est_super_admin()))
  with check (public.est_admin() and (niveau <> 'critique' or public.est_super_admin()));
create policy communiques_suppression on public.communiques for delete to authenticated
  using (public.est_admin() and (niveau <> 'critique' or public.est_super_admin()));

-- Communiqués à afficher maintenant : dans leur période, adaptés au rôle (un visiteur ne voit que « tous »), non masqués.
-- Un communiqué critique ne se masque jamais (RGA14). Appelable par les visiteurs : le contenu est public par nature.
create function public.communiques_actifs()
returns table (id bigint, titre text, message text, niveau text, debut timestamptz, fin timestamptz, masquable boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.role_utilisateur;
begin
  if v_uid is not null then
    select role into v_role from public.profils where profils.id = v_uid and statut = 'actif';
  end if;
  return query
    select c.id, c.titre, c.message, c.niveau::text, c.debut, c.fin, c.niveau <> 'critique'
    from public.communiques c
    where now() >= c.debut and now() < c.fin
      and (c.cible = 'tous'
           or (c.cible = 'etudiants' and v_role = 'etudiant')
           or (c.cible = 'proprietaires' and v_role = 'proprietaire'))
      and (c.niveau = 'critique' or v_uid is null or not exists (select 1 from public.communiques_masques m where m.communique_id = c.id and m.user_id = v_uid))
    order by case c.niveau when 'critique' then 0 when 'avertissement' then 1 else 2 end, c.debut desc, c.id desc
    limit 5;
end;
$$;

-- Masquer un communiqué (connecté). Refusé pour un communiqué critique (RGA14).
create function public.masquer_communique(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_niveau public.niveau_communique;
begin
  if not public.est_actif() then
    raise exception 'Connexion requise.';
  end if;
  select niveau into v_niveau from public.communiques where id = p_id;
  if not found then
    raise exception 'Communiqué introuvable.';
  end if;
  if v_niveau = 'critique' then
    raise exception 'Un communiqué critique ne peut pas être masqué.';
  end if;
  insert into public.communiques_masques (user_id, communique_id) values (auth.uid(), p_id) on conflict do nothing;
end;
$$;

revoke execute on function
  public.preparer_communique(), public.journaliser_communique(), public.communiques_actifs(), public.masquer_communique(bigint)
  from public, anon, authenticated;
grant execute on function public.communiques_actifs() to anon, authenticated;
grant execute on function public.masquer_communique(bigint) to authenticated;
-- Internes, sans GRANT : preparer_communique, journaliser_communique
