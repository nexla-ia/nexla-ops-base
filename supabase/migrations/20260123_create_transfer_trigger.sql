/*
  # Create trigger function for department transfers

  1. Function
    - `handle_contact_transfer` - Detects when a contact changes department
    - Creates a system message with the transfer information
    - Stores old and new department names in the message field

  2. Trigger
    - Fires on UPDATE of contacts table
    - Only when department_id changes
    - Creates a system message visible to the company
*/

-- Create function to handle contact transfer
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
      
      -- Get contact name
      contact_name := COALESCE(NEW.name, NEW.phone_number);
      
      -- Get API key from company
      SELECT api_key INTO api_key FROM companies WHERE id = NEW.company_id;
      
      -- Create system message with all required fields
      INSERT INTO messages (
        company_id,
        contact_id,
        message_type,
        apikey_instancia,
        message,
        pushname,
        numero,
        sender,
        minha,
        created_at
      ) VALUES (
        NEW.company_id,
        NEW.id,
        'system_transfer',
        api_key,
        COALESCE(contact_name, 'Contato') || ' transferido do ' || COALESCE(old_dept_name, 'Sem departamento') || ' para ' || COALESCE(new_dept_name, 'Sem departamento'),
        contact_name,
        NEW.phone_number,
        'system',
        'true',
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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_handle_contact_transfer ON contacts;

-- Create trigger
CREATE TRIGGER trigger_handle_contact_transfer
AFTER UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION handle_contact_transfer();
