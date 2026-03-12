/*
  ============================================================
  NEXLA OPS - SCHEMA COMPLETO PARA NOVO BANCO
  ============================================================
  Migration consolidada de todas as tabelas, RLS, triggers
  e funções necessárias para o sistema funcionar.

  ORDEM DE CRIAÇÃO (resolvendo dependências circulares):
  01. Função helper is_super_admin()
  02. super_admins
  03. plans
  04. companies
  05. attendants (sem FK para departments/sectors - adicionadas depois)
  06. departments
  07. sectors
  08. tags
  09. contacts
  10. messages
  11. sent_messages
  12. contact_tags
  13. message_tags
  14. notifications
  15. transferencias
  16. theme_settings
  17. system_settings
  18. Adiciona FKs de attendants → departments/sectors
  19. Funções e triggers
  20. Realtime e storage
  ============================================================
*/

-- ============================================================
-- 01. HELPER: FUNÇÃO IS_SUPER_ADMIN
-- ============================================================

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM super_admins
    WHERE user_id = (SELECT auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função genérica para updated_at (usada em vários triggers)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 02. TABELA: super_admins
-- ============================================================

CREATE TABLE IF NOT EXISTS super_admins (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read super_admins"
  ON super_admins FOR SELECT
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Super admins can manage super_admins"
  ON super_admins FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- 03. TABELA: plans
-- ============================================================

CREATE TABLE IF NOT EXISTS plans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  description      text DEFAULT '',
  price            numeric(10,2) DEFAULT 0,
  billing_period   text DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'yearly', 'lifetime')),
  max_attendants   integer DEFAULT 5,
  max_departments  integer DEFAULT 3,
  max_contacts     integer,
  ai_enabled       boolean DEFAULT false,
  is_active        boolean DEFAULT true,
  features         jsonb DEFAULT '[]'::jsonb,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans(is_active);

CREATE POLICY "Super admins can manage all plans"
  ON plans FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Companies can read active plans"
  ON plans FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP TRIGGER IF EXISTS update_plans_updated_at ON plans;
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 04. TABELA: companies
-- ============================================================

CREATE TABLE IF NOT EXISTS companies (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name                     text NOT NULL,
  email                    text UNIQUE NOT NULL,
  phone                    text DEFAULT '',
  phone_number             text DEFAULT '',
  api_key                  text UNIQUE,
  plan_id                  uuid REFERENCES plans(id) ON DELETE SET NULL,
  max_attendants           integer DEFAULT 5,
  additional_attendants    integer DEFAULT 0,
  is_active                boolean DEFAULT true,
  is_super_admin           boolean DEFAULT false,
  ia_ativada               boolean DEFAULT false,
  payment_day              integer DEFAULT 10,
  payment_notification_day integer DEFAULT 5,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_companies_user_id  ON companies(user_id);
CREATE INDEX IF NOT EXISTS idx_companies_api_key  ON companies(api_key);
CREATE INDEX IF NOT EXISTS idx_companies_plan_id  ON companies(plan_id);

CREATE POLICY "Super admins can manage all companies"
  ON companies FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Companies can read own data"
  ON companies FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Companies can update own data"
  ON companies FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Service role full access companies"
  ON companies FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 05. TABELA: attendants
-- (criada ANTES de departments/sectors para que as políticas
--  dessas tabelas possam referenciar attendants.
--  FKs para department_id e sector_id são adicionadas depois.)
-- ============================================================

CREATE TABLE IF NOT EXISTS attendants (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  department_id  uuid,   -- FK adicionada depois de departments
  sector_id      uuid,   -- FK adicionada depois de sectors
  name           text NOT NULL,
  email          text UNIQUE NOT NULL,
  phone          text DEFAULT '',
  "function"     text DEFAULT '',
  user_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key        text,
  apikey_instancia text,
  is_active      boolean DEFAULT true,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE attendants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_attendants_company_id      ON attendants(company_id);
CREATE INDEX IF NOT EXISTS idx_attendants_user_id         ON attendants(user_id);
CREATE INDEX IF NOT EXISTS idx_attendants_api_key         ON attendants(api_key);
CREATE INDEX IF NOT EXISTS idx_attendants_email           ON attendants(email);
CREATE INDEX IF NOT EXISTS idx_attendants_department_id   ON attendants(department_id);
CREATE INDEX IF NOT EXISTS idx_attendants_sector_id       ON attendants(sector_id);
CREATE INDEX IF NOT EXISTS idx_attendants_apikey_instancia ON attendants(apikey_instancia);

-- Sincroniza api_key da empresa com o atendente
CREATE OR REPLACE FUNCTION sync_attendant_api_key()
RETURNS TRIGGER AS $$
BEGIN
  SELECT api_key INTO NEW.api_key
  FROM companies
  WHERE id = NEW.company_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS sync_attendant_api_key_trigger ON attendants;
CREATE TRIGGER sync_attendant_api_key_trigger
  BEFORE INSERT OR UPDATE OF company_id
  ON attendants
  FOR EACH ROW
  EXECUTE FUNCTION sync_attendant_api_key();

DROP TRIGGER IF EXISTS update_attendants_updated_at ON attendants;
CREATE TRIGGER update_attendants_updated_at
  BEFORE UPDATE ON attendants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE POLICY "Super admins can manage all attendants"
  ON attendants FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Company admins can view own attendants"
  ON attendants FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Company admins can insert own attendants"
  ON attendants FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Company admins can update own attendants"
  ON attendants FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Company admins can delete own attendants"
  ON attendants FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Attendants can view own profile"
  ON attendants FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Attendants can update own profile"
  ON attendants FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Service role full access attendants"
  ON attendants FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 06. TABELA: departments
-- ============================================================

CREATE TABLE IF NOT EXISTS departments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text DEFAULT '',
  is_default  boolean DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_departments_company_id ON departments(company_id);
CREATE INDEX IF NOT EXISTS idx_departments_default    ON departments(company_id) WHERE is_default = true;

COMMENT ON COLUMN departments.is_default IS 'Marca o departamento Recepção padrão que não pode ser deletado';

CREATE POLICY "Super admins can manage all departments"
  ON departments FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Companies can view own departments"
  ON departments FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Companies can insert own departments"
  ON departments FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Companies can update own departments"
  ON departments FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Companies can delete own departments"
  ON departments FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Attendants can view own company departments"
  ON departments FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())));

DROP TRIGGER IF EXISTS update_departments_updated_at ON departments;
CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 07. TABELA: sectors
-- ============================================================

CREATE TABLE IF NOT EXISTS sectors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text DEFAULT '',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sectors_department_id ON sectors(department_id);
CREATE INDEX IF NOT EXISTS idx_sectors_company_id    ON sectors(company_id);

CREATE POLICY "Super admins can manage all sectors"
  ON sectors FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Companies can view own sectors"
  ON sectors FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Companies can insert own sectors"
  ON sectors FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Companies can update own sectors"
  ON sectors FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Companies can delete own sectors"
  ON sectors FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Attendants can view own company sectors"
  ON sectors FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())));

DROP TRIGGER IF EXISTS update_sectors_updated_at ON sectors;
CREATE TRIGGER update_sectors_updated_at
  BEFORE UPDATE ON sectors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 08. TABELA: tags
-- ============================================================

CREATE TABLE IF NOT EXISTS tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  color       text DEFAULT '#6B7280',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_tags_company_id ON tags(company_id);

CREATE POLICY "Super admins can manage all tags"
  ON tags FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Companies can view own tags"
  ON tags FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Companies can insert own tags"
  ON tags FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Companies can update own tags"
  ON tags FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Companies can delete own tags"
  ON tags FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Attendants can view own company tags"
  ON tags FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())));

DROP TRIGGER IF EXISTS update_tags_updated_at ON tags;
CREATE TRIGGER update_tags_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 09. TABELA: contacts
-- ============================================================

DO $$ BEGIN
  CREATE TYPE ticket_status_enum AS ENUM ('aberto', 'em_processo', 'finalizado');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS contacts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  phone_number      text NOT NULL,
  numero            text,
  name              text,
  pushname          text,
  department_id     uuid REFERENCES departments(id) ON DELETE SET NULL,
  sector_id         uuid REFERENCES sectors(id) ON DELETE SET NULL,
  tag_id            uuid REFERENCES tags(id) ON DELETE SET NULL,
  last_message      text,
  last_message_time timestamptz,
  last_message_at   timestamptz,
  pinned            boolean NOT NULL DEFAULT false,
  ia_ativada        boolean DEFAULT false,
  ticket_status     ticket_status_enum DEFAULT 'aberto',
  ticket_opened_at  timestamptz DEFAULT now(),
  ticket_closed_at  timestamptz,
  ticket_closed_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  CONSTRAINT contacts_company_phone_unique UNIQUE (company_id, phone_number)
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_contacts_company_id        ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone_number      ON contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_contacts_department_id     ON contacts(department_id);
CREATE INDEX IF NOT EXISTS idx_contacts_sector_id         ON contacts(sector_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tag_id            ON contacts(tag_id);
CREATE INDEX IF NOT EXISTS idx_contacts_last_message_time ON contacts(last_message_time DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_ticket_status     ON contacts(company_id, ticket_status);
CREATE INDEX IF NOT EXISTS idx_contacts_ticket_closed_by  ON contacts(ticket_closed_by);

COMMENT ON COLUMN contacts.ia_ativada       IS 'IA ativada para este contato (padrão: false)';
COMMENT ON COLUMN contacts.ticket_status    IS 'Status do chamado: aberto, em_processo ou finalizado';
COMMENT ON COLUMN contacts.ticket_opened_at IS 'Data/hora de abertura do chamado';
COMMENT ON COLUMN contacts.ticket_closed_at IS 'Data/hora de finalização do chamado';
COMMENT ON COLUMN contacts.ticket_closed_by IS 'ID do atendente que finalizou o chamado';

CREATE POLICY "Super admins can manage all contacts"
  ON contacts FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Companies can view own contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Companies can insert own contacts"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Companies can update own contacts"
  ON contacts FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Companies can delete own contacts"
  ON contacts FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Attendants can view company contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Attendants can update company contacts"
  ON contacts FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())));

DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 10. TABELA: messages
-- ============================================================

CREATE TABLE IF NOT EXISTS messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number              text,
  instancia           text,
  numero              text,
  idmessage           text,
  "minha?"            text,
  pushname            text,
  tipomessage         text,
  timestamp           text,
  message             text,
  mimetype            text,
  base64              text,
  urlpdf              text,
  urlimagem           text,
  "instanceId"        text,
  "WebHook"           text,
  date_time           text,
  sender              text,
  apikey_instancia    text,
  phone_number        text,
  company_id          uuid REFERENCES companies(id) ON DELETE CASCADE,
  caption             text,
  sector_id           uuid REFERENCES sectors(id) ON DELETE SET NULL,
  department_id       uuid REFERENCES departments(id) ON DELETE SET NULL,
  tag_id              uuid REFERENCES tags(id) ON DELETE SET NULL,
  message_type        text DEFAULT 'user' CHECK (message_type IN ('user', 'system_transfer')),
  contact_id          uuid REFERENCES contacts(id) ON DELETE SET NULL,
  reaction_target_id  text,
  reactions           jsonb DEFAULT '[]'::jsonb,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_messages_company_id    ON messages(company_id);
CREATE INDEX IF NOT EXISTS idx_messages_apikey        ON messages(apikey_instancia);
CREATE INDEX IF NOT EXISTS idx_messages_numero        ON messages(numero);
CREATE INDEX IF NOT EXISTS idx_messages_phone_number  ON messages(phone_number);
CREATE INDEX IF NOT EXISTS idx_messages_sector_id     ON messages(sector_id);
CREATE INDEX IF NOT EXISTS idx_messages_department_id ON messages(department_id);
CREATE INDEX IF NOT EXISTS idx_messages_tag_id        ON messages(tag_id);
CREATE INDEX IF NOT EXISTS idx_messages_message_type  ON messages(message_type);
CREATE INDEX IF NOT EXISTS idx_messages_contact_id    ON messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at    ON messages(created_at DESC);

CREATE POLICY "Super admins can manage all messages"
  ON messages FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Companies can view own messages"
  ON messages FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Companies can insert own messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Companies can update own messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Attendants can view company messages"
  ON messages FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Attendants can insert company messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Attendants can update company messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Webhook anon insert messages"
  ON messages FOR INSERT
  TO anon
  WITH CHECK (apikey_instancia IN (SELECT api_key FROM companies));

-- ============================================================
-- 11. TABELA: sent_messages
-- ============================================================

CREATE TABLE IF NOT EXISTS sent_messages (
  id              bigserial PRIMARY KEY,
  instancia       text,
  numero          text,
  topic           text,
  idmessage       text,
  extension       text,
  "minha?"        text,
  payload         jsonb,
  pushname        text,
  event           text,
  private         boolean DEFAULT false,
  tipomessage     text,
  timestamp       text,
  updated_at      timestamp without time zone,
  inserted_at     timestamp without time zone,
  message         text,
  mimetype        text,
  base64          text,
  urlpdf          text,
  urlimagem       text,
  instanceid      text,
  webhook         text,
  date_time       text,
  sender          text,
  apikey_instancia text,
  company_id      uuid REFERENCES companies(id) ON DELETE CASCADE,
  caption         text,
  department_id   uuid REFERENCES departments(id) ON DELETE SET NULL,
  sector_id       uuid REFERENCES sectors(id) ON DELETE SET NULL,
  tag_id          uuid REFERENCES tags(id) ON DELETE SET NULL,
  contact_id      uuid REFERENCES contacts(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE sent_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sent_messages_company_id    ON sent_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_numero        ON sent_messages(numero);
CREATE INDEX IF NOT EXISTS idx_sent_messages_apikey        ON sent_messages(apikey_instancia);
CREATE INDEX IF NOT EXISTS idx_sent_messages_created_at    ON sent_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sent_messages_numero_apikey ON sent_messages(numero, apikey_instancia);
CREATE INDEX IF NOT EXISTS idx_sent_messages_department_id ON sent_messages(department_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_sector_id     ON sent_messages(sector_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_contact_id    ON sent_messages(contact_id);

CREATE POLICY "Super admins can manage all sent messages"
  ON sent_messages FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Companies can view own sent messages"
  ON sent_messages FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Companies can insert own sent messages"
  ON sent_messages FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Companies can update own sent messages"
  ON sent_messages FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Attendants can view company sent messages"
  ON sent_messages FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Attendants can insert company sent messages"
  ON sent_messages FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Attendants can update company sent messages"
  ON sent_messages FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())));

-- ============================================================
-- 12. TABELA: contact_tags
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id      uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  CONSTRAINT contact_tags_contact_tag_unique UNIQUE (contact_id, tag_id)
);

ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_contact_tags_contact_id ON contact_tags(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_tag_id     ON contact_tags(tag_id);

CREATE OR REPLACE FUNCTION check_max_tags_per_contact()
RETURNS TRIGGER AS $$
DECLARE
  tag_count int;
BEGIN
  SELECT COUNT(*) INTO tag_count
  FROM contact_tags
  WHERE contact_id = NEW.contact_id;

  IF tag_count >= 5 THEN
    RAISE EXCEPTION 'Cannot add more than 5 tags to a contact';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_max_tags ON contact_tags;
CREATE TRIGGER trigger_check_max_tags
  BEFORE INSERT ON contact_tags
  FOR EACH ROW
  EXECUTE FUNCTION check_max_tags_per_contact();

CREATE POLICY "Super admins can manage all contact tags"
  ON contact_tags FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Companies can view own contact tags"
  ON contact_tags FOR SELECT
  TO authenticated
  USING (contact_id IN (
    SELECT id FROM contacts
    WHERE company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid()))
  ));

CREATE POLICY "Companies can insert own contact tags"
  ON contact_tags FOR INSERT
  TO authenticated
  WITH CHECK (contact_id IN (
    SELECT id FROM contacts
    WHERE company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid()))
  ));

CREATE POLICY "Companies can delete own contact tags"
  ON contact_tags FOR DELETE
  TO authenticated
  USING (contact_id IN (
    SELECT id FROM contacts
    WHERE company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid()))
  ));

CREATE POLICY "Attendants can view company contact tags"
  ON contact_tags FOR SELECT
  TO authenticated
  USING (contact_id IN (
    SELECT id FROM contacts
    WHERE company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid()))
  ));

CREATE POLICY "Attendants can insert company contact tags"
  ON contact_tags FOR INSERT
  TO authenticated
  WITH CHECK (contact_id IN (
    SELECT id FROM contacts
    WHERE company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid()))
  ));

CREATE POLICY "Attendants can delete company contact tags"
  ON contact_tags FOR DELETE
  TO authenticated
  USING (contact_id IN (
    SELECT id FROM contacts
    WHERE company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid()))
  ));

-- ============================================================
-- 13. TABELA: message_tags
-- ============================================================

CREATE TABLE IF NOT EXISTS message_tags (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_numero text NOT NULL,
  tag_id         uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at     timestamptz DEFAULT now(),
  created_by     uuid REFERENCES auth.users(id),
  UNIQUE (message_numero, tag_id)
);

ALTER TABLE message_tags ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_message_tags_numero ON message_tags(message_numero);
CREATE INDEX IF NOT EXISTS idx_message_tags_tag_id ON message_tags(tag_id);

CREATE POLICY "Super admins can manage all message tags"
  ON message_tags FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Companies can manage their message tags"
  ON message_tags FOR ALL
  TO authenticated
  USING (tag_id IN (
    SELECT t.id FROM tags t
    JOIN companies c ON c.id = t.company_id
    WHERE c.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (tag_id IN (
    SELECT t.id FROM tags t
    JOIN companies c ON c.id = t.company_id
    WHERE c.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "Attendants can view company message tags"
  ON message_tags FOR SELECT
  TO authenticated
  USING (tag_id IN (
    SELECT t.id FROM tags t
    JOIN attendants a ON a.company_id = t.company_id
    WHERE a.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "Attendants can insert company message tags"
  ON message_tags FOR INSERT
  TO authenticated
  WITH CHECK (tag_id IN (
    SELECT t.id FROM tags t
    JOIN attendants a ON a.company_id = t.company_id
    WHERE a.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "Attendants can delete company message tags"
  ON message_tags FOR DELETE
  TO authenticated
  USING (tag_id IN (
    SELECT t.id FROM tags t
    JOIN attendants a ON a.company_id = t.company_id
    WHERE a.user_id = (SELECT auth.uid())
  ));

-- ============================================================
-- 14. TABELA: notifications
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title       text NOT NULL,
  message     text NOT NULL,
  type        text NOT NULL DEFAULT 'info' CHECK (type IN ('payment', 'info', 'warning', 'error')),
  is_read     boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read    ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

CREATE POLICY "Super admins can manage all notifications"
  ON notifications FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Companies can read own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Companies can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Attendants can read company notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())));

-- ============================================================
-- 15. TABELA: transferencias
-- ============================================================

CREATE TABLE IF NOT EXISTS transferencias (
  id                      bigserial PRIMARY KEY,
  api_key                 varchar NOT NULL DEFAULT '',
  contact_id              uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  company_id              uuid REFERENCES companies(id) ON DELETE CASCADE,
  departamento_origem_id  uuid REFERENCES departments(id) ON DELETE SET NULL,
  departamento_destino_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  data_transferencia      timestamptz DEFAULT now(),
  created_at              timestamptz DEFAULT now()
);

ALTER TABLE transferencias ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_transferencias_api_key            ON transferencias(api_key);
CREATE INDEX IF NOT EXISTS idx_transferencias_contact_id         ON transferencias(contact_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_company_id         ON transferencias(company_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_data               ON transferencias(data_transferencia DESC);
CREATE INDEX IF NOT EXISTS idx_transferencias_from_department_id ON transferencias(departamento_origem_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_to_department_id   ON transferencias(departamento_destino_id);

CREATE POLICY "Super admins can view all transfers"
  ON transferencias FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Companies can view own transfers"
  ON transferencias FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid()))
    OR api_key IN (SELECT api_key FROM companies WHERE user_id = (SELECT auth.uid()))
  );

CREATE POLICY "Attendants can view company transfers"
  ON transferencias FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid()))
    OR api_key IN (
      SELECT api_key FROM companies WHERE id IN (
        SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "Authenticated can insert transfers via RPC"
  ON transferencias FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================
-- 16. TABELA: theme_settings
-- ============================================================

CREATE TABLE IF NOT EXISTS theme_settings (
  id                                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                           uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- Cores básicas
  primary_color                        text DEFAULT '#3b82f6',
  secondary_color                      text DEFAULT '#1e40af',
  accent_color                         text DEFAULT '#60a5fa',
  background_color                     text DEFAULT '#f8fafc',
  text_color                           text DEFAULT '#1e293b',
  dark_mode_enabled                    boolean DEFAULT false,
  -- Logos
  logo_url                             text,
  logo_primary_url                     text,
  logo_favicon_url                     text,
  logo_email_url                       text,
  logo_chat_widget_url                 text,
  -- Branding
  company_name                         text,
  -- Chat background
  background_type                      text DEFAULT 'color' CHECK (background_type IN ('color', 'image')),
  background_image_url                 text,
  -- Bolhas de mensagem
  message_bubble_sent_color            text DEFAULT '#3b82f6',
  message_bubble_sent_text_color       text DEFAULT '#ffffff',
  message_bubble_received_color        text DEFAULT '#ffffff',
  message_bubble_received_text_color   text DEFAULT '#1e293b',
  -- Tipografia e estilo
  font_family_primary                  text DEFAULT 'Inter, system-ui, sans-serif',
  font_family_secondary                text DEFAULT 'Inter, system-ui, sans-serif',
  custom_css                           text,
  theme_mode                           text DEFAULT 'light' CHECK (theme_mode IN ('light', 'dark', 'auto', 'custom')),
  border_radius                        text DEFAULT '8px',
  shadow_style                         text DEFAULT 'medium' CHECK (shadow_style IN ('none', 'subtle', 'medium', 'strong')),
  -- Configurações JSON avançadas
  agent_interface_config jsonb DEFAULT '{
    "layout": "comfortable",
    "sidebar_position": "left",
    "default_view": "list",
    "enabled_modules": ["contacts", "messages", "departments", "sectors", "tags"],
    "quick_actions": ["transfer", "tag", "priority"],
    "notification_preferences": {
      "sound_enabled": true,
      "desktop_notifications": true,
      "badge_count": true
    },
    "dashboard_widgets": ["recent_contacts", "active_chats", "statistics"]
  }'::jsonb,
  customer_display_config jsonb DEFAULT '{
    "chat_widget": {
      "position": "bottom-right",
      "bubble_color": "#3b82f6",
      "bubble_icon": "chat",
      "greeting_message": "Olá! Como podemos ajudar?",
      "show_agent_avatars": true,
      "show_typing_indicator": true,
      "auto_open": false,
      "auto_open_delay": 3
    },
    "form_settings": {
      "show_company_logo": true,
      "require_name": true,
      "require_email": false,
      "custom_fields": []
    },
    "localization": {
      "default_language": "pt-BR",
      "available_languages": ["pt-BR", "en-US"],
      "timezone": "America/Sao_Paulo"
    }
  }'::jsonb,
  system_config jsonb DEFAULT '{
    "features": {
      "ai_enabled": true,
      "auto_translation": false,
      "file_attachments": true,
      "voice_messages": true,
      "video_calls": false
    },
    "business_hours": {
      "enabled": false,
      "timezone": "America/Sao_Paulo",
      "auto_reply_outside_hours": false,
      "outside_hours_message": "No momento estamos fora do horário de atendimento."
    },
    "automation": {
      "auto_assignment": true,
      "round_robin": false,
      "auto_close_inactive": false,
      "inactive_timeout_hours": 24
    }
  }'::jsonb,
  integration_config jsonb DEFAULT '{
    "whatsapp": {"enabled": true, "webhook_url": ""},
    "telegram": {"enabled": false, "webhook_url": ""},
    "email": {"enabled": false, "smtp_host": "", "smtp_port": 587},
    "analytics": {"enabled": false, "tracking_id": ""},
    "crm": {"enabled": false, "provider": "", "sync_enabled": false}
  }'::jsonb,
  -- Metadados de versão
  settings_version    integer DEFAULT 1,
  last_modified_by    uuid REFERENCES auth.users(id),
  change_history      jsonb DEFAULT '[]'::jsonb,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  UNIQUE (company_id)
);

ALTER TABLE theme_settings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_theme_settings_company_id ON theme_settings(company_id);

COMMENT ON TABLE  theme_settings IS 'Configurações completas de aparência e comportamento por empresa';
COMMENT ON COLUMN theme_settings.logo_primary_url  IS 'Logo principal exibida no cabeçalho do dashboard';
COMMENT ON COLUMN theme_settings.logo_favicon_url  IS 'Ícone do browser/aba (16x16 ou 32x32 px)';
COMMENT ON COLUMN theme_settings.theme_mode        IS 'Modo de tema: light, dark, auto ou custom';
COMMENT ON COLUMN theme_settings.company_name      IS 'Nome da empresa exibido no header do dashboard';
COMMENT ON COLUMN theme_settings.background_type   IS 'Tipo de fundo do chat: color ou image';

CREATE OR REPLACE FUNCTION track_theme_settings_changes()
RETURNS TRIGGER AS $$
BEGIN
  NEW.settings_version = OLD.settings_version + 1;
  NEW.last_modified_by = (SELECT auth.uid());
  NEW.updated_at = now();
  NEW.change_history = (
    SELECT jsonb_agg(item)
    FROM (
      SELECT item
      FROM jsonb_array_elements(
        COALESCE(OLD.change_history, '[]'::jsonb) || jsonb_build_object(
          'version', OLD.settings_version,
          'modified_at', OLD.updated_at,
          'modified_by', (SELECT auth.uid())
        )
      ) AS item
      ORDER BY (item->>'modified_at')::timestamptz DESC
      LIMIT 50
    ) sub
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS track_theme_settings_changes_trigger ON theme_settings;
CREATE TRIGGER track_theme_settings_changes_trigger
  BEFORE UPDATE ON theme_settings
  FOR EACH ROW
  EXECUTE FUNCTION track_theme_settings_changes();

CREATE POLICY "Super admins can manage all theme settings"
  ON theme_settings FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Companies can read own theme settings"
  ON theme_settings FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Companies can insert own theme settings"
  ON theme_settings FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Companies can update own theme settings"
  ON theme_settings FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Attendants can read company theme settings"
  ON theme_settings FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())));

-- ============================================================
-- 17. TABELA: system_settings
-- ============================================================

CREATE TABLE IF NOT EXISTS system_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pix_key     text NOT NULL DEFAULT '',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage system settings"
  ON system_settings FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Companies can read system settings"
  ON system_settings FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Attendants can read system settings"
  ON system_settings FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM attendants WHERE user_id = (SELECT auth.uid())));

DROP TRIGGER IF EXISTS system_settings_updated_at ON system_settings;
CREATE TRIGGER system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

INSERT INTO system_settings (pix_key)
SELECT ''
WHERE NOT EXISTS (SELECT 1 FROM system_settings);

-- ============================================================
-- 18. TABELA: agent_configs
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_configs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_name          text NOT NULL DEFAULT '',
  company_description text DEFAULT '',
  tone                text DEFAULT 'amigavel' CHECK (tone IN ('formal', 'amigavel', 'direto', 'consultivo')),
  instructions        text DEFAULT '',
  restrictions        text DEFAULT '',
  fallback_message    text DEFAULT '',
  attendance_modes    text[] DEFAULT ARRAY[]::text[],
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  UNIQUE (company_id)
);

ALTER TABLE agent_configs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_agent_configs_company_id ON agent_configs(company_id);

COMMENT ON TABLE  agent_configs IS 'Configuração do agente de IA por empresa';
COMMENT ON COLUMN agent_configs.tone             IS 'Tom do agente: formal, amigavel, direto ou consultivo';
COMMENT ON COLUMN agent_configs.attendance_modes IS 'Canais: whatsapp, chat, email, phone, presencial';

DROP TRIGGER IF EXISTS update_agent_configs_updated_at ON agent_configs;
CREATE TRIGGER update_agent_configs_updated_at
  BEFORE UPDATE ON agent_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE POLICY "Super admins can manage all agent configs"
  ON agent_configs FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Companies can manage own agent config"
  ON agent_configs FOR ALL
  TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Attendants can read company agent config"
  ON agent_configs FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM attendants WHERE user_id = (SELECT auth.uid())));

-- ============================================================
-- 19. FK constraints de attendants → departments/sectors
-- (adicionadas aqui pois departments/sectors já existem)
-- ============================================================

ALTER TABLE attendants
  ADD CONSTRAINT attendants_department_id_fkey
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  ADD CONSTRAINT attendants_sector_id_fkey
    FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE SET NULL;

-- ============================================================
-- 20. FUNÇÕES TRIGGER: auto-criar Recepção e impedir deleção
-- ============================================================

CREATE OR REPLACE FUNCTION create_default_reception_department()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO departments (company_id, name, is_default)
  VALUES (NEW.id, 'Recepção', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_create_reception_department ON companies;
CREATE TRIGGER trigger_create_reception_department
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION create_default_reception_department();

CREATE OR REPLACE FUNCTION prevent_delete_default_department()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_default = true THEN
    RAISE EXCEPTION 'Não é possível deletar o departamento padrão (Recepção)';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_delete_default_department ON departments;
CREATE TRIGGER trigger_prevent_delete_default_department
  BEFORE DELETE ON departments
  FOR EACH ROW
  EXECUTE FUNCTION prevent_delete_default_department();

-- ============================================================
-- 21. TRIGGER: recalcular max_attendants ao mudar plano
-- ============================================================

CREATE OR REPLACE FUNCTION recalculate_max_attendants()
RETURNS TRIGGER AS $$
DECLARE
  plan_max_attendants INTEGER;
BEGIN
  IF (TG_OP = 'UPDATE' AND (
        NEW.plan_id IS DISTINCT FROM OLD.plan_id OR
        NEW.additional_attendants IS DISTINCT FROM OLD.additional_attendants
      ))
     OR TG_OP = 'INSERT' THEN

    IF NEW.plan_id IS NOT NULL THEN
      SELECT max_attendants INTO plan_max_attendants
      FROM plans WHERE id = NEW.plan_id;

      IF plan_max_attendants IS NOT NULL THEN
        IF plan_max_attendants = 0 THEN
          NEW.max_attendants := 0;
        ELSE
          NEW.max_attendants := plan_max_attendants + COALESCE(NEW.additional_attendants, 0);
        END IF;
      ELSE
        NEW.max_attendants := 1 + COALESCE(NEW.additional_attendants, 0);
      END IF;
    ELSE
      NEW.max_attendants := 1 + COALESCE(NEW.additional_attendants, 0);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_recalculate_max_attendants ON companies;
CREATE TRIGGER trigger_recalculate_max_attendants
  BEFORE INSERT OR UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_max_attendants();

-- ============================================================
-- 22. TRIGGER: upsert_contact_from_message
-- ============================================================

CREATE OR REPLACE FUNCTION upsert_contact_from_message()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id         uuid;
  v_reception_dept_id  uuid;
  v_phone              text;
BEGIN
  -- Localiza empresa pela api_key
  SELECT id INTO v_company_id
  FROM companies
  WHERE api_key = NEW.apikey_instancia;

  -- Só prossegue se a empresa existe e há número de telefone
  IF v_company_id IS NOT NULL AND NEW.numero IS NOT NULL THEN
    v_phone := regexp_replace(NEW.numero, '\D', '', 'g');

    -- Busca departamento Recepção padrão
    SELECT id INTO v_reception_dept_id
    FROM departments
    WHERE company_id = v_company_id AND is_default = true
    LIMIT 1;

    INSERT INTO contacts (
      phone_number, numero, name, pushname, company_id, department_id,
      last_message, last_message_time, last_message_at,
      created_at, updated_at
    )
    VALUES (
      v_phone,
      NEW.numero,
      NULLIF(NEW.pushname, ''),
      NEW.pushname,
      v_company_id,
      v_reception_dept_id,
      COALESCE(NEW.message, NEW.caption, ''),
      now(),
      now(),
      now(),
      now()
    )
    ON CONFLICT (company_id, phone_number)
    DO UPDATE SET
      last_message      = EXCLUDED.last_message,
      last_message_time = EXCLUDED.last_message_time,
      last_message_at   = EXCLUDED.last_message_at,
      pushname          = COALESCE(EXCLUDED.pushname, contacts.pushname),
      updated_at        = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_upsert_contact_from_message ON messages;
CREATE TRIGGER trigger_upsert_contact_from_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION upsert_contact_from_message();

DROP TRIGGER IF EXISTS trigger_upsert_contact_from_sent_message ON sent_messages;
CREATE TRIGGER trigger_upsert_contact_from_sent_message
  AFTER INSERT ON sent_messages
  FOR EACH ROW
  EXECUTE FUNCTION upsert_contact_from_message();

-- ============================================================
-- 23. FUNÇÃO RPC: confirm_user_email
-- ============================================================

DROP FUNCTION IF EXISTS confirm_user_email(uuid);
CREATE OR REPLACE FUNCTION confirm_user_email(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE id = user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_user_email(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_user_email(uuid) TO service_role;

-- ============================================================
-- 24. FUNÇÃO RPC: transfer_contact_department
-- ============================================================

CREATE OR REPLACE FUNCTION transfer_contact_department(
  p_company_id       uuid,
  p_contact_id       uuid,
  p_to_department_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_api_key            text;
  v_from_department_id uuid;
BEGIN
  SELECT department_id INTO v_from_department_id
  FROM contacts
  WHERE id = p_contact_id AND company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'contact_not_found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM departments
    WHERE id = p_to_department_id AND company_id = p_company_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'department_not_found');
  END IF;

  SELECT api_key INTO v_api_key FROM companies WHERE id = p_company_id;

  UPDATE contacts
  SET department_id = p_to_department_id, updated_at = now()
  WHERE id = p_contact_id;

  INSERT INTO transferencias (
    api_key, contact_id, company_id,
    departamento_origem_id, departamento_destino_id,
    data_transferencia, created_at
  )
  VALUES (
    COALESCE(v_api_key, ''), p_contact_id, p_company_id,
    v_from_department_id, p_to_department_id,
    now(), now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'from_department_id', v_from_department_id,
    'to_department_id', p_to_department_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION transfer_contact_department(uuid, uuid, uuid) TO authenticated;

-- ============================================================
-- 25. FUNÇÃO RPC: delete_contact_and_messages
-- ============================================================

CREATE OR REPLACE FUNCTION delete_contact_and_messages(p_contact_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id       uuid;
  v_deleted_messages int := 0;
  v_deleted_sent     int := 0;
  v_phone_number     text;
BEGIN
  SELECT company_id, phone_number INTO v_company_id, v_phone_number
  FROM contacts WHERE id = p_contact_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'contact_not_found');
  END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM attendants WHERE user_id = (SELECT auth.uid()) AND company_id = v_company_id)
    OR EXISTS (SELECT 1 FROM companies WHERE user_id = (SELECT auth.uid()) AND id = v_company_id)
    OR is_super_admin()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT COUNT(*) INTO v_deleted_messages FROM messages WHERE contact_id = p_contact_id;
  DELETE FROM messages WHERE contact_id = p_contact_id;

  SELECT COUNT(*) INTO v_deleted_sent FROM sent_messages WHERE contact_id = p_contact_id;
  DELETE FROM sent_messages WHERE contact_id = p_contact_id;

  DELETE FROM contact_tags  WHERE contact_id = p_contact_id;
  DELETE FROM transferencias WHERE contact_id = p_contact_id;
  DELETE FROM contacts WHERE id = p_contact_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted', jsonb_build_object(
      'messages',      v_deleted_messages,
      'sent_messages', v_deleted_sent,
      'contact_id',    p_contact_id,
      'phone_number',  v_phone_number
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION delete_contact_and_messages(uuid) TO authenticated;

-- ============================================================
-- 26. FUNÇÃO RPC: registrar_transferencia_por_contact_id
-- ============================================================

CREATE OR REPLACE FUNCTION registrar_transferencia_por_contact_id(
  p_api_key            varchar,
  p_contact_id         uuid,
  p_from_department_id uuid,
  p_to_department_id   uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT id INTO v_company_id FROM companies WHERE api_key = p_api_key;

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_api_key');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM contacts WHERE id = p_contact_id AND company_id = v_company_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'contact_not_found');
  END IF;

  INSERT INTO transferencias (
    api_key, contact_id, company_id,
    departamento_origem_id, departamento_destino_id,
    data_transferencia, created_at
  )
  VALUES (
    p_api_key, p_contact_id, v_company_id,
    p_from_department_id, p_to_department_id,
    now(), now()
  );

  IF p_to_department_id IS NOT NULL THEN
    UPDATE contacts
    SET department_id = p_to_department_id, updated_at = now()
    WHERE id = p_contact_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'company_id', v_company_id,
    'from_department_id', p_from_department_id,
    'to_department_id', p_to_department_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_transferencia_por_contact_id(varchar, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION registrar_transferencia_por_contact_id(varchar, uuid, uuid, uuid) TO anon;

-- ============================================================
-- 27. FUNÇÃO RPC: registrar_transferencia (por número)
-- ============================================================

CREATE OR REPLACE FUNCTION registrar_transferencia(
  p_api_key              VARCHAR,
  p_phone_number         VARCHAR,
  p_departamento_destino_id UUID
)
RETURNS TABLE (
  id                      BIGINT,
  api_key                 VARCHAR,
  contact_id              UUID,
  phone_number            VARCHAR,
  departamento_origem_id  UUID,
  departamento_destino_id UUID,
  data_transferencia      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id    UUID;
  v_contact_id    UUID;
  v_current_dept  UUID;
BEGIN
  SELECT id INTO v_company_id FROM companies WHERE api_key = p_api_key;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'API key inválida: %', p_api_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM departments
    WHERE id = p_departamento_destino_id AND company_id = v_company_id
  ) THEN
    RAISE EXCEPTION 'Departamento destino inválido ou não pertence a esta empresa';
  END IF;

  SELECT id, department_id INTO v_contact_id, v_current_dept
  FROM contacts
  WHERE phone_number = p_phone_number AND company_id = v_company_id
  LIMIT 1;

  IF v_contact_id IS NULL THEN
    RAISE EXCEPTION 'Contato não encontrado: %', p_phone_number;
  END IF;

  IF v_current_dept = p_departamento_destino_id THEN
    RAISE EXCEPTION 'Contato já está neste departamento';
  END IF;

  RETURN QUERY
  INSERT INTO transferencias (
    api_key, contact_id, company_id,
    departamento_origem_id, departamento_destino_id
  )
  VALUES (
    p_api_key, v_contact_id, v_company_id,
    v_current_dept, p_departamento_destino_id
  )
  RETURNING
    transferencias.id,
    transferencias.api_key,
    transferencias.contact_id,
    (SELECT contacts.phone_number FROM contacts WHERE contacts.id = v_contact_id),
    transferencias.departamento_origem_id,
    transferencias.departamento_destino_id,
    transferencias.data_transferencia;

  UPDATE contacts
  SET department_id = p_departamento_destino_id, updated_at = now()
  WHERE id = v_contact_id;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_transferencia(VARCHAR, VARCHAR, UUID) TO authenticated;

-- ============================================================
-- 28. FUNÇÃO RPC: update_contact_tags
-- ============================================================

CREATE OR REPLACE FUNCTION update_contact_tags(
  p_contact_id uuid,
  p_tag_ids    uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id    uuid;
  v_current_tags  uuid[] := ARRAY[]::uuid[];
  v_to_remove     uuid[] := ARRAY[]::uuid[];
  v_to_add        uuid[] := ARRAY[]::uuid[];
  v_existing_count int;
BEGIN
  SELECT company_id INTO v_company_id FROM contacts WHERE id = p_contact_id;

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'contact_not_found');
  END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM attendants WHERE user_id = (SELECT auth.uid()) AND company_id = v_company_id)
    OR EXISTS (SELECT 1 FROM companies WHERE user_id = (SELECT auth.uid()) AND id = v_company_id)
    OR is_super_admin()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT COALESCE(array_agg(tag_id), ARRAY[]::uuid[])
  INTO v_current_tags
  FROM contact_tags WHERE contact_id = p_contact_id;

  v_to_remove := ARRAY(
    SELECT unnest(v_current_tags)
    EXCEPT SELECT unnest(COALESCE(p_tag_ids, ARRAY[]::uuid[]))
  );
  v_to_add := ARRAY(
    SELECT unnest(COALESCE(p_tag_ids, ARRAY[]::uuid[]))
    EXCEPT SELECT unnest(v_current_tags)
  );

  IF array_length(v_to_remove, 1) IS NOT NULL THEN
    DELETE FROM contact_tags
    WHERE contact_id = p_contact_id AND tag_id = ANY(v_to_remove);
  END IF;

  SELECT COUNT(*) INTO v_existing_count FROM contact_tags WHERE contact_id = p_contact_id;

  IF v_existing_count + COALESCE(array_length(v_to_add, 1), 0) > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'max_tags_exceeded');
  END IF;

  IF array_length(v_to_add, 1) IS NOT NULL THEN
    INSERT INTO contact_tags (contact_id, tag_id)
    SELECT p_contact_id, unnest(v_to_add)
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE contacts
  SET tag_id = (
    SELECT tag_id FROM contact_tags
    WHERE contact_id = p_contact_id
    ORDER BY created_at LIMIT 1
  )
  WHERE id = p_contact_id;

  RETURN jsonb_build_object('success', true, 'removed', v_to_remove, 'added', v_to_add);
END;
$$;

GRANT EXECUTE ON FUNCTION update_contact_tags(uuid, uuid[]) TO authenticated;

-- ============================================================
-- 29. FUNÇÃO RPC: delete_company_cascade
-- ============================================================

CREATE OR REPLACE FUNCTION delete_company_cascade(company_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_deleted_attendants      int := 0;
  v_deleted_departments     int := 0;
  v_deleted_sectors         int := 0;
  v_deleted_tags            int := 0;
  v_deleted_messages        int := 0;
  v_deleted_sent_messages   int := 0;
  v_company_api_key         text;
  v_company_user_id         uuid;
  v_deleted_attendant_users int := 0;
  v_attendant_user_id       uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM super_admins WHERE super_admins.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only super admins can delete companies';
  END IF;

  SELECT api_key, user_id INTO v_company_api_key, v_company_user_id
  FROM companies WHERE id = company_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  SELECT COUNT(*) INTO v_deleted_attendants    FROM attendants    WHERE company_id = company_uuid;
  SELECT COUNT(*) INTO v_deleted_departments   FROM departments   WHERE company_id = company_uuid;
  SELECT COUNT(*) INTO v_deleted_sectors       FROM sectors       WHERE company_id = company_uuid;
  SELECT COUNT(*) INTO v_deleted_tags          FROM tags          WHERE company_id = company_uuid;
  SELECT COUNT(*) INTO v_deleted_messages      FROM messages      WHERE apikey_instancia = v_company_api_key;
  SELECT COUNT(*) INTO v_deleted_sent_messages FROM sent_messages WHERE company_id = company_uuid;

  FOR v_attendant_user_id IN
    SELECT user_id FROM attendants
    WHERE company_id = company_uuid AND user_id IS NOT NULL
  LOOP
    BEGIN
      DELETE FROM auth.users WHERE id = v_attendant_user_id;
      v_deleted_attendant_users := v_deleted_attendant_users + 1;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;

  DELETE FROM companies WHERE id = company_uuid;

  IF v_company_user_id IS NOT NULL THEN
    BEGIN
      DELETE FROM auth.users WHERE id = v_company_user_id;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted', jsonb_build_object(
      'attendants',       v_deleted_attendants,
      'attendant_users',  v_deleted_attendant_users,
      'departments',      v_deleted_departments,
      'sectors',          v_deleted_sectors,
      'tags',             v_deleted_tags,
      'messages',         v_deleted_messages,
      'sent_messages',    v_deleted_sent_messages,
      'company_user',     CASE WHEN v_company_user_id IS NOT NULL THEN 1 ELSE 0 END
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION delete_company_cascade(uuid) TO authenticated;

-- ============================================================
-- 30. FUNÇÕES RPC: Planos e limites
-- ============================================================

CREATE OR REPLACE FUNCTION get_company_max_attendants(company_id uuid)
RETURNS integer AS $$
DECLARE
  plan_max   integer;
  additional integer;
BEGIN
  SELECT p.max_attendants, c.additional_attendants
  INTO plan_max, additional
  FROM companies c
  LEFT JOIN plans p ON c.plan_id = p.id
  WHERE c.id = company_id;

  IF plan_max IS NULL THEN RETURN NULL; END IF;
  RETURN plan_max + COALESCE(additional, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION can_add_attendant(company_id uuid)
RETURNS boolean AS $$
DECLARE
  max_allowed   integer;
  current_count integer;
BEGIN
  max_allowed := get_company_max_attendants(company_id);
  IF max_allowed IS NULL THEN RETURN true; END IF;

  SELECT COUNT(*) INTO current_count
  FROM attendants WHERE attendants.company_id = can_add_attendant.company_id;

  RETURN current_count < max_allowed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 31. REALTIME: habilitar tabelas para subscriptions
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE sent_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE contact_tags;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE transferencias;
ALTER PUBLICATION supabase_realtime ADD TABLE departments;
ALTER PUBLICATION supabase_realtime ADD TABLE sectors;
ALTER PUBLICATION supabase_realtime ADD TABLE theme_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE companies;
ALTER PUBLICATION supabase_realtime ADD TABLE plans;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_configs;

-- ============================================================
-- 32. STORAGE: bucket para arquivos de mensagens
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('message-files', 'message-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload message files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'message-files');

CREATE POLICY "Authenticated users can view message files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'message-files');

CREATE POLICY "Authenticated users can delete message files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'message-files');
