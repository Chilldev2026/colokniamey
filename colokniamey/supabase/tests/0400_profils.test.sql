-- Tests du module M3 (profils). À exécuter après 0300, 0350, 0352, 0400 et supabase/seed.sql.
-- Tout est annulé à la fin (rollback). Chaque échec lève une exception « ÉCHEC ».

begin;

do $$
declare
  v_univ bigint;
  v_cgu text;
  v_u1 uuid := '00000000-0000-0000-0000-00000000b101';
  v_u2 uuid := '00000000-0000-0000-0000-00000000b102';
  v_adm uuid := '00000000-0000-0000-0000-00000000b1a1';
  v_meta jsonb;
  v_nb integer;
  v_json jsonb;
  v_texte text;
  v_photo bigint;
  v_rec record;
begin
  select id into v_univ from public.universites order by id limit 1;
  select valeur #>> '{}' into v_cgu from public.parametres where cle = 'version_cgu';
  v_meta := jsonb_build_object('role', 'etudiant', 'nom', 'Issoufou', 'prenom', 'Aminata', 'telephone', '90111111',
                               'universite_id', v_univ::text, 'cgu_version', v_cgu);
  insert into auth.users (id, email, raw_user_meta_data) values (v_u1, 'u1@test.local', v_meta);
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_u2, 'u2@test.local', jsonb_build_object('role', 'proprietaire', 'nom', 'MoussaUnique', 'prenom', 'Zeinabou',
          'telephone', '90222222', 'cgu_version', v_cgu, 'type_proprietaire', 'agence'));
  insert into auth.users (id, email, raw_user_meta_data) values (v_adm, 'adm@test.local', v_meta || '{"nom":"Admin","prenom":"Super"}');
  update public.profils set role = 'super_admin' where id = v_adm;
  -- A2 (RGA36) : est_admin() exige aussi une session admin active
  insert into public.sessions_admin (session_id, user_id) values ('00000000-0000-0000-0000-0000000005e5', v_adm);

  -- ===================================================================
  -- Modification de son profil / refus sur celui d'autrui (RG10)
  -- ===================================================================
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal1"}', v_u1), true);
  set local role authenticated;

  update public.profils set nom = 'Issoufou-Maiga', prenom = 'Aminata' where id = v_u1;
  get diagnostics v_nb = row_count;
  if v_nb <> 1 then raise exception 'ÉCHEC : modification de son profil'; end if;
  update public.profils_etudiants set filiere = 'Informatique', bio = 'Étudiante calme et organisée', budget_max = 25000 where user_id = v_u1;
  get diagnostics v_nb = row_count;
  if v_nb <> 1 then raise exception 'ÉCHEC : modification du profil étudiant'; end if;
  insert into public.profils_complements (user_id, profession, centres_interet)
  values (v_u1, '  Étudiante en informatique ', array['Football', ' Lecture ', '']);
  select * into v_rec from public.profils_complements where user_id = v_u1;
  if v_rec.profession <> 'Étudiante en informatique' or v_rec.centres_interet <> array['Football', 'Lecture'] or v_rec.en_revue then
    raise exception 'ÉCHEC : compléments mal nettoyés (%, %)', v_rec.profession, v_rec.centres_interet;
  end if;
  update public.profils_complements set centres_interet = array['Football'] where user_id = v_u1;
  get diagnostics v_nb = row_count;
  if v_nb <> 1 then raise exception 'ÉCHEC : modification des compléments'; end if;

  -- Refus sur le profil d'autrui
  update public.profils set nom = 'Piraté' where id = v_u2;
  get diagnostics v_nb = row_count;
  if v_nb <> 0 then raise exception 'ÉCHEC RG10 : modification du profil d''autrui'; end if;
  begin
    insert into public.profils_complements (user_id, profession) values (v_u2, 'Pirate');
    raise exception 'ÉCHEC RG10 : compléments créés pour autrui';
  exception when insufficient_privilege then null; end;
  select count(*) into v_nb from public.profils_complements;
  if v_nb <> 1 then raise exception 'ÉCHEC RG10 : % compléments visibles', v_nb; end if;
  -- en_revue n'est pas modifiable par l'utilisateur
  begin
    update public.profils_complements set en_revue = true where user_id = v_u1;
    raise exception 'ÉCHEC : en_revue modifiable par l''utilisateur';
  exception when insufficient_privilege then null; end;
  raise notice 'OK RG10 : profil propre modifiable, profil d''autrui protégé';

  -- Validation des compléments
  begin
    update public.profils_complements set centres_interet = array['aa','bb','cc','dd','ee','ff'] where user_id = v_u1;
    raise exception 'ÉCHEC : plus de 5 centres d''intérêt acceptés';
  exception when check_violation then null; end;
  begin
    update public.profils_complements set centres_interet = array['x'] where user_id = v_u1;
    raise exception 'ÉCHEC : centre d''intérêt d''un caractère accepté';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin
    update public.profils_complements set profession = repeat('a', 81) where user_id = v_u1;
    raise exception 'ÉCHEC : profession de 81 caractères acceptée';
  exception when check_violation then null; end;

  -- RG45 : textes vérifiés par S
  begin
    update public.profils_complements set profession = 'vendeur de porno' where user_id = v_u1;
    raise exception 'ÉCHEC RG45 : profession bloquante acceptée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin
    update public.profils_etudiants set bio = 'p.0.r.n.0' where user_id = v_u1;
    raise exception 'ÉCHEC RG45 : bio bloquante acceptée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin
    update public.profils set prenom = 'daech' where id = v_u1;
    raise exception 'ÉCHEC RG45 : prénom bloquant accepté';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  -- sur les tables de M2 : pas de revue, le texte ambigu passe
  update public.profils_etudiants set filiere = 'Tuer le temps' where user_id = v_u1;
  update public.profils_etudiants set filiere = 'Informatique' where user_id = v_u1;
  raise notice 'OK RG45 : textes du profil contrôlés';

  -- revue : enregistré mais masqué au public
  update public.profils_complements set profession = 'Je vais tuer le temps' where user_id = v_u1;
  select en_revue into v_rec from public.profils_complements where user_id = v_u1;
  if not v_rec.en_revue then raise exception 'ÉCHEC RG45 : profession à revoir non masquée'; end if;
  reset role;
  if not exists (select 1 from public.contenus_en_revue where type_contenu = 'profil' and contenu_id = v_u1::text and statut = 'en_attente') then
    raise exception 'ÉCHEC RG45 : pas de ligne de revue pour le profil';
  end if;

  -- ===================================================================
  -- Profil public (jamais de téléphone ni d'e-mail)
  -- ===================================================================
  set local role anon;
  select count(*) into v_nb from public.profil_public(v_u1);
  if v_nb <> 1 then raise exception 'ÉCHEC : profil_public introuvable pour un visiteur'; end if;
  select to_jsonb(p) into v_json from public.profil_public(v_u1) p;
  v_texte := v_json::text;
  if v_texte like '%90111111%' or v_texte like '%u1@test.local%' or v_texte like '%Issoufou%' or v_texte like '%telephone%' then
    raise exception 'ÉCHEC : profil_public divulgue une donnée personnelle : %', v_texte;
  end if;
  if v_json ->> 'prenom' <> 'Aminata' or v_json ->> 'initiale_nom' <> 'I' or v_json ->> 'role' <> 'etudiant'
     or v_json ->> 'universite' is null then
    raise exception 'ÉCHEC : profil_public incomplet : %', v_texte;
  end if;
  -- profession à revoir : masquée
  if v_json ->> 'profession' is not null then raise exception 'ÉCHEC RG45 : profession en revue visible'; end if;
  -- propriétaire : type, pas d'université
  select to_jsonb(p) into v_json from public.profil_public(v_u2) p;
  if v_json ->> 'type_proprietaire' <> 'agence' or v_json ->> 'universite' is not null or v_json ->> 'initiale_nom' <> 'M' then
    raise exception 'ÉCHEC : profil_public propriétaire : %', v_json;
  end if;
  -- un admin n'a pas de profil public
  select count(*) into v_nb from public.profil_public(v_adm);
  if v_nb <> 0 then raise exception 'ÉCHEC : profil public d''un admin'; end if;
  -- fonctions privées inaccessibles
  begin perform public.mon_avatar(); raise exception 'ÉCHEC : visiteur appelle mon_avatar';
  exception when insufficient_privilege then null; end;
  begin perform public.exporter_mes_donnees(); raise exception 'ÉCHEC : visiteur appelle exporter_mes_donnees';
  exception when insufficient_privilege then null; end;
  begin perform public.desactiver_mon_compte('DESACTIVER'); raise exception 'ÉCHEC : visiteur désactive un compte';
  exception when insufficient_privilege then null; end;
  begin perform public.avatar_valide(v_u1); raise exception 'ÉCHEC : avatar_valide appelable';
  exception when insufficient_privilege then null; end;
  reset role;
  -- un compte suspendu n'a plus de profil public
  update public.profils set statut = 'suspendu' where id = v_u2;
  select count(*) into v_nb from public.profil_public(v_u2);
  if v_nb <> 0 then raise exception 'ÉCHEC : profil public d''un compte suspendu'; end if;
  update public.profils set statut = 'actif' where id = v_u2;
  raise notice 'OK : profil_public minimal';

  -- ===================================================================
  -- Avatar : visible publiquement seulement après validation (RG49)
  -- ===================================================================
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal1"}', v_u1), true);
  set local role authenticated;
  select * into v_rec from public.mon_avatar();
  if v_rec.chemin_valide is not null or v_rec.statut is not null then raise exception 'ÉCHEC : avatar présent avant envoi'; end if;
  insert into storage.objects (bucket_id, name) values ('photos_en_attente', v_u1::text || '/avatar1.webp');
  v_photo := public.enregistrer_photo(v_u1::text || '/avatar1.webp', 'avatar', '1234567812345678');
  select * into v_rec from public.mon_avatar();
  if v_rec.chemin_valide is not null or v_rec.statut <> 'en_attente' then raise exception 'ÉCHEC : état avatar en attente'; end if;
  reset role;
  if (select avatar_chemin from public.profil_public(v_u1)) is not null then raise exception 'ÉCHEC RG49 : avatar en attente visible au public'; end if;

  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal2","session_id":"00000000-0000-0000-0000-0000000005e5"}', v_adm), true);
  set local role authenticated;
  perform public.decider_photo(v_photo, 'valider');
  reset role;
  if (select avatar_chemin from public.profil_public(v_u1)) <> v_u1::text || '/avatar1.webp' then
    raise exception 'ÉCHEC RG49 : avatar validé non visible';
  end if;
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal1"}', v_u1), true);
  set local role authenticated;
  select * into v_rec from public.mon_avatar();
  if v_rec.chemin_valide is distinct from v_u1::text || '/avatar1.webp' or v_rec.statut <> 'validee' then raise exception 'ÉCHEC : mon_avatar après validation'; end if;
  reset role;
  raise notice 'OK RG49 : avatar public après validation seulement';

  -- ===================================================================
  -- Export des données (RGP11) : uniquement les siennes
  -- ===================================================================
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal1"}', v_u1), true);
  set local role authenticated;
  v_json := public.exporter_mes_donnees();
  reset role;
  v_texte := v_json::text;
  if v_texte not like '%90111111%' or v_texte not like '%u1@test.local%' or v_texte not like '%Aminata%' then
    raise exception 'ÉCHEC RGP11 : export incomplet';
  end if;
  if v_texte like '%90222222%' or v_texte like '%u2@test.local%' or v_texte like '%MoussaUnique%' or v_texte like '%Zeinabou%'
     or v_texte like '%adm@test.local%' then
    raise exception 'ÉCHEC RGP11 : l''export contient les données d''un autre utilisateur';
  end if;
  if not (v_json -> 'donnees' ? 'profils') or not (v_json -> 'donnees' ? 'securite') then
    raise exception 'ÉCHEC RGP11 : modules manquants dans l''export : %', (select array_agg(k) from jsonb_object_keys(v_json -> 'donnees') k);
  end if;
  if jsonb_array_length(v_json -> 'donnees' -> 'securite' -> 'photos') <> 1 then raise exception 'ÉCHEC RGP11 : photos absentes de l''export'; end if;
  -- aucun chemin de stockage interne ni contenu détecté dans l'export de S
  if v_texte like '%avatar1.webp%' then raise exception 'ÉCHEC RGP11 : chemin de stockage dans l''export'; end if;

  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal1"}', v_u2), true);
  set local role authenticated;
  v_texte := public.exporter_mes_donnees()::text;
  reset role;
  if v_texte not like '%90222222%' or v_texte like '%90111111%' or v_texte like '%u1@test.local%' or v_texte like '%Aminata%' then
    raise exception 'ÉCHEC RGP11 : export du propriétaire';
  end if;
  raise notice 'OK RGP11 : export limité à ses propres données';

  -- ===================================================================
  -- Désactivation avec anonymisation (RGA09)
  -- ===================================================================
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal2","session_id":"00000000-0000-0000-0000-0000000005e5"}', v_adm), true);
  set local role authenticated;
  begin perform public.desactiver_mon_compte('DESACTIVER'); raise exception 'ÉCHEC RGA03 : un admin se désactive ici';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;

  insert into public.profils_complements (user_id, profession) values (v_u2, 'Gérante');
  insert into auth.sessions (id, user_id) values (gen_random_uuid(), v_u2);
  perform public.notifier(v_u2, 'test', 'Bonjour', null);
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal1"}', v_u2), true);
  set local role authenticated;
  begin perform public.desactiver_mon_compte('oui'); raise exception 'ÉCHEC : confirmation incorrecte acceptée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  perform public.desactiver_mon_compte('DESACTIVER');
  reset role;

  select * into v_rec from public.profils where id = v_u2;
  if v_rec.statut <> 'desactive' or v_rec.nom <> 'Utilisateur' or v_rec.prenom <> 'Ancien membre' or v_rec.telephone <> '00000000' then
    raise exception 'ÉCHEC RGA09 : profil non anonymisé';
  end if;
  if exists (select 1 from public.profils_complements where user_id = v_u2) then raise exception 'ÉCHEC RGA09 : compléments conservés'; end if;
  if (select adresse from public.profils_proprietaires where user_id = v_u2) is not null then raise exception 'ÉCHEC RGA09 : adresse conservée'; end if;
  if exists (select 1 from public.notifications where destinataire_id = v_u2) then raise exception 'ÉCHEC RGA09 : notifications conservées'; end if;
  if not exists (select 1 from auth.users where id = v_u2 and email like 'supprime-%@anonyme.invalid' and banned_until is not null) then
    raise exception 'ÉCHEC RGA09 : compte d''authentification non anonymisé ou non bloqué';
  end if;
  if exists (select 1 from auth.sessions where user_id = v_u2) then raise exception 'ÉCHEC RG12 : sessions conservées'; end if;
  if exists (select 1 from public.profil_public(v_u2)) then raise exception 'ÉCHEC : profil public d''un compte désactivé'; end if;
  if not exists (select 1 from public.journal_audit where action = 'desactivation_compte' and cible_id = v_u2::text) then
    raise exception 'ÉCHEC RGA06 : désactivation non journalisée';
  end if;
  -- le compte désactivé n'est plus actif : plus d'export ni de désactivation
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal1"}', v_u2), true);
  set local role authenticated;
  begin perform public.exporter_mes_donnees(); raise exception 'ÉCHEC : export après désactivation';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  raise notice 'OK RGA09 : désactivation avec anonymisation';

  -- RGP17 : fonctions internes non appelables
  if has_function_privilege('authenticated', 'public.exporter_donnees_profils(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.exporter_donnees_securite(uuid)', 'execute')
     or has_function_privilege('anon', 'public.avatar_valide(uuid)', 'execute') then
    raise exception 'ÉCHEC RGP17 : fonction interne exécutable par l''API';
  end if;
  raise notice 'OK RGP17';
end;
$$;

rollback;
