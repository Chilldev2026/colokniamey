-- 0400_profils.sql
-- Module M3 : profils (compléments, profil public minimal, avatar, désactivation, export des données).
--
-- Données personnelles ajoutées (RGP01) :
--  - profession (80 caractères) et centres d'intérêt (5 au plus) : facultatifs, affichés sur la carte de
--    l'annonceur pour rassurer les colocataires ; publics seulement une fois vérifiés par S ;
--  - l'avatar n'est pas copié dans le profil : on lit la dernière photo d'usage « avatar » validée par un admin
--    dans la table photos du module S (RG49), ce qui évite toute modification des tables de M2.
--
-- M2 est modifié à un seul endroit, et seulement par des déclencheurs de contrôle de texte (S) sur ses colonnes de
-- texte libre : nom, prénom, filière, niveau, bio, adresse. Contexte « prive » = blocage sans mise en revue,
-- car ces tables n'ont pas de colonne en_revue.

-- =====================================================================
-- Compléments du profil
-- =====================================================================
create table public.profils_complements (
  user_id uuid primary key references public.profils (id) on delete cascade,
  profession text check (char_length(profession) <= 80),
  centres_interet text[] not null default array[]::text[] check (cardinality(centres_interet) <= 5),
  en_revue boolean not null default false, -- RG45 : masqué du public en attendant un admin
  updated_at timestamptz not null default now()
);

-- Nettoie et valide : espaces retirés, entrées vides supprimées, chaque centre d'intérêt de 2 à 40 caractères.
create function public.verifier_complements()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_liste text[];
begin
  new.profession := nullif(btrim(coalesce(new.profession, '')), '');
  select coalesce(array_agg(x), array[]::text[]) into v_liste
  from (
    select btrim(v) as x from unnest(coalesce(new.centres_interet, array[]::text[])) as v
  ) t
  where x <> '';
  if exists (select 1 from unnest(v_liste) as x where char_length(x) not between 2 and 40) then
    raise exception 'Chaque centre d''intérêt doit avoir entre 2 et 40 caractères.';
  end if;
  new.centres_interet := v_liste;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profils_complements_1_verif before insert or update on public.profils_complements
  for each row execute function public.verifier_complements();

-- RG45 : textes vérifiés par S. Le déclencheur de S se pose après la validation (ordre alphabétique).
create trigger profils_complements_2_texte before insert or update on public.profils_complements
  for each row execute function public.controler_colonnes_texte('profil', 'public', 'user_id', 'profession', 'centres_interet');

-- RG45 sur les textes libres de M2 (blocage seulement)
create trigger profils_texte before insert or update on public.profils
  for each row execute function public.controler_colonnes_texte('profil', 'prive', 'id', 'nom', 'prenom');
create trigger profils_etudiants_texte before insert or update on public.profils_etudiants
  for each row execute function public.controler_colonnes_texte('profil', 'prive', 'user_id', 'niveau_etude', 'filiere', 'bio');
create trigger profils_proprietaires_texte before insert or update on public.profils_proprietaires
  for each row execute function public.controler_colonnes_texte('profil', 'prive', 'user_id', 'adresse');

alter table public.profils_complements enable row level security;
revoke all on table public.profils_complements from anon, authenticated;
grant select on public.profils_complements to authenticated;
grant insert (user_id, profession, centres_interet) on public.profils_complements to authenticated;
grant update (profession, centres_interet) on public.profils_complements to authenticated;

-- RG10 : chacun lit et modifie le sien ; l'admin lit (le public passe par profil_public)
create policy complements_lecture on public.profils_complements for select to authenticated
  using (user_id = (select auth.uid()) or public.est_admin());
create policy complements_creation on public.profils_complements for insert to authenticated
  with check (user_id = (select auth.uid()) and public.peut_ecrire());
create policy complements_modification on public.profils_complements for update to authenticated
  using (user_id = (select auth.uid()) and public.peut_ecrire())
  with check (user_id = (select auth.uid()));

-- =====================================================================
-- Avatar (RG49, RG51)
-- =====================================================================

-- Chemin de l'avatar validé le plus récent, ou null. Interne.
create function public.avatar_valide(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select chemin from public.photos
  where proprietaire_id = p_id and usage = 'avatar' and statut = 'validee'
  order by decide_le desc nulls last, id desc
  limit 1;
$$;

-- L'avatar de la personne connectée : le chemin validé et l'état du dernier envoi
-- (null = aucun envoi, sinon en_attente | validee | refusee avec le motif).
create function public.mon_avatar()
returns table (chemin_valide text, statut text, motif text)
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
    select public.avatar_valide((select auth.uid())), d.statut, d.motif
    from (select 1) u
    left join lateral (
      select p.statut, p.motif from public.photos p
      where p.proprietaire_id = (select auth.uid()) and p.usage = 'avatar'
      order by p.id desc limit 1
    ) d on true;
end;
$$;

-- =====================================================================
-- Profil public minimal (classification « public » : prénom, initiale, rôle, université, photo validée)
-- Jamais de nom complet, de téléphone, d'e-mail ni de position.
-- =====================================================================
create function public.profil_public(p_id uuid)
returns table (
  id uuid, prenom text, initiale_nom text, role text, universite text, type_proprietaire text,
  membre_depuis timestamptz, avatar_chemin text, profession text, centres_interet text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.prenom,
    upper(left(p.nom, 1)),
    p.role::text,
    case when p.role = 'etudiant'
      then (select u.nom || coalesce(' (' || u.sigle || ')', '') from public.universites u where u.id = e.universite_id) end,
    pr.type_proprietaire,
    p.created_at,
    public.avatar_valide(p.id),
    case when not coalesce(c.en_revue, false) then c.profession end,
    case when not coalesce(c.en_revue, false) then c.centres_interet else array[]::text[] end
  from public.profils p
  left join public.profils_etudiants e on e.user_id = p.id
  left join public.profils_proprietaires pr on pr.user_id = p.id
  left join public.profils_complements c on c.user_id = p.id
  where p.id = p_id
    and p.statut = 'actif'
    and p.role in ('etudiant', 'proprietaire'); -- un admin n'a pas de profil public
$$;

-- =====================================================================
-- Désactivation avec anonymisation (RGA09)
-- =====================================================================
create function public.desactiver_mon_compte(p_confirmation text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.role_utilisateur;
begin
  if not public.est_actif() then
    raise exception 'Connexion requise.';
  end if;
  select role into v_role from public.profils where id = v_uid;
  -- RGA03 : les comptes admin se gèrent depuis l'espace d'administration
  if v_role not in ('etudiant', 'proprietaire') then
    raise exception 'Ce type de compte ne peut pas être désactivé ici.';
  end if;
  if p_confirmation is distinct from 'DESACTIVER' then
    raise exception 'Confirmation incorrecte.';
  end if;

  -- Anonymisation des données personnelles
  update public.profils
  set nom = 'Utilisateur', prenom = 'Ancien membre', telephone = '00000000',
      statut = 'desactive', motif_suspension = null, suspendu_jusqua = null
  where id = v_uid;
  delete from public.profils_complements where user_id = v_uid;
  update public.profils_etudiants set niveau_etude = null, filiere = null, budget_max = null, bio = null where user_id = v_uid;
  update public.profils_proprietaires set adresse = null where user_id = v_uid;
  delete from public.notifications where destinataire_id = v_uid;

  -- Le compte d'authentification est anonymisé, bloqué et déconnecté partout (RG08, RG12)
  update auth.users
  set email = 'supprime-' || v_uid::text || '@anonyme.invalid',
      phone = null,
      raw_user_meta_data = '{}'::jsonb,
      encrypted_password = '',
      banned_until = 'infinity'
  where id = v_uid;
  delete from auth.sessions where user_id = v_uid;

  perform public.journaliser('desactivation_compte', 'utilisateur', v_uid::text, '{}'::jsonb);
end;
$$;

-- =====================================================================
-- Export des données (RGP11)
-- Chaque module expose exporter_donnees_<module>(uid) : fonction interne, sans GRANT, qui renvoie du JSON.
-- exporter_mes_donnees() les découvre par leur nom : un nouveau module s'ajoute sans modifier M3.
-- Elle n'accepte aucun paramètre : elle ne peut renvoyer que les données de la personne connectée.
-- =====================================================================
create function public.exporter_donnees_profils(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'profil', (select to_jsonb(p) from public.profils p where p.id = p_uid),
    'profil_etudiant', (select to_jsonb(e) - 'user_id' from public.profils_etudiants e where e.user_id = p_uid),
    'profil_proprietaire', (select to_jsonb(r) - 'user_id' from public.profils_proprietaires r where r.user_id = p_uid),
    'complements', (select to_jsonb(c) - 'user_id' from public.profils_complements c where c.user_id = p_uid)
  );
$$;

create function public.exporter_mes_donnees()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_fonction record;
  v_part jsonb;
  v_modules jsonb := '{}'::jsonb;
begin
  if not public.est_actif() then
    raise exception 'Connexion requise.';
  end if;
  perform public.verifier_quota('export_donnees');

  for v_fonction in
    select proname::text as nom from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname like 'exporter\_donnees\_%'
      and pronargs = 1
    order by proname
  loop
    execute format('select public.%I($1)', v_fonction.nom) into v_part using v_uid;
    v_modules := v_modules || jsonb_build_object(substr(v_fonction.nom, length('exporter_donnees_') + 1), v_part);
  end loop;

  perform public.journaliser('export_donnees', 'utilisateur', v_uid::text, '{}'::jsonb);
  return jsonb_build_object(
    'genere_le', now(),
    'compte', (select jsonb_build_object('id', u.id, 'email', u.email, 'cree_le', u.created_at) from auth.users u where u.id = v_uid),
    'donnees', v_modules
  );
end;
$$;

-- =====================================================================
-- Droits : fonction -> rôles autorisés (RGP17)
-- =====================================================================
revoke execute on function
  public.verifier_complements(), public.avatar_valide(uuid), public.mon_avatar(), public.profil_public(uuid),
  public.desactiver_mon_compte(text), public.exporter_donnees_profils(uuid), public.exporter_mes_donnees()
  from public, anon, authenticated;

grant execute on function public.profil_public(uuid) to anon, authenticated; -- données publiques minimales
grant execute on function public.mon_avatar() to authenticated;
grant execute on function public.desactiver_mon_compte(text) to authenticated;
grant execute on function public.exporter_mes_donnees() to authenticated;
-- Internes, sans GRANT : verifier_complements, avatar_valide, exporter_donnees_profils

insert into public.limites (action, fenetre_secondes, maximum, portee) values
  ('export_donnees', 86400, 5, 'utilisateur')
on conflict do nothing;
