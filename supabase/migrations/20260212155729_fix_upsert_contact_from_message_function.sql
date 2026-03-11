/*
  # Fix upsert_contact_from_message function

  1. Changes
    - Fix ON CONFLICT clause to use (company_id, phone_number) instead of just (phone_number)
    - This matches the actual unique constraint on the contacts table

  2. Why
    - The function was trying to use a constraint that doesn't exist
    - This was preventing system messages from being inserted
*/

CREATE OR REPLACE FUNCTION upsert_contact_from_message()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id uuid;
BEGIN
  -- Get company_id from apikey_instancia
  SELECT id INTO v_company_id
  FROM companies
  WHERE api_key = NEW.apikey_instancia;

  -- Only proceed if company exists
  IF v_company_id IS NOT NULL THEN
    -- Insert or update contact
    INSERT INTO public.contacts (phone_number, name, company_id, last_message, last_message_time, created_at, updated_at)
    VALUES (
      regexp_replace(NEW.numero, '\D', '', 'g'),
      NULLIF(NEW.pushname, ''),
      v_company_id,
      COALESCE(NEW.message, NEW.caption, ''),
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (company_id, phone_number)
    DO UPDATE
    SET
      last_message = EXCLUDED.last_message,
      last_message_time = EXCLUDED.last_message_time,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
