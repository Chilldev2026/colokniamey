-- 0991_correctif_recherche.sql
-- Correctif de 0990 trouvé par les tests : un visiteur n'a aucun droit sur la table profils, même pour une simple
-- vérification dans un filtre. La question « suis-je étudiant ? » passe par une fonction dédiée, qui ne renvoie
-- qu'un booléen sur la personne connectée (faux pour un visiteur).

create function public.est_etudiant()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profils where id = (select auth.uid()) and role = 'etudiant' and statut = 'actif');
$$;
revoke execute on function public.est_etudiant() from public, anon, authenticated;
grant execute on function public.est_etudiant() to anon, authenticated;

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
    and (coalesce((p_filtres ->> 'compatible')::boolean, false) = false
         or not v.etudiants_uniquement
         or public.est_etudiant());
$$;

