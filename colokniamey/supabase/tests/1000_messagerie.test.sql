-- Tests du module M6 (messagerie). À exécuter après 0970, 0971, 0980, 1000 et seed.sql.
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
  v_p1 uuid := '00000000-0000-0000-0000-0000000f0001'; -- propriétaire, auteur de l'annonce
  v_e1 uuid := '00000000-0000-0000-0000-0000000f0002'; -- étudiant qui contacte
  v_e2 uuid := '00000000-0000-0000-0000-0000000f0003'; -- tiers
  v_a1 uuid := '00000000-0000-0000-0000-0000000f0004'; -- admin
  v_sa1 uuid := '00000000-0000-0000-0000-0000000f00a1';
  v_ann bigint;
  v_ann2 bigint;
  v_conv bigint;
  v_conv2 bigint;
  v_nb integer;
  v_rec record;
  v_json jsonb;
  i integer;
begin
  select id into v_univ from public.universites order by id limit 1;
  select id, centre into v_ville, v_centre from public.villes where nom = 'Niamey';
  select valeur #>> '{}' into v_cgu from public.parametres where cle = 'version_cgu';
  insert into public.quartiers (nom, ville_id) values ('Quartier de test M6', v_ville) returning id into v_quartier;
  v_meta := jsonb_build_object('role', 'etudiant', 'nom', 'Nom', 'prenom', 'Prenom', 'telephone', '90112233',
                               'universite_id', v_univ::text, 'cgu_version', v_cgu);
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_p1, 'm61@test.local', jsonb_set(v_meta, '{role}', '"proprietaire"')),
    (v_e1, 'm62@test.local', v_meta), (v_e2, 'm63@test.local', v_meta), (v_a1, 'm64@test.local', v_meta);
  update public.profils set role = 'admin' where id = v_a1;
  insert into public.sessions_admin (session_id, user_id) values (v_sa1, v_a1);
  insert into public.annonces (auteur_id, titre, description, type, part_mensuelle_fcfa, quartier_id, position, statut, publiee_le)
  values (v_p1, 'Studio près du campus', 'Un studio calme et lumineux près du campus.', 'studio', 50000, v_quartier, v_centre, 'publiee', now())
  returning id into v_ann;
  insert into public.annonces (auteur_id, titre, description, type, part_mensuelle_fcfa, quartier_id)
  values (v_p1, 'Brouillon privé', 'Un brouillon qui ne doit pas être contactable.', 'chambre', 30000, v_quartier)
  returning id into v_ann2;

  -- ===================================================================
  -- Démarrer une conversation (RG19)
  -- ===================================================================
  set local role anon;
  begin perform public.demarrer_conversation(v_ann, 'Bonjour'); raise exception 'ÉCHEC : visiteur démarre une conversation';
  exception when insufficient_privilege then null; end;
  reset role;

  perform pg_temp.jeton(v_p1); set local role authenticated;
  begin perform public.demarrer_conversation(v_ann, 'Je m''écris'); raise exception 'ÉCHEC : conversation avec soi-même';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;

  perform pg_temp.jeton(v_e1); set local role authenticated;
  begin perform public.demarrer_conversation(v_ann2, 'Bonjour'); raise exception 'ÉCHEC : contact sur une annonce non publiée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.demarrer_conversation(v_ann, '   '); raise exception 'ÉCHEC : message vide';
  exception when raise_exception or check_violation then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  v_conv := public.demarrer_conversation(v_ann, 'Bonjour, le studio est-il encore disponible ?');
  -- la même annonce reprend la même conversation
  if public.demarrer_conversation(v_ann, 'Merci de me répondre.') <> v_conv then raise exception 'ÉCHEC : deux conversations pour la même annonce'; end if;
  if public.ma_conversation_annonce(v_ann) <> v_conv then raise exception 'ÉCHEC : ma_conversation_annonce'; end if;
  if (select count(*) from public.messages where conversation_id = v_conv) <> 2 then raise exception 'ÉCHEC : messages de la conversation'; end if;
  reset role;
  if not exists (select 1 from public.notifications where destinataire_id = v_p1 and type = 'nouveau_message') then raise exception 'ÉCHEC : auteur non notifié'; end if;
  if (select count(*) from public.notifications where destinataire_id = v_p1 and type = 'nouveau_message') <> 1 then raise exception 'ÉCHEC : une notification par série de messages non lus'; end if;
  if exists (select 1 from public.notifications where type = 'nouveau_message' and titre like '%disponible%') then raise exception 'ÉCHEC : texte du message dans la notification'; end if;
  raise notice 'OK RG19 : démarrer une conversation';

  -- ===================================================================
  -- RGA10 : un tiers ne lit pas, un administrateur non plus
  -- ===================================================================
  perform pg_temp.jeton(v_e2); set local role authenticated;
  select count(*) into v_nb from public.conversations;
  if v_nb <> 0 then raise exception 'ÉCHEC : un tiers voit la conversation (%)', v_nb; end if;
  select count(*) into v_nb from public.messages;
  if v_nb <> 0 then raise exception 'ÉCHEC : un tiers lit les messages (%)', v_nb; end if;
  begin insert into public.messages (conversation_id, contenu) values (v_conv, 'Intrus'); raise exception 'ÉCHEC : un tiers écrit dans la conversation';
  exception when insufficient_privilege or raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.marquer_lu(v_conv); raise exception 'ÉCHEC : un tiers marque comme lu';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  select count(*) into v_nb from public.liste_conversations();
  if v_nb <> 0 then raise exception 'ÉCHEC : liste des conversations d''un tiers'; end if;
  reset role;

  perform pg_temp.jeton(v_a1, 'aal2', v_sa1); set local role authenticated;
  select count(*) into v_nb from public.conversations;
  if v_nb <> 0 then raise exception 'ÉCHEC RGA10 : un admin voit les conversations (%)', v_nb; end if;
  select count(*) into v_nb from public.messages;
  if v_nb <> 0 then raise exception 'ÉCHEC RGA10 : un admin lit les messages (%)', v_nb; end if;
  begin insert into public.messages (conversation_id, contenu) values (v_conv, 'Admin'); raise exception 'ÉCHEC RGA10 : un admin écrit';
  exception when insufficient_privilege or raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  set local role anon;
  begin perform count(*) from public.messages; raise exception 'ÉCHEC : un visiteur lit les messages';
  exception when insufficient_privilege then null; end;
  reset role;
  raise notice 'OK RGA10 : confidentialité';

  -- ===================================================================
  -- Les deux participants lisent et répondent ; lu / non lu
  -- ===================================================================
  perform pg_temp.jeton(v_p1); set local role authenticated;
  select count(*) into v_nb from public.messages where conversation_id = v_conv;
  if v_nb <> 2 then raise exception 'ÉCHEC : l''auteur ne lit pas la conversation (%)', v_nb; end if;
  select * into v_rec from public.liste_conversations();
  if v_rec.non_lus <> 2 or v_rec.autre_prenom <> 'Prenom' or v_rec.annonce_titre <> 'Studio près du campus' then raise exception 'ÉCHEC : liste (%)', v_rec; end if;
  if public.mes_messages_non_lus() <> 2 then raise exception 'ÉCHEC : total non lus'; end if;
  if public.marquer_lu(v_conv) <> 2 then raise exception 'ÉCHEC : marquer_lu'; end if;
  if public.mes_messages_non_lus() <> 0 then raise exception 'ÉCHEC : non lus après lecture'; end if;
  insert into public.messages (conversation_id, contenu) values (v_conv, 'Oui, il est disponible.');
  begin update public.messages set contenu = 'Modifié' where conversation_id = v_conv; raise exception 'ÉCHEC : modification d''un message';
  exception when insufficient_privilege then null; end;
  begin delete from public.messages where conversation_id = v_conv; raise exception 'ÉCHEC : suppression d''un message';
  exception when insufficient_privilege then null; end;
  begin insert into public.messages (conversation_id, expediteur_id, contenu) values (v_conv, v_e1, 'Au nom d''un autre'); raise exception 'ÉCHEC : message au nom d''un autre';
  exception when insufficient_privilege or raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  perform pg_temp.jeton(v_e1); set local role authenticated;
  select * into v_rec from public.liste_conversations();
  if v_rec.non_lus <> 1 then raise exception 'ÉCHEC : non lus du demandeur (%)', v_rec.non_lus; end if;
  reset role;
  if not exists (select 1 from public.notifications where destinataire_id = v_e1 and type = 'nouveau_message') then raise exception 'ÉCHEC : demandeur non notifié de la réponse'; end if;
  raise notice 'OK : lecture, réponse et non lus';

  -- ===================================================================
  -- RG45 : un message au contenu interdit est bloqué, jamais mis en revue (RGA10)
  -- ===================================================================
  perform pg_temp.jeton(v_e1); set local role authenticated;
  begin insert into public.messages (conversation_id, contenu) values (v_conv, 'je vais te tuer'); raise exception 'ÉCHEC RG45 : menace acceptée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  -- niveau « revue » (contexte privé) : accepté, aucune mise en revue
  insert into public.messages (conversation_id, contenu) values (v_conv, 'Le quartier est calme, pas un attentat de bruit !');
  reset role;
  if exists (select 1 from public.contenus_en_revue where type_contenu = 'message') then raise exception 'ÉCHEC RGA10 : message mis en revue'; end if;

  -- ===================================================================
  -- RGP20 : 20 messages par minute
  -- ===================================================================
  perform pg_temp.jeton(v_e1); set local role authenticated;
  select count(*) into v_nb from public.messages where expediteur_id = v_e1;
  -- déjà envoyés par e1 : 2 + 1 = 3 ; on complète jusqu'à 20
  for i in v_nb + 1 .. 20 loop
    insert into public.messages (conversation_id, contenu) values (v_conv, 'Message numéro ' || i);
  end loop;
  begin
    insert into public.messages (conversation_id, contenu) values (v_conv, 'Le vingt et unième');
    raise exception 'ÉCHEC RGP20 : vingt et unième message accepté';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  raise notice 'OK RGP20 : quota de messages';

  -- ===================================================================
  -- 20 nouvelles conversations par jour
  -- ===================================================================
  perform pg_temp.jeton(v_e2); set local role authenticated;
  for i in 1 .. 20 loop
    reset role;
    perform set_config('request.jwt.claims', '', true);
    insert into public.annonces (auteur_id, titre, description, type, part_mensuelle_fcfa, quartier_id, position, statut, publiee_le)
    values (v_p1, 'Annonce de quota ' || i, 'Une annonce créée pour tester le quota de conversations.', 'chambre', 30000 + i, v_quartier, v_centre, 'publiee', now())
    returning id into v_ann2;
    perform pg_temp.jeton(v_e2); set local role authenticated;
    perform public.demarrer_conversation(v_ann2, 'Bonjour ' || i);
    -- on espace les messages pour ne pas dépasser la limite par minute : réinitialisation du compteur
    reset role;
    delete from public.compteurs_quota where action = 'message' and cle = 'u:' || v_e2::text;
    perform pg_temp.jeton(v_e2); set local role authenticated;
  end loop;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  insert into public.annonces (auteur_id, titre, description, type, part_mensuelle_fcfa, quartier_id, position, statut, publiee_le)
  values (v_p1, 'Annonce vingt et une', 'Une annonce créée pour tester le quota de conversations.', 'chambre', 31000, v_quartier, v_centre, 'publiee', now())
  returning id into v_ann2;
  perform pg_temp.jeton(v_e2); set local role authenticated;
  begin perform public.demarrer_conversation(v_ann2, 'Bonjour'); raise exception 'ÉCHEC RGP20 : vingt et unième conversation acceptée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  raise notice 'OK RGP20 : quota de conversations';

  -- ===================================================================
  -- Compte suspendu, maintenance, annonce supprimée
  -- ===================================================================
  update public.profils set statut = 'suspendu' where id = v_p1;
  perform pg_temp.jeton(v_e1); set local role authenticated;
  begin insert into public.messages (conversation_id, contenu) values (v_conv, 'À un compte suspendu'); raise exception 'ÉCHEC : message à un compte suspendu';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  update public.profils set statut = 'actif' where id = v_p1;
  delete from public.compteurs_quota where action = 'message';

  update public.parametres set valeur = 'true'::jsonb where cle = 'maintenance_active';
  perform pg_temp.jeton(v_p1); set local role authenticated;
  begin insert into public.messages (conversation_id, contenu) values (v_conv, 'En maintenance'); raise exception 'ÉCHEC RGA16 : message pendant la maintenance';
  exception when insufficient_privilege or raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  update public.parametres set valeur = 'false'::jsonb where cle = 'maintenance_active';

  delete from public.annonces where id = v_ann;
  perform pg_temp.jeton(v_e1); set local role authenticated;
  select count(*) into v_nb from public.messages where conversation_id = v_conv;
  if v_nb < 3 then raise exception 'ÉCHEC : conversation perdue avec l''annonce (%)', v_nb; end if;
  select * into v_rec from public.liste_conversations() where id = v_conv;
  if v_rec.annonce_titre is not null then raise exception 'ÉCHEC : titre d''une annonce supprimée'; end if;
  reset role;

  -- ===================================================================
  -- Export, Realtime, droits
  -- ===================================================================
  perform pg_temp.jeton(v_e1); set local role authenticated;
  v_json := public.exporter_mes_donnees() -> 'donnees' -> 'messagerie' -> 'conversations';
  if jsonb_array_length(v_json) < 1 then raise exception 'ÉCHEC RGP11 : conversations absentes de l''export'; end if;
  reset role;
  perform pg_temp.jeton(v_e2); set local role authenticated;
  if (public.exporter_mes_donnees() -> 'donnees' -> 'messagerie' -> 'conversations' -> 0 -> 'messages')::text like '%disponible%' then
    raise exception 'ÉCHEC RGP11 : export du tiers contenant la conversation d''un autre';
  end if;
  reset role;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    raise exception 'ÉCHEC : messages absents de la publication Realtime';
  end if;
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations') then
    raise exception 'ÉCHEC RGP23 : conversations diffusées en temps réel';
  end if;
  if has_function_privilege('anon', 'public.demarrer_conversation(bigint,text)', 'execute')
     or has_function_privilege('anon', 'public.liste_conversations()', 'execute')
     or has_function_privilege('authenticated', 'public.verifier_message()', 'execute')
     or has_function_privilege('authenticated', 'public.exporter_donnees_messagerie(uuid)', 'execute') then
    raise exception 'ÉCHEC RGP17 : droits d''exécution';
  end if;
  raise notice 'OK RGP11, RGP17, RGP23';
end;
$$;

rollback;
