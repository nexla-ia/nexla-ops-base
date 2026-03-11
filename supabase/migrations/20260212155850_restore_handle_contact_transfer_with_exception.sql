/*
  # Restore handle_contact_transfer with exception handler

  1. Changes
    - Restore EXCEPTION handler for production stability
    - Keep all fixes from debug version
    - System messages now work correctly

  2. Why
    - Exception handler prevents transfer failures if message creation fails
    - All fixes have been applied and tested
*/

CREATE OR REPLACE FUNCTION handle_contact_transfer()
RETURNS TRIGGER AS $$
DECLARE
  old_dept_name text;
  new_dept_name text;
  contact_name text;
  api_key_value text;
BEGIN
  -- Only process if department_id changed
  IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
    -- Wrap in BEGIN/EXCEPTION to prevent blocking the update
    BEGIN
      -- Get old department name
      IF OLD.department_id IS NOT NULL THEN
        SELECT name INTO old_dept_name FROM departments WHERE id = OLD.department_id;
      END IF;

      -- Get new department name
      IF NEW.department_id IS NOT NULL THEN
        SELECT name INTO new_dept_name FROM departments WHERE id = NEW.department_id;
      END IF;

      -- Get contact name (prefer name, fallback to phone)
      contact_name := COALESCE(NEW.name, NEW.phone_number);

      -- Get API key from company
      SELECT api_key INTO api_key_value FROM companies WHERE id = NEW.company_id;

      -- Create simple system message
      INSERT INTO messages (
        company_id,
        contact_id,
        message_type,
        apikey_instancia,
        message,
        numero,
        tipomessage,
        "minha?",
        created_at
      ) VALUES (
        NEW.company_id,
        NEW.id,
        'system_transfer',
        api_key_value,
        'Transferido de ' || COALESCE(old_dept_name, 'Recepção') || ' para ' || COALESCE(new_dept_name, 'Recepção'),
        NEW.phone_number,
        'system',
        'false',
        now()
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log the error but don't block the update
      RAISE WARNING 'Erro ao criar mensagem de transferência: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
