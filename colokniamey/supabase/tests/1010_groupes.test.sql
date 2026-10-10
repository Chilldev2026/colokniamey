-- Tests du module M8 (groupes de colocation). À exécuter après 0960, 0970, 0990, 1010, 1011 et seed.sql.
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
  v_quartier bigint;
  v_cgu text;
  v_meta jsonb;
  v_centre extensions.geography;
  v_p1 uuid := '00000000-0000-0000-0000-0000000a8001'; -- propriétaire
  v_e1 uuid := '00000000-0000-0000-0000-0000000a8002'; -- initiateur
  v_e2 uuid := '00000000-0000-0000-0000-0000000a8003';
  v_e3 uuid := '00000000-0000-0000-0000-0000000a8004';
  v_e4 uuid := '00000000-0000-0000-0000-0000000a8005';
  v_ann bigint;  -- logement de 3 places
  v_ann2 bigint; -- autre logement
  v_ann3 bigint; -- annonce d'étudiant
  v_ann4 bigint; -- logement non publié
  v_g bigint;
  v_g2 bigint;
  v_m2 bigint;
  v_m3 bigint;
  v_m4 bigint;
  v_nb integer;
  v_rec record;
  v_ids bigint[];
begin
  select id into v_univ from public.universites order by id limit 1;
  select id, centre into v_ville, v_centre from public.villes where nom = 'Niamey';
  select valeur #>> '{}' into v_cgu from public.parametres where cle = 'version_cgu';
  insert into public.quartiers (nom, ville_id) values ('Quartier de test M8', v_ville) returning id into v_quartier;
  v_meta := jsonb_build_object('role', 'etudiant', 'nom', 'Nom', 'prenom', 'Prenom', 'telephone', '90112233',
                               'universite_id', v_univ::text, 'cgu_version', v_cgu);
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_p1, 'm81@test.local', jsonb_set(v_meta, '{role}', '"proprietaire"')),
    (v_e1, 'm82@test.local', v_meta), (v_e2, 'm83@test.local', v_meta), (v_e3, 'm84@test.local', v_meta), (v_e4, 'm85@test.local', v_meta);
  insert into public.annonces (auteur_id, titre, description, type, nb_places, part_mensuelle_fcfa, loyer_total_fcfa, quartier_id, position, statut, publiee_le)
  values (v_p1, 'Appartement de trois chambres', 'Un grand appartement de trois chambres près du campus.', 'appartement', 3, 90000, 90000, v_quartier, v_centre, 'publiee', now())
  returning id into v_ann;
  insert into public.annonces (auteur_id, titre, description, type, nb_places, part_mensuelle_fcfa, quartier_id, position, statut, publiee_le)
  values (v_p1, 'Maison de quatre chambres', 'Une grande maison de quatre chambres, calme et sûre.', 'appartement', 4, 120000, v_quartier, v_centre, 'publiee', now())
  returning id into v_ann2;
  insert into public.annonces (auteur_id, titre, description, type, nb_places, part_mensuelle_fcfa, quartier_id)
  values (v_p1, 'Logement en brouillon', 'Un logement qui n''est pas encore publié du tout.', 'appartement', 3, 90000, v_quartier)
  returning id into v_ann4;
  insert into public.annonces (auteur_id, titre, description, type, nb_places, part_mensuelle_fcfa, loyer_total_fcfa, quartier_id, position, statut, publiee_le)
  values (v_e4, 'Place chez un étudiant', 'Une place dans une colocation entre étudiants, calme.', 'place_colocation', 3, 30000, 90000, v_quartier, v_centre, 'publiee', now())
  returning id into v_ann3;

  -- ===================================================================
  -- Qui peut lancer un groupe (RG34, RG52)
  -- ===================================================================
  perform pg_temp.jeton(v_p1); set local role authenticated;
  begin perform public.creer_groupe(v_ann, 2, 'Bonjour'); raise exception 'ÉCHEC RG34 : un propriétaire lance un groupe';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  set local role anon;
  begin perform public.creer_groupe(v_ann, 2); raise exception 'ÉCHEC : un visiteur lance un groupe';
  exception when insufficient_privilege then null; end;
  begin perform public.compter_groupes_en_formation(v_ann); exception when others then raise exception 'ÉCHEC : le badge public doit être lisible'; end;
  reset role;

  perform pg_temp.jeton(v_e1); set local role authenticated;
  begin perform public.creer_groupe(v_ann3, 1); raise exception 'ÉCHEC RG34 : groupe sur une place en colocation';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.creer_groupe(v_ann4, 1); raise exception 'ÉCHEC : groupe sur un logement non publié';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.creer_groupe(v_ann, 3); raise exception 'ÉCHEC RG34 : plus de places recherchées que de places';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.creer_groupe(v_ann, 0); raise exception 'ÉCHEC : zéro place recherchée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.creer_groupe(v_ann, 2, 'je vais te tuer'); raise exception 'ÉCHEC RG45 : texte bloqué dans un groupe';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;

  -- avec le KYC actif, un étudiant non vérifié ne lance ni ne rejoint (RG52)
  update public.parametres set valeur = 'true'::jsonb where cle = 'kyc_actif';
  perform pg_temp.jeton(v_e1); set local role authenticated;
  begin perform public.creer_groupe(v_ann, 2); raise exception 'ÉCHEC RG52 : étudiant non vérifié lance un groupe';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  -- étudiant vérifié : dossier validé, nom, prénom et avatar conformes
  insert into public.photos (proprietaire_id, usage, chemin, empreinte, statut, decide_le) values (v_e1, 'avatar', v_e1::text || '/a.webp', 'aaaaaaaaaaaaaaaa', 'validee', now());
  insert into public.verifications_identite (user_id, code_selfie, statut, consentement_le, nom_verifie, prenom_verifie, empreinte_avatar_verifie, decide_le)
  values (v_e1, '1234', 'valide', now(), 'Nom', 'Prenom', 'aaaaaaaaaaaaaaaa', now());
  if not public.identite_verifiee(v_e1) then raise exception 'ÉCHEC : préparation du test, e1 devrait être vérifié'; end if;
  perform pg_temp.jeton(v_e1); set local role authenticated;
  v_g := public.creer_groupe(v_ann, 2, 'Nous cherchons deux colocataires sérieux.', 'Non fumeur');
  reset role;
  perform pg_temp.jeton(v_e2); set local role authenticated;
  begin perform public.demander_adhesion(v_g); raise exception 'ÉCHEC RG52 : étudiant non vérifié rejoint un groupe';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  -- KYC désactivé (RG59) : tout étudiant actif peut participer
  update public.parametres set valeur = 'false'::jsonb where cle = 'kyc_actif';
  if not exists (select 1 from public.notifications where destinataire_id = v_p1 and type = 'groupe_cree') then raise exception 'ÉCHEC : propriétaire non prévenu'; end if;
  raise notice 'OK RG34, RG52, RG59 : lancer un groupe';

  -- ===================================================================
  -- Lecture (RG35, RG37) et RLS
  -- ===================================================================
  perform pg_temp.jeton(v_e2); set local role authenticated;
  select * into v_rec from public.groupes_du_logement(v_ann);
  if v_rec.id <> v_g or v_rec.places_restantes <> 2 or v_rec.part_estimee_fcfa <> 30000 or v_rec.initiateur_prenom <> 'Prenom' or v_rec.mon_statut is not null then
    raise exception 'ÉCHEC RG35/RG37 : groupes du logement (%)', v_rec;
  end if;
  select count(*) into v_nb from public.groupes_colocation;
  if v_nb <> 1 then raise exception 'ÉCHEC : groupe en formation illisible d''un connecté (%)', v_nb; end if;
  begin insert into public.groupes_colocation (annonce_id, initiateur_id, places_recherchees) values (v_ann, v_e2, 1); raise exception 'ÉCHEC : écriture directe d''un groupe';
  exception when insufficient_privilege then null; end;
  begin update public.membres_groupe set statut = 'accepte'; raise exception 'ÉCHEC : modification directe d''un membre';
  exception when insufficient_privilege then null; end;
  reset role;
  set local role anon;
  begin perform count(*) from public.groupes_colocation; raise exception 'ÉCHEC : un visiteur lit les groupes';
  exception when insufficient_privilege then null; end;
  begin perform public.groupes_du_logement(v_ann); raise exception 'ÉCHEC : un visiteur appelle groupes_du_logement';
  exception when insufficient_privilege then null; end;
  if public.compter_groupes_en_formation(v_ann) <> 1 then raise exception 'ÉCHEC : badge public'; end if;
  reset role;

  -- ===================================================================
  -- Demandes d'adhésion (RG36) : un seul groupe actif par logement, seul l'initiateur répond
  -- ===================================================================
  perform pg_temp.jeton(v_e1); set local role authenticated;
  begin perform public.demander_adhesion(v_g); raise exception 'ÉCHEC : l''initiateur demande à rejoindre son propre groupe';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.creer_groupe(v_ann, 1); raise exception 'ÉCHEC RG36 : deux groupes du même logement';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;

  perform pg_temp.jeton(v_e2); set local role authenticated;
  perform public.demander_adhesion(v_g);
  begin perform public.demander_adhesion(v_g); raise exception 'ÉCHEC : demande en double';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  select * into v_rec from public.groupes_du_logement(v_ann);
  if v_rec.mon_statut <> 'en_attente' then raise exception 'ÉCHEC : ma demande'; end if;
  select count(*) into v_nb from public.membres_groupe;
  if v_nb <> 2 then raise exception 'ÉCHEC : le demandeur voit les membres acceptés et sa demande (%)', v_nb; end if;
  select id into v_m2 from public.membres_groupe where user_id = v_e2;
  begin perform public.repondre_demande(v_m2, true); raise exception 'ÉCHEC RG36 : le demandeur s''accepte lui-même';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  if not exists (select 1 from public.notifications where destinataire_id = v_e1 and type = 'groupe_demande') then raise exception 'ÉCHEC : initiateur non prévenu de la demande'; end if;

  perform pg_temp.jeton(v_e3); set local role authenticated;
  perform public.demander_adhesion(v_g);
  select count(*) into v_nb from public.membres_groupe;
  if v_nb <> 2 then raise exception 'ÉCHEC : un demandeur voit la demande d''un autre (%)', v_nb; end if;
  begin perform public.repondre_demande(v_m2, true); raise exception 'ÉCHEC RG36 : un tiers accepte une demande';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;

  -- l'étudiant e2 ne rejoint pas un second groupe du même logement
  perform pg_temp.jeton(v_e4); set local role authenticated;
  v_g2 := null;
  reset role;

  perform pg_temp.jeton(v_e1); set local role authenticated;
  select count(*) into v_nb from public.membres_du_groupe(v_g);
  if v_nb <> 3 then raise exception 'ÉCHEC : l''initiateur voit les demandes (%)', v_nb; end if;
  select id into v_m3 from public.membres_groupe where user_id = v_e3;
  perform public.repondre_demande(v_m2, true);
  begin perform public.repondre_demande(v_m2, false); raise exception 'ÉCHEC : seconde réponse à la même demande';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  if not exists (select 1 from public.notifications where destinataire_id = v_e2 and type = 'groupe_reponse') then raise exception 'ÉCHEC : demandeur non prévenu'; end if;
  raise notice 'OK RG36 : demandes et réponses';

  -- ===================================================================
  -- RG38 : le groupe passe à complet, refuse de nouvelles demandes, on ne dépasse pas les places
  -- ===================================================================
  perform pg_temp.jeton(v_e1); set local role authenticated;
  perform public.repondre_demande(v_m3, true);
  reset role;
  if (select statut from public.groupes_colocation where id = v_g) <> 'complet' then raise exception 'ÉCHEC RG38 : le groupe n''est pas complet'; end if;
  if (select count(*) from public.notifications where type = 'groupe_complet') < 4 then raise exception 'ÉCHEC RG38 : membres et propriétaire non notifiés'; end if;
  perform pg_temp.jeton(v_e4); set local role authenticated;
  begin perform public.demander_adhesion(v_g); raise exception 'ÉCHEC RG38 : demande sur un groupe complet';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  -- un groupe complet n'a plus de places : on ne peut pas dépasser (acceptation forcée d'une demande ajoutée à la main)
  insert into public.membres_groupe (groupe_id, user_id, statut) values (v_g, v_e4, 'en_attente') returning id into v_m4;
  perform pg_temp.jeton(v_e1); set local role authenticated;
  begin perform public.repondre_demande(v_m4, true); raise exception 'ÉCHEC : dépassement du nombre de places';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  delete from public.membres_groupe where id = v_m4;
  -- le propriétaire voit le groupe complet ; un étudiant extérieur non
  perform pg_temp.jeton(v_p1); set local role authenticated;
  select count(*) into v_nb from public.groupes_du_logement(v_ann);
  if v_nb <> 1 then raise exception 'ÉCHEC : le propriétaire ne voit pas le groupe complet'; end if;
  select count(*) into v_nb from public.groupes_colocation;
  if v_nb <> 1 then raise exception 'ÉCHEC : lecture des groupes par le propriétaire'; end if;
  reset role;
  perform pg_temp.jeton(v_e4); set local role authenticated;
  select count(*) into v_nb from public.groupes_du_logement(v_ann);
  if v_nb <> 0 then raise exception 'ÉCHEC : groupe complet visible d''un étudiant extérieur'; end if;
  select count(*) into v_nb from public.membres_groupe;
  if v_nb <> 0 then raise exception 'ÉCHEC : membres d''un groupe complet visibles d''un extérieur (%)', v_nb; end if;
  reset role;
  raise notice 'OK RG38 : groupe complet';

  -- ===================================================================
  -- RG39 : quitter ; transmission du rôle d'initiateur ; retour en formation
  -- ===================================================================
  perform pg_temp.jeton(v_e1); set local role authenticated;
  perform public.quitter_groupe(v_g);
  begin perform public.quitter_groupe(v_g); raise exception 'ÉCHEC : quitter deux fois';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  select * into v_rec from public.groupes_colocation where id = v_g;
  if v_rec.initiateur_id <> v_e2 or v_rec.statut <> 'en_formation' then raise exception 'ÉCHEC RG39 : transmission (initiateur %, statut %)', v_rec.initiateur_id, v_rec.statut; end if;
  if (select role from public.membres_groupe where user_id = v_e2 and groupe_id = v_g) <> 'initiateur' then raise exception 'ÉCHEC RG39 : rôle du nouvel initiateur'; end if;
  -- e1 peut de nouveau rejoindre (sa ligne « parti » repart en attente)
  perform pg_temp.jeton(v_e1); set local role authenticated;
  perform public.demander_adhesion(v_g);
  if (select mon_statut from public.groupes_du_logement(v_ann)) <> 'en_attente' then raise exception 'ÉCHEC : nouvelle demande après départ'; end if;
  reset role;
  -- dernier membre : le groupe se clôt
  perform pg_temp.jeton(v_e1); set local role authenticated;
  perform public.quitter_groupe(v_g);
  reset role;
  perform pg_temp.jeton(v_e3); set local role authenticated;
  perform public.quitter_groupe(v_g);
  reset role;
  perform pg_temp.jeton(v_e2); set local role authenticated;
  perform public.quitter_groupe(v_g);
  reset role;
  if (select statut from public.groupes_colocation where id = v_g) <> 'cloture' then raise exception 'ÉCHEC RG39 : groupe vide non clos'; end if;
  perform pg_temp.jeton(v_e1); set local role authenticated;
  begin perform public.demander_adhesion(v_g); raise exception 'ÉCHEC : demande sur un groupe clos';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  raise notice 'OK RG39 : quitter et clôture';

  -- ===================================================================
  -- RG36 : limite de groupes actifs ; clôture automatique (RG39)
  -- ===================================================================
  update public.parametres set valeur = '1'::jsonb where cle = 'groupes_actifs_max';
  perform pg_temp.jeton(v_e1); set local role authenticated;
  v_g := public.creer_groupe(v_ann, 2);
  begin perform public.creer_groupe(v_ann2, 2); raise exception 'ÉCHEC RG36 : limite de groupes actifs dépassée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  update public.parametres set valeur = '3'::jsonb where cle = 'groupes_actifs_max';
  perform pg_temp.jeton(v_e1); set local role authenticated;
  v_g2 := public.creer_groupe(v_ann2, 3);
  select count(*) into v_nb from public.mes_groupes();
  if v_nb <> 2 then raise exception 'ÉCHEC : mes_groupes (%)', v_nb; end if;
  reset role;
  -- 31 jours sans activité, et logement dépublié
  update public.groupes_colocation set derniere_activite = now() - interval '31 days' where id = v_g;
  update public.annonces set statut = 'archivee' where id = v_ann2;
  if public.cloturer_groupes_inactifs() <> 2 then raise exception 'ÉCHEC RG39 : clôture automatique'; end if;
  if exists (select 1 from public.groupes_colocation where id in (v_g, v_g2) and statut <> 'cloture') then raise exception 'ÉCHEC RG39 : groupes non clos'; end if;
  if not exists (select 1 from cron.job where jobname = 'm8-cloture-groupes') then raise exception 'ÉCHEC : tâche planifiée absente'; end if;
  raise notice 'OK RG36, RG39 : limite et clôture automatique';

  -- ===================================================================
  -- M5 : badge et filtre « colocations en formation »
  -- ===================================================================
  perform pg_temp.jeton(v_e1); set local role authenticated;
  v_g := public.creer_groupe(v_ann, 2);
  reset role;
  set local role anon;
  select array_agg(id) into v_ids from public.rechercher_annonces(jsonb_build_object('groupes_en_formation', true));
  if v_ids is distinct from array[v_ann] then raise exception 'ÉCHEC M5 : filtre groupes en formation (%)', v_ids; end if;
  select * into v_rec from public.annonces_carte(jsonb_build_object('sud', 0, 'ouest', 0, 'nord', 20, 'est', 20)) where id = v_ann;
  if not v_rec.groupe_en_formation then raise exception 'ÉCHEC M5 : badge de la carte'; end if;
  if (select nombre from public.compter_groupes_annonces(array[v_ann, v_ann2]) where annonce_id = v_ann) <> 1 then raise exception 'ÉCHEC : compteurs par annonce'; end if;
  reset role;

  -- ===================================================================
  -- Export, droits (RGP11, RGP17)
  -- ===================================================================
  perform pg_temp.jeton(v_e1); set local role authenticated;
  if jsonb_array_length(public.exporter_mes_donnees() -> 'donnees' -> 'groupes' -> 'groupes') < 1 then raise exception 'ÉCHEC RGP11 : groupes absents de l''export'; end if;
  reset role;
  if has_function_privilege('anon', 'public.creer_groupe(bigint,integer,text,text)', 'execute')
     or has_function_privilege('anon', 'public.demander_adhesion(bigint)', 'execute')
     or has_function_privilege('authenticated', 'public.mettre_a_jour_groupe()', 'execute')
     or has_function_privilege('authenticated', 'public.cloturer_groupes_inactifs()', 'execute')
     or has_function_privilege('authenticated', 'public.exiger_etudiant_verifie()', 'execute')
     or has_function_privilege('authenticated', 'public.exporter_donnees_groupes(uuid)', 'execute') then
    raise exception 'ÉCHEC RGP17 : droits d''exécution';
  end if;
  raise notice 'OK RGP11, RGP17';
end;
$$;

rollback;
