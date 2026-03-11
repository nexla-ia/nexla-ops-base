-- Migration: Fix contact name to be read-only
-- Purpose: Stop the trigger from updating the name field when messages arrive
-- The name field should only be set during initial contact creation, never updated

-- Drop the old trigger
DROP TRIGGER IF EXISTS trigger_upsert_contact_from_message ON messages;
DROP TRIGGER IF EXISTS trigger_upsert_contact_from_sent_message ON sent_messages;

-- Create new function that doesn't update name field
CREATE OR REPLACE FUNCTION upsert_contact_from_message()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Get company_id from the api_key_instancia
  SELECT id INTO v_company_id
  FROM companies
  WHERE api_key = NEW.apikey_instancia
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Upsert contact - but DON'T update name if it already exists
  INSERT INTO contacts (
    company_id,
    phone_number,
    name,
    department_id,
    sector_id,
    tag_id,
    last_message,
    last_message_time,
    updated_at
  )
  VALUES (
    v_company_id,
    NEW.numero,
    COALESCE(NEW.pushname, NEW.numero),
    NEW.department_id,
    NEW.sector_id,
    NEW.tag_id,
    NEW.message,
    COALESCE(NEW.created_at, now()),
    now()
  )
  ON CONFLICT (company_id, phone_number)
  DO UPDATE SET
    -- DON'T update name - keep the existing name (read-only)
    -- name should only be set on initial creation
    department_id = COALESCE(EXCLUDED.department_id, contacts.department_id),
    sector_id = COALESCE(EXCLUDED.sector_id, contacts.sector_id),
    tag_id = COALESCE(EXCLUDED.tag_id, contacts.tag_id),
    last_message = EXCLUDED.last_message,
    last_message_time = EXCLUDED.last_message_time,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers without name update
CREATE TRIGGER trigger_upsert_contact_from_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION upsert_contact_from_message();

CREATE TRIGGER trigger_upsert_contact_from_sent_message
  AFTER INSERT ON sent_messages
  FOR EACH ROW
  EXECUTE FUNCTION upsert_contact_from_message();
