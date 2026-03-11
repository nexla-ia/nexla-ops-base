/*
  # Simplify transfer trigger and add debug function

  1. Simplify the trigger to just handle basic inserts
  2. Add a debug function to test manually
*/

-- Simplify the trigger function - remove complex logic
CREATE OR REPLACE FUNCTION handle_contact_transfer()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if department_id changed
  IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
    BEGIN
      -- Simple insert without complex queries
      INSERT INTO messages (
        company_id,
        contact_id,
        message_type,
        apikey_instancia,
        message,
        numero,
        sender,
        minha,
        created_at
      ) VALUES (
        NEW.company_id,
        NEW.id,
        'system_transfer',
        (SELECT api_key FROM companies WHERE id = NEW.company_id LIMIT 1),
        COALESCE(NEW.name, NEW.phone_number) || ' transferido',
        NEW.phone_number,
        'system',
        'true',
        now()
      );
      
      RAISE NOTICE 'Mensagem de transferência criada para contato: %', NEW.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao criar mensagem de transferência: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a test function to manually insert system messages
CREATE OR REPLACE FUNCTION create_test_system_message(
  p_company_id uuid,
  p_contact_id uuid,
  p_message text
)
RETURNS void AS $$
BEGIN
  INSERT INTO messages (
    company_id,
    contact_id,
    message_type,
    apikey_instancia,
    message,
    numero,
    sender,
    minha,
    created_at
  ) VALUES (
    p_company_id,
    p_contact_id,
    'system_transfer',
    (SELECT api_key FROM companies WHERE id = p_company_id LIMIT 1),
    p_message,
    (SELECT phone_number FROM contacts WHERE id = p_contact_id LIMIT 1),
    'system',
    'true',
    now()
  );
  
  RAISE NOTICE 'Mensagem de teste criada!';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
