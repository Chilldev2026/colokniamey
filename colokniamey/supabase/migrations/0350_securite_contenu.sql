-- 0350_securite_contenu.sql
-- Module S : sécurité du contenu (textes et photos). RG45 à RG50, RGP17, RGP20, RGP21.
--
-- Mode d'emploi pour les modules suivants (annonces, groupes, messages, profils…) :
--   1. la table porte une colonne  en_revue boolean not null default false  (sauf messages privés) ;
--   2. on pose le déclencheur :
--        create trigger <table>_controle_texte
--          before insert or update on public.<table>
--          for each row execute function public.controler_colonnes_texte(
--            '<type de contenu>', 'public', '<colonne de l''auteur>', '<colonne texte 1>', '<colonne texte 2>');
--   3. messages privés (RGA10) : contexte 'prive' à la place de 'public' → blocage seulement, jamais de revue ;
--   4. la lecture publique de la table exclut les lignes en_revue (politique RLS du module).
-- Toute photo passe par le composant EnvoiPhoto (jamais d'envoi direct vers Storage).
--
-- Données personnelles (RGP01) : violations et contenus_en_revue gardent l'identifiant de l'auteur
-- (nécessaire à la modération) mais jamais le texte détecté ; photos garde le chemin du fichier et
-- l'empreinte perceptuelle (dHash), nécessaire à la détection des images déjà refusées (RG50).

create extension if not exists unaccent with schema extensions;

-- =====================================================================
-- Textes
-- =====================================================================

-- RG46 : texte normalisé avant comparaison.
-- Minuscules, sans accents, chiffres et symboles remplacés par les lettres qu'ils imitent,
-- ponctuation et espaces insérés dans un mot retirés (« s.a.l.o.p.e » → « salope »),
-- lettres répétées réduites à une seule. Le chiffre 1 imite « i » (variante 0) ou « l » (variante 1).
create function public.normaliser_texte(p_texte text, p_variante integer default 0)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  t text := lower(extensions.unaccent(coalesce(p_texte, '')));
begin
  t := translate(t, '0345789@$€!|', 'oeastbgaseil');
  t := replace(t, '1', case when p_variante = 1 then 'l' else 'i' end);
  -- tout ce qui n'est pas une lettre devient un espace
  t := regexp_replace(t, '[^a-z]+', ' ', 'g');
  -- une suite de lettres isolées est recollée : « s a l o p e » → « salope »
  t := regexp_replace(t, '\m([a-z]) (?=[a-z]( |$))', '\1', 'g');
  -- lettres répétées : « saaalope » → « salope »
  t := regexp_replace(t, '([a-z])\1+', '\1', 'g');
  return btrim(regexp_replace(t, ' +', ' ', 'g'));
end;
$$;

-- RG46 : liste gérée dans A3 (l'admin propose, le super_admin valide, RGA28).
create table public.termes_sensibles (
  id bigint generated always as identity primary key,
  terme text not null check (char_length(terme) between 3 and 80), -- stocké normalisé
  categorie text not null check (categorie in ('sexuel', 'haine', 'terrorisme', 'violence', 'menace')),
  niveau text not null check (niveau in ('revue', 'blocage')),
  langue text not null default 'fr' check (char_length(langue) <= 10),
  actif boolean not null default true,
  -- RGA28 : un terme proposé par un admin reste inactif tant qu'un super_admin ne l'a pas validé
  valide boolean not null default false,
  propose_par uuid references auth.users (id) on delete set null,
  valide_par uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (terme, categorie)
);

create function public.normaliser_terme()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.terme := public.normaliser_texte(new.terme, 0);
  if char_length(new.terme) < 3 then
    raise exception 'Le terme est trop court après normalisation.';
  end if;
  return new;
end;
$$;

create trigger termes_sensibles_normalisation
  before insert or update of terme on public.termes_sensibles
  for each row execute function public.normaliser_terme();

-- RG45 : état de la vérification, sans jamais renvoyer la liste des termes.
create type public.resultat_verification as (issue text, categories text[]);

-- Trois issues : accepte, revue, bloque. Interne : aucun GRANT (le client ne doit pas pouvoir sonder la liste).
-- p_contexte = 'prive' (messages privés, RGA10) : seuls les termes de niveau blocage comptent.
create function public.verifier_texte(p_texte text, p_contexte text default 'public')
returns public.resultat_verification
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_n0 text := public.normaliser_texte(p_texte, 0);
  v_n1 text := public.normaliser_texte(p_texte, 1);
  v_c0 text := replace(v_n0, ' ', '');
  v_c1 text := replace(v_n1, ' ', '');
  v_terme record;
  v_compact text;
  v_cats text[] := '{}';
  v_bloque boolean := false;
  v_revue boolean := false;
begin
  if v_n0 = '' then
    return row('accepte', '{}'::text[]);
  end if;

  for v_terme in
    select terme, categorie, niveau from public.termes_sensibles
    where actif and valide and (p_contexte <> 'prive' or niveau = 'blocage')
  loop
    v_compact := replace(v_terme.terme, ' ', '');
    if v_n0 ~ ('\m' || v_terme.terme || '(s|x)?\M')
       or v_n1 ~ ('\m' || v_terme.terme || '(s|x)?\M')
       -- les termes longs sont aussi cherchés sans espaces (« sal ope » collé ou coupé)
       or (char_length(v_compact) >= 7 and (position(v_compact in v_c0) > 0 or position(v_compact in v_c1) > 0))
    then
      v_cats := array_append(v_cats, v_terme.categorie);
      if v_terme.niveau = 'blocage' then v_bloque := true; else v_revue := true; end if;
    end if;
  end loop;

  select coalesce(array_agg(distinct c order by c), '{}') into v_cats from unnest(v_cats) as c;
  return row(case when v_bloque then 'bloque' when v_revue then 'revue' else 'accepte' end, v_cats);
end;
$$;

-- RG45 : contenus masqués en attente de la décision d'un admin (A3 ajoutera ses politiques).
create table public.contenus_en_revue (
  id bigint generated always as identity primary key,
  type_contenu text not null check (char_length(type_contenu) <= 50),
  contenu_id text not null check (char_length(contenu_id) <= 80),
  auteur_id uuid references auth.users (id) on delete set null,
  raison text not null check (char_length(raison) <= 200),
  categories text[] not null default '{}',
  statut text not null default 'en_attente' check (statut in ('en_attente', 'valide', 'refuse')),
  decide_par uuid references auth.users (id) on delete set null,
  motif text check (char_length(motif) <= 300),
  created_at timestamptz not null default now(),
  decide_le timestamptz
);
create index contenus_en_revue_file_idx on public.contenus_en_revue (statut, created_at);
create unique index contenus_en_revue_unique_attente
  on public.contenus_en_revue (type_contenu, contenu_id) where statut = 'en_attente';

-- RG47 : chaque blocage est journalisé.
create table public.violations (
  id bigint generated always as identity primary key,
  auteur_id uuid not null references auth.users (id) on delete cascade,
  categories text[] not null default '{}',
  contexte text not null check (contexte in ('public', 'prive')),
  created_at timestamptz not null default now()
);
create index violations_auteur_idx on public.violations (auteur_id, created_at);

alter table public.termes_sensibles enable row level security;
alter table public.contenus_en_revue enable row level security;
alter table public.violations enable row level security;
revoke all on table public.termes_sensibles, public.contenus_en_revue, public.violations from anon, authenticated;

-- Modèle de déclencheur BEFORE INSERT OR UPDATE (voir le mode d'emploi en tête de fichier).
-- Arguments : type de contenu, contexte, colonne de l'auteur, puis les colonnes de texte à contrôler.
create function public.controler_colonnes_texte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := tg_argv[0];
  v_contexte text := tg_argv[1];
  v_col_auteur text := tg_argv[2];
  v_nouveau jsonb := to_jsonb(new);
  v_ancien jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_texte text;
  v_res public.resultat_verification;
  v_cats text[] := '{}';
  v_revue boolean := false;
  i integer;
begin
  for i in 3 .. tg_nargs - 1 loop
    v_texte := v_nouveau ->> tg_argv[i];
    -- un texte vide ou inchangé n'est pas revérifié
    continue when v_texte is null or v_texte = '' or v_texte is not distinct from (v_ancien ->> tg_argv[i]);

    v_res := public.verifier_texte(v_texte, v_contexte);
    if v_res.issue = 'bloque' then
      -- RG45 : message en français qui n'affiche jamais le terme détecté
      raise exception 'Ce texte ne respecte pas les règles de ColokNiamey. Modifie-le et réessaie.';
    elsif v_res.issue = 'revue' and v_contexte <> 'prive' then
      v_revue := true;
      v_cats := v_cats || v_res.categories;
    end if;
  end loop;

  if v_revue then
    if not (v_nouveau ? 'en_revue') then
      raise exception 'La table % doit avoir une colonne en_revue pour utiliser ce contrôle.', tg_table_name;
    end if;
    -- le contenu est enregistré mais masqué
    new := jsonb_populate_record(new, jsonb_build_object('en_revue', true));
    insert into public.contenus_en_revue (type_contenu, contenu_id, auteur_id, raison, categories)
    select v_type, v_nouveau ->> 'id',
           coalesce((v_nouveau ->> v_col_auteur)::uuid, auth.uid()),
           'Terme sensible détecté',
           (select coalesce(array_agg(distinct c order by c), '{}') from unnest(v_cats) as c)
    on conflict (type_contenu, contenu_id) where statut = 'en_attente' do nothing;
  end if;

  return new;
end;
$$;

-- Contrôle à l'écriture du formulaire : dit si le texte passerait, et journalise un blocage (RG47).
-- Le déclencheur reste la vraie protection ; il ne peut pas journaliser lui-même, car son exception
-- annule la transaction entière, journal compris. Les services appellent donc cette fonction
-- avant d'enregistrer, et après un refus du déclencheur.
create function public.controler_texte(p_texte text, p_contexte text default 'public')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_res public.resultat_verification;
  v_nb integer;
  v_admin record;
begin
  if not public.est_actif() then
    raise exception 'Connexion requise.';
  end if;
  if p_contexte not in ('public', 'prive') or char_length(coalesce(p_texte, '')) > 20000 then
    raise exception 'Requête invalide.';
  end if;
  perform public.verifier_quota('controle_texte');

  v_res := public.verifier_texte(p_texte, p_contexte);
  if v_res.issue = 'bloque' then
    insert into public.violations (auteur_id, categories, contexte) values (v_uid, v_res.categories, p_contexte);
    perform public.journaliser('contenu_bloque', 'utilisateur', v_uid::text, jsonb_build_object('categories', v_res.categories));

    -- RG47 : alerte aux admins au-delà de 3 blocages en 30 jours (puis tous les 3 blocages)
    select count(*) into v_nb from public.violations
    where auteur_id = v_uid and created_at > now() - interval '30 days';
    if v_nb >= 3 and v_nb % 3 = 0 then
      for v_admin in select id from public.profils where role in ('admin', 'super_admin') and statut = 'actif' loop
        -- RGA33 : aucune donnée personnelle dans la notification
        perform public.notifier(v_admin.id, 'alerte_contenu', 'Un compte a atteint 3 contenus bloqués en 30 jours.', '/admin/moderation');
      end loop;
    end if;
  end if;
  return v_res.issue;
end;
$$;

-- =====================================================================
-- Photos
-- =====================================================================
create table public.photos (
  id bigint generated always as identity primary key,
  proprietaire_id uuid not null references public.profils (id) on delete cascade,
  usage text not null check (usage in ('avatar', 'annonce')),
  chemin text not null unique check (chemin ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.(webp|jpg|jpeg|png)$'),
  empreinte text not null check (empreinte ~ '^[0-9a-f]{16}$'), -- dHash 64 bits (RG50)
  statut text not null default 'en_attente' check (statut in ('en_attente', 'validee', 'refusee')),
  suspecte boolean not null default false, -- RG50 : déjà utilisée par un autre auteur
  motif text check (char_length(motif) <= 300),
  decide_par uuid references auth.users (id) on delete set null,
  decide_le timestamptz,
  created_at timestamptz not null default now()
);
create index photos_proprietaire_idx on public.photos (proprietaire_id, statut);
create index photos_statut_idx on public.photos (statut, created_at);

alter table public.photos enable row level security;
revoke all on table public.photos from anon, authenticated;
grant select on public.photos to authenticated;
-- RG10 : chacun voit ses propres photos (A3 ajoutera la lecture admin). Aucune écriture directe :
-- tout passe par enregistrer_photo() et decider_photo().
create policy photos_lecture_propre on public.photos for select to authenticated
  using (proprietaire_id = (select auth.uid()));

-- Distance de Hamming entre deux empreintes hexadécimales
create function public.distance_empreintes(p_a text, p_b text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select bit_count((('x' || p_a)::bit(64)) # (('x' || p_b)::bit(64)));
$$;

-- RG50 : bloque une photo déjà refusée ; renvoie vrai si elle est déjà utilisée par un autre auteur.
-- Tolérance de 4 bits sur 64 : une image légèrement recadrée ou recompressée garde la même empreinte.
-- Interne : aucun GRANT.
create function public.verifier_empreinte(p_empreinte text, p_auteur uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_empreinte is null or p_empreinte !~ '^[0-9a-f]{16}$' then
    raise exception 'Empreinte d''image invalide.';
  end if;
  if exists (
    select 1 from public.photos
    where statut = 'refusee' and public.distance_empreintes(empreinte, p_empreinte) <= 4
  ) then
    raise exception 'Cette image a déjà été refusée par la modération.';
  end if;
  return exists (
    select 1 from public.photos
    where proprietaire_id <> p_auteur and statut in ('en_attente', 'validee')
      and public.distance_empreintes(empreinte, p_empreinte) <= 4
  );
end;
$$;

-- Contrôle avant l'envoi du fichier : évite de téléverser une image déjà refusée.
create function public.precontroler_photo(p_empreinte text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.peut_ecrire() then
    raise exception 'Action impossible pour le moment.';
  end if;
  perform public.verifier_quota('controle_texte');
  perform public.verifier_empreinte(p_empreinte, auth.uid());
end;
$$;

-- RGP20 : 30 envois de photos par jour. Appelée par la politique Storage, donc même un envoi
-- direct par l'API Storage est compté.
create function public.quota_envoi_photo()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.verifier_quota('envoi_photo');
  return true;
end;
$$;

-- Buckets (RGP21) : taille et types fixés côté serveur. Les photos sont ré-encodées en WebP
-- par le navigateur, mais le serveur accepte aussi jpeg et png.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('photos_en_attente', 'photos_en_attente', false, 3145728, array['image/jpeg', 'image/png', 'image/webp']),
  ('photos_publiques', 'photos_publiques', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- RGP21 : écriture limitée au dossier <user_id>/ de l'auteur, dans photos_en_attente seulement.
-- Aucune politique d'écriture sur photos_publiques : seule l'Edge Function photos-decision y écrit.
create policy photos_attente_depot on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos_en_attente'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) = 1
    and public.peut_ecrire()
    and public.quota_envoi_photo()
  );
create policy photos_attente_lecture_propre on storage.objects for select to authenticated
  using (
    bucket_id = 'photos_en_attente'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Enregistre la photo envoyée dans Storage (le fichier existe déjà dans photos_en_attente).
create function public.enregistrer_photo(p_chemin text, p_usage text, p_empreinte text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_suspecte boolean;
  v_id bigint;
begin
  if not public.peut_ecrire() then
    raise exception 'Action impossible pour le moment.';
  end if;
  if p_usage not in ('avatar', 'annonce') then
    raise exception 'Usage de photo invalide.';
  end if;
  -- le chemin doit être dans le dossier de l'appelant
  if p_chemin is null or p_chemin not like (v_uid::text || '/%') then
    raise exception 'Chemin de photo invalide.';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'photos_en_attente' and name = p_chemin) then
    raise exception 'Le fichier n''a pas été trouvé. Réessaie l''envoi.';
  end if;
  -- limite de photos en attente par personne, contre l'encombrement de la file de modération
  if (select count(*) from public.photos where proprietaire_id = v_uid and statut = 'en_attente') >= 20 then
    raise exception 'Tu as déjà beaucoup de photos en attente de validation. Patiente un peu.';
  end if;

  v_suspecte := public.verifier_empreinte(p_empreinte, v_uid);

  insert into public.photos (proprietaire_id, usage, chemin, empreinte, suspecte)
  values (v_uid, p_usage, p_chemin, p_empreinte, v_suspecte)
  returning id into v_id;
  return v_id;
end;
$$;

-- RG49 : décision d'un admin (aal2 vérifié par est_admin()). Appelée par l'Edge Function photos-decision,
-- qui déplace ensuite le fichier. Journalise (RGA06) et notifie l'auteur.
create function public.decider_photo(p_photo_id bigint, p_decision text, p_motif text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_photo public.photos;
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
begin
  if not public.est_admin() then
    raise exception 'Action non autorisée.';
  end if;
  if p_decision not in ('valider', 'refuser') then
    raise exception 'Décision invalide.';
  end if;
  if p_decision = 'refuser' and (v_motif is null or char_length(v_motif) > 300) then
    raise exception 'Un motif de refus est obligatoire (300 caractères au plus).';
  end if;

  select * into v_photo from public.photos where id = p_photo_id and statut = 'en_attente' for update;
  if not found then
    raise exception 'Photo introuvable ou déjà traitée.';
  end if;
  -- RGA02 : un admin ne valide pas sa propre photo
  if v_photo.proprietaire_id = auth.uid() then
    raise exception 'Tu ne peux pas décider de ta propre photo.';
  end if;

  update public.photos
  set statut = case p_decision when 'valider' then 'validee' else 'refusee' end,
      motif = case p_decision when 'refuser' then v_motif else null end,
      decide_par = auth.uid(),
      decide_le = now()
  where id = p_photo_id;

  perform public.journaliser('photo_' || p_decision, 'photo', p_photo_id::text, jsonb_build_object('usage', v_photo.usage));
  perform public.notifier(
    v_photo.proprietaire_id, 'photo_decision',
    case p_decision when 'valider' then 'Ta photo a été validée.' else 'Ta photo a été refusée : ' || v_motif end,
    null
  );
  return v_photo.chemin;
end;
$$;

-- =====================================================================
-- Droits : fonction -> rôles autorisés (RGP17)
-- =====================================================================
-- La CLI exécute les migrations avec un rôle dont les droits par défaut diffèrent (voir 0110) :
-- on retire donc explicitement le droit public sur chaque nouvelle fonction.
revoke execute on function
  public.normaliser_texte(text, integer), public.normaliser_terme(),
  public.verifier_texte(text, text), public.controler_colonnes_texte(),
  public.controler_texte(text, text), public.distance_empreintes(text, text),
  public.verifier_empreinte(text, uuid), public.precontroler_photo(text),
  public.quota_envoi_photo(), public.enregistrer_photo(text, text, text),
  public.decider_photo(bigint, text, text)
  from public, anon, authenticated;

grant execute on function public.controler_texte(text, text) to authenticated;
grant execute on function public.precontroler_photo(text) to authenticated;
grant execute on function public.quota_envoi_photo() to authenticated; -- appelée par la politique Storage
grant execute on function public.enregistrer_photo(text, text, text) to authenticated;
grant execute on function public.decider_photo(bigint, text, text) to authenticated; -- réservée aux admins aal2 dans le corps
-- Internes, sans GRANT : normaliser_texte, normaliser_terme, verifier_texte, controler_colonnes_texte,
-- distance_empreintes, verifier_empreinte

-- =====================================================================
-- Paramètres et limites
-- =====================================================================
insert into public.parametres (cle, valeur, publique) values
  ('photo_taille_max_mo', '10', true),   -- taille maximale d'un fichier avant ré-encodage
  ('photo_dimension_min', '400', true),  -- côté le plus court, en pixels
  ('nsfw_seuil', '0.7', true)            -- [À VALIDER] seuil de refus immédiat de l'analyse nsfwjs
on conflict (cle) do nothing;

insert into public.limites (action, fenetre_secondes, maximum, portee) values
  ('controle_texte', 60, 60, 'utilisateur'),
  ('controle_texte', 86400, 500, 'utilisateur')
on conflict do nothing;

-- =====================================================================
-- Termes initiaux (RG46) : liste courte en français, à compléter (langues locales fournies par l'auteur).
-- Les termes sont normalisés à l'insertion. « revue » = contenu masqué en attendant un admin ;
-- « blocage » = refus immédiat. Validés d'office (valide = true) : c'est la liste de départ.
-- =====================================================================
insert into public.termes_sensibles (terme, categorie, niveau, valide) values
  -- sexuel
  ('pornographie', 'sexuel', 'blocage', true),
  ('porno', 'sexuel', 'blocage', true),
  ('pedophile', 'sexuel', 'blocage', true),
  ('pedopornographie', 'sexuel', 'blocage', true),
  ('prostitution', 'sexuel', 'blocage', true),
  ('prostituee', 'sexuel', 'blocage', true),
  ('escort girl', 'sexuel', 'blocage', true),
  ('plan cul', 'sexuel', 'blocage', true),
  ('sexto', 'sexuel', 'revue', true),
  ('erotique', 'sexuel', 'revue', true),
  ('rencontre coquine', 'sexuel', 'revue', true),
  ('nudes', 'sexuel', 'revue', true),
  -- haine ou racisme
  ('sale negre', 'haine', 'blocage', true),
  ('sale noir', 'haine', 'blocage', true),
  ('sale blanc', 'haine', 'blocage', true),
  ('sale arabe', 'haine', 'blocage', true),
  ('sale juif', 'haine', 'blocage', true),
  ('sale race', 'haine', 'blocage', true),
  ('sale etranger', 'haine', 'blocage', true),
  ('sale touareg', 'haine', 'blocage', true),
  ('sale peul', 'haine', 'blocage', true),
  ('sale zarma', 'haine', 'blocage', true),
  ('sale haoussa', 'haine', 'blocage', true),
  ('bougnoule', 'haine', 'blocage', true),
  ('youpin', 'haine', 'blocage', true),
  ('bamboula', 'haine', 'blocage', true),
  ('negro', 'haine', 'blocage', true),
  ('negre', 'haine', 'revue', true),
  ('salope', 'haine', 'revue', true),
  ('pute', 'haine', 'revue', true),
  ('racaille', 'haine', 'revue', true),
  -- terrorisme
  ('boko haram', 'terrorisme', 'blocage', true),
  ('daech', 'terrorisme', 'blocage', true),
  ('al qaida', 'terrorisme', 'blocage', true),
  ('etat islamique', 'terrorisme', 'blocage', true),
  ('rejoindre le jihad', 'terrorisme', 'blocage', true),
  ('terroriste', 'terrorisme', 'revue', true),
  ('jihadiste', 'terrorisme', 'revue', true),
  ('attentat', 'terrorisme', 'revue', true),
  ('kamikaze', 'terrorisme', 'revue', true),
  -- violence
  ('violer', 'violence', 'blocage', true),
  ('egorger', 'violence', 'blocage', true),
  ('tuer', 'violence', 'revue', true),
  ('assassiner', 'violence', 'revue', true),
  ('massacre', 'violence', 'revue', true),
  ('poignarder', 'violence', 'revue', true),
  ('torturer', 'violence', 'revue', true),
  -- menace
  ('je vais te tuer', 'menace', 'blocage', true),
  ('on va te tuer', 'menace', 'blocage', true),
  ('tu vas mourir', 'menace', 'blocage', true),
  ('je vais te violer', 'menace', 'blocage', true),
  ('mort a toi', 'menace', 'blocage', true),
  ('je vais te frapper', 'menace', 'revue', true),
  ('je te retrouverai', 'menace', 'revue', true)
on conflict (terme, categorie) do nothing;
