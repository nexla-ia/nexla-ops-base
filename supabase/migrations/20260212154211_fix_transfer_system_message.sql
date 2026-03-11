/*
  # Fix Transfer System Message

  1. Changes
    - Update trigger function to create simpler transfer messages
    - Fix 'minha?' field to be 'false' (not sent by company)
    - Simplify message format to: "Transferido de [Dept] para [Dept]"
*/

CREATE OR REPLACE FUNCTION handle_contact_transfer()
RETURNS TRIGGER AS $$
DECLARE
  old_dept_name text;
  new_dept_name text;
  contact_name text;
  api_key text;
BEGIN
  -- Only process if department_id changed
  IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
    -- Wrap in BEGIN/EXCEPTION to prevent blocking the update
    BEGIN
      -- Get old department name
      SELECT name INTO old_dept_name FROM departments WHERE id = OLD.department_id;

      -- Get new department name
      SELECT name INTO new_dept_name FROM departments WHERE id = NEW.department_id;

      -- Get contact name (prefer name, fallback to phone)
      contact_name := COALESCE(NEW.name, NEW.phone_number);

      -- Get API key from company
      SELECT api_key INTO api_key FROM companies WHERE id = NEW.company_id;

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
        api_key,
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