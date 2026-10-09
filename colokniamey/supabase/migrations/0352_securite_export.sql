-- 0352_securite_export.sql
-- Module S : données de S à inclure dans « Mes données » (RGP11). Fonction interne découverte par
-- exporter_mes_donnees() (M3) grâce à son nom exporter_donnees_<module>. Aucun GRANT (RGP17).
-- Rien d'autre que les données de la personne concernée ; jamais le texte détecté ni la liste de termes.

create function public.exporter_donnees_securite(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'usage', p.usage, 'statut', p.statut, 'motif', p.motif, 'envoyee_le', p.created_at, 'decidee_le', p.decide_le
      ) order by p.id) from public.photos p where p.proprietaire_id = p_uid
    ), '[]'::jsonb),
    'contenus_bloques', coalesce((
      select jsonb_agg(jsonb_build_object('categories', v.categories, 'contexte', v.contexte, 'date', v.created_at) order by v.id)
      from public.violations v where v.auteur_id = p_uid
    ), '[]'::jsonb),
    'contenus_en_revue', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', r.type_contenu, 'categories', r.categories, 'statut', r.statut, 'motif', r.motif, 'date', r.created_at
      ) order by r.id) from public.contenus_en_revue r where r.auteur_id = p_uid
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.exporter_donnees_securite(uuid) from public, anon, authenticated;
