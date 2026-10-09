-- 0971_correctif_annonces.sql
-- Corrections de M4 (0970), trouvées en préparant la modération (A3) :
--  1. un admin doit pouvoir refuser ou retirer l'annonce d'un auteur dont le compte est suspendu ou désactivé :
--     le déclencheur ne vérifie donc plus que l'auteur est « actif » (la RLS exige déjà peut_ecrire() pour écrire) ;
--  2. les annonces d'un compte suspendu ou désactivé ne sont plus visibles du public (RG08, RGA09).
-- Les droits d'exécution sont conservés par CREATE OR REPLACE.

create or replace function public.verifier_annonce()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.role_utilisateur;
  v_ville public.villes;
  v_validation boolean;
  v_neutre_new jsonb;
  v_neutre_old jsonb;
begin
  -- RG13 : un étudiant publie une place en colocation, un propriétaire un logement
  select role into v_role from public.profils where id = new.auteur_id;
  if v_role is null or v_role not in ('etudiant', 'proprietaire') then
    raise exception 'Seuls les étudiants et les propriétaires publient des annonces.';
  end if;
  if v_role = 'etudiant' and new.type <> 'place_colocation' then
    raise exception 'Un étudiant publie une place en colocation, pas un logement entier.';
  end if;
  if v_role = 'proprietaire' and new.type = 'place_colocation' then
    raise exception 'Un propriétaire publie un logement (chambre, studio ou appartement), pas une place en colocation.';
  end if;

  if tg_op = 'INSERT' then
    if (select auth.uid()) is not null then
      perform public.verifier_quota('creer_annonce'); -- RGP20
    end if;
    if (select count(*) from public.annonces where auteur_id = new.auteur_id and statut <> 'archivee') >= 30 then
      raise exception 'Tu as atteint le maximum de 30 annonces. Archive-en une avant d''en créer une nouvelle.';
    end if;
  elsif new.auteur_id <> old.auteur_id then
    raise exception 'L''auteur d''une annonce ne peut pas changer.';
  end if;

  -- RG22 : le point doit se trouver dans la zone de la ville du quartier
  select v.* into v_ville from public.villes v join public.quartiers q on q.ville_id = v.id where q.id = new.quartier_id;
  if new.position is not null and extensions.st_distance(new.position, v_ville.centre) > v_ville.rayon_km * 1000 then
    raise exception 'Cette position est en dehors de la zone de la ville.';
  end if;
  if new.universite_proche_id is not null
     and not exists (select 1 from public.universites u where u.id = new.universite_proche_id and u.ville_id = v_ville.id) then
    raise exception 'L''université choisie n''est pas dans la ville du logement.';
  end if;

  -- RG21 : pas de soumission sans position
  if new.statut in ('en_attente', 'publiee') and new.position is null then
    raise exception 'Place ton logement sur la carte avant de soumettre l''annonce.';
  end if;

  -- RG23 : position montrée au public
  if new.position is null then
    new.position_publique := null;
  elsif new.precision_position = 'exacte' then
    new.position_publique := new.position;
  else
    new.position_publique := extensions.st_snaptogrid(new.position::extensions.geometry, 0.0015)::extensions.geography;
  end if;

  -- RG17 : toute modification d'une annonce publiée la renvoie en attente de validation (si le paramètre l'exige)
  if tg_op = 'UPDATE' and new.statut = old.statut then
    v_neutre_new := to_jsonb(new) - array['statut', 'motif_refus', 'en_revue', 'position_publique', 'publiee_le', 'updated_at'];
    v_neutre_old := to_jsonb(old) - array['statut', 'motif_refus', 'en_revue', 'position_publique', 'publiee_le', 'updated_at'];
    if v_neutre_new is distinct from v_neutre_old then
      select coalesce((select (valeur #>> '{}')::boolean from public.parametres where cle = 'validation_annonces'), true) into v_validation;
      if old.statut = 'publiee' and v_validation then
        new.statut := 'en_attente';
      elsif old.statut = 'refusee' then
        new.statut := 'brouillon';
        new.motif_refus := null;
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- Le compte de l'auteur est actif (vrai sinon faux). Appelée par la politique de lecture publique : la fonction
-- ne renvoie qu'un booléen et est donc accessible aux visiteurs.
create function public.auteur_actif(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profils where id = p_uid and statut = 'actif');
$$;
revoke execute on function public.auteur_actif(uuid) from public, anon, authenticated;
grant execute on function public.auteur_actif(uuid) to anon, authenticated;

drop policy annonces_lecture_publique on public.annonces;
create policy annonces_lecture_publique on public.annonces for select to anon, authenticated
  using (statut = 'publiee' and not en_revue and public.auteur_actif(auteur_id));

create or replace function public.photos_annonce(p_annonce_id bigint)
returns table (ordre integer, chemin text)
language sql
stable
security definer
set search_path = ''
as $$
  select pa.ordre, p.chemin
  from public.photos_annonces pa
  join public.photos p on p.id = pa.photo_id and p.statut = 'validee'
  join public.annonces a on a.id = pa.annonce_id
  where pa.annonce_id = p_annonce_id and a.statut = 'publiee' and not a.en_revue and public.auteur_actif(a.auteur_id)
  order by pa.ordre, pa.id;
$$;

create or replace function public.contact_annonce(p_annonce_id bigint)
returns table (telephone text, whatsapp text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.annonces;
  v_numero text;
begin
  if not public.est_actif() then
    raise exception 'Connecte-toi pour contacter l''annonceur.';
  end if;
  perform public.verifier_quota('contact_annonce');
  select * into v_a from public.annonces a
  where a.id = p_annonce_id
    and ((a.statut = 'publiee' and not a.en_revue and public.auteur_actif(a.auteur_id)) or a.auteur_id = (select auth.uid()));
  if not found then
    raise exception 'Annonce introuvable.';
  end if;
  select regexp_replace(p.telephone, '[^0-9]', '', 'g') into v_numero from public.profils p where p.id = v_a.auteur_id;
  if length(v_numero) = 8 then
    v_numero := '227' || v_numero;
  end if;
  telephone := case when v_a.contact_appel then '+' || v_numero end;
  whatsapp := case when v_a.contact_whatsapp then v_numero end;
  return next;
end;
$$;
