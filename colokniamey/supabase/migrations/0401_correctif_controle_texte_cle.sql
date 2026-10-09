-- 0401_correctif_controle_texte_cle.sql
-- Correctif de 0350 découvert par les tests de M3 : controler_colonnes_texte() lisait l'identifiant du contenu
-- dans une colonne « id ». Une table à clé primaire user_id (un enregistrement par personne, comme
-- profils_complements) n'en a pas : l'identifiant du contenu est alors celui de l'auteur.
-- Le reste de la fonction est inchangé. Les droits sont conservés (aucun GRANT).

create or replace function public.controler_colonnes_texte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := tg_argv[0];
  v_contexte text := tg_argv[1];
  v_col_auteur text := tg_argv[2];
  v_nouveau jsonb := to_jsonb(new);
  v_ancien jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_texte text;
  v_res public.resultat_verification;
  v_cats text[] := '{}';
  v_revue boolean := false;
  i integer;
begin
  for i in 3 .. tg_nargs - 1 loop
    v_texte := v_nouveau ->> tg_argv[i];
    -- un texte vide ou inchangé n'est pas revérifié
    continue when v_texte is null or v_texte = '' or v_texte is not distinct from (v_ancien ->> tg_argv[i]);

    v_res := public.verifier_texte(v_texte, v_contexte);
    if v_res.issue = 'bloque' then
      -- RG45 : message en français qui n'affiche jamais le terme détecté
      raise exception 'Ce texte ne respecte pas les règles de ColokNiamey. Modifie-le et réessaie.';
    elsif v_res.issue = 'revue' and v_contexte <> 'prive' then
      v_revue := true;
      v_cats := v_cats || v_res.categories;
    end if;
  end loop;

  if v_revue then
    if not (v_nouveau ? 'en_revue') then
      raise exception 'La table % doit avoir une colonne en_revue pour utiliser ce contrôle.', tg_table_name;
    end if;
    -- le contenu est enregistré mais masqué
    new := jsonb_populate_record(new, jsonb_build_object('en_revue', true));
    insert into public.contenus_en_revue (type_contenu, contenu_id, auteur_id, raison, categories)
    select v_type,
           coalesce(v_nouveau ->> 'id', v_nouveau ->> v_col_auteur),
           coalesce((v_nouveau ->> v_col_auteur)::uuid, auth.uid()),
           'Terme sensible détecté',
           (select coalesce(array_agg(distinct c order by c), array[]::text[]) from unnest(v_cats) as c)
    on conflict (type_contenu, contenu_id) where statut = 'en_attente' do nothing;
  end if;

  return new;
end;
$$;

revoke execute on function public.controler_colonnes_texte() from public, anon, authenticated;
