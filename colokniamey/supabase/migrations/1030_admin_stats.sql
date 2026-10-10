-- 1030_admin_stats.sql
-- Module A1 : tableau de bord et statistiques (RGA18, RGA20, RGA26, RGA27).
--
-- Toutes les fonctions sont SECURITY DEFINER avec contrôle explicite du rôle : stats_moderation est ouverte à tout admin
-- (est_admin()), les autres sont réservées au super-admin (est_super_admin()). Les statistiques sont des AGRÉGATS : aucune
-- donnée personnelle (RGA18). Les tables d'agrégats ne sont lisibles par personne directement.

-- =====================================================================
-- Agrégats de visites (RGA18, RGA20) : détail gardé 30 jours, puis seulement les totaux par jour
-- =====================================================================
create table public.visites_par_jour (
  jour date primary key,
  visites integer not null,
  sessions integer not null
);
create table public.visites_detail_par_jour (
  jour date not null,
  chemin text not null,
  appareil text not null,
  visites integer not null,
  primary key (jour, chemin, appareil)
);
alter table public.visites_par_jour enable row level security;
alter table public.visites_detail_par_jour enable row level security;
revoke all on table public.visites_par_jour, public.visites_detail_par_jour from anon, authenticated;

-- Agrège les jours terminés encore présents dans le détail, puis supprime le détail de plus de 30 jours. Interne (pg_cron).
create function public.agreger_visites()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.visites_par_jour (jour, visites, sessions)
  select created_at::date, count(*)::integer, count(distinct session_id)::integer
  from public.visites where created_at::date < current_date
  group by created_at::date
  on conflict (jour) do update set visites = excluded.visites, sessions = excluded.sessions;

  insert into public.visites_detail_par_jour (jour, chemin, appareil, visites)
  select created_at::date, chemin, appareil, count(*)::integer
  from public.visites where created_at::date < current_date
  group by created_at::date, chemin, appareil
  on conflict (jour, chemin, appareil) do update set visites = excluded.visites;

  -- RGA20 : visites détaillées conservées 30 jours
  delete from public.visites where created_at < now() - interval '30 days';
end;
$$;
select cron.schedule('a1-agreger-visites', '10 0 * * *', $$select public.agreger_visites()$$);

-- =====================================================================
-- Statistiques
-- =====================================================================
create function public.borne_jours(p_jours integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when p_jours in (7, 30, 90) then p_jours else 30 end;
$$;

create function public.stats_utilisateurs(p_jours integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_j integer := public.borne_jours(p_jours);
begin
  if not public.est_super_admin() then
    raise exception 'Action non autorisée.';
  end if;
  return jsonb_build_object(
    'total', (select count(*) from public.profils),
    'par_role', coalesce((select jsonb_object_agg(role, n) from (select role::text, count(*) as n from public.profils group by role) r), '{}'::jsonb),
    'par_statut', coalesce((select jsonb_object_agg(statut, n) from (select statut::text, count(*) as n from public.profils group by statut) s), '{}'::jsonb),
    'inscriptions', coalesce((
      select jsonb_agg(jsonb_build_object('jour', j.jour, 'etudiant', coalesce(e.n, 0), 'proprietaire', coalesce(p.n, 0)) order by j.jour)
      from generate_series(current_date - (v_j - 1), current_date, interval '1 day') as j(jour)
      left join (select created_at::date as jour, count(*) as n from public.profils where role = 'etudiant' group by 1) e on e.jour = j.jour::date
      left join (select created_at::date as jour, count(*) as n from public.profils where role = 'proprietaire' group by 1) p on p.jour = j.jour::date
    ), '[]'::jsonb),
    'nouveaux_periode', (select count(*) from public.profils where created_at >= current_date - (v_j - 1)),
    'nouveaux_periode_precedente', (select count(*) from public.profils where created_at >= current_date - (2 * v_j - 1) and created_at < current_date - (v_j - 1))
  );
end;
$$;

create function public.stats_annonces(p_jours integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_j integer := public.borne_jours(p_jours);
begin
  if not public.est_super_admin() then
    raise exception 'Action non autorisée.';
  end if;
  return jsonb_build_object(
    'total', (select count(*) from public.annonces),
    'par_statut', coalesce((select jsonb_object_agg(statut, n) from (select statut::text, count(*) as n from public.annonces group by statut) s), '{}'::jsonb),
    'par_type', coalesce((select jsonb_object_agg(type, n) from (select type::text, count(*) as n from public.annonces where statut = 'publiee' group by type) t), '{}'::jsonb),
    'par_quartier', coalesce((
      select jsonb_agg(jsonb_build_object('quartier', nom, 'annonces', n) order by n desc, nom)
      from (select q.nom, count(*) as n from public.annonces a join public.quartiers q on q.id = a.quartier_id where a.statut = 'publiee' group by q.nom order by count(*) desc, q.nom limit 10) x
    ), '[]'::jsonb),
    -- Délai moyen de validation : entre la mise en attente (notification à l'auteur) et la validation (journal d'audit)
    'delai_moyen_validation_heures', (
      select round((avg(extract(epoch from (j.created_at - n.debut)) / 3600))::numeric, 1)
      from public.journal_audit j
      join lateral (select min(x.created_at) as debut from public.notifications x
                    where x.type = 'annonce_statut' and x.lien = '/annonces/' || j.cible_id and x.titre like '%en cours de vérification%') n on n.debut is not null
      where j.action = 'annonce_validee' and j.created_at >= current_date - (v_j - 1)
    ),
    'publiees_periode', (select count(*) from public.annonces where publiee_le >= current_date - (v_j - 1)),
    'publiees_periode_precedente', (select count(*) from public.annonces where publiee_le >= current_date - (2 * v_j - 1) and publiee_le < current_date - (v_j - 1))
  );
end;
$$;

-- Visites et sessions uniques par jour, pages les plus vues, appareils. Les jours terminés viennent des agrégats, le jour en cours du détail.
create function public.stats_visites(p_jours integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_j integer := public.borne_jours(p_jours);
begin
  if not public.est_super_admin() then
    raise exception 'Action non autorisée.';
  end if;
  return jsonb_build_object(
    'par_jour', coalesce((
      select jsonb_agg(jsonb_build_object('jour', d.jour, 'visites', coalesce(a.visites, 0), 'sessions', coalesce(a.sessions, 0)) order by d.jour)
      from generate_series(current_date - (v_j - 1), current_date, interval '1 day') as d(jour)
      left join (
        select jour, visites, sessions from public.visites_par_jour where jour < current_date
        union all
        select current_date, count(*)::integer, count(distinct session_id)::integer from public.visites where created_at::date = current_date
      ) a on a.jour = d.jour::date
    ), '[]'::jsonb),
    'aujourdhui', (select jsonb_build_object('visites', count(*), 'sessions', count(distinct session_id)) from public.visites where created_at::date = current_date),
    'hier', coalesce((select jsonb_build_object('visites', visites, 'sessions', sessions) from public.visites_par_jour where jour = current_date - 1), jsonb_build_object('visites', 0, 'sessions', 0)),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object('chemin', chemin, 'visites', n) order by n desc, chemin)
      from (select chemin, sum(visites)::integer as n from (
              select jour, chemin, visites from public.visites_detail_par_jour where jour < current_date and jour >= current_date - (v_j - 1)
              union all
              select created_at::date, chemin, 1 from public.visites where created_at::date = current_date) u
            group by chemin order by sum(visites) desc, chemin limit 10) p
    ), '[]'::jsonb),
    'appareils', coalesce((
      select jsonb_object_agg(appareil, n)
      from (select appareil, sum(visites)::integer as n from (
              select jour, appareil, visites from public.visites_detail_par_jour where jour < current_date and jour >= current_date - (v_j - 1)
              union all
              select created_at::date, appareil, 1 from public.visites where created_at::date = current_date) u
            group by appareil) a
    ), '{}'::jsonb)
  );
end;
$$;

-- RGA26 : « Ma file de travail » de l'admin (et file du super-admin). Ouverte à tout admin.
create function public.stats_moderation(p_jours integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_j integer := public.borne_jours(p_jours);
begin
  if not public.est_admin() then
    raise exception 'Action non autorisée.';
  end if;
  return jsonb_build_object(
    'annonces_en_attente', (select count(*) from public.annonces where statut = 'en_attente'),
    'annonce_la_plus_ancienne', (select min(updated_at) from public.annonces where statut = 'en_attente'),
    'prochaine_annonce', (select jsonb_build_object('id', id, 'titre', titre) from public.annonces where statut = 'en_attente' order by updated_at, id limit 1),
    'photos_en_attente', (select count(*) from public.photos where statut = 'en_attente'),
    'photo_la_plus_ancienne', (select min(created_at) from public.photos where statut = 'en_attente'),
    'contenus_en_attente', (select count(*) from public.contenus_en_revue where statut = 'en_attente'),
    'signalements_nouveaux', (select count(*) from public.signalements where statut = 'nouveau'),
    'signalements_en_cours', (select count(*) from public.signalements where statut = 'en_cours'),
    'signalement_le_plus_ancien', (select min(created_at) from public.signalements where statut = 'nouveau'),
    'identites_en_attente', (select count(*) from public.verifications_identite where statut = 'en_attente'),
    -- Demandes reçues et traitées par jour (annonces, photos, contenus, signalements, identités)
    'par_jour', coalesce((
      select jsonb_agg(jsonb_build_object('jour', d.jour, 'recues', coalesce(r.n, 0), 'traitees', coalesce(t.n, 0)) order by d.jour)
      from generate_series(current_date - (v_j - 1), current_date, interval '1 day') as d(jour)
      left join (
        select jour, sum(n) as n from (
          select created_at::date as jour, count(*) as n from public.notifications where type = 'annonce_statut' and titre like '%en cours de vérification%' group by 1
          union all select created_at::date, count(*) from public.photos group by 1
          union all select created_at::date, count(*) from public.contenus_en_revue group by 1
          union all select created_at::date, count(*) from public.signalements group by 1
          union all select soumis_le::date, count(*) from public.verifications_identite where soumis_le is not null group by 1
        ) x group by jour
      ) r on r.jour = d.jour::date
      left join (
        select created_at::date as jour, count(*) as n from public.journal_audit
        where action in ('annonce_validee', 'annonce_refusee', 'annonce_retiree', 'photo_valider', 'photo_refuser', 'contenu_publie', 'contenu_refuse', 'signalement_clos', 'kyc_valide', 'kyc_refuse')
        group by 1
      ) t on t.jour = d.jour::date
    ), '[]'::jsonb)
  );
end;
$$;

-- Erreurs de l'application : ouvertes et nouvelles des dernières 24 h
create function public.stats_erreurs()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.est_super_admin() then
    raise exception 'Action non autorisée.';
  end if;
  return jsonb_build_object(
    'ouvertes', (select count(*) from public.erreurs where statut in ('nouveau', 'en_cours')),
    'nouvelles_24h', (select count(*) from public.erreurs where premiere_vue >= now() - interval '24 hours'),
    'occurrences_24h', (select count(*) from public.erreurs where derniere_vue >= now() - interval '24 hours')
  );
end;
$$;

-- =====================================================================
-- Droits : fonction -> rôles autorisés (RGP17). Le corps de chacune vérifie le rôle (RGA27).
-- =====================================================================
revoke execute on function
  public.agreger_visites(), public.borne_jours(integer), public.stats_utilisateurs(integer), public.stats_annonces(integer),
  public.stats_visites(integer), public.stats_moderation(integer), public.stats_erreurs()
  from public, anon, authenticated;

grant execute on function public.stats_utilisateurs(integer), public.stats_annonces(integer), public.stats_visites(integer),
  public.stats_moderation(integer), public.stats_erreurs() to authenticated;
-- Internes, sans GRANT : agreger_visites (pg_cron), borne_jours
