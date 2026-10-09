-- Tests du module M1 (référentiel). À exécuter après 0200, 0210 et supabase/seed.sql.
-- Tout est annulé à la fin (rollback). Chaque échec lève une exception « ÉCHEC ».

begin;

do $$
declare
  v_nb integer;
  v_ville bigint;
  v_autre bigint;
  v_quartier_autre bigint;
begin
  select id into v_ville from public.villes where nom = 'Niamey';
  if v_ville is null then raise exception 'ÉCHEC : seed.sql n''a pas été appliqué (Niamey absente)'; end if;

  -- Un visiteur lit les universités, y compris celles sans position (RG25 bis)
  set local role anon;
  select count(*) into v_nb from public.universites_geo;
  if v_nb < 1 then raise exception 'ÉCHEC : un visiteur ne lit aucune université'; end if;
  select count(*) into v_nb from public.universites_geo where latitude is null;
  if v_nb < 1 then raise exception 'ÉCHEC RG25 bis : aucune université sans position dans la liste'; end if;
  select count(*) into v_nb from public.quartiers_geo;
  if v_nb < 1 then raise exception 'ÉCHEC : un visiteur ne lit aucun quartier'; end if;
  reset role;
  raise notice 'OK : un visiteur lit villes, quartiers et universités (avec et sans position)';

  -- Un visiteur ou un utilisateur connecté ne peut rien créer, modifier ni supprimer
  set local role anon;
  begin
    insert into public.universites (nom, ville_id) values ('Pirate', v_ville);
    raise exception 'ÉCHEC : un visiteur a créé une université';
  exception when insufficient_privilege then
    raise notice 'OK : création refusée à un visiteur';
  end;
  reset role;

  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
  set local role authenticated;
  begin
    insert into public.universites (nom, ville_id) values ('Pirate', v_ville);
    raise exception 'ÉCHEC : un connecté a créé une université';
  exception when insufficient_privilege then
    raise notice 'OK : création refusée à un connecté';
  end;
  begin
    update public.universites set nom = 'Modifiée';
    raise exception 'ÉCHEC : un connecté a modifié une université';
  exception when insufficient_privilege then
    raise notice 'OK : modification refusée à un connecté';
  end;
  begin
    delete from public.universites;
    raise exception 'ÉCHEC : un connecté a supprimé des universités';
  exception when insufficient_privilege then
    raise notice 'OK : suppression refusée à un connecté';
  end;
  reset role;

  -- RG22 : une position hors de la zone de la ville est refusée (Paris, loin de Niamey)
  begin
    insert into public.universites (nom, ville_id, position)
    values ('Hors zone', v_ville, 'SRID=4326;POINT(2.35 48.85)'::extensions.geography);
    raise exception 'ÉCHEC RG22 : position hors zone acceptée pour une université';
  exception when raise_exception then
    if sqlerrm not like '%en dehors de la zone%' then raise; end if;
    raise notice 'OK RG22 : université hors zone refusée';
  end;
  begin
    insert into public.quartiers (nom, ville_id, centre)
    values ('Hors zone', v_ville, 'SRID=4326;POINT(2.35 48.85)'::extensions.geography);
    raise exception 'ÉCHEC RG22 : centre hors zone accepté pour un quartier';
  exception when raise_exception then
    if sqlerrm not like '%en dehors de la zone%' then raise; end if;
    raise notice 'OK RG22 : quartier hors zone refusé';
  end;

  -- Une position dans la zone est acceptée ; sans position aussi (RG25 bis)
  insert into public.universites (nom, ville_id, position)
  values ('Dans la zone', v_ville, 'SRID=4326;POINT(2.10 13.51)'::extensions.geography);
  insert into public.universites (nom, ville_id) values ('Sans position', v_ville);
  raise notice 'OK RG22/RG25 bis : position dans la zone et absence de position acceptées';

  -- Unicité (nom, ville)
  begin
    insert into public.universites (nom, ville_id) values ('Sans position', v_ville);
    raise exception 'ÉCHEC : doublon d''université accepté';
  exception when unique_violation then
    raise notice 'OK : doublon (nom, ville) refusé';
  end;

  -- RG07 : le quartier d'une université doit être dans la même ville
  insert into public.villes (nom, centre, rayon_km)
  values ('Ville de test', 'SRID=4326;POINT(0 0)'::extensions.geography, 10) returning id into v_autre;
  insert into public.quartiers (nom, ville_id) values ('Quartier de test', v_autre) returning id into v_quartier_autre;
  begin
    insert into public.universites (nom, ville_id, quartier_id) values ('Mauvais quartier', v_ville, v_quartier_autre);
    raise exception 'ÉCHEC RG07 : quartier d''une autre ville accepté';
  exception when raise_exception then
    if sqlerrm not like '%n''appartient pas%' then raise; end if;
    raise notice 'OK RG07 : quartier d''une autre ville refusé';
  end;

  -- RGP17 : le déclencheur n'est pas appelable par l'API
  if has_function_privilege('anon', 'public.verifier_zone_ville()', 'execute')
     or has_function_privilege('authenticated', 'public.verifier_zone_ville()', 'execute') then
    raise exception 'ÉCHEC RGP17 : verifier_zone_ville() est exécutable par l''API';
  end if;
  raise notice 'OK RGP17 : verifier_zone_ville() non appelable';
end;
$$;

rollback;
