-- 0960_kyc.sql
-- Module K : vérification d'identité des étudiants (KYC manuel et gratuit, RG51 à RG59).
-- Numérotée après A2 et A5 car elle s'appuie sur files_admin (0910) et le paramètre kyc_actif (0950).
--
-- Données personnelles (RGP01) :
--  - pièce officielle (recto, verso) et selfie : TRÈS SENSIBLES. Jamais lisibles par un utilisateur, même par son
--    titulaire. Stockées chiffrées (AES-256-GCM par l'Edge Function kyc-depot) dans le bucket privé kyc_prives ;
--  - code_selfie (4 chiffres) : prouve que le selfie est pris en direct ; sans valeur après la décision ;
--  - nom_verifie, prenom_verifie, empreinte_avatar_verifie : copie de ce que l'admin a vu, pour détecter un
--    changement ultérieur (RG57) ; ni numéro de pièce ni date de naissance ne sont enregistrés (RG56) ;
--  - empreintes dHash des images : servent à repérer une image déjà vue sur un autre compte (RG58) ; elles ne
--    permettent pas de reconstituer l'image et restent après l'effacement des images.

-- =====================================================================
-- Types et table
-- =====================================================================
create type public.statut_kyc as enum ('non_soumis', 'en_attente', 'valide', 'refuse'); -- RG54
create type public.type_piece as enum ('cni', 'passeport'); -- [À VALIDER : autres pièces]

create table public.verifications_identite (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profils (id) on delete cascade,
  type_piece public.type_piece,
  chemin_recto text,
  chemin_verso text,
  chemin_selfie text,
  empreinte_recto text check (empreinte_recto ~ '^[0-9a-f]{16}$'),
  empreinte_verso text check (empreinte_verso ~ '^[0-9a-f]{16}$'),
  empreinte_selfie text check (empreinte_selfie ~ '^[0-9a-f]{16}$'),
  code_selfie text not null check (code_selfie ~ '^[0-9]{4}$'),
  consentement_le timestamptz,
  statut public.statut_kyc not null default 'non_soumis',
  motif_refus text check (char_length(motif_refus) <= 300),
  decide_par uuid references auth.users (id) on delete set null,
  decide_le timestamptz,
  suspect boolean not null default false, -- RG58 : une image déjà vue sur un autre compte
  nom_verifie text,
  prenom_verifie text,
  empreinte_avatar_verifie text,
  soumis_le timestamptz,
  images_effacees_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un dossier en attente est complet et le consentement est donné (RG53)
  constraint kyc_en_attente_complet check (
    statut <> 'en_attente'
    or (chemin_recto is not null and chemin_verso is not null and chemin_selfie is not null
        and consentement_le is not null and type_piece is not null)
  ),
  constraint kyc_refus_motif check (statut <> 'refuse' or motif_refus is not null)
);
-- Un seul dossier ouvert par utilisateur
create unique index verifications_identite_ouvert_idx on public.verifications_identite (user_id)
  where statut in ('non_soumis', 'en_attente');
create index verifications_identite_file_idx on public.verifications_identite (statut, soumis_le);
create index verifications_identite_user_idx on public.verifications_identite (user_id, created_at);

alter table public.verifications_identite enable row level security;
revoke all on table public.verifications_identite from anon, authenticated;
-- RG55 : l'étudiant lit le statut et le motif de SON dossier, jamais les chemins ni les empreintes ni le code.
-- Aucune écriture directe : tout passe par les fonctions ci-dessous.
grant select (id, user_id, type_piece, statut, motif_refus, decide_le, soumis_le, created_at) on public.verifications_identite to authenticated;
create policy kyc_lecture_propre on public.verifications_identite for select to authenticated
  using (user_id = (select auth.uid()));

-- =====================================================================
-- Stockage (RGP21) : bucket privé, aucune politique pour les utilisateurs
-- =====================================================================
-- Les fichiers sont des images chiffrées : leur type est donc « octet-stream ». Seule l'Edge Function kyc-depot
-- (service_role) écrit, seule kyc-consulter (service_role, après contrôle aal2) lit. Jamais dans les sauvegardes (RGP25).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('kyc_prives', 'kyc_prives', false, 4194304, array['application/octet-stream'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- =====================================================================
-- Fonctions internes
-- =====================================================================

-- RG59 : le KYC est-il activé ? Interne.
create function public.kyc_actif()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (valeur #>> '{}')::boolean from public.parametres where cle = 'kyc_actif'), false);
$$;

-- Empreinte de l'avatar validé actuel, ou null. Interne.
create function public.empreinte_avatar_actuel(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select ph.empreinte from public.photos ph where ph.chemin = public.avatar_valide(p_uid);
$$;

-- RG57 : la vérification validée correspond encore à l'identité actuelle (nom, prénom, avatar). Interne.
-- Aucun déclencheur sur les tables de M3 : on compare à la lecture.
create function public.identite_conforme(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.verifications_identite v
    join public.profils p on p.id = v.user_id
    where v.user_id = p_uid and v.statut = 'valide'
      and v.nom_verifie = p.nom and v.prenom_verifie = p.prenom
      and v.empreinte_avatar_verifie is not distinct from public.empreinte_avatar_actuel(p_uid)
      and v.empreinte_avatar_verifie is not null
  );
$$;

-- RG52, RG57, RG59 : l'identité de cet utilisateur est-elle vérifiée ? Utilisée par M4 (publier une place en
-- colocation) et M8 (lancer ou rejoindre un groupe). Ne renvoie qu'un booléen, déjà public sous forme de badge.
-- RG59 : KYC désactivé = vrai pour tout étudiant actif. Les propriétaires ne sont concernés que si
-- kyc_proprietaires est vrai.
create function public.identite_verifiee(p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.role_utilisateur;
  v_proprietaires boolean;
begin
  select role into v_role from public.profils where id = p_uid and statut = 'actif';
  if v_role is null then
    return false;
  end if;
  if not public.kyc_actif() then
    return v_role = 'etudiant' or v_role = 'proprietaire';
  end if;
  if v_role = 'proprietaire' then
    select coalesce((select (valeur #>> '{}')::boolean from public.parametres where cle = 'kyc_proprietaires'), false)
      into v_proprietaires;
    if not v_proprietaires then
      return true;
    end if;
  elsif v_role <> 'etudiant' then
    return false;
  end if;
  return public.identite_conforme(p_uid);
end;
$$;

-- RG52 : à appeler dans les fonctions et déclencheurs de M4 et M8 avant de publier une place en colocation ou de
-- lancer / rejoindre un groupe. Interne.
create function public.exiger_identite_verifiee()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.identite_verifiee((select auth.uid())) then
    raise exception 'Vérifie ton identité avant de continuer.';
  end if;
end;
$$;

-- =====================================================================
-- Parcours de l'étudiant
-- =====================================================================

-- RG53, RG54 : ouvre un dossier (ou reprend celui en cours) et renvoie le code du selfie.
create function public.demarrer_kyc()
returns table (verification_id uuid, code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.role_utilisateur;
  v_proprietaires boolean;
  v_dossier public.verifications_identite;
begin
  if not public.peut_ecrire() then
    raise exception 'Action impossible pour le moment.';
  end if;
  if not public.kyc_actif() then
    raise exception 'La vérification d''identité n''est pas activée pour le moment.';
  end if;
  select role into v_role from public.profils where id = v_uid;
  if v_role = 'proprietaire' then
    select coalesce((select (valeur #>> '{}')::boolean from public.parametres where cle = 'kyc_proprietaires'), false)
      into v_proprietaires;
  end if;
  if v_role <> 'etudiant' and not coalesce(v_proprietaires, false) then
    raise exception 'La vérification d''identité ne concerne pas ton type de compte.';
  end if;
  -- RG51 : pas de dépôt sans photo de profil validée
  if public.avatar_valide(v_uid) is null then
    raise exception 'Ta photo de profil doit d''abord être validée.';
  end if;
  if public.identite_conforme(v_uid) then
    raise exception 'Ton identité est déjà vérifiée.';
  end if;
  perform public.verifier_quota('demarrer_kyc');

  select * into v_dossier from public.verifications_identite
    where user_id = v_uid and statut in ('non_soumis', 'en_attente');
  if found then
    if v_dossier.statut = 'en_attente' then
      raise exception 'Ton dossier est déjà en cours d''examen.';
    end if;
    verification_id := v_dossier.id;
    code := v_dossier.code_selfie;
    return next;
    return;
  end if;

  -- RG54 : trois dossiers au plus par 30 jours
  if (select count(*) from public.verifications_identite where user_id = v_uid and created_at > now() - interval '30 days') >= 3 then
    raise exception 'Tu as déjà déposé trois dossiers ces 30 derniers jours. Réessaie plus tard.';
  end if;

  insert into public.verifications_identite (user_id, code_selfie)
  values (v_uid, lpad((floor(random() * 10000))::integer::text, 4, '0'))
  returning id, code_selfie into verification_id, code;
  return next;
end;
$$;

-- RG53 : consentement explicite, donné AVANT l'envoi de la première image.
create function public.consentir_kyc()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.peut_ecrire() or not public.kyc_actif() then
    raise exception 'Action impossible pour le moment.';
  end if;
  update public.verifications_identite
  set consentement_le = now(), updated_at = now()
  where user_id = auth.uid() and statut = 'non_soumis';
  if not found then
    raise exception 'Aucun dossier à compléter. Commence par démarrer la vérification.';
  end if;
end;
$$;

-- Envoie le dossier à l'examen (RG53, RG54).
create function public.soumettre_kyc(p_type_piece text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_dossier public.verifications_identite;
begin
  if not public.peut_ecrire() or not public.kyc_actif() then
    raise exception 'Action impossible pour le moment.';
  end if;
  if p_type_piece not in ('cni', 'passeport') then
    raise exception 'Choisis le type de pièce d''identité.';
  end if;
  select * into v_dossier from public.verifications_identite where user_id = v_uid and statut = 'non_soumis' for update;
  if not found then
    raise exception 'Aucun dossier à envoyer.';
  end if;
  if v_dossier.consentement_le is null then
    raise exception 'Ton consentement est nécessaire pour envoyer le dossier.';
  end if;
  if v_dossier.chemin_recto is null or v_dossier.chemin_verso is null or v_dossier.chemin_selfie is null then
    raise exception 'Il manque une image : pièce (recto et verso) et selfie sont nécessaires.';
  end if;
  if public.avatar_valide(v_uid) is null then
    raise exception 'Ta photo de profil doit être validée.';
  end if;
  update public.verifications_identite
  set statut = 'en_attente', type_piece = p_type_piece::public.type_piece, soumis_le = now(), updated_at = now()
  where id = v_dossier.id;
end;
$$;

-- RGP03 / RG55 : retire le consentement tant qu'il n'y a pas de décision. Les images sont effacées aussitôt par
-- l'Edge Function kyc-depot (action « annuler ») ; en secours, la tâche de purge les efface (kyc_images_a_effacer).
create function public.annuler_kyc()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.est_actif() then
    raise exception 'Connexion requise.';
  end if;
  update public.verifications_identite
  set statut = 'non_soumis', consentement_le = null, soumis_le = null, updated_at = now()
  where user_id = auth.uid() and statut in ('non_soumis', 'en_attente');
  if not found then
    raise exception 'Aucun dossier en cours.';
  end if;
end;
$$;

-- État du dossier de la personne connectée. Le code du selfie n'est montré que pendant la préparation.
create function public.mon_kyc()
returns table (
  verification_id uuid, statut text, motif_refus text, type_piece text, code_selfie text, consentement boolean,
  recto boolean, verso boolean, selfie boolean, decide_le timestamptz, verifiee boolean, dossiers_restants integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_d public.verifications_identite;
begin
  if not public.est_actif() then
    raise exception 'Connexion requise.';
  end if;
  select * into v_d from public.verifications_identite where user_id = v_uid order by created_at desc limit 1;
  verifiee := public.identite_verifiee(v_uid);
  dossiers_restants := greatest(0, 3 - (select count(*)::integer from public.verifications_identite
    where user_id = v_uid and created_at > now() - interval '30 days'));
  if not found then
    statut := 'non_soumis'; consentement := false; recto := false; verso := false; selfie := false;
    return next;
    return;
  end if;
  verification_id := v_d.id;
  statut := v_d.statut::text;
  motif_refus := v_d.motif_refus;
  type_piece := v_d.type_piece::text;
  code_selfie := case when v_d.statut = 'non_soumis' then v_d.code_selfie end;
  consentement := v_d.consentement_le is not null;
  recto := v_d.chemin_recto is not null;
  verso := v_d.chemin_verso is not null;
  selfie := v_d.chemin_selfie is not null;
  decide_le := v_d.decide_le;
  return next;
end;
$$;

-- =====================================================================
-- Fonctions réservées à l'Edge Function kyc-depot (service_role seulement)
-- =====================================================================

-- Contrôle avant d'accepter une image. Lève des erreurs en français renvoyées à l'étudiant.
create function public.kyc_preparer_depot(p_uid uuid, p_verification uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.en_maintenance() then
    raise exception 'Action impossible pour le moment.';
  end if;
  if not public.kyc_actif() then
    raise exception 'La vérification d''identité n''est pas activée pour le moment.';
  end if;
  if not exists (select 1 from public.profils where id = p_uid and statut = 'actif') then
    raise exception 'Action non autorisée.';
  end if;
  if not exists (
    select 1 from public.verifications_identite
    where id = p_verification and user_id = p_uid and statut = 'non_soumis' and consentement_le is not null
  ) then
    raise exception 'Donne d''abord ton consentement pour commencer le dépôt.';
  end if;
  -- RGP20 : 20 images par jour
  if not public.consommer_quota('u:' || p_uid::text, 'depot_kyc', 86400, 20) then
    raise exception 'Tu fais trop de demandes. Réessaie dans un moment.';
  end if;
end;
$$;

-- Enregistre le chemin d'une image déposée (chiffrée) et son empreinte ; marque le dossier suspect si la même image
-- est déjà connue sur un autre compte (RG58). Tolérance : 2 bits sur 64.
create function public.kyc_enregistrer_image(p_uid uuid, p_verification uuid, p_type text, p_chemin text, p_empreinte text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connue boolean;
begin
  if p_type not in ('recto', 'verso', 'selfie') then
    raise exception 'Type d''image invalide.';
  end if;
  if p_chemin !~ ('^' || p_uid::text || '/' || p_verification::text || '/(recto|verso|selfie)\.bin$') then
    raise exception 'Chemin invalide.';
  end if;
  if p_empreinte !~ '^[0-9a-f]{16}$' then
    raise exception 'Empreinte invalide.';
  end if;

  select exists (
    select 1 from public.verifications_identite o
    where o.user_id <> p_uid
      and public.distance_empreintes(
        case p_type when 'recto' then o.empreinte_recto when 'verso' then o.empreinte_verso else o.empreinte_selfie end,
        p_empreinte) <= 2
  ) into v_connue;

  update public.verifications_identite
  set chemin_recto = case when p_type = 'recto' then p_chemin else chemin_recto end,
      chemin_verso = case when p_type = 'verso' then p_chemin else chemin_verso end,
      chemin_selfie = case when p_type = 'selfie' then p_chemin else chemin_selfie end,
      empreinte_recto = case when p_type = 'recto' then p_empreinte else empreinte_recto end,
      empreinte_verso = case when p_type = 'verso' then p_empreinte else empreinte_verso end,
      empreinte_selfie = case when p_type = 'selfie' then p_empreinte else empreinte_selfie end,
      suspect = suspect or v_connue,
      updated_at = now()
  where id = p_verification and user_id = p_uid and statut = 'non_soumis';
  if not found then
    raise exception 'Dossier introuvable.';
  end if;
end;
$$;

-- RG56 : dossiers dont les images doivent disparaître :
--  - 30 jours après la décision [À VALIDER] ;
--  - consentement retiré (annuler_kyc) ;
--  - dossier jamais envoyé depuis 7 jours ;
--  - compte désactivé (RGA09).
-- p_uid limite la recherche à un utilisateur (annulation immédiate). Utilisée par kyc-depot et kyc-purge.
create function public.kyc_images_a_effacer(p_uid uuid default null)
returns table (id uuid, chemins text[])
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, array_remove(array[v.chemin_recto, v.chemin_verso, v.chemin_selfie], null)
  from public.verifications_identite v
  where (v.chemin_recto is not null or v.chemin_verso is not null or v.chemin_selfie is not null)
    and (p_uid is null or v.user_id = p_uid)
    and (
      (v.statut in ('valide', 'refuse') and v.decide_le < now() - interval '30 days')
      or (v.statut = 'non_soumis' and v.consentement_le is null)
      or (v.statut = 'non_soumis' and v.updated_at < now() - interval '7 days')
      or exists (select 1 from public.profils p where p.id = v.user_id and p.statut = 'desactive')
    );
$$;

create function public.kyc_marquer_effacees(p_ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.verifications_identite
  set chemin_recto = null, chemin_verso = null, chemin_selfie = null,
      images_effacees_le = case when statut in ('valide', 'refuse') then now() else null end,
      updated_at = now()
  where id = any (p_ids);
$$;

-- =====================================================================
-- Fonctions de l'admin (est_admin() : rôle, aal2 et session active)
-- =====================================================================
create function public.liste_dossiers_kyc(p_statut text default 'en_attente')
returns table (id uuid, prenom text, nom text, type_piece text, statut text, suspect boolean, soumis_le timestamptz, decide_le timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.est_admin() then
    raise exception 'Action non autorisée.';
  end if;
  if p_statut not in ('en_attente', 'valide', 'refuse') then
    raise exception 'Filtre invalide.';
  end if;
  return query
    select v.id, p.prenom, p.nom, v.type_piece::text, v.statut::text, v.suspect, v.soumis_le, v.decide_le
    from public.verifications_identite v join public.profils p on p.id = v.user_id
    where v.statut = p_statut::public.statut_kyc
    order by v.soumis_le asc nulls last, v.created_at asc -- le plus ancien d'abord
    limit 100;
end;
$$;

create function public.dossier_kyc_admin(p_id uuid)
returns table (
  id uuid, prenom text, nom text, avatar_chemin text, type_piece text, code_selfie text, statut text,
  suspect boolean, soumis_le timestamptz, motif_refus text, images_disponibles boolean
)
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
    select v.id, p.prenom, p.nom, public.avatar_valide(v.user_id), v.type_piece::text, v.code_selfie, v.statut::text,
           v.suspect, v.soumis_le, v.motif_refus,
           (v.chemin_recto is not null and v.chemin_verso is not null and v.chemin_selfie is not null)
    from public.verifications_identite v join public.profils p on p.id = v.user_id
    where v.id = p_id and v.statut <> 'non_soumis';
end;
$$;

-- RG55 : appelée par kyc-consulter AVANT de déchiffrer. Contrôle l'admin (aal2), journalise la consultation
-- (RGA06, RGP10) et renvoie le chemin du fichier.
create function public.autoriser_consultation_kyc(p_id uuid, p_image text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d public.verifications_identite;
  v_chemin text;
begin
  if not public.est_admin() then
    raise exception 'Action non autorisée.';
  end if;
  if p_image not in ('recto', 'verso', 'selfie') then
    raise exception 'Image invalide.';
  end if;
  perform public.verifier_quota('consultation_kyc');
  select * into v_d from public.verifications_identite where id = p_id and statut <> 'non_soumis';
  if not found then
    raise exception 'Dossier introuvable.';
  end if;
  v_chemin := case p_image when 'recto' then v_d.chemin_recto when 'verso' then v_d.chemin_verso else v_d.chemin_selfie end;
  if v_chemin is null then
    raise exception 'Cette image n''est plus conservée.';
  end if;
  perform public.journaliser('kyc_consultation', 'verification', p_id::text, jsonb_build_object('image', p_image));
  return v_chemin;
end;
$$;

-- RG54, RG57 : décision. Refus : motif obligatoire, communiqué à l'étudiant. Validation : copie nom, prénom et
-- empreinte de l'avatar actuel. Aucune donnée personnelle dans le journal.
create function public.decider_kyc(p_id uuid, p_valide boolean, p_motif text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d public.verifications_identite;
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
  v_profil public.profils;
begin
  if not public.est_admin() then
    raise exception 'Action non autorisée.';
  end if;
  if p_valide is null then
    raise exception 'Décision invalide.';
  end if;
  if not p_valide and (v_motif is null or char_length(v_motif) > 300) then
    raise exception 'Un motif de refus est obligatoire (300 caractères au plus).';
  end if;
  select * into v_d from public.verifications_identite where id = p_id and statut = 'en_attente' for update;
  if not found then
    raise exception 'Dossier introuvable ou déjà traité.';
  end if;
  if v_d.user_id = auth.uid() then
    raise exception 'Tu ne peux pas décider de ton propre dossier.';
  end if;

  if p_valide then
    select * into v_profil from public.profils where id = v_d.user_id;
    if public.avatar_valide(v_d.user_id) is null then
      raise exception 'La photo de profil de cette personne n''est plus validée : refuse le dossier avec ce motif.';
    end if;
    update public.verifications_identite
    set statut = 'valide', motif_refus = null, decide_par = auth.uid(), decide_le = now(),
        nom_verifie = v_profil.nom, prenom_verifie = v_profil.prenom,
        empreinte_avatar_verifie = public.empreinte_avatar_actuel(v_d.user_id), updated_at = now()
    where id = p_id;
  else
    update public.verifications_identite
    set statut = 'refuse', motif_refus = v_motif, decide_par = auth.uid(), decide_le = now(), updated_at = now()
    where id = p_id;
  end if;

  perform public.journaliser(case when p_valide then 'kyc_valide' else 'kyc_refuse' end, 'verification', p_id::text, '{}'::jsonb);
  perform public.notifier(
    v_d.user_id, 'kyc_decision',
    case when p_valide then 'Ton identité est vérifiée.' else 'Ton dossier d''identité a été refusé : ' || v_motif end,
    '/identite'
  );
end;
$$;

-- =====================================================================
-- File de travail des admins (contrat A2 : vue file_<nom>, inscrite dans files_admin)
-- =====================================================================
create view public.file_identites with (security_invoker = true) as
  select count(*)::bigint as nombre, min(soumis_le) as plus_ancien
  from public.verifications_identite where statut = 'en_attente';
revoke all on public.file_identites from anon, authenticated;

insert into public.files_admin (nom, libelle, vue, lien, ordre)
values ('identites', 'Identités à vérifier', 'file_identites', '/admin/identites', 30)
on conflict (nom) do nothing;

-- =====================================================================
-- Export des données (RGP11) et compteurs de la fiche utilisateur (A2) : jamais de chemins
-- =====================================================================
create function public.exporter_donnees_identite(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('dossiers', coalesce((
    select jsonb_agg(jsonb_build_object(
      'statut', v.statut, 'type_piece', v.type_piece, 'depose_le', v.created_at, 'soumis_le', v.soumis_le,
      'decide_le', v.decide_le, 'motif_refus', v.motif_refus, 'consentement_le', v.consentement_le,
      'images_effacees_le', v.images_effacees_le) order by v.created_at)
    from public.verifications_identite v where v.user_id = p_uid
  ), '[]'::jsonb));
$$;

create function public.compteurs_utilisateur_identite(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('dossiers_identite', (select count(*) from public.verifications_identite where user_id = p_uid));
$$;

-- =====================================================================
-- Tâche d'effacement quotidienne : pg_cron → pg_net → Edge Function kyc-purge (RG56)
-- =====================================================================
create function public.declencher_purge_kyc()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'cron_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url || '/functions/v1/kyc-purge',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb
  );
end;
$$;

select cron.schedule('k-purge-images', '30 2 * * *', $$select public.declencher_purge_kyc()$$);

-- =====================================================================
-- Droits : fonction -> rôles autorisés (RGP17)
-- =====================================================================
revoke execute on function
  public.kyc_actif(), public.empreinte_avatar_actuel(uuid), public.identite_conforme(uuid), public.identite_verifiee(uuid),
  public.exiger_identite_verifiee(), public.demarrer_kyc(), public.consentir_kyc(), public.soumettre_kyc(text),
  public.annuler_kyc(), public.mon_kyc(), public.kyc_preparer_depot(uuid, uuid),
  public.kyc_enregistrer_image(uuid, uuid, text, text, text), public.kyc_images_a_effacer(uuid),
  public.kyc_marquer_effacees(uuid[]), public.liste_dossiers_kyc(text), public.dossier_kyc_admin(uuid),
  public.autoriser_consultation_kyc(uuid, text), public.decider_kyc(uuid, boolean, text),
  public.exporter_donnees_identite(uuid), public.compteurs_utilisateur_identite(uuid), public.declencher_purge_kyc()
  from public, anon, authenticated;

-- Le badge « Identité vérifiée » est public ; M4 et M8 s'en servent dans leurs politiques
grant execute on function public.identite_verifiee(uuid) to anon, authenticated;
grant execute on function public.demarrer_kyc() to authenticated;
grant execute on function public.consentir_kyc() to authenticated;
grant execute on function public.soumettre_kyc(text) to authenticated;
grant execute on function public.annuler_kyc() to authenticated;
grant execute on function public.mon_kyc() to authenticated;
-- Le corps vérifie est_admin() (aal2)
grant execute on function public.liste_dossiers_kyc(text) to authenticated;
grant execute on function public.dossier_kyc_admin(uuid) to authenticated;
grant execute on function public.autoriser_consultation_kyc(uuid, text) to authenticated;
grant execute on function public.decider_kyc(uuid, boolean, text) to authenticated;
-- Edge Functions kyc-depot et kyc-purge seulement
grant execute on function public.kyc_preparer_depot(uuid, uuid) to service_role;
grant execute on function public.kyc_enregistrer_image(uuid, uuid, text, text, text) to service_role;
grant execute on function public.kyc_images_a_effacer(uuid) to service_role;
grant execute on function public.kyc_marquer_effacees(uuid[]) to service_role;
-- Internes, sans GRANT : kyc_actif, empreinte_avatar_actuel, identite_conforme, exiger_identite_verifiee,
-- exporter_donnees_identite, compteurs_utilisateur_identite, declencher_purge_kyc

insert into public.limites (action, fenetre_secondes, maximum, portee) values
  ('demarrer_kyc', 86400, 10, 'utilisateur'),
  ('consultation_kyc', 3600, 120, 'utilisateur')
on conflict do nothing;
