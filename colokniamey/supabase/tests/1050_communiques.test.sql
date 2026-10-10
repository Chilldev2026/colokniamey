-- Tests du module A4 (communiqués). À exécuter après 0910, 1050. Tout est annulé à la fin (rollback).
-- Les communiqués réels éventuels ne gênent pas : chaque contrôle porte sur des titres de test précis.

begin;

create function pg_temp.jeton(p_uid uuid, p_aal text default 'aal1', p_session uuid default null)
returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_uid, 'role', 'authenticated', 'aal', p_aal, 'session_id', p_session,
    'amr', jsonb_build_array(jsonb_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint - 60))
  )::text, true);
$$;

do $$
declare
  v_univ bigint;
  v_cgu text;
  v_meta jsonb;
  v_e1 uuid := '00000000-0000-0000-0000-0000000c4001'; -- étudiant
  v_e2 uuid := '00000000-0000-0000-0000-0000000c4002'; -- autre étudiant
  v_p1 uuid := '00000000-0000-0000-0000-0000000c4003'; -- propriétaire
  v_a1 uuid := '00000000-0000-0000-0000-0000000c4004'; -- admin
  v_s1 uuid := '00000000-0000-0000-0000-0000000c4005'; -- super-admin
  v_sa1 uuid := '00000000-0000-0000-0000-0000000c40a1';
  v_ss1 uuid := '00000000-0000-0000-0000-0000000c40a2';
  v_info bigint;
  v_crit bigint;
  v_prop bigint;
  v_expire bigint;
  v_futur bigint;
  v_nb integer;
begin
  select id into v_univ from public.universites order by id limit 1;
  select valeur #>> '{}' into v_cgu from public.parametres where cle = 'version_cgu';
  v_meta := jsonb_build_object('role', 'etudiant', 'nom', 'Nom', 'prenom', 'Prenom', 'telephone', '90112233', 'universite_id', v_univ::text, 'cgu_version', v_cgu);
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_e1, 'a41@test.local', v_meta), (v_e2, 'a42@test.local', v_meta), (v_p1, 'a43@test.local', jsonb_set(v_meta, '{role}', '"proprietaire"')),
    (v_a1, 'a44@test.local', v_meta), (v_s1, 'a45@test.local', v_meta);
  update public.profils set role = 'admin' where id = v_a1;
  update public.profils set role = 'super_admin' where id = v_s1;
  insert into public.sessions_admin (session_id, user_id) values (v_sa1, v_a1), (v_ss1, v_s1);

  -- ===================================================================
  -- Droits d'écriture (RGA13, RGA28)
  -- ===================================================================
  perform pg_temp.jeton(v_e1); set local role authenticated;
  begin insert into public.communiques (titre, message, fin) values ('Test A4 étudiant', 'Message de test', now() + interval '1 day'); raise exception 'ÉCHEC : un étudiant crée un communiqué';
  exception when insufficient_privilege or raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  set local role anon;
  begin perform count(*) from public.communiques; raise exception 'ÉCHEC : un visiteur lit la table des communiqués';
  exception when insufficient_privilege then null; end;
  reset role;

  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  insert into public.communiques (titre, message, niveau, cible, fin) values ('Test A4 information', 'Une information pour tous.', 'information', 'tous', now() + interval '1 day') returning id into v_info;
  insert into public.communiques (titre, message, niveau, cible, fin) values ('Test A4 propriétaires', 'Pour les propriétaires seulement.', 'avertissement', 'proprietaires', now() + interval '1 day') returning id into v_prop;
  begin insert into public.communiques (titre, message, niveau, fin) values ('Test A4 critique admin', 'Tentative d''un admin.', 'critique', now() + interval '1 day'); raise exception 'ÉCHEC RGA28 : un admin crée un communiqué critique';
  exception when insufficient_privilege or raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin insert into public.communiques (titre, message, fin, debut) values ('Test A4 période', 'Fin avant le début.', now(), now() + interval '1 day'); raise exception 'ÉCHEC RGA13 : fin avant le début';
  exception when check_violation then null; end;
  begin insert into public.communiques (titre, message, fin) values ('Test A4 texte', 'je vais te tuer', now() + interval '1 day'); raise exception 'ÉCHEC RG45 : texte interdit accepté';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  update public.communiques set message = 'Information modifiée par un admin.' where id = v_info;
  get diagnostics v_nb = row_count;
  if v_nb <> 1 then raise exception 'ÉCHEC : un admin ne modifie pas un communiqué d''information'; end if;
  begin update public.communiques set niveau = 'critique' where id = v_info; raise exception 'ÉCHEC RGA28 : un admin passe un communiqué en critique';
  exception when insufficient_privilege or raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;

  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  insert into public.communiques (titre, message, niveau, cible, fin) values ('Test A4 critique', 'Maintenance importante ce soir.', 'critique', 'tous', now() + interval '1 day') returning id into v_crit;
  reset role;
  -- un admin ne modifie ni ne supprime un communiqué critique
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  update public.communiques set message = 'Piraté' where id = v_crit;
  get diagnostics v_nb = row_count;
  if v_nb <> 0 then raise exception 'ÉCHEC RGA28 : un admin modifie un communiqué critique'; end if;
  delete from public.communiques where id = v_crit;
  get diagnostics v_nb = row_count;
  if v_nb <> 0 then raise exception 'ÉCHEC RGA28 : un admin supprime un communiqué critique'; end if;
  reset role;
  if not exists (select 1 from public.journal_audit where action = 'communique_insert' and cible_id = v_crit::text and details ->> 'niveau' = 'critique') then raise exception 'ÉCHEC RGA06 : création non journalisée'; end if;
  if not exists (select 1 from public.journal_audit where action = 'communique_update' and cible_id = v_info::text) then raise exception 'ÉCHEC RGA06 : modification non journalisée'; end if;
  if exists (select 1 from public.journal_audit where action like 'communique_%' and details::text like '%acompte%') then raise exception 'ÉCHEC : texte du communiqué dans le journal'; end if;
  raise notice 'OK RGA13, RGA28, RGA06 : droits d''écriture';

  -- période : un communiqué expiré et un communiqué futur ne s'affichent pas (insertion directe : période passée)
  insert into public.communiques (titre, message, debut, fin, cree_par) values ('Test A4 expiré', 'Déjà terminé.', now() - interval '2 days', now() - interval '1 day', v_a1) returning id into v_expire;
  insert into public.communiques (titre, message, debut, fin, cree_par) values ('Test A4 futur', 'Pas encore commencé.', now() + interval '1 day', now() + interval '2 days', v_a1) returning id into v_futur;

  -- ===================================================================
  -- Affichage selon le rôle (RGA13)
  -- ===================================================================
  set local role anon;
  if not exists (select 1 from public.communiques_actifs() where id = v_info) then raise exception 'ÉCHEC : un visiteur ne voit pas un communiqué pour tous'; end if;
  if exists (select 1 from public.communiques_actifs() where id = v_prop) then raise exception 'ÉCHEC : un visiteur voit un communiqué pour les propriétaires'; end if;
  if not exists (select 1 from public.communiques_actifs() where id = v_crit and not masquable) then raise exception 'ÉCHEC : communiqué critique pour tous, non masquable'; end if;
  reset role;
  perform pg_temp.jeton(v_e1); set local role authenticated;
  if exists (select 1 from public.communiques_actifs() where id = v_prop) then raise exception 'ÉCHEC : un communiqué aux propriétaires est visible d''un étudiant'; end if;
  if exists (select 1 from public.communiques_actifs() where id in (v_expire, v_futur)) then raise exception 'ÉCHEC : communiqué expiré ou futur affiché'; end if;
  reset role;
  perform pg_temp.jeton(v_p1); set local role authenticated;
  if not exists (select 1 from public.communiques_actifs() where id = v_prop) then raise exception 'ÉCHEC : un propriétaire ne voit pas son communiqué'; end if;
  reset role;
  -- un communiqué à une cible « étudiants » : invisible d'un propriétaire
  insert into public.communiques (titre, message, cible, fin, cree_par) values ('Test A4 étudiants', 'Pour les étudiants.', 'etudiants', now() + interval '1 day', v_a1);
  perform pg_temp.jeton(v_p1); set local role authenticated;
  if exists (select 1 from public.communiques_actifs() where titre = 'Test A4 étudiants') then raise exception 'ÉCHEC : un communiqué aux étudiants est visible d''un propriétaire'; end if;
  reset role;
  perform pg_temp.jeton(v_e2); set local role authenticated;
  if not exists (select 1 from public.communiques_actifs() where titre = 'Test A4 étudiants') then raise exception 'ÉCHEC : un étudiant ne voit pas son communiqué'; end if;
  reset role;
  -- l'expiration fait disparaître le communiqué
  update public.communiques set fin = now(), debut = now() - interval '1 hour' where id = v_info;
  perform pg_temp.jeton(v_e2); set local role authenticated;
  if exists (select 1 from public.communiques_actifs() where id = v_info) then raise exception 'ÉCHEC : communiqué terminé toujours affiché'; end if;
  reset role;
  update public.communiques set fin = now() + interval '1 day' where id = v_info;
  raise notice 'OK RGA13 : cible et période';

  -- ===================================================================
  -- Masquage (RGA14)
  -- ===================================================================
  set local role anon;
  begin perform public.masquer_communique(v_info); raise exception 'ÉCHEC : un visiteur masque un communiqué';
  exception when insufficient_privilege then null; end;
  reset role;
  perform pg_temp.jeton(v_e1); set local role authenticated;
  begin perform public.masquer_communique(v_crit); raise exception 'ÉCHEC RGA14 : un communiqué critique a été masqué';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  perform public.masquer_communique(v_info);
  perform public.masquer_communique(v_info); -- deux fois : sans erreur
  if exists (select 1 from public.communiques_actifs() where id = v_info) then raise exception 'ÉCHEC : communiqué masqué toujours affiché'; end if;
  if not exists (select 1 from public.communiques_actifs() where id = v_crit) then raise exception 'ÉCHEC RGA14 : communiqué critique disparu'; end if;
  begin perform public.masquer_communique(999999999); raise exception 'ÉCHEC : masquage d''un communiqué inexistant';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  perform pg_temp.jeton(v_e2); set local role authenticated;
  if not exists (select 1 from public.communiques_actifs() where id = v_info) then raise exception 'ÉCHEC : le masquage d''un utilisateur touche les autres'; end if;
  begin perform count(*) from public.communiques_masques; raise exception 'ÉCHEC : lecture directe de communiques_masques';
  exception when insufficient_privilege then null; end;
  reset role;
  raise notice 'OK RGA14 : masquage';

  if has_function_privilege('anon', 'public.masquer_communique(bigint)', 'execute')
     or not has_function_privilege('anon', 'public.communiques_actifs()', 'execute')
     or has_function_privilege('authenticated', 'public.journaliser_communique()', 'execute') then
    raise exception 'ÉCHEC RGP17 : droits d''exécution';
  end if;
  raise notice 'OK RGP17';
end;
$$;

rollback;
