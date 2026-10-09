-- Tests du module A5 (plateforme). À exécuter après 0300, 0910, 0950 et supabase/seed.sql.
-- Tout est annulé à la fin (rollback). Chaque échec lève une exception « ÉCHEC ».

begin;

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
  v_ville bigint;
  v_cgu text;
  v_s1 uuid := '00000000-0000-0000-0000-0000000a5a01';
  v_a1 uuid := '00000000-0000-0000-0000-0000000a5b01';
  v_e1 uuid := '00000000-0000-0000-0000-0000000a5c01';
  v_ss1 uuid := '00000000-0000-0000-0000-0000000a5d01';
  v_sa1 uuid := '00000000-0000-0000-0000-0000000a5d02';
  v_meta jsonb;
  v_nb integer;
  v_nb2 integer;
  v_msg text;
  v_json jsonb;
  v_rec record;
  v_id bigint;
  v_q bigint;
  v_u bigint;
begin
  select id into v_univ from public.universites order by id limit 1;
  select id into v_ville from public.villes where nom = 'Niamey';
  select valeur #>> '{}' into v_cgu from public.parametres where cle = 'version_cgu';
  v_meta := jsonb_build_object('role', 'etudiant', 'nom', 'Nom', 'prenom', 'Prenom', 'telephone', '90000000',
                               'universite_id', v_univ::text, 'cgu_version', v_cgu);
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_s1, 's1@test.local', v_meta), (v_a1, 'a1@test.local', v_meta), (v_e1, 'e1@test.local', v_meta);
  update public.profils set role = 'super_admin' where id = v_s1;
  update public.profils set role = 'admin' where id = v_a1;
  insert into public.sessions_admin (session_id, user_id) values (v_ss1, v_s1), (v_sa1, v_a1);

  -- ===================================================================
  -- Maintenance (RGA15, RGA16)
  -- ===================================================================
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  begin perform public.definir_maintenance(true, 'Test', now() + interval '1 hour'); raise exception 'ÉCHEC RGA15 : un admin active la maintenance';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.modifier_parametre('photos_max', '4'::jsonb); raise exception 'ÉCHEC RGA17 : un admin modifie un paramètre';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  select count(*) into v_nb from public.liste_parametres();
  if v_nb < 10 then raise exception 'ÉCHEC : l''admin ne voit pas les paramètres (%)', v_nb; end if;
  if not exists (select 1 from public.liste_parametres() where cle = 'email_domaine_verifie') then raise exception 'ÉCHEC : paramètre non public absent pour l''admin'; end if;
  reset role;

  perform pg_temp.jeton(v_e1, 'aal1'); set local role authenticated;
  begin perform public.definir_maintenance(true); raise exception 'ÉCHEC : un étudiant active la maintenance';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.modifier_parametre('kyc_actif', 'true'::jsonb); raise exception 'ÉCHEC : un étudiant modifie un paramètre';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform * from public.liste_parametres(); raise exception 'ÉCHEC : un étudiant lit les paramètres';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  set local role anon;
  begin perform public.definir_maintenance(true); raise exception 'ÉCHEC : un visiteur active la maintenance';
  exception when insufficient_privilege then null; end;
  begin perform public.modifier_parametre('kyc_actif', 'true'::jsonb); raise exception 'ÉCHEC : un visiteur modifie un paramètre';
  exception when insufficient_privilege then null; end;
  reset role;
  raise notice 'OK RGA15/RGA17 : un admin ne peut ni activer la maintenance ni modifier un paramètre';

  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  begin perform public.definir_maintenance(true, 'Mise à jour', now() - interval '1 hour'); raise exception 'ÉCHEC : fin de maintenance dans le passé';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.definir_maintenance(true, repeat('x', 301)); raise exception 'ÉCHEC : message de 301 caractères';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  perform public.definir_maintenance(true, 'Mise à jour de la base', now() + interval '2 hours');
  reset role;
  if not public.en_maintenance() then raise exception 'ÉCHEC RGA15 : maintenance non activée'; end if;
  if (select valeur #>> '{}' from public.parametres where cle = 'maintenance_message') <> 'Mise à jour de la base' then raise exception 'ÉCHEC : message de maintenance'; end if;
  if (select valeur from public.parametres where cle = 'maintenance_fin') = 'null'::jsonb then raise exception 'ÉCHEC : heure de fin absente'; end if;
  if not exists (select 1 from public.journal_audit where action = 'maintenance_activee' and acteur_id = v_s1) then raise exception 'ÉCHEC RGA06 : maintenance non journalisée'; end if;
  -- La diffusion en temps réel (canal « plateforme ») ne peut pas être vérifiée ici : le service Realtime crée les
  -- partitions de realtime.messages à la première connexion d'un client. Sans client, l'envoi est ignoré sans erreur.

  -- RGA16 : en maintenance, l'écriture d'un étudiant est refusée par la base ; un admin aal2 peut écrire
  perform pg_temp.jeton(v_e1, 'aal1'); set local role authenticated;
  if public.peut_ecrire() then raise exception 'ÉCHEC RGA16 : un étudiant peut écrire en maintenance'; end if;
  update public.profils set nom = 'Modifie' where id = v_e1;
  get diagnostics v_nb = row_count;
  if v_nb <> 0 then raise exception 'ÉCHEC RGA16 : écriture d''un étudiant acceptée en maintenance'; end if;
  reset role;
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  if not public.peut_ecrire() then raise exception 'ÉCHEC RGA16 : un admin ne peut pas écrire en maintenance'; end if;
  reset role;

  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  perform public.definir_maintenance(false);
  reset role;
  if public.en_maintenance() then raise exception 'ÉCHEC : maintenance non désactivée'; end if;
  perform pg_temp.jeton(v_e1, 'aal1'); set local role authenticated;
  update public.profils set nom = 'Modifie' where id = v_e1;
  get diagnostics v_nb = row_count;
  if v_nb <> 1 then raise exception 'ÉCHEC : écriture refusée hors maintenance'; end if;
  reset role;
  raise notice 'OK RGA15/RGA16 : maintenance';

  -- ===================================================================
  -- Paramètres typés et validés (RGA17)
  -- ===================================================================
  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  begin perform public.modifier_parametre('photos_max', '11'::jsonb); raise exception 'ÉCHEC : photos_max à 11';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.modifier_parametre('photos_max', '0'::jsonb); raise exception 'ÉCHEC : photos_max à 0';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.modifier_parametre('photos_max', '2.5'::jsonb); raise exception 'ÉCHEC : photos_max décimal';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.modifier_parametre('photos_max', '"cinq"'::jsonb); raise exception 'ÉCHEC : photos_max texte';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.modifier_parametre('kyc_actif', '"oui"'::jsonb); raise exception 'ÉCHEC : kyc_actif texte';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.modifier_parametre('parametre_inconnu', 'true'::jsonb); raise exception 'ÉCHEC : paramètre inconnu accepté';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.modifier_parametre('maintenance_active', 'true'::jsonb); raise exception 'ÉCHEC : maintenance modifiée par modifier_parametre';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.modifier_parametre('version_cgu', '"v 1 !"'::jsonb); raise exception 'ÉCHEC : version_cgu invalide';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.modifier_parametre('nsfw_seuil', '0.1'::jsonb); raise exception 'ÉCHEC : seuil nsfw hors bornes';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  if (select valeur from public.liste_parametres() where cle = 'photos_max') <> '5'::jsonb then raise exception 'ÉCHEC : photos_max modifié par une valeur refusée'; end if;

  perform public.modifier_parametre('photos_max', '6'::jsonb);
  perform public.modifier_parametre('validation_annonces', 'false'::jsonb);
  perform public.modifier_parametre('kyc_actif', 'true'::jsonb);
  perform public.modifier_parametre('seuil_relance_heures', '2'::jsonb);
  reset role;
  if (select valeur from public.parametres where cle = 'photos_max') <> '6'::jsonb then raise exception 'ÉCHEC : photos_max non modifié'; end if;
  if not exists (select 1 from public.journal_audit where action = 'modification_parametre' and cible_id = 'kyc_actif' and acteur_id = v_s1
                 and details -> 'ancien' = 'false'::jsonb and details -> 'nouveau' = 'true'::jsonb) then
    raise exception 'ÉCHEC RGA17 : modification de kyc_actif non journalisée avec l''ancienne et la nouvelle valeur';
  end if;
  -- les paramètres publics sont lisibles par tous, pas les autres
  set local role anon;
  v_json := public.parametres_publics();
  if (v_json -> 'kyc_actif') <> 'true'::jsonb or v_json ? 'seuil_relance_heures' or v_json ? 'email_domaine_verifie' then
    raise exception 'ÉCHEC : paramètres publics : %', v_json;
  end if;
  reset role;
  -- l'heure du récapitulatif décale la tâche planifiée
  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  perform public.modifier_parametre('heure_recapitulatif', '9'::jsonb);
  reset role;
  if not exists (select 1 from cron.job where jobname = 'a2-recapitulatif-quotidien' and schedule = '0 9 * * *') then raise exception 'ÉCHEC : tâche du récapitulatif non décalée'; end if;
  raise notice 'OK RGA17 : paramètres';

  -- ===================================================================
  -- Référentiel (RG22, RG25 bis, RG29)
  -- ===================================================================
  perform pg_temp.jeton(v_e1, 'aal1'); set local role authenticated;
  begin insert into public.universites (nom, ville_id) values ('Pirate', v_ville); raise exception 'ÉCHEC : un étudiant crée une université';
  exception when insufficient_privilege then null; end;
  begin insert into public.equipements (nom) values ('Pirate'); raise exception 'ÉCHEC : un étudiant crée un équipement';
  exception when insufficient_privilege then null; end;
  update public.universites set nom = 'Piraté' where id = v_univ;
  get diagnostics v_nb = row_count;
  if v_nb <> 0 then raise exception 'ÉCHEC : un étudiant modifie une université'; end if;
  reset role;
  set local role anon;
  begin insert into public.villes (nom, centre, rayon_km) values ('Pirate', 'SRID=4326;POINT(2 13)', 5); raise exception 'ÉCHEC : un visiteur crée une ville';
  exception when insufficient_privilege then null; end;
  reset role;

  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  -- création : un admin peut écrire ; zone de la ville respectée (RG22)
  insert into public.quartiers (nom, ville_id, commune, centre) values ('Quartier de test', v_ville, 'Niamey I', 'SRID=4326;POINT(2.11 13.52)') returning id into v_q;
  begin insert into public.quartiers (nom, ville_id, centre) values ('Trop loin', v_ville, 'SRID=4326;POINT(8.99 13.0)'); raise exception 'ÉCHEC RG22 : quartier hors zone';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  select count(*) into v_nb from public.universites where position is null;
  insert into public.universites (nom, sigle, ville_id, quartier_id) values ('Université de test', 'UTEST', v_ville, v_q) returning id into v_u;
  -- une université sans position est comptée « à placer »
  select nombre into v_nb2 from public.file_universites_a_placer;
  if v_nb2 <> v_nb + 1 then raise exception 'ÉCHEC RG25 bis : compteur À placer (% au lieu de %)', v_nb2, v_nb + 1; end if;
  if (select count(*) from public.universites_geo where id = v_u and latitude is not null) <> 0 then raise exception 'ÉCHEC : une université sans position a des coordonnées'; end if;
  -- RG22 : placée hors de la zone de la ville, elle est refusée par la base
  begin update public.universites set position = 'SRID=4326;POINT(0 0)' where id = v_u; raise exception 'ÉCHEC RG22 : université hors zone';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  -- placée dans la zone, elle apparaît ensuite sur la carte (vue lue par la carte, avec ses coordonnées)
  update public.universites set position = 'SRID=4326;POINT(2.105 13.512)' where id = v_u;
  select latitude, longitude into v_rec from public.universites_geo where id = v_u;
  if v_rec.latitude is null or abs(v_rec.latitude - 13.512) > 0.0001 or abs(v_rec.longitude - 2.105) > 0.0001 then raise exception 'ÉCHEC RG25 : université placée absente de la carte'; end if;
  select nombre into v_nb2 from public.file_universites_a_placer;
  if v_nb2 <> v_nb then raise exception 'ÉCHEC RG25 bis : compteur après placement'; end if;
  reset role;
  -- les visiteurs la voient sur la carte
  set local role anon;
  if not exists (select 1 from public.universites_geo where id = v_u and latitude is not null) then raise exception 'ÉCHEC : un visiteur ne voit pas l''université placée'; end if;
  reset role;

  -- suppression refusée si l'élément est utilisé, avec un message clair
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  begin delete from public.universites where id = v_univ; raise exception 'ÉCHEC : suppression d''une université utilisée';
  exception when raise_exception then
    v_msg := sqlerrm;
    if v_msg like 'ÉCHEC%' then raise; end if;
    if v_msg not like '%utilisé par des étudiants%' then raise exception 'ÉCHEC : message de suppression peu clair : %', v_msg; end if;
  end;
  begin delete from public.quartiers where id = v_q; raise exception 'ÉCHEC : suppression d''un quartier utilisé';
  exception when raise_exception then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like '%utilisé par des universités%' then raise exception 'ÉCHEC : message quartier : %', sqlerrm; end if;
  end;
  begin delete from public.villes where id = v_ville; raise exception 'ÉCHEC : suppression d''une ville utilisée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  -- un élément inutilisé se supprime
  delete from public.universites where id = v_u;
  delete from public.quartiers where id = v_q;
  get diagnostics v_nb = row_count;
  if v_nb <> 1 then raise exception 'ÉCHEC : suppression d''un quartier inutilisé'; end if;
  reset role;

  -- chaque opération est journalisée
  if (select count(*) from public.journal_audit where action like 'referentiel_%' and acteur_id = v_a1) < 5 then
    raise exception 'ÉCHEC RGA06 : opérations du référentiel non journalisées (%)', (select count(*) from public.journal_audit where action like 'referentiel_%' and acteur_id = v_a1);
  end if;
  if not exists (select 1 from public.journal_audit where action = 'referentiel_delete' and cible_type = 'universites' and cible_id = v_u::text) then raise exception 'ÉCHEC RGA06 : suppression non journalisée'; end if;

  -- équipements (RG29)
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  insert into public.equipements (nom, ordre) values ('Climatisation', 10), ('Ancien équipement', 20);
  update public.equipements set actif = false where nom = 'Ancien équipement';
  reset role;
  set local role anon;
  select count(*) into v_nb from public.equipements;
  if v_nb <> 1 then raise exception 'ÉCHEC RG29 : un visiteur voit % équipements au lieu de 1 (actifs seulement)', v_nb; end if;
  reset role;
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  select count(*) into v_nb from public.equipements;
  if v_nb <> 2 then raise exception 'ÉCHEC RG29 : l''admin voit % équipements', v_nb; end if;
  delete from public.equipements where nom = 'Ancien équipement';
  reset role;
  raise notice 'OK RG22/RG25bis/RG29 : référentiel';

  -- ===================================================================
  -- A2 : seuil d'ancienneté paramétrable, files informatives sans alerte
  -- ===================================================================
  create table public.t_file_a5 (id bigint generated always as identity primary key, cree timestamptz not null default now());
  create view public.file_test_ae with (security_invoker = true) as select count(*)::bigint as nombre, min(cree) as plus_ancien from public.t_file_a5;
  insert into public.files_admin (nom, libelle, vue, lien) values ('test_ae', 'File de test', 'file_test_ae', '/admin/test');
  insert into public.files_admin (nom, libelle, vue, lien, alerter) values ('test_info', 'File informative', 'file_test_ae', '/admin/test', false);
  insert into public.t_file_a5 (cree) values (now() - interval '3 hours');
  delete from public.notifications where type like 'alerte_file%';
  perform public.alertes_files(); -- première alerte : nouvel élément
  if exists (select 1 from public.notifications where titre like 'File informative%') then raise exception 'ÉCHEC : alerte pour une file informative'; end if;
  update public.files_admin set derniere_alerte_le = now() - interval '1 hour' where nom = 'test_ae';
  delete from public.notifications where type like 'alerte_file%';
  -- seuil de 2 h (paramètre seuil_relance_heures) : l'élément de 3 h déclenche l'alerte d'ancienneté
  perform public.alertes_files();
  if not exists (select 1 from public.notifications where type = 'alerte_file_ancienne' and titre like 'File de test%') then raise exception 'ÉCHEC RGA34 : seuil paramétrable non appliqué'; end if;
  raise notice 'OK RGA34 : seuil paramétrable';

  -- RGP17
  if has_function_privilege('anon', 'public.liste_parametres()', 'execute') or has_function_privilege('anon', 'public.definir_maintenance(boolean,text,timestamptz)', 'execute')
     or has_function_privilege('authenticated', 'public.diffuser_parametre()', 'execute') or has_function_privilege('authenticated', 'public.proteger_suppression_referentiel()', 'execute') then
    raise exception 'ÉCHEC RGP17 : droits d''exécution';
  end if;
  raise notice 'OK RGP17';
end;
$$;

rollback;
