-- Audit de sécurité de la base (F1, RGP04, RGP17, RGP18, RGP21). À exécuter après toutes les migrations.
-- Il ÉCHOUE si :
--  - une table du schéma public n'a pas de RLS (RGP04) ;
--  - une vue n'est pas en security_invoker (RGP18) ;
--  - une fonction est exécutable par un visiteur ou un connecté sans figurer dans les listes autorisées ci-dessous (RGP17) ;
--  - une fonction SECURITY DEFINER n'a pas de search_path fixé (convention) ;
--  - un visiteur peut écrire dans une table, ou lire une table qui n'est pas publique (RGP04) ;
--  - un bucket n'a pas de limite de taille ni de types autorisés, ou kyc_prives est public (RGP21).
-- Quand une nouvelle fonction doit être appelable, l'ajouter ICI en connaissance de cause (revue de sécurité).

begin;

do $$
declare
  -- Fonctions appelables par les visiteurs ET les connectés : données publiques ou mesures anonymes limitées
  v_publiques constant text[] := array[
    'annonces_carte', 'auteur_actif', 'compter_groupes_annonces', 'compter_groupes_en_formation',
    'en_maintenance', 'enregistrer_erreur', 'enregistrer_erreur_detail', 'enregistrer_mesures', 'enregistrer_visite',
    'est_etudiant', 'filtrer_annonces', 'identite_verifiee', 'parametres_publics',
    'photo_principale_annonce', 'photos_annonce', 'profil_public', 'rechercher_annonces'
  ];
  -- Fonctions appelables par les connectés seulement (le corps de chacune vérifie le rôle, l'identité ou la participation)
  v_connectes constant text[] := array[
    'accepter_cgu', 'annonce_a_moderer', 'annuler_kyc', 'archiver_annonce', 'autoriser_consultation_kyc',
    'cloturer_signalement', 'consentir_kyc', 'contact_annonce', 'contenu_a_verifier', 'controler_texte',
    'creer_groupe', 'decider_contenu', 'decider_kyc', 'decider_photo', 'definir_maintenance',
    'definir_preferences_admin', 'definir_terme_actif', 'demander_adhesion', 'demarrer_conversation', 'demarrer_kyc',
    'desactiver_mon_compte', 'dossier_kyc_admin', 'email_direct_actif', 'enregistrer_photo', 'est_actif',
    'est_admin', 'est_initiateur_groupe', 'est_super_admin', 'etat_files_admin', 'exporter_mes_donnees',
    'fiche_signalement', 'fiche_utilisateur', 'groupes_du_logement', 'liste_administrateurs', 'liste_annonces_a_valider',
    'liste_contenus_a_verifier', 'liste_conversations', 'liste_dossiers_kyc', 'liste_parametres', 'liste_photos_a_valider',
    'liste_recidives', 'liste_relances', 'liste_signalements', 'liste_termes', 'liste_utilisateurs',
    'ma_conversation_annonce', 'marquer_lu', 'marquer_relance_vue', 'membres_du_groupe', 'mes_favoris',
    'mes_groupes', 'mes_messages_non_lus', 'mes_preferences_admin', 'mes_relances_non_vues', 'modifier_parametre',
    'modifier_terme', 'mon_avatar', 'mon_kyc', 'peut_ecrire', 'peut_voir_groupe',
    'position_annonce', 'precontroler_photo', 'prendre_en_charge_signalement', 'proposer_terme', 'quitter_groupe',
    'quota_envoi_photo', 'refuser_annonce', 'rejeter_terme', 'relacher_signalement', 'relancer_admin',
    'repondre_demande', 'retirer_annonce', 'rouvrir_annonce', 'signalement_ouvert', 'signaler',
    'signaler_activite_admin', 'soumettre_annonce', 'soumettre_kyc', 'valider_annonce', 'valider_terme',
    'verifier_quota',
    -- A1 (statistiques) et A6 (audit, erreurs, supervision) : réservées aux admins ou au super-admin, vérifié dans le corps
    'stats_utilisateurs', 'stats_annonces', 'stats_visites', 'stats_moderation', 'stats_erreurs', 'liste_journal', 'filtres_journal',
    'liste_erreurs', 'changer_statut_erreur', 'liste_seuils', 'definir_seuil', 'supervision', 'alertes_supervision_actives'
  ];
  -- Tables et vues lisibles par un visiteur (référentiel et annonces publiées, filtrées par la RLS)
  v_tables_publiques constant text[] := array[
    'annonce_equipements', 'annonces', 'equipements', 'quartiers', 'regles_annonce', 'taches_annonce', 'universites', 'villes',
    'annonces_publiques', 'quartiers_geo', 'universites_geo', 'villes_geo'
  ];
  v_rec record;
  v_nb integer;
  v_nom regclass;
begin
  -- RGP04 : RLS sur 100 % des tables
  for v_rec in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
               where c.relkind in ('r', 'p') and not c.relrowsecurity loop
    raise exception 'ÉCHEC RGP04 : la table % n''a pas de RLS', v_rec.relname;
  end loop;

  -- RGP18 : toute vue en security_invoker
  for v_rec in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
               where c.relkind = 'v' and coalesce(c.reloptions::text, '') not like '%security_invoker=true%' loop
    raise exception 'ÉCHEC RGP18 : la vue % n''est pas en security_invoker', v_rec.relname;
  end loop;

  -- RGP17 : aucune fonction exposée hors des listes
  for v_rec in
    select p.proname, bool_or(has_function_privilege('anon', p.oid, 'execute')) as anon
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
    where p.prokind = 'f' and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
    group by p.proname
  loop
    if v_rec.anon and not (v_rec.proname = any (v_publiques)) then
      raise exception 'ÉCHEC RGP17 : la fonction % est exécutable par un visiteur sans être autorisée', v_rec.proname;
    elsif not (v_rec.proname = any (v_publiques) or v_rec.proname = any (v_connectes)) then
      raise exception 'ÉCHEC RGP17 : la fonction % est exécutable par un connecté sans être autorisée', v_rec.proname;
    end if;
  end loop;
  -- le droit public par défaut est bien retiré : PUBLIC n'exécute aucune fonction de public
  select count(*) into v_nb from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
  where p.prokind = 'f' and exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0 and a.privilege_type = 'EXECUTE');
  if v_nb > 0 then raise exception 'ÉCHEC RGP17 : % fonction(s) exécutable(s) par PUBLIC', v_nb; end if;

  -- Convention : SECURITY DEFINER avec search_path fixé
  for v_rec in select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
               where p.prosecdef and not coalesce(p.proconfig::text, '') like '%search_path=%' loop
    raise exception 'ÉCHEC : la fonction SECURITY DEFINER % n''a pas de search_path fixé', v_rec.proname;
  end loop;

  -- RGP04 : un visiteur ne lit que les tables publiques, et n'écrit nulle part
  for v_rec in select c.oid, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public' where c.relkind in ('r', 'v', 'p') loop
    v_nom := v_rec.oid::regclass;
    if has_any_column_privilege('anon', v_nom, 'select') and not (v_rec.relname = any (v_tables_publiques)) then
      raise exception 'ÉCHEC RGP04 : un visiteur peut lire %', v_rec.relname;
    end if;
    if has_any_column_privilege('anon', v_nom, 'insert') or has_any_column_privilege('anon', v_nom, 'update') or has_table_privilege('anon', v_nom, 'delete') then
      raise exception 'ÉCHEC RGP04 : un visiteur peut écrire dans %', v_rec.relname;
    end if;
  end loop;

  -- RG23 : la position exacte d'une annonce n'est lisible par personne
  if has_column_privilege('anon', 'public.annonces', 'position', 'select') or has_column_privilege('authenticated', 'public.annonces', 'position', 'select') then
    raise exception 'ÉCHEC RG23 : la colonne position est lisible';
  end if;

  -- RGP21 : buckets avec limite de taille et types autorisés ; kyc_prives et photos_en_attente privés
  for v_rec in select id, public, file_size_limit, allowed_mime_types from storage.buckets loop
    if v_rec.file_size_limit is null or v_rec.allowed_mime_types is null then
      raise exception 'ÉCHEC RGP21 : le bucket % n''a pas de limite de taille ou de types', v_rec.id;
    end if;
    if v_rec.id in ('kyc_prives', 'photos_en_attente') and v_rec.public then
      raise exception 'ÉCHEC RGP21 : le bucket % est public', v_rec.id;
    end if;
  end loop;
  -- aucune politique d'écriture d'utilisateur sur les buckets alimentés par Edge Function
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd in ('INSERT', 'UPDATE', 'ALL')
             and (coalesce(with_check, '') like '%photos_publiques%' or coalesce(with_check, '') like '%kyc_prives%' or coalesce(qual, '') like '%kyc_prives%')) then
    raise exception 'ÉCHEC RGP21 : une politique d''écriture existe sur photos_publiques ou kyc_prives';
  end if;

  raise notice 'OK RGP04, RGP17, RGP18, RGP21 : audit de sécurité';
end;
$$;

rollback;
