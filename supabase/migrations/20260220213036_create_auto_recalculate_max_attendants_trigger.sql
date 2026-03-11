/*
  # Criar Trigger Automático para Recalcular max_attendants

  1. Mudanças
    - Cria trigger que recalcula max_attendants automaticamente quando plan_id ou additional_attendants mudam
    - Garante consistência dos limites

  2. Lógica
    - Se plan_id mudar, busca max_attendants do plano e adiciona additional_attendants
    - Se plan_id for NULL, usa 1 + additional_attendants
    - Se plano tiver max_attendants = 0, considera ilimitado (mantém 0)

  3. Segurança
    - Trigger executa com SECURITY DEFINER para ler tabela plans
*/

-- Criar função que recalcula max_attendants
CREATE OR REPLACE FUNCTION recalculate_max_attendants()
RETURNS TRIGGER AS $$
DECLARE
  plan_max_attendants INTEGER;
BEGIN
  -- Se plan_id ou additional_attendants mudou, recalcula max_attendants
  IF (TG_OP = 'UPDATE' AND (NEW.plan_id IS DISTINCT FROM OLD.plan_id OR NEW.additional_attendants IS DISTINCT FROM OLD.additional_attendants))
     OR TG_OP = 'INSERT' THEN

    IF NEW.plan_id IS NOT NULL THEN
      -- Buscar max_attendants do plano
      SELECT max_attendants INTO plan_max_attendants
      FROM plans
      WHERE id = NEW.plan_id;

      IF plan_max_attendants IS NOT NULL THEN
        -- Se plano tem max_attendants = 0, considera ilimitado
        IF plan_max_attendants = 0 THEN
          NEW.max_attendants := 0;
        ELSE
          -- Caso normal: max_attendants = plano + adicionais
          NEW.max_attendants := plan_max_attendants + COALESCE(NEW.additional_attendants, 0);
        END IF;
      ELSE
        -- Plano não encontrado, usa valor padrão
        NEW.max_attendants := 1 + COALESCE(NEW.additional_attendants, 0);
      END IF;
    ELSE
      -- Sem plano, usa valor padrão
      NEW.max_attendants := 1 + COALESCE(NEW.additional_attendants, 0);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger que executa antes de inserir/atualizar empresa
DROP TRIGGER IF EXISTS trigger_recalculate_max_attendants ON companies;
CREATE TRIGGER trigger_recalculate_max_attendants
  BEFORE INSERT OR UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_max_attendants();
