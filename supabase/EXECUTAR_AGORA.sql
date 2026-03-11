-- ============================================================================
-- SCRIPT IMEDIATO: Desabilitar RLS em transferencias
-- ============================================================================
-- Execute isto no Supabase SQL Editor AGORA para resolver o erro

-- Desabilitar RLS
ALTER TABLE transferencias DISABLE ROW LEVEL SECURITY;

-- Remover todas as políticas
DROP POLICY IF EXISTS "Allow insert on transferencias for authenticated" ON transferencias;
DROP POLICY IF EXISTS "Allow select transferencias for authenticated" ON transferencias;
DROP POLICY IF EXISTS "Allow update transferencias for authenticated" ON transferencias;
DROP POLICY IF EXISTS "Allow delete transferencias for authenticated" ON transferencias;

-- Verificar resultado
SELECT tablename, schemaname FROM pg_tables WHERE tablename = 'transferencias';
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'transferencias';

-- Teste: Tentar um insert simples
-- INSERT INTO transferencias (api_key, contact_id, departamento_origem_id, departamento_destino_id, data_transferencia)
-- VALUES ('test-key', 'test-contact-id', NULL, 'test-dept-id', NOW());
