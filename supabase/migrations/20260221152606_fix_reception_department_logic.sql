/*
  # Corrigir Lógica do Departamento Recepção

  1. Mudanças
    - Alterar nome do departamento de "Recepção (Global)" para apenas "Recepção"
    - Adicionar coluna is_default para identificar departamento padrão
    - Impedir deleção do departamento padrão (Recepção)
    - Fazer mensagens novas irem automaticamente para Recepção

  2. Segurança
    - Trigger impede deleção do departamento padrão
    - RLS mantido intacto
*/

-- Adicionar coluna is_default à tabela departments
ALTER TABLE departments 
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Atualizar função que cria departamento automático
CREATE OR REPLACE FUNCTION create_default_reception_department()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserir departamento "Recepção" para a nova empresa
  INSERT INTO departments (company_id, name, is_default)
  VALUES (NEW.id, 'Recepção', true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar departamentos existentes "Recepção (Global)" para "Recepção"
UPDATE departments 
SET name = 'Recepção', is_default = true 
WHERE name = 'Recepção (Global)';

-- Criar função para impedir deleção do departamento padrão
CREATE OR REPLACE FUNCTION prevent_delete_default_department()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_default = true THEN
    RAISE EXCEPTION 'Não é possível deletar o departamento padrão (Recepção)';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para impedir deleção
DROP TRIGGER IF EXISTS trigger_prevent_delete_default_department ON departments;
CREATE TRIGGER trigger_prevent_delete_default_department
  BEFORE DELETE ON departments
  FOR EACH ROW
  EXECUTE FUNCTION prevent_delete_default_department();

-- Atualizar função upsert_contact_from_message para usar departamento Recepção
CREATE OR REPLACE FUNCTION upsert_contact_from_message()
RETURNS TRIGGER AS $$
DECLARE
  v_contact_id uuid;
  v_reception_dept_id uuid;
BEGIN
  -- Buscar o departamento "Recepção" da empresa
  SELECT id INTO v_reception_dept_id
  FROM departments
  WHERE company_id = NEW.company_id
    AND is_default = true
  LIMIT 1;

  -- Fazer upsert do contato
  INSERT INTO contacts (numero, pushname, company_id, department_id)
  VALUES (NEW.numero, NEW.pushname, NEW.company_id, v_reception_dept_id)
  ON CONFLICT (numero, company_id)
  DO UPDATE SET 
    pushname = COALESCE(EXCLUDED.pushname, contacts.pushname),
    last_message_at = now()
  RETURNING id INTO v_contact_id;

  -- Atualizar department_id da mensagem
  NEW.department_id = v_reception_dept_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
