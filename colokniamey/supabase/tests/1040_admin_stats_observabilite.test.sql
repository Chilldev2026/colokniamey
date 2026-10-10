-- Tests des modules A1 (statistiques) et A6 (audit, erreurs, supervision). À exécuter après 0910, 0960, 0970, 0980, 1020, 1030, 1040.
-- Tout est annulé à la fin (rollback). Chaque échec lève une exception « ÉCHEC ».
-- Les comptes réels de la base ne gênent pas : les contrôles de totaux comparent l'état avant et après un jeu de test connu.

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
  v_ville bigint;
  v_quartier bigint;
  v_cgu text;
  v_meta jsonb;
  v_centre extensions.geography;
  v_e1 uuid := '00000000-0000-0000-0000-0000000c1001';
  v_e2 uuid := '00000000-0000-0000-0000-0000000c1002';
  v_p1 uuid := '00000000-0000-0000-0000-0000000c1003';
  v_a1 uuid := '00000000-0000-0000-0000-0000000c1004';
  v_a2 uuid := '00000000-0000-0000-0000-0000000c1005';
  v_s1 uuid := '00000000-0000-0000-0000-0000000c1006';
  v_sa1 uuid := '00000000-0000-0000-0000-0000000c10a1';
  v_sa2 uuid := '00000000-0000-0000-0000-0000000c10a2';
  v_ss1 uuid := '00000000-0000-0000-0000-0000000c10a3';
  v_avant jsonb;
  v_apres jsonb;
  v_nb integer;
  v_id bigint;
  v_rec record;
  v_json jsonb;
  v_ligne jsonb;
begin
  select id into v_univ from public.universites order by id limit 1;
  select id, centre into v_ville, v_centre from public.villes where nom = 'Niamey';
  select valeur #>> '{}' into v_cgu from public.parametres where cle = 'version_cgu';
  insert into public.quartiers (nom, ville_id) values ('Quartier de test A1', v_ville) returning id into v_quartier;
  v_meta := jsonb_build_object('role', 'etudiant', 'nom', 'Nom', 'prenom', 'Prenom', 'telephone', '90112233',
                               'universite_id', v_univ::text, 'cgu_version', v_cgu);

  -- Instantané avant le jeu de test
  insert into auth.users (id, email, raw_user_meta_data) values (v_s1, 'a1s@test.local', v_meta), (v_a1, 'a1a@test.local', v_meta), (v_a2, 'a1b@test.local', v_meta);
  update public.profils set role = 'super_admin' where id = v_s1;
  update public.profils set role = 'admin' where id in (v_a1, v_a2);
  insert into public.sessions_admin (session_id, user_id) values (v_sa1, v_a1), (v_sa2, v_a2), (v_ss1, v_s1);
  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  v_avant := jsonb_build_object('u', public.stats_utilisateurs(30), 'a', public.stats_annonces(30), 'v', public.stats_visites(30), 'm', public.stats_moderation(30));
  reset role;

  -- Jeu de test connu : 2 étudiants, 1 propriétaire, 2 annonces (1 publiée, 1 en attente), 3 visites du jour (2 sessions), 5 visites d'il y a 3 jours (3 sessions)
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_e1, 'a1e1@test.local', v_meta), (v_e2, 'a1e2@test.local', v_meta), (v_p1, 'a1p@test.local', jsonb_set(v_meta, '{role}', '"proprietaire"'));
  insert into public.annonces (auteur_id, titre, description, type, part_mensuelle_fcfa, quartier_id, position, statut, publiee_le)
  values (v_p1, 'Studio publié A1', 'Un studio publié pour le jeu de test des statistiques.', 'studio', 50000, v_quartier, v_centre, 'publiee', now());
  insert into public.annonces (auteur_id, titre, description, type, part_mensuelle_fcfa, quartier_id, position, statut)
  values (v_p1, 'Chambre en attente A1', 'Une chambre en attente pour le jeu de test des statistiques.', 'chambre', 30000, v_quartier, v_centre, 'en_attente');
  insert into public.visites (chemin, appareil, session_id) values
    ('/a1-test', 'mobile', 'session-test-a1-1'), ('/a1-test', 'mobile', 'session-test-a1-1'), ('/a1-autre', 'ordinateur', 'session-test-a1-2');
  insert into public.visites (chemin, appareil, session_id, created_at)
  select '/a1-ancien', 'tablette', 'session-ancienne-' || (n % 3), now() - interval '3 days' from generate_series(1, 5) n;
  insert into public.visites (chemin, appareil, session_id, created_at) values ('/a1-tres-ancien', 'mobile', 'session-tres-ancienne', now() - interval '40 days');
  perform public.agreger_visites();

  -- ===================================================================
  -- A1 : droits (RGA27)
  -- ===================================================================
  perform pg_temp.jeton(v_e1, 'aal1'); set local role authenticated;
  begin perform public.stats_utilisateurs(); raise exception 'ÉCHEC : un étudiant lit stats_utilisateurs';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.stats_annonces(); raise exception 'ÉCHEC : un étudiant lit stats_annonces';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.stats_visites(); raise exception 'ÉCHEC : un étudiant lit stats_visites';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.stats_moderation(); raise exception 'ÉCHEC : un étudiant lit stats_moderation';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.stats_erreurs(); raise exception 'ÉCHEC : un étudiant lit stats_erreurs';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  set local role anon;
  begin perform public.stats_visites(); raise exception 'ÉCHEC : un visiteur lit stats_visites';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from public.visites_par_jour; raise exception 'ÉCHEC : un visiteur lit visites_par_jour';
  exception when insufficient_privilege then null; end;
  reset role;

  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  begin perform public.stats_visites(); raise exception 'ÉCHEC RGA27 : un admin lit stats_visites';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.stats_erreurs(); raise exception 'ÉCHEC RGA27 : un admin lit stats_erreurs';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.stats_utilisateurs(); raise exception 'ÉCHEC RGA27 : un admin lit stats_utilisateurs';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.stats_annonces(); raise exception 'ÉCHEC RGA27 : un admin lit stats_annonces';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  v_json := public.stats_moderation(7);
  if v_json -> 'annonces_en_attente' is null then raise exception 'ÉCHEC : l''admin ne lit pas stats_moderation'; end if;
  reset role;
  perform pg_temp.jeton(v_a1, 'aal1', v_sa1); set local role authenticated;
  begin perform public.stats_moderation(); raise exception 'ÉCHEC RGA04 : stats_moderation sans aal2';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  raise notice 'OK RGA27 : droits des statistiques';

  -- ===================================================================
  -- A1 : totaux d'un jeu de données connu
  -- ===================================================================
  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  v_apres := jsonb_build_object('u', public.stats_utilisateurs(30), 'a', public.stats_annonces(30), 'v', public.stats_visites(30), 'm', public.stats_moderation(30));
  reset role;
  if (v_apres -> 'u' ->> 'total')::integer - (v_avant -> 'u' ->> 'total')::integer <> 3 then raise exception 'ÉCHEC : total des utilisateurs'; end if;
  if coalesce((v_apres -> 'u' -> 'par_role' ->> 'etudiant')::integer, 0) - coalesce((v_avant -> 'u' -> 'par_role' ->> 'etudiant')::integer, 0) <> 2 then raise exception 'ÉCHEC : étudiants par rôle'; end if;
  if coalesce((v_apres -> 'u' -> 'par_role' ->> 'proprietaire')::integer, 0) - coalesce((v_avant -> 'u' -> 'par_role' ->> 'proprietaire')::integer, 0) <> 1 then raise exception 'ÉCHEC : propriétaires par rôle'; end if;
  if (select sum((x ->> 'etudiant')::integer) from jsonb_array_elements(v_apres -> 'u' -> 'inscriptions') x) - (select sum((x ->> 'etudiant')::integer) from jsonb_array_elements(v_avant -> 'u' -> 'inscriptions') x) <> 2 then
    raise exception 'ÉCHEC : inscriptions par jour';
  end if;
  if jsonb_array_length(v_apres -> 'u' -> 'inscriptions') <> 30 then raise exception 'ÉCHEC : une ligne par jour de la période'; end if;
  if (v_apres -> 'a' ->> 'total')::integer - (v_avant -> 'a' ->> 'total')::integer <> 2 then raise exception 'ÉCHEC : total des annonces'; end if;
  if coalesce((v_apres -> 'a' -> 'par_statut' ->> 'publiee')::integer, 0) - coalesce((v_avant -> 'a' -> 'par_statut' ->> 'publiee')::integer, 0) <> 1 then raise exception 'ÉCHEC : annonces publiées'; end if;
  if coalesce((v_apres -> 'a' -> 'par_statut' ->> 'en_attente')::integer, 0) - coalesce((v_avant -> 'a' -> 'par_statut' ->> 'en_attente')::integer, 0) <> 1 then raise exception 'ÉCHEC : annonces en attente'; end if;
  if not exists (select 1 from jsonb_array_elements(v_apres -> 'a' -> 'par_quartier') x where x ->> 'quartier' = 'Quartier de test A1' and (x ->> 'annonces')::integer = 1) then raise exception 'ÉCHEC : annonces par quartier'; end if;
  -- visites : 3 du jour (2 sessions), 5 d'il y a 3 jours (3 sessions), détail ancien agrégé puis purgé
  if (v_apres -> 'v' -> 'aujourdhui' ->> 'visites')::integer - (v_avant -> 'v' -> 'aujourdhui' ->> 'visites')::integer <> 3 then raise exception 'ÉCHEC : visites du jour'; end if;
  if (v_apres -> 'v' -> 'aujourdhui' ->> 'sessions')::integer - (v_avant -> 'v' -> 'aujourdhui' ->> 'sessions')::integer <> 2 then raise exception 'ÉCHEC : sessions du jour'; end if;
  select x into v_ligne from jsonb_array_elements(v_apres -> 'v' -> 'par_jour') x where (x ->> 'jour')::date = current_date - 3;
  if (v_ligne ->> 'visites')::integer - coalesce((select (y ->> 'visites')::integer from jsonb_array_elements(v_avant -> 'v' -> 'par_jour') y where (y ->> 'jour')::date = current_date - 3), 0) <> 5 then raise exception 'ÉCHEC : visites d''il y a 3 jours'; end if;
  if exists (select 1 from public.visites where chemin = '/a1-tres-ancien') then raise exception 'ÉCHEC RGA20 : visite de plus de 30 jours non purgée'; end if;
  if not exists (select 1 from public.visites_par_jour where jour = (now() - interval '40 days')::date and visites >= 1) then raise exception 'ÉCHEC RGA20 : visite de plus de 30 jours non agrégée'; end if;
  if jsonb_array_length(v_apres -> 'v' -> 'par_jour') <> 30 then raise exception 'ÉCHEC : jours des visites'; end if;
  if not exists (select 1 from jsonb_array_elements(v_apres -> 'v' -> 'pages') x where x ->> 'chemin' = '/a1-ancien' and (x ->> 'visites')::integer >= 5) then raise exception 'ÉCHEC : pages les plus vues'; end if;
  if coalesce((v_apres -> 'v' -> 'appareils' ->> 'tablette')::integer, 0) - coalesce((v_avant -> 'v' -> 'appareils' ->> 'tablette')::integer, 0) <> 5 then raise exception 'ÉCHEC : appareils'; end if;
  -- RGA18 : aucune donnée personnelle dans les agrégats
  if v_apres::text like '%session-test%' or v_apres::text like '%@%' then raise exception 'ÉCHEC RGA18 : donnée personnelle dans les statistiques'; end if;
  if (v_apres -> 'm' ->> 'annonces_en_attente')::integer - (v_avant -> 'm' ->> 'annonces_en_attente')::integer <> 1 then raise exception 'ÉCHEC : annonces en attente à traiter'; end if;
  raise notice 'OK A1 : totaux, agrégation et purge des visites';

  -- ===================================================================
  -- A6 : journal d'audit (RGA06, RGA07, RGA26)
  -- ===================================================================
  perform public.journaliser('action_test_a6', 'test', '1', jsonb_build_object('ancien', 1, 'nouveau', 2));
  -- lignes écrites par chaque admin
  insert into public.journal_audit (acteur_id, action, cible_type, cible_id, details) values
    (v_a1, 'action_a1', 'test', '1', jsonb_build_object('avant', 'a', 'apres', 'b')), (v_a2, 'action_a2', 'test', '2', '{}'::jsonb),
    (v_s1, 'action_s1', 'parametre', 'x', jsonb_build_object('ancien', 1, 'nouveau', 2));
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  select count(*) into v_nb from public.journal_audit;
  if v_nb <> (select count(*) from public.liste_journal(null, null, null, null, null, 500, 0)) then raise exception 'ÉCHEC : politique et fonction divergent pour l''admin'; end if;
  if exists (select 1 from public.journal_audit where acteur_id is distinct from v_a1) then raise exception 'ÉCHEC RGA26 : un admin lit les lignes d''un autre'; end if;
  if exists (select 1 from public.liste_journal(v_a2, null, null, null, null, 500, 0) where acteur_id <> v_a1) then raise exception 'ÉCHEC RGA26 : filtre d''acteur contourné par un admin'; end if;
  if not exists (select 1 from public.liste_journal() where action = 'action_a1' and details ->> 'avant' = 'a') then raise exception 'ÉCHEC : Mon historique'; end if;
  begin perform public.filtres_journal(); raise exception 'ÉCHEC : un admin lit les filtres du journal complet';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin update public.journal_audit set action = 'x'; raise exception 'ÉCHEC RGA07 : journal modifiable';
  exception when insufficient_privilege then null; end;
  begin delete from public.journal_audit; raise exception 'ÉCHEC RGA07 : journal supprimable';
  exception when insufficient_privilege then null; end;
  reset role;
  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  if (select count(*) from public.liste_journal(null, 'action_a2', null, null, null, 50, 0)) <> 1 then raise exception 'ÉCHEC : le super-admin ne voit pas les actions d''un admin'; end if;
  if (select count(*) from public.liste_journal(v_a1, null, null, null, null, 500, 0) where acteur_id <> v_a1) <> 0 then raise exception 'ÉCHEC : filtre par acteur'; end if;
  if (select count(*) from public.liste_journal(null, null, 'parametre', current_date, current_date, 50, 0) where cible_type <> 'parametre') <> 0 then raise exception 'ÉCHEC : filtres de cible et de période'; end if;
  if not (public.filtres_journal() -> 'actions') ? 'action_s1' then raise exception 'ÉCHEC : liste des actions'; end if;
  reset role;
  perform pg_temp.jeton(v_e1, 'aal1'); set local role authenticated;
  begin perform public.liste_journal(); raise exception 'ÉCHEC : un étudiant lit le journal';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  select count(*) into v_nb from public.journal_audit;
  if v_nb <> 0 then raise exception 'ÉCHEC : un étudiant lit journal_audit (%)', v_nb; end if;
  reset role;
  raise notice 'OK A6 : journal d''audit';

  -- ===================================================================
  -- A6 : erreurs (RGA19, RGA20)
  -- ===================================================================
  set local role anon;
  perform public.enregistrer_erreur_detail('Erreur de test A6', 'test', '/page-a6?x=1', 'session-erreur-test', 'at fonction (fichier.js:1)', 'Chrome', '0.0.1');
  perform public.enregistrer_erreur_detail('Erreur de test A6', 'test', '/page-a6', 'session-erreur-test', null, null, null);
  reset role;
  select * into v_rec from public.erreurs where message = 'Erreur de test A6';
  if v_rec.occurrences <> 2 or v_rec.page <> '/page-a6' or v_rec.pile is null or v_rec.navigateur <> 'Chrome' or v_rec.statut <> 'nouveau' then raise exception 'ÉCHEC RGA19 : enregistrement groupé (%)', v_rec; end if;
  v_id := v_rec.id;
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  begin perform public.changer_statut_erreur(v_id, 'resolu'); raise exception 'ÉCHEC RGA27 : un admin change le statut d''une erreur';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.liste_erreurs(); raise exception 'ÉCHEC RGA27 : un admin lit les erreurs';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform count(*) from public.erreurs; raise exception 'ÉCHEC : un admin lit la table erreurs';
  exception when insufficient_privilege then null; end;
  reset role;
  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  if (select count(*) from public.liste_erreurs('nouveau', 7) where id = v_id) <> 1 then raise exception 'ÉCHEC : liste des erreurs'; end if;
  perform public.changer_statut_erreur(v_id, 'en_cours');
  begin perform public.changer_statut_erreur(v_id, 'au_hasard'); raise exception 'ÉCHEC : statut libre';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  perform public.changer_statut_erreur(v_id, 'resolu');
  reset role;
  set local role anon;
  perform public.enregistrer_erreur_detail('Erreur de test A6', 'test', '/page-a6', 'session-erreur-test');
  reset role;
  if (select statut from public.erreurs where id = v_id) <> 'nouveau' then raise exception 'ÉCHEC RGA19 : une erreur résolue qui réapparaît doit repasser à nouveau'; end if;
  update public.erreurs set derniere_vue = now() - interval '100 days', premiere_vue = now() - interval '100 days' where id = v_id;
  perform public.purger_erreurs();
  if exists (select 1 from public.erreurs where id = v_id) then raise exception 'ÉCHEC RGA20 : erreur de plus de 90 jours non purgée'; end if;
  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  if (public.stats_erreurs() -> 'ouvertes') is null then raise exception 'ÉCHEC : stats_erreurs'; end if;
  reset role;
  raise notice 'OK A6 : erreurs';

  -- ===================================================================
  -- A6 : supervision (RGA21 à RGA25)
  -- ===================================================================
  insert into public.mesures (module, operation, duree_ms, succes, session_id)
  select 'zz_test', 'op', n, n > 10, 'session-mesure-test' from generate_series(1, 100) n;
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  begin perform public.supervision('24h'); raise exception 'ÉCHEC RGA27 : un admin lit la supervision';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.definir_seuil('erreurs_pct', 10); raise exception 'ÉCHEC : un admin règle un seuil';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.alertes_supervision_actives(); raise exception 'ÉCHEC : un admin lit les alertes';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  v_json := public.supervision('1h');
  if not exists (select 1 from jsonb_array_elements(v_json -> 'latence' -> 'par_module') x where x ->> 'module' = 'zz_test' and (x ->> 'p50')::integer = 51 and (x ->> 'p95')::integer = 95 and (x ->> 'p99')::integer = 99) then
    raise exception 'ÉCHEC RGA23 : percentiles (%)', v_json -> 'latence' -> 'par_module';
  end if;
  if not exists (select 1 from jsonb_array_elements(v_json -> 'erreurs' -> 'par_module') x where x ->> 'module' = 'zz_test' and (x ->> 'requetes')::integer = 100 and (x ->> 'erreurs')::integer = 10) then
    raise exception 'ÉCHEC RGA22 : erreurs par module (%)', v_json -> 'erreurs' -> 'par_module';
  end if;
  if not exists (select 1 from jsonb_array_elements(v_json -> 'requetes' -> 'par_module') x where x ->> 'module' = 'zz_test' and (x ->> 'requetes')::integer = 100) then raise exception 'ÉCHEC RGA21 : requêtes par module'; end if;
  if jsonb_array_length(v_json -> 'requetes' -> 'par_pas') < 60 then raise exception 'ÉCHEC RGA21 : une ligne par minute sur 1 h'; end if;
  if jsonb_array_length((public.supervision('24h')) -> 'requetes' -> 'par_pas') < 24 or jsonb_array_length((public.supervision('7j')) -> 'requetes' -> 'par_pas') < 7 then raise exception 'ÉCHEC : pas des périodes'; end if;
  if (v_json -> 'saturation' ->> 'base_mo')::numeric <= 0 or (v_json -> 'saturation' ->> 'limite_base_mo')::numeric <= 0 or (v_json -> 'saturation' ->> 'connexions')::integer < 1 then raise exception 'ÉCHEC RGA24 : saturation (%)', v_json -> 'saturation'; end if;
  -- seuils : valeur invalide, inconnue, journal
  begin perform public.definir_seuil('erreurs_pct', 150); raise exception 'ÉCHEC : seuil de plus de 100 %%';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.definir_seuil('inconnu', 5); raise exception 'ÉCHEC : seuil inconnu';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  perform public.definir_seuil('erreurs_pct', 0.001);
  perform public.definir_seuil('p95_ms', 1);
  reset role;
  if not exists (select 1 from public.journal_audit where action = 'modification_seuil' and cible_id = 'erreurs_pct' and details ->> 'ancien' = '5') then raise exception 'ÉCHEC RGA06 : seuil non journalisé'; end if;

  -- alerte : le taux d'erreurs dépasse le seuil → alerte active et super-admins notifiés (sans donnée personnelle)
  perform public.verifier_seuils();
  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  if (select count(*) from public.alertes_supervision_actives() where type in ('erreurs', 'latence')) <> 2 then raise exception 'ÉCHEC RGA22 : alertes non déclenchées'; end if;
  reset role;
  if not exists (select 1 from public.notifications where destinataire_id = v_s1 and type = 'alerte_supervision' and lien = '/admin/supervision') then raise exception 'ÉCHEC : super-admin non notifié'; end if;
  select count(*) into v_nb from public.notifications where destinataire_id = v_s1 and type = 'alerte_supervision';
  perform public.verifier_seuils();
  if (select count(*) from public.notifications where destinataire_id = v_s1 and type = 'alerte_supervision') <> v_nb then raise exception 'ÉCHEC : notification répétée pour la même alerte'; end if;
  if exists (select 1 from public.notifications where type = 'alerte_supervision' and titre ~ '[0-9]{3,}') then raise exception 'ÉCHEC RGA33 : chiffres détaillés dans la notification'; end if;
  -- retour à la normale : alerte levée
  update public.seuils_supervision set valeur = 100 where cle = 'erreurs_pct';
  update public.seuils_supervision set valeur = 1000000 where cle = 'p95_ms';
  perform public.verifier_seuils();
  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  if (select count(*) from public.alertes_supervision_actives() where type in ('erreurs', 'latence')) <> 0 then raise exception 'ÉCHEC : alerte non levée'; end if;
  reset role;

  -- agrégation horaire et purge du détail (RGA25)
  insert into public.mesures (module, operation, duree_ms, succes, session_id, created_at) values
    ('zz_heure', 'op', 100, true, 'session-mesure-test', now() - interval '3 hours'), ('zz_heure', 'op', 300, false, 'session-mesure-test', now() - interval '3 hours'),
    ('zz_ancien', 'op', 50, true, 'session-mesure-test', now() - interval '8 days');
  perform public.agreger_mesures();
  if not exists (select 1 from public.mesures_par_heure where module = 'zz_heure' and requetes = 2 and erreurs = 1 and p50_ms = 200) then raise exception 'ÉCHEC RGA25 : agrégat horaire'; end if;
  if exists (select 1 from public.mesures where module = 'zz_ancien') then raise exception 'ÉCHEC RGA25 : détail de plus de 7 jours non purgé'; end if;
  raise notice 'OK A6 : supervision, seuils et alertes';

  -- ===================================================================
  -- Tâches planifiées et droits (RGP17)
  -- ===================================================================
  select count(*) into v_nb from cron.job where jobname in ('a1-agreger-visites', 'a6-purger-erreurs', 'a6-agreger-mesures', 'a6-verifier-seuils');
  if v_nb <> 4 then raise exception 'ÉCHEC : tâches planifiées absentes (%)', v_nb; end if;
  if has_function_privilege('anon', 'public.supervision(text)', 'execute') or has_function_privilege('anon', 'public.liste_journal(uuid,text,text,date,date,integer,integer)', 'execute')
     or has_function_privilege('authenticated', 'public.verifier_seuils()', 'execute') or has_function_privilege('authenticated', 'public.agreger_visites()', 'execute')
     or has_function_privilege('authenticated', 'public.evaluer_alerte(text,numeric,boolean,text)', 'execute') or has_function_privilege('authenticated', 'public.purger_erreurs()', 'execute')
     or not has_function_privilege('anon', 'public.enregistrer_erreur_detail(text,text,text,text,text,text,text)', 'execute') then
    raise exception 'ÉCHEC RGP17 : droits d''exécution';
  end if;
  raise notice 'OK RGP17';
end;
$$;

rollback;
