-- 0950_plateforme.sql
-- Module A5 : plateforme (maintenance, paramètres, administration du référentiel). RGA15 à RGA17, RG22, RG25 bis, RG29, RGP23.
--
-- Modifications d'objets d'autres modules (à signaler) :
--  - alertes_files() et donnees_recapitulatif() de A2 sont remplacées pour lire le seuil d'ancienneté dans le paramètre
--    seuil_relance_heures (24 h par défaut) et pour ignorer les files marquées alerter = false ;
--  - files_admin (A2) reçoit la colonne alerter ;
--  - les tables villes, quartiers et universites (M1) reçoivent leurs politiques d'écriture pour les admins
--    (autorisé : un module admin peut ajouter des politiques sur les tables du module qu'il gère).
--
-- Données personnelles : aucune. Le référentiel et les paramètres décrivent la plateforme, pas des personnes.

-- =====================================================================
-- Paramètres supplémentaires
-- =====================================================================
insert into public.parametres (cle, valeur, publique) values
  ('kyc_actif', 'false', true),                -- RG59 : KYC désactivé par défaut (le client masque les écrans)
  ('kyc_proprietaires', 'false', true),
  ('heure_recapitulatif', '7', false),         -- heure UTC du récapitulatif quotidien (7 h UTC = 8 h à Niamey)
  ('seuil_relance_heures', '24', false)        -- RGA34 : ancienneté qui déclenche une nouvelle alerte
on conflict (cle) do nothing;

-- =====================================================================
-- Diffusion en temps réel de l'état de la plateforme (RGP23)
-- Le canal « plateforme » est privé ; la politique ci-dessous autorise la lecture à tout le monde, visiteurs compris,
-- car l'état de maintenance concerne tous les utilisateurs. Seuls les paramètres publics y sont diffusés.
-- =====================================================================
create policy plateforme_lecture on realtime.messages for select to anon, authenticated
  using (realtime.topic() = 'plateforme' and extension = 'broadcast');

create function public.diffuser_parametre()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.publique then
    begin
      perform realtime.send(jsonb_build_object('cle', new.cle, 'valeur', new.valeur), 'parametre', 'plateforme', true);
    exception when others then
      -- la diffusion est un confort : les utilisateurs retrouvent l'état à leur prochaine navigation
      null;
    end;
  end if;
  return null;
end;
$$;

create trigger parametres_diffusion after insert or update on public.parametres
  for each row execute function public.diffuser_parametre();

-- =====================================================================
-- Maintenance (RGA15, RGA16)
-- =====================================================================
create function public.definir_maintenance(p_active boolean, p_message text default null, p_fin timestamptz default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message text := btrim(coalesce(p_message, ''));
begin
  -- RGA15 : réservé au super-admin
  if not public.est_super_admin() then
    raise exception 'Action non autorisée.';
  end if;
  if char_length(v_message) > 300 then
    raise exception 'Le message est limité à 300 caractères.';
  end if;
  if p_active and p_fin is not null and p_fin <= now() then
    raise exception 'L''heure de fin prévue doit être dans le futur.';
  end if;

  -- le message et l'heure de fin d'abord, l'activation en dernier : les utilisateurs voient une page complète
  update public.parametres set valeur = to_jsonb(v_message), updated_at = now() where cle = 'maintenance_message';
  update public.parametres set valeur = coalesce(to_jsonb(case when p_active then p_fin end), 'null'::jsonb), updated_at = now() where cle = 'maintenance_fin';
  update public.parametres set valeur = to_jsonb(p_active), updated_at = now() where cle = 'maintenance_active';

  perform public.journaliser(case when p_active then 'maintenance_activee' else 'maintenance_desactivee' end,
    'plateforme', 'maintenance', jsonb_build_object('message', v_message, 'fin', case when p_active then p_fin end));
end;
$$;

-- =====================================================================
-- Paramètres (RGA17)
-- =====================================================================
-- Lecture de tous les paramètres modifiables, publics ou non : admins (lecture seule) et super-admin.
create function public.liste_parametres()
returns table (cle text, valeur jsonb, publique boolean, modifie_le timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.est_admin() then
    raise exception 'Action non autorisée.';
  end if;
  return query
    select p.cle, p.valeur, p.publique, p.updated_at from public.parametres p
    where p.cle in (
      'maintenance_active', 'maintenance_message', 'maintenance_fin',
      'inscriptions_ouvertes', 'validation_annonces', 'photos_max', 'photo_taille_max_mo', 'photo_dimension_min', 'nsfw_seuil',
      'version_cgu', 'inactivite_etudiant_jours', 'inactivite_proprietaire_jours',
      'kyc_actif', 'kyc_proprietaires', 'email_domaine_verifie', 'heure_recapitulatif', 'seuil_relance_heures'
    )
    order by p.cle;
end;
$$;

-- Modification typée et validée d'un paramètre, super-admin seulement, journalisée.
-- La maintenance a sa propre fonction (definir_maintenance).
create function public.modifier_parametre(p_cle text, p_valeur jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := jsonb_typeof(p_valeur);
  v_nombre numeric;
  v_ancien jsonb;
  v_publique boolean;
begin
  if not public.est_super_admin() then
    raise exception 'Action non autorisée.';
  end if;

  v_nombre := case when v_type = 'number' then (p_valeur #>> '{}')::numeric end;

  case p_cle
    when 'inscriptions_ouvertes', 'validation_annonces', 'kyc_actif', 'kyc_proprietaires', 'email_domaine_verifie' then
      if v_type <> 'boolean' then raise exception 'Cette valeur doit être oui ou non.'; end if;
      v_publique := p_cle <> 'email_domaine_verifie';
    when 'photos_max' then
      if v_nombre is null or v_nombre <> trunc(v_nombre) or v_nombre not between 1 and 10 then
        raise exception 'Le nombre de photos doit être un entier entre 1 et 10.';
      end if;
      v_publique := true;
    when 'photo_taille_max_mo' then
      if v_nombre is null or v_nombre <> trunc(v_nombre) or v_nombre not between 1 and 20 then
        raise exception 'La taille maximale doit être un entier de Mo entre 1 et 20.';
      end if;
      v_publique := true;
    when 'photo_dimension_min' then
      if v_nombre is null or v_nombre <> trunc(v_nombre) or v_nombre not between 100 and 2000 then
        raise exception 'La dimension minimale doit être un entier entre 100 et 2000 pixels.';
      end if;
      v_publique := true;
    when 'nsfw_seuil' then
      if v_nombre is null or v_nombre not between 0.3 and 1 then
        raise exception 'Le seuil doit être un nombre entre 0,3 et 1.';
      end if;
      v_publique := true;
    when 'inactivite_etudiant_jours', 'inactivite_proprietaire_jours' then
      if v_nombre is null or v_nombre <> trunc(v_nombre) or v_nombre not between 1 and 90 then
        raise exception 'Le délai doit être un entier de jours entre 1 et 90.';
      end if;
      v_publique := true;
    when 'version_cgu' then
      if v_type <> 'string' or (p_valeur #>> '{}') !~ '^[0-9A-Za-z.-]{1,20}$' then
        raise exception 'La version doit contenir de 1 à 20 caractères (lettres, chiffres, point, tiret).';
      end if;
      v_publique := true;
    when 'heure_recapitulatif' then
      if v_nombre is null or v_nombre <> trunc(v_nombre) or v_nombre not between 0 and 23 then
        raise exception 'L''heure doit être un entier entre 0 et 23 (heure UTC).';
      end if;
      v_publique := false;
    when 'seuil_relance_heures' then
      if v_nombre is null or v_nombre <> trunc(v_nombre) or v_nombre not between 1 and 168 then
        raise exception 'Le seuil doit être un entier d''heures entre 1 et 168.';
      end if;
      v_publique := false;
    else
      raise exception 'Ce paramètre n''existe pas ou ne se modifie pas ici.';
  end case;

  select valeur into v_ancien from public.parametres where cle = p_cle;
  insert into public.parametres (cle, valeur, publique) values (p_cle, p_valeur, v_publique)
  on conflict (cle) do update set valeur = excluded.valeur, updated_at = now();

  -- l'heure du récapitulatif quotidien décale la tâche planifiée
  if p_cle = 'heure_recapitulatif' then
    begin
      perform cron.alter_job((select jobid from cron.job where jobname = 'a2-recapitulatif-quotidien'),
        schedule := format('0 %s * * *', v_nombre::int));
    exception when others then
      raise exception 'L''heure a été enregistrée mais la tâche planifiée n''a pas pu être modifiée.';
    end;
  end if;

  perform public.journaliser('modification_parametre', 'parametre', p_cle, jsonb_build_object('ancien', v_ancien, 'nouveau', p_valeur));
end;
$$;

-- =====================================================================
-- Équipements des logements (RG29) : liste gérée par les admins, utilisée par M4
-- Aucune valeur inventée : la liste validée par l'auteur est à saisir dans l'espace admin.
-- =====================================================================
create table public.equipements (
  id bigint generated always as identity primary key,
  nom text not null unique check (char_length(btrim(nom)) between 1 and 60),
  actif boolean not null default true,
  ordre integer not null default 100
);

-- =====================================================================
-- Administration du référentiel : écriture réservée aux admins (RGA01)
-- =====================================================================
alter table public.equipements enable row level security;
revoke all on table public.equipements from anon, authenticated;
grant select on public.equipements to anon, authenticated;
grant insert, update, delete on public.equipements, public.villes, public.quartiers, public.universites to authenticated;

-- Lecture : tout le monde voit les équipements actifs ; un admin voit aussi les inactifs.
-- (Deux politiques : un visiteur ne peut pas exécuter est_admin(), donc il n'évalue que la première.)
create policy equipements_lecture_publique on public.equipements for select to anon, authenticated using (actif);
create policy equipements_lecture_admin on public.equipements for select to authenticated using (public.est_admin());

create policy equipements_ecriture on public.equipements for insert to authenticated with check (public.est_admin());
create policy equipements_modification on public.equipements for update to authenticated using (public.est_admin()) with check (public.est_admin());
create policy equipements_suppression on public.equipements for delete to authenticated using (public.est_admin());

create policy villes_ecriture on public.villes for insert to authenticated with check (public.est_admin());
create policy villes_modification on public.villes for update to authenticated using (public.est_admin()) with check (public.est_admin());
create policy villes_suppression on public.villes for delete to authenticated using (public.est_admin());
create policy quartiers_ecriture on public.quartiers for insert to authenticated with check (public.est_admin());
create policy quartiers_modification on public.quartiers for update to authenticated using (public.est_admin()) with check (public.est_admin());
create policy quartiers_suppression on public.quartiers for delete to authenticated using (public.est_admin());
create policy universites_ecriture on public.universites for insert to authenticated with check (public.est_admin());
create policy universites_modification on public.universites for update to authenticated using (public.est_admin()) with check (public.est_admin());
create policy universites_suppression on public.universites for delete to authenticated using (public.est_admin());

-- Suppression refusée, avec un message clair, si l'élément est utilisé. Le déclencheur cherche lui-même toutes les
-- clés étrangères qui pointent vers la table : les futures tables (annonces, liaison d'équipements…) sont couvertes
-- sans modifier cette fonction.
create function public.proteger_suppression_referentiel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fk record;
  v_utilise boolean;
  v_par text[] := array[]::text[];
  v_nom text := to_jsonb(old) ->> 'nom';
begin
  for v_fk in
    select c.conrelid::regclass::text as table_ref, a.attname::text as colonne
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = tg_relid
  loop
    execute format('select exists (select 1 from %s where %I = $1)', v_fk.table_ref, v_fk.colonne) into v_utilise using (to_jsonb(old) ->> 'id')::bigint;
    if v_utilise then
      v_par := array_append(v_par, case v_fk.table_ref
        when 'public.quartiers' then 'des quartiers'
        when 'public.universites' then 'des universités'
        when 'public.profils_etudiants' then 'des étudiants'
        when 'public.annonces' then 'des annonces'
        when 'public.annonce_equipements' then 'des annonces'
        else 'd''autres données' end);
    end if;
  end loop;
  if cardinality(v_par) > 0 then
    raise exception 'Impossible de supprimer « % » : cet élément est utilisé par %.', v_nom, array_to_string((select array_agg(distinct x) from unnest(v_par) x), ' et ');
  end if;
  return old;
end;
$$;

create trigger villes_protection before delete on public.villes for each row execute function public.proteger_suppression_referentiel();
create trigger quartiers_protection before delete on public.quartiers for each row execute function public.proteger_suppression_referentiel();
create trigger universites_protection before delete on public.universites for each row execute function public.proteger_suppression_referentiel();
create trigger equipements_protection before delete on public.equipements for each row execute function public.proteger_suppression_referentiel();

-- RGA06 : chaque création, modification ou suppression du référentiel est journalisée (pas lors des chargements
-- faits sans utilisateur connecté, comme seed.sql).
create function public.journaliser_referentiel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ligne jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
begin
  if (select auth.uid()) is not null then
    perform public.journaliser('referentiel_' || lower(tg_op), tg_table_name, v_ligne ->> 'id', jsonb_build_object('nom', v_ligne ->> 'nom'));
  end if;
  return null;
end;
$$;

create trigger villes_journal after insert or update or delete on public.villes for each row execute function public.journaliser_referentiel();
create trigger quartiers_journal after insert or update or delete on public.quartiers for each row execute function public.journaliser_referentiel();
create trigger universites_journal after insert or update or delete on public.universites for each row execute function public.journaliser_referentiel();
create trigger equipements_journal after insert or update or delete on public.equipements for each row execute function public.journaliser_referentiel();

-- Vue de lecture des équipements pour l'interface (RGP18)
-- RG25 bis : les universités sans position, à placer sur la carte. Compteur du menu Référentiel (file de A2).
create view public.file_universites_a_placer with (security_invoker = true) as
  select count(*)::bigint as nombre, null::timestamptz as plus_ancien
  from public.universites where position is null;
revoke all on public.file_universites_a_placer from anon, authenticated;
grant select on public.file_universites_a_placer to authenticated;

-- Une file « informative » n'envoie pas d'alerte aux admins : elle ne sert qu'à afficher un compteur
alter table public.files_admin add column alerter boolean not null default true;
insert into public.files_admin (nom, libelle, vue, lien, ordre, alerter)
values ('universites_a_placer', 'Universités à placer', 'file_universites_a_placer', '/admin/referentiel', 90, false)
on conflict (nom) do nothing;

-- =====================================================================
-- A2 : seuil d'ancienneté lu dans le paramètre seuil_relance_heures, files informatives ignorées
-- =====================================================================
create or replace function public.alertes_files()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_file record;
  v_etat record;
  v_alerte boolean;
  v_ancien boolean;
  v_admin record;
  v_duree text;
  v_envoyees integer := 0;
  v_seuil interval := make_interval(hours => coalesce((select (valeur #>> '{}')::int from public.parametres where cle = 'seuil_relance_heures'), 24));
begin
  for v_file in select * from public.files_admin where alerter order by ordre, nom loop
    select c.nombre, c.plus_ancien into v_etat from public.compter_file(v_file.vue) c;
    v_etat.nombre := coalesce(v_etat.nombre, 0);
    v_alerte := false;
    v_ancien := false;

    if v_etat.nombre > v_file.dernier_nombre
       and (v_file.derniere_alerte_le is null or v_file.derniere_alerte_le <= now() - interval '15 minutes') then
      v_alerte := true;
    elsif v_etat.plus_ancien is not null and v_etat.plus_ancien < now() - v_seuil
          and (v_file.derniere_alerte_ancien_le is null or v_file.derniere_alerte_ancien_le < now() - v_seuil) then
      v_alerte := true;
      v_ancien := true;
    end if;

    if v_alerte then
      v_duree := case
        when now() - v_etat.plus_ancien >= interval '1 hour' then floor(extract(epoch from now() - v_etat.plus_ancien) / 3600)::int || ' h'
        else greatest(1, floor(extract(epoch from now() - v_etat.plus_ancien) / 60))::int || ' min'
      end;
      for v_admin in select id from public.profils where role in ('admin', 'super_admin') and statut = 'actif' loop
        -- RGA33 : la file, le nombre, l'ancienneté et un lien. Rien d'autre.
        perform public.notifier(v_admin.id, case when v_ancien then 'alerte_file_ancienne' else 'alerte_file' end,
          format('%s : %s en attente, le plus ancien depuis %s.', v_file.libelle, v_etat.nombre, v_duree), v_file.lien);
        v_envoyees := v_envoyees + 1;
      end loop;
      update public.files_admin
      set derniere_alerte_le = now(), dernier_nombre = v_etat.nombre,
          derniere_alerte_ancien_le = case when v_ancien then now() else derniere_alerte_ancien_le end
      where nom = v_file.nom;
    elsif v_etat.nombre < v_file.dernier_nombre then
      update public.files_admin set dernier_nombre = v_etat.nombre where nom = v_file.nom;
    end if;
  end loop;
  return v_envoyees;
end;
$$;

create or replace function public.donnees_recapitulatif()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_files jsonb := '[]'::jsonb;
  v_file record;
  v_etat record;
  v_seuil interval := make_interval(hours => coalesce((select (valeur #>> '{}')::int from public.parametres where cle = 'seuil_relance_heures'), 24));
begin
  for v_file in select libelle, vue from public.files_admin where alerter order by ordre, nom loop
    select c.nombre, c.plus_ancien into v_etat from public.compter_file(v_file.vue) c;
    v_files := v_files || jsonb_build_object(
      'libelle', v_file.libelle, 'nombre', coalesce(v_etat.nombre, 0), 'plus_ancien', v_etat.plus_ancien,
      'urgent', v_etat.plus_ancien is not null and v_etat.plus_ancien < now() - v_seuil);
  end loop;
  return jsonb_build_object(
    'files', v_files,
    'destinataires', coalesce((
      select jsonb_agg(jsonb_build_object('email', u.email))
      from public.profils p
      join auth.users u on u.id = p.id
      left join public.preferences_admin pa on pa.user_id = p.id
      where p.role = 'super_admin' and p.statut = 'actif' and coalesce(pa.recap_quotidien, true)
    ), '[]'::jsonb)
  );
end;
$$;

-- =====================================================================
-- Droits : fonction -> rôles autorisés (RGP17)
-- =====================================================================
revoke execute on function
  public.diffuser_parametre(), public.definir_maintenance(boolean, text, timestamptz), public.liste_parametres(),
  public.modifier_parametre(text, jsonb), public.proteger_suppression_referentiel(), public.journaliser_referentiel(),
  public.alertes_files(), public.donnees_recapitulatif()
  from public, anon, authenticated;

grant execute on function public.liste_parametres() to authenticated;                              -- le corps exige est_admin()
grant execute on function public.definir_maintenance(boolean, text, timestamptz) to authenticated; -- le corps exige est_super_admin()
grant execute on function public.modifier_parametre(text, jsonb) to authenticated;                 -- le corps exige est_super_admin()
grant execute on function public.donnees_recapitulatif() to service_role;
-- Internes, sans GRANT : diffuser_parametre, proteger_suppression_referentiel, journaliser_referentiel, alertes_files
