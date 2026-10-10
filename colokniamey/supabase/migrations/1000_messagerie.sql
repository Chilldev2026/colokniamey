-- 1000_messagerie.sql
-- Module M6 : messagerie interne entre un utilisateur et l'auteur d'une annonce (RG19, RG32, RGA10, RGP20, RGP23).
--
-- Données personnelles (RGP01) : les messages sont CONFIDENTIELS. Seuls les deux participants les lisent. Aucun admin
-- n'y a accès (RGA10) : aucune politique admin n'existe sur ces tables ; le futur module de signalements (M7) exposera
-- uniquement les messages joints à un signalement, par une fonction dédiée.
-- Les textes passent par le contrôle de S en contexte « prive » : blocage seulement, jamais de mise en revue (RGA10).

-- =====================================================================
-- Tables
-- =====================================================================
create table public.conversations (
  id bigint generated always as identity primary key,
  -- l'annonce peut disparaître : la conversation reste lisible par les deux personnes
  annonce_id bigint references public.annonces (id) on delete set null,
  demandeur_id uuid not null references public.profils (id) on delete cascade,
  auteur_id uuid not null references public.profils (id) on delete cascade,
  created_at timestamptz not null default now(),
  dernier_message_le timestamptz not null default now(),
  constraint conversations_pas_soi_meme check (demandeur_id <> auteur_id) -- on ne s'écrit pas à soi-même
);
-- Une seule conversation par annonce et par demandeur (les lignes sans annonce ne sont pas concernées)
create unique index conversations_unique_idx on public.conversations (annonce_id, demandeur_id) where annonce_id is not null;
create index conversations_demandeur_idx on public.conversations (demandeur_id, dernier_message_le desc);
create index conversations_auteur_idx on public.conversations (auteur_id, dernier_message_le desc);

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id bigint not null references public.conversations (id) on delete cascade,
  expediteur_id uuid not null default auth.uid() references public.profils (id) on delete cascade,
  contenu text not null check (char_length(btrim(contenu)) between 1 and 2000),
  lu_le timestamptz,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at, id);
create index messages_non_lus_idx on public.messages (conversation_id) where lu_le is null;

-- RG45, RGA10 : blocage seulement (contexte « prive »), le terme détecté n'est jamais affiché
create trigger messages_2_texte before insert on public.messages
  for each row execute function public.controler_colonnes_texte('message', 'prive', 'expediteur_id', 'contenu');

-- Contrôles à l'envoi : expéditeur participant, quota (RGP20), destinataire notifié, conversation remontée
create function public.verifier_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.conversations;
  v_dest uuid;
begin
  select * into v_c from public.conversations where id = new.conversation_id;
  if not found or new.expediteur_id not in (v_c.demandeur_id, v_c.auteur_id) then
    raise exception 'Conversation introuvable.';
  end if;
  if (select auth.uid()) is not null then
    -- RGP20 : 20 messages par minute et 200 par jour
    perform public.verifier_quota('message');
  end if;
  v_dest := case when new.expediteur_id = v_c.demandeur_id then v_c.auteur_id else v_c.demandeur_id end;
  if not exists (select 1 from public.profils where id = v_dest and statut = 'actif') then
    raise exception 'Cette personne n''est plus joignable.';
  end if;
  new.lu_le := null;
  return new;
end;
$$;
create trigger messages_1_verif before insert on public.messages
  for each row execute function public.verifier_message();

-- Après l'envoi : la conversation remonte ; le destinataire est notifié une fois par série de messages non lus
-- (RGA33 voisin : la notification ne contient pas le texte du message)
create function public.apres_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.conversations;
  v_dest uuid;
begin
  select * into v_c from public.conversations where id = new.conversation_id;
  update public.conversations set dernier_message_le = new.created_at where id = new.conversation_id;
  v_dest := case when new.expediteur_id = v_c.demandeur_id then v_c.auteur_id else v_c.demandeur_id end;
  if not exists (
    select 1 from public.messages m
    where m.conversation_id = new.conversation_id and m.expediteur_id = new.expediteur_id and m.lu_le is null and m.id <> new.id
  ) then
    perform public.notifier(v_dest, 'nouveau_message', 'Tu as reçu un nouveau message.', '/messages/' || new.conversation_id::text);
  end if;
  return null;
end;
$$;
create trigger messages_3_apres after insert on public.messages
  for each row execute function public.apres_message();

-- =====================================================================
-- RLS : seuls les deux participants (RGA10 : aucune politique admin)
-- =====================================================================
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
revoke all on table public.conversations, public.messages from anon, authenticated;
grant select on public.conversations, public.messages to authenticated;
grant insert (conversation_id, contenu) on public.messages to authenticated;

create policy conversations_lecture on public.conversations for select to authenticated
  using ((select auth.uid()) in (demandeur_id, auteur_id));

create policy messages_lecture on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id and (select auth.uid()) in (c.demandeur_id, c.auteur_id)));
create policy messages_envoi on public.messages for insert to authenticated
  with check (
    expediteur_id = (select auth.uid()) and public.peut_ecrire()
    and exists (select 1 from public.conversations c where c.id = conversation_id and (select auth.uid()) in (c.demandeur_id, c.auteur_id))
  );

-- RGP23 : changements de la table diffusés en temps réel, filtrés par la RLS (un tiers n'en reçoit aucun).
-- Aucun canal public ; aucun canal broadcast ou presence n'est utilisé par ce module.
alter publication supabase_realtime add table public.messages;

-- =====================================================================
-- Fonctions
-- =====================================================================

-- RG19 : contacter l'auteur d'une annonce publiée. Crée la conversation (ou reprend l'existante) et envoie le
-- premier message. 20 nouvelles conversations par jour (RGP20).
create function public.demarrer_conversation(p_annonce_id bigint, p_message text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_a public.annonces;
  v_id bigint;
begin
  if not public.peut_ecrire() then
    raise exception 'Action impossible pour le moment.';
  end if;
  select * into v_a from public.annonces a
  where a.id = p_annonce_id and a.statut = 'publiee' and not a.en_revue and public.auteur_actif(a.auteur_id);
  if not found then
    raise exception 'Cette annonce n''est plus disponible.';
  end if;
  if v_a.auteur_id = v_uid then
    raise exception 'Tu ne peux pas t''écrire à toi-même.';
  end if;

  select id into v_id from public.conversations where annonce_id = p_annonce_id and demandeur_id = v_uid;
  if v_id is null then
    perform public.verifier_quota('nouvelle_conversation');
    insert into public.conversations (annonce_id, demandeur_id, auteur_id) values (p_annonce_id, v_uid, v_a.auteur_id) returning id into v_id;
  end if;
  -- le message passe par les mêmes déclencheurs que tout message (texte, quota, notification)
  insert into public.messages (conversation_id, expediteur_id, contenu) values (v_id, v_uid, p_message);
  return v_id;
end;
$$;

-- Conversation d'une annonce déjà ouverte par la personne connectée, ou null
create function public.ma_conversation_annonce(p_annonce_id bigint)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.conversations where annonce_id = p_annonce_id and demandeur_id = (select auth.uid());
$$;

-- Liste de mes conversations : l'autre personne (prénom et initiale seulement), l'annonce si elle est encore visible,
-- le nombre de messages non lus. Du plus récent au plus ancien.
create function public.liste_conversations()
returns table (
  id bigint, annonce_id bigint, annonce_titre text, autre_id uuid, autre_prenom text, autre_initiale text,
  dernier_message_le timestamptz, non_lus integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not public.est_actif() then
    raise exception 'Connexion requise.';
  end if;
  return query
    select c.id, c.annonce_id,
           (select a.titre from public.annonces a where a.id = c.annonce_id and (a.statut = 'publiee' and not a.en_revue or a.auteur_id = v_uid)),
           o.id, case when o.statut = 'actif' then o.prenom else 'Ancien membre' end, case when o.statut = 'actif' then upper(left(o.nom, 1)) else '' end,
           c.dernier_message_le,
           (select count(*)::integer from public.messages m where m.conversation_id = c.id and m.expediteur_id <> v_uid and m.lu_le is null)
    from public.conversations c
    join public.profils o on o.id = case when c.demandeur_id = v_uid then c.auteur_id else c.demandeur_id end
    where v_uid in (c.demandeur_id, c.auteur_id)
    order by c.dernier_message_le desc, c.id desc
    limit 100;
end;
$$;

-- Marque comme lus les messages reçus d'une conversation dont je suis participant
create function public.marquer_lu(p_conversation_id bigint)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_nb integer;
begin
  if not public.est_actif() then
    raise exception 'Connexion requise.';
  end if;
  if not exists (select 1 from public.conversations c where c.id = p_conversation_id and v_uid in (c.demandeur_id, c.auteur_id)) then
    raise exception 'Conversation introuvable.';
  end if;
  update public.messages set lu_le = now() where conversation_id = p_conversation_id and expediteur_id <> v_uid and lu_le is null;
  get diagnostics v_nb = row_count;
  return v_nb;
end;
$$;

-- Nombre total de messages non lus (pastille du menu)
create function public.mes_messages_non_lus()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.messages m join public.conversations c on c.id = m.conversation_id
  where (select auth.uid()) in (c.demandeur_id, c.auteur_id) and m.expediteur_id <> (select auth.uid()) and m.lu_le is null;
$$;

-- RGP11 : export des données (conversations dont la personne est participante, messages compris)
create function public.exporter_donnees_messagerie(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('conversations', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'annonce_id', c.annonce_id, 'cree_le', c.created_at,
      'messages', coalesce((select jsonb_agg(jsonb_build_object('de_moi', m.expediteur_id = p_uid, 'contenu', m.contenu, 'envoye_le', m.created_at, 'lu_le', m.lu_le) order by m.created_at, m.id)
                            from public.messages m where m.conversation_id = c.id), '[]'::jsonb)
    ) order by c.id)
    from public.conversations c where p_uid in (c.demandeur_id, c.auteur_id)
  ), '[]'::jsonb));
$$;

-- =====================================================================
-- Droits : fonction -> rôles autorisés (RGP17)
-- =====================================================================
revoke execute on function
  public.verifier_message(), public.apres_message(), public.demarrer_conversation(bigint, text),
  public.ma_conversation_annonce(bigint), public.liste_conversations(), public.marquer_lu(bigint),
  public.mes_messages_non_lus(), public.exporter_donnees_messagerie(uuid)
  from public, anon, authenticated;

grant execute on function public.demarrer_conversation(bigint, text) to authenticated;
grant execute on function public.ma_conversation_annonce(bigint) to authenticated;
grant execute on function public.liste_conversations() to authenticated;
grant execute on function public.marquer_lu(bigint) to authenticated;
grant execute on function public.mes_messages_non_lus() to authenticated;
-- Internes, sans GRANT : verifier_message, apres_message, exporter_donnees_messagerie

insert into public.limites (action, fenetre_secondes, maximum, portee) values
  ('message', 60, 20, 'utilisateur'),
  ('message', 86400, 200, 'utilisateur'),
  ('nouvelle_conversation', 86400, 20, 'utilisateur') -- RGP20
on conflict do nothing;
