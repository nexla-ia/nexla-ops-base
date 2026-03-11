/*
  # Adicionar Índice UNIQUE em api_key

  1. Mudanças
    - Cria índice UNIQUE em companies.api_key para evitar duplicação
    - Previne problemas de integridade

  2. Segurança
    - Garante que cada API key é única no sistema
*/

-- Criar índice único na coluna api_key (se não existir)
CREATE UNIQUE INDEX IF NOT EXISTS companies_api_key_unique ON companies(api_key);
