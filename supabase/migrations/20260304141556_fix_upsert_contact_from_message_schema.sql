
/*
  # Fix upsert_contact_from_message function

  ## Problem
  The function was created when contacts had columns `numero` and `pushname`.
  The schema was later migrated to use `phone_number` and `name`.

  ## Changes
  - Replace `numero` with `phone_number` (messages.numero → contacts.phone_number)
  - Replace `pushname` with `name` (messages.pushname → contacts.name)
  - Fix ON CONFLICT clause: was `(numero, company_id)`, now `(company_id, phone_number)`
  - Fix last_message update: was `last_message_at` (does not exist), now `last_message_time`
  - Add `last_message` text update from messages.message
  - Add `updated_at` update on upsert
  - Fix trigger: changed from AFTER to BEFORE so NEW.contact_id can be set on the row
  - No other tables or triggers are affected
*/

-- Step 1: Replace the function with corrected schema references
CREATE OR REPLACE FUNCTION public.upsert_contact_from_message()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
DECLARE
  v_contact_id uuid;
  v_reception_dept_id uuid;
  v_phone text;
BEGIN
  -- Determine the phone number from messages.numero (legacy) or messages.phone_number (new)
  v_phone := COALESCE(NEW.phone_number, NEW.numero);

  -- Skip if no phone number or no company
  IF v_phone IS NULL OR NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip system messages that are not from users
  IF NEW.message_type IS NOT NULL AND NEW.message_type NOT IN ('user', 'attendant') THEN
    RETURN NEW;
  END IF;

  -- Find the default (reception) department for this company
  SELECT id INTO v_reception_dept_id
  FROM departments
  WHERE company_id = NEW.company_id
    AND is_default = true
  LIMIT 1;

  -- Upsert the contact using current schema (phone_number, name)
  INSERT INTO contacts (phone_number, name, company_id, department_id, last_message, last_message_time, updated_at)
  VALUES (
    v_phone,
    NEW.pushname,
    NEW.company_id,
    v_reception_dept_id,
    NEW.message,
    now(),
    now()
  )
  ON CONFLICT (company_id, phone_number)
  DO UPDATE SET
    name = COALESCE(EXCLUDED.name, contacts.name),
    last_message = COALESCE(EXCLUDED.last_message, contacts.last_message),
    last_message_time = EXCLUDED.last_message_time,
    updated_at = now()
  RETURNING id INTO v_contact_id;

  -- Write the contact_id back into the message row
  NEW.contact_id := v_contact_id;

  RETURN NEW;
END;
$$;

-- Step 2: Recreate the trigger as BEFORE INSERT so NEW.contact_id can be written
DROP TRIGGER IF EXISTS trigger_upsert_contact_from_message ON messages;

CREATE TRIGGER trigger_upsert_contact_from_message
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION upsert_contact_from_message();
