-- Tests du module M0 (socle). À exécuter dans l'éditeur SQL de Supabase ou avec psql.
-- Tout est annulé à la fin (rollback) : aucune donnée ne reste.
-- Chaque test lève une exception en cas d'échec ; le message « OK » s'affiche pour les réussites.

begin;

do $$
declare
  v_nb integer;
  v_ok boolean;
begin
  -- RGP04 : toutes les tables de public ont la RLS activée
  select count(*) into v_nb
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if v_nb > 0 then raise exception 'ÉCHEC RGP04 : % table(s) sans RLS', v_nb; end if;
  raise notice 'OK RGP04 : RLS active partout';

  -- Un visiteur anonyme peut enregistrer une visite et une erreur (RGA18, RGA19)
  set local role anon;
  perform public.enregistrer_visite('/annonces?q=secret', 'mobile', 'session-test-0001');
  perform public.enregistrer_erreur('Erreur de test', 'core', '/test', 'session-test-0001');
  perform public.enregistrer_erreur('Erreur de test', 'core', '/test', 'session-test-0001');
  reset role;

  select count(*) into v_nb from public.visites where session_id = 'session-test-0001' and chemin = '/annonces';
  if v_nb <> 1 then raise exception 'ÉCHEC RGA18 : visite absente ou chemin non nettoyé'; end if;
  select occurrences into v_nb from public.erreurs where message = 'Erreur de test';
  if v_nb <> 2 then raise exception 'ÉCHEC RGA19 : les erreurs identiques ne sont pas regroupées'; end if;
  raise notice 'OK RGA18/RGA19 : visite et erreur enregistrées par un anonyme';

  -- journal_audit : lecture directe interdite à l'anonyme (RGA07)
  set local role anon;
  begin
    perform 1 from public.journal_audit;
    raise exception 'ÉCHEC : un anonyme a lu journal_audit';
  exception when insufficient_privilege then
    raise notice 'OK RGA07 : lecture de journal_audit refusée à un anonyme';
  end;
  reset role;

  -- journal_audit en ajout seul, même pour le propriétaire (déclencheur)
  insert into public.journal_audit (action) values ('test');
  begin
    update public.journal_audit set action = 'modifie';
    raise exception 'ÉCHEC : UPDATE possible sur journal_audit';
  exception when raise_exception then
    if sqlerrm not like '%ajout seul%' then raise; end if;
    raise notice 'OK RGA07 : UPDATE bloqué';
  end;
  begin
    delete from public.journal_audit;
    raise exception 'ÉCHEC : DELETE possible sur journal_audit';
  exception when raise_exception then
    if sqlerrm not like '%ajout seul%' then raise; end if;
    raise notice 'OK RGA07 : DELETE bloqué';
  end;

  -- Fonctions internes : aucun appel anonyme ni connecté (RGP17)
  set local role anon;
  begin
    perform public.journaliser('x', null, null);
    raise exception 'ÉCHEC : journaliser() appelable par un anonyme';
  exception when insufficient_privilege then
    raise notice 'OK RGP17 : journaliser() refusée à un anonyme';
  end;
  begin
    perform public.notifier(gen_random_uuid(), 'x', 'x');
    raise exception 'ÉCHEC : notifier() appelable par un anonyme';
  exception when insufficient_privilege then
    raise notice 'OK RGP17 : notifier() refusée à un anonyme';
  end;
  reset role;

  set local role authenticated;
  begin
    perform public.journaliser('x', null, null);
    raise exception 'ÉCHEC : journaliser() appelable par un connecté';
  exception when insufficient_privilege then
    raise notice 'OK RGP17 : journaliser() refusée à un connecté';
  end;
  reset role;

  -- Rafale d'appels à enregistrer_visite : au-delà de 30 par minute et par session, ignoré (RGP20)
  set local role anon;
  for i in 1..40 loop
    perform public.enregistrer_visite('/rafale', 'mobile', 'session-rafale-01');
  end loop;
  reset role;
  select count(*) into v_nb from public.visites where session_id = 'session-rafale-01';
  if v_nb <> 30 then raise exception 'ÉCHEC RGP20 : % visites gardées au lieu de 30', v_nb; end if;
  raise notice 'OK RGP20 : la rafale est plafonnée à 30';

  -- verifier_quota : refuse au-delà du maximum (20 messages par minute), puis accepte après la fenêtre
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  set local role authenticated;
  for i in 1..20 loop
    perform public.verifier_quota('message');
  end loop;
  begin
    perform public.verifier_quota('message');
    raise exception 'ÉCHEC RGP20 : le 21e message aurait dû être refusé';
  exception when raise_exception then
    if sqlerrm not like '%trop de demandes%' then raise; end if;
    raise notice 'OK RGP20 : le 21e message est refusé';
  end;
  reset role;

  -- On recule les compteurs de 2 minutes : la fenêtre d'une minute est passée
  update public.compteurs_quota set fenetre_debut = fenetre_debut - interval '2 minutes'
  where cle = 'u:00000000-0000-0000-0000-0000000000a1' and fenetre_secondes = 60;
  set local role authenticated;
  perform public.verifier_quota('message');
  reset role;
  raise notice 'OK RGP20 : accepté à nouveau après la fenêtre';
end;
$$;

rollback;
