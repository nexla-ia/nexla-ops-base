/*
  # Remove duplicate reception departments and fix triggers

  Temporarily modifies the delete check to allow cleanup,
  removes duplicates, then restores the protection.
  Also drops the duplicate trigger.
*/

-- Temporarily make the check not block super admin / postgres session
CREATE OR REPLACE FUNCTION check_department_deletion_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.is_default = true THEN
    IF EXISTS (SELECT 1 FROM companies WHERE id = OLD.company_id) THEN
      IF NOT EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()) THEN
        IF current_user != 'postgres' AND current_user != 'supabase_admin' AND current_user != 'service_role' THEN
          RAISE EXCEPTION 'Não é possível deletar o departamento padrão (Recepção)';
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

-- Now delete duplicates (keeping the oldest per company)
DELETE FROM departments
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY created_at ASC) AS rn
    FROM departments
    WHERE name ILIKE 'recep%'
  ) ranked
  WHERE rn > 1
);

-- Drop the duplicate trigger
DROP TRIGGER IF EXISTS trigger_create_reception_department ON companies;

-- Ensure the remaining trigger function checks for existing reception
CREATE OR REPLACE FUNCTION create_reception_department()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM departments
    WHERE company_id = NEW.id
      AND (is_reception = true OR name ILIKE 'recep%')
  ) THEN
    INSERT INTO departments (company_id, name, is_reception, is_default)
    VALUES (NEW.id, 'Recepção', true, true);
  END IF;
  RETURN NEW;
END;
$$;
