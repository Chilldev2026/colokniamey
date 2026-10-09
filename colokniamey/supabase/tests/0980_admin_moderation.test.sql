-- Tests du module A3 (modération). À exécuter après 0300, 0350, 0910, 0950, 0960, 0970, 0971, 0980 et seed.sql.
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
  v_ville bigint;
  v_quartier bigint;
  v_cgu text;
  v_meta jsonb;
  v_centre extensions.geography;
  v_pos text;
  v_p1 uuid := '00000000-0000-0000-0000-0000000d0001'; -- propriétaire
  v_e1 uuid := '00000000-0000-0000-0000-0000000d0002'; -- étudiant
  v_a1 uuid := '00000000-0000-0000-0000-0000000d0003'; -- admin
  v_a2 uuid := '00000000-0000-0000-0000-0000000d0004'; -- autre admin
  v_s1 uuid := '00000000-0000-0000-0000-0000000d0005'; -- super-admin
  v_sa1 uuid := '00000000-0000-0000-0000-0000000d00a1';
  v_sa2 uuid := '00000000-0000-0000-0000-0000000d00a2';
  v_ss1 uuid := '00000000-0000-0000-0000-0000000d00a3';
  v_ann bigint;
  v_ann2 bigint;
  v_ph bigint;
  v_terme bigint;
  v_terme2 bigint;
  v_c bigint;
  v_nb integer;
  v_rec record;
  v_json jsonb;
  v_texte text;
begin
  select id into v_univ from public.universites order by id limit 1;
  select id, centre into v_ville, v_centre from public.villes where nom = 'Niamey';
  select valeur #>> '{}' into v_cgu from public.parametres where cle = 'version_cgu';
  insert into public.quartiers (nom, ville_id) values ('Quartier de test A3', v_ville) returning id into v_quartier;
  v_pos := 'SRID=4326;POINT(' || extensions.st_x(v_centre::extensions.geometry) || ' ' || extensions.st_y(v_centre::extensions.geometry) || ')';
  v_meta := jsonb_build_object('role', 'etudiant', 'nom', 'Nom', 'prenom', 'Prenom', 'telephone', '90112233',
                               'universite_id', v_univ::text, 'cgu_version', v_cgu);
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_p1, 'a31@test.local', jsonb_set(v_meta, '{role}', '"proprietaire"')),
    (v_e1, 'a32@test.local', v_meta), (v_a1, 'a33@test.local', v_meta), (v_a2, 'a34@test.local', v_meta), (v_s1, 'a35@test.local', v_meta);
  update public.profils set role = 'admin' where id in (v_a1, v_a2);
  update public.profils set role = 'super_admin' where id = v_s1;
  insert into public.sessions_admin (session_id, user_id) values (v_sa1, v_a1), (v_sa2, v_a2), (v_ss1, v_s1);

  -- Une annonce soumise par le propriétaire (en attente de modération) et une photo en attente
  perform pg_temp.jeton(v_p1, 'aal1'); set local role authenticated;
  insert into public.annonces (auteur_id, titre, description, type, part_mensuelle_fcfa, quartier_id, position)
  values (v_p1, 'Studio près du campus', 'Un studio calme et lumineux près du campus.', 'studio', 50000, v_quartier, v_pos::extensions.geography)
  returning id into v_ann;
  reset role;
  insert into public.photos (proprietaire_id, usage, chemin, empreinte, statut, suspecte)
  values (v_p1, 'annonce', v_p1::text || '/a3.webp', 'abababababababab', 'en_attente', true) returning id into v_ph;
  perform pg_temp.jeton(v_p1, 'aal1'); set local role authenticated;
  insert into public.photos_annonces (annonce_id, photo_id) values (v_ann, v_ph);
  perform public.soumettre_annonce(v_ann);
  reset role;

  -- ===================================================================
  -- Droits : un étudiant, un propriétaire, un visiteur ou un admin sans aal2 ne modèrent pas (RGA04, RGA27)
  -- ===================================================================
  perform pg_temp.jeton(v_e1, 'aal1'); set local role authenticated;
  begin perform public.valider_annonce(v_ann); raise exception 'ÉCHEC : un étudiant valide une annonce';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.liste_annonces_a_valider(); raise exception 'ÉCHEC : un étudiant liste les annonces à valider';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.proposer_terme('zzterme', 'sexuel', 'revue'); raise exception 'ÉCHEC : un étudiant propose un terme';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  select count(*) into v_nb from public.photos where id = v_ph;
  if v_nb <> 0 then raise exception 'ÉCHEC : un étudiant lit la photo d''un autre'; end if;
  reset role;
  perform pg_temp.jeton(v_p1, 'aal1'); set local role authenticated;
  begin perform public.valider_annonce(v_ann); raise exception 'ÉCHEC : l''auteur valide sa propre annonce';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  set local role anon;
  begin perform public.valider_annonce(v_ann); raise exception 'ÉCHEC : un visiteur valide une annonce';
  exception when insufficient_privilege then null; end;
  begin perform public.liste_termes(); raise exception 'ÉCHEC : un visiteur liste les termes';
  exception when insufficient_privilege then null; end;
  reset role;
  perform pg_temp.jeton(v_a1, 'aal1', v_sa1); set local role authenticated;
  begin perform public.valider_annonce(v_ann); raise exception 'ÉCHEC RGA04 : validation sans aal2';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.liste_photos_a_valider(); raise exception 'ÉCHEC RGA04 : liste des photos sans aal2';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  raise notice 'OK RGA04, RGA27 : droits';

  -- ===================================================================
  -- Files (RGA29)
  -- ===================================================================
  if (select count(*) from public.files_admin where nom in ('annonces', 'photos', 'contenus')) <> 3 then raise exception 'ÉCHEC : files non inscrites'; end if;
  if (select nombre from public.file_annonces) <> 1 or (select nombre from public.file_photos) <> 1 then raise exception 'ÉCHEC : compteurs des files'; end if;
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  if not exists (select 1 from public.etat_files_admin() where nom = 'annonces' and nombre = 1) then raise exception 'ÉCHEC : etat_files_admin'; end if;

  -- Aperçu, photos et annonces en attente
  select * into v_rec from public.liste_annonces_a_valider() where id = v_ann;
  if v_rec.id is null or v_rec.prenom <> 'Prenom' or v_rec.initiale_nom <> 'N' then raise exception 'ÉCHEC : liste des annonces à valider'; end if;
  v_json := public.annonce_a_moderer(v_ann);
  if v_json ->> 'titre' <> 'Studio près du campus' or v_json -> 'latitude' is null or v_json ? 'position' or v_json ? 'telephone'
     or jsonb_array_length(v_json -> 'photos') <> 1 or v_json -> 'auteur' ->> 'prenom' <> 'Prenom' then
    raise exception 'ÉCHEC : aperçu de la modération (%)', v_json;
  end if;
  select * into v_rec from public.liste_photos_a_valider() where id = v_ph;
  if v_rec.id is null or not v_rec.suspecte then raise exception 'ÉCHEC RG50 : photo suspecte non signalée'; end if;
  select count(*) into v_nb from public.photos where id = v_ph;
  if v_nb <> 1 then raise exception 'ÉCHEC : l''admin ne lit pas les photos'; end if;
  reset role;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'photos_attente_lecture_admin') then
    raise exception 'ÉCHEC : politique Storage de lecture admin';
  end if;
  raise notice 'OK RGA29 : files et aperçus';

  -- ===================================================================
  -- RGA11 : refus sans motif impossible ; validation visible dans la vue publique
  -- ===================================================================
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  begin perform public.refuser_annonce(v_ann, null); raise exception 'ÉCHEC RGA11 : refus sans motif';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.refuser_annonce(v_ann, '   '); raise exception 'ÉCHEC RGA11 : refus avec motif vide';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.refuser_annonce(v_ann, 'ab'); raise exception 'ÉCHEC RGA11 : motif trop court';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.retirer_annonce(v_ann, 'Motif suffisant'); raise exception 'ÉCHEC : retrait d''une annonce non publiée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  if (select statut from public.annonces where id = v_ann) <> 'en_attente' then raise exception 'ÉCHEC : annonce modifiée par un refus invalide'; end if;
  perform public.refuser_annonce(v_ann, 'Les photos sont floues');
  reset role;
  if (select statut from public.annonces where id = v_ann) <> 'refusee' then raise exception 'ÉCHEC : annonce non refusée'; end if;
  if not exists (select 1 from public.notifications where destinataire_id = v_p1 and titre like '%refusée : Les photos sont floues%') then
    raise exception 'ÉCHEC RGA11 : motif non notifié';
  end if;
  if not exists (select 1 from public.journal_audit where action = 'annonce_refusee' and cible_id = v_ann::text and acteur_id = v_a1) then
    raise exception 'ÉCHEC RGA06 : refus non journalisé';
  end if;
  -- l'auteur corrige et soumet de nouveau
  perform pg_temp.jeton(v_p1, 'aal1'); set local role authenticated;
  update public.annonces set description = 'Un studio calme et lumineux, avec de nouvelles photos.' where id = v_ann;
  perform public.soumettre_annonce(v_ann);
  reset role;
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  perform public.valider_annonce(v_ann);
  begin perform public.valider_annonce(v_ann); raise exception 'ÉCHEC : deuxième validation';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  set local role anon;
  select count(*) into v_nb from public.annonces_publiques where id = v_ann;
  if v_nb <> 1 then raise exception 'ÉCHEC : annonce validée absente de la vue publique (recherche)'; end if;
  reset role;
  if not exists (select 1 from public.notifications where destinataire_id = v_p1 and titre like '%est publiée%') then raise exception 'ÉCHEC : auteur non notifié de la publication'; end if;

  -- retrait d'une annonce publiée : motif obligatoire, notifié
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  begin perform public.retirer_annonce(v_ann, null); raise exception 'ÉCHEC RGA11 : retrait sans motif';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  perform public.retirer_annonce(v_ann, 'Annonce signalée comme trompeuse');
  reset role;
  set local role anon;
  select count(*) into v_nb from public.annonces_publiques where id = v_ann;
  if v_nb <> 0 then raise exception 'ÉCHEC : annonce retirée encore publique'; end if;
  reset role;
  if not exists (select 1 from public.notifications where destinataire_id = v_p1 and titre like '%trompeuse%') then raise exception 'ÉCHEC RGA11 : retrait non notifié'; end if;
  raise notice 'OK RGA11 : refus, validation et retrait';

  -- ===================================================================
  -- Compte suspendu : annonces invisibles du public, mais modérables (0971)
  -- ===================================================================
  update public.annonces set statut = 'publiee' where id = v_ann;
  update public.profils set statut = 'suspendu' where id = v_p1;
  set local role anon;
  select count(*) into v_nb from public.annonces_publiques where id = v_ann;
  if v_nb <> 0 then raise exception 'ÉCHEC RG08 : annonce d''un compte suspendu visible'; end if;
  select count(*) into v_nb from public.photos_annonce(v_ann);
  if v_nb <> 0 then raise exception 'ÉCHEC RG08 : photos d''un compte suspendu visibles'; end if;
  reset role;
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  perform public.retirer_annonce(v_ann, 'Compte suspendu pour fraude');
  reset role;
  update public.profils set statut = 'actif' where id = v_p1;
  raise notice 'OK RG08 : compte suspendu';

  -- ===================================================================
  -- RG45 : contenus mis en revue
  -- ===================================================================
  perform pg_temp.jeton(v_p1, 'aal1'); set local role authenticated;
  insert into public.annonces (auteur_id, titre, description, type, part_mensuelle_fcfa, quartier_id, position)
  values (v_p1, 'Chambre erotique', 'Une chambre avec une ambiance erotique assumée, calme.', 'chambre', 40000, v_quartier, v_pos::extensions.geography)
  returning id into v_ann2;
  perform public.soumettre_annonce(v_ann2);
  reset role;
  if not (select en_revue from public.annonces where id = v_ann2) then raise exception 'ÉCHEC S : annonce non mise en revue'; end if;
  select id into v_c from public.contenus_en_revue where type_contenu = 'annonce' and contenu_id = v_ann2::text and statut = 'en_attente';
  if v_c is null then raise exception 'ÉCHEC S : contenu non enregistré en revue'; end if;
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  begin perform public.valider_annonce(v_ann2); raise exception 'ÉCHEC RG45 : validation d''une annonce en revue';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  select count(*) into v_nb from public.liste_contenus_a_verifier() where id = v_c;
  if v_nb <> 1 then raise exception 'ÉCHEC : contenu absent de la file'; end if;
  v_json := public.contenu_a_verifier(v_c);
  if v_json -> 0 ->> 'valeur' not like '%erotique%' then raise exception 'ÉCHEC : texte en contexte'; end if;
  begin perform public.decider_contenu(v_c, false, null); raise exception 'ÉCHEC RGA11 : refus de contenu sans motif';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  perform public.decider_contenu(v_c, true);
  begin perform public.decider_contenu(v_c, true); raise exception 'ÉCHEC : contenu traité deux fois';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  perform public.valider_annonce(v_ann2);
  reset role;
  if (select en_revue from public.annonces where id = v_ann2) or (select statut from public.annonces where id = v_ann2) <> 'publiee' then
    raise exception 'ÉCHEC : annonce publiée après revue';
  end if;
  -- refus d'un contenu de profil
  insert into public.profils_complements (user_id, profession, centres_interet) values (v_e1, 'Étudiant', array['sport']);
  update public.profils_complements set en_revue = true where user_id = v_e1;
  insert into public.contenus_en_revue (type_contenu, contenu_id, auteur_id, raison) values ('profil', v_e1::text, v_e1, 'Test') returning id into v_c;
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  perform public.decider_contenu(v_c, false, 'Contenu inapproprié');
  reset role;
  if (select profession from public.profils_complements where user_id = v_e1) is not null or (select en_revue from public.profils_complements where user_id = v_e1) then
    raise exception 'ÉCHEC : profil non nettoyé après refus';
  end if;
  if not exists (select 1 from public.notifications where destinataire_id = v_e1 and type = 'contenu_refuse') then raise exception 'ÉCHEC : auteur non notifié du refus de contenu'; end if;
  raise notice 'OK RG45 : contenus en revue';

  -- ===================================================================
  -- RG47 : alertes de récidive
  -- ===================================================================
  insert into public.violations (auteur_id, categories, contexte) values (v_e1, '{sexuel}', 'public'), (v_e1, '{sexuel}', 'public'), (v_e1, '{haine}', 'public'),
    (v_p1, '{sexuel}', 'public');
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  select * into v_rec from public.liste_recidives();
  if v_rec.user_id is distinct from v_e1 or v_rec.nombre <> 3 then raise exception 'ÉCHEC RG47 : récidive (%)', v_rec; end if;
  select count(*) into v_nb from public.liste_recidives();
  if v_nb <> 1 then raise exception 'ÉCHEC RG47 : un seul blocage ne doit pas apparaître'; end if;
  reset role;

  -- ===================================================================
  -- RGA28 : termes sensibles
  -- ===================================================================
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  v_terme := public.proposer_terme('zzmotinterdit', 'violence', 'blocage', 'ha');
  reset role;
  if (select valide from public.termes_sensibles where id = v_terme) then raise exception 'ÉCHEC RGA28 : terme d''un admin validé d''office'; end if;
  if not exists (select 1 from public.notifications where destinataire_id = v_s1 and type = 'terme_a_valider') then raise exception 'ÉCHEC : super-admin non prévenu'; end if;
  if exists (select 1 from public.notifications where type = 'terme_a_valider' and titre like '%zzmotinterdit%') then raise exception 'ÉCHEC RGA33 : terme dans la notification'; end if;
  -- non détecté tant qu'il n'est pas validé
  perform pg_temp.jeton(v_e1, 'aal1'); set local role authenticated;
  if public.controler_texte('il y a un zzmotinterdit ici') <> 'accepte' then raise exception 'ÉCHEC RGA28 : terme non validé détecté'; end if;
  reset role;
  -- un admin ne valide, ne modifie, ne désactive ni ne rejette
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  begin perform public.valider_terme(v_terme); raise exception 'ÉCHEC RGA28 : un admin valide un terme';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.modifier_terme(v_terme, 'autre', 'haine', 'revue', 'fr'); raise exception 'ÉCHEC : un admin modifie un terme';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.definir_terme_actif(v_terme, false); raise exception 'ÉCHEC : un admin désactive un terme';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.rejeter_terme(v_terme); raise exception 'ÉCHEC : un admin rejette un terme';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  select count(*) into v_nb from public.liste_termes();
  if v_nb <> 1 then raise exception 'ÉCHEC : un admin doit voir seulement ses propositions (%)', v_nb; end if;
  reset role;
  perform pg_temp.jeton(v_a2, 'aal2', v_sa2); set local role authenticated;
  select count(*) into v_nb from public.liste_termes();
  if v_nb <> 0 then raise exception 'ÉCHEC : un admin voit les propositions d''un autre (%)', v_nb; end if;
  begin perform public.proposer_terme('x', 'sexuel', 'revue'); raise exception 'ÉCHEC : terme trop court accepté';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.proposer_terme('zzmotinterdit', 'violence', 'blocage'); raise exception 'ÉCHEC : doublon accepté';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  -- le super-admin valide : le terme est détecté
  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  select count(*) into v_nb from public.liste_termes();
  if v_nb < 50 then raise exception 'ÉCHEC : le super-admin ne voit pas toute la liste (%)', v_nb; end if;
  perform public.valider_terme(v_terme);
  reset role;
  perform pg_temp.jeton(v_e1, 'aal1'); set local role authenticated;
  if public.controler_texte('il y a un zzmotinterdit ici') <> 'bloque' then raise exception 'ÉCHEC RGA28 : terme validé non détecté'; end if;
  reset role;
  -- désactivation, réactivation, modification, proposition d'un super-admin (validée d'office), rejet
  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  perform public.definir_terme_actif(v_terme, false);
  reset role;
  perform pg_temp.jeton(v_e1, 'aal1'); set local role authenticated;
  if public.controler_texte('il y a un zzmotinterdit ici') <> 'accepte' then raise exception 'ÉCHEC : terme désactivé encore détecté'; end if;
  reset role;
  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  perform public.definir_terme_actif(v_terme, true);
  perform public.modifier_terme(v_terme, 'zzmotmodifie', 'menace', 'revue', 'ha');
  v_terme2 := public.proposer_terme('zzmotsuper', 'haine', 'revue');
  reset role;
  if not (select valide from public.termes_sensibles where id = v_terme2) then raise exception 'ÉCHEC : terme du super-admin non validé d''office'; end if;
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  v_terme2 := public.proposer_terme('zzmotrejete', 'haine', 'revue');
  reset role;
  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  perform public.rejeter_terme(v_terme2);
  begin perform public.rejeter_terme(v_terme); raise exception 'ÉCHEC : rejet d''un terme validé';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  if exists (select 1 from public.journal_audit where action like 'terme_%' and details::text ~ 'zzmot') then raise exception 'ÉCHEC : terme dans le journal'; end if;
  raise notice 'OK RGA28 : termes sensibles';

  -- ===================================================================
  -- RGP17 : droits d'exécution
  -- ===================================================================
  if has_function_privilege('anon', 'public.valider_annonce(bigint)', 'execute')
     or has_function_privilege('anon', 'public.proposer_terme(text,text,text,text)', 'execute')
     or has_function_privilege('authenticated', 'public.motif_moderation(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.decider_contenu(bigint,boolean,text)', 'execute') then
    raise exception 'ÉCHEC RGP17 : droits d''exécution';
  end if;
  raise notice 'OK RGP17';
end;
$$;

rollback;
