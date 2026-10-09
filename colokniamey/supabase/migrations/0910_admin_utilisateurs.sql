-- 0910_admin_utilisateurs.sql
-- Module A2 : utilisateurs et accès admin. RGA01 à RGA09, RGA26 à RGA38, RGP17, RGP18.
--
-- Modifications d'objets d'autres modules (autorisées par le contrat, à signaler) :
--  - est_admin() de M2 est remplacée (CREATE OR REPLACE) : en plus du rôle et du jeton aal2, elle exige une
--    ligne dans sessions_admin pour la session du jeton, active depuis moins de 30 minutes (RGA36) ;
--  - est_super_admin() de M2 s'appuie désormais sur est_admin(), pour que la règle des 30 minutes
--    s'applique aussi au super-admin ;
--  - un déclencheur de garde sur profils (M2) empêche de retirer le dernier super-admin actif (RGA03).
--
-- Données personnelles (RGP01) : relances et préférences ne contiennent que des identifiants ; les messages
-- d'alerte et de relance ne contiennent jamais de nom, de téléphone ni d'image (RGA33).

-- =====================================================================
-- Outils internes
-- =====================================================================
create function public.rang_role(p_role public.role_utilisateur)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_role when 'super_admin' then 2 when 'admin' then 1 else 0 end;
$$;

-- RGA06 : variante de journaliser() pour les appels faits par le service_role (Edge Function),
-- où auth.uid() est nul : l'acteur est passé explicitement. Interne : aucun GRANT au public.
create function public.journaliser(p_acteur uuid, p_action text, p_cible_type text, p_cible_id text, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.journal_audit (acteur_id, action, cible_type, cible_id, details)
  values (p_acteur, p_action, p_cible_type, p_cible_id, coalesce(p_details, '{}'::jsonb));
end;
$$;

-- =====================================================================
-- Sessions admin (RGA36)
-- =====================================================================
create table public.sessions_admin (
  session_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  derniere_activite timestamptz not null default now()
);
create index sessions_admin_user_idx on public.sessions_admin (user_id);
alter table public.sessions_admin enable row level security;
revoke all on table public.sessions_admin from anon, authenticated;

-- Remplace la version de M2 (voir l'en-tête). Reste SECURITY DEFINER avec search_path vide.
create or replace function public.est_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
    and exists (
      select 1 from public.profils
      where id = (select auth.uid()) and statut = 'actif' and role in ('admin', 'super_admin')
    )
    -- RGA36 : session du jeton active depuis moins de 30 minutes, sans durée maximale
    and exists (
      select 1 from public.sessions_admin s
      where s.session_id = nullif((select auth.jwt()) ->> 'session_id', '')::uuid
        and s.user_id = (select auth.uid())
        and s.derniere_activite > now() - interval '30 minutes'
    );
$$;

create or replace function public.est_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.est_admin()
    and exists (
      select 1 from public.profils where id = (select auth.uid()) and statut = 'actif' and role = 'super_admin'
    );
$$;

-- L'interface appelle cette fonction au plus toutes les 5 minutes tant que l'admin agit.
-- Elle prolonge une session active, mais ne ressuscite jamais une session expirée : une session sans ligne
-- ne peut en créer une que dans les 10 minutes qui suivent la vérification du code TOTP (claim amr du jeton).
create function public.signaler_activite_admin()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_session uuid := nullif((select auth.jwt()) ->> 'session_id', '')::uuid;
  v_ligne public.sessions_admin;
  v_totp bigint;
begin
  if coalesce((select auth.jwt()) ->> 'aal', '') <> 'aal2'
     or v_session is null
     or not exists (select 1 from public.profils where id = v_uid and statut = 'actif' and role in ('admin', 'super_admin')) then
    raise exception 'Action non autorisée.';
  end if;

  select * into v_ligne from public.sessions_admin where session_id = v_session;
  if found then
    if v_ligne.user_id <> v_uid or v_ligne.derniere_activite < now() - interval '30 minutes' then
      raise exception 'Session expirée par inactivité. Reconnecte-toi.';
    end if;
    update public.sessions_admin set derniere_activite = now() where session_id = v_session;
  else
    select max((e ->> 'timestamp')::bigint) into v_totp
    from jsonb_array_elements(coalesce((select auth.jwt()) -> 'amr', '[]'::jsonb)) as e
    where e ->> 'method' = 'totp';
    if v_totp is null or to_timestamp(v_totp) < now() - interval '10 minutes' then
      raise exception 'Session expirée. Reconnecte-toi.';
    end if;
    insert into public.sessions_admin (session_id, user_id) values (v_session, v_uid);
  end if;

  -- Purge des lignes anciennes (plus d'un jour d'inactivité)
  if random() < 0.05 then
    delete from public.sessions_admin where derniere_activite < now() - interval '1 day';
  end if;
end;
$$;

-- =====================================================================
-- Garde du dernier super-admin (RGA03)
-- =====================================================================
create function public.garder_dernier_super_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'super_admin' and old.statut = 'actif'
     and (tg_op = 'DELETE' or new.role <> 'super_admin' or new.statut <> 'actif') then
    if not exists (select 1 from public.profils where role = 'super_admin' and statut = 'actif' and id <> old.id) then
      raise exception 'Il doit rester au moins un super-administrateur actif.';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger profils_dernier_super before update or delete on public.profils
  for each row execute function public.garder_dernier_super_admin();

-- =====================================================================
-- Liste et fiche des utilisateurs (RGA01)
-- =====================================================================
create function public.liste_utilisateurs(
  p_recherche text default null, p_role text default null, p_statut text default null,
  p_depuis date default null, p_jusqua date default null, p_limite integer default 20, p_decalage integer default 0
)
returns table (
  id uuid, prenom text, nom text, email text, telephone text, role text, statut text, created_at timestamptz, total bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_motif text := '%' || replace(replace(replace(btrim(coalesce(p_recherche, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  if not public.est_admin() then
    raise exception 'Action non autorisée.';
  end if;
  return query
    select p.id, p.prenom, p.nom, u.email::text, p.telephone, p.role::text, p.statut::text, p.created_at,
           count(*) over () as total
    from public.profils p
    join auth.users u on u.id = p.id
    where (btrim(coalesce(p_recherche, '')) = ''
           or p.nom ilike v_motif or p.prenom ilike v_motif or u.email ilike v_motif or p.telephone ilike v_motif)
      and (p_role is null or p.role::text = p_role)
      and (p_statut is null or p.statut::text = p_statut)
      and (p_depuis is null or p.created_at >= p_depuis)
      and (p_jusqua is null or p.created_at < p_jusqua + 1)
    order by p.created_at desc, p.id
    limit least(greatest(coalesce(p_limite, 20), 1), 50)
    offset greatest(coalesce(p_decalage, 0), 0);
end;
$$;

-- Chaque module peut exposer compteurs_utilisateur_<module>(uid) (nombre d'annonces, de signalements reçus…) :
-- fonction interne qui renvoie du JSON, découverte par son nom comme les exports de M3.
create function public.fiche_utilisateur(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_fiche jsonb;
  v_compteurs jsonb := '{}'::jsonb;
  v_fonction record;
  v_part jsonb;
begin
  if not public.est_admin() then
    raise exception 'Action non autorisée.';
  end if;

  select jsonb_build_object(
    'id', p.id, 'prenom', p.prenom, 'nom', p.nom, 'email', u.email, 'telephone', p.telephone,
    'role', p.role, 'statut', p.statut, 'motif_suspension', p.motif_suspension, 'suspendu_jusqua', p.suspendu_jusqua,
    'inscrit_le', p.created_at, 'derniere_connexion', u.last_sign_in_at, 'cgu_version', p.cgu_version,
    'universite', (select un.nom from public.profils_etudiants e join public.universites un on un.id = e.universite_id where e.user_id = p.id),
    'type_proprietaire', (select r.type_proprietaire from public.profils_proprietaires r where r.user_id = p.id)
  ) into v_fiche
  from public.profils p join auth.users u on u.id = p.id
  where p.id = p_id;
  if v_fiche is null then
    raise exception 'Utilisateur introuvable.';
  end if;

  for v_fonction in
    select proname::text as nom from pg_proc
    where pronamespace = 'public'::regnamespace and proname like 'compteurs\_utilisateur\_%' and pronargs = 1
    order by proname
  loop
    execute format('select public.%I($1)', v_fonction.nom) into v_part using p_id;
    v_compteurs := v_compteurs || coalesce(v_part, '{}'::jsonb);
  end loop;

  return v_fiche || jsonb_build_object(
    'compteurs', v_compteurs,
    -- Historique d'audit concernant cet utilisateur : les 50 dernières lignes
    'historique', coalesce((
      select jsonb_agg(jsonb_build_object(
        'action', h.action, 'date', h.created_at, 'details', h.details,
        'acteur', (select a.prenom from public.profils a where a.id = h.acteur_id)
      ) order by h.id desc)
      from (select * from public.journal_audit where cible_type = 'utilisateur' and cible_id = p_id::text order by id desc limit 50) h
    ), '[]'::jsonb)
  );
end;
$$;

-- =====================================================================
-- Actions sur les comptes (RGA01, RGA02, RGA03, RGA05, RGA08, RGA09, RGA38)
-- Réservées à l'Edge Function admin-utilisateurs : aucun GRANT à anon ni authenticated, seulement service_role.
-- L'Edge Function vérifie d'abord est_admin() avec le jeton de l'appelant (aal2, session active),
-- puis appelle ces fonctions en passant l'acteur ; chacune revérifie le rôle et les rangs.
-- =====================================================================

-- Contrôles communs. Renvoie la ligne de la cible.
create function public.controler_acteur_admin(p_acteur uuid, p_cible uuid, p_super_requis boolean, p_egal_ok boolean default false)
returns public.profils
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_acteur public.profils;
  v_cible public.profils;
begin
  select * into v_acteur from public.profils where id = p_acteur and statut = 'actif' and role in ('admin', 'super_admin');
  if not found then
    raise exception 'Action non autorisée.';
  end if;
  if p_super_requis and v_acteur.role <> 'super_admin' then
    raise exception 'Cette action est réservée au super-administrateur.';
  end if;
  select * into v_cible from public.profils where id = p_cible;
  if not found then
    raise exception 'Utilisateur introuvable.';
  end if;
  -- RGA02 : jamais sur soi-même ni sur un compte de niveau égal ou supérieur
  if v_cible.id = v_acteur.id then
    raise exception 'Tu ne peux pas agir sur ton propre compte.';
  end if;
  if not p_egal_ok and public.rang_role(v_acteur.role) <= public.rang_role(v_cible.role) then
    raise exception 'Tu ne peux pas agir sur un compte de niveau égal ou supérieur.';
  end if;
  return v_cible;
end;
$$;

-- RGA08 : motif obligatoire, durée facultative. Le compte est bloqué dans Supabase Auth et déconnecté partout.
create function public.admin_action_suspendre(p_acteur uuid, p_cible uuid, p_motif text, p_jusqua timestamptz default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cible public.profils := public.controler_acteur_admin(p_acteur, p_cible, false);
  v_motif text := btrim(coalesce(p_motif, ''));
begin
  if char_length(v_motif) not between 3 and 300 then
    raise exception 'Un motif de suspension est obligatoire (300 caractères au plus).';
  end if;
  if p_jusqua is not null and p_jusqua <= now() then
    raise exception 'La date de fin de suspension doit être dans le futur.';
  end if;
  if v_cible.statut <> 'actif' then
    raise exception 'Ce compte n''est pas actif.';
  end if;

  update public.profils set statut = 'suspendu', motif_suspension = v_motif, suspendu_jusqua = p_jusqua where id = p_cible;
  update auth.users set banned_until = coalesce(p_jusqua, 'infinity') where id = p_cible;
  delete from auth.sessions where user_id = p_cible;
  delete from public.sessions_admin where user_id = p_cible;

  perform public.journaliser(p_acteur, 'suspension', 'utilisateur', p_cible::text,
    jsonb_build_object('motif', v_motif, 'jusqua', p_jusqua));
  perform public.notifier(p_cible, 'compte_suspendu', 'Ton compte a été suspendu.', null);
end;
$$;

create function public.admin_action_reactiver(p_acteur uuid, p_cible uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cible public.profils := public.controler_acteur_admin(p_acteur, p_cible, false);
begin
  if v_cible.statut <> 'suspendu' then
    raise exception 'Seul un compte suspendu peut être réactivé.';
  end if;
  update public.profils set statut = 'actif', motif_suspension = null, suspendu_jusqua = null where id = p_cible;
  update auth.users set banned_until = null where id = p_cible;
  perform public.journaliser(p_acteur, 'reactivation', 'utilisateur', p_cible::text, '{}'::jsonb);
  perform public.notifier(p_cible, 'compte_reactive', 'Ton compte a été réactivé.', null);
end;
$$;

-- RGA01, RGA05 : réservée au super-admin. Promotion en admin d'un étudiant ou d'un propriétaire,
-- ou retour d'un admin à son rôle d'origine (celui de son profil). Le rôle super_admin se donne par script SQL.
create function public.admin_action_changer_role(p_acteur uuid, p_cible uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cible public.profils := public.controler_acteur_admin(p_acteur, p_cible, true);
  v_nouveau public.role_utilisateur;
begin
  if p_role = 'admin' then
    if v_cible.role not in ('etudiant', 'proprietaire') then
      raise exception 'Seul un étudiant ou un propriétaire peut devenir administrateur.';
    end if;
    if v_cible.statut <> 'actif' then
      raise exception 'Seul un compte actif peut devenir administrateur.';
    end if;
    v_nouveau := 'admin';
  elsif p_role in ('etudiant', 'proprietaire') then
    if v_cible.role <> 'admin' then
      raise exception 'Seul un administrateur peut être rétrogradé ici.';
    end if;
    -- le rôle d'origine est celui du profil détaillé que le compte possède
    v_nouveau := case
      when exists (select 1 from public.profils_etudiants where user_id = p_cible) then 'etudiant'
      when exists (select 1 from public.profils_proprietaires where user_id = p_cible) then 'proprietaire'
    end;
    if v_nouveau is null then
      raise exception 'Le rôle d''origine de ce compte est introuvable.';
    end if;
  else
    raise exception 'Ce rôle ne peut pas être attribué ici.';
  end if;

  update public.profils set role = v_nouveau where id = p_cible;
  -- les sessions admin de la personne rétrogradée prennent fin
  delete from public.sessions_admin where user_id = p_cible;

  perform public.journaliser(p_acteur, 'changement_role', 'utilisateur', p_cible::text,
    jsonb_build_object('ancien', v_cible.role, 'nouveau', v_nouveau));
  perform public.notifier(p_cible, 'role_modifie',
    case v_nouveau when 'admin' then 'Tu as été nommé administrateur.' else 'Tu n''es plus administrateur.' end, null);
end;
$$;

-- Anonymisation d'un compte (RGA09), partagée par la désactivation faite par un admin.
-- Même effet que desactiver_mon_compte() de M3, sans contrôle d'appelant : interne.
create function public.anonymiser_compte(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profils
  set nom = 'Utilisateur', prenom = 'Ancien membre', telephone = '00000000',
      statut = 'desactive', motif_suspension = null, suspendu_jusqua = null
  where id = p_uid;
  delete from public.profils_complements where user_id = p_uid;
  update public.profils_etudiants set niveau_etude = null, filiere = null, budget_max = null, bio = null where user_id = p_uid;
  update public.profils_proprietaires set adresse = null where user_id = p_uid;
  delete from public.notifications where destinataire_id = p_uid;
  update auth.users
  set email = 'supprime-' || p_uid::text || '@anonyme.invalid', phone = null, raw_user_meta_data = '{}'::jsonb,
      encrypted_password = '', banned_until = 'infinity'
  where id = p_uid;
  delete from auth.sessions where user_id = p_uid;
  delete from public.sessions_admin where user_id = p_uid;
end;
$$;

create function public.admin_action_desactiver(p_acteur uuid, p_cible uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cible public.profils := public.controler_acteur_admin(p_acteur, p_cible, false);
  v_motif text := btrim(coalesce(p_motif, ''));
begin
  if char_length(v_motif) not between 3 and 300 then
    raise exception 'Un motif est obligatoire (300 caractères au plus).';
  end if;
  if v_cible.statut = 'desactive' then
    raise exception 'Ce compte est déjà désactivé.';
  end if;
  perform public.anonymiser_compte(p_cible);
  perform public.journaliser(p_acteur, 'desactivation_anonymisation', 'utilisateur', p_cible::text, jsonb_build_object('motif', v_motif));
end;
$$;

-- RGA09 : suppression définitive, super-admin seulement. Cette fonction contrôle et journalise ;
-- l'Edge Function supprime ensuite le compte dans Supabase Auth (la suppression en cascade le profil).
create function public.admin_action_preparer_suppression(p_acteur uuid, p_cible uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cible public.profils := public.controler_acteur_admin(p_acteur, p_cible, true);
  v_motif text := btrim(coalesce(p_motif, ''));
begin
  if char_length(v_motif) not between 3 and 300 then
    raise exception 'Un motif est obligatoire (300 caractères au plus).';
  end if;
  perform public.journaliser(p_acteur, 'suppression_definitive', 'utilisateur', p_cible::text,
    jsonb_build_object('motif', v_motif, 'role', v_cible.role));
end;
$$;

-- RGA38 : super-admin seulement, motif obligatoire, jamais sur soi-même, autorisée sur un autre super-admin
-- (exception à RGA02). Journalisée et notifiée à tous les super-admins. L'Edge Function supprime ensuite les facteurs.
create function public.admin_action_preparer_reinit_mfa(p_acteur uuid, p_cible uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cible public.profils := public.controler_acteur_admin(p_acteur, p_cible, true, true);
  v_motif text := btrim(coalesce(p_motif, ''));
  v_super record;
begin
  if char_length(v_motif) not between 3 and 300 then
    raise exception 'Un motif est obligatoire (300 caractères au plus).';
  end if;
  if v_cible.role not in ('admin', 'super_admin') then
    raise exception 'La double authentification ne concerne que les administrateurs.';
  end if;

  -- les sessions de la personne prennent fin : elle devra enregistrer un nouvel appareil
  delete from public.sessions_admin where user_id = p_cible;
  delete from auth.sessions where user_id = p_cible;

  perform public.journaliser(p_acteur, 'reinitialisation_mfa', 'utilisateur', p_cible::text, jsonb_build_object('motif', v_motif));
  for v_super in select id from public.profils where role = 'super_admin' and statut = 'actif' loop
    perform public.notifier(v_super.id, 'mfa_reinitialise', 'La double authentification d''un compte administrateur a été réinitialisée.', '/admin/administrateurs');
  end loop;
end;
$$;

-- =====================================================================
-- Files de travail des admins, alertes et relances (RGA29 à RGA35)
-- =====================================================================

-- Chaque module à file (K, A3, M7) inscrit ici sa vue de comptage file_<nom>(nombre, plus_ancien).
-- La vue doit être créée WITH (security_invoker = true) (RGP18).
create table public.files_admin (
  nom text primary key check (nom ~ '^[a-z_]{2,40}$'),
  libelle text not null check (char_length(libelle) <= 60),
  vue text not null check (vue ~ '^file_[a-z_]{2,40}$'),
  lien text not null check (lien ~ '^/admin/[a-z0-9/_-]*$'),
  ordre integer not null default 100,
  derniere_alerte_le timestamptz,
  dernier_nombre bigint not null default 0,
  derniere_alerte_ancien_le timestamptz
);
alter table public.files_admin enable row level security;
revoke all on table public.files_admin from anon, authenticated;

-- Compte une file : nombre d'éléments en attente et plus ancien. Interne.
create function public.compter_file(p_vue text)
returns table (nombre bigint, plus_ancien timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_vue !~ '^file_[a-z_]{2,40}$' then
    raise exception 'Nom de vue invalide.';
  end if;
  return query execute format('select nombre::bigint, plus_ancien from public.%I', p_vue);
end;
$$;

-- État de toutes les files (compteurs de la barre latérale et de « Ma file de travail »)
create function public.etat_files_admin()
returns table (nom text, libelle text, lien text, nombre bigint, plus_ancien timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_file record;
  v_etat record;
begin
  if not public.est_admin() then
    raise exception 'Action non autorisée.';
  end if;
  for v_file in select f.nom, f.libelle, f.lien, f.vue from public.files_admin f order by f.ordre, f.nom loop
    select c.nombre, c.plus_ancien into v_etat from public.compter_file(v_file.vue) c;
    nom := v_file.nom; libelle := v_file.libelle; lien := v_file.lien;
    nombre := coalesce(v_etat.nombre, 0); plus_ancien := v_etat.plus_ancien;
    return next;
  end loop;
end;
$$;

-- Phrase de résumé sans donnée personnelle, pour les relances (RGA33). Interne.
create function public.resume_files_admin()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_total bigint := 0;
  v_ancien timestamptz;
  v_file record;
  v_etat record;
begin
  for v_file in select vue from public.files_admin loop
    select c.nombre, c.plus_ancien into v_etat from public.compter_file(v_file.vue) c;
    v_total := v_total + coalesce(v_etat.nombre, 0);
    if v_etat.plus_ancien is not null and (v_ancien is null or v_etat.plus_ancien < v_ancien) then v_ancien := v_etat.plus_ancien; end if;
  end loop;
  if v_total = 0 then
    return 'Des éléments attendent ta décision dans l''espace admin.';
  end if;
  return format('%s élément%s en attente dans les files (le plus ancien depuis %s h).',
    v_total, case when v_total > 1 then 's' else '' end, greatest(1, floor(extract(epoch from now() - v_ancien) / 3600))::int);
end;
$$;

-- RGA29, RGA34 : toutes les 15 minutes (pg_cron), une alerte groupée par file qui a de nouveaux éléments
-- (au plus une toutes les 15 minutes), et une alerte supplémentaire par jour pour une file dont un élément attend
-- depuis plus de 24 heures. Interne : aucun GRANT.
create function public.alertes_files()
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
begin
  for v_file in select * from public.files_admin order by ordre, nom loop
    select c.nombre, c.plus_ancien into v_etat from public.compter_file(v_file.vue) c;
    v_etat.nombre := coalesce(v_etat.nombre, 0);
    v_alerte := false;
    v_ancien := false;

    if v_etat.nombre > v_file.dernier_nombre
       and (v_file.derniere_alerte_le is null or v_file.derniere_alerte_le <= now() - interval '15 minutes') then
      v_alerte := true;
    elsif v_etat.plus_ancien is not null and v_etat.plus_ancien < now() - interval '24 hours'
          and (v_file.derniere_alerte_ancien_le is null or v_file.derniere_alerte_ancien_le < now() - interval '24 hours') then
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
      -- la file a diminué : les prochains nouveaux éléments déclencheront de nouveau une alerte
      update public.files_admin set dernier_nombre = v_etat.nombre where nom = v_file.nom;
    end if;
  end loop;
  return v_envoyees;
end;
$$;

-- Fin automatique des suspensions à durée limitée. Interne.
create function public.lever_suspensions_expirees()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte record;
  v_nb integer := 0;
begin
  for v_compte in
    select id from public.profils where statut = 'suspendu' and suspendu_jusqua is not null and suspendu_jusqua <= now()
  loop
    update public.profils set statut = 'actif', motif_suspension = null, suspendu_jusqua = null where id = v_compte.id;
    update auth.users set banned_until = null where id = v_compte.id;
    perform public.journaliser(null, 'fin_suspension', 'utilisateur', v_compte.id::text, '{}'::jsonb);
    perform public.notifier(v_compte.id, 'compte_reactive', 'Ta suspension est terminée.', null);
    v_nb := v_nb + 1;
  end loop;
  return v_nb;
end;
$$;

create function public.taches_planifiees()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.alertes_files();
  perform public.lever_suspensions_expirees();
  delete from public.sessions_admin where derniere_activite < now() - interval '1 day';
end;
$$;

-- Relances du super-admin (RGA31, RGA32)
create table public.relances (
  id bigint generated always as identity primary key,
  de uuid references auth.users (id) on delete set null,
  a uuid not null references auth.users (id) on delete cascade,
  canal text not null check (canal in ('notification', 'email', 'whatsapp')),
  motif text check (char_length(motif) <= 200),
  cree_le timestamptz not null default now(),
  vu_le timestamptz
);
create index relances_a_idx on public.relances (a, cree_le desc);
alter table public.relances enable row level security;
revoke all on table public.relances from anon, authenticated;
grant select on public.relances to authenticated;
-- Le super-admin voit toutes les relances et leur « vu le » ; un admin voit les siennes.
create policy relances_lecture on public.relances for select to authenticated
  using (public.est_super_admin() or (a = (select auth.uid()) and public.est_admin()));

-- RG45 : le motif est un texte libre, contrôlé par S (blocage seulement)
create trigger relances_texte before insert or update on public.relances
  for each row execute function public.controler_colonnes_texte('relance', 'prive', 'de', 'motif');

-- RGA31 : « un admin ou tous ». Une relance au plus par admin et par heure (RGA32). Super-admin seulement.
-- Renvoie, pour chaque admin relancé, le texte neutre à reprendre dans l'e-mail ou le message WhatsApp.
create function public.relancer_admin(p_cible uuid, p_canal text, p_motif text default null)
returns table (cible_id uuid, prenom text, relance_id bigint, resume text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
  v_cible record;
  v_id bigint;
  v_resume text;
  v_nb integer := 0;
begin
  if not public.est_super_admin() then
    raise exception 'Action non autorisée.';
  end if;
  if p_canal not in ('notification', 'email', 'whatsapp') then
    raise exception 'Canal invalide.';
  end if;
  perform public.verifier_quota('relance');
  v_resume := public.resume_files_admin();

  for v_cible in
    select p.id, p.prenom from public.profils p
    where p.role = 'admin' and p.statut = 'actif' and (p_cible is null or p.id = p_cible)
    order by p.created_at
  loop
    if exists (select 1 from public.relances r where r.a = v_cible.id and r.cree_le > now() - interval '1 hour') then
      if p_cible is not null then
        raise exception 'Cet administrateur a déjà été relancé il y a moins d''une heure.';
      end if;
      continue;
    end if;
    insert into public.relances (de, a, canal, motif) values (v_uid, v_cible.id, p_canal, v_motif) returning id into v_id;
    -- RGA33 : texte fixe, aucune donnée personnelle
    perform public.notifier(v_cible.id, 'relance', 'Relance du super-admin : des éléments attendent ta décision.', '/admin');
    perform public.journaliser('relance', 'utilisateur', v_cible.id::text, jsonb_build_object('canal', p_canal));
    cible_id := v_cible.id; prenom := v_cible.prenom; relance_id := v_id; resume := v_resume;
    v_nb := v_nb + 1;
    return next;
  end loop;

  if v_nb = 0 then
    raise exception 'Aucun administrateur à relancer pour le moment (relance déjà faite il y a moins d''une heure, ou aucun admin actif).';
  end if;
end;
$$;

-- Bandeau « Relance du super-admin » (RGA32)
create function public.mes_relances_non_vues()
returns table (id bigint, cree_le timestamptz, motif text)
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
    select r.id, r.cree_le, r.motif from public.relances r
    where r.a = (select auth.uid()) and r.vu_le is null order by r.cree_le desc;
end;
$$;

create function public.marquer_relance_vue(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.est_admin() then
    raise exception 'Action non autorisée.';
  end if;
  update public.relances set vu_le = now() where id = p_id and a = (select auth.uid()) and vu_le is null;
  if not found then
    raise exception 'Relance introuvable.';
  end if;
end;
$$;

-- Suivi des relances pour le super-admin : qui a vu, et quand
create function public.liste_relances()
returns table (id bigint, a_id uuid, a_prenom text, canal text, motif text, cree_le timestamptz, vu_le timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.est_super_admin() then
    raise exception 'Action non autorisée.';
  end if;
  return query
    select r.id, r.a, p.prenom, r.canal, r.motif, r.cree_le, r.vu_le
    from public.relances r left join public.profils p on p.id = r.a
    order by r.id desc limit 100;
end;
$$;

-- Liste des administrateurs avec les coordonnées utiles aux relances par e-mail ou WhatsApp (super-admin seulement)
create function public.liste_administrateurs()
returns table (id uuid, prenom text, nom text, email text, telephone text, role text, statut text, derniere_connexion timestamptz, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.est_super_admin() then
    raise exception 'Action non autorisée.';
  end if;
  return query
    select p.id, p.prenom, p.nom, u.email::text, p.telephone, p.role::text, p.statut::text, u.last_sign_in_at, p.created_at
    from public.profils p join auth.users u on u.id = p.id
    where p.role in ('admin', 'super_admin')
    order by p.role desc, p.created_at;
end;
$$;

-- Préférences d'e-mail du super-admin (RGA35). Les relances manuelles s'affichent toujours dans l'application.
create table public.preferences_admin (
  user_id uuid primary key references public.profils (id) on delete cascade,
  recap_quotidien boolean not null default true,
  alertes_urgentes boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.preferences_admin enable row level security;
revoke all on table public.preferences_admin from anon, authenticated;

create function public.mes_preferences_admin()
returns table (recap_quotidien boolean, alertes_urgentes boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.est_super_admin() then
    raise exception 'Action non autorisée.';
  end if;
  return query
    select coalesce(p.recap_quotidien, true), coalesce(p.alertes_urgentes, true)
    from (select 1) u left join public.preferences_admin p on p.user_id = (select auth.uid());
end;
$$;

create function public.definir_preferences_admin(p_recap boolean, p_alertes boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.est_super_admin() then
    raise exception 'Action non autorisée.';
  end if;
  insert into public.preferences_admin (user_id, recap_quotidien, alertes_urgentes)
  values ((select auth.uid()), coalesce(p_recap, true), coalesce(p_alertes, true))
  on conflict (user_id) do update
    set recap_quotidien = excluded.recap_quotidien, alertes_urgentes = excluded.alertes_urgentes, updated_at = now();
  perform public.journaliser('preferences_email', 'utilisateur', (select auth.uid())::text, '{}'::jsonb);
end;
$$;

-- Données du récapitulatif quotidien (RGA30) pour l'Edge Function admin-recapitulatif. service_role seulement.
-- Aucune donnée personnelle hors l'adresse du destinataire (le super-admin lui-même).
create function public.donnees_recapitulatif()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_files jsonb := '[]'::jsonb;
  v_file record;
  v_etat record;
begin
  for v_file in select libelle, vue from public.files_admin order by ordre, nom loop
    select c.nombre, c.plus_ancien into v_etat from public.compter_file(v_file.vue) c;
    v_files := v_files || jsonb_build_object(
      'libelle', v_file.libelle, 'nombre', coalesce(v_etat.nombre, 0), 'plus_ancien', v_etat.plus_ancien,
      'urgent', v_etat.plus_ancien is not null and v_etat.plus_ancien < now() - interval '24 hours');
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
  public.rang_role(public.role_utilisateur),
  public.journaliser(uuid, text, text, text, jsonb),
  public.signaler_activite_admin(), public.garder_dernier_super_admin(),
  public.liste_utilisateurs(text, text, text, date, date, integer, integer), public.fiche_utilisateur(uuid),
  public.controler_acteur_admin(uuid, uuid, boolean, boolean),
  public.admin_action_suspendre(uuid, uuid, text, timestamptz), public.admin_action_reactiver(uuid, uuid),
  public.admin_action_changer_role(uuid, uuid, text), public.anonymiser_compte(uuid),
  public.admin_action_desactiver(uuid, uuid, text), public.admin_action_preparer_suppression(uuid, uuid, text),
  public.admin_action_preparer_reinit_mfa(uuid, uuid, text),
  public.compter_file(text), public.etat_files_admin(), public.resume_files_admin(),
  public.alertes_files(), public.lever_suspensions_expirees(), public.taches_planifiees(),
  public.relancer_admin(uuid, text, text), public.mes_relances_non_vues(), public.marquer_relance_vue(bigint),
  public.liste_relances(), public.liste_administrateurs(),
  public.mes_preferences_admin(), public.definir_preferences_admin(boolean, boolean), public.donnees_recapitulatif()
  from public, anon, authenticated;

-- Appelables par un admin connecté (le corps vérifie est_admin() : rôle, aal2 et session active)
grant execute on function public.signaler_activite_admin() to authenticated;
grant execute on function public.liste_utilisateurs(text, text, text, date, date, integer, integer) to authenticated;
grant execute on function public.fiche_utilisateur(uuid) to authenticated;
grant execute on function public.etat_files_admin() to authenticated;
grant execute on function public.mes_relances_non_vues() to authenticated;
grant execute on function public.marquer_relance_vue(bigint) to authenticated;
-- Appelables par le super-admin (le corps vérifie est_super_admin())
grant execute on function public.relancer_admin(uuid, text, text) to authenticated;
grant execute on function public.liste_relances() to authenticated;
grant execute on function public.liste_administrateurs() to authenticated;
grant execute on function public.mes_preferences_admin() to authenticated;
grant execute on function public.definir_preferences_admin(boolean, boolean) to authenticated;
-- Réservées à l'Edge Function (service_role) : actions sur les comptes et récapitulatif
grant execute on function public.admin_action_suspendre(uuid, uuid, text, timestamptz) to service_role;
grant execute on function public.admin_action_reactiver(uuid, uuid) to service_role;
grant execute on function public.admin_action_changer_role(uuid, uuid, text) to service_role;
grant execute on function public.admin_action_desactiver(uuid, uuid, text) to service_role;
grant execute on function public.admin_action_preparer_suppression(uuid, uuid, text) to service_role;
grant execute on function public.admin_action_preparer_reinit_mfa(uuid, uuid, text) to service_role;
grant execute on function public.donnees_recapitulatif() to service_role;
-- Internes, sans GRANT : rang_role, journaliser(uuid,…), garder_dernier_super_admin, controler_acteur_admin,
-- anonymiser_compte, compter_file, resume_files_admin, alertes_files, lever_suspensions_expirees, taches_planifiees

insert into public.limites (action, fenetre_secondes, maximum, portee) values
  ('relance', 3600, 20, 'utilisateur') -- RGP20 : garde-fou en plus de la règle « une relance par admin et par heure »
on conflict do nothing;
