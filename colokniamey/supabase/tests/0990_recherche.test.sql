-- Tests du module M5 (recherche, carte, favoris). À exécuter après 0970, 0971, 0980, 0990 et seed.sql.
-- Tout est annulé à la fin (rollback). Chaque échec lève une exception « ÉCHEC ».

begin;

create function pg_temp.jeton(p_uid uuid, p_aal text default 'aal1')
returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', p_uid, 'role', 'authenticated', 'aal', p_aal)::text, true);
$$;

do $$
declare
  v_univ bigint;
  v_ville bigint;
  v_q1 bigint;
  v_q2 bigint;
  v_cgu text;
  v_meta jsonb;
  v_centre extensions.geography;
  v_lng double precision;
  v_lat double precision;
  v_p1 uuid := '00000000-0000-0000-0000-0000000e0001'; -- propriétaire
  v_e1 uuid := '00000000-0000-0000-0000-0000000e0002'; -- étudiant
  v_e2 uuid := '00000000-0000-0000-0000-0000000e0003'; -- autre étudiant
  v_a1 bigint; -- publiée, approximative, chambre
  v_a2 bigint; -- publiée, exacte, studio, étudiants uniquement
  v_a3 bigint; -- en attente
  v_a4 bigint; -- brouillon
  v_a5 bigint; -- publiée, auteur suspendu
  v_p2 uuid := '00000000-0000-0000-0000-0000000e0004';
  v_eq bigint;
  v_nb integer;
  v_rec record;
  v_exact record;
  v_cur jsonb;
  v_ids bigint[];
begin
  select id into v_univ from public.universites order by id limit 1;
  select id, centre into v_ville, v_centre from public.villes where nom = 'Niamey';
  v_lng := extensions.st_x(v_centre::extensions.geometry);
  v_lat := extensions.st_y(v_centre::extensions.geometry);
  select valeur #>> '{}' into v_cgu from public.parametres where cle = 'version_cgu';
  insert into public.quartiers (nom, ville_id) values ('Quartier un M5', v_ville) returning id into v_q1;
  insert into public.quartiers (nom, ville_id) values ('Quartier deux M5', v_ville) returning id into v_q2;
  insert into public.equipements (nom) values ('Climatisation M5') returning id into v_eq;
  v_meta := jsonb_build_object('role', 'etudiant', 'nom', 'Nom', 'prenom', 'Prenom', 'telephone', '90112233',
                               'universite_id', v_univ::text, 'cgu_version', v_cgu);
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_p1, 'm51@test.local', jsonb_set(v_meta, '{role}', '"proprietaire"')),
    (v_p2, 'm54@test.local', jsonb_set(v_meta, '{role}', '"proprietaire"')),
    (v_e1, 'm52@test.local', v_meta), (v_e2, 'm53@test.local', v_meta);

  -- Annonces insérées par le propriétaire du schéma (les déclencheurs de M4 s'appliquent)
  insert into public.annonces (auteur_id, titre, description, type, part_mensuelle_fcfa, quartier_id, position, precision_position, statut, publiee_le, duree_min_mois, duree_max_mois, disponible_le)
  values (v_p1, 'Chambre lumineuse Plateau', 'Une chambre lumineuse et calme avec balcon.', 'chambre', 40000, v_q1,
          extensions.st_setsrid(extensions.st_makepoint(v_lng + 0.00123, v_lat + 0.00077), 4326)::extensions.geography, 'approximative', 'publiee', now() - interval '2 days', 3, 12, current_date + 10)
  returning id into v_a1;
  insert into public.annonces (auteur_id, titre, description, type, part_mensuelle_fcfa, quartier_id, position, precision_position, statut, publiee_le, etudiants_uniquement, universite_proche_id)
  values (v_p1, 'Studio moderne centre', 'Un studio moderne et sécurisé près du centre.', 'studio', 90000, v_q2,
          extensions.st_setsrid(extensions.st_makepoint(v_lng + 0.0100, v_lat + 0.0100), 4326)::extensions.geography, 'exacte', 'publiee', now() - interval '1 day', true, v_univ)
  returning id into v_a2;
  insert into public.annonces (auteur_id, titre, description, type, part_mensuelle_fcfa, quartier_id, position, statut)
  values (v_p1, 'Appartement en attente', 'Un grand appartement en attente de validation.', 'appartement', 150000, v_q1,
          extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography, 'en_attente')
  returning id into v_a3;
  insert into public.annonces (auteur_id, titre, description, type, part_mensuelle_fcfa, quartier_id)
  values (v_p1, 'Brouillon invisible', 'Un brouillon que personne ne doit voir.', 'chambre', 30000, v_q1)
  returning id into v_a4;
  insert into public.annonces (auteur_id, titre, description, type, part_mensuelle_fcfa, quartier_id, position, statut, publiee_le)
  values (v_p2, 'Chambre compte suspendu', 'Une chambre dont l''auteur est suspendu.', 'chambre', 35000, v_q1,
          extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography, 'publiee', now());
  select id into v_a5 from public.annonces where auteur_id = v_p2;
  update public.profils set statut = 'suspendu' where id = v_p2;
  insert into public.annonce_equipements (annonce_id, equipement_id) values (v_a1, v_eq);
  update public.annonces set statut = 'publiee' where id = v_a1; -- l'ajout d'un équipement l'a remise en attente (RG17)

  -- ===================================================================
  -- RG24 : seules les annonces publiées remontent, en liste comme sur la carte
  -- ===================================================================
  set local role anon;
  select array_agg(id order by id) into v_ids from public.rechercher_annonces('{}'::jsonb);
  if v_ids is distinct from array[v_a1, v_a2] then raise exception 'ÉCHEC RG24 : liste (%)', v_ids; end if;
  select array_agg(id order by id) into v_ids from public.annonces_carte(jsonb_build_object('sud', v_lat - 1, 'ouest', v_lng - 1, 'nord', v_lat + 1, 'est', v_lng + 1));
  if v_ids is distinct from array[v_a1, v_a2] then raise exception 'ÉCHEC RG24 : carte (%)', v_ids; end if;
  reset role;
  raise notice 'OK RG24 : annonces publiées seulement';

  -- ===================================================================
  -- RG23 : jamais la position exacte pour une annonce approximative
  -- ===================================================================
  set local role anon;
  select * into v_rec from public.rechercher_annonces('{}'::jsonb) where id = v_a1;
  reset role;
  if v_rec.zone_rayon_m <> 150 then raise exception 'ÉCHEC RG23 : rayon de la zone'; end if;
  if v_rec.latitude = v_lat + 0.00077 or v_rec.longitude = v_lng + 0.00123 then raise exception 'ÉCHEC RG23 : position exacte renvoyée par la liste'; end if;
  set local role anon;
  select * into v_rec from public.annonces_carte(jsonb_build_object('sud', v_lat - 1, 'ouest', v_lng - 1, 'nord', v_lat + 1, 'est', v_lng + 1)) where id = v_a1;
  reset role;
  if v_rec.latitude = v_lat + 0.00077 or v_rec.longitude = v_lng + 0.00123 then raise exception 'ÉCHEC RG23 : position exacte renvoyée par la carte'; end if;
  -- stable : même résultat à chaque appel
  set local role anon;
  select * into v_exact from public.annonces_carte(jsonb_build_object('sud', v_lat - 1, 'ouest', v_lng - 1, 'nord', v_lat + 1, 'est', v_lng + 1)) where id = v_a1;
  reset role;
  if v_exact.latitude <> v_rec.latitude or v_exact.longitude <> v_rec.longitude then raise exception 'ÉCHEC RG23 : position non stable'; end if;
  -- l'annonce à position exacte choisie par l'auteur : rayon 0
  set local role anon;
  select * into v_rec from public.annonces_carte(jsonb_build_object('sud', v_lat - 1, 'ouest', v_lng - 1, 'nord', v_lat + 1, 'est', v_lng + 1)) where id = v_a2;
  reset role;
  if v_rec.zone_rayon_m <> 0 then raise exception 'ÉCHEC RG23 : rayon d''une position exacte'; end if;
  -- la colonne position n'existe pas dans les résultats et reste illisible
  set local role anon;
  begin perform position from public.annonces; raise exception 'ÉCHEC RG23 : colonne position lisible';
  exception when insufficient_privilege then null; end;
  reset role;
  raise notice 'OK RG23 : position publique';

  -- ===================================================================
  -- Emprise de la carte
  -- ===================================================================
  set local role anon;
  select array_agg(id order by id) into v_ids from public.annonces_carte(jsonb_build_object('sud', v_lat - 0.005, 'ouest', v_lng - 0.005, 'nord', v_lat + 0.005, 'est', v_lng + 0.005));
  if v_ids is distinct from array[v_a1] then raise exception 'ÉCHEC : emprise réduite (%)', v_ids; end if;
  begin perform public.annonces_carte(jsonb_build_object('sud', 10, 'ouest', 0, 'nord', 5, 'est', 5)); raise exception 'ÉCHEC : emprise inversée acceptée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.annonces_carte('{}'::jsonb); raise exception 'ÉCHEC : emprise absente acceptée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;

  -- ===================================================================
  -- Filtres, seuls et combinés
  -- ===================================================================
  set local role anon;
  select count(*) into v_nb from public.rechercher_annonces(jsonb_build_object('type', 'studio'));
  if v_nb <> 1 then raise exception 'ÉCHEC filtre type (%)', v_nb; end if;
  select count(*) into v_nb from public.rechercher_annonces(jsonb_build_object('quartier_id', v_q1));
  if v_nb <> 1 then raise exception 'ÉCHEC filtre quartier (%)', v_nb; end if;
  select count(*) into v_nb from public.rechercher_annonces(jsonb_build_object('ville_id', v_ville));
  if v_nb <> 2 then raise exception 'ÉCHEC filtre ville (%)', v_nb; end if;
  select count(*) into v_nb from public.rechercher_annonces(jsonb_build_object('loyer_min', 50000));
  if v_nb <> 1 then raise exception 'ÉCHEC filtre loyer min (%)', v_nb; end if;
  select count(*) into v_nb from public.rechercher_annonces(jsonb_build_object('loyer_max', 50000));
  if v_nb <> 1 then raise exception 'ÉCHEC filtre loyer max (%)', v_nb; end if;
  select count(*) into v_nb from public.rechercher_annonces(jsonb_build_object('universite_id', v_univ));
  if v_nb <> 1 then raise exception 'ÉCHEC filtre université (%)', v_nb; end if;
  select count(*) into v_nb from public.rechercher_annonces(jsonb_build_object('texte', 'lumineuse balcon'));
  if v_nb <> 1 then raise exception 'ÉCHEC texte libre (%)', v_nb; end if;
  select count(*) into v_nb from public.rechercher_annonces(jsonb_build_object('texte', 'chambres'));
  if v_nb < 1 then raise exception 'ÉCHEC texte libre : pluriel français (%)', v_nb; end if;
  select count(*) into v_nb from public.rechercher_annonces(jsonb_build_object('texte', 'introuvableailleurs'));
  if v_nb <> 0 then raise exception 'ÉCHEC texte libre sans résultat'; end if;
  select count(*) into v_nb from public.rechercher_annonces(jsonb_build_object('equipements', jsonb_build_array(v_eq)));
  if v_nb <> 1 then raise exception 'ÉCHEC filtre équipement (%)', v_nb; end if;
  select count(*) into v_nb from public.rechercher_annonces(jsonb_build_object('equipements', jsonb_build_array(v_eq, v_eq + 1000)));
  if v_nb <> 0 then raise exception 'ÉCHEC équipements : tous requis (%)', v_nb; end if;
  select count(*) into v_nb from public.rechercher_annonces(jsonb_build_object('duree_mois', 6));
  if v_nb <> 2 then raise exception 'ÉCHEC durée compatible (%)', v_nb; end if;
  select count(*) into v_nb from public.rechercher_annonces(jsonb_build_object('duree_mois', 24));
  if v_nb <> 1 then raise exception 'ÉCHEC durée trop longue (%)', v_nb; end if;
  select count(*) into v_nb from public.rechercher_annonces(jsonb_build_object('disponible_avant', current_date + 1));
  if v_nb <> 1 then raise exception 'ÉCHEC disponibilité (%)', v_nb; end if;
  -- combinés
  select count(*) into v_nb from public.rechercher_annonces(jsonb_build_object('type', 'chambre', 'loyer_max', 45000, 'quartier_id', v_q1, 'texte', 'balcon', 'duree_mois', 6));
  if v_nb <> 1 then raise exception 'ÉCHEC filtres combinés (%)', v_nb; end if;
  select count(*) into v_nb from public.rechercher_annonces(jsonb_build_object('type', 'chambre', 'loyer_min', 50000));
  if v_nb <> 0 then raise exception 'ÉCHEC filtres combinés incompatibles (%)', v_nb; end if;
  -- annonces compatibles : « étudiants uniquement » caché à un visiteur, montré à un étudiant
  select count(*) into v_nb from public.rechercher_annonces(jsonb_build_object('compatible', true));
  if v_nb <> 1 then raise exception 'ÉCHEC compatibilité (visiteur) (%)', v_nb; end if;
  reset role;
  perform pg_temp.jeton(v_e1); set local role authenticated;
  select count(*) into v_nb from public.rechercher_annonces(jsonb_build_object('compatible', true));
  if v_nb <> 2 then raise exception 'ÉCHEC compatibilité (étudiant) (%)', v_nb; end if;
  reset role;
  -- erreurs de forme
  set local role anon;
  begin perform public.rechercher_annonces('[]'::jsonb); raise exception 'ÉCHEC : filtres non objet acceptés';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.rechercher_annonces('{}'::jsonb, 'au_hasard'); raise exception 'ÉCHEC : tri inconnu accepté';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  raise notice 'OK : filtres simples et combinés';

  -- ===================================================================
  -- Distance à l'université de référence (RG25, RG25 bis)
  -- ===================================================================
  update public.universites set position = null where id = v_univ;
  set local role anon;
  select * into v_rec from public.rechercher_annonces(jsonb_build_object('universite_ref_id', v_univ)) where id = v_a1;
  reset role;
  if v_rec.distance_ref_m is not null then raise exception 'ÉCHEC RG25 bis : distance sans position de l''université'; end if;
  update public.universites set position = v_centre where id = v_univ;
  set local role anon;
  select * into v_rec from public.rechercher_annonces(jsonb_build_object('universite_ref_id', v_univ)) where id = v_a1;
  reset role;
  if v_rec.distance_ref_m is null or v_rec.distance_ref_m > 400 or v_rec.distance_ref_m % 10 <> 0 then raise exception 'ÉCHEC RG25 : distance (%)', v_rec.distance_ref_m; end if;
  raise notice 'OK RG25 : distances';

  -- ===================================================================
  -- Tri et pagination par curseur
  -- ===================================================================
  set local role anon;
  select array_agg(id order by ordre) into v_ids from (select id, row_number() over () as ordre from public.rechercher_annonces('{}'::jsonb, 'loyer_asc')) t;
  if v_ids is distinct from array[v_a1, v_a2] then raise exception 'ÉCHEC tri loyer croissant (%)', v_ids; end if;
  select array_agg(id order by ordre) into v_ids from (select id, row_number() over () as ordre from public.rechercher_annonces('{}'::jsonb, 'loyer_desc')) t;
  if v_ids is distinct from array[v_a2, v_a1] then raise exception 'ÉCHEC tri loyer décroissant (%)', v_ids; end if;
  -- récent : la plus récente d'abord (a2), puis a1 ; pages d'une annonce
  select * into v_rec from public.rechercher_annonces('{}'::jsonb, 'recent', null, 1);
  if v_rec.id <> v_a2 then raise exception 'ÉCHEC tri récent (%)', v_rec.id; end if;
  v_cur := jsonb_build_object('v', v_rec.curseur_valeur, 'id', v_rec.id);
  select * into v_rec from public.rechercher_annonces('{}'::jsonb, 'recent', v_cur, 1);
  if v_rec.id <> v_a1 then raise exception 'ÉCHEC curseur récent (%)', v_rec.id; end if;
  v_cur := jsonb_build_object('v', v_rec.curseur_valeur, 'id', v_rec.id);
  select count(*) into v_nb from public.rechercher_annonces('{}'::jsonb, 'recent', v_cur, 1);
  if v_nb <> 0 then raise exception 'ÉCHEC fin de la pagination (%)', v_nb; end if;
  -- curseur par loyer
  select * into v_rec from public.rechercher_annonces('{}'::jsonb, 'loyer_asc', null, 1);
  v_cur := jsonb_build_object('v', v_rec.curseur_valeur, 'id', v_rec.id);
  select * into v_rec from public.rechercher_annonces('{}'::jsonb, 'loyer_asc', v_cur, 1);
  if v_rec.id <> v_a2 then raise exception 'ÉCHEC curseur loyer (%)', v_rec.id; end if;
  -- limite bornée
  select count(*) into v_nb from public.rechercher_annonces('{}'::jsonb, 'recent', null, 100000);
  if v_nb <> 2 then raise exception 'ÉCHEC limite'; end if;
  reset role;
  raise notice 'OK : tri et curseur';

  -- ===================================================================
  -- Favoris : visibles de leur seul propriétaire
  -- ===================================================================
  perform pg_temp.jeton(v_e1); set local role authenticated;
  insert into public.favoris (annonce_id) values (v_a1);
  begin insert into public.favoris (annonce_id) values (v_a1); raise exception 'ÉCHEC : favori en double';
  exception when unique_violation then null; end;
  begin insert into public.favoris (annonce_id) values (v_a3); raise exception 'ÉCHEC : favori sur une annonce en attente';
  exception when insufficient_privilege or raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin insert into public.favoris (user_id, annonce_id) values (v_e2, v_a2); raise exception 'ÉCHEC : favori au nom d''un autre';
  exception when insufficient_privilege then null; end;
  insert into public.favoris (annonce_id) values (v_a2);
  select count(*) into v_nb from public.favoris;
  if v_nb <> 2 then raise exception 'ÉCHEC : mes favoris (%)', v_nb; end if;
  if (select count(*) from public.mes_favoris()) <> 2 then raise exception 'ÉCHEC : mes_favoris'; end if;
  reset role;

  perform pg_temp.jeton(v_e2); set local role authenticated;
  select count(*) into v_nb from public.favoris;
  if v_nb <> 0 then raise exception 'ÉCHEC : favoris d''un autre visibles (%)', v_nb; end if;
  delete from public.favoris;
  get diagnostics v_nb = row_count;
  if v_nb <> 0 then raise exception 'ÉCHEC : suppression des favoris d''un autre'; end if;
  if (select count(*) from public.mes_favoris()) <> 0 then raise exception 'ÉCHEC : mes_favoris d''un autre'; end if;
  reset role;

  set local role anon;
  begin perform public.mes_favoris(); raise exception 'ÉCHEC : visiteur appelle mes_favoris';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from public.favoris; raise exception 'ÉCHEC : visiteur lit les favoris';
  exception when insufficient_privilege then null; end;
  reset role;

  -- un favori dont l'annonce n'est plus publique est masqué, puis le favori est supprimé avec l'annonce
  update public.annonces set statut = 'archivee' where id = v_a2;
  perform pg_temp.jeton(v_e1); set local role authenticated;
  if (select count(*) from public.mes_favoris()) <> 1 then raise exception 'ÉCHEC : favori d''une annonce archivée visible'; end if;
  reset role;
  delete from public.annonces where id = v_a2;
  if exists (select 1 from public.favoris where annonce_id = v_a2) then raise exception 'ÉCHEC : favori orphelin'; end if;

  -- export des données
  perform pg_temp.jeton(v_e1); set local role authenticated;
  if jsonb_array_length(public.exporter_mes_donnees() -> 'donnees' -> 'recherche' -> 'favoris') <> 1 then raise exception 'ÉCHEC RGP11 : favoris absents de l''export'; end if;
  reset role;
  raise notice 'OK : favoris';

  -- ===================================================================
  -- RGP17
  -- ===================================================================
  if has_function_privilege('anon', 'public.mes_favoris()', 'execute')
     or has_function_privilege('anon', 'public.limiter_favoris()', 'execute')
     or has_function_privilege('authenticated', 'public.exporter_donnees_recherche(uuid)', 'execute')
     or not has_function_privilege('anon', 'public.rechercher_annonces(jsonb,text,jsonb,integer)', 'execute')
     or not has_function_privilege('anon', 'public.annonces_carte(jsonb,jsonb,integer)', 'execute') then
    raise exception 'ÉCHEC RGP17 : droits d''exécution';
  end if;
  raise notice 'OK RGP17';
end;
$$;

rollback;
