-- 0351_correctif_verifier_texte.sql
-- Correctif de 0350 : `supabase db lint` signalait un type de retour ambigu dans verifier_texte()
-- (valeurs « unknown » dans le ROW). Le comportement est identique ; seuls les types sont explicités.
-- CREATE OR REPLACE conserve les droits : la fonction reste interne (aucun GRANT, RGP17).

create or replace function public.verifier_texte(p_texte text, p_contexte text default 'public')
returns public.resultat_verification
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_n0 text := public.normaliser_texte(p_texte, 0);
  v_n1 text := public.normaliser_texte(p_texte, 1);
  v_c0 text := replace(v_n0, ' ', '');
  v_c1 text := replace(v_n1, ' ', '');
  v_terme record;
  v_compact text;
  v_cats text[] := array[]::text[];
  v_bloque boolean := false;
  v_revue boolean := false;
  v_issue text;
begin
  if v_n0 = '' then
    return row('accepte'::text, array[]::text[])::public.resultat_verification;
  end if;

  for v_terme in
    select terme, categorie, niveau from public.termes_sensibles
    where actif and valide and (p_contexte <> 'prive' or niveau = 'blocage')
  loop
    v_compact := replace(v_terme.terme, ' ', '');
    if v_n0 ~ ('\m' || v_terme.terme || '(s|x)?\M')
       or v_n1 ~ ('\m' || v_terme.terme || '(s|x)?\M')
       -- les termes longs sont aussi cherchés sans espaces (« sal ope » collé ou coupé)
       or (char_length(v_compact) >= 7 and (position(v_compact in v_c0) > 0 or position(v_compact in v_c1) > 0))
    then
      v_cats := array_append(v_cats, v_terme.categorie);
      if v_terme.niveau = 'blocage' then v_bloque := true; else v_revue := true; end if;
    end if;
  end loop;

  select coalesce(array_agg(distinct c order by c), array[]::text[]) into v_cats from unnest(v_cats) as c;
  v_issue := case when v_bloque then 'bloque' when v_revue then 'revue' else 'accepte' end;
  return row(v_issue, v_cats)::public.resultat_verification;
end;
$$;

revoke execute on function public.verifier_texte(text, text) from public, anon, authenticated;
