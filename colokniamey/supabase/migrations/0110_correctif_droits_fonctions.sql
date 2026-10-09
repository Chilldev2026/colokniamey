-- 0110_correctif_droits_fonctions.sql
-- Correctif de 0050 (RGP17). La CLI exécute les migrations avec un rôle temporaire
-- (cli_login_postgres) dont les privilèges par défaut ne sont pas ceux de « postgres » :
-- les fonctions créées par 0100 sont restées exécutables par PUBLIC, donc par anon.
-- On retire à nouveau le droit sur toutes les fonctions existantes, on règle les privilèges
-- par défaut du rôle courant, puis on redonne les GRANT explicites de 0100.

revoke execute on all functions in schema public from public, anon, authenticated;

alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;

-- GRANT explicites : fonction -> rôles autorisés (RGP17)
grant execute on function public.parametres_publics() to anon, authenticated;
grant execute on function public.en_maintenance() to anon, authenticated;
grant execute on function public.enregistrer_visite(text, text, text) to anon, authenticated;
grant execute on function public.enregistrer_erreur(text, text, text, text) to anon, authenticated;
grant execute on function public.enregistrer_mesures(jsonb, text) to anon, authenticated;
grant execute on function public.verifier_quota(text) to authenticated;
-- journaliser, notifier, consommer_quota, quota_anonyme, journal_audit_immuable : aucun GRANT
