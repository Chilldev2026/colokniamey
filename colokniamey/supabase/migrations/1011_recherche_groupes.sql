-- 1011_recherche_groupes.sql
-- M8 → M5 : la recherche et la carte connaissent maintenant les groupes en formation (RG24, RG34).
--  - filtre « groupes_en_formation » : seulement les logements où un groupe d'étudiants se forme ;
--  - la carte indique par logement s'il y a un groupe en formation (badge et marqueur distinct).
-- Les droits d'exécution sont conservés par CREATE OR REPLACE ; les types de retour ne changent pas.

create or replace function public.filtrer_annonces(p_filtres jsonb)
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
    and (coalesce((p_filtres ->> 'groupes_en_formation')::boolean, false) = false or public.compter_groupes_en_formation(v.id) > 0)
    and (coalesce((p_filtres ->> 'compatible')::boolean, false) = false
         or not v.etudiants_uniquement
         or public.est_etudiant());
$$;

create or replace function public.annonces_carte(p_emprise jsonb, p_filtres jsonb default '{}'::jsonb, p_limite integer default 300)
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
           public.compter_groupes_en_formation(f.id) > 0
    from public.filtrer_annonces(p_filtres) f
    join public.annonces a on a.id = f.id
      and a.position_publique operator(extensions.&&) extensions.st_makeenvelope(v_ouest, v_sud, v_est, v_nord, 4326)::extensions.geography
    left join public.universites ur on ur.id = nullif(p_filtres ->> 'universite_ref_id', '')::bigint
    order by f.publiee_le desc nulls last, f.id desc
    limit least(greatest(coalesce(p_limite, 300), 1), 500);
end;
$$;
