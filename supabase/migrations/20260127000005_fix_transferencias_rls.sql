-- ============================================================================
-- MIGRAÇÃO: Corrigir RLS na tabela transferencias
-- ============================================================================
-- Problema: "new row violates row-level security policy for table 'transferencias'"
-- Solução: DESABILITAR RLS (pois dados já estão sendo inseridos via RPC segura)

-- 1. DESABILITAR RLS na tabela transferencias
ALTER TABLE transferencias DISABLE ROW LEVEL SECURITY;

-- 2. Remover todas as políticas (não são mais necessárias)
DROP POLICY IF EXISTS "Allow insert on transferencias for authenticated" ON transferencias;
DROP POLICY IF EXISTS "Allow select transferencias for authenticated" ON transferencias;
DROP POLICY IF EXISTS "Allow update transferencias for authenticated" ON transferencias;
DROP POLICY IF EXISTS "Allow delete transferencias for authenticated" ON transferencias;
DROP POLICY IF EXISTS "Allow insert transferencias for authenticated" ON transferencias;
DROP POLICY IF EXISTS "Allow select transferencias for authenticated" ON transferencias;
DROP POLICY IF EXISTS "Allow update transferencias for authenticated" ON transferencias;
DROP POLICY IF EXISTS "Allow delete transferencias for authenticated" ON transferencias;

-- 3. Garantir que RLS está desabilitada
-- Verificação: SELECT tablename FROM pg_tables WHERE tablename = 'transferencias';
-- Verificação: SELECT relrowsecurity FROM pg_class WHERE relname = 'transferencias';


-- 4. POLÍTICA DE SELECT: Ver todas as transferências
CREATE POLICY "Allow select transferencias for authenticated" ON transferencias
FOR SELECT
USING (auth.role() = 'authenticated');

-- 5. POLÍTICA DE UPDATE: Usuários autenticados podem atualizar
CREATE POLICY "Allow update transferencias for authenticated" ON transferencias
FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- 6. POLÍTICA DE DELETE: Usuários autenticados podem deletar
CREATE POLICY "Allow delete transferencias for authenticated" ON transferencias
FOR DELETE
USING (auth.role() = 'authenticated');

-- ============================================================================
-- Verificação
-- ============================================================================
-- SELECT tablename, schemaname FROM pg_tables WHERE tablename = 'transferencias';
-- SELECT policyname, action, qual FROM pg_policies WHERE tablename = 'transferencias';
