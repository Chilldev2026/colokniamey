-- 1020_signalements.sql
-- Module M7 : signalements (RG20, RGA10, RGA12, RGP20) et son extension d'administration (volet signalements d'A3).
--
-- Données personnelles (RGP01) :
--  - un signalement relie un auteur, une cible et un motif : lisible par son auteur et par les admins seulement ;
--  - pour un message, on garde UNE COPIE du seul message visé (contenu, expéditeur, date). C'est la seule porte d'accès
--    d'un admin à un message privé (RGA10) : l'admin ne lit jamais le reste de la conversation.

-- =====================================================================
-- Types et table
-- =====================================================================
create type public.motif_signalement as enum ('arnaque', 'contenu_inapproprie', 'fausse_annonce', 'harcelement', 'autre');
create type public.statut_signalement as enum ('nouveau', 'en_cours', 'traite', 'rejete'); -- RGA12

create table public.signalements (
  id bigint generated always as identity primary key,
  auteur_id uuid not null references public.profils (id) on delete cascade,
  cible_type text not null check (cible_type in ('annonce', 'profil', 'message')),
  cible_id text not null check (char_length(cible_id) <= 40),
  -- la personne visée (auteur de l'annonce, titulaire du profil, expéditeur du message) : sert à l'historique et à la suspension
  cible_auteur_id uuid references public.profils (id) on delete set null,
  motif public.motif_signalement not null,
  commentaire text check (char_length(commentaire) <= 500),
  -- copie du seul message signalé (RGA10)
  message_contenu text check (char_length(message_contenu) <= 2000),
  message_le timestamptz,
  statut public.statut_signalement not null default 'nouveau',
  traite_par uuid references auth.users (id) on delete set null,
  decision text check (decision in ('rejeter', 'retirer_annonce', 'suspendre_auteur', 'traiter')),
  decision_commentaire text check (char_length(decision_commentaire) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decide_le timestamptz,
  constraint signalements_pas_soi_meme check (cible_auteur_id is distinct from auteur_id)
);
-- Un seul signalement ouvert par auteur et par cible
create unique index signalements_ouvert_idx on public.signalements (auteur_id, cible_type, cible_id) where statut in ('nouveau', 'en_cours');
create index signalements_file_idx on public.signalements (statut, created_at);
create index signalements_cible_idx on public.signalements (cible_type, cible_id);

-- RG45 : le commentaire est un texte libre : blocage seulement (il n'est lu que par les admins, pas de mise en revue)
create trigger signalements_texte before insert on public.signalements
  for each row execute function public.controler_colonnes_texte('signalement', 'prive', 'auteur_id', 'commentaire');

alter table public.signalements enable row level security;
revoke all on table public.signalements from anon, authenticated;
-- L'auteur lit ses signalements (pas le nom de l'admin, ni la copie du message) ; aucune écriture directe
grant select (id, auteur_id, cible_type, cible_id, motif, commentaire, statut, decision, created_at, decide_le) on public.signalements to authenticated;
create policy signalements_lecture_auteur on public.signalements for select to authenticated using (auteur_id = (select auth.uid()));

-- =====================================================================
-- Signaler (RG20)
-- =====================================================================
create function public.signaler(p_cible_type text, p_cible_id text, p_motif public.motif_signalement, p_commentaire text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cible_auteur uuid;
  v_contenu text;
  v_le timestamptz;
  v_id bigint;
begin
  if not public.peut_ecrire() then
    raise exception 'Action impossible pour le moment.';
  end if;
  perform public.verifier_quota('signaler'); -- RGP20 : 10 signalements par jour

  if p_cible_type = 'annonce' then
    if p_cible_id !~ '^[0-9]{1,18}$' then raise exception 'Contenu introuvable.'; end if;
    -- seule une annonce que la personne peut voir (publiée, ou la sienne) est signalable
    select a.auteur_id into v_cible_auteur from public.annonces a
    where a.id = p_cible_id::bigint and ((a.statut = 'publiee' and not a.en_revue and public.auteur_actif(a.auteur_id)) or a.auteur_id = v_uid);
  elsif p_cible_type = 'profil' then
    if p_cible_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Contenu introuvable.'; end if;
    select p.id into v_cible_auteur from public.profils p
    where p.id = p_cible_id::uuid and p.statut = 'actif' and p.role in ('etudiant', 'proprietaire');
  elsif p_cible_type = 'message' then
    if p_cible_id !~ '^[0-9]{1,18}$' then raise exception 'Contenu introuvable.'; end if;
    -- on ne signale qu'un message REÇU, dans une conversation dont on fait partie ; on en garde la copie (RGA10)
    select m.expediteur_id, m.contenu, m.created_at into v_cible_auteur, v_contenu, v_le
    from public.messages m join public.conversations c on c.id = m.conversation_id
    where m.id = p_cible_id::bigint and v_uid in (c.demandeur_id, c.auteur_id) and m.expediteur_id <> v_uid;
  else
    raise exception 'Type de contenu invalide.';
  end if;
  if v_cible_auteur is null then
    raise exception 'Ce contenu n''est pas disponible.';
  end if;
  if v_cible_auteur = v_uid then
    raise exception 'Tu ne peux pas te signaler toi-même.';
  end if;

  begin
    insert into public.signalements (auteur_id, cible_type, cible_id, cible_auteur_id, motif, commentaire, message_contenu, message_le)
    values (v_uid, p_cible_type, p_cible_id, v_cible_auteur, p_motif, nullif(btrim(coalesce(p_commentaire, '')), ''), v_contenu, v_le)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Tu as déjà signalé ce contenu : l''équipe va le traiter.';
  end;
  return v_id;
end;
$$;

-- Exemple de contexte pour l'interface : ai-je déjà un signalement ouvert sur cette cible ?
create function public.signalement_ouvert(p_cible_type text, p_cible_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.signalements
    where auteur_id = (select auth.uid()) and cible_type = p_cible_type and cible_id = p_cible_id and statut in ('nouveau', 'en_cours')
  );
$$;

-- =====================================================================
-- Administration (extension d'A3) : files, prise en charge, décision (RGA12, RGA10, RGA11, RGA29)
-- =====================================================================
create view public.file_signalements with (security_invoker = true) as
  select count(*)::bigint as nombre, min(created_at) as plus_ancien from public.signalements where statut = 'nouveau';
revoke all on public.file_signalements from anon, authenticated;
insert into public.files_admin (nom, libelle, vue, lien, ordre) values ('signalements', 'Signalements', 'file_signalements', '/admin/signalements', 5)
on conflict (nom) do nothing;

-- Liste par statut et motif, le plus ancien d'abord. Les signalements d'un autre admin en cours restent visibles.
create function public.liste_signalements(p_statut text default 'nouveau', p_motif text default null)
returns table (
  id bigint, cible_type text, motif text, statut text, nb_sur_la_cible integer, pris_par_moi boolean, pris_par_un_autre boolean, created_at timestamptz
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
  if p_statut not in ('nouveau', 'en_cours', 'traite', 'rejete') then
    raise exception 'Filtre invalide.';
  end if;
  return query
    select s.id, s.cible_type, s.motif::text, s.statut::text,
           (select count(*)::integer from public.signalements o where o.cible_type = s.cible_type and o.cible_id = s.cible_id),
           s.traite_par = auth.uid(), (s.traite_par is not null and s.traite_par <> auth.uid()), s.created_at
    from public.signalements s
    where s.statut = p_statut::public.statut_signalement and (p_motif is null or p_motif = '' or s.motif::text = p_motif)
    order by s.created_at asc, s.id asc
    limit 100;
end;
$$;

-- Fiche : le signalement, la cible en contexte, l'historique sur la même cible. L'admin ne reçoit que le message joint (RGA10).
create function public.fiche_signalement(p_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_s public.signalements;
  v_cible jsonb := '{}'::jsonb;
begin
  if not public.est_admin() then
    raise exception 'Action non autorisée.';
  end if;
  select * into v_s from public.signalements where id = p_id;
  if not found then
    raise exception 'Signalement introuvable.';
  end if;
  if v_s.cible_type = 'annonce' then
    select jsonb_build_object('annonce_id', a.id, 'titre', a.titre, 'statut', a.statut, 'description', a.description,
             'auteur', jsonb_build_object('id', p.id, 'prenom', p.prenom, 'nom', p.nom, 'statut', p.statut))
    into v_cible from public.annonces a join public.profils p on p.id = a.auteur_id where a.id = v_s.cible_id::bigint;
  elsif v_s.cible_type = 'profil' then
    select jsonb_build_object('id', p.id, 'prenom', p.prenom, 'nom', p.nom, 'role', p.role, 'statut', p.statut)
    into v_cible from public.profils p where p.id = v_s.cible_id::uuid;
  else
    -- RGA10 : seulement la copie du message visé, jamais la conversation
    v_cible := jsonb_build_object('message', v_s.message_contenu, 'envoye_le', v_s.message_le,
      'auteur', (select jsonb_build_object('id', p.id, 'prenom', p.prenom, 'nom', p.nom, 'statut', p.statut) from public.profils p where p.id = v_s.cible_auteur_id));
  end if;
  return jsonb_build_object(
    'id', v_s.id, 'cible_type', v_s.cible_type, 'cible_id', v_s.cible_id, 'cible_auteur_id', v_s.cible_auteur_id, 'motif', v_s.motif,
    'commentaire', v_s.commentaire, 'statut', v_s.statut, 'decision', v_s.decision, 'decision_commentaire', v_s.decision_commentaire,
    'cree_le', v_s.created_at, 'pris_par_moi', v_s.traite_par = auth.uid(), 'pris_par_un_autre', v_s.traite_par is not null and v_s.traite_par <> auth.uid(),
    'signale_par', (select p.prenom from public.profils p where p.id = v_s.auteur_id),
    'cible', coalesce(v_cible, '{}'::jsonb),
    'historique', coalesce((
      select jsonb_agg(jsonb_build_object('id', h.id, 'motif', h.motif, 'statut', h.statut, 'decision', h.decision, 'cree_le', h.created_at) order by h.created_at)
      from public.signalements h where h.cible_type = v_s.cible_type and h.cible_id = v_s.cible_id and h.id <> v_s.id
    ), '[]'::jsonb),
    'autres_signalements_sur_la_personne', (select count(*) from public.signalements h where h.cible_auteur_id = v_s.cible_auteur_id and h.id <> v_s.id)
  );
end;
$$;

-- RGA12 : un seul admin prend un signalement en charge (verrouillage par la ligne)
create function public.prendre_en_charge_signalement(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.est_admin() then
    raise exception 'Action non autorisée.';
  end if;
  update public.signalements set statut = 'en_cours', traite_par = auth.uid(), updated_at = now()
  where id = p_id and statut = 'nouveau' and auteur_id <> auth.uid();
  if not found then
    raise exception 'Ce signalement est déjà pris en charge ou n''existe plus.';
  end if;
  perform public.journaliser('signalement_pris', 'signalement', p_id::text, '{}'::jsonb);
end;
$$;

-- RGA12, RGA11 : décision. L'admin qui l'a pris la rend : rejeter, retirer l'annonce (motif notifié à l'auteur),
-- suspendre l'auteur (via A2 : mêmes règles RGA02) ou simplement marquer comme traité.
create function public.cloturer_signalement(p_id bigint, p_decision text, p_commentaire text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.signalements;
  v_motif text := nullif(btrim(coalesce(p_commentaire, '')), '');
begin
  if not public.est_admin() then
    raise exception 'Action non autorisée.';
  end if;
  if p_decision not in ('rejeter', 'retirer_annonce', 'suspendre_auteur', 'traiter') then
    raise exception 'Décision invalide.';
  end if;
  select * into v_s from public.signalements where id = p_id for update;
  if not found then
    raise exception 'Signalement introuvable.';
  end if;
  if v_s.statut <> 'en_cours' or v_s.traite_par is distinct from auth.uid() then
    raise exception 'Seul l''administrateur qui a pris ce signalement en charge peut le clore.';
  end if;
  if p_decision in ('retirer_annonce', 'suspendre_auteur') and (v_motif is null or char_length(v_motif) < 3 or char_length(v_motif) > 300) then
    raise exception 'Un motif de 3 à 300 caractères est obligatoire pour cette décision.';
  end if;
  if v_motif is not null and char_length(v_motif) > 300 then
    raise exception 'Le commentaire fait 300 caractères au plus.';
  end if;

  if p_decision = 'retirer_annonce' then
    if v_s.cible_type <> 'annonce' then
      raise exception 'Cette décision ne s''applique qu''à une annonce.';
    end if;
    -- A3 : motif obligatoire, notifié à l'auteur, journalisé (RGA11)
    perform public.retirer_annonce(v_s.cible_id::bigint, v_motif);
  elsif p_decision = 'suspendre_auteur' then
    if v_s.cible_auteur_id is null then
      raise exception 'La personne visée n''existe plus.';
    end if;
    -- A2 : refuse d'agir sur soi-même ou sur un compte de niveau égal ou supérieur (RGA02)
    perform public.admin_action_suspendre(auth.uid(), v_s.cible_auteur_id, v_motif, null);
  end if;

  update public.signalements
  set statut = case when p_decision = 'rejeter' then 'rejete' else 'traite' end::public.statut_signalement,
      decision = p_decision, decision_commentaire = v_motif, decide_le = now(), updated_at = now()
  where id = p_id;
  perform public.journaliser('signalement_clos', 'signalement', p_id::text, jsonb_build_object('decision', p_decision));
  -- RGA33 : aucune donnée personnelle dans la notification
  perform public.notifier(v_s.auteur_id, 'signalement_traite', 'Merci : ton signalement a été examiné par l''équipe.', '/signalements');
end;
$$;

-- Un admin qui ne peut pas finir peut remettre le signalement dans la file
create function public.relacher_signalement(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.est_admin() then
    raise exception 'Action non autorisée.';
  end if;
  update public.signalements set statut = 'nouveau', traite_par = null, updated_at = now()
  where id = p_id and statut = 'en_cours' and traite_par = auth.uid();
  if not found then
    raise exception 'Tu n''as pas pris ce signalement en charge.';
  end if;
  perform public.journaliser('signalement_relache', 'signalement', p_id::text, '{}'::jsonb);
end;
$$;

-- =====================================================================
-- Export des données et compteurs de la fiche utilisateur
-- =====================================================================
create function public.exporter_donnees_signalements(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('signalements_envoyes', coalesce((
    select jsonb_agg(jsonb_build_object('type', s.cible_type, 'motif', s.motif, 'commentaire', s.commentaire, 'statut', s.statut, 'cree_le', s.created_at) order by s.id)
    from public.signalements s where s.auteur_id = p_uid
  ), '[]'::jsonb));
$$;

create function public.compteurs_utilisateur_signalements(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'signalements_recus', (select count(*) from public.signalements where cible_auteur_id = p_uid),
    'signalements_envoyes', (select count(*) from public.signalements where auteur_id = p_uid)
  );
$$;

-- =====================================================================
-- Droits : fonction -> rôles autorisés (RGP17)
-- =====================================================================
revoke execute on function
  public.signaler(text, text, public.motif_signalement, text), public.signalement_ouvert(text, text),
  public.liste_signalements(text, text), public.fiche_signalement(bigint), public.prendre_en_charge_signalement(bigint),
  public.cloturer_signalement(bigint, text, text), public.relacher_signalement(bigint),
  public.exporter_donnees_signalements(uuid), public.compteurs_utilisateur_signalements(uuid)
  from public, anon, authenticated;

grant execute on function public.signaler(text, text, public.motif_signalement, text) to authenticated;
grant execute on function public.signalement_ouvert(text, text) to authenticated;
-- Le corps vérifie est_admin() (aal2 + session admin active)
grant execute on function public.liste_signalements(text, text) to authenticated;
grant execute on function public.fiche_signalement(bigint) to authenticated;
grant execute on function public.prendre_en_charge_signalement(bigint) to authenticated;
grant execute on function public.cloturer_signalement(bigint, text, text) to authenticated;
grant execute on function public.relacher_signalement(bigint) to authenticated;
-- Internes, sans GRANT : exporter_donnees_signalements, compteurs_utilisateur_signalements

insert into public.limites (action, fenetre_secondes, maximum, portee) values
  ('signaler', 86400, 10, 'utilisateur') -- RGP20
on conflict do nothing;
