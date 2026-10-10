-- 1010_groupes.sql
-- Module M8 : groupes de colocation (RG34 à RG39). Des étudiants se regroupent pour louer ensemble un logement
-- publié par un propriétaire.
--
-- Données personnelles (RGP01) : un groupe expose le prénom et l'initiale de ses membres (profil public minimal) aux
-- utilisateurs connectés. Aucun nom complet, téléphone ni e-mail. Aucun texte de groupe n'est public : message et
-- préférences passent par le contrôle de S (blocage et mise en revue possibles).

-- =====================================================================
-- Types, tables
-- =====================================================================
create type public.statut_groupe as enum ('en_formation', 'complet', 'cloture');
create type public.statut_membre as enum ('en_attente', 'accepte', 'refuse', 'parti');

create table public.groupes_colocation (
  id bigint generated always as identity primary key,
  annonce_id bigint not null references public.annonces (id) on delete cascade,
  initiateur_id uuid not null references public.profils (id) on delete cascade,
  -- RG34 : nombre de colocataires recherchés en plus de l'initiateur, au plus nb_places - 1 (contrôlé par creer_groupe)
  places_recherchees integer not null check (places_recherchees between 1 and 11),
  message text check (char_length(message) <= 500),
  preferences text check (char_length(preferences) <= 300),
  statut public.statut_groupe not null default 'en_formation',
  en_revue boolean not null default false, -- RG45 : message ou préférences en attente d'un admin
  derniere_activite timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index groupes_annonce_idx on public.groupes_colocation (annonce_id, statut);
create index groupes_activite_idx on public.groupes_colocation (statut, derniere_activite);

create table public.membres_groupe (
  id bigint generated always as identity primary key,
  groupe_id bigint not null references public.groupes_colocation (id) on delete cascade,
  user_id uuid not null references public.profils (id) on delete cascade,
  role text not null default 'membre' check (role in ('initiateur', 'membre')),
  statut public.statut_membre not null default 'en_attente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (groupe_id, user_id)
);
create index membres_user_idx on public.membres_groupe (user_id, statut);

-- RG45 : tous les textes du groupe sont contrôlés par S
create trigger groupes_texte before insert or update on public.groupes_colocation
  for each row execute function public.controler_colonnes_texte('groupe', 'public', 'initiateur_id', 'message', 'preferences');

-- Paramètre : nombre de groupes actifs par étudiant (RG36) [À VALIDER]
insert into public.parametres (cle, valeur, publique) values ('groupes_actifs_max', '3', false) on conflict (cle) do nothing;

-- =====================================================================
-- Fonctions d'aide (lecture sans récursion de politiques)
-- =====================================================================

-- Capacité d'un groupe : l'initiateur et les places recherchées. Interne.
create function public.capacite_groupe(p_groupe_id bigint)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select places_recherchees + 1 from public.groupes_colocation where id = p_groupe_id;
$$;

create function public.membres_acceptes(p_groupe_id bigint)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.membres_groupe where groupe_id = p_groupe_id and statut = 'accepte';
$$;

-- La personne connectée est-elle l'initiateur de ce groupe ?
create function public.est_initiateur_groupe(p_groupe_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.groupes_colocation where id = p_groupe_id and initiateur_id = (select auth.uid()));
$$;

-- Le groupe est visible pour la personne connectée : groupe en formation sur une annonce publiée (tout utilisateur
-- connecté), ou groupe dont elle est membre, ou groupe sur son annonce (propriétaire). Sert aux politiques RLS.
create function public.peut_voir_groupe(p_groupe_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.groupes_colocation g
    join public.annonces a on a.id = g.annonce_id
    where g.id = p_groupe_id and not g.en_revue and (
      (g.statut = 'en_formation' and a.statut = 'publiee' and not a.en_revue and public.auteur_actif(a.auteur_id))
      or a.auteur_id = (select auth.uid())
      or exists (select 1 from public.membres_groupe m where m.groupe_id = g.id and m.user_id = (select auth.uid()))
    )
  );
$$;

-- Nombre de groupes en formation sur une annonce publiée : donnée publique (badge « N étudiants cherchent des
-- colocataires » des cartes d'annonce et de la carte, RG24). Ne renvoie qu'un nombre.
create function public.compter_groupes_en_formation(p_annonce_id bigint)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.groupes_colocation g join public.annonces a on a.id = g.annonce_id
  where g.annonce_id = p_annonce_id and g.statut = 'en_formation' and not g.en_revue
    and a.statut = 'publiee' and not a.en_revue and public.auteur_actif(a.auteur_id);
$$;

create function public.compter_groupes_annonces(p_ids bigint[])
returns table (annonce_id bigint, nombre integer)
language sql
stable
security definer
set search_path = ''
as $$
  select g.annonce_id, count(*)::integer
  from public.groupes_colocation g join public.annonces a on a.id = g.annonce_id
  where g.annonce_id = any (p_ids[1:100]) and g.statut = 'en_formation' and not g.en_revue
    and a.statut = 'publiee' and not a.en_revue and public.auteur_actif(a.auteur_id)
  group by g.annonce_id;
$$;

-- =====================================================================
-- RLS : lecture seulement ; toute écriture passe par les fonctions
-- =====================================================================
alter table public.groupes_colocation enable row level security;
alter table public.membres_groupe enable row level security;
revoke all on table public.groupes_colocation, public.membres_groupe from anon, authenticated;
grant select on public.groupes_colocation, public.membres_groupe to authenticated;

create policy groupes_lecture on public.groupes_colocation for select to authenticated using (public.peut_voir_groupe(id));
-- Membres : les miens ; ceux de mon groupe si je suis initiateur (demandes comprises) ; les membres acceptés d'un groupe visible
create policy membres_lecture on public.membres_groupe for select to authenticated
  using (user_id = (select auth.uid()) or public.est_initiateur_groupe(groupe_id) or (statut = 'accepte' and public.peut_voir_groupe(groupe_id)));

-- =====================================================================
-- Règles de participation (RG36)
-- =====================================================================

-- Nombre de groupes actifs (demande en attente ou membre accepté, dans un groupe non clos) de la personne. Interne.
create function public.groupes_actifs_de(p_uid uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.membres_groupe m join public.groupes_colocation g on g.id = m.groupe_id
  where m.user_id = p_uid and m.statut in ('en_attente', 'accepte') and g.statut <> 'cloture';
$$;

-- Refuse si l'étudiant est déjà dans un groupe actif de ce logement ou au-delà de la limite. Interne.
create function public.verifier_participation(p_uid uuid, p_annonce_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer;
begin
  if exists (
    select 1 from public.membres_groupe m join public.groupes_colocation g on g.id = m.groupe_id
    where m.user_id = p_uid and g.annonce_id = p_annonce_id and m.statut in ('en_attente', 'accepte') and g.statut <> 'cloture'
  ) then
    raise exception 'Tu fais déjà partie d''un groupe pour ce logement.';
  end if;
  select coalesce((select (valeur #>> '{}')::integer from public.parametres where cle = 'groupes_actifs_max'), 3) into v_max;
  if public.groupes_actifs_de(p_uid) >= v_max then
    raise exception 'Tu as atteint le maximum de % groupes actifs. Quitte un groupe pour en rejoindre un autre.', v_max;
  end if;
end;
$$;

-- Étudiant actif à l'identité vérifiée (RG52, RG59). Interne ; lève des erreurs en français.
create function public.exiger_etudiant_verifie()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.peut_ecrire() then
    raise exception 'Action impossible pour le moment.';
  end if;
  if not public.est_etudiant() then
    raise exception 'Seuls les étudiants peuvent former ou rejoindre un groupe.';
  end if;
  -- RG52 : un étudiant non vérifié ne peut ni lancer ni rejoindre un groupe (toujours vrai tant que le KYC est désactivé)
  if not public.identite_verifiee((select auth.uid())) then
    raise exception 'Vérifie ton identité avant de former ou rejoindre un groupe.';
  end if;
end;
$$;

-- =====================================================================
-- Actions
-- =====================================================================

-- RG34 : lancer un groupe sur un logement publié par un propriétaire
create function public.creer_groupe(p_annonce_id bigint, p_places integer, p_message text default null, p_preferences text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_a public.annonces;
  v_id bigint;
begin
  perform public.exiger_etudiant_verifie();
  perform public.verifier_quota('creer_groupe');
  select * into v_a from public.annonces a
  where a.id = p_annonce_id and a.statut = 'publiee' and not a.en_revue and public.auteur_actif(a.auteur_id);
  if not found then
    raise exception 'Ce logement n''est plus disponible.';
  end if;
  -- le logement est publié par un propriétaire (une place en colocation d'étudiant n'a pas de groupe)
  if v_a.type = 'place_colocation' or not exists (select 1 from public.profils where id = v_a.auteur_id and role = 'proprietaire') then
    raise exception 'On ne forme un groupe que sur un logement publié par un propriétaire.';
  end if;
  if p_places is null or p_places < 1 or p_places > v_a.nb_places - 1 then
    raise exception 'Ce logement a % place(s) : tu peux chercher entre 1 et % colocataire(s).', v_a.nb_places, greatest(v_a.nb_places - 1, 0);
  end if;
  perform public.verifier_participation(v_uid, p_annonce_id);

  insert into public.groupes_colocation (annonce_id, initiateur_id, places_recherchees, message, preferences)
  values (p_annonce_id, v_uid, p_places, nullif(btrim(coalesce(p_message, '')), ''), nullif(btrim(coalesce(p_preferences, '')), ''))
  returning id into v_id;
  insert into public.membres_groupe (groupe_id, user_id, role, statut) values (v_id, v_uid, 'initiateur', 'accepte');
  -- RGA33 : aucune donnée personnelle dans la notification
  perform public.notifier(v_a.auteur_id, 'groupe_cree', 'Un groupe d''étudiants se forme sur ton logement.', '/annonces/' || p_annonce_id::text);
  return v_id;
end;
$$;

-- RG36 : demande d'adhésion, acceptée ensuite par l'initiateur
create function public.demander_adhesion(p_groupe_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_g public.groupes_colocation;
  v_publie boolean;
begin
  perform public.exiger_etudiant_verifie();
  perform public.verifier_quota('demande_groupe');
  select * into v_g from public.groupes_colocation where id = p_groupe_id for update;
  if not found or v_g.statut = 'cloture' or v_g.en_revue then
    raise exception 'Ce groupe n''existe plus.';
  end if;
  -- RG38 : un groupe complet n'accepte plus de demandes
  if v_g.statut = 'complet' then
    raise exception 'Ce groupe est complet.';
  end if;
  select (a.statut = 'publiee' and not a.en_revue) into v_publie from public.annonces a where a.id = v_g.annonce_id;
  if not coalesce(v_publie, false) then
    raise exception 'Ce logement n''est plus disponible.';
  end if;
  perform public.verifier_participation(v_uid, v_g.annonce_id);
  -- une demande refusée ou quittée peut être renouvelée : la ligne existante repart « en attente »
  insert into public.membres_groupe (groupe_id, user_id, role, statut) values (p_groupe_id, v_uid, 'membre', 'en_attente')
  on conflict (groupe_id, user_id) do update set statut = 'en_attente', updated_at = now()
    where public.membres_groupe.statut in ('refuse', 'parti');
  if not found then
    raise exception 'Ta demande est déjà enregistrée.';
  end if;
  update public.groupes_colocation set derniere_activite = now() where id = p_groupe_id;
  perform public.notifier(v_g.initiateur_id, 'groupe_demande', 'Un étudiant demande à rejoindre ton groupe.', '/groupes');
end;
$$;

-- Seul l'initiateur répond à une demande (RG36)
create function public.repondre_demande(p_membre_id bigint, p_accepter boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_m public.membres_groupe;
  v_g public.groupes_colocation;
begin
  if not public.peut_ecrire() then
    raise exception 'Action impossible pour le moment.';
  end if;
  if p_accepter is null then
    raise exception 'Réponse invalide.';
  end if;
  select * into v_m from public.membres_groupe where id = p_membre_id for update;
  if not found then
    raise exception 'Demande introuvable.';
  end if;
  select * into v_g from public.groupes_colocation where id = v_m.groupe_id for update;
  if v_g.initiateur_id <> v_uid then
    raise exception 'Seul l''initiateur du groupe peut répondre aux demandes.';
  end if;
  if v_m.statut <> 'en_attente' then
    raise exception 'Cette demande a déjà reçu une réponse.';
  end if;
  if p_accepter then
    if v_g.statut <> 'en_formation' or public.membres_acceptes(v_g.id) >= v_g.places_recherchees + 1 then
      raise exception 'Le groupe est complet.';
    end if;
    update public.membres_groupe set statut = 'accepte', updated_at = now() where id = p_membre_id;
    perform public.notifier(v_m.user_id, 'groupe_reponse', 'Ta demande pour rejoindre un groupe a été acceptée.', '/groupes');
  else
    update public.membres_groupe set statut = 'refuse', updated_at = now() where id = p_membre_id;
    perform public.notifier(v_m.user_id, 'groupe_reponse', 'Ta demande pour rejoindre un groupe n''a pas été retenue.', '/groupes');
  end if;
  update public.groupes_colocation set derniere_activite = now() where id = v_g.id;
end;
$$;

-- RG38 : le groupe passe à « complet » quand tous les membres sont acceptés ; les membres et le propriétaire sont
-- notifiés. Il redevient « en formation » si quelqu'un part.
create function public.mettre_a_jour_groupe()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_g public.groupes_colocation;
  v_nb integer;
  v_dest record;
begin
  select * into v_g from public.groupes_colocation where id = new.groupe_id for update;
  if v_g.statut = 'cloture' then
    return null;
  end if;
  v_nb := public.membres_acceptes(v_g.id);
  if v_g.statut = 'en_formation' and v_nb >= v_g.places_recherchees + 1 then
    update public.groupes_colocation set statut = 'complet', derniere_activite = now() where id = v_g.id;
    for v_dest in select m.user_id as uid from public.membres_groupe m where m.groupe_id = v_g.id and m.statut = 'accepte'
                  union select a.auteur_id from public.annonces a where a.id = v_g.annonce_id loop
      perform public.notifier(v_dest.uid, 'groupe_complet', 'Un groupe de colocation est complet.', '/groupes');
    end loop;
  elsif v_g.statut = 'complet' and v_nb < v_g.places_recherchees + 1 then
    update public.groupes_colocation set statut = 'en_formation', derniere_activite = now() where id = v_g.id;
  end if;
  return null;
end;
$$;
create trigger membres_groupe_etat after insert or update of statut on public.membres_groupe
  for each row execute function public.mettre_a_jour_groupe();

-- RG39 : quitter un groupe. Si l'initiateur part, le plus ancien membre accepté prend sa place ; sans autre membre, le groupe se clôt.
create function public.quitter_groupe(p_groupe_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_m public.membres_groupe;
  v_g public.groupes_colocation;
  v_suivant public.membres_groupe;
begin
  if not public.est_actif() then
    raise exception 'Connexion requise.';
  end if;
  select * into v_g from public.groupes_colocation where id = p_groupe_id for update;
  select * into v_m from public.membres_groupe where groupe_id = p_groupe_id and user_id = v_uid and statut in ('en_attente', 'accepte') for update;
  if not found or v_g.id is null then
    raise exception 'Tu ne fais pas partie de ce groupe.';
  end if;
  update public.membres_groupe set statut = 'parti', role = 'membre', updated_at = now() where id = v_m.id;

  if v_g.initiateur_id = v_uid and v_g.statut <> 'cloture' then
    select * into v_suivant from public.membres_groupe
    where groupe_id = p_groupe_id and statut = 'accepte' and user_id <> v_uid
    order by created_at, id limit 1;
    if found then
      update public.membres_groupe set role = 'initiateur', updated_at = now() where id = v_suivant.id;
      update public.groupes_colocation set initiateur_id = v_suivant.user_id, derniere_activite = now() where id = p_groupe_id;
      perform public.notifier(v_suivant.user_id, 'groupe_initiateur', 'Tu es maintenant l''initiateur de ton groupe.', '/groupes');
    else
      update public.groupes_colocation set statut = 'cloture', derniere_activite = now() where id = p_groupe_id;
      -- les demandes encore en attente n'ont plus d'objet
      update public.membres_groupe set statut = 'refuse', updated_at = now() where groupe_id = p_groupe_id and statut = 'en_attente';
    end if;
  else
    update public.groupes_colocation set derniere_activite = now() where id = p_groupe_id;
  end if;
end;
$$;

-- RG39 : clôture automatique, quand le logement n'est plus publié ou après 30 jours sans activité. Interne (pg_cron).
create function public.cloturer_groupes_inactifs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nb integer;
begin
  with a_cloturer as (
    update public.groupes_colocation g set statut = 'cloture'
    where g.statut <> 'cloture' and (
      g.derniere_activite < now() - interval '30 days'
      or not exists (select 1 from public.annonces a where a.id = g.annonce_id and a.statut = 'publiee')
    )
    returning g.id
  )
  select count(*) into v_nb from a_cloturer;
  update public.membres_groupe set statut = 'refuse', updated_at = now()
  where statut = 'en_attente' and groupe_id in (select id from public.groupes_colocation where statut = 'cloture');
  return v_nb;
end;
$$;
select cron.schedule('m8-cloture-groupes', '0 3 * * *', $$select public.cloturer_groupes_inactifs()$$);

-- =====================================================================
-- Lecture pour l'interface
-- =====================================================================

-- RG35, RG37 : groupes en formation sur un logement (tout utilisateur connecté), avec places restantes et part estimée.
-- Le propriétaire de l'annonce voit aussi les groupes complets (onglet « Groupes intéressés »).
create function public.groupes_du_logement(p_annonce_id bigint)
returns table (
  id bigint, initiateur_id uuid, initiateur_prenom text, initiateur_initiale text, places_recherchees integer,
  membres integer, places_restantes integer, part_estimee_fcfa integer, message text, preferences text, statut text, mon_statut text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_a public.annonces;
begin
  if not public.est_actif() then
    raise exception 'Connexion requise.';
  end if;
  select * into v_a from public.annonces a
  where a.id = p_annonce_id and ((a.statut = 'publiee' and not a.en_revue and public.auteur_actif(a.auteur_id)) or a.auteur_id = v_uid);
  if not found then
    return;
  end if;
  return query
    select g.id, g.initiateur_id, p.prenom, upper(left(p.nom, 1)), g.places_recherchees,
           public.membres_acceptes(g.id), greatest(g.places_recherchees + 1 - public.membres_acceptes(g.id), 0),
           -- RG37 : part estimée = loyer total ÷ nombre de places (le loyer total d'un propriétaire est son loyer mensuel)
           (coalesce(v_a.loyer_total_fcfa, v_a.part_mensuelle_fcfa) / greatest(v_a.nb_places, 1))::integer,
           g.message, g.preferences, g.statut::text,
           (select m.statut::text from public.membres_groupe m where m.groupe_id = g.id and m.user_id = v_uid)
    from public.groupes_colocation g join public.profils p on p.id = g.initiateur_id
    where g.annonce_id = p_annonce_id and not g.en_revue
      and (g.statut = 'en_formation' or (v_a.auteur_id = v_uid and g.statut = 'complet'))
    order by g.created_at, g.id;
end;
$$;

-- Membres d'un groupe (prénom et initiale seulement). L'initiateur voit aussi les demandes en attente.
create function public.membres_du_groupe(p_groupe_id bigint)
returns table (membre_id bigint, user_id uuid, prenom text, initiale text, role text, statut text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_init boolean := public.est_initiateur_groupe(p_groupe_id);
begin
  if not public.est_actif() or not public.peut_voir_groupe(p_groupe_id) then
    return;
  end if;
  return query
    select m.id, m.user_id, p.prenom, upper(left(p.nom, 1)), m.role, m.statut::text
    from public.membres_groupe m join public.profils p on p.id = m.user_id
    where m.groupe_id = p_groupe_id and (m.statut = 'accepte' or (v_init and m.statut = 'en_attente'))
    order by (m.role = 'initiateur') desc, m.created_at, m.id;
end;
$$;

-- Mes groupes : ceux où je suis demandeur ou membre, non clos d'abord
create function public.mes_groupes()
returns table (
  id bigint, annonce_id bigint, annonce_titre text, statut text, mon_role text, mon_statut text, places_recherchees integer,
  membres integer, demandes_en_attente integer, part_estimee_fcfa integer, derniere_activite timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not public.est_actif() then
    raise exception 'Connexion requise.';
  end if;
  return query
    select g.id, g.annonce_id, a.titre, g.statut::text, m.role, m.statut::text, g.places_recherchees, public.membres_acceptes(g.id),
           case when g.initiateur_id = v_uid then (select count(*)::integer from public.membres_groupe x where x.groupe_id = g.id and x.statut = 'en_attente') else 0 end,
           (coalesce(a.loyer_total_fcfa, a.part_mensuelle_fcfa) / greatest(a.nb_places, 1))::integer, g.derniere_activite
    from public.membres_groupe m
    join public.groupes_colocation g on g.id = m.groupe_id
    join public.annonces a on a.id = g.annonce_id
    where m.user_id = v_uid and m.statut in ('en_attente', 'accepte')
    order by (g.statut = 'cloture'), g.derniere_activite desc, g.id desc;
end;
$$;

-- RGP11 : export des données
create function public.exporter_donnees_groupes(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('groupes', coalesce((
    select jsonb_agg(jsonb_build_object('groupe_id', g.id, 'annonce_id', g.annonce_id, 'mon_role', m.role, 'mon_statut', m.statut,
      'statut_groupe', g.statut, 'message', case when g.initiateur_id = p_uid then g.message end,
      'preferences', case when g.initiateur_id = p_uid then g.preferences end, 'rejoint_le', m.created_at) order by g.id)
    from public.membres_groupe m join public.groupes_colocation g on g.id = m.groupe_id where m.user_id = p_uid
  ), '[]'::jsonb));
$$;

-- =====================================================================
-- Droits : fonction -> rôles autorisés (RGP17)
-- =====================================================================
revoke execute on function
  public.capacite_groupe(bigint), public.membres_acceptes(bigint), public.est_initiateur_groupe(bigint), public.peut_voir_groupe(bigint),
  public.compter_groupes_en_formation(bigint), public.compter_groupes_annonces(bigint[]), public.groupes_actifs_de(uuid),
  public.verifier_participation(uuid, bigint), public.exiger_etudiant_verifie(), public.creer_groupe(bigint, integer, text, text),
  public.demander_adhesion(bigint), public.repondre_demande(bigint, boolean), public.mettre_a_jour_groupe(),
  public.quitter_groupe(bigint), public.cloturer_groupes_inactifs(), public.groupes_du_logement(bigint),
  public.membres_du_groupe(bigint), public.mes_groupes(), public.exporter_donnees_groupes(uuid)
  from public, anon, authenticated;

-- Politiques RLS : évaluées avec les droits de la personne connectée
grant execute on function public.est_initiateur_groupe(bigint), public.peut_voir_groupe(bigint) to authenticated;
-- Badge public : un nombre de groupes en formation (RG24)
grant execute on function public.compter_groupes_en_formation(bigint), public.compter_groupes_annonces(bigint[]) to anon, authenticated;
grant execute on function public.creer_groupe(bigint, integer, text, text) to authenticated;
grant execute on function public.demander_adhesion(bigint) to authenticated;
grant execute on function public.repondre_demande(bigint, boolean) to authenticated;
grant execute on function public.quitter_groupe(bigint) to authenticated;
grant execute on function public.groupes_du_logement(bigint) to authenticated;
grant execute on function public.membres_du_groupe(bigint) to authenticated;
grant execute on function public.mes_groupes() to authenticated;
-- Internes, sans GRANT : capacite_groupe, membres_acceptes, groupes_actifs_de, verifier_participation, exiger_etudiant_verifie,
-- mettre_a_jour_groupe, cloturer_groupes_inactifs, exporter_donnees_groupes

insert into public.limites (action, fenetre_secondes, maximum, portee) values
  ('creer_groupe', 86400, 5, 'utilisateur'),
  ('demande_groupe', 86400, 20, 'utilisateur')
on conflict do nothing;
