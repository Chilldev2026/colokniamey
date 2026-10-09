-- Tests du module M4 (annonces). À exécuter après 0300, 0350, 0400, 0910, 0950, 0960, 0970 et seed.sql.
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
  v_e1 uuid := '00000000-0000-0000-0000-0000000c0001'; -- étudiant
  v_p1 uuid := '00000000-0000-0000-0000-0000000c0002'; -- propriétaire
  v_p2 uuid := '00000000-0000-0000-0000-0000000c0003'; -- autre propriétaire
  v_a1 uuid := '00000000-0000-0000-0000-0000000c0004'; -- admin
  v_sa1 uuid := '00000000-0000-0000-0000-0000000c00a1';
  v_s1 uuid := '00000000-0000-0000-0000-0000000c0005'; -- super-admin
  v_ss1 uuid := '00000000-0000-0000-0000-0000000c00a2';
  v_ann bigint;
  v_ann2 bigint;
  v_eq bigint;
  v_eq_off bigint;
  v_ph bigint[] := array[]::bigint[];
  v_id bigint;
  v_nb integer;
  v_msg text;
  v_rec record;
  v_centre extensions.geography;
  v_pos text;
  i integer;
begin
  select id into v_univ from public.universites order by id limit 1;
  select id, centre into v_ville, v_centre from public.villes where nom = 'Niamey';
  select valeur #>> '{}' into v_cgu from public.parametres where cle = 'version_cgu';
  insert into public.quartiers (nom, ville_id) values ('Quartier de test M4', v_ville) returning id into v_quartier;
  v_pos := 'SRID=4326;POINT(' || extensions.st_x(v_centre::extensions.geometry) || ' ' || extensions.st_y(v_centre::extensions.geometry) || ')';
  v_meta := jsonb_build_object('role', 'etudiant', 'nom', 'Nom', 'prenom', 'Prenom', 'telephone', '90112233',
                               'universite_id', v_univ::text, 'cgu_version', v_cgu);
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_e1, 'm41@test.local', v_meta),
    (v_p1, 'm42@test.local', jsonb_set(v_meta, '{role}', '"proprietaire"')),
    (v_p2, 'm43@test.local', jsonb_set(v_meta, '{role}', '"proprietaire"')),
    (v_a1, 'm44@test.local', v_meta), (v_s1, 'm45@test.local', v_meta);
  update public.profils set role = 'admin' where id = v_a1;
  update public.profils set role = 'super_admin' where id = v_s1;
  insert into public.sessions_admin (session_id, user_id) values (v_sa1, v_a1), (v_ss1, v_s1);
  insert into public.equipements (nom) values ('Climatisation M4'), ('Inactif M4');
  update public.equipements set actif = false where nom = 'Inactif M4';
  select id into v_eq from public.equipements where nom = 'Climatisation M4';
  select id into v_eq_off from public.equipements where nom = 'Inactif M4';
  -- 7 photos du propriétaire p1 (usage annonce), la dernière refusée
  for i in 1 .. 7 loop
    insert into public.photos (proprietaire_id, usage, chemin, empreinte, statut)
    values (v_p1, 'annonce', v_p1::text || '/ph' || i || '.webp', lpad(to_hex(i), 16, '0'), case when i = 7 then 'refusee' else 'validee' end)
    returning id into v_id;
    v_ph := v_ph || v_id;
  end loop;

  -- ===================================================================
  -- Création : RG13 (un étudiant ne publie pas un studio), RG14, RG16
  -- ===================================================================
  perform pg_temp.jeton(v_e1, 'aal1'); set local role authenticated;
  begin
    insert into public.annonces (auteur_id, titre, description, type, part_mensuelle_fcfa, quartier_id)
    values (v_e1, 'Studio à louer', 'Un joli studio calme près du campus.', 'studio', 50000, v_quartier);
    raise exception 'ÉCHEC RG13 : un étudiant crée un studio';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin
    insert into public.annonces (auteur_id, titre, description, type, nb_places, part_mensuelle_fcfa, loyer_total_fcfa, quartier_id)
    values (v_p1, 'Chez un autre', 'Une annonce créée au nom de quelqu''un d''autre.', 'place_colocation', 3, 30000, 90000, v_quartier);
    raise exception 'ÉCHEC RG14 : annonce au nom d''un autre';
  exception when insufficient_privilege or raise_exception or check_violation then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin
    insert into public.annonces (auteur_id, titre, description, type, nb_places, part_mensuelle_fcfa, quartier_id)
    values (v_e1, 'Place sans loyer total', 'Il manque le loyer total de la colocation.', 'place_colocation', 3, 30000, v_quartier);
    raise exception 'ÉCHEC RG28 : colocation sans loyer total';
  exception when check_violation then null; end;
  begin
    insert into public.annonces (auteur_id, titre, description, type, nb_places, part_mensuelle_fcfa, loyer_total_fcfa, quartier_id)
    values (v_e1, 'Loyer incohérent', 'Le loyer total est inférieur à la part mensuelle.', 'place_colocation', 3, 60000, 30000, v_quartier);
    raise exception 'ÉCHEC RG16 : loyer total inférieur à la part';
  exception when check_violation then null; end;
  begin
    insert into public.annonces (auteur_id, titre, description, type, nb_places, part_mensuelle_fcfa, loyer_total_fcfa, quartier_id)
    values (v_e1, 'Loyer nul ici', 'Une part mensuelle nulle est refusée par la base.', 'place_colocation', 3, 0, 90000, v_quartier);
    raise exception 'ÉCHEC RG16 : loyer nul';
  exception when check_violation then null; end;
  insert into public.annonces (auteur_id, titre, description, type, nb_places, part_mensuelle_fcfa, loyer_total_fcfa, quartier_id)
  values (v_e1, 'Place en colocation', 'Une place dans une colocation calme près du campus.', 'place_colocation', 3, 30000, 90000, v_quartier)
  returning id into v_ann2;
  reset role;

  perform pg_temp.jeton(v_p1, 'aal1'); set local role authenticated;
  begin
    insert into public.annonces (auteur_id, titre, description, type, part_mensuelle_fcfa, quartier_id)
    values (v_p1, 'Une place', 'Un propriétaire ne publie pas une place en colocation.', 'place_colocation', 50000, v_quartier);
    raise exception 'ÉCHEC RG13 : un propriétaire publie une place en colocation';
  exception when raise_exception or check_violation then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin
    insert into public.annonces (auteur_id, titre, description, type, part_mensuelle_fcfa, quartier_id, statut)
    values (v_p1, 'Publiée d''office', 'Impossible de fixer le statut soi-même.', 'studio', 50000, v_quartier, 'publiee');
    raise exception 'ÉCHEC : statut fixé à la création';
  exception when insufficient_privilege then null; end;
  insert into public.annonces (auteur_id, titre, description, type, part_mensuelle_fcfa, quartier_id, universite_proche_id, age_min, age_max)
  values (v_p1, 'Studio près du campus', 'Un studio calme et lumineux près du campus.', 'studio', 50000, v_quartier, v_univ, 18, 30)
  returning id into v_ann;
  begin
    update public.annonces set age_min = 40 where id = v_ann;
    raise exception 'ÉCHEC RG33 : âge minimum supérieur au maximum';
  exception when check_violation then null; end;
  begin
    update public.annonces set age_min = 10 where id = v_ann;
    raise exception 'ÉCHEC RG33 : âge hors de 16 à 99';
  exception when check_violation then null; end;
  begin
    update public.annonces set duree_min_mois = 12, duree_max_mois = 6 where id = v_ann;
    raise exception 'ÉCHEC RG33 : durée minimale supérieure à la maximale';
  exception when check_violation then null; end;
  reset role;
  raise notice 'OK RG13, RG14, RG16, RG28, RG33 : création et contrôles';

  -- ===================================================================
  -- RG21, RG22 : soumission sans position ou hors de la ville
  -- ===================================================================
  perform pg_temp.jeton(v_p1, 'aal1'); set local role authenticated;
  begin perform public.soumettre_annonce(v_ann); raise exception 'ÉCHEC RG21 : soumission sans position';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin
    update public.annonces set position = 'SRID=4326;POINT(0 0)' where id = v_ann;
    raise exception 'ÉCHEC RG22 : position hors de la ville';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  update public.annonces set position = v_pos::extensions.geography where id = v_ann;
  reset role;
  -- le brouillon ne peut pas être forcé en attente sans position (déclencheur, même hors fonction)
  begin
    update public.annonces set statut = 'en_attente', position = null where id = v_ann;
    raise exception 'ÉCHEC RG21 : statut en attente sans position';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;

  -- ===================================================================
  -- RG23 : la position exacte n'est jamais lisible
  -- ===================================================================
  select count(*) into v_nb from public.annonces where position is not null and id = v_ann;
  if v_nb <> 1 then raise exception 'ÉCHEC : position non enregistrée'; end if;
  perform pg_temp.jeton(v_p2, 'aal1'); set local role authenticated;
  begin perform position from public.annonces; raise exception 'ÉCHEC RG23 : position lisible par un connecté';
  exception when insufficient_privilege then null; end;
  begin perform * from public.annonces; raise exception 'ÉCHEC RG23 : select * accepté';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.position_annonce(v_ann)) <> 0 then raise exception 'ÉCHEC RG23 : position d''un autre lisible'; end if;
  reset role;
  set local role anon;
  begin perform position from public.annonces; raise exception 'ÉCHEC RG23 : position lisible par un visiteur';
  exception when insufficient_privilege then null; end;
  begin perform public.position_annonce(v_ann); raise exception 'ÉCHEC : visiteur appelle position_annonce';
  exception when insufficient_privilege then null; end;
  reset role;
  perform pg_temp.jeton(v_p1, 'aal1'); set local role authenticated;
  select * into v_rec from public.position_annonce(v_ann);
  if v_rec.latitude is null or v_rec.precision_position <> 'approximative' then raise exception 'ÉCHEC : l''auteur ne relit pas sa position'; end if;
  reset role;
  -- zone publique approximative : différente du point exact (au plus 120 m), exacte : identique
  if extensions.st_distance((select position_publique from public.annonces where id = v_ann), (select position from public.annonces where id = v_ann)) > 150 then
    raise exception 'ÉCHEC RG23 : zone approximative trop éloignée du point';
  end if;
  perform pg_temp.jeton(v_p1, 'aal1'); set local role authenticated;
  update public.annonces set position = extensions.st_setsrid(extensions.st_makepoint(2.12345, 13.51234), 4326)::extensions.geography where id = v_ann;
  reset role;
  if (select position_publique from public.annonces where id = v_ann) = (select position from public.annonces where id = v_ann) then
    raise exception 'ÉCHEC RG23 : le point exact est exposé en précision approximative';
  end if;
  perform pg_temp.jeton(v_p1, 'aal1'); set local role authenticated;
  update public.annonces set precision_position = 'exacte' where id = v_ann;
  reset role;
  if (select position_publique from public.annonces where id = v_ann) is distinct from (select position from public.annonces where id = v_ann) then
    raise exception 'ÉCHEC RG23 : précision exacte non respectée';
  end if;
  perform pg_temp.jeton(v_p1, 'aal1'); set local role authenticated;
  update public.annonces set precision_position = 'approximative' where id = v_ann;
  reset role;
  raise notice 'OK RG21, RG22, RG23 : position';

  -- ===================================================================
  -- RG18 : photos, sixième refusée (photos_max = 5)
  -- ===================================================================
  if (select (valeur #>> '{}')::integer from public.parametres where cle = 'photos_max') <> 5 then raise exception 'ÉCHEC : photos_max inattendu'; end if;
  perform pg_temp.jeton(v_p1, 'aal1'); set local role authenticated;
  for i in 1 .. 5 loop
    insert into public.photos_annonces (annonce_id, photo_id) values (v_ann, v_ph[i]);
  end loop;
  begin
    insert into public.photos_annonces (annonce_id, photo_id) values (v_ann, v_ph[6]);
    raise exception 'ÉCHEC RG18 : sixième photo acceptée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  delete from public.photos_annonces where photo_id = v_ph[5];
  perform pg_temp.jeton(v_p1, 'aal1'); set local role authenticated;
  begin
    insert into public.photos_annonces (annonce_id, photo_id) values (v_ann, v_ph[7]);
    raise exception 'ÉCHEC : photo refusée acceptée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  -- la photo d'un autre ne se rattache pas à mon annonce
  insert into public.photos (proprietaire_id, usage, chemin, empreinte, statut)
  values (v_e1, 'annonce', v_e1::text || '/x.webp', 'ffffffffffffff01', 'validee') returning id into v_id;
  perform pg_temp.jeton(v_p1, 'aal1'); set local role authenticated;
  begin
    insert into public.photos_annonces (annonce_id, photo_id) values (v_ann, v_id);
    raise exception 'ÉCHEC : photo d''un autre';
  exception when raise_exception or insufficient_privilege or others then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  raise notice 'OK RG18 : photos';

  -- ===================================================================
  -- Équipements, règles, tâches (RG29 à RG31)
  -- ===================================================================
  perform pg_temp.jeton(v_p1, 'aal1'); set local role authenticated;
  insert into public.annonce_equipements (annonce_id, equipement_id) values (v_ann, v_eq);
  begin
    insert into public.annonce_equipements (annonce_id, equipement_id) values (v_ann, v_eq_off);
    raise exception 'ÉCHEC RG29 : équipement inactif';
  exception when raise_exception or insufficient_privilege then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  for i in 1 .. 10 loop
    insert into public.regles_annonce (annonce_id, texte) values (v_ann, 'Règle numéro ' || i);
  end loop;
  begin
    insert into public.regles_annonce (annonce_id, texte) values (v_ann, 'Une onzième règle');
    raise exception 'ÉCHEC RG30 : onzième règle';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin
    insert into public.regles_annonce (annonce_id, texte) values (v_ann2, 'Sur l''annonce d''un autre');
    raise exception 'ÉCHEC : règle sur l''annonce d''un autre';
  exception when insufficient_privilege or raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  for i in 1 .. 15 loop
    insert into public.taches_annonce (annonce_id, libelle, frequence, repartition) values (v_ann, 'Tâche ' || i, 'hebdomadaire', 'tour_de_role');
  end loop;
  begin
    insert into public.taches_annonce (annonce_id, libelle, frequence, repartition) values (v_ann, 'Seizième', 'mensuelle', 'fixe');
    raise exception 'ÉCHEC RG31 : seizième tâche';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin
    insert into public.taches_annonce (annonce_id, libelle, frequence, repartition) values (v_ann, 'Mauvaise fréquence', 'jamais', 'fixe');
    raise exception 'ÉCHEC RG31 : fréquence libre';
  exception when check_violation or raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin
    insert into public.regles_annonce (annonce_id, texte) values (v_ann, repeat('x', 121));
    raise exception 'ÉCHEC RG30 : règle de plus de 120 caractères';
  exception when check_violation or raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  raise notice 'OK RG29, RG30, RG31';

  -- ===================================================================
  -- RG45 : un texte bloqué est refusé
  -- ===================================================================
  perform pg_temp.jeton(v_p1, 'aal1'); set local role authenticated;
  begin
    update public.annonces set description = 'Rencontre pour plan cul entre étudiants dans ce logement.' where id = v_ann;
    raise exception 'ÉCHEC RG45 : texte bloqué accepté';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin
    insert into public.regles_annonce (annonce_id, texte) select v_ann, 'je vais te tuer' where false;
    delete from public.regles_annonce where annonce_id = v_ann and ordre = 10;
    insert into public.regles_annonce (annonce_id, texte) values (v_ann, 'on va te tuer');
    raise exception 'ÉCHEC RG45 : règle bloquée acceptée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;

  -- ===================================================================
  -- RG17 : une annonce en attente est invisible du public ; publiée, elle est visible
  -- ===================================================================
  perform pg_temp.jeton(v_p1, 'aal1'); set local role authenticated;
  if public.soumettre_annonce(v_ann) <> 'en_attente' then raise exception 'ÉCHEC RG17 : soumission devrait passer en attente'; end if;
  reset role;
  if not exists (select 1 from public.notifications where destinataire_id = v_p1 and type = 'annonce_statut' and titre like '%en cours de vérification%') then
    raise exception 'ÉCHEC : auteur non notifié de la mise en attente';
  end if;
  set local role anon;
  select count(*) into v_nb from public.annonces where id = v_ann;
  if v_nb <> 0 then raise exception 'ÉCHEC RG17 : annonce en attente visible du public'; end if;
  select count(*) into v_nb from public.annonces_publiques where id = v_ann;
  if v_nb <> 0 then raise exception 'ÉCHEC RG17 : annonce en attente dans la vue publique'; end if;
  select count(*) into v_nb from public.regles_annonce where annonce_id = v_ann;
  if v_nb <> 0 then raise exception 'ÉCHEC : règles d''une annonce en attente visibles'; end if;
  begin perform public.contact_annonce(v_ann); raise exception 'ÉCHEC RG32 : visiteur appelle contact_annonce';
  exception when insufficient_privilege then null; end;
  reset role;
  -- un autre connecté ne la voit pas non plus, ni ne peut la modifier
  perform pg_temp.jeton(v_p2, 'aal1'); set local role authenticated;
  select count(*) into v_nb from public.annonces where id = v_ann;
  if v_nb <> 0 then raise exception 'ÉCHEC : annonce en attente visible d''un autre utilisateur'; end if;
  update public.annonces set titre = 'Titre piraté ici' where id = v_ann;
  get diagnostics v_nb = row_count;
  if v_nb <> 0 then raise exception 'ÉCHEC RG14 : modification par un autre'; end if;
  begin perform public.soumettre_annonce(v_ann); raise exception 'ÉCHEC : soumission par un autre';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.archiver_annonce(v_ann); raise exception 'ÉCHEC : archivage par un autre';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  -- l'auteur ne peut pas publier lui-même
  perform pg_temp.jeton(v_p1, 'aal1'); set local role authenticated;
  begin update public.annonces set statut = 'publiee' where id = v_ann; raise exception 'ÉCHEC : auteur publie lui-même';
  exception when insufficient_privilege then null; end;
  begin perform public.soumettre_annonce(v_ann); raise exception 'ÉCHEC : double soumission';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  -- l'admin la voit (A3)
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  select count(*) into v_nb from public.annonces where id = v_ann;
  if v_nb <> 1 then raise exception 'ÉCHEC : l''admin ne voit pas l''annonce en attente'; end if;
  reset role;
  raise notice 'OK RG17 : annonce en attente invisible';

  -- Publication (par un admin, comme le fera A3), puis visibilité publique et modification
  update public.annonces set statut = 'publiee', publiee_le = now() where id = v_ann;
  set local role anon;
  select * into v_rec from public.annonces_publiques where id = v_ann;
  if v_rec.id is null then raise exception 'ÉCHEC RG24 : annonce publiée absente de la vue publique'; end if;
  if v_rec.zone_rayon_m <> 150 or v_rec.latitude is null then raise exception 'ÉCHEC RG23 : zone publique'; end if;
  if v_rec.distance_universite_m is not null and (select position from public.universites where id = v_univ) is null then raise exception 'ÉCHEC RG25 bis : distance sans position'; end if;
  select count(*) into v_nb from public.photos_annonce(v_ann);
  if v_nb <> 4 then raise exception 'ÉCHEC : photos validées d''une annonce publiée (%)', v_nb; end if;
  select count(*) into v_nb from public.annonce_equipements where annonce_id = v_ann;
  if v_nb <> 1 then raise exception 'ÉCHEC : équipements d''une annonce publiée non lisibles'; end if;
  reset role;
  -- une photo en attente n'est pas publique
  update public.photos set statut = 'en_attente' where id = v_ph[1];
  set local role anon;
  select count(*) into v_nb from public.photos_annonce(v_ann);
  if v_nb <> 3 then raise exception 'ÉCHEC RG49 : photo en attente visible (%)', v_nb; end if;
  reset role;

  -- RG17 : modification d'une annonce publiée → en attente
  perform pg_temp.jeton(v_p1, 'aal1'); set local role authenticated;
  update public.annonces set part_mensuelle_fcfa = 55000 where id = v_ann;
  reset role;
  if (select statut from public.annonces where id = v_ann) <> 'en_attente' then raise exception 'ÉCHEC RG17 : modification sans retour en attente'; end if;
  update public.annonces set statut = 'publiee' where id = v_ann;
  perform pg_temp.jeton(v_p1, 'aal1'); set local role authenticated;
  delete from public.regles_annonce where annonce_id = v_ann and texte = 'Règle numéro 1';
  insert into public.regles_annonce (annonce_id, texte) values (v_ann, 'Pas de bruit après 22 h');
  reset role;
  if (select statut from public.annonces where id = v_ann) <> 'en_attente' then raise exception 'ÉCHEC RG17 : modification d''une règle sans retour en attente'; end if;
  -- si la validation est désactivée, la modification ne renvoie pas en attente
  update public.parametres set valeur = 'false'::jsonb where cle = 'validation_annonces';
  update public.annonces set statut = 'publiee' where id = v_ann;
  perform pg_temp.jeton(v_p1, 'aal1'); set local role authenticated;
  update public.annonces set part_mensuelle_fcfa = 56000 where id = v_ann;
  reset role;
  if (select statut from public.annonces where id = v_ann) <> 'publiee' then raise exception 'ÉCHEC RG17 : validation désactivée mais retour en attente'; end if;
  update public.parametres set valeur = 'true'::jsonb where cle = 'validation_annonces';
  raise notice 'OK RG17, RG24, RG25 bis, RG49 : publication et modification';

  -- ===================================================================
  -- RG32 : contact (connectés, numéros selon l'autorisation, quota)
  -- ===================================================================
  perform pg_temp.jeton(v_e1, 'aal1'); set local role authenticated;
  select * into v_rec from public.contact_annonce(v_ann);
  if v_rec.telephone is not null or v_rec.whatsapp is not null then raise exception 'ÉCHEC RG32 : numéro donné sans autorisation de l''auteur'; end if;
  reset role;
  update public.annonces set contact_appel = true, contact_whatsapp = true where id = v_ann;
  update public.annonces set statut = 'publiee' where id = v_ann; -- la modification l'a remise en attente (RG17)
  perform pg_temp.jeton(v_e1, 'aal1'); set local role authenticated;
  select * into v_rec from public.contact_annonce(v_ann);
  if v_rec.telephone <> '+22790112233' or v_rec.whatsapp <> '22790112233' then raise exception 'ÉCHEC RG32 : numéros % / %', v_rec.telephone, v_rec.whatsapp; end if;
  reset role;
  update public.annonces set contact_appel = false where id = v_ann;
  update public.annonces set statut = 'publiee' where id = v_ann;
  perform pg_temp.jeton(v_e1, 'aal1'); set local role authenticated;
  select * into v_rec from public.contact_annonce(v_ann);
  if v_rec.telephone is not null or v_rec.whatsapp is null then raise exception 'ÉCHEC RG32 : appel non autorisé mais numéro donné'; end if;
  -- quota : 30 consultations par jour (RGP20), déjà 3 faites
  for i in 1 .. 27 loop perform public.contact_annonce(v_ann); end loop;
  begin perform public.contact_annonce(v_ann); raise exception 'ÉCHEC RGP20 : trente et unième consultation acceptée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  raise notice 'OK RG32, RGP20 : contact';

  -- ===================================================================
  -- RG52 : place en colocation et identité vérifiée (avec kyc_actif = vrai)
  -- ===================================================================
  update public.parametres set valeur = 'true'::jsonb where cle = 'kyc_actif';
  update public.annonces set position = v_pos::extensions.geography where id = v_ann2;
  perform pg_temp.jeton(v_e1, 'aal1'); set local role authenticated;
  begin perform public.soumettre_annonce(v_ann2); raise exception 'ÉCHEC RG52 : place en colocation sans identité vérifiée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  update public.parametres set valeur = 'false'::jsonb where cle = 'kyc_actif';
  perform pg_temp.jeton(v_e1, 'aal1'); set local role authenticated;
  if public.soumettre_annonce(v_ann2) <> 'en_attente' then raise exception 'ÉCHEC RG59 : KYC désactivé, soumission refusée'; end if;
  reset role;
  raise notice 'OK RG52, RG59 : identité vérifiée';

  -- ===================================================================
  -- Archivage, réouverture, suppression
  -- ===================================================================
  perform pg_temp.jeton(v_p1, 'aal1'); set local role authenticated;
  perform public.archiver_annonce(v_ann);
  perform public.rouvrir_annonce(v_ann);
  reset role;
  if (select statut from public.annonces where id = v_ann) <> 'brouillon' then raise exception 'ÉCHEC : réouverture'; end if;
  -- refus : le motif est communiqué, et une modification repasse en brouillon
  update public.annonces set statut = 'refusee', motif_refus = 'Photos floues' where id = v_ann;
  if not exists (select 1 from public.notifications where destinataire_id = v_p1 and titre like '%refusée : Photos floues%') then
    raise exception 'ÉCHEC RGA11 : motif de refus non notifié';
  end if;
  perform pg_temp.jeton(v_p1, 'aal1'); set local role authenticated;
  update public.annonces set description = 'Un studio calme, avec de nouvelles photos nettes.' where id = v_ann;
  reset role;
  if (select statut from public.annonces where id = v_ann) <> 'brouillon' then raise exception 'ÉCHEC : annonce refusée corrigée non remise en brouillon'; end if;
  perform pg_temp.jeton(v_p2, 'aal1'); set local role authenticated;
  delete from public.annonces where id = v_ann;
  get diagnostics v_nb = row_count;
  if v_nb <> 0 then raise exception 'ÉCHEC : suppression par un autre'; end if;
  reset role;

  -- Référentiel : un quartier utilisé par une annonce ne se supprime pas (A5)
  begin
    delete from public.quartiers where id = v_quartier;
    raise exception 'ÉCHEC A5 : quartier utilisé supprimé';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;

  -- ===================================================================
  -- Export, compteurs, droits (RGP11, RGP17), maintenance (RGA16)
  -- ===================================================================
  perform pg_temp.jeton(v_p1, 'aal1'); set local role authenticated;
  if jsonb_array_length(public.exporter_mes_donnees() -> 'donnees' -> 'annonces' -> 'annonces') <> 1 then raise exception 'ÉCHEC RGP11 : annonces absentes de l''export'; end if;
  reset role;
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  if (public.fiche_utilisateur(v_p1) -> 'compteurs' ->> 'annonces')::integer <> 1 then raise exception 'ÉCHEC : compteur de la fiche'; end if;
  reset role;

  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  perform public.definir_maintenance(true, 'Test');
  reset role;
  perform pg_temp.jeton(v_p1, 'aal1'); set local role authenticated;
  begin
    insert into public.annonces (auteur_id, titre, description, type, part_mensuelle_fcfa, quartier_id)
    values (v_p1, 'En maintenance', 'Impossible de créer une annonce pendant une maintenance.', 'studio', 50000, v_quartier);
    raise exception 'ÉCHEC RGA16 : création pendant la maintenance';
  exception when insufficient_privilege or raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  perform public.definir_maintenance(false, '');
  reset role;

  if has_function_privilege('anon', 'public.soumettre_annonce(bigint)', 'execute')
     or has_function_privilege('anon', 'public.contact_annonce(bigint)', 'execute')
     or has_function_privilege('anon', 'public.position_annonce(bigint)', 'execute')
     or has_function_privilege('authenticated', 'public.verifier_annonce()', 'execute')
     or has_function_privilege('authenticated', 'public.exporter_donnees_annonces(uuid)', 'execute')
     or not has_function_privilege('anon', 'public.photos_annonce(bigint)', 'execute') then
    raise exception 'ÉCHEC RGP17 : droits d''exécution';
  end if;
  raise notice 'OK RGP11, RGP17, RGA16';
end;
$$;

rollback;
