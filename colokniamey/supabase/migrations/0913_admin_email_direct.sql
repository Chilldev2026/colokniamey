-- 0913_admin_email_direct.sql
-- Module A2 : indique au super-admin si les e-mails peuvent partir directement de l'application (RGA31).
-- Le paramètre email_domaine_verifie n'est pas public : seule cette réponse (vrai ou faux) est exposée.

create function public.email_direct_actif()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.est_super_admin() then
    raise exception 'Action non autorisée.';
  end if;
  return coalesce((select (valeur #>> '{}')::boolean from public.parametres where cle = 'email_domaine_verifie'), false);
end;
$$;

revoke execute on function public.email_direct_actif() from public, anon, authenticated;
grant execute on function public.email_direct_actif() to authenticated; -- le corps exige est_super_admin()
