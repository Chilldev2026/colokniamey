-- Tests du module M7 (signalements) et de son extension d'administration. À exécuter après 0910, 0980, 1000, 1020 et seed.sql.
-- Tout est annulé à la fin (rollback). Chaque échec lève une exception « ÉCHEC ».

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
  v_p1 uuid := '00000000-0000-0000-0000-0000000b7001'; -- propriétaire (auteur de l'annonce)
  v_e1 uuid := '00000000-0000-0000-0000-0000000b7002'; -- signaleur
  v_e2 uuid := '00000000-0000-0000-0000-0000000b7003'; -- autre étudiant
  v_e3 uuid := '00000000-0000-0000-0000-0000000b7004'; -- expéditeur d'un message
  v_a1 uuid := '00000000-0000-0000-0000-0000000b7005';
  v_a2 uuid := '00000000-0000-0000-0000-0000000b7006';
  v_s1 uuid := '00000000-0000-0000-0000-0000000b7007';
  v_sa1 uuid := '00000000-0000-0000-0000-0000000b70a1';
  v_sa2 uuid := '00000000-0000-0000-0000-0000000b70a2';
  v_ss1 uuid := '00000000-0000-0000-0000-0000000b70a3';
  v_ann bigint;
  v_conv bigint;
  v_msg1 bigint;
  v_msg2 bigint;
  v_sig bigint;
  v_sig2 bigint;
  v_sig3 bigint;
  v_nb integer;
  v_json jsonb;
  v_rec record;
  i integer;
begin
  select id into v_univ from public.universites order by id limit 1;
  select id, centre into v_ville, v_centre from public.villes where nom = 'Niamey';
  select valeur #>> '{}' into v_cgu from public.parametres where cle = 'version_cgu';
  insert into public.quartiers (nom, ville_id) values ('Quartier de test M7', v_ville) returning id into v_quartier;
  v_meta := jsonb_build_object('role', 'etudiant', 'nom', 'Nom', 'prenom', 'Prenom', 'telephone', '90112233',
                               'universite_id', v_univ::text, 'cgu_version', v_cgu);
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_p1, 'm71@test.local', jsonb_set(v_meta, '{role}', '"proprietaire"')),
    (v_e1, 'm72@test.local', v_meta), (v_e2, 'm73@test.local', v_meta), (v_e3, 'm74@test.local', v_meta),
    (v_a1, 'm75@test.local', v_meta), (v_a2, 'm76@test.local', v_meta), (v_s1, 'm77@test.local', v_meta);
  update public.profils set role = 'admin' where id in (v_a1, v_a2);
  update public.profils set role = 'super_admin' where id = v_s1;
  insert into public.sessions_admin (session_id, user_id) values (v_sa1, v_a1), (v_sa2, v_a2), (v_ss1, v_s1);
  insert into public.annonces (auteur_id, titre, description, type, part_mensuelle_fcfa, quartier_id, position, statut, publiee_le)
  values (v_p1, 'Studio signalé', 'Un studio qui sera signalé pour les besoins du test.', 'studio', 50000, v_quartier, v_centre, 'publiee', now())
  returning id into v_ann;
  -- une conversation entre e1 (demandeur) et p1, avec deux messages de p1 ; seul le premier sera signalé
  insert into public.conversations (annonce_id, demandeur_id, auteur_id) values (v_ann, v_e1, v_p1) returning id into v_conv;
  insert into public.messages (conversation_id, expediteur_id, contenu) values (v_conv, v_p1, 'Envoie-moi un acompte avant la visite.') returning id into v_msg1;
  insert into public.messages (conversation_id, expediteur_id, contenu) values (v_conv, v_p1, 'Message privé non signalé.') returning id into v_msg2;
  insert into public.messages (conversation_id, expediteur_id, contenu) values (v_conv, v_e1, 'Ma propre réponse.');

  -- ===================================================================
  -- Signaler (RG20) : annonce, profil, message
  -- ===================================================================
  set local role anon;
  begin perform public.signaler('annonce', v_ann::text, 'arnaque'); raise exception 'ÉCHEC : un visiteur signale';
  exception when insufficient_privilege then null; end;
  reset role;

  perform pg_temp.jeton(v_e1); set local role authenticated;
  v_sig := public.signaler('annonce', v_ann::text, 'arnaque', 'L''annonceur demande de l''argent avant la visite.');
  -- doublon refusé
  begin perform public.signaler('annonce', v_ann::text, 'fausse_annonce'); raise exception 'ÉCHEC : doublon accepté';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  if not public.signalement_ouvert('annonce', v_ann::text) then raise exception 'ÉCHEC : signalement_ouvert'; end if;
  -- soi-même, contenu inexistant, type libre
  begin perform public.signaler('profil', v_e1::text, 'autre'); raise exception 'ÉCHEC : auto-signalement';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.signaler('annonce', '999999999', 'autre'); raise exception 'ÉCHEC : annonce inexistante';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.signaler('annonce', 'abc', 'autre'); raise exception 'ÉCHEC : identifiant invalide';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.signaler('conversation', '1', 'autre'); raise exception 'ÉCHEC : type libre';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.signaler('annonce', v_ann::text, 'arnaque', 'je vais te tuer'); raise exception 'ÉCHEC : commentaire interdit';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  -- profil
  v_sig2 := public.signaler('profil', v_p1::text, 'harcelement');
  -- message reçu : copie du seul message visé
  v_sig3 := public.signaler('message', v_msg1::text, 'arnaque');
  begin perform public.signaler('message', (select id::text from public.messages where expediteur_id = v_e1 and conversation_id = v_conv), 'autre'); raise exception 'ÉCHEC : signaler son propre message';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  if (select message_contenu from public.signalements where id = v_sig3) <> 'Envoie-moi un acompte avant la visite.' then raise exception 'ÉCHEC : copie du message'; end if;

  -- un tiers ne signale pas un message d'une conversation à laquelle il ne participe pas
  perform pg_temp.jeton(v_e2); set local role authenticated;
  begin perform public.signaler('message', v_msg2::text, 'harcelement'); raise exception 'ÉCHEC RGA10 : message d''une conversation étrangère';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  raise notice 'OK RG20 : signaler';

  -- ===================================================================
  -- Un utilisateur ne lit pas les signalements des autres
  -- ===================================================================
  perform pg_temp.jeton(v_e2); set local role authenticated;
  select count(*) into v_nb from public.signalements;
  if v_nb <> 0 then raise exception 'ÉCHEC : un tiers lit les signalements (%)', v_nb; end if;
  begin insert into public.signalements (auteur_id, cible_type, cible_id, motif) values (v_e2, 'annonce', '1', 'autre'); raise exception 'ÉCHEC : insertion directe';
  exception when insufficient_privilege then null; end;
  begin perform public.liste_signalements(); raise exception 'ÉCHEC : un étudiant liste les signalements';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  perform pg_temp.jeton(v_e1); set local role authenticated;
  select count(*) into v_nb from public.signalements;
  if v_nb <> 3 then raise exception 'ÉCHEC : l''auteur ne lit pas ses signalements (%)', v_nb; end if;
  begin perform message_contenu from public.signalements; raise exception 'ÉCHEC : copie du message lisible par l''auteur';
  exception when insufficient_privilege then null; end;
  begin perform traite_par from public.signalements; raise exception 'ÉCHEC : nom de l''admin lisible par l''auteur';
  exception when insufficient_privilege then null; end;
  reset role;
  perform pg_temp.jeton(v_p1); set local role authenticated;
  select count(*) into v_nb from public.signalements;
  if v_nb <> 0 then raise exception 'ÉCHEC : la personne signalée lit les signalements (%)', v_nb; end if;
  reset role;
  raise notice 'OK : confidentialité des signalements';

  -- ===================================================================
  -- RGP20 : 10 signalements par jour
  -- ===================================================================
  perform pg_temp.jeton(v_e1); set local role authenticated;
  for i in 1 .. 7 loop
    reset role;
    insert into public.annonces (auteur_id, titre, description, type, part_mensuelle_fcfa, quartier_id, position, statut, publiee_le)
    values (v_p1, 'Annonce de quota ' || i, 'Une annonce créée pour tester le quota de signalements.', 'chambre', 30000 + i, v_quartier, v_centre, 'publiee', now());
    perform pg_temp.jeton(v_e1); set local role authenticated;
    perform public.signaler('annonce', (select max(id)::text from public.annonces), 'autre');
  end loop;
  -- 3 + 7 = 10 faits : le onzième est refusé
  reset role;
  insert into public.annonces (auteur_id, titre, description, type, part_mensuelle_fcfa, quartier_id, position, statut, publiee_le)
  values (v_p1, 'Annonce onze', 'Une annonce créée pour tester le quota de signalements.', 'chambre', 39000, v_quartier, v_centre, 'publiee', now());
  perform pg_temp.jeton(v_e1); set local role authenticated;
  begin perform public.signaler('annonce', (select max(id)::text from public.annonces), 'autre'); raise exception 'ÉCHEC RGP20 : onzième signalement accepté';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  raise notice 'OK RGP20 : quota';

  -- ===================================================================
  -- Admin : droits, file, prise en charge, RGA10
  -- ===================================================================
  perform pg_temp.jeton(v_a1, 'aal1', v_sa1); set local role authenticated;
  begin perform public.liste_signalements(); raise exception 'ÉCHEC RGA04 : liste sans aal2';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  if not exists (select 1 from public.files_admin where nom = 'signalements') then raise exception 'ÉCHEC : file non inscrite'; end if;
  if (select nombre from public.file_signalements) <> 10 then raise exception 'ÉCHEC : compteur de la file (%)', (select nombre from public.file_signalements); end if;

  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  select count(*) into v_nb from public.liste_signalements('nouveau');
  if v_nb <> 10 then raise exception 'ÉCHEC : liste des signalements (%)', v_nb; end if;
  select count(*) into v_nb from public.liste_signalements('nouveau', 'harcelement');
  if v_nb <> 1 then raise exception 'ÉCHEC : filtre par motif (%)', v_nb; end if;
  -- l'admin ne lit pas les messages privés, ni les conversations (RGA10)
  select count(*) into v_nb from public.messages;
  if v_nb <> 0 then raise exception 'ÉCHEC RGA10 : un admin lit les messages (%)', v_nb; end if;
  select count(*) into v_nb from public.conversations;
  if v_nb <> 0 then raise exception 'ÉCHEC RGA10 : un admin lit les conversations (%)', v_nb; end if;
  v_json := public.fiche_signalement(v_sig3);
  if v_json -> 'cible' ->> 'message' <> 'Envoie-moi un acompte avant la visite.' then raise exception 'ÉCHEC : message joint absent de la fiche'; end if;
  if v_json::text like '%Message privé non signalé%' or v_json::text like '%Ma propre réponse%' then raise exception 'ÉCHEC RGA10 : autre message dans la fiche'; end if;
  v_json := public.fiche_signalement(v_sig);
  if v_json -> 'cible' ->> 'titre' <> 'Studio signalé' or jsonb_array_length(v_json -> 'historique') <> 0 then raise exception 'ÉCHEC : fiche de l''annonce'; end if;
  begin perform public.cloturer_signalement(v_sig, 'rejeter'); raise exception 'ÉCHEC RGA12 : clôture sans prise en charge';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  perform public.prendre_en_charge_signalement(v_sig);
  reset role;

  -- deux admins ne prennent pas en charge le même signalement
  perform pg_temp.jeton(v_a2, 'aal2', v_sa2); set local role authenticated;
  begin perform public.prendre_en_charge_signalement(v_sig); raise exception 'ÉCHEC RGA12 : deux admins sur le même signalement';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  select * into v_rec from public.liste_signalements('en_cours') where id = v_sig;
  if not v_rec.pris_par_un_autre then raise exception 'ÉCHEC : verrouillage non visible'; end if;
  begin perform public.cloturer_signalement(v_sig, 'rejeter'); raise exception 'ÉCHEC RGA12 : clôture par un autre admin';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  raise notice 'OK RGA12, RGA10 : prise en charge';

  -- ===================================================================
  -- Décisions : retirer l'annonce (motif obligatoire), rejeter, suspendre l'auteur (RGA02)
  -- ===================================================================
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  begin perform public.cloturer_signalement(v_sig, 'retirer_annonce'); raise exception 'ÉCHEC RGA11 : retrait sans motif';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.cloturer_signalement(v_sig, 'au_hasard'); raise exception 'ÉCHEC : décision libre';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  perform public.cloturer_signalement(v_sig, 'retirer_annonce', 'Annonce trompeuse');
  reset role;
  if (select statut from public.annonces where id = v_ann) <> 'refusee' then raise exception 'ÉCHEC : annonce non retirée'; end if;
  if not exists (select 1 from public.notifications where destinataire_id = v_p1 and titre like '%Annonce trompeuse%') then raise exception 'ÉCHEC RGA11 : motif non notifié à l''auteur'; end if;
  if (select statut from public.signalements where id = v_sig) <> 'traite' then raise exception 'ÉCHEC : statut après décision'; end if;
  if not exists (select 1 from public.notifications where destinataire_id = v_e1 and type = 'signalement_traite') then raise exception 'ÉCHEC : signaleur non prévenu'; end if;
  if exists (select 1 from public.notifications where type = 'signalement_traite' and titre like '%trompeuse%') then raise exception 'ÉCHEC RGA33 : détail dans la notification du signaleur'; end if;
  if not exists (select 1 from public.journal_audit where action in ('signalement_pris', 'signalement_clos') and cible_id = v_sig::text) then raise exception 'ÉCHEC RGA06 : journal'; end if;

  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  perform public.prendre_en_charge_signalement(v_sig2);
  perform public.cloturer_signalement(v_sig2, 'rejeter', 'Rien de répréhensible.');
  if (select statut from public.signalements where id = v_sig2) <> 'rejete' then raise exception 'ÉCHEC : rejet'; end if;
  -- suspension de l'auteur du message signalé
  perform public.prendre_en_charge_signalement(v_sig3);
  begin perform public.cloturer_signalement(v_sig3, 'suspendre_auteur'); raise exception 'ÉCHEC RGA08 : suspension sans motif';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.cloturer_signalement(v_sig3, 'retirer_annonce', 'Mauvais type de cible'); raise exception 'ÉCHEC : retrait appliqué à un message';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  perform public.cloturer_signalement(v_sig3, 'suspendre_auteur', 'Demande d''acompte frauduleuse');
  reset role;
  if (select statut from public.profils where id = v_p1) <> 'suspendu' then raise exception 'ÉCHEC : auteur non suspendu'; end if;
  -- l'annonce d'un compte suspendu n'est plus visible (0971) et la suspension est journalisée par A2
  if not exists (select 1 from public.journal_audit where cible_id = v_p1::text and action like '%suspen%') then raise exception 'ÉCHEC RGA06 : suspension non journalisée'; end if;

  -- un admin ne suspend pas un compte de niveau égal ou supérieur (RGA02)
  insert into public.signalements (auteur_id, cible_type, cible_id, cible_auteur_id, motif, statut, traite_par)
  values (v_e2, 'profil', v_a2::text, v_a2, 'autre', 'en_cours', v_a1) returning id into v_sig;
  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  begin perform public.cloturer_signalement(v_sig, 'suspendre_auteur', 'Test de hiérarchie'); raise exception 'ÉCHEC RGA02 : un admin suspend un admin';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  -- relâcher
  perform public.relacher_signalement(v_sig);
  reset role;
  if (select statut from public.signalements where id = v_sig) <> 'nouveau' then raise exception 'ÉCHEC : relâchement'; end if;
  raise notice 'OK RGA11, RGA02, RGA06 : décisions';

  -- ===================================================================
  -- Export, compteurs, droits
  -- ===================================================================
  perform pg_temp.jeton(v_e1); set local role authenticated;
  if jsonb_array_length(public.exporter_mes_donnees() -> 'donnees' -> 'signalements' -> 'signalements_envoyes') <> 10 then raise exception 'ÉCHEC RGP11 : export'; end if;
  reset role;
  perform pg_temp.jeton(v_s1, 'aal2', v_ss1); set local role authenticated;
  if (public.fiche_utilisateur(v_p1) -> 'compteurs' ->> 'signalements_recus')::integer < 2 then raise exception 'ÉCHEC : compteur de la fiche utilisateur'; end if;
  reset role;
  if has_function_privilege('anon', 'public.signaler(text,text,public.motif_signalement,text)', 'execute')
     or has_function_privilege('anon', 'public.liste_signalements(text,text)', 'execute')
     or has_function_privilege('authenticated', 'public.exporter_donnees_signalements(uuid)', 'execute') then
    raise exception 'ÉCHEC RGP17 : droits d''exécution';
  end if;
  raise notice 'OK RGP11, RGP17';
end;
$$;

rollback;
