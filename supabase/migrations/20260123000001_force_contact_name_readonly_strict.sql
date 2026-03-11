-- Migration: Force contact name to be completely read-only
-- Purpose: Absolutely prevent any update to the name field
-- This is a stricter version that explicitly excludes name from all updates

-- Drop the old triggers and function
DROP TRIGGER IF EXISTS trigger_upsert_contact_from_message ON messages;
DROP TRIGGER IF EXISTS trigger_upsert_contact_from_sent_message ON sent_messages;
DROP FUNCTION IF EXISTS upsert_contact_from_message();

-- Create new function that is even more explicit about NOT updating name
CREATE FUNCTION upsert_contact_from_message()
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

  -- Only insert if contact doesn't exist, NEVER update any fields
  INSERT INTO contacts (
    company_id,
    phone_number,
    name,
    department_id,
    sector_id,
    tag_id,
    last_message,
    last_message_time,
    created_at,
    updated_at
  )
  VALUES (
    v_company_id,
    NEW.numero,
    COALESCE(NEW.pushname, NEW.numero),
    NULL,
    NULL,
    NULL,
    NEW.message,
    COALESCE(NEW.created_at, now()),
    now(),
    now()
  )
  ON CONFLICT (company_id, phone_number)
  DO UPDATE SET
    -- ONLY update these fields, ABSOLUTELY NO name update
    last_message = EXCLUDED.last_message,
    last_message_time = EXCLUDED.last_message_time,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers
CREATE TRIGGER trigger_upsert_contact_from_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION upsert_contact_from_message();

CREATE TRIGGER trigger_upsert_contact_from_sent_message
  AFTER INSERT ON sent_messages
  FOR EACH ROW
  EXECUTE FUNCTION upsert_contact_from_message();
