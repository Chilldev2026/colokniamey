-- 0970_annonces.sql
-- Module M4 : annonces de logement (propriétaire) et de place en colocation (étudiant) — RG13 à RG33.
-- Numérotée après K (0960) car elle s'appuie sur identite_verifiee() et sur la table equipements (A5).
--
-- Données personnelles (RGP01) :
--  - position : point EXACT du logement, donnée personnelle. Jamais lisible par le public ni par un autre
--    utilisateur (aucun droit de lecture sur la colonne) ; seul l'auteur la relit par position_annonce() (RG23) ;
--  - position_publique : point que voit le public. Précision « approximative » (défaut) : le point exact est
--    ramené sur une grille de 0,0015° (environ 165 m) et la zone affichée a un rayon de 150 m ; « exacte » : le
--    point lui-même, sur choix de l'auteur ;
--  - numéro de téléphone : celui du profil (RG11), jamais copié ici ; contact_annonce() ne le donne qu'à un
--    utilisateur connecté et seulement si l'auteur a autorisé l'appel ou WhatsApp (RG32) ;
--  - préférences (genre, âges) : facultatives, seulement affichées, jamais bloquantes (RG33).

-- =====================================================================
-- Types
-- =====================================================================
create type public.type_annonce as enum ('chambre', 'studio', 'appartement', 'place_colocation');
create type public.statut_annonce as enum ('brouillon', 'en_attente', 'publiee', 'refusee', 'archivee');

-- =====================================================================
-- Annonces
-- =====================================================================
create table public.annonces (
  id bigint generated always as identity primary key,
  auteur_id uuid not null references public.profils (id) on delete cascade, -- RG14 : un seul auteur
  titre text not null check (char_length(btrim(titre)) between 5 and 100),
  description text not null check (char_length(btrim(description)) between 20 and 2000),
  type public.type_annonce not null,
  nb_places integer not null default 1 check (nb_places between 1 and 12),
  -- RG16, RG28 : montants en FCFA, supérieurs à 0
  part_mensuelle_fcfa integer not null check (part_mensuelle_fcfa > 0 and part_mensuelle_fcfa <= 100000000),
  loyer_total_fcfa integer check (loyer_total_fcfa > 0 and loyer_total_fcfa <= 100000000),
  charges_incluses boolean not null default true,
  montant_charges_fcfa integer check (montant_charges_fcfa >= 0 and montant_charges_fcfa <= 100000000),
  quartier_id bigint not null references public.quartiers (id) on delete restrict, -- RG15
  universite_proche_id bigint references public.universites (id) on delete restrict,
  disponible_le date,
  duree_min_mois integer check (duree_min_mois between 1 and 120), -- RG33
  duree_max_mois integer check (duree_max_mois between 1 and 120),
  contact_whatsapp boolean not null default false, -- RG32
  contact_appel boolean not null default false,
  preference_genre text not null default 'indifferent' check (preference_genre in ('indifferent', 'femme', 'homme')),
  age_min integer check (age_min between 16 and 99),
  age_max integer check (age_max between 16 and 99),
  etudiants_uniquement boolean not null default false,
  statut public.statut_annonce not null default 'brouillon',
  motif_refus text check (char_length(motif_refus) <= 300), -- RGA11
  en_revue boolean not null default false, -- RG45 : masquée en attendant un admin
  position extensions.geography(Point, 4326), -- RG21, RG23 : point exact, jamais lisible
  precision_position text not null default 'approximative' check (precision_position in ('exacte', 'approximative')),
  position_publique extensions.geography(Point, 4326),
  publiee_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Contrôles de cohérence (RG16, RG28, RG33)
  constraint annonces_colocation_loyer check (
    type <> 'place_colocation' or (loyer_total_fcfa is not null and loyer_total_fcfa >= part_mensuelle_fcfa and nb_places >= 2)
  ),
  constraint annonces_loyer_total check (loyer_total_fcfa is null or loyer_total_fcfa >= part_mensuelle_fcfa),
  constraint annonces_ages check (age_min is null or age_max is null or age_min <= age_max),
  constraint annonces_durees check (duree_min_mois is null or duree_max_mois is null or duree_min_mois <= duree_max_mois)
);
create index annonces_auteur_idx on public.annonces (auteur_id, statut);
create index annonces_publiees_idx on public.annonces (statut, quartier_id) where statut = 'publiee';
create index annonces_position_publique_idx on public.annonces using gist (position_publique);

-- RG21, RG22, RG13 : contrôles à l'écriture. SECURITY DEFINER : lit profils, quartiers, villes et parametres.
create function public.verifier_annonce()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.role_utilisateur;
  v_ville public.villes;
  v_validation boolean;
  v_neutre_new jsonb;
  v_neutre_old jsonb;
begin
  -- RG13 : un étudiant publie une place en colocation, un propriétaire un logement
  select role into v_role from public.profils where id = new.auteur_id and statut = 'actif';
  if v_role is null or v_role not in ('etudiant', 'proprietaire') then
    raise exception 'Seuls les étudiants et les propriétaires publient des annonces.';
  end if;
  if v_role = 'etudiant' and new.type <> 'place_colocation' then
    raise exception 'Un étudiant publie une place en colocation, pas un logement entier.';
  end if;
  if v_role = 'proprietaire' and new.type = 'place_colocation' then
    raise exception 'Un propriétaire publie un logement (chambre, studio ou appartement), pas une place en colocation.';
  end if;

  if tg_op = 'INSERT' then
    if (select auth.uid()) is not null then
      perform public.verifier_quota('creer_annonce'); -- RGP20
    end if;
    if (select count(*) from public.annonces where auteur_id = new.auteur_id and statut <> 'archivee') >= 30 then
      raise exception 'Tu as atteint le maximum de 30 annonces. Archive-en une avant d''en créer une nouvelle.';
    end if;
  elsif new.auteur_id <> old.auteur_id then
    raise exception 'L''auteur d''une annonce ne peut pas changer.';
  end if;

  -- RG22 : le point doit se trouver dans la zone de la ville du quartier
  select v.* into v_ville from public.villes v join public.quartiers q on q.ville_id = v.id where q.id = new.quartier_id;
  if new.position is not null and extensions.st_distance(new.position, v_ville.centre) > v_ville.rayon_km * 1000 then
    raise exception 'Cette position est en dehors de la zone de la ville.';
  end if;
  if new.universite_proche_id is not null
     and not exists (select 1 from public.universites u where u.id = new.universite_proche_id and u.ville_id = v_ville.id) then
    raise exception 'L''université choisie n''est pas dans la ville du logement.';
  end if;

  -- RG21 : pas de soumission sans position
  if new.statut in ('en_attente', 'publiee') and new.position is null then
    raise exception 'Place ton logement sur la carte avant de soumettre l''annonce.';
  end if;

  -- RG23 : position montrée au public
  if new.position is null then
    new.position_publique := null;
  elsif new.precision_position = 'exacte' then
    new.position_publique := new.position;
  else
    new.position_publique := extensions.st_snaptogrid(new.position::extensions.geometry, 0.0015)::extensions.geography;
  end if;

  -- RG17 : toute modification d'une annonce publiée la renvoie en attente de validation (si le paramètre l'exige).
  -- Un changement de statut explicite (fonctions soumettre, archiver, modération) n'est pas une modification.
  if tg_op = 'UPDATE' and new.statut = old.statut then
    v_neutre_new := to_jsonb(new) - array['statut', 'motif_refus', 'en_revue', 'position_publique', 'publiee_le', 'updated_at'];
    v_neutre_old := to_jsonb(old) - array['statut', 'motif_refus', 'en_revue', 'position_publique', 'publiee_le', 'updated_at'];
    if v_neutre_new is distinct from v_neutre_old then
      select coalesce((select (valeur #>> '{}')::boolean from public.parametres where cle = 'validation_annonces'), true) into v_validation;
      if old.statut = 'publiee' and v_validation then
        new.statut := 'en_attente';
      elsif old.statut = 'refusee' then
        -- l'auteur corrige : l'annonce redevient un brouillon à soumettre de nouveau
        new.statut := 'brouillon';
        new.motif_refus := null;
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger annonces_1_verif before insert or update on public.annonces
  for each row execute function public.verifier_annonce();
-- RG45 : tous les textes de l'annonce. Le déclencheur de S se pose après la validation (ordre alphabétique).
create trigger annonces_2_texte before insert or update on public.annonces
  for each row execute function public.controler_colonnes_texte('annonce', 'public', 'auteur_id', 'titre', 'description');

-- Notification à l'auteur quand le statut change (RGA11 : le motif de refus est communiqué)
create function public.notifier_statut_annonce()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titre text;
begin
  v_titre := case new.statut
    when 'en_attente' then 'Ton annonce « ' || left(new.titre, 60) || ' » est en cours de vérification.'
    when 'publiee' then 'Ton annonce « ' || left(new.titre, 60) || ' » est publiée.'
    when 'refusee' then 'Ton annonce « ' || left(new.titre, 60) || ' » a été refusée : ' || coalesce(new.motif_refus, 'voir le détail.')
  end;
  if v_titre is not null then
    perform public.notifier(new.auteur_id, 'annonce_statut', v_titre, '/annonces/' || new.id::text);
  end if;
  return null;
end;
$$;

create trigger annonces_3_notification after update of statut on public.annonces
  for each row when (old.statut is distinct from new.statut) execute function public.notifier_statut_annonce();

-- RLS (RG14, RG24) : lecture publique des annonces publiées, l'auteur gère les siennes, l'admin lit tout
alter table public.annonces enable row level security;
revoke all on table public.annonces from anon, authenticated;
-- RG23 : tous les droits de lecture SAUF la colonne position. Un « select * » est donc refusé : les services
-- listent leurs colonnes.
grant select (
  id, auteur_id, titre, description, type, nb_places, part_mensuelle_fcfa, loyer_total_fcfa, charges_incluses,
  montant_charges_fcfa, quartier_id, universite_proche_id, disponible_le, duree_min_mois, duree_max_mois,
  contact_whatsapp, contact_appel, preference_genre, age_min, age_max, etudiants_uniquement, statut, motif_refus,
  en_revue, precision_position, position_publique, publiee_le, created_at, updated_at
) on public.annonces to anon, authenticated;
-- L'auteur ne fixe ni le statut, ni le motif, ni la revue, ni la position publique (calculée) : fonctions et déclencheurs.
grant insert (
  auteur_id, titre, description, type, nb_places, part_mensuelle_fcfa, loyer_total_fcfa, charges_incluses,
  montant_charges_fcfa, quartier_id, universite_proche_id, disponible_le, duree_min_mois, duree_max_mois,
  contact_whatsapp, contact_appel, preference_genre, age_min, age_max, etudiants_uniquement, position, precision_position
) on public.annonces to authenticated;
grant update (
  titre, description, type, nb_places, part_mensuelle_fcfa, loyer_total_fcfa, charges_incluses, montant_charges_fcfa,
  quartier_id, universite_proche_id, disponible_le, duree_min_mois, duree_max_mois, contact_whatsapp, contact_appel,
  preference_genre, age_min, age_max, etudiants_uniquement, position, precision_position
) on public.annonces to authenticated;
grant delete on public.annonces to authenticated;

create policy annonces_lecture_publique on public.annonces for select to anon, authenticated
  using (statut = 'publiee' and not en_revue);
create policy annonces_lecture_auteur on public.annonces for select to authenticated
  using (auteur_id = (select auth.uid()));
create policy annonces_lecture_admin on public.annonces for select to authenticated
  using (public.est_admin());
create policy annonces_creation on public.annonces for insert to authenticated
  with check (auteur_id = (select auth.uid()) and public.peut_ecrire());
create policy annonces_modification on public.annonces for update to authenticated
  using (auteur_id = (select auth.uid()) and public.peut_ecrire())
  with check (auteur_id = (select auth.uid()));
create policy annonces_suppression on public.annonces for delete to authenticated
  using (auteur_id = (select auth.uid()) and public.peut_ecrire() and statut in ('brouillon', 'refusee', 'archivee'));

-- =====================================================================
-- Équipements (RG29), règles (RG30) et tâches partagées (RG31)
-- =====================================================================
create table public.annonce_equipements (
  annonce_id bigint not null references public.annonces (id) on delete cascade,
  equipement_id bigint not null references public.equipements (id) on delete restrict,
  primary key (annonce_id, equipement_id)
);
create index annonce_equipements_equipement_idx on public.annonce_equipements (equipement_id);

create table public.regles_annonce (
  id bigint generated always as identity primary key,
  annonce_id bigint not null references public.annonces (id) on delete cascade,
  ordre integer not null default 0,
  texte text not null check (char_length(btrim(texte)) between 2 and 120),
  en_revue boolean not null default false
);
create index regles_annonce_idx on public.regles_annonce (annonce_id, ordre);

create table public.taches_annonce (
  id bigint generated always as identity primary key,
  annonce_id bigint not null references public.annonces (id) on delete cascade,
  ordre integer not null default 0,
  libelle text not null check (char_length(btrim(libelle)) between 2 and 80),
  frequence text not null check (frequence in ('quotidienne', 'hebdomadaire', 'mensuelle')),
  repartition text not null check (repartition in ('tour_de_role', 'fixe', 'a_discuter')),
  en_revue boolean not null default false
);
create index taches_annonce_idx on public.taches_annonce (annonce_id, ordre);

-- Limites : 10 règles (RG30), 15 tâches (RG31). Interne.
create function public.limiter_lignes_annonce()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer := tg_argv[0]::integer;
  v_nb integer;
begin
  execute format('select count(*) from public.%I where annonce_id = $1', tg_table_name) into v_nb using new.annonce_id;
  if v_nb >= v_max then
    raise exception 'Tu as atteint le maximum de % %.', v_max, tg_argv[1];
  end if;
  if new.ordre = 0 then
    new.ordre := v_nb + 1;
  end if;
  return new;
end;
$$;
create trigger regles_annonce_1_limite before insert on public.regles_annonce
  for each row execute function public.limiter_lignes_annonce(10, 'règles');
create trigger taches_annonce_1_limite before insert on public.taches_annonce
  for each row execute function public.limiter_lignes_annonce(15, 'tâches partagées');

-- RG45 : règles et tâches vérifiées comme tout texte (revue possible : colonne en_revue)
create trigger regles_annonce_2_texte before insert or update on public.regles_annonce
  for each row execute function public.controler_colonnes_texte('annonce_regle', 'public', 'auteur_id', 'texte');
create trigger taches_annonce_2_texte before insert or update on public.taches_annonce
  for each row execute function public.controler_colonnes_texte('annonce_tache', 'public', 'auteur_id', 'libelle');

-- RG17 : modifier les équipements, règles ou tâches d'une annonce publiée la renvoie en attente de validation
create function public.annonce_enfant_modifiee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint := coalesce(case when tg_op = 'DELETE' then old.annonce_id else new.annonce_id end, 0);
begin
  if coalesce((select (valeur #>> '{}')::boolean from public.parametres where cle = 'validation_annonces'), true) then
    update public.annonces set statut = 'en_attente' where id = v_id and statut = 'publiee';
  end if;
  return null;
end;
$$;
create trigger annonce_equipements_modif after insert or update or delete on public.annonce_equipements
  for each row execute function public.annonce_enfant_modifiee();
create trigger regles_annonce_3_modif after insert or update or delete on public.regles_annonce
  for each row execute function public.annonce_enfant_modifiee();
create trigger taches_annonce_3_modif after insert or update or delete on public.taches_annonce
  for each row execute function public.annonce_enfant_modifiee();

alter table public.annonce_equipements enable row level security;
alter table public.regles_annonce enable row level security;
alter table public.taches_annonce enable row level security;
revoke all on table public.annonce_equipements, public.regles_annonce, public.taches_annonce from anon, authenticated;
grant select on public.annonce_equipements, public.regles_annonce, public.taches_annonce to anon, authenticated;
grant insert, delete on public.annonce_equipements to authenticated;
grant insert (annonce_id, ordre, texte) on public.regles_annonce to authenticated;
grant update (ordre, texte) on public.regles_annonce to authenticated;
grant delete on public.regles_annonce to authenticated;
grant insert (annonce_id, ordre, libelle, frequence, repartition) on public.taches_annonce to authenticated;
grant update (ordre, libelle, frequence, repartition) on public.taches_annonce to authenticated;
grant delete on public.taches_annonce to authenticated;

-- Lecture : ce que l'annonce parente laisse voir (la RLS de annonces s'applique à la sous-requête)
create policy annonce_equipements_lecture on public.annonce_equipements for select to anon, authenticated
  using (exists (select 1 from public.annonces a where a.id = annonce_id));
create policy regles_lecture_publique on public.regles_annonce for select to anon, authenticated
  using (not en_revue and exists (select 1 from public.annonces a where a.id = annonce_id));
create policy regles_lecture_auteur on public.regles_annonce for select to authenticated
  using (exists (select 1 from public.annonces a where a.id = annonce_id and a.auteur_id = (select auth.uid())));
create policy taches_lecture_publique on public.taches_annonce for select to anon, authenticated
  using (not en_revue and exists (select 1 from public.annonces a where a.id = annonce_id));
create policy taches_lecture_auteur on public.taches_annonce for select to authenticated
  using (exists (select 1 from public.annonces a where a.id = annonce_id and a.auteur_id = (select auth.uid())));

-- Écriture : l'auteur de l'annonce, compte actif et hors maintenance
create policy annonce_equipements_creation on public.annonce_equipements for insert to authenticated
  with check (
    public.peut_ecrire()
    and exists (select 1 from public.annonces a where a.id = annonce_id and a.auteur_id = (select auth.uid()))
    and exists (select 1 from public.equipements e where e.id = equipement_id and e.actif)
  );
create policy annonce_equipements_suppression on public.annonce_equipements for delete to authenticated
  using (public.peut_ecrire() and exists (select 1 from public.annonces a where a.id = annonce_id and a.auteur_id = (select auth.uid())));

create policy regles_creation on public.regles_annonce for insert to authenticated
  with check (public.peut_ecrire() and exists (select 1 from public.annonces a where a.id = annonce_id and a.auteur_id = (select auth.uid())));
create policy regles_modification on public.regles_annonce for update to authenticated
  using (public.peut_ecrire() and exists (select 1 from public.annonces a where a.id = annonce_id and a.auteur_id = (select auth.uid())))
  with check (exists (select 1 from public.annonces a where a.id = annonce_id and a.auteur_id = (select auth.uid())));
create policy regles_suppression on public.regles_annonce for delete to authenticated
  using (public.peut_ecrire() and exists (select 1 from public.annonces a where a.id = annonce_id and a.auteur_id = (select auth.uid())));

create policy taches_creation on public.taches_annonce for insert to authenticated
  with check (public.peut_ecrire() and exists (select 1 from public.annonces a where a.id = annonce_id and a.auteur_id = (select auth.uid())));
create policy taches_modification on public.taches_annonce for update to authenticated
  using (public.peut_ecrire() and exists (select 1 from public.annonces a where a.id = annonce_id and a.auteur_id = (select auth.uid())))
  with check (exists (select 1 from public.annonces a where a.id = annonce_id and a.auteur_id = (select auth.uid())));
create policy taches_suppression on public.taches_annonce for delete to authenticated
  using (public.peut_ecrire() and exists (select 1 from public.annonces a where a.id = annonce_id and a.auteur_id = (select auth.uid())));

-- =====================================================================
-- Photos des annonces (RG18, RG48 à RG50)
-- Le fichier est envoyé par le composant EnvoiPhoto de S (table photos, usage « annonce »). Cette table relie
-- une photo à une annonce et fixe l'ordre ; le public ne voit que les photos validées par un admin.
-- =====================================================================
create table public.photos_annonces (
  id bigint generated always as identity primary key,
  annonce_id bigint not null references public.annonces (id) on delete cascade,
  photo_id bigint not null unique references public.photos (id) on delete cascade,
  ordre integer not null default 0
);
create index photos_annonces_idx on public.photos_annonces (annonce_id, ordre);

-- RG18 : au plus photos_max photos ; la photo appartient à l'auteur, pour l'usage « annonce », et n'a pas été refusée
create function public.verifier_photo_annonce()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer;
  v_nb integer;
  v_auteur uuid;
  v_photo public.photos;
begin
  select auteur_id into v_auteur from public.annonces where id = new.annonce_id;
  select * into v_photo from public.photos where id = new.photo_id;
  if v_auteur is null or v_photo.id is null or v_photo.proprietaire_id <> v_auteur or v_photo.usage <> 'annonce' then
    raise exception 'Cette photo ne peut pas être ajoutée à cette annonce.';
  end if;
  if v_photo.statut = 'refusee' then
    raise exception 'Cette photo a été refusée par la modération.';
  end if;
  select coalesce((select (valeur #>> '{}')::integer from public.parametres where cle = 'photos_max'), 5) into v_max;
  select count(*) into v_nb from public.photos_annonces where annonce_id = new.annonce_id;
  if v_nb >= v_max then
    raise exception 'Une annonce accepte % photos au maximum.', v_max;
  end if;
  if new.ordre = 0 then
    new.ordre := v_nb + 1;
  end if;
  return new;
end;
$$;
create trigger photos_annonces_1_verif before insert on public.photos_annonces
  for each row execute function public.verifier_photo_annonce();

alter table public.photos_annonces enable row level security;
revoke all on table public.photos_annonces from anon, authenticated;
grant select on public.photos_annonces to authenticated;
grant insert (annonce_id, photo_id, ordre) on public.photos_annonces to authenticated;
grant update (ordre) on public.photos_annonces to authenticated;
grant delete on public.photos_annonces to authenticated;
-- L'auteur voit les liens de ses annonces ; le public passe par photos_annonce() (photos validées seulement)
create policy photos_annonces_lecture on public.photos_annonces for select to authenticated
  using (exists (select 1 from public.annonces a where a.id = annonce_id and (a.auteur_id = (select auth.uid()) or public.est_admin())));
create policy photos_annonces_creation on public.photos_annonces for insert to authenticated
  with check (public.peut_ecrire() and exists (select 1 from public.annonces a where a.id = annonce_id and a.auteur_id = (select auth.uid())));
create policy photos_annonces_modification on public.photos_annonces for update to authenticated
  using (public.peut_ecrire() and exists (select 1 from public.annonces a where a.id = annonce_id and a.auteur_id = (select auth.uid())))
  with check (exists (select 1 from public.annonces a where a.id = annonce_id and a.auteur_id = (select auth.uid())));
create policy photos_annonces_suppression on public.photos_annonces for delete to authenticated
  using (public.peut_ecrire() and exists (select 1 from public.annonces a where a.id = annonce_id and a.auteur_id = (select auth.uid())));

-- Photos validées d'une annonce visible (chemin dans photos_publiques), dans l'ordre choisi par l'auteur
create function public.photos_annonce(p_annonce_id bigint)
returns table (ordre integer, chemin text)
language sql
stable
security definer
set search_path = ''
as $$
  select pa.ordre, p.chemin
  from public.photos_annonces pa
  join public.photos p on p.id = pa.photo_id and p.statut = 'validee'
  join public.annonces a on a.id = pa.annonce_id
  where pa.annonce_id = p_annonce_id and a.statut = 'publiee' and not a.en_revue
  order by pa.ordre, pa.id;
$$;

-- Première photo validée (pour les cartes d'annonce). Interne : utilisée par la vue annonces_publiques.
create function public.photo_principale_annonce(p_annonce_id bigint)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.chemin from public.photos_annonces pa
  join public.photos p on p.id = pa.photo_id and p.statut = 'validee'
  where pa.annonce_id = p_annonce_id
  order by pa.ordre, pa.id
  limit 1;
$$;

-- =====================================================================
-- Vue publique : annonces publiées, avec la position montrée au public (jamais le point exact), RG23, RG25
-- =====================================================================
create view public.annonces_publiques with (security_invoker = true) as
  select
    a.id, a.auteur_id, a.titre, a.description, a.type, a.nb_places, a.part_mensuelle_fcfa, a.loyer_total_fcfa,
    a.charges_incluses, a.montant_charges_fcfa, a.quartier_id, a.universite_proche_id, a.disponible_le,
    a.duree_min_mois, a.duree_max_mois, a.contact_whatsapp, a.contact_appel, a.preference_genre, a.age_min,
    a.age_max, a.etudiants_uniquement, a.precision_position, a.publiee_le,
    extensions.st_y(a.position_publique::extensions.geometry) as latitude,
    extensions.st_x(a.position_publique::extensions.geometry) as longitude,
    case when a.precision_position = 'approximative' then 150 else 0 end as zone_rayon_m,
    -- RG25 : distance à l'université, calculée sur la position publique (arrondie à 10 m)
    case when u.position is not null and a.position_publique is not null
      then (round(extensions.st_distance(a.position_publique, u.position) / 10) * 10)::integer end as distance_universite_m,
    public.photo_principale_annonce(a.id) as photo_chemin
  from public.annonces a
  left join public.universites u on u.id = a.universite_proche_id
  where a.statut = 'publiee' and not a.en_revue;
revoke all on public.annonces_publiques from anon, authenticated;
grant select on public.annonces_publiques to anon, authenticated;

-- =====================================================================
-- Fonctions de l'auteur
-- =====================================================================

-- RG23 : l'auteur relit la position exacte de SON annonce
create function public.position_annonce(p_annonce_id bigint)
returns table (latitude double precision, longitude double precision, precision_position text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.est_actif() then
    raise exception 'Connexion requise.';
  end if;
  return query
    select extensions.st_y(a.position::extensions.geometry), extensions.st_x(a.position::extensions.geometry), a.precision_position
    from public.annonces a
    where a.id = p_annonce_id and a.auteur_id = (select auth.uid()) and a.position is not null;
end;
$$;

-- RG17, RG21, RG52 : soumission. Passe en attente de validation si le paramètre l'exige, sinon publie.
create function public.soumettre_annonce(p_annonce_id bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.annonces;
  v_validation boolean;
  v_statut public.statut_annonce;
begin
  if not public.peut_ecrire() then
    raise exception 'Action impossible pour le moment.';
  end if;
  select * into v_a from public.annonces where id = p_annonce_id and auteur_id = (select auth.uid()) for update;
  if not found then
    raise exception 'Annonce introuvable.';
  end if;
  if v_a.statut not in ('brouillon', 'refusee') then
    raise exception 'Cette annonce ne peut pas être soumise dans son état actuel.';
  end if;
  perform public.verifier_quota('soumettre_annonce');
  if v_a.position is null then
    raise exception 'Place ton logement sur la carte avant de soumettre l''annonce.';
  end if;
  -- RG52 : devenir colocataire exige une identité vérifiée (toujours vrai tant que le KYC est désactivé, RG59)
  if v_a.type = 'place_colocation' then
    perform public.exiger_identite_verifiee();
  end if;

  select coalesce((select (valeur #>> '{}')::boolean from public.parametres where cle = 'validation_annonces'), true) into v_validation;
  v_statut := case when v_validation then 'en_attente' else 'publiee' end;
  update public.annonces
  set statut = v_statut, motif_refus = null,
      publiee_le = case when v_statut = 'publiee' then now() else publiee_le end
  where id = p_annonce_id;
  return v_statut::text;
end;
$$;

-- L'auteur retire son annonce de la publication
create function public.archiver_annonce(p_annonce_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.peut_ecrire() then
    raise exception 'Action impossible pour le moment.';
  end if;
  update public.annonces set statut = 'archivee'
  where id = p_annonce_id and auteur_id = (select auth.uid()) and statut <> 'archivee';
  if not found then
    raise exception 'Annonce introuvable.';
  end if;
end;
$$;

-- Une annonce archivée redevient un brouillon, à soumettre de nouveau
create function public.rouvrir_annonce(p_annonce_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.peut_ecrire() then
    raise exception 'Action impossible pour le moment.';
  end if;
  update public.annonces set statut = 'brouillon', motif_refus = null
  where id = p_annonce_id and auteur_id = (select auth.uid()) and statut = 'archivee';
  if not found then
    raise exception 'Annonce introuvable.';
  end if;
end;
$$;

-- RG32 : contact. Réservé aux utilisateurs connectés, limité à 30 consultations par jour (RGP20) contre
-- l'aspiration des numéros. Le numéro vient du profil (RG11) et n'est donné que si l'auteur l'a autorisé.
-- RG11 [À VALIDER] : un numéro à 8 chiffres sans indicatif est considéré comme nigérien (+227).
create function public.contact_annonce(p_annonce_id bigint)
returns table (telephone text, whatsapp text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.annonces;
  v_numero text;
begin
  if not public.est_actif() then
    raise exception 'Connecte-toi pour contacter l''annonceur.';
  end if;
  perform public.verifier_quota('contact_annonce');
  select * into v_a from public.annonces a
  where a.id = p_annonce_id and ((a.statut = 'publiee' and not a.en_revue) or a.auteur_id = (select auth.uid()));
  if not found then
    raise exception 'Annonce introuvable.';
  end if;
  select regexp_replace(p.telephone, '[^0-9]', '', 'g') into v_numero from public.profils p where p.id = v_a.auteur_id;
  if length(v_numero) = 8 then
    v_numero := '227' || v_numero;
  end if;
  telephone := case when v_a.contact_appel then '+' || v_numero end;
  whatsapp := case when v_a.contact_whatsapp then v_numero end;
  return next;
end;
$$;

-- =====================================================================
-- Export des données (RGP11) et compteurs de la fiche utilisateur (A2)
-- =====================================================================
create function public.exporter_donnees_annonces(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('annonces', coalesce((
    select jsonb_agg(
      (to_jsonb(a) - 'position' - 'position_publique')
      || jsonb_build_object(
        'latitude', extensions.st_y(a.position::extensions.geometry),
        'longitude', extensions.st_x(a.position::extensions.geometry),
        'regles', coalesce((select jsonb_agg(r.texte order by r.ordre) from public.regles_annonce r where r.annonce_id = a.id), '[]'::jsonb),
        'taches', coalesce((select jsonb_agg(jsonb_build_object('libelle', t.libelle, 'frequence', t.frequence, 'repartition', t.repartition) order by t.ordre)
                            from public.taches_annonce t where t.annonce_id = a.id), '[]'::jsonb),
        'equipements', coalesce((select jsonb_agg(e.nom order by e.nom) from public.annonce_equipements ae
                                 join public.equipements e on e.id = ae.equipement_id where ae.annonce_id = a.id), '[]'::jsonb)
      ) order by a.id)
    from public.annonces a where a.auteur_id = p_uid
  ), '[]'::jsonb));
$$;

create function public.compteurs_utilisateur_annonces(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'annonces', (select count(*) from public.annonces where auteur_id = p_uid),
    'annonces_publiees', (select count(*) from public.annonces where auteur_id = p_uid and statut = 'publiee')
  );
$$;

-- =====================================================================
-- Droits : fonction -> rôles autorisés (RGP17)
-- =====================================================================
revoke execute on function
  public.verifier_annonce(), public.notifier_statut_annonce(), public.limiter_lignes_annonce(),
  public.annonce_enfant_modifiee(), public.verifier_photo_annonce(), public.photos_annonce(bigint),
  public.photo_principale_annonce(bigint), public.position_annonce(bigint), public.soumettre_annonce(bigint),
  public.archiver_annonce(bigint), public.rouvrir_annonce(bigint), public.contact_annonce(bigint),
  public.exporter_donnees_annonces(uuid), public.compteurs_utilisateur_annonces(uuid)
  from public, anon, authenticated;

grant execute on function public.photos_annonce(bigint) to anon, authenticated; -- photos validées d'annonces publiées
grant execute on function public.photo_principale_annonce(bigint) to anon, authenticated; -- appelée par la vue publique
grant execute on function public.position_annonce(bigint) to authenticated; -- auteur seulement (dans le corps)
grant execute on function public.soumettre_annonce(bigint) to authenticated;
grant execute on function public.archiver_annonce(bigint) to authenticated;
grant execute on function public.rouvrir_annonce(bigint) to authenticated;
grant execute on function public.contact_annonce(bigint) to authenticated; -- connectés seulement (RG32)
-- Internes, sans GRANT : verifier_annonce, notifier_statut_annonce, limiter_lignes_annonce, annonce_enfant_modifiee,
-- verifier_photo_annonce, exporter_donnees_annonces, compteurs_utilisateur_annonces

insert into public.limites (action, fenetre_secondes, maximum, portee) values
  ('creer_annonce', 86400, 10, 'utilisateur'),
  ('soumettre_annonce', 86400, 20, 'utilisateur'),
  ('contact_annonce', 86400, 30, 'utilisateur') -- RGP20
on conflict do nothing;
