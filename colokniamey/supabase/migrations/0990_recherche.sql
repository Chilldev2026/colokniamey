-- 0990_recherche.sql
-- Module M5 : recherche, carte et favoris (RG23 à RG25, RG24).
-- Numérotée après M4 et A3. Les fonctions de recherche s'exécutent avec les droits de l'APPELANT : elles ne lisent que
-- la vue annonces_publiques de M4, donc ce que la RLS laisse voir au public (annonces publiées, non en revue, auteur
-- actif). Elles ne touchent jamais à la colonne « position » : seule la position publique (zone de 150 m ou point
-- choisi par l'auteur) est renvoyée (RG23).
--
-- Données personnelles (RGP01) : les favoris (qui aime quelle annonce) sont lisibles par leur seul propriétaire.

-- Index de recherche plein texte en français sur la table de M4 (un index n'en modifie pas la structure)
create index annonces_texte_idx on public.annonces
  using gin (to_tsvector('french', titre || ' ' || description))
  where statut = 'publiee';

-- =====================================================================
-- Filtres communs (liste et carte). Internes au module ; accordées car appelées par les fonctions qui s'exécutent avec les
-- droits de l'appelant.
-- Filtres reconnus (jsonb) : ville_id, quartier_id, universite_id (université proche), type, loyer_min, loyer_max,
-- disponible_avant (date), texte, equipements (liste d'identifiants), duree_mois, compatible (booléen).
-- « compatible » : un annonceur « étudiants uniquement » n'est montré qu'aux étudiants. Le genre et l'âge ne figurent pas
-- dans le profil (M3) : ils ne peuvent pas servir de critère [INFORMATION MANQUANTE].
-- M8 remplacera cette fonction pour ajouter le filtre « colocations en formation ».
-- =====================================================================
create function public.filtrer_annonces(p_filtres jsonb)
returns setof public.annonces_publiques
language sql
stable
set search_path = ''
as $$
  select v.*
  from public.annonces_publiques v
  join public.quartiers q on q.id = v.quartier_id
  where (nullif(p_filtres ->> 'ville_id', '') is null or q.ville_id = (p_filtres ->> 'ville_id')::bigint)
    and (nullif(p_filtres ->> 'quartier_id', '') is null or v.quartier_id = (p_filtres ->> 'quartier_id')::bigint)
    and (nullif(p_filtres ->> 'universite_id', '') is null or v.universite_proche_id = (p_filtres ->> 'universite_id')::bigint)
    and (nullif(p_filtres ->> 'type', '') is null or v.type::text = p_filtres ->> 'type')
    and (nullif(p_filtres ->> 'loyer_min', '') is null or v.part_mensuelle_fcfa >= (p_filtres ->> 'loyer_min')::integer)
    and (nullif(p_filtres ->> 'loyer_max', '') is null or v.part_mensuelle_fcfa <= (p_filtres ->> 'loyer_max')::integer)
    and (nullif(p_filtres ->> 'disponible_avant', '') is null or v.disponible_le is null or v.disponible_le <= (p_filtres ->> 'disponible_avant')::date)
    and (nullif(btrim(coalesce(p_filtres ->> 'texte', '')), '') is null
         or to_tsvector('french', v.titre || ' ' || v.description) @@ websearch_to_tsquery('french', left(p_filtres ->> 'texte', 200)))
    and not exists (
      select 1 from jsonb_array_elements_text(coalesce(p_filtres -> 'equipements', '[]'::jsonb)) as e (id)
      where not exists (select 1 from public.annonce_equipements ae where ae.annonce_id = v.id and ae.equipement_id = e.id::bigint)
    )
    and (nullif(p_filtres ->> 'duree_mois', '') is null
         or ((v.duree_min_mois is null or v.duree_min_mois <= (p_filtres ->> 'duree_mois')::integer)
             and (v.duree_max_mois is null or v.duree_max_mois >= (p_filtres ->> 'duree_mois')::integer)))
    and (coalesce((p_filtres ->> 'compatible')::boolean, false) = false
         or not v.etudiants_uniquement
         or exists (select 1 from public.profils p where p.id = (select auth.uid()) and p.role = 'etudiant'));
$$;

-- =====================================================================
-- Recherche en liste : tri et pagination par curseur
-- Tri : recent (défaut), loyer_asc, loyer_desc. Curseur : { "v": curseur_valeur, "id": id } de la dernière ligne reçue.
-- =====================================================================
create function public.rechercher_annonces(
  p_filtres jsonb default '{}'::jsonb,
  p_tri text default 'recent',
  p_curseur jsonb default null,
  p_limite integer default 20
)
returns table (
  id bigint, type text, titre text, part_mensuelle_fcfa integer, loyer_total_fcfa integer, nb_places integer,
  quartier_id bigint, universite_proche_id bigint, disponible_le date, photo_chemin text,
  latitude double precision, longitude double precision, zone_rayon_m integer, distance_universite_m integer,
  distance_ref_m integer, publiee_le timestamptz, curseur_valeur text
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_ordre text;
  v_curseur text := 'true';
  v_limite integer := least(greatest(coalesce(p_limite, 20), 1), 50);
  v_val text := p_curseur ->> 'v';
  v_id bigint := (p_curseur ->> 'id')::bigint;
begin
  if p_filtres is null or jsonb_typeof(p_filtres) <> 'object' then
    raise exception 'Filtres invalides.';
  end if;
  case p_tri
    when 'recent' then
      v_ordre := 'f.publiee_le desc nulls last, f.id desc';
      if v_val is not null then v_curseur := '(coalesce(f.publiee_le, ''epoch''::timestamptz), f.id) < ($2::timestamptz, $3)'; end if;
    when 'loyer_asc' then
      v_ordre := 'f.part_mensuelle_fcfa asc, f.id asc';
      if v_val is not null then v_curseur := '(f.part_mensuelle_fcfa, f.id) > ($2::integer, $3)'; end if;
    when 'loyer_desc' then
      v_ordre := 'f.part_mensuelle_fcfa desc, f.id desc';
      if v_val is not null then v_curseur := '(f.part_mensuelle_fcfa, f.id) < ($2::integer, $3)'; end if;
    else
      raise exception 'Tri invalide.';
  end case;

  -- RG25, RG25 bis : la distance n'est calculée que pour une université de référence qui a une position
  return query execute format($q$
    select f.id, f.type::text, f.titre, f.part_mensuelle_fcfa, f.loyer_total_fcfa, f.nb_places, f.quartier_id,
           f.universite_proche_id, f.disponible_le, f.photo_chemin, f.latitude, f.longitude, f.zone_rayon_m,
           f.distance_universite_m,
           case when ur.position is not null and f.latitude is not null
             then (round(extensions.st_distance(extensions.st_setsrid(extensions.st_makepoint(f.longitude, f.latitude), 4326)::extensions.geography, ur.position) / 10) * 10)::integer end,
           f.publiee_le,
           case when %L = 'recent' then coalesce(f.publiee_le, 'epoch'::timestamptz)::text else f.part_mensuelle_fcfa::text end
    from public.filtrer_annonces($1) f
    left join public.universites ur on ur.id = nullif($1 ->> 'universite_ref_id', '')::bigint
    where %s
    order by %s
    limit $4
  $q$, p_tri, v_curseur, v_ordre) using p_filtres, v_val, v_id, v_limite;
end;
$$;

-- =====================================================================
-- Carte : annonces publiées dans l'emprise visible (RG24). Emprise : { sud, ouest, nord, est } en degrés.
-- RG23 : latitude et longitude sont celles de la position PUBLIQUE ; zone_rayon_m vaut 150 pour une position
-- approximative (cercle à afficher), 0 pour une position exacte choisie par l'auteur.
-- groupe_en_formation : faux tant que M8 n'est pas installé (M8 remplace cette fonction).
-- =====================================================================
create function public.annonces_carte(p_emprise jsonb, p_filtres jsonb default '{}'::jsonb, p_limite integer default 300)
returns table (
  id bigint, type text, titre text, part_mensuelle_fcfa integer, quartier_id bigint, photo_chemin text,
  latitude double precision, longitude double precision, zone_rayon_m integer, distance_ref_m integer,
  groupe_en_formation boolean
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_sud double precision := (p_emprise ->> 'sud')::double precision;
  v_ouest double precision := (p_emprise ->> 'ouest')::double precision;
  v_nord double precision := (p_emprise ->> 'nord')::double precision;
  v_est double precision := (p_emprise ->> 'est')::double precision;
begin
  if p_filtres is null or jsonb_typeof(p_filtres) <> 'object' then
    raise exception 'Filtres invalides.';
  end if;
  if v_sud is null or v_ouest is null or v_nord is null or v_est is null
     or v_sud < -90 or v_nord > 90 or v_sud >= v_nord or v_ouest < -180 or v_est > 180 or v_ouest >= v_est then
    raise exception 'Zone de carte invalide.';
  end if;
  return query
    select f.id, f.type::text, f.titre, f.part_mensuelle_fcfa, f.quartier_id, f.photo_chemin, f.latitude, f.longitude, f.zone_rayon_m,
           case when ur.position is not null
             then (round(extensions.st_distance(extensions.st_setsrid(extensions.st_makepoint(f.longitude, f.latitude), 4326)::extensions.geography, ur.position) / 10) * 10)::integer end,
           false
    from public.filtrer_annonces(p_filtres) f
    join public.annonces a on a.id = f.id
      and a.position_publique operator(extensions.&&) extensions.st_makeenvelope(v_ouest, v_sud, v_est, v_nord, 4326)::extensions.geography
    left join public.universites ur on ur.id = nullif(p_filtres ->> 'universite_ref_id', '')::bigint
    order by f.publiee_le desc nulls last, f.id desc
    limit least(greatest(coalesce(p_limite, 300), 1), 500);
end;
$$;

-- =====================================================================
-- Favoris : visibles et modifiables par leur seul propriétaire (RLS)
-- =====================================================================
create table public.favoris (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profils (id) on delete cascade,
  annonce_id bigint not null references public.annonces (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, annonce_id)
);
create index favoris_annonce_idx on public.favoris (annonce_id);

-- 200 favoris au plus par personne ; 100 ajouts par jour (RGP20)
create function public.limiter_favoris()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.favoris where user_id = new.user_id) >= 200 then
    raise exception 'Tu as atteint le maximum de 200 favoris.';
  end if;
  if (select auth.uid()) is not null then
    perform public.verifier_quota('ajouter_favori');
  end if;
  return new;
end;
$$;
create trigger favoris_1_limite before insert on public.favoris for each row execute function public.limiter_favoris();

alter table public.favoris enable row level security;
revoke all on table public.favoris from anon, authenticated;
grant select, delete on public.favoris to authenticated;
grant insert (annonce_id) on public.favoris to authenticated;

create policy favoris_lecture on public.favoris for select to authenticated using (user_id = (select auth.uid()));
-- On ne met en favori qu'une annonce que la RLS de M4 laisse voir (publiée, ou la sienne)
create policy favoris_creation on public.favoris for insert to authenticated
  with check (
    user_id = (select auth.uid()) and public.peut_ecrire()
    and exists (select 1 from public.annonces a where a.id = annonce_id)
  );
create policy favoris_suppression on public.favoris for delete to authenticated using (user_id = (select auth.uid()));

-- Mes favoris encore publiés, du plus récent au plus ancien (un favori dont l'annonce n'est plus publique est masqué)
create function public.mes_favoris()
returns setof public.annonces_publiques
language sql
stable
set search_path = ''
as $$
  select v.*
  from public.favoris f
  join public.annonces_publiques v on v.id = f.annonce_id
  where f.user_id = (select auth.uid())
  order by f.created_at desc, f.id desc;
$$;

-- RGP11 : export des données
create function public.exporter_donnees_recherche(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('favoris', coalesce((
    select jsonb_agg(jsonb_build_object('annonce_id', f.annonce_id, 'ajoute_le', f.created_at) order by f.created_at)
    from public.favoris f where f.user_id = p_uid
  ), '[]'::jsonb));
$$;

-- =====================================================================
-- Droits : fonction -> rôles autorisés (RGP17)
-- =====================================================================
revoke execute on function
  public.filtrer_annonces(jsonb), public.rechercher_annonces(jsonb, text, jsonb, integer),
  public.annonces_carte(jsonb, jsonb, integer), public.limiter_favoris(), public.mes_favoris(),
  public.exporter_donnees_recherche(uuid)
  from public, anon, authenticated;

-- Lecture publique : la recherche et la carte sont ouvertes aux visiteurs (RG24) et ne rendent que des données publiques
grant execute on function public.filtrer_annonces(jsonb) to anon, authenticated;
grant execute on function public.rechercher_annonces(jsonb, text, jsonb, integer) to anon, authenticated;
grant execute on function public.annonces_carte(jsonb, jsonb, integer) to anon, authenticated;
grant execute on function public.mes_favoris() to authenticated;
-- Interne, sans GRANT : limiter_favoris, exporter_donnees_recherche

insert into public.limites (action, fenetre_secondes, maximum, portee) values
  ('ajouter_favori', 86400, 100, 'utilisateur')
on conflict do nothing;
