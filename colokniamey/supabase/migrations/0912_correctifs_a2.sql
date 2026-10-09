-- 0912_correctifs_a2.sql
-- Module A2 : limite des actions admin (RGP20) et précision de type signalée par `supabase db lint`.

insert into public.limites (action, fenetre_secondes, maximum, portee) values
  ('action_admin', 3600, 120, 'utilisateur') -- garde-fou de l'Edge Function admin-utilisateurs
on conflict do nothing;

-- Même corps que dans 0910 ; le rôle d'origine est converti explicitement vers l'énumération.
create or replace function public.admin_action_changer_role(p_acteur uuid, p_cible uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cible public.profils := public.controler_acteur_admin(p_acteur, p_cible, true);
  v_nouveau public.role_utilisateur;
begin
  if p_role = 'admin' then
    if v_cible.role not in ('etudiant', 'proprietaire') then
      raise exception 'Seul un étudiant ou un propriétaire peut devenir administrateur.';
    end if;
    if v_cible.statut <> 'actif' then
      raise exception 'Seul un compte actif peut devenir administrateur.';
    end if;
    v_nouveau := 'admin';
  elsif p_role in ('etudiant', 'proprietaire') then
    if v_cible.role <> 'admin' then
      raise exception 'Seul un administrateur peut être rétrogradé ici.';
    end if;
    -- le rôle d'origine est celui du profil détaillé que le compte possède
    if exists (select 1 from public.profils_etudiants where user_id = p_cible) then
      v_nouveau := 'etudiant'::public.role_utilisateur;
    elsif exists (select 1 from public.profils_proprietaires where user_id = p_cible) then
      v_nouveau := 'proprietaire'::public.role_utilisateur;
    else
      raise exception 'Le rôle d''origine de ce compte est introuvable.';
    end if;
  else
    raise exception 'Ce rôle ne peut pas être attribué ici.';
  end if;

  update public.profils set role = v_nouveau where id = p_cible;
  -- les sessions admin de la personne rétrogradée prennent fin
  delete from public.sessions_admin where user_id = p_cible;

  perform public.journaliser(p_acteur, 'changement_role', 'utilisateur', p_cible::text,
    jsonb_build_object('ancien', v_cible.role, 'nouveau', v_nouveau));
  perform public.notifier(p_cible, 'role_modifie',
    case v_nouveau when 'admin' then 'Tu as été nommé administrateur.' else 'Tu n''es plus administrateur.' end, null);
end;
$$;

revoke execute on function public.admin_action_changer_role(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_action_changer_role(uuid, uuid, text) to service_role;
