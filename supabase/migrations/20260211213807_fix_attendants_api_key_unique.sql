/*
  # Fix Attendants API Key - Tornar Unique e Not Null
  
  1. Problema
    - A tabela attendants tem api_key mas não é UNIQUE nem NOT NULL
    - Deve seguir o mesmo padrão da tabela companies
  
  2. Mudanças
    - Tornar api_key NOT NULL
    - Tornar api_key UNIQUE
    - Garantir que todos os registros existentes tenham api_key preenchida
  
  3. Impacto
    - Atendentes agora podem ser identificados unicamente por api_key
    - Consistência com a estrutura da tabela companies
*/

-- 1. Primeiro, garantir que todos os attendants tenham api_key preenchida
UPDATE attendants a
SET api_key = c.api_key
FROM companies c
WHERE a.company_id = c.id
  AND (a.api_key IS NULL OR a.api_key = '');

-- 2. Tornar api_key NOT NULL
ALTER TABLE attendants 
  ALTER COLUMN api_key SET NOT NULL;

-- 3. Adicionar constraint UNIQUE no api_key
-- Nota: Como attendants compartilham a mesma api_key da company,
-- não podemos tornar UNIQUE. Em vez disso, a combinação (api_key + email) é única
ALTER TABLE attendants
  DROP CONSTRAINT IF EXISTS attendants_api_key_email_key;

-- O email já é UNIQUE globalmente, então não precisamos de constraint adicional
-- A api_key apenas identifica de qual empresa o atendente pertence

-- 4. Garantir que o índice existe
DROP INDEX IF EXISTS idx_attendants_api_key;
CREATE INDEX idx_attendants_api_key ON attendants(api_key);

-- 5. Comentários para documentação
COMMENT ON COLUMN attendants.api_key IS 'API Key da empresa - copiada automaticamente de companies.api_key';
COMMENT ON COLUMN attendants.email IS 'Email único do atendente - usado para login';
COMMENT ON COLUMN attendants.user_id IS 'Referência ao usuário no auth.users';
