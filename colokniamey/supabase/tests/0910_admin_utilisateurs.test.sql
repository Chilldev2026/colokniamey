-- Tests du module A2 (utilisateurs et accès admin). À exécuter après 0300, 0350, 0400, 0910 et supabase/seed.sql.
-- Tout est annulé à la fin (rollback). Chaque échec lève une exception « ÉCHEC ».

begin;

-- Fabrique les claims d'un jeton : utilisateur, niveau aal, session, et vérification TOTP récente ou ancienne
create function pg_temp.jeton(p_uid uuid, p_aal text, p_session uuid default null, p_totp_il_y_a integer default 60)
returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_uid, 'role', 'authenticated', 'aal', p_aal, 'session_id', p_session,
    'amr', jsonb_build_array(jsonb_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint - p_totp_il_y_a))
  )::text, true);
$$;

do $$
declare
  v_univ bigint;
  v_cgu text;
  v_s1 uuid := '00000000-0000-0000-0000-0000000a2a01';
  v_s2 uuid := '00000000-0000-0000-0000-0000000a2a02';
  v_a1 uuid := '00000000-0000-0000-0000-0000000a2b01';
  v_a2 uuid := '00000000-0000-0000-0000-0000000a2b02';
  v_a3 uuid := '00000000-0000-0000-0000-0000000a2b03';
  v_e1 uuid := '00000000-0000-0000-0000-0000000a2c01';
  v_e2 uuid := '00000000-0000-0000-0000-0000000a2c02';
  v_ss1 uuid := '00000000-0000-0000-0000-0000000a2d01';
  v_sa1 uuid := '00000000-0000-0000-0000-0000000a2d02';
  v_sa2 uuid := '00000000-0000-0000-0000-0000000a2d03';
  v_sa3 uuid := '00000000-0000-0000-0000-0000000a2d04';
  v_meta jsonb;
  v_nb integer;
  v_n2 integer;
  v_json jsonb;
  v_texte text;
  v_rel bigint;
  v_rec record;
begin
  select id into v_univ from public.universites order by id limit 1;
  select valeur #>> '{}' into v_cgu from public.parametres where cle = 'version_cgu';
  v_meta := jsonb_build_object('role', 'etudiant', 'nom', 'Nom', 'prenom', 'Prenom', 'telephone', '90000000',
                               'universite_id', v_univ::text, 'cgu_version', v_cgu);

  insert into auth.users (id, email, raw_user_meta_data) values
    (v_s1, 's1@test.local', v_meta || '{"nom":"SuperUn","prenom":"Sophie","telephone":"91000001"}'),
    (v_s2, 's2@test.local', v_meta || '{"nom":"SuperDeux","prenom":"Samir","telephone":"91000002"}'),
    (v_a1, 'a1@test.local', v_meta || '{"nom":"AdminUn","prenom":"Awa","telephone":"92000001"}'),
    (v_a2, 'a2@test.local', v_meta || '{"nom":"AdminDeux","prenom":"Alhassane","telephone":"92000002"}'),
    (v_a3, 'a3@test.local', v_meta || '{"nom":"AdminTrois","prenom":"Aicha","telephone":"92000003"}'),
    (v_e1, 'e1@test.local', v_meta || '{"nom":"EtuUn","prenom":"Eliane","telephone":"93000001"}'),
    (v_e2, 'e2@test.local', v_meta || '{"nom":"EtuDeux","prenom":"Elhadj","telephone":"93000002"}');
  update public.profils set role = 'super_admin' where id in (v_s1, v_s2);
  update public.profils set role = 'admin' where id in (v_a1, v_a2, v_a3);
  -- v_a3 n'a pas de session admin : il sert aux tests d'inactivité
  insert into public.sessions_admin (session_id, user_id) values (v_ss1, v_s1), (v_sa1, v_a1), (v_sa2, v_a2);

  -- ===================================================================
  -- Sessions admin (RGA36)
  -- ===================================================================
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  if not public.est_admin() then raise exception 'ÉCHEC RGA36 : admin avec session active refusé'; end if;
  reset role;
  perform pg_temp.jeton(v_a1, 'aal1', v_sa1); set local role authenticated;
  if public.est_admin() then raise exception 'ÉCHEC RGA04 : admin aal1 accepté'; end if;
  reset role;
  perform pg_temp.jeton(v_a3, 'aal2', v_sa3); set local role authenticated;
  if public.est_admin() then raise exception 'ÉCHEC RGA36 : admin sans session admin accepté'; end if;
  reset role;
  -- 30 minutes sans activité (horloge simulée) : faux même avec un jeton aal2 valide
  update public.sessions_admin set derniere_activite = now() - interval '29 minutes' where session_id = v_sa1;
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  if not public.est_admin() then raise exception 'ÉCHEC RGA36 : session de 29 minutes refusée'; end if;
  reset role;
  update public.sessions_admin set derniere_activite = now() - interval '31 minutes' where session_id = v_sa1;
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  if public.est_admin() then raise exception 'ÉCHEC RGA36 : session de 31 minutes acceptée'; end if;
  -- une session expirée ne se ressuscite pas
  begin perform public.signaler_activite_admin(); raise exception 'ÉCHEC RGA36 : session expirée prolongée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  -- la session d'un autre appareil n'est pas valable pour ce jeton
  update public.sessions_admin set derniere_activite = now() where session_id = v_sa1;
  perform pg_temp.jeton(v_a1, 'aal2', v_sa2); set local role authenticated;
  if public.est_admin() then raise exception 'ÉCHEC RGA36 : session d''un autre utilisateur acceptée'; end if;
  reset role;
  -- le super-admin suit la même règle
  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  if not public.est_super_admin() then raise exception 'ÉCHEC : super-admin avec session refusé'; end if;
  reset role;
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  if public.est_super_admin() then raise exception 'ÉCHEC : un admin est super-admin'; end if;
  reset role;
  update public.sessions_admin set derniere_activite = now() - interval '40 minutes' where session_id = v_ss1;
  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  if public.est_super_admin() then raise exception 'ÉCHEC RGA36 : super-admin inactif accepté'; end if;
  reset role;
  update public.sessions_admin set derniere_activite = now() where session_id = v_ss1;

  -- signaler_activite_admin : création seulement juste après la vérification TOTP
  perform pg_temp.jeton(v_a3, 'aal2', v_sa3, 3600); set local role authenticated;
  begin perform public.signaler_activite_admin(); raise exception 'ÉCHEC RGA36 : session créée avec un TOTP ancien';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  perform pg_temp.jeton(v_a3, 'aal2', v_sa3, 30); set local role authenticated;
  perform public.signaler_activite_admin();
  if not public.est_admin() then raise exception 'ÉCHEC RGA36 : session non créée après TOTP récent'; end if;
  reset role;
  perform pg_temp.jeton(v_a3, 'aal1', v_sa3, 30); set local role authenticated;
  begin perform public.signaler_activite_admin(); raise exception 'ÉCHEC : signaler en aal1';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  perform pg_temp.jeton(v_e1, 'aal2', gen_random_uuid(), 30); set local role authenticated;
  begin perform public.signaler_activite_admin(); raise exception 'ÉCHEC : un étudiant signale une activité admin';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  raise notice 'OK RGA36 : sessions admin et inactivité de 30 minutes';

  -- ===================================================================
  -- Liste et fiche des utilisateurs
  -- ===================================================================
  perform pg_temp.jeton(v_e1, 'aal2', gen_random_uuid()); set local role authenticated;
  begin perform * from public.liste_utilisateurs(); raise exception 'ÉCHEC : un étudiant liste les utilisateurs';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.fiche_utilisateur(v_e2); raise exception 'ÉCHEC : un étudiant ouvre une fiche';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  set local role anon;
  begin perform * from public.liste_utilisateurs(); raise exception 'ÉCHEC : un visiteur liste les utilisateurs';
  exception when insufficient_privilege then null; end;
  reset role;

  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  select count(*), max(total) into v_nb, v_n2 from public.liste_utilisateurs(null, null, null, null, null, 3, 0);
  if v_nb <> 3 or v_n2 < 7 then raise exception 'ÉCHEC : pagination (% lignes, total %)', v_nb, v_n2; end if;
  select count(*) into v_nb from public.liste_utilisateurs('eliane');
  if v_nb <> 1 then raise exception 'ÉCHEC : recherche par prénom'; end if;
  select count(*) into v_nb from public.liste_utilisateurs('e2@test');
  if v_nb <> 1 then raise exception 'ÉCHEC : recherche par e-mail'; end if;
  select count(*) into v_nb from public.liste_utilisateurs('93000001');
  if v_nb <> 1 then raise exception 'ÉCHEC : recherche par téléphone'; end if;
  select count(*) into v_nb from public.liste_utilisateurs('%');
  if v_nb <> 0 then raise exception 'ÉCHEC : le joker %% n''est pas échappé'; end if;
  select count(*) into v_nb from public.liste_utilisateurs(null, 'super_admin');
  if v_nb <> 2 then raise exception 'ÉCHEC : filtre de rôle'; end if;
  select count(*) into v_nb from public.liste_utilisateurs(null, null, 'suspendu');
  if v_nb <> 0 then raise exception 'ÉCHEC : filtre de statut'; end if;
  select count(*) into v_nb from public.liste_utilisateurs(null, null, null, current_date + 1);
  if v_nb <> 0 then raise exception 'ÉCHEC : filtre de date'; end if;
  reset role;
  raise notice 'OK : liste_utilisateurs';

  -- ===================================================================
  -- Actions sur les comptes (RGA02, RGA03, RGA05, RGA08, RGA09, RGA38)
  -- Appelées comme le fait l'Edge Function : avec l'acteur en paramètre.
  -- ===================================================================
  -- Un admin ne suspend pas un autre admin, ni un super-admin, ni lui-même
  begin perform public.admin_action_suspendre(v_a1, v_a2, 'Test de suspension'); raise exception 'ÉCHEC RGA02 : un admin suspend un admin';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.admin_action_suspendre(v_a1, v_s1, 'Test de suspension'); raise exception 'ÉCHEC RGA02 : un admin suspend un super-admin';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.admin_action_suspendre(v_a1, v_a1, 'Test de suspension'); raise exception 'ÉCHEC RGA02 : un admin se suspend';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.admin_action_suspendre(v_s1, v_s2, 'Test de suspension'); raise exception 'ÉCHEC RGA02 : un super-admin suspend un super-admin';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  -- Un étudiant n'agit sur personne
  begin perform public.admin_action_suspendre(v_e1, v_e2, 'Test de suspension'); raise exception 'ÉCHEC : un étudiant suspend';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  -- Motif obligatoire
  begin perform public.admin_action_suspendre(v_a1, v_e1, ''); raise exception 'ÉCHEC RGA08 : suspension sans motif';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.admin_action_suspendre(v_a1, v_e1, 'Motif valable', now() - interval '1 hour'); raise exception 'ÉCHEC : fin de suspension dans le passé';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;

  -- Suspension valide : statut, blocage de connexion, sessions fermées, journal, notification
  insert into auth.sessions (id, user_id) values (gen_random_uuid(), v_e1);
  perform public.admin_action_suspendre(v_a1, v_e1, 'Propos déplacés répétés');
  select * into v_rec from public.profils where id = v_e1;
  if v_rec.statut <> 'suspendu' or v_rec.motif_suspension <> 'Propos déplacés répétés' then raise exception 'ÉCHEC RGA08 : profil non suspendu'; end if;
  if not exists (select 1 from auth.users where id = v_e1 and banned_until > now() + interval '10 years') then
    raise exception 'ÉCHEC RG08 : un compte suspendu peut encore se connecter (pas de blocage Auth)';
  end if;
  if exists (select 1 from auth.sessions where user_id = v_e1) then raise exception 'ÉCHEC : sessions du compte suspendu conservées'; end if;
  if not exists (select 1 from public.journal_audit where action = 'suspension' and cible_id = v_e1::text and acteur_id = v_a1) then
    raise exception 'ÉCHEC RGA06 : suspension non journalisée';
  end if;
  if not exists (select 1 from public.notifications where destinataire_id = v_e1 and type = 'compte_suspendu') then
    raise exception 'ÉCHEC RGA08 : utilisateur non informé';
  end if;
  begin perform public.admin_action_suspendre(v_a1, v_e1, 'Encore'); raise exception 'ÉCHEC : double suspension';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  -- Un compte suspendu n'est plus actif pour la base
  perform pg_temp.jeton(v_e1, 'aal1'); set local role authenticated;
  if public.est_actif() or public.peut_ecrire() then raise exception 'ÉCHEC RG08 : compte suspendu actif'; end if;
  reset role;

  -- Réactivation
  perform public.admin_action_reactiver(v_a1, v_e1);
  if not exists (select 1 from public.profils where id = v_e1 and statut = 'actif' and motif_suspension is null)
     or exists (select 1 from auth.users where id = v_e1 and banned_until is not null) then
    raise exception 'ÉCHEC : réactivation incomplète';
  end if;
  begin perform public.admin_action_reactiver(v_a1, v_e1); raise exception 'ÉCHEC : réactivation d''un compte actif';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;

  -- Fin automatique d'une suspension à durée limitée
  perform public.admin_action_suspendre(v_a1, v_e2, 'Suspension courte', now() + interval '1 hour');
  update public.profils set suspendu_jusqua = now() - interval '1 minute' where id = v_e2;
  if public.lever_suspensions_expirees() <> 1 then raise exception 'ÉCHEC : suspension expirée non levée'; end if;
  if not exists (select 1 from public.profils where id = v_e2 and statut = 'actif') then raise exception 'ÉCHEC : compte non réactivé'; end if;
  raise notice 'OK RGA08 : suspension, réactivation, fin automatique';

  -- Changement de rôle : super-admin seulement (RGA01, RGA05)
  begin perform public.admin_action_changer_role(v_a1, v_e2, 'admin'); raise exception 'ÉCHEC RGA05 : un admin promeut un admin';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.admin_action_changer_role(v_s1, v_e2, 'super_admin'); raise exception 'ÉCHEC RGA05 : promotion en super_admin par l''API';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.admin_action_changer_role(v_s1, v_s2, 'etudiant'); raise exception 'ÉCHEC RGA02 : rétrogradation d''un super-admin par un autre';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.admin_action_changer_role(v_s1, v_s1, 'etudiant'); raise exception 'ÉCHEC : un super-admin se rétrograde';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  perform public.admin_action_changer_role(v_s1, v_e2, 'admin');
  if not exists (select 1 from public.profils where id = v_e2 and role = 'admin') then raise exception 'ÉCHEC : promotion en admin'; end if;
  if not exists (select 1 from public.notifications where destinataire_id = v_e2 and type = 'role_modifie') then raise exception 'ÉCHEC : promu non informé'; end if;
  perform public.admin_action_changer_role(v_s1, v_e2, 'etudiant');
  if not exists (select 1 from public.profils where id = v_e2 and role = 'etudiant') then raise exception 'ÉCHEC : retour au rôle d''origine'; end if;
  if (select count(*) from public.journal_audit where action = 'changement_role' and acteur_id = v_s1) <> 2 then raise exception 'ÉCHEC RGA06 : changements de rôle non journalisés'; end if;
  raise notice 'OK RGA05 : changement de rôle';

  -- Désactivation avec anonymisation
  begin perform public.admin_action_desactiver(v_a1, v_a2, 'Test'); raise exception 'ÉCHEC : un admin désactive un admin';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  perform public.admin_action_desactiver(v_a1, v_e2, 'Demande de l''intéressé');
  select * into v_rec from public.profils where id = v_e2;
  if v_rec.statut <> 'desactive' or v_rec.nom <> 'Utilisateur' or v_rec.telephone <> '00000000' then raise exception 'ÉCHEC RGA09 : compte non anonymisé'; end if;
  if not exists (select 1 from auth.users where id = v_e2 and email like 'supprime-%' and banned_until is not null) then raise exception 'ÉCHEC RGA09 : Auth non anonymisé'; end if;
  if not exists (select 1 from public.journal_audit where action = 'desactivation_anonymisation' and cible_id = v_e2::text) then raise exception 'ÉCHEC RGA06 : désactivation non journalisée'; end if;

  -- Suppression définitive : super-admin seulement
  begin perform public.admin_action_preparer_suppression(v_a1, v_e1, 'Test suppression'); raise exception 'ÉCHEC RGA09 : un admin supprime définitivement';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.admin_action_preparer_suppression(v_s1, v_s2, 'Test suppression'); raise exception 'ÉCHEC RGA02 : suppression d''un super-admin';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.admin_action_preparer_suppression(v_s1, v_e1, ''); raise exception 'ÉCHEC : suppression sans motif';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  perform public.admin_action_preparer_suppression(v_s1, v_e1, 'Compte frauduleux');
  if not exists (select 1 from public.journal_audit where action = 'suppression_definitive' and cible_id = v_e1::text and acteur_id = v_s1) then
    raise exception 'ÉCHEC RGA06 : suppression non journalisée';
  end if;

  -- Réinitialisation de la double authentification (RGA38)
  begin perform public.admin_action_preparer_reinit_mfa(v_a1, v_a2, 'Téléphone perdu'); raise exception 'ÉCHEC RGA38 : un admin réinitialise le MFA';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.admin_action_preparer_reinit_mfa(v_s1, v_s1, 'Téléphone perdu'); raise exception 'ÉCHEC RGA38 : un super-admin réinitialise le sien';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.admin_action_preparer_reinit_mfa(v_s1, v_a2, ''); raise exception 'ÉCHEC RGA38 : réinitialisation sans motif';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.admin_action_preparer_reinit_mfa(v_s1, v_e1, 'Pas un admin'); raise exception 'ÉCHEC : MFA d''un non-admin';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  perform public.admin_action_preparer_reinit_mfa(v_s1, v_a2, 'Téléphone perdu');
  if exists (select 1 from public.sessions_admin where user_id = v_a2) then raise exception 'ÉCHEC RGA38 : sessions admin conservées'; end if;
  -- exception à RGA02 : possible sur un autre super-admin ; tous les super-admins sont notifiés
  perform public.admin_action_preparer_reinit_mfa(v_s1, v_s2, 'Appareil perdu');
  select count(*) into v_nb from public.notifications where type = 'mfa_reinitialise' and destinataire_id in (v_s1, v_s2);
  if v_nb < 4 then raise exception 'ÉCHEC RGA38 : super-admins non notifiés (%)', v_nb; end if;
  if (select count(*) from public.journal_audit where action = 'reinitialisation_mfa' and acteur_id = v_s1) <> 2 then raise exception 'ÉCHEC RGA06 : réinitialisations non journalisées'; end if;
  raise notice 'OK RGA09/RGA38 : désactivation, suppression, réinitialisation du MFA';

  -- Le dernier super-admin ne peut pas être rétrogradé, suspendu ni supprimé (RGA03)
  update public.profils set statut = 'desactive' where id = v_s2; -- il en reste un autre : accepté
  begin update public.profils set role = 'admin' where id = v_s1; raise exception 'ÉCHEC RGA03 : dernier super-admin rétrogradé';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin update public.profils set statut = 'suspendu' where id = v_s1; raise exception 'ÉCHEC RGA03 : dernier super-admin suspendu';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin delete from public.profils where id = v_s1; raise exception 'ÉCHEC RGA03 : dernier super-admin supprimé';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  update public.profils set statut = 'actif' where id = v_s2;
  raise notice 'OK RGA03 : dernier super-admin protégé';

  -- Droits d'exécution : les actions ne sont pas appelables par l'API (RGP17)
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  begin perform public.admin_action_preparer_suppression(v_a1, v_e1, 'Appel direct'); raise exception 'ÉCHEC : appel direct de la suppression définitive';
  exception when insufficient_privilege then null; end;
  begin perform public.admin_action_suspendre(v_a1, v_e1, 'Appel direct'); raise exception 'ÉCHEC : appel direct de la suspension';
  exception when insufficient_privilege then null; end;
  reset role;
  if has_function_privilege('anon', 'public.admin_action_changer_role(uuid,uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'public.admin_action_changer_role(uuid,uuid,text)', 'execute')
     or not has_function_privilege('service_role', 'public.admin_action_changer_role(uuid,uuid,text)', 'execute') then
    raise exception 'ÉCHEC RGP17 : droits des actions admin';
  end if;
  raise notice 'OK RGP17 : actions réservées à l''Edge Function';

  -- ===================================================================
  -- Fiche utilisateur
  -- ===================================================================
  create function public.compteurs_utilisateur_test(p_uid uuid) returns jsonb language sql as $f$ select jsonb_build_object('annonces', 3) $f$;
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  v_json := public.fiche_utilisateur(v_e1);
  reset role;
  if v_json ->> 'email' <> 'e1@test.local' or (v_json -> 'compteurs' ->> 'annonces') <> '3' then raise exception 'ÉCHEC : fiche incomplète : %', v_json; end if;
  if jsonb_array_length(v_json -> 'historique') < 2 then raise exception 'ÉCHEC : historique d''audit absent de la fiche'; end if;
  if v_json::text like '%encrypted_password%' then raise exception 'ÉCHEC : fiche trop bavarde'; end if;
  drop function public.compteurs_utilisateur_test(uuid);

  -- ===================================================================
  -- Relances (RGA31, RGA32, RGA33)
  -- ===================================================================
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  begin perform * from public.relancer_admin(v_a2, 'notification'); raise exception 'ÉCHEC RGA31 : un admin relance';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform * from public.liste_relances(); raise exception 'ÉCHEC : un admin lit le suivi des relances';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;

  update public.sessions_admin set derniere_activite = now() where session_id = v_ss1;
  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  select relance_id, resume into v_rel, v_texte from public.relancer_admin(v_a1, 'whatsapp', 'File à vider');
  if v_rel is null then raise exception 'ÉCHEC : relance non créée'; end if;
  -- une deuxième relance du même admin dans l'heure est refusée
  begin perform * from public.relancer_admin(v_a1, 'email'); raise exception 'ÉCHEC RGA32 : deuxième relance dans l''heure';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform * from public.relancer_admin(v_a2, 'sms'); raise exception 'ÉCHEC : canal inconnu accepté';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform * from public.relancer_admin(v_e1, 'notification'); raise exception 'ÉCHEC : relance d''un non-admin';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  -- « tous » : seuls les admins non relancés dans l'heure (a2 et a3)
  select count(*) into v_nb from public.relancer_admin(null, 'notification');
  if v_nb <> 2 then raise exception 'ÉCHEC : relance de tous (% relancés au lieu de 2)', v_nb; end if;
  begin perform * from public.relancer_admin(null, 'notification'); raise exception 'ÉCHEC RGA32 : relance de tous deux fois';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  select count(*) into v_nb from public.liste_relances();
  if v_nb <> 3 then raise exception 'ÉCHEC : suivi des relances (%)', v_nb; end if;
  select count(*) into v_nb from public.relances;
  if v_nb <> 3 then raise exception 'ÉCHEC : le super-admin ne voit pas toutes les relances'; end if;
  reset role;

  -- RGA33 : aucune donnée personnelle dans les notifications ni dans le résumé
  for v_rec in select titre from public.notifications where type = 'relance' loop
    if v_rec.titre ~* '(sophie|samir|awa|alhassane|aicha|eliane|superun|admin(un|deux|trois)|9[0-9]{7})' then
      raise exception 'ÉCHEC RGA33 : donnée personnelle dans une relance : %', v_rec.titre;
    end if;
  end loop;
  if v_texte ~* '(sophie|awa|9[0-9]{7})' then raise exception 'ÉCHEC RGA33 : donnée personnelle dans le résumé'; end if;

  -- Bandeau : visible jusqu'à « Vu », vu_le rempli ensuite
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  select count(*) into v_nb from public.mes_relances_non_vues();
  if v_nb <> 1 then raise exception 'ÉCHEC RGA32 : bandeau absent (% relances)', v_nb; end if;
  select count(*) into v_nb from public.relances;
  if v_nb <> 1 then raise exception 'ÉCHEC : un admin voit % relances', v_nb; end if;
  reset role;
  perform pg_temp.jeton(v_a2, 'aal2', v_sa2); set local role authenticated;
  begin perform public.marquer_relance_vue(v_rel); raise exception 'ÉCHEC : un admin marque la relance d''un autre';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  perform public.marquer_relance_vue(v_rel);
  select count(*) into v_nb from public.mes_relances_non_vues();
  if v_nb <> 0 then raise exception 'ÉCHEC RGA32 : le bandeau reste après « Vu »'; end if;
  begin perform public.marquer_relance_vue(v_rel); raise exception 'ÉCHEC : relance marquée deux fois';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  if (select vu_le from public.relances where id = v_rel) is null then raise exception 'ÉCHEC RGA32 : vu_le non rempli'; end if;
  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  if (select vu_le from public.liste_relances() where id = v_rel) is null then raise exception 'ÉCHEC RGA32 : « Vu le » invisible du super-admin'; end if;
  reset role;
  raise notice 'OK RGA31/RGA32/RGA33 : relances';

  -- ===================================================================
  -- Files, alertes et préférences (RGA29, RGA30, RGA34, RGA35)
  -- ===================================================================
  create table public.t_file_a2 (id bigint generated always as identity primary key, cree timestamptz not null default now());
  create view public.file_test_aa with (security_invoker = true) as
    select count(*)::bigint as nombre, min(cree) as plus_ancien from public.t_file_a2;
  insert into public.files_admin (nom, libelle, vue, lien) values ('test_aa', 'Annonces de test', 'file_test_aa', '/admin/test');
  delete from public.notifications where type like 'alerte_file%';
  insert into public.t_file_a2 default values;
  insert into public.t_file_a2 default values;

  select public.alertes_files() into v_nb;
  select count(*) into v_n2 from public.profils where role in ('admin', 'super_admin') and statut = 'actif';
  if v_nb <> v_n2 then raise exception 'ÉCHEC RGA29 : % alertes pour % admins actifs', v_nb, v_n2; end if;
  select titre into v_texte from public.notifications where type = 'alerte_file' limit 1;
  if v_texte not like 'Annonces de test : 2 en attente, le plus ancien depuis%' then raise exception 'ÉCHEC : texte d''alerte inattendu : %', v_texte; end if;
  for v_rec in select titre from public.notifications where type like 'alerte_file%' loop
    if v_rec.titre ~* '(sophie|samir|awa|alhassane|aicha|eliane|9[0-9]{7}|\.(png|jpg|webp)|@)' then
      raise exception 'ÉCHEC RGA33 : donnée personnelle ou image dans une alerte : %', v_rec.titre;
    end if;
  end loop;
  -- pas de nouvelle alerte sans nouvel élément, ni dans les 15 minutes
  if public.alertes_files() <> 0 then raise exception 'ÉCHEC RGA29 : alerte répétée sans nouvel élément'; end if;
  insert into public.t_file_a2 default values;
  if public.alertes_files() <> 0 then raise exception 'ÉCHEC RGA29 : plus d''une alerte par 15 minutes'; end if;
  update public.files_admin set derniere_alerte_le = now() - interval '16 minutes' where nom = 'test_aa';
  if public.alertes_files() <> v_n2 then raise exception 'ÉCHEC RGA29 : alerte groupée absente après 15 minutes'; end if;
  -- RGA34 : élément en attente depuis plus de 24 heures
  update public.t_file_a2 set cree = now() - interval '25 hours' where id = (select min(id) from public.t_file_a2);
  if public.alertes_files() <> v_n2 then raise exception 'ÉCHEC RGA34 : alerte des 24 heures absente'; end if;
  if not exists (select 1 from public.notifications where type = 'alerte_file_ancienne') then raise exception 'ÉCHEC RGA34 : type d''alerte ancienne'; end if;
  if public.alertes_files() <> 0 then raise exception 'ÉCHEC RGA34 : alerte des 24 heures répétée'; end if;

  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  select nombre into v_nb from public.etat_files_admin() where nom = 'test_aa';
  if v_nb <> 3 then raise exception 'ÉCHEC : etat_files_admin (%)', v_nb; end if;
  reset role;
  perform pg_temp.jeton(v_e1, 'aal2', gen_random_uuid()); set local role authenticated;
  begin perform * from public.etat_files_admin(); raise exception 'ÉCHEC : un étudiant lit les files';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;

  -- Préférences d'e-mail : super-admin seulement (RGA35)
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  begin perform public.definir_preferences_admin(false, false); raise exception 'ÉCHEC RGA35 : un admin règle les préférences du super-admin';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  perform public.definir_preferences_admin(false, true);
  if (select recap_quotidien from public.mes_preferences_admin()) then raise exception 'ÉCHEC RGA35 : préférence non enregistrée'; end if;
  reset role;
  -- Récapitulatif : destinataires = super-admins qui l'acceptent, jamais les admins (RGA30)
  v_json := public.donnees_recapitulatif();
  v_texte := v_json -> 'destinataires' ::text;
  if (v_json -> 'destinataires')::text like '%s1@test.local%' then raise exception 'ÉCHEC RGA35 : super-admin ayant refusé le récapitulatif'; end if;
  if (v_json -> 'destinataires')::text not like '%s2@test.local%' then raise exception 'ÉCHEC RGA30 : super-admin absent des destinataires'; end if;
  if (v_json -> 'destinataires')::text like '%a1@test.local%' then raise exception 'ÉCHEC RGA30 : un admin reçoit le récapitulatif'; end if;
  if has_function_privilege('authenticated', 'public.donnees_recapitulatif()', 'execute') then raise exception 'ÉCHEC RGP17 : donnees_recapitulatif exposée'; end if;
  raise notice 'OK RGA29/RGA30/RGA34/RGA35 : files, alertes, préférences';

  -- Visiteur : aucun accès
  set local role anon;
  begin perform public.mes_relances_non_vues(); raise exception 'ÉCHEC : visiteur appelle mes_relances_non_vues';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.relances; raise exception 'ÉCHEC : visiteur lit les relances';
  exception when insufficient_privilege then null; end;
  begin perform public.signaler_activite_admin(); raise exception 'ÉCHEC : visiteur signale une activité';
  exception when insufficient_privilege then null; end;
  reset role;
  if has_function_privilege('anon', 'public.alertes_files()', 'execute') or has_function_privilege('authenticated', 'public.taches_planifiees()', 'execute')
     or has_function_privilege('authenticated', 'public.journaliser(uuid,text,text,text,jsonb)', 'execute') then
    raise exception 'ÉCHEC RGP17 : fonction interne exposée';
  end if;
  raise notice 'OK RGP17 : fonctions internes';
end;
$$;

rollback;
