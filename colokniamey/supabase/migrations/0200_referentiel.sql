-- 0200_referentiel.sql
-- Module M1 : référentiel géographique (villes, quartiers, universités).

-- PostGIS dans le schéma « extensions » (pratique recommandée par Supabase : public reste propre)
create extension if not exists postgis with schema extensions;

-- =====================================================================
-- Tables
-- =====================================================================

-- RG22 : la ville a un centre et un rayon qui définissent sa zone
create table public.villes (
  id bigint generated always as identity primary key,
  nom text not null unique check (char_length(nom) between 1 and 100),
  centre extensions.geography(Point, 4326) not null,
  rayon_km numeric not null check (rayon_km > 0 and rayon_km <= 200)
);

create table public.quartiers (
  id bigint generated always as identity primary key,
  nom text not null check (char_length(nom) between 1 and 100),
  ville_id bigint not null references public.villes (id) on delete restrict,
  commune text check (char_length(commune) <= 100),
  centre extensions.geography(Point, 4326),
  unique (nom, ville_id)
);
create index quartiers_ville_idx on public.quartiers (ville_id);

-- RG07 : une université appartient à une ville
-- RG25 bis : la position est facultative ; sans elle, pas de marqueur ni de distance
create table public.universites (
  id bigint generated always as identity primary key,
  nom text not null check (char_length(nom) between 1 and 200),
  sigle text check (char_length(sigle) <= 20),
  ville_id bigint not null references public.villes (id) on delete restrict,
  quartier_id bigint references public.quartiers (id) on delete set null,
  adresse text check (char_length(adresse) <= 300),
  position extensions.geography(Point, 4326),
  unique (nom, ville_id)
);
create index universites_ville_idx on public.universites (ville_id);
create index universites_position_idx on public.universites using gist (position);

-- =====================================================================
-- RG22 : un point doit se trouver dans la zone de sa ville
-- (une contrainte CHECK ne peut pas lire une autre table : on utilise un déclencheur)
-- =====================================================================
create function public.verifier_zone_ville()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ville public.villes;
  v_point extensions.geography;
begin
  select * into v_ville from public.villes where id = new.ville_id;

  if tg_table_name = 'quartiers' then
    v_point := new.centre;
  else
    v_point := new.position;
  end if;

  -- RG22 : hors de la zone (centre + rayon_km), le point est refusé
  if v_point is not null
     and extensions.st_distance(v_point, v_ville.centre) > v_ville.rayon_km * 1000 then
    raise exception 'Ce point est en dehors de la zone de la ville.';
  end if;

  -- Le quartier d'une université doit être dans la même ville (RG07)
  if tg_table_name = 'universites' and new.quartier_id is not null then
    if not exists (
      select 1 from public.quartiers where id = new.quartier_id and ville_id = new.ville_id
    ) then
      raise exception 'Le quartier choisi n''appartient pas à la ville de l''université.';
    end if;
  end if;

  return new;
end;
$$;

create trigger quartiers_zone before insert or update on public.quartiers
  for each row execute function public.verifier_zone_ville();
create trigger universites_zone before insert or update on public.universites
  for each row execute function public.verifier_zone_ville();

-- =====================================================================
-- RLS : lecture publique, aucune écriture (A5 ajoutera l'administration)
-- =====================================================================
alter table public.villes enable row level security;
alter table public.quartiers enable row level security;
alter table public.universites enable row level security;

revoke all on table public.villes, public.quartiers, public.universites from anon, authenticated;
grant select on public.villes, public.quartiers, public.universites to anon, authenticated;

create policy villes_lecture_publique on public.villes for select to anon, authenticated using (true);
create policy quartiers_lecture_publique on public.quartiers for select to anon, authenticated using (true);
create policy universites_lecture_publique on public.universites for select to anon, authenticated using (true);

-- =====================================================================
-- Vues de lecture avec latitude et longitude (le type geography n'est pas lisible tel quel
-- par le navigateur). security_invoker : la RLS de l'appelant s'applique (RGP18).
-- Ces coordonnées sont publiques : ce sont des lieux, pas des données personnelles.
-- =====================================================================
create view public.villes_geo with (security_invoker = true) as
  select id, nom, rayon_km,
         extensions.st_y(centre::extensions.geometry) as latitude,
         extensions.st_x(centre::extensions.geometry) as longitude
  from public.villes;

create view public.quartiers_geo with (security_invoker = true) as
  select id, nom, ville_id, commune,
         extensions.st_y(centre::extensions.geometry) as latitude,
         extensions.st_x(centre::extensions.geometry) as longitude
  from public.quartiers;

create view public.universites_geo with (security_invoker = true) as
  select id, nom, sigle, ville_id, quartier_id, adresse,
         extensions.st_y(position::extensions.geometry) as latitude,
         extensions.st_x(position::extensions.geometry) as longitude
  from public.universites;

revoke all on public.villes_geo, public.quartiers_geo, public.universites_geo from anon, authenticated;
grant select on public.villes_geo, public.quartiers_geo, public.universites_geo to anon, authenticated;

-- Fonctions : verifier_zone_ville est un déclencheur, aucun GRANT nécessaire (RGP17).
-- Fonction -> rôles autorisés : aucune fonction appelable du module M1.
