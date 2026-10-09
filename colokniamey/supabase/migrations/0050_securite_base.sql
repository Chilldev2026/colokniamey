-- 0050_securite_base.sql
-- Durcissement de base (RGP17) : première migration du projet.
-- PostgreSQL rend toute fonction exécutable par tous (PUBLIC) par défaut.
-- On retire ce droit, puis chaque migration accorde un GRANT EXECUTE explicite,
-- fonction par fonction, au seul rôle qui en a besoin.

-- RGP17 : retirer l'exécution sur les fonctions déjà existantes du schéma public
revoke execute on all functions in schema public from public, anon, authenticated;

-- RGP17 : retirer l'exécution par défaut sur les fonctions créées plus tard
-- (pour le rôle qui exécute les migrations, et pour le rôle postgres de Supabase)
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
