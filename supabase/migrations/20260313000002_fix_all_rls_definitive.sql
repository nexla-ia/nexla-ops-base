/*
  ============================================================
  NEXLA OPS — RLS DEFINITIVO
  ============================================================

  Quem acessa o quê:

  ┌─────────────────┬──────────────────────────────────────────────────────┐
  │ Role            │ Acesso                                               │
  ├─────────────────┼──────────────────────────────────────────────────────┤
  │ service_role    │ TUDO (edge functions: criar/editar/deletar)          │
  │ super_admin     │ TUDO via authenticated                               │
  │ company         │ Lê/edita próprios dados e dos atendentes             │
  │ attendant       │ Lê/edita dados da própria empresa                    │
  │ anon + api_key  │ Leitura geral + escrita em contacts/messages/        │
  │                 │ departments/sent_messages/notifications/              │
  │                 │ transferencias (N8N / Evolution API / webhooks)      │
  └─────────────────┴──────────────────────────────────────────────────────┘

  Esta migration:
  1. Remove TODOS os policies antigos de cada tabela
  2. Recria de forma limpa e definitiva
  3. Garante que as edge functions funcionem via service_role
  4. Garante que o N8N possa criar/atualizar todos os recursos necessários
  ============================================================
*/

-- ============================================================
-- HELPERS
-- ============================================================

-- Verifica se o usuário logado é super_admin
-- SECURITY DEFINER: essencial para evitar recursão infinita quando
-- esta função é chamada a partir de policies da própria tabela super_admins.
-- auth.uid() lê request.jwt.claims (variável de sessão) — funciona mesmo
-- dentro de funções SECURITY DEFINER.
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins
    WHERE user_id = auth.uid()
  );
$$;

-- Retorna true se o usuário é dono da empresa (company.user_id = auth.uid())
CREATE OR REPLACE FUNCTION is_company_owner(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = p_company_id AND user_id = auth.uid()
  );
$$;

-- Retorna o company_id do atendente logado
CREATE OR REPLACE FUNCTION get_attendant_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.attendants
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- Retorna o company_id da empresa cujo api_key está no header da request
-- Usado para acesso N8N/integrações (anon + header x-api-key ou apikey)
CREATE OR REPLACE FUNCTION get_company_id_from_api_key_header()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM companies
  WHERE api_key = COALESCE(
    current_setting('request.headers', true)::json->>'x-api-key',
    current_setting('request.headers', true)::json->>'apikey'
  )
  LIMIT 1;
$$;

-- ============================================================
-- Macro para dropar TODOS os policies de uma tabela
-- Usamos EXECUTE dinâmico para evitar erro se policy não existir
-- ============================================================

DO $$
DECLARE
  tbl  text;
  pol  text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'super_admins','plans','companies','attendants','departments',
    'sectors','tags','contacts','messages','sent_messages',
    'notifications','transferencias','theme_settings','system_settings',
    'contact_tags','message_tags'
  ])
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = tbl
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol, tbl);
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- RLS habilitado em todas as tabelas principais
-- ============================================================
ALTER TABLE super_admins   ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sectors        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags           ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE transferencias ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='theme_settings')
  THEN ALTER TABLE theme_settings ENABLE ROW LEVEL SECURITY; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='system_settings')
  THEN ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='contact_tags')
  THEN ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='message_tags')
  THEN ALTER TABLE message_tags ENABLE ROW LEVEL SECURITY; END IF;
END $$;

-- ============================================================
-- SUPER_ADMINS
-- ============================================================

CREATE POLICY "sr_super_admins" ON super_admins
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Qualquer usuário autenticado lê o próprio registro (usado no pré-check do frontend)
CREATE POLICY "auth_read_own_super_admin" ON super_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Super admin gerencia a lista de super admins (is_super_admin é SECURITY DEFINER,
-- não causa recursão — consulta a tabela bypassando RLS)
CREATE POLICY "auth_superadmin_manage" ON super_admins
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ============================================================
-- PLANS
-- ============================================================

CREATE POLICY "sr_plans" ON plans
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "auth_superadmin_manage_plans" ON plans
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "auth_read_active_plans" ON plans
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "anon_read_active_plans" ON plans
  FOR SELECT TO anon
  USING (is_active = true AND get_company_id_from_api_key_header() IS NOT NULL);

-- ============================================================
-- COMPANIES
-- ============================================================

-- service_role: acesso total — edge function create-company usa este caminho.
-- service_role bypassa RLS automaticamente no Supabase.
CREATE POLICY "sr_companies" ON companies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- super_admin SELECT: subquery direta (sem chamar is_super_admin()) para garantir
-- que loadCompanies() no SuperAdminDashboard sempre retorne dados corretamente.
-- A policy auth_read_own_super_admin em super_admins já permite que o usuário
-- leia o próprio registro, então o EXISTS aqui funciona sem precisar de SECURITY DEFINER.
CREATE POLICY "auth_superadmin_select_companies" ON companies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE user_id = auth.uid()
    )
  );

-- super_admin INSERT: permite criar empresa direto (fallback além da edge function)
CREATE POLICY "auth_superadmin_insert_companies" ON companies
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE user_id = auth.uid()
    )
  );

-- super_admin UPDATE: handleUpdateCompany() no dashboard usa este caminho diretamente
CREATE POLICY "auth_superadmin_update_companies" ON companies
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE user_id = auth.uid()
    )
  );

-- super_admin DELETE
CREATE POLICY "auth_superadmin_delete_companies" ON companies
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE user_id = auth.uid()
    )
  );

-- company: lê próprios dados
CREATE POLICY "auth_company_read_own" ON companies
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- company: edita próprios dados (nome, telefone, etc.)
CREATE POLICY "auth_company_update_own" ON companies
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- N8N: lê dados da empresa pelo api_key no header
CREATE POLICY "anon_read_company_by_api_key" ON companies
  FOR SELECT TO anon
  USING (
    api_key = COALESCE(
      current_setting('request.headers', true)::json->>'x-api-key',
      current_setting('request.headers', true)::json->>'apikey'
    )
  );

-- ============================================================
-- ATTENDANTS
-- ============================================================

CREATE POLICY "sr_attendants" ON attendants
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "auth_superadmin_manage_attendants" ON attendants
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "auth_company_read_attendants" ON attendants
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "auth_company_insert_attendants" ON attendants
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "auth_company_update_attendants" ON attendants
  FOR UPDATE TO authenticated
  USING  (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "auth_company_delete_attendants" ON attendants
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "auth_attendant_read_self" ON attendants
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE POLICY "auth_attendant_update_self" ON attendants
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- N8N: leitura e atualização de status via api_key
CREATE POLICY "anon_read_attendants" ON attendants
  FOR SELECT TO anon USING (company_id = get_company_id_from_api_key_header());

CREATE POLICY "anon_update_attendants" ON attendants
  FOR UPDATE TO anon
  USING  (company_id = get_company_id_from_api_key_header())
  WITH CHECK (company_id = get_company_id_from_api_key_header());

-- ============================================================
-- DEPARTMENTS
-- ============================================================

CREATE POLICY "sr_departments" ON departments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "auth_superadmin_manage_departments" ON departments
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "auth_company_crud_departments" ON departments
  FOR ALL TO authenticated
  USING  (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "auth_attendant_read_departments" ON departments
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())));

-- N8N: lê, cria e atualiza departamentos via api_key
CREATE POLICY "anon_read_departments" ON departments
  FOR SELECT TO anon USING (company_id = get_company_id_from_api_key_header());

CREATE POLICY "anon_insert_departments" ON departments
  FOR INSERT TO anon
  WITH CHECK (company_id = get_company_id_from_api_key_header());

CREATE POLICY "anon_update_departments" ON departments
  FOR UPDATE TO anon
  USING  (company_id = get_company_id_from_api_key_header())
  WITH CHECK (company_id = get_company_id_from_api_key_header());

-- ============================================================
-- SECTORS
-- ============================================================

CREATE POLICY "sr_sectors" ON sectors
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "auth_superadmin_manage_sectors" ON sectors
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "auth_company_crud_sectors" ON sectors
  FOR ALL TO authenticated
  USING  (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "auth_attendant_read_sectors" ON sectors
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())));

-- N8N: lê, cria e atualiza setores via api_key
CREATE POLICY "anon_read_sectors" ON sectors
  FOR SELECT TO anon USING (company_id = get_company_id_from_api_key_header());

CREATE POLICY "anon_insert_sectors" ON sectors
  FOR INSERT TO anon
  WITH CHECK (company_id = get_company_id_from_api_key_header());

CREATE POLICY "anon_update_sectors" ON sectors
  FOR UPDATE TO anon
  USING  (company_id = get_company_id_from_api_key_header())
  WITH CHECK (company_id = get_company_id_from_api_key_header());

-- ============================================================
-- TAGS
-- ============================================================

CREATE POLICY "sr_tags" ON tags
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "auth_superadmin_manage_tags" ON tags
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "auth_company_crud_tags" ON tags
  FOR ALL TO authenticated
  USING  (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "auth_attendant_read_tags" ON tags
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())));

-- N8N: lê e cria tags via api_key
CREATE POLICY "anon_read_tags" ON tags
  FOR SELECT TO anon USING (company_id = get_company_id_from_api_key_header());

CREATE POLICY "anon_insert_tags" ON tags
  FOR INSERT TO anon
  WITH CHECK (company_id = get_company_id_from_api_key_header());

-- ============================================================
-- CONTACTS
-- ============================================================

CREATE POLICY "sr_contacts" ON contacts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "auth_superadmin_manage_contacts" ON contacts
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "auth_company_crud_contacts" ON contacts
  FOR ALL TO authenticated
  USING  (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "auth_attendant_read_contacts" ON contacts
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "auth_attendant_update_contacts" ON contacts
  FOR UPDATE TO authenticated
  USING  (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())));

-- N8N: lê, cria e atualiza contatos via api_key (nova conversa, update de dados do cliente)
CREATE POLICY "anon_read_contacts" ON contacts
  FOR SELECT TO anon USING (company_id = get_company_id_from_api_key_header());

CREATE POLICY "anon_insert_contacts" ON contacts
  FOR INSERT TO anon
  WITH CHECK (company_id = get_company_id_from_api_key_header());

CREATE POLICY "anon_update_contacts" ON contacts
  FOR UPDATE TO anon
  USING  (company_id = get_company_id_from_api_key_header())
  WITH CHECK (company_id = get_company_id_from_api_key_header());

-- ============================================================
-- MESSAGES
-- ============================================================

CREATE POLICY "sr_messages" ON messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "auth_superadmin_manage_messages" ON messages
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "auth_company_crud_messages" ON messages
  FOR ALL TO authenticated
  USING  (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "auth_attendant_crud_messages" ON messages
  FOR ALL TO authenticated
  USING  (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())));

-- webhook (Evolution API, N8N) pode inserir mensagens sem autenticação
CREATE POLICY "anon_insert_messages" ON messages
  FOR INSERT TO anon WITH CHECK (true);

-- N8N lê e atualiza status das mensagens via api_key
CREATE POLICY "anon_read_messages" ON messages
  FOR SELECT TO anon USING (company_id = get_company_id_from_api_key_header());

CREATE POLICY "anon_update_messages" ON messages
  FOR UPDATE TO anon
  USING  (company_id = get_company_id_from_api_key_header())
  WITH CHECK (company_id = get_company_id_from_api_key_header());

-- ============================================================
-- SENT_MESSAGES
-- ============================================================

CREATE POLICY "sr_sent_messages" ON sent_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "auth_superadmin_manage_sent_messages" ON sent_messages
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "auth_company_crud_sent_messages" ON sent_messages
  FOR ALL TO authenticated
  USING  (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "auth_attendant_crud_sent_messages" ON sent_messages
  FOR ALL TO authenticated
  USING  (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())));

-- N8N: lê e registra mensagens enviadas via api_key
CREATE POLICY "anon_read_sent_messages" ON sent_messages
  FOR SELECT TO anon USING (company_id = get_company_id_from_api_key_header());

CREATE POLICY "anon_insert_sent_messages" ON sent_messages
  FOR INSERT TO anon
  WITH CHECK (company_id = get_company_id_from_api_key_header());

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE POLICY "sr_notifications" ON notifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "auth_superadmin_manage_notifications" ON notifications
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "auth_company_read_notifications" ON notifications
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "auth_company_update_notifications" ON notifications
  FOR UPDATE TO authenticated
  USING  (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

-- N8N: lê e cria notificações via api_key
CREATE POLICY "anon_read_notifications" ON notifications
  FOR SELECT TO anon USING (company_id = get_company_id_from_api_key_header());

CREATE POLICY "anon_insert_notifications" ON notifications
  FOR INSERT TO anon
  WITH CHECK (company_id = get_company_id_from_api_key_header());

-- ============================================================
-- TRANSFERENCIAS
-- ============================================================

CREATE POLICY "sr_transferencias" ON transferencias
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "auth_superadmin_manage_transferencias" ON transferencias
  FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "auth_company_crud_transferencias" ON transferencias
  FOR ALL TO authenticated
  USING  (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "auth_attendant_crud_transferencias" ON transferencias
  FOR ALL TO authenticated
  USING  (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())));

-- N8N: lê e cria transferências via api_key
CREATE POLICY "anon_read_transferencias" ON transferencias
  FOR SELECT TO anon USING (company_id = get_company_id_from_api_key_header());

CREATE POLICY "anon_insert_transferencias" ON transferencias
  FOR INSERT TO anon
  WITH CHECK (company_id = get_company_id_from_api_key_header());

-- ============================================================
-- THEME_SETTINGS (se existir)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='theme_settings') THEN
    EXECUTE 'CREATE POLICY "sr_theme_settings" ON theme_settings FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "auth_superadmin_theme" ON theme_settings FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin())';
    EXECUTE 'CREATE POLICY "auth_company_crud_theme" ON theme_settings FOR ALL TO authenticated USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid()))) WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())))';
    EXECUTE 'CREATE POLICY "auth_attendant_read_theme" ON theme_settings FOR SELECT TO authenticated USING (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())))';
    EXECUTE 'CREATE POLICY "anon_read_theme" ON theme_settings FOR SELECT TO anon USING (company_id = get_company_id_from_api_key_header())';
  END IF;
END $$;

-- ============================================================
-- SYSTEM_SETTINGS (se existir)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='system_settings') THEN
    EXECUTE 'CREATE POLICY "sr_system_settings" ON system_settings FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "auth_superadmin_system" ON system_settings FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin())';
    EXECUTE 'CREATE POLICY "auth_read_system_settings" ON system_settings FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

-- ============================================================
-- CONTACT_TAGS (se existir)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='contact_tags') THEN
    EXECUTE 'CREATE POLICY "sr_contact_tags" ON contact_tags FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "auth_superadmin_contact_tags" ON contact_tags FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin())';
    EXECUTE $p$
      CREATE POLICY "auth_company_attendant_contact_tags" ON contact_tags FOR ALL TO authenticated
      USING (
        contact_id IN (
          SELECT id FROM contacts
          WHERE company_id IN (
            SELECT id FROM companies WHERE user_id = (SELECT auth.uid())
            UNION
            SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())
          )
        )
      )
      WITH CHECK (
        contact_id IN (
          SELECT id FROM contacts
          WHERE company_id IN (
            SELECT id FROM companies WHERE user_id = (SELECT auth.uid())
            UNION
            SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())
          )
        )
      )
    $p$;
    -- N8N: associa tags a contatos via api_key
    EXECUTE $p$
      CREATE POLICY "anon_manage_contact_tags" ON contact_tags FOR ALL TO anon
      USING (
        contact_id IN (
          SELECT id FROM contacts WHERE company_id = get_company_id_from_api_key_header()
        )
      )
      WITH CHECK (
        contact_id IN (
          SELECT id FROM contacts WHERE company_id = get_company_id_from_api_key_header()
        )
      )
    $p$;
  END IF;
END $$;

-- ============================================================
-- MESSAGE_TAGS (se existir)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='message_tags') THEN
    EXECUTE 'CREATE POLICY "sr_message_tags" ON message_tags FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "auth_superadmin_message_tags" ON message_tags FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin())';
    EXECUTE 'CREATE POLICY "anon_insert_message_tags" ON message_tags FOR INSERT TO anon WITH CHECK (true)';
  END IF;
END $$;
