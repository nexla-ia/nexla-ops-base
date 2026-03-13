/*
  ============================================================
  NEXLA OPS — FUNÇÕES, TRIGGERS E STORAGE
  ============================================================

  Complementa a migration 20260313000002_fix_all_rls_definitive.sql.
  Contém objetos aplicados manualmente no banco que precisam
  estar versionados nas migrations.

  Inclui:
  1. Trigger: preenche company_id a partir de apikey_instancia
  2. Funções de busca: atendente, theme_settings, transferências
  3. Função de mensagem de sistema (transferência)
  4. Função de populate de contatos
  5. Storage buckets e policies
  ============================================================
*/

BEGIN;

-- ============================================================
-- 1. TRIGGER — company_id automático via apikey_instancia
-- ============================================================
-- Quando uma mensagem entra sem company_id mas com apikey_instancia,
-- o trigger resolve o company_id buscando na tabela companies.
-- Essencial para webhooks da Evolution API e N8N.

CREATE OR REPLACE FUNCTION public.set_company_id_from_apikey()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.apikey_instancia IS NOT NULL
     AND (NEW.company_id IS NULL) THEN
    SELECT c.id
      INTO NEW.company_id
      FROM public.companies c
     WHERE c.api_key = NEW.apikey_instancia
     LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_set_company_id_from_apikey ON public.messages;
CREATE TRIGGER trg_messages_set_company_id_from_apikey
  BEFORE INSERT OR UPDATE OF apikey_instancia, company_id ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_id_from_apikey();

DROP TRIGGER IF EXISTS trg_sent_messages_set_company_id_from_apikey ON public.sent_messages;
CREATE TRIGGER trg_sent_messages_set_company_id_from_apikey
  BEFORE INSERT OR UPDATE OF apikey_instancia, company_id ON public.sent_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_company_id_from_apikey();

-- ============================================================
-- 2. FUNÇÃO — empresa do atendente logado
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_attendant_company()
RETURNS TABLE(
  id                        uuid,
  api_key                   text,
  name                      text,
  phone_number              text,
  email                     text,
  user_id                   uuid,
  is_super_admin            boolean,
  created_at                timestamptz,
  max_attendants            integer,
  payment_notification_day  integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.api_key,
    c.name,
    c.phone_number,
    c.email,
    c.user_id,
    c.is_super_admin,
    c.created_at,
    c.max_attendants,
    c.payment_notification_day
  FROM public.companies c
  INNER JOIN public.attendants a ON a.company_id = c.id
  WHERE a.user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_attendant_company() TO authenticated;

-- ============================================================
-- 3. FUNÇÃO — busca ou cria theme_settings da empresa
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_or_create_theme_settings(p_company_id uuid)
RETURNS public.theme_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.theme_settings;
BEGIN
  SELECT * INTO v_settings
    FROM public.theme_settings
   WHERE company_id = p_company_id;

  IF NOT FOUND THEN
    INSERT INTO public.theme_settings (company_id)
    VALUES (p_company_id)
    RETURNING * INTO v_settings;
  END IF;

  RETURN v_settings;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_theme_settings(uuid) TO authenticated;

-- ============================================================
-- 4. FUNÇÃO — mensagem de sistema ao transferir contato
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_test_system_message(
  p_company_id  uuid,
  p_contact_id  uuid,
  p_message     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.messages (
    company_id,
    contact_id,
    message_type,
    apikey_instancia,
    message,
    numero,
    sender,
    "minha?",
    created_at
  )
  VALUES (
    p_company_id,
    p_contact_id,
    'system_transfer',
    (SELECT api_key FROM public.companies WHERE id = p_company_id LIMIT 1),
    p_message,
    (SELECT phone_number FROM public.contacts WHERE id = p_contact_id LIMIT 1),
    'system',
    'true',
    now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_test_system_message(uuid, uuid, text) TO authenticated;

-- ============================================================
-- 5. FUNÇÕES — listagem de transferências (usadas pelo N8N e frontend)
-- ============================================================

CREATE OR REPLACE FUNCTION public.listar_transferencias(p_api_key varchar)
RETURNS TABLE(
  id                        bigint,
  api_key                   varchar,
  contact_id                uuid,
  phone_number              varchar,
  departamento_origem_id    uuid,
  departamento_origem_nome  varchar,
  departamento_destino_id   uuid,
  departamento_destino_nome varchar,
  data_transferencia        timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.api_key,
    t.contact_id,
    c.phone_number::varchar,
    t.departamento_origem_id,
    COALESCE(d_orig.name, 'Sem departamento')::varchar,
    t.departamento_destino_id,
    COALESCE(d_dest.name, 'Sem departamento')::varchar,
    t.data_transferencia
  FROM public.transferencias t
  LEFT JOIN public.contacts c ON t.contact_id = c.id
  LEFT JOIN public.departments d_orig ON t.departamento_origem_id = d_orig.id
  LEFT JOIN public.departments d_dest ON t.departamento_destino_id = d_dest.id
  WHERE t.api_key = p_api_key
  ORDER BY t.data_transferencia DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_transferencias(varchar) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_transferencias(varchar) TO anon;

-- ---

CREATE OR REPLACE FUNCTION public.listar_transferencias_contato(
  p_api_key      varchar,
  p_phone_number varchar
)
RETURNS TABLE(
  id                        bigint,
  api_key                   varchar,
  contact_id                uuid,
  phone_number              varchar,
  departamento_origem_id    uuid,
  departamento_origem_nome  varchar,
  departamento_destino_id   uuid,
  departamento_destino_nome varchar,
  data_transferencia        timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.api_key,
    t.contact_id,
    c.phone_number::varchar,
    t.departamento_origem_id,
    COALESCE(d_orig.name, 'Sem departamento')::varchar,
    t.departamento_destino_id,
    COALESCE(d_dest.name, 'Sem departamento')::varchar,
    t.data_transferencia
  FROM public.transferencias t
  LEFT JOIN public.contacts c ON t.contact_id = c.id
  LEFT JOIN public.departments d_orig ON t.departamento_origem_id = d_orig.id
  LEFT JOIN public.departments d_dest ON t.departamento_destino_id = d_dest.id
  WHERE t.api_key = p_api_key
    AND c.phone_number = p_phone_number
  ORDER BY t.data_transferencia DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.listar_transferencias_contato(varchar, varchar) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_transferencias_contato(varchar, varchar) TO anon;

-- ============================================================
-- 6. FUNÇÃO — popular contacts a partir de messages/sent_messages existentes
-- ============================================================

CREATE OR REPLACE FUNCTION public.populate_contacts_from_messages()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- A partir de messages
  INSERT INTO public.contacts (
    company_id, phone_number, numero, name, pushname,
    department_id, sector_id, tag_id,
    last_message, last_message_time, last_message_at, updated_at
  )
  SELECT DISTINCT ON (c.id, regexp_replace(COALESCE(m.numero, m.phone_number, ''), '\D', '', 'g'))
    c.id,
    regexp_replace(COALESCE(m.numero, m.phone_number, ''), '\D', '', 'g'),
    COALESCE(m.numero, m.phone_number),
    COALESCE(NULLIF(m.pushname, ''), COALESCE(m.numero, m.phone_number)),
    m.pushname,
    m.department_id,
    m.sector_id,
    m.tag_id,
    COALESCE(m.message, m.caption, ''),
    COALESCE(m.created_at, now()),
    COALESCE(m.created_at, now()),
    now()
  FROM public.messages m
  INNER JOIN public.companies c ON c.api_key = m.apikey_instancia
  WHERE COALESCE(m.numero, m.phone_number) IS NOT NULL
    AND regexp_replace(COALESCE(m.numero, m.phone_number, ''), '\D', '', 'g') <> ''
  ORDER BY c.id,
           regexp_replace(COALESCE(m.numero, m.phone_number, ''), '\D', '', 'g'),
           m.created_at DESC
  ON CONFLICT (company_id, phone_number)
  DO UPDATE SET
    numero        = COALESCE(EXCLUDED.numero,        public.contacts.numero),
    name          = COALESCE(EXCLUDED.name,          public.contacts.name),
    pushname      = COALESCE(EXCLUDED.pushname,      public.contacts.pushname),
    department_id = COALESCE(EXCLUDED.department_id, public.contacts.department_id),
    sector_id     = COALESCE(EXCLUDED.sector_id,     public.contacts.sector_id),
    tag_id        = COALESCE(EXCLUDED.tag_id,        public.contacts.tag_id),
    last_message      = EXCLUDED.last_message,
    last_message_time = EXCLUDED.last_message_time,
    last_message_at   = EXCLUDED.last_message_at,
    updated_at        = now();

  -- A partir de sent_messages
  INSERT INTO public.contacts (
    company_id, phone_number, numero, name, pushname,
    department_id, sector_id, tag_id,
    last_message, last_message_time, last_message_at, updated_at
  )
  SELECT DISTINCT ON (c.id, regexp_replace(COALESCE(sm.numero, ''), '\D', '', 'g'))
    c.id,
    regexp_replace(COALESCE(sm.numero, ''), '\D', '', 'g'),
    sm.numero,
    COALESCE(NULLIF(sm.pushname, ''), sm.numero),
    sm.pushname,
    sm.department_id,
    sm.sector_id,
    sm.tag_id,
    COALESCE(sm.message, sm.caption, ''),
    COALESCE(sm.created_at, now()),
    COALESCE(sm.created_at, now()),
    now()
  FROM public.sent_messages sm
  INNER JOIN public.companies c ON c.api_key = sm.apikey_instancia
  WHERE sm.numero IS NOT NULL
    AND regexp_replace(COALESCE(sm.numero, ''), '\D', '', 'g') <> ''
  ORDER BY c.id,
           regexp_replace(COALESCE(sm.numero, ''), '\D', '', 'g'),
           sm.created_at DESC
  ON CONFLICT (company_id, phone_number)
  DO UPDATE SET
    numero        = COALESCE(EXCLUDED.numero,        public.contacts.numero),
    name          = COALESCE(EXCLUDED.name,          public.contacts.name),
    pushname      = COALESCE(EXCLUDED.pushname,      public.contacts.pushname),
    department_id = COALESCE(EXCLUDED.department_id, public.contacts.department_id),
    sector_id     = COALESCE(EXCLUDED.sector_id,     public.contacts.sector_id),
    tag_id        = COALESCE(EXCLUDED.tag_id,        public.contacts.tag_id),
    last_message      = CASE
      WHEN EXCLUDED.last_message_time >= COALESCE(public.contacts.last_message_time, '-infinity'::timestamptz)
      THEN EXCLUDED.last_message
      ELSE public.contacts.last_message
    END,
    last_message_time = GREATEST(EXCLUDED.last_message_time, COALESCE(public.contacts.last_message_time, '-infinity'::timestamptz)),
    last_message_at   = GREATEST(EXCLUDED.last_message_at,   COALESCE(public.contacts.last_message_at,   '-infinity'::timestamptz)),
    updated_at        = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.populate_contacts_from_messages() TO authenticated;

-- ============================================================
-- 7. STORAGE — buckets e policies
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('company-branding', 'company-branding', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  -- chat-attachments: leitura
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated users can read chat attachments'
  ) THEN
    CREATE POLICY "Authenticated users can read chat attachments"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'chat-attachments');
  END IF;

  -- chat-attachments: upload
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload chat attachments'
  ) THEN
    CREATE POLICY "Authenticated users can upload chat attachments"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'chat-attachments');
  END IF;

  -- chat-attachments: delete
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated users can delete chat attachments'
  ) THEN
    CREATE POLICY "Authenticated users can delete chat attachments"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'chat-attachments');
  END IF;

  -- company-branding: leitura
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated users can read company branding'
  ) THEN
    CREATE POLICY "Authenticated users can read company branding"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'company-branding');
  END IF;

  -- company-branding: upload
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload company branding'
  ) THEN
    CREATE POLICY "Authenticated users can upload company branding"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'company-branding');
  END IF;

  -- company-branding: delete
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated users can delete company branding'
  ) THEN
    CREATE POLICY "Authenticated users can delete company branding"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'company-branding');
  END IF;
END $$;

COMMIT;
