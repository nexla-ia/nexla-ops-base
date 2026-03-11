/*
  # Fix handle_contact_transfer function with better error handling

  1. Changes
    - Remove EXCEPTION handler to see real errors
    - Add RAISE NOTICE for debugging
    - Ensure all required fields are populated correctly

  2. Why
    - The function was failing silently due to EXCEPTION handler
    - Need to see actual errors to fix them
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

    RAISE NOTICE 'Transfer detected: % from % to %', contact_name, COALESCE(old_dept_name, 'Recepção'), COALESCE(new_dept_name, 'Recepção');
    RAISE NOTICE 'API Key: %', api_key_value;

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

    RAISE NOTICE 'System message created successfully';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
