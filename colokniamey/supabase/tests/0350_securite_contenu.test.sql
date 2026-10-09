-- Tests du module S (sécurité du contenu). À exécuter après 0300, 0350 et supabase/seed.sql.
-- Tout est annulé à la fin (rollback). Chaque échec lève une exception « ÉCHEC ».

begin;

do $$
declare
  v_univ bigint;
  v_cgu text;
  v_etu uuid := '00000000-0000-0000-0000-00000000e101';
  v_etu2 uuid := '00000000-0000-0000-0000-00000000e102';
  v_etu3 uuid := '00000000-0000-0000-0000-00000000e103';
  v_adm uuid := '00000000-0000-0000-0000-00000000a101';
  v_meta jsonb;
  v_nb integer;
  v_id1 bigint;
  v_id2 bigint;
  v_chemin text;
  v_msg text;
  v_res public.resultat_verification;
  i integer;
begin
  select id into v_univ from public.universites order by id limit 1;
  select valeur #>> '{}' into v_cgu from public.parametres where cle = 'version_cgu';
  v_meta := jsonb_build_object('role', 'etudiant', 'nom', 'Test', 'prenom', 'Etu', 'telephone', '90000001',
                               'universite_id', v_univ::text, 'cgu_version', v_cgu);
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_etu, 'e101@test.local', v_meta), (v_etu2, 'e102@test.local', v_meta),
    (v_etu3, 'e103@test.local', v_meta), (v_adm, 'a101@test.local', v_meta);
  update public.profils set role = 'super_admin' where id = v_adm;

  -- ===================================================================
  -- Normalisation (RG46)
  -- ===================================================================
  if public.normaliser_texte('S.a.L.o.P.e') <> 'salope' then raise exception 'ÉCHEC RG46 : points insérés'; end if;
  if public.normaliser_texte('s a l o p e') <> 'salope' then raise exception 'ÉCHEC RG46 : espaces insérés'; end if;
  if public.normaliser_texte('P0RN0') <> 'porno' then raise exception 'ÉCHEC RG46 : chiffres à la place des lettres'; end if;
  if public.normaliser_texte('Éléphant') <> 'elephant' then raise exception 'ÉCHEC RG46 : accents'; end if;
  if public.normaliser_texte('saaalope') <> 'salope' then raise exception 'ÉCHEC RG46 : lettres répétées'; end if;
  raise notice 'OK RG46 : normalisation';

  -- ===================================================================
  -- Issues de verifier_texte (RG45)
  -- ===================================================================
  if (public.verifier_texte('Studio meublé à Goudel, proche de l''université')).issue <> 'accepte' then
    raise exception 'ÉCHEC : texte normal non accepté';
  end if;
  -- pas de faux positif sur un mot qui contient un terme (pute dans « disputer », tuer dans « tuerie » non visé)
  if (public.verifier_texte('On peut se disputer le salon sans problème')).issue <> 'accepte' then
    raise exception 'ÉCHEC : faux positif sur un mot contenant un terme';
  end if;
  if (public.verifier_texte('Regarde ce porno')).issue <> 'bloque' then raise exception 'ÉCHEC RG45 : terme bloquant accepté'; end if;
  if (public.verifier_texte('Regarde ce p0rn0')).issue <> 'bloque' then raise exception 'ÉCHEC RG45 : terme écrit avec des chiffres accepté'; end if;
  if (public.verifier_texte('Regarde ce p.o.r.n.o')).issue <> 'bloque' then raise exception 'ÉCHEC RG45 : terme écrit avec des points accepté'; end if;
  if (public.verifier_texte('PORNOOO')).issue <> 'bloque' then raise exception 'ÉCHEC RG45 : lettres répétées acceptées'; end if;
  if (public.verifier_texte('Je va1s te tuer')).issue <> 'bloque' then raise exception 'ÉCHEC RG45 : menace écrite avec un chiffre acceptée'; end if;
  if (public.verifier_texte('sa1ope')).issue <> 'revue' then raise exception 'ÉCHEC RG45 : variante 1 = l non vue'; end if;
  v_res := public.verifier_texte('Je vais tuer le temps');
  if v_res.issue <> 'revue' or v_res.categories <> array['violence'] then raise exception 'ÉCHEC RG45 : revue attendue, obtenu %', v_res.issue; end if;
  -- messages privés (RGA10) : jamais de revue, blocage seulement
  if (public.verifier_texte('Je vais tuer le temps', 'prive')).issue <> 'accepte' then raise exception 'ÉCHEC RGA10 : revue sur un message privé'; end if;
  if (public.verifier_texte('porno', 'prive')).issue <> 'bloque' then raise exception 'ÉCHEC RGA10 : blocage absent en message privé'; end if;
  -- RGA28 : un terme non validé ou inactif ne compte pas
  insert into public.termes_sensibles (terme, categorie, niveau, valide) values ('zzmotinactif', 'violence', 'blocage', false);
  if (public.verifier_texte('zzmotinactif')).issue <> 'accepte' then raise exception 'ÉCHEC RGA28 : terme non validé actif'; end if;
  update public.termes_sensibles set valide = true where terme = public.normaliser_texte('zzmotinactif');
  if (public.verifier_texte('zzmotinactif')).issue <> 'bloque' then raise exception 'ÉCHEC : terme validé inactif'; end if;
  raise notice 'OK RG45/RG46/RGA10/RGA28 : verifier_texte';

  -- ===================================================================
  -- Déclencheur modèle (RG45)
  -- ===================================================================
  create table public.t_contenu (
    id bigint generated always as identity primary key,
    auteur uuid, titre text, description text, en_revue boolean not null default false
  );
  create trigger t_contenu_texte before insert or update on public.t_contenu
    for each row execute function public.controler_colonnes_texte('test', 'public', 'auteur', 'titre', 'description');
  create table public.t_message (id bigint generated always as identity primary key, auteur uuid, corps text);
  create trigger t_message_texte before insert or update on public.t_message
    for each row execute function public.controler_colonnes_texte('message', 'prive', 'auteur', 'corps');

  -- bloqué : exception en français, sans le terme
  begin
    insert into public.t_contenu (auteur, titre, description) values (v_etu, 'Chambre', 'voir mon p.0.r.n.0');
    raise exception 'ÉCHEC RG45 : texte bloquant enregistré';
  exception when raise_exception then
    v_msg := sqlerrm;
    if v_msg like 'ÉCHEC%' then raise; end if;
    if v_msg ilike '%porn%' then raise exception 'ÉCHEC RG45 : le message affiche le terme détecté'; end if;
  end;
  if exists (select 1 from public.t_contenu) then raise exception 'ÉCHEC : ligne bloquée enregistrée'; end if;

  -- accepté
  insert into public.t_contenu (auteur, titre, description) values (v_etu, 'Chambre calme', 'Proche du campus');
  if exists (select 1 from public.t_contenu where en_revue) then raise exception 'ÉCHEC : contenu normal masqué'; end if;

  -- revue : enregistré, masqué, ligne dans contenus_en_revue
  insert into public.t_contenu (auteur, titre, description) values (v_etu, 'Chambre', 'Le voisin dit « je vais tuer le temps »')
    returning id into v_id1;
  if not (select en_revue from public.t_contenu where id = v_id1) then raise exception 'ÉCHEC RG45 : contenu à revoir non masqué'; end if;
  if not exists (select 1 from public.contenus_en_revue
                 where type_contenu = 'test' and contenu_id = v_id1::text and auteur_id = v_etu
                   and statut = 'en_attente' and categories = array['violence']) then
    raise exception 'ÉCHEC RG45 : ligne de revue absente';
  end if;
  -- modifier une colonne sans toucher au texte à revoir ne duplique pas la revue
  update public.t_contenu set titre = 'Chambre 2' where id = v_id1;
  select count(*) into v_nb from public.contenus_en_revue where contenu_id = v_id1::text;
  if v_nb <> 1 then raise exception 'ÉCHEC : revue dupliquée (%)', v_nb; end if;
  -- une modification vers un texte bloquant est refusée
  begin
    update public.t_contenu set description = 'porno' where id = v_id1;
    raise exception 'ÉCHEC RG45 : modification bloquante acceptée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;

  -- messages privés : revue impossible, blocage seulement
  insert into public.t_message (auteur, corps) values (v_etu, 'je vais tuer le temps');
  if exists (select 1 from public.contenus_en_revue where type_contenu = 'message') then
    raise exception 'ÉCHEC RGA10 : un message privé est en revue';
  end if;
  begin
    insert into public.t_message (auteur, corps) values (v_etu, 'daech');
    raise exception 'ÉCHEC RGA10 : message bloquant accepté';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  raise notice 'OK RG45 : déclencheur (blocage, revue, messages privés)';

  -- ===================================================================
  -- Accès aux tables et fonctions sensibles
  -- ===================================================================
  set local role anon;
  begin perform 1 from public.termes_sensibles; raise exception 'ÉCHEC : un visiteur lit les termes';
  exception when insufficient_privilege then null; end;
  begin perform public.controler_texte('x'); raise exception 'ÉCHEC : un visiteur appelle controler_texte';
  exception when insufficient_privilege then null; end;
  reset role;

  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal1"}', v_etu), true);
  set local role authenticated;
  begin perform 1 from public.termes_sensibles; raise exception 'ÉCHEC : un utilisateur lit les termes';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.contenus_en_revue; raise exception 'ÉCHEC : un utilisateur lit les revues';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.violations; raise exception 'ÉCHEC : un utilisateur lit les violations';
  exception when insufficient_privilege then null; end;
  begin perform public.verifier_texte('porno'); raise exception 'ÉCHEC : verifier_texte appelable par un utilisateur';
  exception when insufficient_privilege then null; end;

  -- RG47 : un blocage est journalisé, 3 blocages en 30 jours alertent les admins
  if public.controler_texte('bonjour') <> 'accepte' then raise exception 'ÉCHEC : controler_texte accepte'; end if;
  if public.controler_texte('je vais tuer le temps') <> 'revue' then raise exception 'ÉCHEC : controler_texte revue'; end if;
  for i in 1 .. 3 loop
    if public.controler_texte('porno') <> 'bloque' then raise exception 'ÉCHEC : controler_texte bloque'; end if;
  end loop;
  reset role;
  select count(*) into v_nb from public.violations where auteur_id = v_etu;
  if v_nb <> 3 then raise exception 'ÉCHEC RG47 : % violations journalisées', v_nb; end if;
  if not exists (select 1 from public.notifications where destinataire_id = v_adm and type = 'alerte_contenu') then
    raise exception 'ÉCHEC RG47 : pas d''alerte aux admins après 3 blocages';
  end if;
  if exists (select 1 from public.notifications where type = 'alerte_contenu' and titre like '%' || v_etu::text || '%') then
    raise exception 'ÉCHEC RGA33 : donnée personnelle dans la notification';
  end if;
  raise notice 'OK RG47 : violations et alerte';

  -- ===================================================================
  -- Buckets et Storage (RGP21)
  -- ===================================================================
  if not exists (select 1 from storage.buckets where id = 'photos_en_attente' and not public
                 and file_size_limit = 3145728 and allowed_mime_types @> array['image/jpeg','image/png','image/webp']
                 and array_length(allowed_mime_types, 1) = 3) then
    raise exception 'ÉCHEC RGP21 : bucket photos_en_attente mal configuré';
  end if;
  if not exists (select 1 from storage.buckets where id = 'photos_publiques' and public
                 and file_size_limit = 3145728 and array_length(allowed_mime_types, 1) = 3) then
    raise exception 'ÉCHEC RGP21 : bucket photos_publiques mal configuré';
  end if;

  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal1"}', v_etu), true);
  set local role authenticated;
  -- dossier de l'auteur : accepté
  insert into storage.objects (bucket_id, name) values ('photos_en_attente', v_etu::text || '/a1.webp');
  -- dossier d'un autre utilisateur : refusé
  begin
    insert into storage.objects (bucket_id, name) values ('photos_en_attente', v_etu2::text || '/pirate.webp');
    raise exception 'ÉCHEC RGP21 : écriture dans le dossier d''un autre';
  exception when insufficient_privilege then null; end;
  -- à la racine ou dans un sous-dossier : refusé
  begin
    insert into storage.objects (bucket_id, name) values ('photos_en_attente', 'racine.webp');
    raise exception 'ÉCHEC RGP21 : écriture à la racine';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects (bucket_id, name) values ('photos_en_attente', v_etu::text || '/sous/dossier.webp');
    raise exception 'ÉCHEC RGP21 : écriture dans un sous-dossier';
  exception when insufficient_privilege then null; end;
  -- aucune écriture utilisateur dans photos_publiques
  begin
    insert into storage.objects (bucket_id, name) values ('photos_publiques', v_etu::text || '/a2.webp');
    raise exception 'ÉCHEC RGP21 : écriture dans photos_publiques';
  exception when insufficient_privilege then null; end;
  -- l'auteur ne peut pas supprimer ni modifier ses fichiers en attente
  begin
    delete from storage.objects where bucket_id = 'photos_en_attente' and name = v_etu::text || '/a1.webp';
    get diagnostics v_nb = row_count;
    if v_nb <> 0 then raise exception 'ÉCHEC : suppression directe d''un fichier en attente'; end if;
  exception when insufficient_privilege then null; end; -- Storage interdit déjà toute suppression SQL directe
  -- un autre utilisateur ne voit pas le fichier
  reset role;
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal1"}', v_etu2), true);
  set local role authenticated;
  select count(*) into v_nb from storage.objects where bucket_id = 'photos_en_attente';
  if v_nb <> 0 then raise exception 'ÉCHEC : un autre utilisateur voit la photo en attente'; end if;
  reset role;
  -- un visiteur non plus
  set local role anon;
  select count(*) into v_nb from storage.objects where bucket_id in ('photos_en_attente', 'photos_publiques');
  if v_nb <> 0 then raise exception 'ÉCHEC : un visiteur liste des photos'; end if;
  reset role;
  raise notice 'OK RGP21 : buckets et politiques Storage';

  -- Quota d'envois (RGP20) : 30 par jour, même par l'API Storage directe
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal1"}', v_etu3), true);
  set local role authenticated;
  begin
    for i in 1 .. 31 loop
      insert into storage.objects (bucket_id, name) values ('photos_en_attente', v_etu3::text || '/q' || i || '.webp');
    end loop;
    raise exception 'ÉCHEC RGP20 : plus de 30 envois acceptés';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  raise notice 'OK RGP20 : quota d''envois de photos';

  -- ===================================================================
  -- Photos : enregistrement, empreintes, décision (RG49, RG50)
  -- ===================================================================
  if public.distance_empreintes('ffffffffffffffff', 'fffffffffffffff0') <> 4 then raise exception 'ÉCHEC : distance de Hamming'; end if;

  -- Aucune écriture directe dans photos
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal1"}', v_etu), true);
  set local role authenticated;
  begin
    insert into public.photos (proprietaire_id, usage, chemin, empreinte)
    values (v_etu, 'avatar', v_etu::text || '/x.webp', 'aaaaaaaaaaaaaaaa');
    raise exception 'ÉCHEC : insertion directe dans photos';
  exception when insufficient_privilege then null; end;

  -- enregistrer_photo : refuse un chemin hors dossier, un fichier absent, un mauvais usage
  begin perform public.enregistrer_photo(v_etu2::text || '/a1.webp', 'avatar', 'aaaaaaaaaaaaaaaa');
    raise exception 'ÉCHEC : chemin d''un autre accepté';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.enregistrer_photo(v_etu::text || '/absent.webp', 'avatar', 'aaaaaaaaaaaaaaaa');
    raise exception 'ÉCHEC : fichier absent accepté';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.enregistrer_photo(v_etu::text || '/a1.webp', 'kyc', 'aaaaaaaaaaaaaaaa');
    raise exception 'ÉCHEC : usage invalide accepté';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin perform public.enregistrer_photo(v_etu::text || '/a1.webp', 'avatar', 'pas-une-empreinte');
    raise exception 'ÉCHEC : empreinte invalide acceptée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;

  v_id1 := public.enregistrer_photo(v_etu::text || '/a1.webp', 'avatar', 'aaaaaaaaaaaaaaaa');
  reset role;
  if (select suspecte from public.photos where id = v_id1) then raise exception 'ÉCHEC : première photo marquée suspecte'; end if;

  -- Une photo quasi identique, envoyée par un autre auteur, est marquée suspecte (RG50)
  insert into storage.objects (bucket_id, name) values ('photos_en_attente', v_etu2::text || '/b1.webp');
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal1"}', v_etu2), true);
  set local role authenticated;
  v_id2 := public.enregistrer_photo(v_etu2::text || '/b1.webp', 'avatar', 'aaaaaaaaaaaaaaa0');
  reset role;
  if not (select suspecte from public.photos where id = v_id2) then raise exception 'ÉCHEC RG50 : photo réutilisée non marquée suspecte'; end if;

  -- Un utilisateur ne décide pas, et ne lit pas les photos des autres
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal1"}', v_etu), true);
  set local role authenticated;
  begin perform public.decider_photo(v_id2, 'valider'); raise exception 'ÉCHEC RG49 : un utilisateur décide';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  select count(*) into v_nb from public.photos;
  if v_nb <> 1 then raise exception 'ÉCHEC RG10 : un utilisateur voit % photos', v_nb; end if;
  reset role;

  -- Un admin sans aal2 ne décide pas (RGA04)
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal1"}', v_adm), true);
  set local role authenticated;
  begin perform public.decider_photo(v_id2, 'valider'); raise exception 'ÉCHEC RGA04 : admin sans aal2 décide';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;

  -- Admin aal2 : refus sans motif impossible, refus motivé, journalisé et notifié
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal2"}', v_adm), true);
  set local role authenticated;
  begin perform public.decider_photo(v_id1, 'refuser'); raise exception 'ÉCHEC : refus sans motif accepté';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  v_chemin := public.decider_photo(v_id1, 'refuser', 'Visage non visible');
  if v_chemin <> v_etu::text || '/a1.webp' then raise exception 'ÉCHEC : chemin renvoyé inattendu'; end if;
  begin perform public.decider_photo(v_id1, 'valider'); raise exception 'ÉCHEC : photo déjà traitée décidée à nouveau';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  perform public.decider_photo(v_id2, 'valider');
  reset role;
  if not exists (select 1 from public.journal_audit where action = 'photo_refuser' and cible_id = v_id1::text and acteur_id = v_adm) then
    raise exception 'ÉCHEC RGA06 : décision non journalisée';
  end if;
  if not exists (select 1 from public.notifications where destinataire_id = v_etu and type = 'photo_decision' and titre like '%Visage non visible%') then
    raise exception 'ÉCHEC : l''auteur n''est pas notifié';
  end if;

  -- Une photo déjà refusée est bloquée, même légèrement modifiée (RG50)
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal1"}', v_etu3), true);
  set local role authenticated;
  begin perform public.precontroler_photo('aaaaaaaaaaaaaaa3'); raise exception 'ÉCHEC RG50 : photo refusée non bloquée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  perform public.precontroler_photo('0123456789abcdef'); -- empreinte inconnue : passe
  reset role;

  -- Un admin ne décide pas de sa propre photo (RGA02)
  insert into storage.objects (bucket_id, name) values ('photos_en_attente', v_adm::text || '/c1.webp');
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal2"}', v_adm), true);
  set local role authenticated;
  v_id1 := public.enregistrer_photo(v_adm::text || '/c1.webp', 'avatar', '5555aaaa5555aaaa');
  begin perform public.decider_photo(v_id1, 'valider'); raise exception 'ÉCHEC RGA02 : l''admin valide sa propre photo';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  reset role;
  raise notice 'OK RG49/RG50/RGA02/RGA04/RGA06 : photos';

  -- RGP17 : aucune fonction interne exécutable par l'API
  if has_function_privilege('authenticated', 'public.verifier_texte(text,text)', 'execute')
     or has_function_privilege('anon', 'public.verifier_empreinte(text,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.controler_colonnes_texte()', 'execute')
     or has_function_privilege('anon', 'public.normaliser_texte(text,integer)', 'execute')
     or has_function_privilege('anon', 'public.decider_photo(bigint,text,text)', 'execute') then
    raise exception 'ÉCHEC RGP17 : fonction interne exécutable par l''API';
  end if;
  raise notice 'OK RGP17';
end;
$$;

rollback;
