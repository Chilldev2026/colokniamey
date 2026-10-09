-- 0980_admin_moderation.sql
-- Module A3 : modération des annonces, des photos et des contenus mis en revue ; termes sensibles (RG45 à RG47, RGA11,
-- RGA28, RGA29). Un module admin peut ajouter des politiques de lecture et d'administration sur les tables du module
-- qu'il gère : aucune table de M4 ni de S n'est modifiée ici.
--
-- Toutes les fonctions exigent est_admin() : rôle admin ou super-admin, jeton aal2 et session admin active (RGA04).
-- Chaque décision est journalisée (RGA06) et l'auteur est notifié sans donnée personnelle superflue.

-- =====================================================================
-- Lecture admin des photos en attente (S avait réservé ce point à A3)
-- =====================================================================
create policy photos_lecture_admin on public.photos for select to authenticated using (public.est_admin());
-- L'aperçu d'une photo en attente passe par une adresse temporaire signée : l'admin doit pouvoir lire le bucket privé
create policy photos_attente_lecture_admin on storage.objects for select to authenticated
  using (bucket_id = 'photos_en_attente' and public.est_admin());

-- =====================================================================
-- Files de travail (contrat A2 : vue file_<nom>(nombre, plus_ancien), inscrite dans files_admin)
-- =====================================================================
create view public.file_annonces with (security_invoker = true) as
  select count(*)::bigint as nombre, min(updated_at) as plus_ancien from public.annonces where statut = 'en_attente';
create view public.file_photos with (security_invoker = true) as
  select count(*)::bigint as nombre, min(created_at) as plus_ancien from public.photos where statut = 'en_attente';
create view public.file_contenus with (security_invoker = true) as
  select count(*)::bigint as nombre, min(created_at) as plus_ancien from public.contenus_en_revue where statut = 'en_attente';
revoke all on public.file_annonces, public.file_photos, public.file_contenus from anon, authenticated;

insert into public.files_admin (nom, libelle, vue, lien, ordre) values
  ('annonces', 'Annonces à valider', 'file_annonces', '/admin/moderation', 10),
  ('photos', 'Photos à valider', 'file_photos', '/admin/photos', 20),
  ('contenus', 'Contenus à vérifier', 'file_contenus', '/admin/contenus', 25)
on conflict (nom) do nothing;

-- =====================================================================
-- Annonces (RGA11)
-- =====================================================================
create function public.liste_annonces_a_valider()
returns table (id bigint, titre text, type text, auteur_id uuid, prenom text, initiale_nom text, en_revue boolean, partie_le timestamptz)
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
    select a.id, a.titre, a.type::text, a.auteur_id, p.prenom, upper(left(p.nom, 1)), a.en_revue, a.updated_at
    from public.annonces a join public.profils p on p.id = a.auteur_id
    where a.statut = 'en_attente'
    order by a.updated_at asc -- le plus ancien d'abord
    limit 100;
end;
$$;

-- Aperçu complet pour la décision : champs de l'annonce, photos (tous statuts), règles, tâches, équipements, et la
-- position PUBLIQUE (zone ou point choisi par l'auteur) pour vérifier sur la carte qu'elle est cohérente.
-- L'admin ne reçoit pas le téléphone ni le point exact (RGP01).
create function public.annonce_a_moderer(p_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_res jsonb;
begin
  if not public.est_admin() then
    raise exception 'Action non autorisée.';
  end if;
  select (to_jsonb(a) - 'position' - 'position_publique')
    || jsonb_build_object(
      'latitude', extensions.st_y(a.position_publique::extensions.geometry),
      'longitude', extensions.st_x(a.position_publique::extensions.geometry),
      'zone_rayon_m', case when a.precision_position = 'approximative' then 150 else 0 end,
      'auteur', jsonb_build_object('id', p.id, 'prenom', p.prenom, 'nom', p.nom, 'role', p.role, 'statut', p.statut),
      'quartier', (select q.nom from public.quartiers q where q.id = a.quartier_id),
      'universite', (select u.nom from public.universites u where u.id = a.universite_proche_id),
      'regles', coalesce((select jsonb_agg(r.texte order by r.ordre) from public.regles_annonce r where r.annonce_id = a.id), '[]'::jsonb),
      'taches', coalesce((select jsonb_agg(jsonb_build_object('libelle', t.libelle, 'frequence', t.frequence, 'repartition', t.repartition) order by t.ordre)
                          from public.taches_annonce t where t.annonce_id = a.id), '[]'::jsonb),
      'equipements', coalesce((select jsonb_agg(e.nom order by e.nom) from public.annonce_equipements ae
                               join public.equipements e on e.id = ae.equipement_id where ae.annonce_id = a.id), '[]'::jsonb),
      'photos', coalesce((select jsonb_agg(jsonb_build_object('id', ph.id, 'chemin', ph.chemin, 'statut', ph.statut) order by pa.ordre, pa.id)
                          from public.photos_annonces pa join public.photos ph on ph.id = pa.photo_id where pa.annonce_id = a.id), '[]'::jsonb)
    )
  into v_res
  from public.annonces a join public.profils p on p.id = a.auteur_id
  where a.id = p_id;
  if v_res is null then
    raise exception 'Annonce introuvable.';
  end if;
  return v_res;
end;
$$;

-- Motif de 3 à 300 caractères, obligatoire pour refuser ou retirer (RGA11)
create function public.motif_moderation(p_motif text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
begin
  if v_motif is null or char_length(v_motif) < 3 or char_length(v_motif) > 300 then
    raise exception 'Un motif de 3 à 300 caractères est obligatoire.';
  end if;
  return v_motif;
end;
$$;

create function public.valider_annonce(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.annonces;
begin
  if not public.est_admin() then
    raise exception 'Action non autorisée.';
  end if;
  select * into v_a from public.annonces where id = p_id and statut = 'en_attente' for update;
  if not found then
    raise exception 'Annonce introuvable ou déjà traitée.';
  end if;
  if v_a.en_revue then
    raise exception 'Cette annonce contient un texte à vérifier : traite-le d''abord dans « Contenus à vérifier ».';
  end if;
  if v_a.auteur_id = auth.uid() then
    raise exception 'Tu ne peux pas décider de ta propre annonce.';
  end if;
  -- La notification à l'auteur est envoyée par le déclencheur de M4 (changement de statut)
  update public.annonces set statut = 'publiee', motif_refus = null, publiee_le = now() where id = p_id;
  perform public.journaliser('annonce_validee', 'annonce', p_id::text, '{}'::jsonb);
end;
$$;

create function public.refuser_annonce(p_id bigint, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motif text;
  v_a public.annonces;
begin
  if not public.est_admin() then
    raise exception 'Action non autorisée.';
  end if;
  v_motif := public.motif_moderation(p_motif);
  select * into v_a from public.annonces where id = p_id and statut = 'en_attente' for update;
  if not found then
    raise exception 'Annonce introuvable ou déjà traitée.';
  end if;
  if v_a.auteur_id = auth.uid() then
    raise exception 'Tu ne peux pas décider de ta propre annonce.';
  end if;
  update public.annonces set statut = 'refusee', motif_refus = v_motif where id = p_id;
  perform public.journaliser('annonce_refusee', 'annonce', p_id::text, '{}'::jsonb);
end;
$$;

-- RGA11 : retirer une annonce publiée exige aussi un motif, notifié à l'auteur
create function public.retirer_annonce(p_id bigint, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_motif text;
  v_a public.annonces;
begin
  if not public.est_admin() then
    raise exception 'Action non autorisée.';
  end if;
  v_motif := public.motif_moderation(p_motif);
  select * into v_a from public.annonces where id = p_id and statut = 'publiee' for update;
  if not found then
    raise exception 'Annonce introuvable ou non publiée.';
  end if;
  update public.annonces set statut = 'refusee', motif_refus = v_motif where id = p_id;
  perform public.journaliser('annonce_retiree', 'annonce', p_id::text, '{}'::jsonb);
end;
$$;

-- =====================================================================
-- Photos à valider (RG49, RG50) : la décision passe par l'Edge Function securite-photos-decision
-- =====================================================================
create function public.liste_photos_a_valider()
returns table (id bigint, usage text, chemin text, auteur_id uuid, prenom text, initiale_nom text, suspecte boolean, created_at timestamptz)
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
    select ph.id, ph.usage, ph.chemin, ph.proprietaire_id, p.prenom, upper(left(p.nom, 1)), ph.suspecte, ph.created_at
    from public.photos ph join public.profils p on p.id = ph.proprietaire_id
    where ph.statut = 'en_attente'
    order by ph.created_at asc
    limit 100;
end;
$$;

-- =====================================================================
-- Contenus mis en revue par S (RG45)
-- =====================================================================
create function public.liste_contenus_a_verifier()
returns table (id bigint, type_contenu text, categories text[], auteur_id uuid, prenom text, created_at timestamptz)
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
    select c.id, c.type_contenu, c.categories, c.auteur_id, p.prenom, c.created_at
    from public.contenus_en_revue c left join public.profils p on p.id = c.auteur_id
    where c.statut = 'en_attente'
    order by c.created_at asc
    limit 100;
end;
$$;

-- Le texte à examiner, avec son contexte : liste de { champ, valeur }
create function public.contenu_a_verifier(p_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_c public.contenus_en_revue;
  v_res jsonb;
begin
  if not public.est_admin() then
    raise exception 'Action non autorisée.';
  end if;
  select * into v_c from public.contenus_en_revue where id = p_id;
  if not found then
    raise exception 'Contenu introuvable.';
  end if;
  v_res := case v_c.type_contenu
    when 'annonce' then (
      select jsonb_build_array(jsonb_build_object('champ', 'Titre', 'valeur', a.titre), jsonb_build_object('champ', 'Description', 'valeur', a.description))
      from public.annonces a where a.id = v_c.contenu_id::bigint)
    when 'annonce_regle' then (
      select jsonb_build_array(jsonb_build_object('champ', 'Règle du logement', 'valeur', r.texte))
      from public.regles_annonce r where r.id = v_c.contenu_id::bigint)
    when 'annonce_tache' then (
      select jsonb_build_array(jsonb_build_object('champ', 'Tâche partagée', 'valeur', t.libelle))
      from public.taches_annonce t where t.id = v_c.contenu_id::bigint)
    when 'profil' then (
      select jsonb_build_array(
        jsonb_build_object('champ', 'Profession', 'valeur', coalesce(c.profession, '')),
        jsonb_build_object('champ', 'Centres d''intérêt', 'valeur', array_to_string(c.centres_interet, ', ')))
      from public.profils_complements c where c.user_id = v_c.contenu_id::uuid)
    else null end;
  return coalesce(v_res, '[]'::jsonb);
end;
$$;

-- Publier (le contenu redevient visible) ou refuser (il est retiré, avec un motif communiqué à l'auteur)
create function public.decider_contenu(p_id bigint, p_publier boolean, p_motif text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.contenus_en_revue;
  v_motif text;
begin
  if not public.est_admin() then
    raise exception 'Action non autorisée.';
  end if;
  if p_publier is null then
    raise exception 'Décision invalide.';
  end if;
  if not p_publier then
    v_motif := public.motif_moderation(p_motif);
  end if;
  select * into v_c from public.contenus_en_revue where id = p_id and statut = 'en_attente' for update;
  if not found then
    raise exception 'Contenu introuvable ou déjà traité.';
  end if;
  if v_c.auteur_id = auth.uid() then
    raise exception 'Tu ne peux pas décider de ton propre contenu.';
  end if;

  if p_publier then
    case v_c.type_contenu
      when 'annonce' then update public.annonces set en_revue = false where id = v_c.contenu_id::bigint;
      when 'annonce_regle' then update public.regles_annonce set en_revue = false where id = v_c.contenu_id::bigint;
      when 'annonce_tache' then update public.taches_annonce set en_revue = false where id = v_c.contenu_id::bigint;
      when 'profil' then update public.profils_complements set en_revue = false where user_id = v_c.contenu_id::uuid;
      else raise exception 'Type de contenu inconnu.';
    end case;
  else
    case v_c.type_contenu
      when 'annonce' then
        update public.annonces set en_revue = false, statut = 'refusee', motif_refus = v_motif where id = v_c.contenu_id::bigint;
      when 'annonce_regle' then delete from public.regles_annonce where id = v_c.contenu_id::bigint;
      when 'annonce_tache' then delete from public.taches_annonce where id = v_c.contenu_id::bigint;
      when 'profil' then
        update public.profils_complements set profession = null, centres_interet = array[]::text[], en_revue = false where user_id = v_c.contenu_id::uuid;
      else raise exception 'Type de contenu inconnu.';
    end case;
    -- l'annonce refusée est déjà notifiée par le déclencheur de M4 ; les autres contenus le sont ici
    if v_c.type_contenu <> 'annonce' and v_c.auteur_id is not null then
      perform public.notifier(v_c.auteur_id, 'contenu_refuse', 'Un contenu de ton compte a été retiré : ' || v_motif, null);
    end if;
  end if;

  update public.contenus_en_revue
  set statut = case when p_publier then 'valide' else 'refuse' end, decide_par = auth.uid(), decide_le = now(), motif = v_motif
  where id = p_id;
  perform public.journaliser(case when p_publier then 'contenu_publie' else 'contenu_refuse' end, 'contenu', p_id::text,
    jsonb_build_object('type', v_c.type_contenu));
end;
$$;

-- =====================================================================
-- Alertes de récidive (RG47) : comptes ayant au moins 3 contenus bloqués en 30 jours
-- =====================================================================
create function public.liste_recidives()
returns table (user_id uuid, prenom text, initiale_nom text, nombre integer, dernier timestamptz)
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
    select v.auteur_id, p.prenom, upper(left(p.nom, 1)), count(*)::integer, max(v.created_at)
    from public.violations v join public.profils p on p.id = v.auteur_id
    where v.created_at > now() - interval '30 days'
    group by v.auteur_id, p.prenom, p.nom
    having count(*) >= 3
    order by count(*) desc, max(v.created_at) desc
    limit 50;
end;
$$;

-- =====================================================================
-- Termes sensibles (RG46, RGA28) : l'admin propose, seul le super-admin valide, modifie ou désactive.
-- verifier_texte() n'utilise que les termes validés et actifs.
-- Le super-admin voit toute la liste ; l'admin ne voit que ses propres propositions (la liste n'est jamais diffusée).
-- =====================================================================
create function public.liste_termes()
returns table (id bigint, terme text, categorie text, niveau text, langue text, actif boolean, valide boolean, propose_par_moi boolean, created_at timestamptz)
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
    select t.id, t.terme, t.categorie, t.niveau, t.langue, t.actif, t.valide, t.propose_par = auth.uid(), t.created_at
    from public.termes_sensibles t
    where public.est_super_admin() or t.propose_par = auth.uid()
    order by t.valide, t.created_at desc
    limit 500;
end;
$$;

create function public.proposer_terme(p_terme text, p_categorie text, p_niveau text, p_langue text default 'fr')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_super boolean := public.est_super_admin();
  v_dest record;
begin
  if not public.est_admin() then
    raise exception 'Action non autorisée.';
  end if;
  perform public.verifier_quota('proposer_terme');
  if p_categorie not in ('sexuel', 'haine', 'terrorisme', 'violence', 'menace') or p_niveau not in ('revue', 'blocage') then
    raise exception 'Catégorie ou niveau invalide.';
  end if;
  if char_length(btrim(coalesce(p_langue, ''))) not between 2 and 10 then
    raise exception 'Langue invalide.';
  end if;
  begin
    -- RGA28 : proposé par un admin = inactif tant que le super-admin ne l'a pas validé ; un super-admin valide d'office
    insert into public.termes_sensibles (terme, categorie, niveau, langue, actif, valide, propose_par, valide_par)
    values (p_terme, p_categorie, p_niveau, btrim(p_langue), true, v_super, auth.uid(), case when v_super then auth.uid() end)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Ce terme existe déjà dans cette catégorie.';
  end;
  perform public.journaliser('terme_propose', 'terme', v_id::text, jsonb_build_object('valide_d_office', v_super));
  if not v_super then
    for v_dest in select id from public.profils where role = 'super_admin' and statut = 'actif' loop
      -- RGA33 : la notification ne contient pas le terme
      perform public.notifier(v_dest.id, 'terme_a_valider', 'Un terme sensible attend ta validation.', '/admin/termes');
    end loop;
  end if;
  return v_id;
end;
$$;

create function public.valider_terme(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.est_super_admin() then
    raise exception 'Action non autorisée.';
  end if;
  update public.termes_sensibles set valide = true, actif = true, valide_par = auth.uid() where id = p_id;
  if not found then
    raise exception 'Terme introuvable.';
  end if;
  perform public.journaliser('terme_valide', 'terme', p_id::text, '{}'::jsonb);
end;
$$;

create function public.modifier_terme(p_id bigint, p_terme text, p_categorie text, p_niveau text, p_langue text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.est_super_admin() then
    raise exception 'Action non autorisée.';
  end if;
  if p_categorie not in ('sexuel', 'haine', 'terrorisme', 'violence', 'menace') or p_niveau not in ('revue', 'blocage') then
    raise exception 'Catégorie ou niveau invalide.';
  end if;
  begin
    update public.termes_sensibles set terme = p_terme, categorie = p_categorie, niveau = p_niveau, langue = btrim(p_langue) where id = p_id;
  exception when unique_violation then
    raise exception 'Ce terme existe déjà dans cette catégorie.';
  end;
  if not found then
    raise exception 'Terme introuvable.';
  end if;
  perform public.journaliser('terme_modifie', 'terme', p_id::text, '{}'::jsonb);
end;
$$;

create function public.definir_terme_actif(p_id bigint, p_actif boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.est_super_admin() then
    raise exception 'Action non autorisée.';
  end if;
  update public.termes_sensibles set actif = coalesce(p_actif, false) where id = p_id;
  if not found then
    raise exception 'Terme introuvable.';
  end if;
  perform public.journaliser(case when p_actif then 'terme_active' else 'terme_desactive' end, 'terme', p_id::text, '{}'::jsonb);
end;
$$;

-- Une proposition non validée peut être rejetée (supprimée) ; un terme déjà validé se désactive
create function public.rejeter_terme(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.est_super_admin() then
    raise exception 'Action non autorisée.';
  end if;
  delete from public.termes_sensibles where id = p_id and not valide;
  if not found then
    raise exception 'Proposition introuvable (un terme déjà validé se désactive).';
  end if;
  perform public.journaliser('terme_rejete', 'terme', p_id::text, '{}'::jsonb);
end;
$$;

-- =====================================================================
-- Droits : fonction -> rôles autorisés (RGP17). Le corps de chacune vérifie est_admin() ou est_super_admin().
-- =====================================================================
revoke execute on function
  public.liste_annonces_a_valider(), public.annonce_a_moderer(bigint), public.motif_moderation(text),
  public.valider_annonce(bigint), public.refuser_annonce(bigint, text), public.retirer_annonce(bigint, text),
  public.liste_photos_a_valider(), public.liste_contenus_a_verifier(), public.contenu_a_verifier(bigint),
  public.decider_contenu(bigint, boolean, text), public.liste_recidives(), public.liste_termes(),
  public.proposer_terme(text, text, text, text), public.valider_terme(bigint),
  public.modifier_terme(bigint, text, text, text, text), public.definir_terme_actif(bigint, boolean), public.rejeter_terme(bigint)
  from public, anon, authenticated;

grant execute on function
  public.liste_annonces_a_valider(), public.annonce_a_moderer(bigint), public.valider_annonce(bigint),
  public.refuser_annonce(bigint, text), public.retirer_annonce(bigint, text), public.liste_photos_a_valider(),
  public.liste_contenus_a_verifier(), public.contenu_a_verifier(bigint), public.decider_contenu(bigint, boolean, text),
  public.liste_recidives(), public.liste_termes(), public.proposer_terme(text, text, text, text),
  public.valider_terme(bigint), public.modifier_terme(bigint, text, text, text, text),
  public.definir_terme_actif(bigint, boolean), public.rejeter_terme(bigint)
  to authenticated;
-- Interne, sans GRANT : motif_moderation

insert into public.limites (action, fenetre_secondes, maximum, portee) values
  ('proposer_terme', 86400, 30, 'utilisateur')
on conflict do nothing;
