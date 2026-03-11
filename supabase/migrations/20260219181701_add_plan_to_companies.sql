/*
  # Add plan relationship to companies table

  1. Changes
    - Add `plan_id` foreign key to companies table
    - Add `additional_attendants` field for extra attendants beyond plan limit
    - Keep `max_attendants` for backward compatibility but will be calculated dynamically
    - Add index for plan_id lookups

  2. Notes
    - The total attendants available = plan.max_attendants + additional_attendants
    - If plan.max_attendants is null (unlimited), then unlimited attendants
    - additional_attendants defaults to 0
*/

-- Add plan_id column to companies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'plan_id'
  ) THEN
    ALTER TABLE companies ADD COLUMN plan_id uuid REFERENCES plans(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add additional_attendants column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'additional_attendants'
  ) THEN
    ALTER TABLE companies ADD COLUMN additional_attendants integer DEFAULT 0 CHECK (additional_attendants >= 0);
  END IF;
END $$;

-- Create index for plan lookups
CREATE INDEX IF NOT EXISTS idx_companies_plan_id ON companies(plan_id);

-- Create a function to get total attendants allowed for a company
CREATE OR REPLACE FUNCTION get_company_max_attendants(company_id uuid)
RETURNS integer AS $$
DECLARE
  plan_max integer;
  additional integer;
BEGIN
  SELECT 
    p.max_attendants,
    c.additional_attendants
  INTO plan_max, additional
  FROM companies c
  LEFT JOIN plans p ON c.plan_id = p.id
  WHERE c.id = company_id;
  
  -- If plan has no limit (null), return null (unlimited)
  IF plan_max IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Otherwise, return plan max + additional
  RETURN plan_max + COALESCE(additional, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if company can add more attendants
CREATE OR REPLACE FUNCTION can_add_attendant(company_id uuid)
RETURNS boolean AS $$
DECLARE
  max_allowed integer;
  current_count integer;
BEGIN
  -- Get the max attendants allowed
  max_allowed := get_company_max_attendants(company_id);
  
  -- If unlimited, always return true
  IF max_allowed IS NULL THEN
    RETURN true;
  END IF;
  
  -- Count current attendants
  SELECT COUNT(*)
  INTO current_count
  FROM attendants
  WHERE attendants.company_id = can_add_attendant.company_id;
  
  -- Return true if under limit
  RETURN current_count < max_allowed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
