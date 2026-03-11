/*
  # Fix upsert_contact_from_message: skip own messages and never overwrite contact name

  Changes:
  - If "minha?" = 'true', skip contact upsert entirely (message is from us, not a customer)
  - Never overwrite an existing contact's name (only set name on first insert)
*/

CREATE OR REPLACE FUNCTION public.upsert_contact_from_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id uuid;
  v_contact_id uuid;
  v_reception_dept_id uuid;
  v_phone text;
  v_name text;
BEGIN
  IF NEW."minha?" = 'true' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_company_id
  FROM public.companies
  WHERE api_key = NEW.apikey_instancia;

  IF v_company_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'messages' THEN
    v_phone := COALESCE(NULLIF(NEW.phone_number, ''), NULLIF(NEW.numero, ''));
  ELSE
    v_phone := NULLIF(NEW.numero, '');
  END IF;

  v_name := NULLIF(NEW.pushname, '');

  IF v_phone IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_reception_dept_id
  FROM public.departments
  WHERE company_id = v_company_id AND is_default = true
  LIMIT 1;

  INSERT INTO public.contacts (company_id, phone_number, name, department_id, last_message, last_message_time, updated_at)
  VALUES (
    v_company_id,
    v_phone,
    v_name,
    COALESCE(NEW.department_id, v_reception_dept_id),
    COALESCE(NEW.message, NEW.caption, ''),
    NOW(),
    NOW()
  )
  ON CONFLICT (company_id, phone_number)
  DO UPDATE SET
    last_message = EXCLUDED.last_message,
    last_message_time = EXCLUDED.last_message_time,
    updated_at = NOW()
  RETURNING id INTO v_contact_id;

  IF TG_TABLE_NAME = 'messages' THEN
    IF NEW.contact_id IS NULL THEN
      UPDATE public.messages SET contact_id = v_contact_id WHERE id = NEW.id;
    END IF;

    IF NEW.department_id IS NULL AND v_reception_dept_id IS NOT NULL THEN
      UPDATE public.messages SET department_id = v_reception_dept_id WHERE id = NEW.id;
    END IF;

    IF NEW.company_id IS NULL THEN
      UPDATE public.messages SET company_id = v_company_id WHERE id = NEW.id;
    END IF;

    IF NEW.phone_number IS NULL AND v_phone IS NOT NULL THEN
      UPDATE public.messages SET phone_number = v_phone WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
