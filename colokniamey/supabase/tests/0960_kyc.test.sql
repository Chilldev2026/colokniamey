-- Tests du module K (vérification d'identité). À exécuter après 0300, 0350, 0400, 0910, 0950, 0960 et seed.sql.
-- Tout est annulé à la fin (rollback). Chaque échec lève une exception « ÉCHEC ».

begin;

create function pg_temp.jeton(p_uid uuid, p_aal text, p_session uuid default null)
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
  v_e1 uuid := '00000000-0000-0000-0000-0000000b0001'; -- étudiant avec avatar validé
  v_e2 uuid := '00000000-0000-0000-0000-0000000b0002'; -- étudiant sans avatar
  v_e3 uuid := '00000000-0000-0000-0000-0000000b0003'; -- autre étudiant
  v_p1 uuid := '00000000-0000-0000-0000-0000000b0004'; -- propriétaire
  v_a1 uuid := '00000000-0000-0000-0000-0000000b0005'; -- admin
  v_s1 uuid := '00000000-0000-0000-0000-0000000b0006'; -- super-admin
  v_sa1 uuid := '00000000-0000-0000-0000-0000000b00a1';
  v_ss1 uuid := '00000000-0000-0000-0000-0000000b00a2';
  v_ver uuid;
  v_ver3 uuid;
  v_code text;
  v_nb integer;
  v_rec record;
  v_chemin text;
begin
  select id into v_univ from public.universites order by id limit 1;
  select valeur #>> '{}' into v_cgu from public.parametres where cle = 'version_cgu';
  v_meta := jsonb_build_object('role', 'etudiant', 'nom', 'Nom', 'prenom', 'Prenom', 'telephone', '90000000',
                               'universite_id', v_univ::text, 'cgu_version', v_cgu);
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_e1, 'k1@test.local', v_meta), (v_e2, 'k2@test.local', v_meta), (v_e3, 'k3@test.local', v_meta),
    (v_p1, 'k4@test.local', jsonb_set(v_meta, '{role}', '"proprietaire"')),
    (v_a1, 'k5@test.local', v_meta), (v_s1, 'k6@test.local', v_meta);
  update public.profils set role = 'admin' where id = v_a1;
  update public.profils set role = 'super_admin' where id = v_s1;
  insert into public.sessions_admin (session_id, user_id) values (v_sa1, v_a1), (v_ss1, v_s1);
  -- Avatars validés de v_e1 et v_e3 (le test s'exécute en tant que propriétaire des tables)
  insert into public.photos (proprietaire_id, usage, chemin, empreinte, statut, decide_le) values
    (v_e1, 'avatar', v_e1::text || '/av.webp', 'aaaaaaaaaaaaaaaa', 'validee', now()),
    (v_e3, 'avatar', v_e3::text || '/av.webp', 'bbbbbbbbbbbbbbbb', 'validee', now());

  -- ===================================================================
  -- RG59 : KYC désactivé par défaut
  -- ===================================================================
  if public.kyc_actif() then raise exception 'ÉCHEC RG59 : kyc_actif devrait être faux par défaut'; end if;
  if not public.identite_verifiee(v_e2) then raise exception 'ÉCHEC RG59 : étudiant non vérifié refusé alors que le KYC est désactivé'; end if;
  if public.identite_verifiee(v_a1) then raise exception 'ÉCHEC : un admin n''est pas un étudiant vérifié'; end if;

  perform pg_temp.jeton(v_e1, 'aal1'); set local role authenticated;
  begin perform public.demarrer_kyc(); raise exception 'ÉCHEC RG59 : démarrer_kyc avec KYC désactivé';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  raise notice 'OK RG59 : KYC désactivé par défaut';

  -- Un admin ne peut pas modifier kyc_actif ; le super-admin le peut (A5)
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  begin perform public.modifier_parametre('kyc_actif', 'true'::jsonb); raise exception 'ÉCHEC RGA17 : un admin modifie kyc_actif';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  perform public.modifier_parametre('kyc_actif', 'true'::jsonb);
  reset role;
  if not public.kyc_actif() then raise exception 'ÉCHEC : kyc_actif non activé par le super-admin'; end if;
  raise notice 'OK RGA17 : kyc_actif réservé au super-admin';

  -- ===================================================================
  -- RG52 : sans identité vérifiée, M4 et M8 doivent refuser
  -- ===================================================================
  if public.identite_verifiee(v_e1) then raise exception 'ÉCHEC RG52 : identité vraie avant tout dossier'; end if;
  perform pg_temp.jeton(v_e1, 'aal1'); set local role authenticated;
  begin perform public.exiger_identite_verifiee(); raise exception 'ÉCHEC : exiger_identite_verifiee appelable';
  exception when insufficient_privilege then null; end;
  reset role;
  -- le propriétaire n'est pas concerné tant que kyc_proprietaires est faux
  if not public.identite_verifiee(v_p1) then raise exception 'ÉCHEC : propriétaire bloqué par le KYC'; end if;

  -- ===================================================================
  -- Parcours : démarrer, consentir, déposer, soumettre
  -- ===================================================================
  perform pg_temp.jeton(v_e2, 'aal1'); set local role authenticated;
  begin perform public.demarrer_kyc(); raise exception 'ÉCHEC RG51 : dépôt sans avatar validé';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;

  perform pg_temp.jeton(v_e1, 'aal1'); set local role authenticated;
  select d.verification_id, d.code into v_ver, v_code from public.demarrer_kyc() d;
  if v_ver is null or v_code !~ '^[0-9]{4}$' then raise exception 'ÉCHEC RG53 : code à 4 chiffres'; end if;
  -- reprise du même dossier
  if (select d.verification_id from public.demarrer_kyc() d) <> v_ver then raise exception 'ÉCHEC : deux dossiers ouverts'; end if;
  begin perform public.soumettre_kyc('cni'); raise exception 'ÉCHEC : soumission sans consentement ni images';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  perform public.consentir_kyc();
  reset role;

  -- Edge Function (service_role) : images chiffrées déposées
  perform public.kyc_preparer_depot(v_e1, v_ver);
  v_chemin := v_e1::text || '/' || v_ver::text || '/recto.bin';
  perform public.kyc_enregistrer_image(v_e1, v_ver, 'recto', v_chemin, '1111111111111111');
  perform public.kyc_enregistrer_image(v_e1, v_ver, 'verso', v_e1::text || '/' || v_ver::text || '/verso.bin', '2222222222222222');
  begin perform public.kyc_enregistrer_image(v_e1, v_ver, 'recto', v_e3::text || '/x/recto.bin', '1111111111111111'); raise exception 'ÉCHEC : chemin d''un autre';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;

  perform pg_temp.jeton(v_e1, 'aal1'); set local role authenticated;
  begin perform public.soumettre_kyc('cni'); raise exception 'ÉCHEC : soumission sans selfie';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  perform public.kyc_enregistrer_image(v_e1, v_ver, 'selfie', v_e1::text || '/' || v_ver::text || '/selfie.bin', '3333333333333333');
  perform pg_temp.jeton(v_e1, 'aal1'); set local role authenticated;
  begin perform public.soumettre_kyc('permis'); raise exception 'ÉCHEC : type de pièce libre';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  perform public.soumettre_kyc('cni');
  select * into v_rec from public.mon_kyc();
  if v_rec.statut <> 'en_attente' or v_rec.code_selfie is not null then raise exception 'ÉCHEC : état après envoi (%)', v_rec.statut; end if;
  reset role;
  raise notice 'OK RG53 : parcours de dépôt';

  -- ===================================================================
  -- RG55 : l'utilisateur ne lit jamais une image ni un chemin, même la sienne
  -- ===================================================================
  perform pg_temp.jeton(v_e1, 'aal1'); set local role authenticated;
  select count(*) into v_nb from public.verifications_identite where user_id = v_e1;
  if v_nb <> 1 then raise exception 'ÉCHEC : l''étudiant ne voit pas son propre dossier (%)', v_nb; end if;
  begin perform chemin_recto from public.verifications_identite; raise exception 'ÉCHEC RG55 : chemin lisible';
  exception when insufficient_privilege then null; end;
  begin perform code_selfie from public.verifications_identite; raise exception 'ÉCHEC RG55 : code lisible';
  exception when insufficient_privilege then null; end;
  begin perform empreinte_recto from public.verifications_identite; raise exception 'ÉCHEC RG58 : empreinte lisible';
  exception when insufficient_privilege then null; end;
  begin insert into public.verifications_identite (user_id, code_selfie) values (v_e1, '0000'); raise exception 'ÉCHEC : écriture directe';
  exception when insufficient_privilege then null; end;
  begin update public.verifications_identite set statut = 'valide'; raise exception 'ÉCHEC : validation directe';
  exception when insufficient_privilege then null; end;
  -- Storage : aucune politique pour les utilisateurs sur kyc_prives
  select count(*) into v_nb from storage.objects where bucket_id = 'kyc_prives';
  if v_nb <> 0 then raise exception 'ÉCHEC RG55 : objets kyc_prives visibles'; end if;
  reset role;
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and (qual like '%kyc_prives%' or with_check like '%kyc_prives%')) then
    raise exception 'ÉCHEC RG55 : une politique Storage concerne kyc_prives';
  end if;
  -- un autre étudiant ne voit pas ce dossier
  perform pg_temp.jeton(v_e3, 'aal1'); set local role authenticated;
  select count(*) into v_nb from public.verifications_identite;
  if v_nb <> 0 then raise exception 'ÉCHEC RG55 : dossier d''un autre visible'; end if;
  begin perform public.liste_dossiers_kyc(); raise exception 'ÉCHEC : étudiant liste les dossiers';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  -- visiteur
  set local role anon;
  begin perform public.mon_kyc(); raise exception 'ÉCHEC : visiteur appelle mon_kyc';
  exception when insufficient_privilege then null; end;
  if public.identite_verifiee(v_e1) then null; end if; -- le badge est public : appel autorisé
  reset role;
  raise notice 'OK RG55 : aucune lecture des images ni des chemins';

  -- ===================================================================
  -- RGA04 : un admin sans aal2 est refusé ; un étudiant aussi
  -- ===================================================================
  perform pg_temp.jeton(v_a1, 'aal1', v_sa1); set local role authenticated;
  begin perform public.liste_dossiers_kyc(); raise exception 'ÉCHEC RGA04 : liste sans aal2';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.autoriser_consultation_kyc(v_ver, 'recto'); raise exception 'ÉCHEC RGA04 : consultation sans aal2';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.decider_kyc(v_ver, true); raise exception 'ÉCHEC RGA04 : décision sans aal2';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;

  -- ===================================================================
  -- Admin (aal2) : file, consultation journalisée, décision
  -- ===================================================================
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  select count(*) into v_nb from public.liste_dossiers_kyc();
  if v_nb <> 1 then raise exception 'ÉCHEC : file admin (%)', v_nb; end if;
  select * into v_rec from public.dossier_kyc_admin(v_ver);
  if v_rec.code_selfie <> v_code or not v_rec.images_disponibles or v_rec.avatar_chemin is null then raise exception 'ÉCHEC : fiche dossier'; end if;
  if public.autoriser_consultation_kyc(v_ver, 'recto') <> v_chemin then raise exception 'ÉCHEC : chemin de consultation'; end if;
  reset role;
  if not exists (select 1 from public.journal_audit where action = 'kyc_consultation' and cible_id = v_ver::text and acteur_id = v_a1) then
    raise exception 'ÉCHEC RG55 : consultation non journalisée';
  end if;
  if (select nombre from public.file_identites) <> 1 then raise exception 'ÉCHEC : file_identites'; end if;
  if not exists (select 1 from public.files_admin where nom = 'identites') then raise exception 'ÉCHEC : file non inscrite'; end if;

  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  begin perform public.decider_kyc(v_ver, false); raise exception 'ÉCHEC RG54 : refus sans motif';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.decider_kyc(v_ver, false, '   '); raise exception 'ÉCHEC RG54 : refus avec motif vide';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  perform public.decider_kyc(v_ver, true);
  reset role;
  if not public.identite_verifiee(v_e1) then raise exception 'ÉCHEC : identité non vérifiée après validation'; end if;
  if not exists (select 1 from public.notifications where destinataire_id = v_e1 and type = 'kyc_decision') then raise exception 'ÉCHEC : étudiant non notifié'; end if;
  if exists (select 1 from public.journal_audit where action = 'kyc_valide' and details::text ~* 'Nom|Prenom') then raise exception 'ÉCHEC RGP10 : donnée personnelle dans le journal'; end if;
  -- décision déjà prise : impossible de recommencer
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  begin perform public.decider_kyc(v_ver, false, 'Motif'); raise exception 'ÉCHEC : deuxième décision';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  raise notice 'OK RG54 : décision, motif obligatoire, journal';

  -- ===================================================================
  -- RG57 : tout changement de prénom, de nom ou d'avatar suspend le statut
  -- ===================================================================
  update public.profils set prenom = 'Autre' where id = v_e1;
  if public.identite_verifiee(v_e1) then raise exception 'ÉCHEC RG57 : prénom changé, identité encore vérifiée'; end if;
  update public.profils set prenom = 'Prenom' where id = v_e1;
  if not public.identite_verifiee(v_e1) then raise exception 'ÉCHEC RG57 : prénom rétabli non reconnu'; end if;
  update public.profils set nom = 'Autre' where id = v_e1;
  if public.identite_verifiee(v_e1) then raise exception 'ÉCHEC RG57 : nom changé'; end if;
  update public.profils set nom = 'Nom' where id = v_e1;
  insert into public.photos (proprietaire_id, usage, chemin, empreinte, statut, decide_le)
    values (v_e1, 'avatar', v_e1::text || '/av2.webp', 'cccccccccccccccc', 'validee', now() + interval '1 second');
  if public.identite_verifiee(v_e1) then raise exception 'ÉCHEC RG57 : avatar changé'; end if;
  delete from public.photos where chemin = v_e1::text || '/av2.webp';
  if not public.identite_verifiee(v_e1) then raise exception 'ÉCHEC RG57 : avatar rétabli non reconnu'; end if;
  -- compte suspendu : plus vérifié
  update public.profils set statut = 'suspendu' where id = v_e1;
  if public.identite_verifiee(v_e1) then raise exception 'ÉCHEC : compte suspendu vérifié'; end if;
  update public.profils set statut = 'actif' where id = v_e1;
  raise notice 'OK RG57 : changement d''identité';

  -- ===================================================================
  -- RG58 : image déjà vue sur un autre compte
  -- ===================================================================
  perform pg_temp.jeton(v_e3, 'aal1'); set local role authenticated;
  select d.verification_id into v_ver3 from public.demarrer_kyc() d;
  perform public.consentir_kyc();
  reset role;
  perform public.kyc_preparer_depot(v_e3, v_ver3);
  perform public.kyc_enregistrer_image(v_e3, v_ver3, 'recto', v_e3::text || '/' || v_ver3::text || '/recto.bin', '1111111111111101'); -- 1 bit d'écart
  if not (select suspect from public.verifications_identite where id = v_ver3) then raise exception 'ÉCHEC RG58 : image connue non signalée'; end if;
  raise notice 'OK RG58 : dossier suspect';

  -- ===================================================================
  -- RG54 : trois dossiers au plus par 30 jours ; refus avec motif
  -- ===================================================================
  perform pg_temp.jeton(v_e3, 'aal1'); set local role authenticated;
  perform public.annuler_kyc();
  select * into v_rec from public.mon_kyc();
  if v_rec.statut <> 'non_soumis' or v_rec.consentement then raise exception 'ÉCHEC : annulation (consentement non retiré)'; end if;
  reset role;
  -- images à effacer après l'annulation (consentement retiré)
  if not exists (select 1 from public.kyc_images_a_effacer(v_e3) where id = v_ver3) then raise exception 'ÉCHEC RG56 : images annulées non marquées à effacer'; end if;
  perform public.kyc_marquer_effacees(array[v_ver3]);
  if exists (select 1 from public.verifications_identite where id = v_ver3 and chemin_recto is not null) then raise exception 'ÉCHEC : chemin conservé'; end if;
  -- deux dossiers de plus (déjà 1) : on les crée refusés
  insert into public.verifications_identite (user_id, code_selfie, statut, motif_refus, decide_le, decide_par)
    values (v_e3, '1234', 'refuse', 'Photo floue', now(), v_a1), (v_e3, '2345', 'refuse', 'Photo floue', now(), v_a1);
  update public.verifications_identite set statut = 'refuse', motif_refus = 'Annulé', decide_le = now() where id = v_ver3;
  perform pg_temp.jeton(v_e3, 'aal1'); set local role authenticated;
  begin perform public.demarrer_kyc(); raise exception 'ÉCHEC RG54 : quatrième dossier en 30 jours';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  raise notice 'OK RG54 : limite de trois dossiers';

  -- ===================================================================
  -- RG56 : effacement des images 30 jours après la décision
  -- ===================================================================
  update public.verifications_identite set chemin_selfie = v_e1::text || '/' || v_ver::text || '/selfie.bin'
    where id = v_ver and chemin_selfie is not null;
  if exists (select 1 from public.kyc_images_a_effacer() where id = v_ver) then raise exception 'ÉCHEC RG56 : effacement trop tôt'; end if;
  update public.verifications_identite set decide_le = now() - interval '31 days' where id = v_ver;
  if not exists (select 1 from public.kyc_images_a_effacer() where id = v_ver) then raise exception 'ÉCHEC RG56 : effacement non demandé après 30 jours'; end if;
  perform public.kyc_marquer_effacees(array[v_ver]);
  if (select images_effacees_le from public.verifications_identite where id = v_ver) is null
     or (select chemin_recto from public.verifications_identite where id = v_ver) is not null then
    raise exception 'ÉCHEC RG56 : images non marquées effacées';
  end if;
  -- le statut validé reste valable après l'effacement des images
  if not public.identite_verifiee(v_e1) then raise exception 'ÉCHEC : statut perdu avec les images'; end if;
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  begin perform public.autoriser_consultation_kyc(v_ver, 'recto'); raise exception 'ÉCHEC : consultation d''une image effacée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  raise notice 'OK RG56 : effacement';

  -- ===================================================================
  -- Export, compteurs, droits
  -- ===================================================================
  perform pg_temp.jeton(v_e1, 'aal1'); set local role authenticated;
  if (select public.exporter_mes_donnees()::text) ~ '(recto|verso|selfie)\.bin' then raise exception 'ÉCHEC RGP11 : chemin KYC dans l''export'; end if;
  if jsonb_array_length((public.exporter_mes_donnees() -> 'donnees' -> 'identite' -> 'dossiers')) <> 1 then raise exception 'ÉCHEC RGP11 : dossier absent de l''export'; end if;
  reset role;
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  if (public.fiche_utilisateur(v_e1) -> 'compteurs' ->> 'dossiers_identite')::integer <> 1 then raise exception 'ÉCHEC : compteur de la fiche'; end if;
  reset role;

  if has_function_privilege('authenticated', 'public.kyc_enregistrer_image(uuid,uuid,text,text,text)', 'execute')
     or has_function_privilege('authenticated', 'public.kyc_preparer_depot(uuid,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.kyc_images_a_effacer(uuid)', 'execute')
     or has_function_privilege('anon', 'public.demarrer_kyc()', 'execute')
     or has_function_privilege('anon', 'public.decider_kyc(uuid,boolean,text)', 'execute')
     or has_function_privilege('authenticated', 'public.exiger_identite_verifiee()', 'execute')
     or not has_function_privilege('service_role', 'public.kyc_images_a_effacer(uuid)', 'execute') then
    raise exception 'ÉCHEC RGP17 : droits d''exécution';
  end if;
  if not exists (select 1 from storage.buckets where id = 'kyc_prives' and public = false and file_size_limit is not null and allowed_mime_types is not null) then
    raise exception 'ÉCHEC RGP21 : bucket kyc_prives';
  end if;
  raise notice 'OK RGP11, RGP17, RGP21';

  -- ===================================================================
  -- KYC désactivé : un étudiant non vérifié passe (M4 et M8), aucune image collectée
  -- ===================================================================
  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  perform public.modifier_parametre('kyc_actif', 'false'::jsonb);
  reset role;
  if not public.identite_verifiee(v_e3) then raise exception 'ÉCHEC RG59 : étudiant non vérifié bloqué quand le KYC est désactivé'; end if;
  begin perform public.kyc_preparer_depot(v_e3, v_ver3); raise exception 'ÉCHEC RG59 : dépôt accepté alors que le KYC est désactivé';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  raise notice 'OK RG59 : KYC réactivable sans perte';
end;
$$;

rollback;
