/*
  # Auto-assign Reception Department to New Contacts

  1. New Function
    - Create function to automatically assign reception department to contacts
    - Creates "Recepção" department if it doesn't exist for the company
    - Assigns new contacts to reception department automatically

  2. New Trigger
    - Trigger on INSERT for contacts table
    - Automatically assigns contacts to reception department

  3. Business Logic
    - Every new contact enters through the reception department
    - Reception department is created automatically per company
    - Contacts without department are auto-assigned to reception
*/

-- Function to get or create reception department for a company
CREATE OR REPLACE FUNCTION get_or_create_reception_department(p_company_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_department_id UUID;
BEGIN
  -- Try to find existing reception department
  SELECT id INTO v_department_id
  FROM departments
  WHERE company_id = p_company_id
    AND LOWER(name) = 'recepção'
  LIMIT 1;

  -- If not found, create it
  IF v_department_id IS NULL THEN
    INSERT INTO departments (company_id, name, description)
    VALUES (p_company_id, 'Recepção', 'Departamento de recepção - atendimento inicial')
    RETURNING id INTO v_department_id;
  END IF;

  RETURN v_department_id;
END;
$$;

-- Function to auto-assign reception department to contacts
CREATE OR REPLACE FUNCTION auto_assign_reception_department()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reception_dept_id UUID;
BEGIN
  -- Only assign if department_id is NULL
  IF NEW.department_id IS NULL THEN
    -- Get or create reception department for this company
    v_reception_dept_id := get_or_create_reception_department(NEW.company_id);
    
    -- Assign the reception department
    NEW.department_id := v_reception_dept_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for automatic reception department assignment
DROP TRIGGER IF EXISTS trigger_auto_assign_reception_department ON contacts;
CREATE TRIGGER trigger_auto_assign_reception_department
  BEFORE INSERT ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_reception_department();

-- Backfill existing contacts without department to reception
DO $$
DECLARE
  contact_record RECORD;
  reception_dept_id UUID;
BEGIN
  -- Process each contact without a department
  FOR contact_record IN 
    SELECT id, company_id 
    FROM contacts 
    WHERE department_id IS NULL
  LOOP
    -- Get or create reception department for the company
    reception_dept_id := get_or_create_reception_department(contact_record.company_id);
    
    -- Update the contact
    UPDATE contacts
    SET department_id = reception_dept_id
    WHERE id = contact_record.id;
  END LOOP;
END $$;
