-- 0300_auth.sql
-- Module M2 : comptes, profils, rôles et fonctions de droits partagées.
--
-- Données personnelles (RGP01) :
--  - nom, prénom : identité affichée ; seul le prénom et l'initiale seront publics (M3) ;
--  - téléphone : obligatoire (RG11), contact entre utilisateurs ; jamais public ;
--  - cgu_version, cgu_acceptee_le : preuve d'acceptation des conditions (RGP12) ;
--  - l'e-mail reste dans auth.users, géré par Supabase Auth, il n'est pas copié ici.

-- =====================================================================
-- Types
-- =====================================================================
create type public.role_utilisateur as enum ('etudiant', 'proprietaire', 'admin', 'super_admin'); -- RG02
create type public.statut_compte as enum ('actif', 'suspendu', 'desactive');

-- =====================================================================
-- Tables
-- =====================================================================

-- RG05 : un profil de base par utilisateur (id = clé primaire), plus un profil propre à son rôle
create table public.profils (
  id uuid primary key references auth.users (id) on delete cascade,
  nom text not null check (char_length(btrim(nom)) between 1 and 100),
  prenom text not null check (char_length(btrim(prenom)) between 1 and 100),
  -- RG11 : téléphone obligatoire
  telephone text not null check (telephone ~ '^\+?[0-9 ]{8,20}$'),
  role public.role_utilisateur not null default 'etudiant', -- RG02
  statut public.statut_compte not null default 'actif',
  motif_suspension text check (char_length(motif_suspension) <= 300),
  suspendu_jusqua timestamptz,
  -- RGP12 : version des conditions acceptée et date d'acceptation
  cgu_version text not null,
  cgu_acceptee_le timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RG06 : un étudiant est rattaché à une université (NOT NULL + clé étrangère)
create table public.profils_etudiants (
  user_id uuid primary key references public.profils (id) on delete cascade,
  universite_id bigint not null references public.universites (id) on delete restrict,
  niveau_etude text check (char_length(niveau_etude) <= 50),
  filiere text check (char_length(filiere) <= 100),
  budget_max numeric check (budget_max >= 0), -- FCFA
  bio text check (char_length(bio) <= 500)
);
create index profils_etudiants_universite_idx on public.profils_etudiants (universite_id);

create table public.profils_proprietaires (
  user_id uuid primary key references public.profils (id) on delete cascade,
  type_proprietaire text not null default 'particulier' check (type_proprietaire in ('particulier', 'agence')),
  adresse text check (char_length(adresse) <= 300)
);

-- =====================================================================
-- Fonctions de droits réutilisables par tous les modules
-- (SECURITY DEFINER : elles lisent profils sans passer par la RLS, ce qui évite une récursion)
-- =====================================================================

-- Le compte de l'appelant est actif
create function public.est_actif()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profils where id = (select auth.uid()) and statut = 'actif'
  );
$$;

-- RGA04 : admin ou super_admin, compte actif, jeton de niveau aal2 (double authentification faite)
create function public.est_admin()
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
    );
$$;

create function public.est_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
    and exists (
      select 1 from public.profils
      where id = (select auth.uid()) and statut = 'actif' and role = 'super_admin'
    );
$$;

-- RGA16 : on écrit si le compte est actif et si la plateforme n'est pas en maintenance (sauf admin)
create function public.peut_ecrire()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.est_actif() and (not public.en_maintenance() or public.est_admin());
$$;

-- Droits : fonction -> rôles autorisés (RGP17)
revoke execute on function public.est_actif(), public.est_admin(), public.est_super_admin(), public.peut_ecrire()
  from public, anon, authenticated;
grant execute on function public.est_actif(), public.est_admin(), public.est_super_admin(), public.peut_ecrire()
  to authenticated;

-- =====================================================================
-- Création du compte : déclencheur sur auth.users
-- Supabase Auth masque le message d'une exception (« Database error saving new user ») :
-- le formulaire Vue refait ces contrôles pour afficher des messages clairs,
-- mais c'est ce déclencheur qui protège vraiment.
-- =====================================================================
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role_texte text := coalesce(nullif(v_meta ->> 'role', ''), 'etudiant');
  v_role public.role_utilisateur;
  v_nom text := btrim(coalesce(v_meta ->> 'nom', ''));
  v_prenom text := btrim(coalesce(v_meta ->> 'prenom', ''));
  v_telephone text := btrim(coalesce(v_meta ->> 'telephone', ''));
  v_cgu text := coalesce(v_meta ->> 'cgu_version', '');
  v_univ_texte text := coalesce(v_meta ->> 'universite_id', '');
  v_univ bigint;
  v_budget_texte text := coalesce(v_meta ->> 'budget_max', '');
  v_type text := coalesce(nullif(v_meta ->> 'type_proprietaire', ''), 'particulier');
begin
  -- RG03, RGA05 : seuls étudiant et propriétaire peuvent s'inscrire
  if v_role_texte not in ('etudiant', 'proprietaire') then
    raise exception 'Ce type de compte ne peut pas être créé à l''inscription.';
  end if;
  v_role := v_role_texte::public.role_utilisateur;

  -- Les inscriptions peuvent être fermées par un super-admin (paramètre inscriptions_ouvertes)
  if not coalesce((select (valeur #>> '{}')::boolean from public.parametres where cle = 'inscriptions_ouvertes'), true) then
    raise exception 'Les inscriptions sont fermées pour le moment.';
  end if;

  if v_nom = '' or v_prenom = '' then
    raise exception 'Le nom et le prénom sont obligatoires.';
  end if;

  -- RG11 : téléphone obligatoire
  if v_telephone = '' or v_telephone !~ '^\+?[0-9 ]{8,20}$' then
    raise exception 'Un numéro de téléphone valide est obligatoire.';
  end if;

  -- RGP12 : la version des conditions acceptée doit être la version en vigueur
  if v_cgu = '' or v_cgu is distinct from (select valeur #>> '{}' from public.parametres where cle = 'version_cgu') then
    raise exception 'Les conditions d''utilisation et la politique de confidentialité doivent être acceptées.';
  end if;

  insert into public.profils (id, nom, prenom, telephone, role, cgu_version)
  values (new.id, v_nom, v_prenom, v_telephone, v_role, v_cgu);

  if v_role = 'etudiant' then
    -- RG06 : une université existante est obligatoire pour un étudiant
    if v_univ_texte !~ '^[0-9]{1,18}$' then
      raise exception 'Un étudiant doit choisir son université.';
    end if;
    v_univ := v_univ_texte::bigint;
    if not exists (select 1 from public.universites where id = v_univ) then
      raise exception 'Cette université n''existe pas.';
    end if;

    insert into public.profils_etudiants (user_id, universite_id, niveau_etude, filiere, budget_max)
    values (
      new.id, v_univ,
      left(nullif(v_meta ->> 'niveau_etude', ''), 50),
      left(nullif(v_meta ->> 'filiere', ''), 100),
      case when v_budget_texte ~ '^[0-9]{1,12}$' then v_budget_texte::numeric else null end
    );
  else
    if v_type not in ('particulier', 'agence') then
      raise exception 'Le type de propriétaire est invalide.';
    end if;
    insert into public.profils_proprietaires (user_id, type_proprietaire, adresse)
    values (new.id, v_type, left(nullif(v_meta ->> 'adresse', ''), 300));
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RG05 : un profil propre à chaque rôle, jamais celui d'un autre rôle
create function public.verifier_role_profil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attendu public.role_utilisateur :=
    case tg_table_name when 'profils_etudiants' then 'etudiant' else 'proprietaire' end;
begin
  if not exists (select 1 from public.profils where id = new.user_id and role = v_attendu) then
    raise exception 'Ce profil ne correspond pas au rôle du compte.';
  end if;
  return new;
end;
$$;

revoke execute on function public.verifier_role_profil() from public, anon, authenticated;

create trigger profils_etudiants_role before insert on public.profils_etudiants
  for each row execute function public.verifier_role_profil();
create trigger profils_proprietaires_role before insert on public.profils_proprietaires
  for each row execute function public.verifier_role_profil();

-- Mise à jour automatique de updated_at
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.touch_updated_at() from public, anon, authenticated;

create trigger profils_updated_at before update on public.profils
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- RLS (RG10, RGP04) : chacun lit et modifie ses propres profils ; l'admin lit tout
-- =====================================================================
alter table public.profils enable row level security;
alter table public.profils_etudiants enable row level security;
alter table public.profils_proprietaires enable row level security;

-- Droits de colonnes (RG03, RG10) : l'utilisateur ne peut jamais modifier role, statut,
-- motif ou durée de suspension, ni les champs d'acceptation des conditions.
revoke all on table public.profils, public.profils_etudiants, public.profils_proprietaires
  from anon, authenticated;
grant select on public.profils, public.profils_etudiants, public.profils_proprietaires to authenticated;
grant update (nom, prenom, telephone) on public.profils to authenticated;
grant update (universite_id, niveau_etude, filiere, budget_max, bio) on public.profils_etudiants to authenticated;
grant update (type_proprietaire, adresse) on public.profils_proprietaires to authenticated;

create policy profils_lecture on public.profils for select to authenticated
  using (id = (select auth.uid()) or public.est_admin());
create policy profils_modification on public.profils for update to authenticated
  using (id = (select auth.uid()) and public.peut_ecrire())
  with check (id = (select auth.uid()));

create policy etudiants_lecture on public.profils_etudiants for select to authenticated
  using (user_id = (select auth.uid()) or public.est_admin());
create policy etudiants_modification on public.profils_etudiants for update to authenticated
  using (user_id = (select auth.uid()) and public.peut_ecrire())
  with check (user_id = (select auth.uid()));

create policy proprietaires_lecture on public.profils_proprietaires for select to authenticated
  using (user_id = (select auth.uid()) or public.est_admin());
create policy proprietaires_modification on public.profils_proprietaires for update to authenticated
  using (user_id = (select auth.uid()) and public.peut_ecrire())
  with check (user_id = (select auth.uid()));

-- =====================================================================
-- Acceptation d'une nouvelle version des conditions (RGP12)
-- =====================================================================
create function public.accepter_cgu(p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.est_actif() then
    raise exception 'Connexion requise.';
  end if;
  -- On n'accepte que la version en vigueur
  if p_version is distinct from (select valeur #>> '{}' from public.parametres where cle = 'version_cgu') then
    raise exception 'Cette version des conditions n''est plus en vigueur.';
  end if;
  update public.profils
  set cgu_version = p_version, cgu_acceptee_le = now()
  where id = (select auth.uid());
end;
$$;

revoke execute on function public.accepter_cgu(text) from public, anon, authenticated;
grant execute on function public.accepter_cgu(text) to authenticated;

-- =====================================================================
-- Paramètres publics : délais d'inactivité avant déconnexion (RGP28)
-- =====================================================================
insert into public.parametres (cle, valeur, publique) values
  ('inactivite_etudiant_jours', '7', true),
  ('inactivite_proprietaire_jours', '14', true)
on conflict (cle) do nothing;
