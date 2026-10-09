-- 0210_correctif_zone_ville.sql
-- Correctif de 0200 :
--  1. le déclencheur lisait new.quartier_id aussi sur la table quartiers, qui n'a pas ce champ ;
--     on sépare maintenant clairement les deux cas.
--  2. les privilèges par défaut ne s'appliquent pas à chaque migration (voir 0110) :
--     on retire explicitement l'exécution à PUBLIC, anon et authenticated (RGP17).

create or replace function public.verifier_zone_ville()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ville public.villes;
  v_point extensions.geography;
begin
  select * into v_ville from public.villes where id = new.ville_id;

  if tg_table_name = 'quartiers' then
    v_point := new.centre;
  else
    v_point := new.position;
  end if;

  -- RG22 : hors de la zone (centre + rayon_km), le point est refusé
  if v_point is not null
     and extensions.st_distance(v_point, v_ville.centre) > v_ville.rayon_km * 1000 then
    raise exception 'Ce point est en dehors de la zone de la ville.';
  end if;

  -- RG07 : le quartier d'une université doit être dans la même ville
  if tg_table_name = 'universites' then
    if new.quartier_id is not null and not exists (
      select 1 from public.quartiers where id = new.quartier_id and ville_id = new.ville_id
    ) then
      raise exception 'Le quartier choisi n''appartient pas à la ville de l''université.';
    end if;
  end if;

  return new;
end;
$$;

-- RGP17 : fonction de déclencheur, jamais appelée directement par l'API
revoke execute on function public.verifier_zone_ville() from public, anon, authenticated;
