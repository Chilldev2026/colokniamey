-- 0911_admin_planification.sql
-- Module A2 : tâches planifiées (pg_cron) et récapitulatif quotidien (pg_net → Edge Function).
-- Séparée de 0910 pour que la logique métier ne dépende pas de la disponibilité des extensions.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- RGA29, RGA34 : alertes des files, fin des suspensions, purge des sessions admin. Toutes les 15 minutes.
select cron.schedule('a2-taches-15-min', '*/15 * * * *', $$select public.taches_planifiees()$$);

-- RGA30 : appel de l'Edge Function admin-recapitulatif. L'adresse du projet et le secret partagé sont dans
-- Supabase Vault (cron_url, cron_secret), jamais dans le code ni dans Git. Sans eux, la fonction ne fait rien.
-- Interne : aucun GRANT.
create function public.declencher_recapitulatif()
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
    url := v_url || '/functions/v1/admin-recapitulatif',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb
  );
end;
$$;

revoke execute on function public.declencher_recapitulatif() from public, anon, authenticated;

-- 7 h UTC = 8 h à Niamey
select cron.schedule('a2-recapitulatif-quotidien', '0 7 * * *', $$select public.declencher_recapitulatif()$$);
