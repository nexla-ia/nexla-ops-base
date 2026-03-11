/*
  # Criar Trigger Automático para Departamento "Recepção (Global)"

  1. Mudanças
    - Remove criação manual do departamento na Edge Function
    - Cria trigger automático que garante departamento "Recepção (Global)" sempre que uma empresa é criada
    - Garante atomicidade e consistência

  2. Segurança
    - Trigger executa com permissões adequadas
    - Não afeta RLS
*/

-- Criar função que cria departamento automático
CREATE OR REPLACE FUNCTION create_default_reception_department()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserir departamento "Recepção (Global)" para a nova empresa
  INSERT INTO departments (company_id, name)
  VALUES (NEW.id, 'Recepção (Global)');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger que executa após inserir empresa
DROP TRIGGER IF EXISTS trigger_create_reception_department ON companies;
CREATE TRIGGER trigger_create_reception_department
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION create_default_reception_department();
