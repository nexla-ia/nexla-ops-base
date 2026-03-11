/*
  # Consolidar Políticas RLS do Theme Settings
  
  ## Descrição
  Consolida e otimiza todas as políticas RLS da tabela theme_settings para garantir:
  - Sem conflitos entre políticas
  - Atualização controlada (apenas via botão Salvar)
  - Realtime funcionando corretamente
  - Sem loops infinitos de atualização
  
  ## Mudanças
  1. Remove todas as políticas existentes
  2. Recria políticas otimizadas para SELECT, INSERT, UPDATE e DELETE
  3. Garante isolamento correto entre companies
  
  ## Segurança
  - Companies podem gerenciar apenas suas próprias configurações
  - Attendants podem gerenciar configurações de suas companies
  - Super admins têm acesso total
  - Todas as operações verificam company_id
*/

-- Remove TODAS as políticas existentes do theme_settings
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'theme_settings'
  ) LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON theme_settings';
  END LOOP;
END $$;

-- ============================================================================
-- SELECT POLICIES (Leitura)
-- ============================================================================

-- Companies podem ler suas próprias configurações
CREATE POLICY "Companies can read own theme settings"
  ON theme_settings
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

-- Attendants podem ler configurações de suas companies
CREATE POLICY "Attendants can read company theme settings"
  ON theme_settings
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM attendants WHERE user_id = auth.uid()
    )
  );

-- Super admins podem ler todas as configurações
CREATE POLICY "Super admins can read all theme settings"
  ON theme_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- INSERT POLICIES (Criação)
-- ============================================================================

-- Companies podem criar suas próprias configurações
CREATE POLICY "Companies can insert own theme settings"
  ON theme_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

-- Attendants podem criar configurações para suas companies
CREATE POLICY "Attendants can insert company theme settings"
  ON theme_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM attendants WHERE user_id = auth.uid()
    )
  );

-- Super admins podem criar qualquer configuração
CREATE POLICY "Super admins can insert all theme settings"
  ON theme_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- UPDATE POLICIES (Atualização)
-- ============================================================================

-- Companies podem atualizar suas próprias configurações
CREATE POLICY "Companies can update own theme settings"
  ON theme_settings
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

-- Attendants podem atualizar configurações de suas companies
CREATE POLICY "Attendants can update company theme settings"
  ON theme_settings
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM attendants WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM attendants WHERE user_id = auth.uid()
    )
  );

-- Super admins podem atualizar qualquer configuração
CREATE POLICY "Super admins can update all theme settings"
  ON theme_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- DELETE POLICIES (Exclusão)
-- ============================================================================

-- Companies podem deletar suas próprias configurações
CREATE POLICY "Companies can delete own theme settings"
  ON theme_settings
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

-- Attendants podem deletar configurações de suas companies
CREATE POLICY "Attendants can delete company theme settings"
  ON theme_settings
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM attendants WHERE user_id = auth.uid()
    )
  );

-- Super admins podem deletar qualquer configuração
CREATE POLICY "Super admins can delete all theme settings"
  ON theme_settings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );

-- Garante que o realtime está habilitado
DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE theme_settings';
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;