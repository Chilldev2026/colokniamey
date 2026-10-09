-- Tests du module M2 (comptes). À exécuter après 0300 et supabase/seed.sql.
-- Les comptes de test sont créés directement dans auth.users, dans une transaction annulée à la fin.
-- Chaque échec lève une exception « ÉCHEC ».

begin;

do $$
declare
  v_univ bigint;
  v_cgu text;
  v_etu uuid := '00000000-0000-0000-0000-00000000e001';
  v_etu2 uuid := '00000000-0000-0000-0000-00000000e002';
  v_prop uuid := '00000000-0000-0000-0000-00000000f001';
  v_adm uuid := '00000000-0000-0000-0000-00000000a001';
  v_nb integer;
  v_ok boolean;
  v_meta jsonb;
begin
  select id into v_univ from public.universites order by id limit 1;
  if v_univ is null then raise exception 'ÉCHEC : seed.sql non appliqué'; end if;
  select valeur #>> '{}' into v_cgu from public.parametres where cle = 'version_cgu';

  v_meta := jsonb_build_object('role', 'etudiant', 'nom', 'Test', 'prenom', 'Etu', 'telephone', '+227 90 00 00 01',
                               'universite_id', v_univ::text, 'cgu_version', v_cgu);

  -- Inscription étudiant valide : profil de base et profil étudiant créés (RG05, RG06)
  insert into auth.users (id, email, raw_user_meta_data) values (v_etu, 'etu@test.local', v_meta);
  if not exists (select 1 from public.profils where id = v_etu and role = 'etudiant' and statut = 'actif' and cgu_version = v_cgu) then
    raise exception 'ÉCHEC : profil étudiant non créé';
  end if;
  if not exists (select 1 from public.profils_etudiants where user_id = v_etu and universite_id = v_univ) then
    raise exception 'ÉCHEC RG06 : profil étudiant non créé';
  end if;
  raise notice 'OK RG05/RG06 : inscription étudiant';

  -- Inscription propriétaire valide
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_prop, 'prop@test.local', jsonb_build_object('role', 'proprietaire', 'nom', 'Test', 'prenom', 'Prop',
          'telephone', '90000002', 'cgu_version', v_cgu, 'type_proprietaire', 'agence'));
  if not exists (select 1 from public.profils_proprietaires where user_id = v_prop and type_proprietaire = 'agence') then
    raise exception 'ÉCHEC : profil propriétaire non créé';
  end if;
  if exists (select 1 from public.profils_etudiants where user_id = v_prop) then
    raise exception 'ÉCHEC RG05 : un propriétaire a un profil étudiant';
  end if;
  raise notice 'OK RG05 : inscription propriétaire, un seul profil de rôle';

  -- RG03, RGA05 : les rôles admin et super_admin sont refusés à l'inscription
  foreach v_ok in array array[true, false] loop
    begin
      insert into auth.users (id, email, raw_user_meta_data)
      values (gen_random_uuid(), 'pirate@test.local', v_meta || jsonb_build_object('role', case when v_ok then 'admin' else 'super_admin' end));
      raise exception 'ÉCHEC RG03 : rôle privilégié accepté à l''inscription';
    exception when raise_exception then
      if sqlerrm like 'ÉCHEC%' then raise; end if;
    end;
  end loop;
  raise notice 'OK RG03 : admin et super_admin refusés';

  -- RG06 : étudiant sans université, ou avec une université inexistante
  begin
    insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'a@test.local', v_meta - 'universite_id');
    raise exception 'ÉCHEC RG06 : étudiant sans université accepté';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin
    insert into auth.users (id, email, raw_user_meta_data)
    values (gen_random_uuid(), 'b@test.local', v_meta || jsonb_build_object('universite_id', '999999'));
    raise exception 'ÉCHEC RG06 : université inexistante acceptée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  raise notice 'OK RG06 : université obligatoire et existante';

  -- RG11 : téléphone obligatoire et valide
  begin
    insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'c@test.local', v_meta - 'telephone');
    raise exception 'ÉCHEC RG11 : inscription sans téléphone acceptée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin
    insert into auth.users (id, email, raw_user_meta_data)
    values (gen_random_uuid(), 'd@test.local', v_meta || jsonb_build_object('telephone', 'abc'));
    raise exception 'ÉCHEC RG11 : téléphone invalide accepté';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  raise notice 'OK RG11 : téléphone obligatoire';

  -- RGP12 : conditions acceptées dans la version en vigueur
  begin
    insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'e@test.local', v_meta - 'cgu_version');
    raise exception 'ÉCHEC RGP12 : inscription sans acceptation des conditions';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin
    insert into auth.users (id, email, raw_user_meta_data)
    values (gen_random_uuid(), 'f@test.local', v_meta || jsonb_build_object('cgu_version', '0.0'));
    raise exception 'ÉCHEC RGP12 : mauvaise version acceptée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  raise notice 'OK RGP12 : acceptation des conditions obligatoire';

  -- Inscriptions fermées
  update public.parametres set valeur = 'false' where cle = 'inscriptions_ouvertes';
  begin
    insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'g@test.local', v_meta);
    raise exception 'ÉCHEC : inscription acceptée alors que les inscriptions sont fermées';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  update public.parametres set valeur = 'true' where cle = 'inscriptions_ouvertes';
  raise notice 'OK : inscriptions fermées refusées';

  -- Second étudiant (pour tester l'isolation)
  insert into auth.users (id, email, raw_user_meta_data) values (v_etu2, 'etu2@test.local', v_meta);

  -- RG05 : un profil étudiant ne peut pas être créé pour un propriétaire
  begin
    insert into public.profils_etudiants (user_id, universite_id) values (v_prop, v_univ);
    raise exception 'ÉCHEC RG05 : profil étudiant créé pour un propriétaire';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  raise notice 'OK RG05 : profil cohérent avec le rôle';

  -- Visiteur : aucun accès aux profils ni aux fonctions de droits
  set local role anon;
  begin
    perform 1 from public.profils;
    raise exception 'ÉCHEC : un visiteur lit les profils';
  exception when insufficient_privilege then null; end;
  begin
    perform public.est_admin();
    raise exception 'ÉCHEC : un visiteur appelle est_admin()';
  exception when insufficient_privilege then null; end;
  reset role;
  raise notice 'OK : visiteur sans accès aux profils ni aux fonctions de droits';

  -- Étudiant connecté
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal1"}', v_etu), true);
  set local role authenticated;

  -- RG10 : ne lit que son propre profil
  select count(*) into v_nb from public.profils;
  if v_nb <> 1 then raise exception 'ÉCHEC RG10 : l''étudiant voit % profils', v_nb; end if;
  select count(*) into v_nb from public.profils where id = v_etu2;
  if v_nb <> 0 then raise exception 'ÉCHEC RG10 : lecture du profil d''un autre'; end if;
  select count(*) into v_nb from public.profils_etudiants;
  if v_nb <> 1 then raise exception 'ÉCHEC RG10 : l''étudiant voit % profils étudiants', v_nb; end if;

  -- RG10 : ne modifie pas le profil d'un autre
  update public.profils set nom = 'Piraté' where id = v_etu2;
  get diagnostics v_nb = row_count;
  if v_nb <> 0 then raise exception 'ÉCHEC RG10 : modification du profil d''un autre'; end if;

  -- Il modifie son propre nom
  update public.profils set nom = 'Nouveau' where id = v_etu;
  get diagnostics v_nb = row_count;
  if v_nb <> 1 then raise exception 'ÉCHEC : l''étudiant ne peut pas modifier son nom'; end if;

  -- RG03 : il ne change ni son rôle, ni son statut, ni les champs de suspension
  begin
    update public.profils set role = 'admin' where id = v_etu;
    raise exception 'ÉCHEC RG03 : changement de rôle accepté';
  exception when insufficient_privilege then null; end;
  begin
    update public.profils set role = 'super_admin' where id = v_etu;
    raise exception 'ÉCHEC RG03 : changement de rôle accepté';
  exception when insufficient_privilege then null; end;
  begin
    update public.profils set statut = 'actif', motif_suspension = 'x' where id = v_etu;
    raise exception 'ÉCHEC : modification du statut ou du motif acceptée';
  exception when insufficient_privilege then null; end;
  begin
    update public.profils set cgu_version = '9.9' where id = v_etu;
    raise exception 'ÉCHEC : modification de la version des conditions acceptée';
  exception when insufficient_privilege then null; end;
  raise notice 'OK RG03/RG10 : isolation des profils, rôle et statut non modifiables';

  -- Aucune création ni suppression directe
  begin
    insert into public.profils (id, nom, prenom, telephone, cgu_version) values (gen_random_uuid(), 'a', 'b', '90000009', '1.0');
    raise exception 'ÉCHEC : insertion directe dans profils';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.profils where id = v_etu;
    raise exception 'ÉCHEC : suppression directe de profil';
  exception when insufficient_privilege then null; end;

  -- Un étudiant n'est pas admin, même avec aal2
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal2"}', v_etu), true);
  if public.est_admin() or public.est_super_admin() then raise exception 'ÉCHEC : un étudiant est admin'; end if;
  if not public.est_actif() then raise exception 'ÉCHEC : un étudiant actif n''est pas actif'; end if;

  -- Acceptation des conditions : seule la version en vigueur
  begin
    perform public.accepter_cgu('0.0');
    raise exception 'ÉCHEC : ancienne version acceptée';
  exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  perform public.accepter_cgu(v_cgu);
  reset role;
  raise notice 'OK : accepter_cgu';

  -- Compte suspendu : plus d'écriture (RG08), et est_actif() faux
  update public.profils set statut = 'suspendu' where id = v_etu;
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal1"}', v_etu), true);
  set local role authenticated;
  update public.profils set nom = 'Suspendu' where id = v_etu;
  get diagnostics v_nb = row_count;
  if v_nb <> 0 then raise exception 'ÉCHEC RG08 : un compte suspendu écrit'; end if;
  if public.est_actif() or public.peut_ecrire() then raise exception 'ÉCHEC RG08 : compte suspendu actif'; end if;
  reset role;
  update public.profils set statut = 'actif' where id = v_etu;
  raise notice 'OK RG08 : compte suspendu sans écriture';

  -- Administrateur : exige le rôle ET le jeton aal2 (RGA04)
  update public.profils set role = 'admin' where id = v_adm; -- sans effet : le compte n'existe pas encore
  insert into auth.users (id, email, raw_user_meta_data) values (v_adm, 'adm@test.local', v_meta);
  update public.profils set role = 'super_admin' where id = v_adm;
  -- A2 (RGA36) : est_admin() exige aussi une session admin active
  insert into public.sessions_admin (session_id, user_id) values ('00000000-0000-0000-0000-0000000005e5', v_adm);

  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal1"}', v_adm), true);
  set local role authenticated;
  if public.est_admin() then raise exception 'ÉCHEC RGA04 : admin accepté sans aal2'; end if;
  select count(*) into v_nb from public.profils;
  if v_nb <> 1 then raise exception 'ÉCHEC RGA04 : l''admin sans aal2 voit % profils', v_nb; end if;
  reset role;

  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal2","session_id":"00000000-0000-0000-0000-0000000005e5"}', v_adm), true);
  set local role authenticated;
  if not (public.est_admin() and public.est_super_admin()) then raise exception 'ÉCHEC RGA04 : super_admin aal2 refusé'; end if;
  select count(*) into v_nb from public.profils;
  if v_nb < 4 then raise exception 'ÉCHEC : l''admin aal2 ne lit pas tous les profils (%)', v_nb; end if;
  reset role;
  raise notice 'OK RGA04 : admin = rôle + aal2, lecture de tous les profils';

  -- Maintenance (RGA16) : un étudiant n'écrit plus, un admin aal2 oui
  update public.parametres set valeur = 'true' where cle = 'maintenance_active';
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal1"}', v_etu), true);
  set local role authenticated;
  if public.peut_ecrire() then raise exception 'ÉCHEC RGA16 : écriture permise en maintenance'; end if;
  reset role;
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","aal":"aal2","session_id":"00000000-0000-0000-0000-0000000005e5"}', v_adm), true);
  set local role authenticated;
  if not public.peut_ecrire() then raise exception 'ÉCHEC RGA16 : un admin ne peut pas écrire en maintenance'; end if;
  reset role;
  raise notice 'OK RGA16 : maintenance';

  -- RGP17 : déclencheurs non appelables par l'API
  if has_function_privilege('anon', 'public.handle_new_user()', 'execute')
     or has_function_privilege('authenticated', 'public.handle_new_user()', 'execute') then
    raise exception 'ÉCHEC RGP17 : handle_new_user() exécutable par l''API';
  end if;
  raise notice 'OK RGP17';
end;
$$;

rollback;
