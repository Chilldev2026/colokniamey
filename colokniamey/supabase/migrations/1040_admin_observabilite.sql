-- 1040_admin_observabilite.sql
-- Module A6 : audit, erreurs et supervision (RGA06, RGA07, RGA19 à RGA25, RGA26, RGA27).
--
-- Rappel des droits : le super-admin lit tout le journal d'audit, les erreurs et la supervision ; un admin ne lit que
-- ses propres lignes d'audit (« Mon historique »), sans accès aux erreurs ni à la supervision. Aucune action ne
-- modifie le journal (ajout seul, RGA07). Aucune donnée personnelle dans les mesures, les erreurs ni les alertes.

-- =====================================================================
-- Journal d'audit : politiques de lecture (RGA26, RGA27)
-- =====================================================================
grant select on public.journal_audit to authenticated;
create policy journal_lecture_super on public.journal_audit for select to authenticated using (public.est_super_admin());
create policy journal_lecture_propre on public.journal_audit for select to authenticated
  using (public.est_admin() and acteur_id = (select auth.uid()));

-- Liste filtrée avec le prénom de l'acteur. Le super-admin voit tout ; un admin ne voit que ses actions.
create function public.liste_journal(
  p_acteur uuid default null, p_action text default null, p_cible_type text default null,
  p_depuis date default null, p_jusqua date default null, p_limite integer default 50, p_decalage integer default 0
)
returns table (id bigint, created_at timestamptz, acteur_id uuid, acteur_prenom text, action text, cible_type text, cible_id text, details jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_super boolean := public.est_super_admin();
begin
  if not public.est_admin() then
    raise exception 'Action non autorisée.';
  end if;
  return query
    select j.id, j.created_at, j.acteur_id, p.prenom, j.action, j.cible_type, j.cible_id, j.details
    from public.journal_audit j left join public.profils p on p.id = j.acteur_id
    where (v_super or j.acteur_id = auth.uid())
      and (not v_super or p_acteur is null or j.acteur_id = p_acteur)
      and (p_action is null or p_action = '' or j.action = p_action)
      and (p_cible_type is null or p_cible_type = '' or j.cible_type = p_cible_type)
      and (p_depuis is null or j.created_at >= p_depuis)
      and (p_jusqua is null or j.created_at < p_jusqua + 1)
    order by j.created_at desc, j.id desc
    limit least(greatest(coalesce(p_limite, 50), 1), 500)
    offset greatest(coalesce(p_decalage, 0), 0);
end;
$$;

-- Valeurs possibles des filtres (actions et types de cible déjà journalisés)
create function public.filtres_journal()
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
    'actions', coalesce((select jsonb_agg(action order by action) from (select distinct action from public.journal_audit) a), '[]'::jsonb),
    'cibles', coalesce((select jsonb_agg(cible_type order by cible_type) from (select distinct cible_type from public.journal_audit where cible_type is not null) c), '[]'::jsonb),
    'acteurs', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'prenom', p.prenom) order by p.prenom)
                         from public.profils p where p.role in ('admin', 'super_admin')), '[]'::jsonb)
  );
end;
$$;

-- =====================================================================
-- Erreurs (RGA19, RGA20) : pile, navigateur et version en plus ; une erreur résolue qui réapparaît repasse à « nouveau »
-- =====================================================================
alter table public.erreurs
  add column pile text check (char_length(pile) <= 2000),
  add column navigateur text check (char_length(navigateur) <= 40),
  add column version text check (char_length(version) <= 20);

-- Remplace l'enregistrement simple pour les nouveaux clients (l'ancienne fonction reste pour les anciens). RGA19 : le
-- message, la pile et la page sont nettoyés côté navigateur ; ici, seules les longueurs sont bornées.
create function public.enregistrer_erreur_detail(
  p_message text, p_module text, p_page text, p_session text, p_pile text default null, p_navigateur text default null, p_version text default null
)
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
  insert into public.erreurs as e (empreinte, message, module, page, pile, navigateur, version)
  values (md5(v_message || '|' || coalesce(v_module, '')), v_message, v_module, v_page, left(p_pile, 2000), left(p_navigateur, 40), left(p_version, 20))
  on conflict (empreinte)
  do update set occurrences = e.occurrences + 1, derniere_vue = now(), pile = coalesce(excluded.pile, e.pile), navigateur = coalesce(excluded.navigateur, e.navigateur),
                version = coalesce(excluded.version, e.version),
                -- RGA19 : une erreur résolue qui réapparaît repasse à « nouveau »
                statut = case when e.statut = 'resolu' then 'nouveau' else e.statut end;
end;
$$;

create function public.liste_erreurs(p_statut text default null, p_jours integer default 30)
returns table (id bigint, message text, module text, page text, occurrences integer, statut text, premiere_vue timestamptz, derniere_vue timestamptz, pile text, navigateur text, version text)
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
    select e.id, e.message, e.module, e.page, e.occurrences, e.statut, e.premiere_vue, e.derniere_vue, e.pile, e.navigateur, e.version
    from public.erreurs e
    where (p_statut is null or p_statut = '' or e.statut = p_statut)
      and e.derniere_vue >= now() - make_interval(days => least(greatest(coalesce(p_jours, 30), 1), 90))
    order by e.derniere_vue desc, e.id desc
    limit 200;
end;
$$;

create function public.changer_statut_erreur(p_id bigint, p_statut text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.est_super_admin() then
    raise exception 'Action non autorisée.';
  end if;
  if p_statut not in ('nouveau', 'en_cours', 'resolu', 'ignore') then
    raise exception 'Statut invalide.';
  end if;
  update public.erreurs set statut = p_statut where id = p_id;
  if not found then
    raise exception 'Erreur introuvable.';
  end if;
  perform public.journaliser('erreur_statut', 'erreur', p_id::text, jsonb_build_object('statut', p_statut));
end;
$$;

-- RGA20 : erreurs gardées 90 jours (pg_cron est disponible sur l'offre gratuite : vérifié par le test de cette migration)
create function public.purger_erreurs()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.erreurs where derniere_vue < now() - interval '90 days';
$$;
select cron.schedule('a6-purger-erreurs', '20 0 * * *', $$select public.purger_erreurs()$$);

-- =====================================================================
-- Supervision : les quatre indicateurs (RGA21 à RGA25)
-- =====================================================================
create table public.mesures_par_heure (
  heure timestamptz not null,
  module text not null,
  requetes integer not null,
  erreurs integer not null,
  p50_ms integer,
  p95_ms integer,
  p99_ms integer,
  primary key (heure, module)
);
alter table public.mesures_par_heure enable row level security;
revoke all on table public.mesures_par_heure from anon, authenticated;

-- RGA25 : détail gardé 7 jours, puis seulement l'agrégat par heure. Interne (pg_cron).
create function public.agreger_mesures()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.mesures_par_heure (heure, module, requetes, erreurs, p50_ms, p95_ms, p99_ms)
  select date_trunc('hour', created_at), module, count(*)::integer, count(*) filter (where not succes)::integer,
         percentile_cont(0.50) within group (order by duree_ms)::integer,
         percentile_cont(0.95) within group (order by duree_ms)::integer,
         percentile_cont(0.99) within group (order by duree_ms)::integer
  from public.mesures where created_at < date_trunc('hour', now())
  group by date_trunc('hour', created_at), module
  on conflict (heure, module) do update
    set requetes = excluded.requetes, erreurs = excluded.erreurs, p50_ms = excluded.p50_ms, p95_ms = excluded.p95_ms, p99_ms = excluded.p99_ms;
  delete from public.mesures where created_at < now() - interval '7 days';
  delete from public.mesures_par_heure where heure < now() - interval '90 days';
end;
$$;
select cron.schedule('a6-agreger-mesures', '5 * * * *', $$select public.agreger_mesures()$$);

-- Seuils d'alerte et limites de l'offre gratuite, réglables par le super-admin
create table public.seuils_supervision (
  cle text primary key check (cle in ('erreurs_pct', 'p95_ms', 'saturation_pct', 'limite_base_mo', 'limite_stockage_mo', 'limite_connexions', 'limite_appels_edge')),
  valeur numeric not null check (valeur > 0),
  modifie_le timestamptz not null default now()
);
alter table public.seuils_supervision enable row level security;
revoke all on table public.seuils_supervision from anon, authenticated;
-- Valeurs initiales : RGA22 (5 % sur 15 minutes), RGA24 (80 %) ; le reste est à valider et à ajuster selon l'offre Supabase en vigueur
insert into public.seuils_supervision (cle, valeur) values
  ('erreurs_pct', 5), ('p95_ms', 3000), ('saturation_pct', 80),
  ('limite_base_mo', 500), ('limite_stockage_mo', 1024), ('limite_connexions', 60), ('limite_appels_edge', 500000);

create function public.liste_seuils()
returns table (cle text, valeur numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.est_super_admin() then
    raise exception 'Action non autorisée.';
  end if;
  return query select s.cle, s.valeur from public.seuils_supervision s order by s.cle;
end;
$$;

create function public.definir_seuil(p_cle text, p_valeur numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ancien numeric;
begin
  if not public.est_super_admin() then
    raise exception 'Action non autorisée.';
  end if;
  if p_valeur is null or p_valeur <= 0 or (p_cle in ('erreurs_pct', 'saturation_pct') and p_valeur > 100) or p_valeur > 100000000 then
    raise exception 'Valeur invalide.';
  end if;
  select valeur into v_ancien from public.seuils_supervision where cle = p_cle;
  if not found then
    raise exception 'Seuil inconnu.';
  end if;
  update public.seuils_supervision set valeur = p_valeur, modifie_le = now() where cle = p_cle;
  perform public.journaliser('modification_seuil', 'seuil', p_cle, jsonb_build_object('ancien', v_ancien, 'nouveau', p_valeur));
end;
$$;

-- Les quatre tableaux. p_periode : '1h' (pas d'une minute), '24h' (une heure), '7j' (un jour).
create function public.supervision(p_periode text default '24h')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_intervalle interval := case p_periode when '1h' then interval '1 hour' when '7j' then interval '7 days' else interval '24 hours' end;
  v_pas text := case p_periode when '1h' then 'minute' when '7j' then 'day' else 'hour' end;
  v_depuis timestamptz := now() - v_intervalle;
  v_total integer;
  v_erreurs integer;
  v_base_mo numeric := round(pg_database_size(current_database()) / 1048576.0, 1);
  v_stockage_mo numeric;
  v_connexions integer;
  v_seuil record;
begin
  if not public.est_super_admin() then
    raise exception 'Action non autorisée.';
  end if;
  select count(*)::integer, count(*) filter (where not succes)::integer into v_total, v_erreurs from public.mesures where created_at >= v_depuis;
  select round(coalesce(sum((metadata ->> 'size')::bigint), 0) / 1048576.0, 1) into v_stockage_mo from storage.objects;
  select count(*)::integer into v_connexions from pg_stat_activity where datname = current_database();
  select
    max(valeur) filter (where cle = 'limite_base_mo') as base, max(valeur) filter (where cle = 'limite_stockage_mo') as stockage,
    max(valeur) filter (where cle = 'limite_connexions') as connexions, max(valeur) filter (where cle = 'limite_appels_edge') as edge,
    max(valeur) filter (where cle = 'saturation_pct') as alerte
  into v_seuil from public.seuils_supervision;

  return jsonb_build_object(
    'periode', p_periode,
    -- RGA21 : taux de requêtes (appels mesurés et pages vues) par pas de temps et par module
    'requetes', jsonb_build_object(
      'total', v_total,
      'pages_vues', (select count(*) from public.visites where created_at >= v_depuis),
      'par_pas', coalesce((
        select jsonb_agg(jsonb_build_object('t', t, 'requetes', n, 'pages_vues', pv) order by t)
        from (
          select g.t, coalesce(m.n, 0) as n, coalesce(v.n, 0) as pv
          from generate_series(date_trunc(v_pas, v_depuis), date_trunc(v_pas, now()), ('1 ' || v_pas)::interval) as g(t)
          left join (select date_trunc(v_pas, created_at) as t, count(*) as n from public.mesures where created_at >= v_depuis group by 1) m on m.t = g.t
          left join (select date_trunc(v_pas, created_at) as t, count(*) as n from public.visites where created_at >= v_depuis group by 1) v on v.t = g.t
        ) x), '[]'::jsonb),
      'par_module', coalesce((select jsonb_agg(jsonb_build_object('module', module, 'requetes', n) order by n desc, module)
                              from (select module, count(*) as n from public.mesures where created_at >= v_depuis group by module) a), '[]'::jsonb)
    ),
    -- RGA22 : taux d'erreurs global, par module, pages les plus en échec
    'erreurs', jsonb_build_object(
      'taux_global_pct', case when v_total = 0 then 0 else round(100.0 * v_erreurs / v_total, 2) end,
      'par_module', coalesce((select jsonb_agg(jsonb_build_object('module', module, 'requetes', n, 'erreurs', e, 'taux_pct', round(100.0 * e / n, 2)) order by e desc, module)
                              from (select module, count(*) as n, count(*) filter (where not succes) as e from public.mesures where created_at >= v_depuis group by module) a), '[]'::jsonb),
      'pages_en_echec', coalesce((select jsonb_agg(jsonb_build_object('page', page, 'occurrences', occurrences) order by occurrences desc)
                                  from (select page, sum(occurrences)::integer as occurrences from public.erreurs where derniere_vue >= v_depuis and page is not null group by page order by sum(occurrences) desc limit 10) p), '[]'::jsonb)
    ),
    -- RGA23 : temps de réponse P50, P95, P99 (percentile_cont)
    'latence', jsonb_build_object(
      'global', (select jsonb_build_object('p50', round(percentile_cont(0.50) within group (order by duree_ms)::numeric), 'p95', round(percentile_cont(0.95) within group (order by duree_ms)::numeric),
                                           'p99', round(percentile_cont(0.99) within group (order by duree_ms)::numeric)) from public.mesures where created_at >= v_depuis),
      'par_module', coalesce((select jsonb_agg(jsonb_build_object('module', module, 'p50', p50, 'p95', p95, 'p99', p99) order by p95 desc, module)
                              from (select module, round(percentile_cont(0.50) within group (order by duree_ms)::numeric) as p50, round(percentile_cont(0.95) within group (order by duree_ms)::numeric) as p95,
                                           round(percentile_cont(0.99) within group (order by duree_ms)::numeric) as p99
                                    from public.mesures where created_at >= v_depuis group by module) l), '[]'::jsonb)
    ),
    -- RGA24 : saturation comparée aux limites saisies (les appels aux Edge Functions ne sont pas mesurés par l'application)
    'saturation', jsonb_build_object(
      'base_mo', v_base_mo, 'limite_base_mo', v_seuil.base, 'base_pct', round(100 * v_base_mo / v_seuil.base, 1),
      'stockage_mo', v_stockage_mo, 'limite_stockage_mo', v_seuil.stockage, 'stockage_pct', round(100 * v_stockage_mo / v_seuil.stockage, 1),
      'connexions', v_connexions, 'limite_connexions', v_seuil.connexions, 'connexions_pct', round(100.0 * v_connexions / v_seuil.connexions, 1),
      'limite_appels_edge', v_seuil.edge, 'seuil_alerte_pct', v_seuil.alerte
    )
  );
end;
$$;

-- =====================================================================
-- Alertes de seuil : bandeau dans l'espace admin et notification aux super-admins
-- =====================================================================
create table public.alertes_supervision (
  type text primary key check (type in ('erreurs', 'latence', 'base', 'stockage', 'connexions')),
  active boolean not null default false,
  depuis timestamptz,
  valeur numeric,
  notifiee_le timestamptz
);
alter table public.alertes_supervision enable row level security;
revoke all on table public.alertes_supervision from anon, authenticated;
insert into public.alertes_supervision (type) values ('erreurs'), ('latence'), ('base'), ('stockage'), ('connexions');

create function public.evaluer_alerte(p_type text, p_valeur numeric, p_depasse boolean, p_titre text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.alertes_supervision;
  v_dest record;
begin
  select * into v_a from public.alertes_supervision where type = p_type for update;
  if p_depasse then
    update public.alertes_supervision
    set active = true, depuis = case when v_a.active then v_a.depuis else now() end, valeur = p_valeur,
        notifiee_le = case when not v_a.active or v_a.notifiee_le is null or v_a.notifiee_le < now() - interval '1 hour' then now() else v_a.notifiee_le end
    where type = p_type;
    if not v_a.active or v_a.notifiee_le is null or v_a.notifiee_le < now() - interval '1 hour' then
      -- RGA33 : aucune donnée personnelle dans la notification
      for v_dest in select id from public.profils where role = 'super_admin' and statut = 'actif' loop
        perform public.notifier(v_dest.id, 'alerte_supervision', p_titre, '/admin/supervision');
      end loop;
    end if;
  elsif v_a.active then
    update public.alertes_supervision set active = false, depuis = null, valeur = p_valeur where type = p_type;
  end if;
end;
$$;

-- Évalue les seuils sur les 15 dernières minutes (RGA22) et l'état de saturation (RGA24). Interne (pg_cron, toutes les 15 minutes).
create function public.verifier_seuils()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s record;
  v_n integer;
  v_e integer;
  v_p95 numeric;
  v_taux numeric;
  v_base numeric;
  v_stock numeric;
  v_conn integer;
begin
  select max(valeur) filter (where cle = 'erreurs_pct') as erreurs, max(valeur) filter (where cle = 'p95_ms') as p95,
         max(valeur) filter (where cle = 'saturation_pct') as sat, max(valeur) filter (where cle = 'limite_base_mo') as base,
         max(valeur) filter (where cle = 'limite_stockage_mo') as stockage, max(valeur) filter (where cle = 'limite_connexions') as connexions
  into v_s from public.seuils_supervision;

  select count(*)::integer, count(*) filter (where not succes)::integer, percentile_cont(0.95) within group (order by duree_ms)
  into v_n, v_e, v_p95 from public.mesures where created_at >= now() - interval '15 minutes';
  -- trop peu de mesures pour conclure : on ne déclenche rien
  v_taux := case when v_n >= 20 then 100.0 * v_e / v_n else 0 end;
  perform public.evaluer_alerte('erreurs', round(v_taux, 2), v_n >= 20 and v_taux > v_s.erreurs, 'Le taux d''erreurs de l''application dépasse le seuil.');
  perform public.evaluer_alerte('latence', round(coalesce(v_p95, 0)), v_n >= 20 and coalesce(v_p95, 0) > v_s.p95, 'Les temps de réponse (P95) dépassent le seuil.');

  v_base := pg_database_size(current_database()) / 1048576.0;
  select coalesce(sum((metadata ->> 'size')::bigint), 0) / 1048576.0 into v_stock from storage.objects;
  select count(*)::integer into v_conn from pg_stat_activity where datname = current_database();
  perform public.evaluer_alerte('base', round(100 * v_base / v_s.base, 1), 100 * v_base / v_s.base >= v_s.sat, 'La base de données approche la limite de l''offre gratuite.');
  perform public.evaluer_alerte('stockage', round(100 * v_stock / v_s.stockage, 1), 100 * v_stock / v_s.stockage >= v_s.sat, 'Le stockage de fichiers approche la limite de l''offre gratuite.');
  perform public.evaluer_alerte('connexions', round(100.0 * v_conn / v_s.connexions, 1), 100.0 * v_conn / v_s.connexions >= v_s.sat, 'Les connexions à la base approchent la limite.');
end;
$$;
select cron.schedule('a6-verifier-seuils', '*/15 * * * *', $$select public.verifier_seuils()$$);

-- Alertes en cours, pour le bandeau de l'espace super-admin
create function public.alertes_supervision_actives()
returns table (type text, depuis timestamptz, valeur numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.est_super_admin() then
    raise exception 'Action non autorisée.';
  end if;
  return query select a.type, a.depuis, a.valeur from public.alertes_supervision a where a.active order by a.depuis;
end;
$$;

-- =====================================================================
-- Droits : fonction -> rôles autorisés (RGP17)
-- =====================================================================
revoke execute on function
  public.liste_journal(uuid, text, text, date, date, integer, integer), public.filtres_journal(),
  public.enregistrer_erreur_detail(text, text, text, text, text, text, text), public.liste_erreurs(text, integer),
  public.changer_statut_erreur(bigint, text), public.purger_erreurs(), public.agreger_mesures(), public.liste_seuils(),
  public.definir_seuil(text, numeric), public.supervision(text), public.evaluer_alerte(text, numeric, boolean, text),
  public.verifier_seuils(), public.alertes_supervision_actives()
  from public, anon, authenticated;

-- Admin et super-admin (le corps limite l'admin à ses propres lignes)
grant execute on function public.liste_journal(uuid, text, text, date, date, integer, integer) to authenticated;
-- Super-admin seulement (le corps vérifie est_super_admin())
grant execute on function public.filtres_journal(), public.liste_erreurs(text, integer), public.changer_statut_erreur(bigint, text),
  public.liste_seuils(), public.definir_seuil(text, numeric), public.supervision(text), public.alertes_supervision_actives() to authenticated;
-- Mesure anonyme et limitée (quota par session, RGP20)
grant execute on function public.enregistrer_erreur_detail(text, text, text, text, text, text, text) to anon, authenticated;
-- Internes, sans GRANT : purger_erreurs, agreger_mesures, evaluer_alerte, verifier_seuils
