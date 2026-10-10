-- Promotion d'un compte en super-admin (RGA05, RGP24).
-- À exécuter à la main dans l'éditeur SQL du tableau de bord Supabase (rôle postgres),
-- jamais depuis l'application : un utilisateur ne peut pas changer son propre rôle.
--
-- Mode d'emploi :
--  1. La personne s'inscrit normalement dans l'application, puis confirme son e-mail.
--  2. Remplace l'adresse ci-dessous par la sienne et exécute le script.
--  3. Elle se reconnecte : l'espace admin lui demandera d'enregistrer son deuxième facteur (TOTP, module A2).
--
-- Premier super-admin : l'auteur du projet.
-- Second super-admin (RGP24) : [INFORMATION MANQUANTE : seconde personne]. Tant qu'elle n'existe pas,
-- enregistre deux facteurs TOTP sur deux appareils (voir docs/securite/acces-urgence.md).

do $$
declare
  v_email constant text := 'benjidev6@gmail.com'; -- À REMPLACER
  v_id uuid;
begin
  select id into v_id
  from auth.users
  where lower(email) = lower(v_email) and email_confirmed_at is not null;

  if v_id is null then
    raise exception 'Aucun compte confirmé avec cette adresse : la personne doit d''abord s''inscrire et confirmer son e-mail.';
  end if;

  update public.profils
  set role = 'super_admin', statut = 'actif'
  where id = v_id;

  raise notice 'Compte % promu super-admin.', v_id;
end;
$$;

-- Vérification : liste des super-admins actifs (il doit en rester au moins un, RGA03)
select p.id, p.prenom, p.role, p.statut
from public.profils p
where p.role = 'super_admin' and p.statut = 'actif';
