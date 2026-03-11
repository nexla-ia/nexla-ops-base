
/*
  # Fix messages duplicate constraint - retry

  ## Problem
  The unique index ux_messages_company_idmessage causes n8n INSERT failures
  when WhatsApp resends the same webhook (duplicate idmessage).

  ## Solution
  - Remove the unique index
  - Add a BEFORE INSERT trigger to silently skip duplicate messages
*/

DROP INDEX IF EXISTS public.ux_messages_company_idmessage;

CREATE OR REPLACE FUNCTION public.prevent_duplicate_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.idmessage IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.messages
      WHERE apikey_instancia = NEW.apikey_instancia
        AND idmessage = NEW.idmessage
    ) THEN
      RETURN NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_message ON public.messages;

CREATE TRIGGER trg_prevent_duplicate_message
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_message();
