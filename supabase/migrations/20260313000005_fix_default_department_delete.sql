-- Corrige a proteção do departamento padrão
-- permitindo delete quando a empresa inteira está sendo removida

CREATE OR REPLACE FUNCTION public.prevent_delete_default_department()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN

  -- permite delete durante limpeza da empresa
  IF current_setting('app.deleting_company', true) = 'true' THEN
    RETURN OLD;
  END IF;

  -- bloqueia delete manual do departamento padrão
  IF OLD.is_default = true THEN
    RAISE EXCEPTION 'Não é possível deletar o departamento padrão (Recepção)';
  END IF;

  RETURN OLD;

END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_delete_default_department
ON public.departments;

CREATE TRIGGER trigger_prevent_delete_default_department
BEFORE DELETE ON public.departments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_delete_default_department();
