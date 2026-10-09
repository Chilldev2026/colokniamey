-- 0100_core.sql
-- Module M0 : socle. Paramètres, observabilité, audit, notifications, quotas.
-- Chaque fonction est créée sans droit public (voir 0050), puis reçoit un GRANT explicite (RGP17).

-- =====================================================================
-- Tables
-- =====================================================================

-- Paramètres de la plateforme. Lecture publique uniquement via parametres_publics().
create table public.parametres (
  cle text primary key,
  valeur jsonb not null,
  publique boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Visites : aucune donnée personnelle, ni IP ni traceur (RGA18).
create table public.visites (
  id bigint generated always as identity primary key,
  chemin text not null check (char_length(chemin) <= 200),
  appareil text not null check (appareil in ('mobile', 'tablette', 'ordinateur', 'inconnu')),
  session_id text not null check (char_length(session_id) between 8 and 64),
  created_at timestamptz not null default now()
);
create index visites_created_at_idx on public.visites (created_at);

-- Erreurs regroupées par empreinte, sans donnée sensible (RGA19).
create table public.erreurs (
  id bigint generated always as identity primary key,
  empreinte text not null unique,
  message text not null check (char_length(message) <= 300),
  module text check (char_length(module) <= 50),
  page text check (char_length(page) <= 200),
  occurrences integer not null default 1,
  statut text not null default 'nouveau' check (statut in ('nouveau', 'en_cours', 'resolu', 'ignore')),
  premiere_vue timestamptz not null default now(),
  derniere_vue timestamptz not null default now()
);

-- Mesures de performance anonymes et échantillonnées (RGA21 à RGA25).
create table public.mesures (
  id bigint generated always as identity primary key,
  module text not null check (char_length(module) <= 50),
  operation text not null check (char_length(operation) <= 80),
  duree_ms integer not null check (duree_ms between 0 and 600000),
  succes boolean not null,
  session_id text not null check (char_length(session_id) between 8 and 64),
  created_at timestamptz not null default now()
);
create index mesures_created_at_idx on public.mesures (created_at);

-- Journal d'audit en ajout seul (RGA06, RGA07).
create table public.journal_audit (
  id bigint generated always as identity primary key,
  acteur_id uuid,
  action text not null check (char_length(action) <= 80),
  cible_type text check (char_length(cible_type) <= 50),
  cible_id text check (char_length(cible_id) <= 80),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Notifications dans l'application (RGA29, RGA33 : aucune donnée personnelle dans le texte).
create table public.notifications (
  id bigint generated always as identity primary key,
  destinataire_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (char_length(type) <= 50),
  titre text not null check (char_length(titre) <= 160),
  lien text check (char_length(lien) <= 200),
  lu boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_destinataire_idx on public.notifications (destinataire_id, lu, created_at desc);

-- Quotas (RGP20). portee = 'utilisateur' (clé u:<uid> ou s:<session>) ou 'global' (plafond journalier).
create table public.limites (
  action text not null,
  fenetre_secondes integer not null check (fenetre_secondes > 0),
  maximum integer not null check (maximum > 0),
  portee text not null default 'utilisateur' check (portee in ('utilisateur', 'global')),
  primary key (action, fenetre_secondes, portee)
);

create table public.compteurs_quota (
  cle text not null,
  action text not null,
  fenetre_debut timestamptz not null,
  fenetre_secondes integer not null,
  compte integer not null default 0,
  primary key (cle, action, fenetre_secondes, fenetre_debut)
);

-- =====================================================================
-- RLS : activée partout, refus par défaut (RGP04)
-- =====================================================================
alter table public.parametres enable row level security;
alter table public.visites enable row level security;
alter table public.erreurs enable row level security;
alter table public.mesures enable row level security;
alter table public.journal_audit enable row level security;
alter table public.notifications enable row level security;
alter table public.limites enable row level security;
alter table public.compteurs_quota enable row level security;

-- Aucun accès direct aux tables techniques : on retire tous les droits aux rôles de l'API.
-- Les modules admin ajouteront leurs propres politiques de lecture (A2, A5, A6).
revoke all on table public.parametres, public.visites, public.erreurs, public.mesures,
  public.journal_audit, public.limites, public.compteurs_quota from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;

-- Notifications : chacun lit les siennes et peut seulement les marquer comme lues (RG10, RGA29).
grant select on public.notifications to authenticated;
grant update (lu) on public.notifications to authenticated;

create policy notifications_lecture_propre on public.notifications
  for select to authenticated
  using (destinataire_id = (select auth.uid()));

create policy notifications_marquer_lu on public.notifications
  for update to authenticated
  using (destinataire_id = (select auth.uid()))
  with check (destinataire_id = (select auth.uid()));

-- =====================================================================
-- Journal d'audit en ajout seul (RGA07)
-- =====================================================================
create function public.journal_audit_immuable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- RGA07 : aucune modification ni suppression du journal
  raise exception 'Le journal d''audit est en ajout seul.';
end;
$$;

create trigger journal_audit_pas_de_modification
  before update or delete on public.journal_audit
  for each row execute function public.journal_audit_immuable();

create trigger journal_audit_pas_de_vidage
  before truncate on public.journal_audit
  for each statement execute function public.journal_audit_immuable();

-- =====================================================================
-- Quotas
-- =====================================================================

-- Incrémente un compteur de fenêtre fixe ; renvoie faux si le maximum est dépassé.
-- Interne : aucun GRANT (RGP17).
create function public.consommer_quota(p_cle text, p_action text, p_fenetre integer, p_maximum integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_debut timestamptz;
  v_compte integer;
begin
  v_debut := to_timestamp(floor(extract(epoch from now()) / p_fenetre) * p_fenetre);

  insert into public.compteurs_quota as c (cle, action, fenetre_debut, fenetre_secondes, compte)
  values (p_cle, p_action, v_debut, p_fenetre, 1)
  on conflict (cle, action, fenetre_secondes, fenetre_debut)
  do update set compte = c.compte + 1
  returning c.compte into v_compte;

  -- Purge des compteurs expirés, de temps en temps (RGP20)
  if random() < 0.01 then
    delete from public.compteurs_quota where fenetre_debut < now() - interval '2 days';
  end if;

  return v_compte <= p_maximum;
end;
$$;

-- Vérifie toutes les limites de portée « utilisateur » d'une action répétable (RGP20).
-- Appelée par les fonctions des autres modules ; refuse par une exception en français.
create function public.verifier_quota(p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_limite record;
begin
  if v_uid is null then
    raise exception 'Connexion requise.';
  end if;

  for v_limite in
    select fenetre_secondes, maximum from public.limites
    where action = p_action and portee = 'utilisateur'
  loop
    if not public.consommer_quota('u:' || v_uid::text, p_action, v_limite.fenetre_secondes, v_limite.maximum) then
      raise exception 'Tu fais trop de demandes. Réessaie dans un moment.';
    end if;
  end loop;
end;
$$;

-- Limites des RPC anonymes : par session et par minute, plus un plafond global (RGP20).
-- Renvoie faux si l'envoi doit être ignoré. Interne : aucun GRANT.
create function public.quota_anonyme(p_action text, p_session text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limite record;
  v_ok boolean := true;
begin
  if p_session is null or char_length(p_session) not between 8 and 64 then
    return false;
  end if;

  for v_limite in
    select fenetre_secondes, maximum, portee from public.limites where action = p_action
  loop
    if not public.consommer_quota(
      case v_limite.portee when 'global' then 'global' else 's:' || p_session end,
      p_action, v_limite.fenetre_secondes, v_limite.maximum
    ) then
      v_ok := false;
    end if;
  end loop;

  return v_ok;
end;
$$;

-- =====================================================================
-- Paramètres et maintenance
-- =====================================================================

-- Paramètres publics sous forme d'un objet JSON { cle: valeur }.
create function public.parametres_publics()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(cle, valeur), '{}'::jsonb)
  from public.parametres
  where publique;
$$;

-- RGA16 : indique si la plateforme est en maintenance.
create function public.en_maintenance()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (valeur #>> '{}')::boolean from public.parametres where cle = 'maintenance_active'), false);
$$;

-- =====================================================================
-- Observabilité anonyme (RGA18, RGA19, RGA21 à RGA25)
-- =====================================================================

-- RGA18 : chemin sans paramètres de requête, aucune donnée personnelle.
create function public.enregistrer_visite(p_chemin text, p_appareil text, p_session text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- RGP20 : au-delà de la limite, l'envoi est simplement ignoré
  if not public.quota_anonyme('visite', p_session) then
    return;
  end if;

  insert into public.visites (chemin, appareil, session_id)
  values (
    left(split_part(coalesce(p_chemin, '/'), '?', 1), 200),
    case when p_appareil in ('mobile', 'tablette', 'ordinateur') then p_appareil else 'inconnu' end,
    p_session
  );
end;
$$;

-- RGA19 : regroupement par empreinte, longueurs limitées.
create function public.enregistrer_erreur(p_message text, p_module text, p_page text, p_session text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message text := left(coalesce(p_message, 'Erreur inconnue'), 300);
  v_module text := left(p_module, 50);
  v_page text := left(split_part(coalesce(p_page, ''), '?', 1), 200);
begin
  if not public.quota_anonyme('erreur', p_session) then
    return;
  end if;

  insert into public.erreurs as e (empreinte, message, module, page)
  values (md5(v_message || '|' || coalesce(v_module, '')), v_message, v_module, v_page)
  on conflict (empreinte)
  do update set occurrences = e.occurrences + 1, derniere_vue = now();
end;
$$;

-- RGA25 : mesures envoyées par lots de 50 au plus.
create function public.enregistrer_mesures(p_lot jsonb, p_session text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_lot is null or jsonb_typeof(p_lot) <> 'array' or jsonb_array_length(p_lot) > 50 then
    return;
  end if;

  if not public.quota_anonyme('mesures', p_session) then
    return;
  end if;

  insert into public.mesures (module, operation, duree_ms, succes, session_id)
  select left(m.module, 50), left(m.operation, 80), m.duree_ms, m.succes, p_session
  from jsonb_to_recordset(p_lot) as m(module text, operation text, duree_ms integer, succes boolean)
  where m.module is not null and m.operation is not null and m.succes is not null
    and m.duree_ms between 0 and 600000;
end;
$$;

-- =====================================================================
-- Audit et notifications : fonctions internes (aucun GRANT, RGP17)
-- =====================================================================

-- RGA06 : toute action admin passe par ici. Appelable seulement par d'autres fonctions SECURITY DEFINER.
create function public.journaliser(p_action text, p_cible_type text, p_cible_id text, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.journal_audit (acteur_id, action, cible_type, cible_id, details)
  values (auth.uid(), p_action, p_cible_type, p_cible_id, coalesce(p_details, '{}'::jsonb));
end;
$$;

-- RGA29, RGA33 : notification dans l'application, sans donnée personnelle.
create function public.notifier(p_destinataire uuid, p_type text, p_titre text, p_lien text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (destinataire_id, type, titre, lien)
  values (p_destinataire, p_type, left(p_titre, 160), left(p_lien, 200));
end;
$$;

-- =====================================================================
-- GRANT explicites : fonction -> rôles autorisés (RGP17)
-- =====================================================================
grant execute on function public.parametres_publics() to anon, authenticated;
grant execute on function public.en_maintenance() to anon, authenticated;
grant execute on function public.enregistrer_visite(text, text, text) to anon, authenticated;
grant execute on function public.enregistrer_erreur(text, text, text, text) to anon, authenticated;
grant execute on function public.enregistrer_mesures(jsonb, text) to anon, authenticated;
grant execute on function public.verifier_quota(text) to authenticated;
-- journaliser, notifier, consommer_quota, quota_anonyme : aucun GRANT (usage interne)

-- =====================================================================
-- Données initiales
-- =====================================================================
insert into public.parametres (cle, valeur, publique) values
  ('maintenance_active', 'false', true),
  ('maintenance_message', '""', true),
  ('maintenance_fin', 'null', true),
  ('inscriptions_ouvertes', 'true', true),
  ('photos_max', '5', true),
  ('validation_annonces', 'true', true),
  ('version_cgu', '"1.0"', true),
  ('email_domaine_verifie', 'false', false)
on conflict (cle) do nothing;

insert into public.limites (action, fenetre_secondes, maximum, portee) values
  -- RGP20 : actions des utilisateurs connectés [À VALIDER]
  ('message', 60, 20, 'utilisateur'),
  ('message', 86400, 200, 'utilisateur'),
  ('nouvelle_conversation', 86400, 20, 'utilisateur'),
  ('contact_annonce', 86400, 30, 'utilisateur'),
  ('envoi_photo', 86400, 30, 'utilisateur'),
  ('signalement', 86400, 10, 'utilisateur'),
  ('avis', 86400, 10, 'utilisateur'),
  -- RGP20 : RPC anonymes de mesure, par session et par minute
  ('visite', 60, 30, 'utilisateur'),
  ('erreur', 60, 10, 'utilisateur'),
  ('mesures', 60, 10, 'utilisateur'),
  -- RGP20 : plafonds globaux journaliers
  ('visite', 86400, 50000, 'global'),
  ('erreur', 86400, 2000, 'global'),
  ('mesures', 86400, 20000, 'global')
on conflict do nothing;
