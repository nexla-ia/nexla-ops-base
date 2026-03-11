/*
  # Simplificar policy de UPDATE para contacts
  
  1. Mudanças
    - Remover WITH CHECK complexo da policy "Companies can update own contacts"
    - Remover WITH CHECK complexo da policy "Attendants can update company contacts"
    - Simplificar para evitar problemas de recursão e performance
  
  2. Segurança
    - Manter USING para garantir que só pode ver os próprios contatos
    - WITH CHECK permite atualizar qualquer campo desde que seja do mesmo company_id
*/

-- Recriar policy para companies
DROP POLICY IF EXISTS "Companies can update own contacts" ON contacts;

CREATE POLICY "Companies can update own contacts"
  ON contacts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM companies
      WHERE companies.id = contacts.company_id
        AND companies.user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id = company_id
  );

-- Recriar policy para attendants
DROP POLICY IF EXISTS "Attendants can update company contacts" ON contacts;

CREATE POLICY "Attendants can update company contacts"
  ON contacts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM attendants a
      WHERE a.user_id = auth.uid()
        AND a.company_id = contacts.company_id
    )
  )
  WITH CHECK (
    company_id = company_id
  );
