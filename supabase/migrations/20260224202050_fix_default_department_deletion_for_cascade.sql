-- Migration: Fix Default Department Deletion for Cascade Operations
-- Description: This migration resolves the issue where Super Admins cannot delete companies
-- because the default department (Recepção) deletion is blocked by a trigger.
-- 
-- Changes:
-- 1. Removes the old trigger that completely blocks default department deletion
-- 2. Implements a new smart trigger that:
--    - Allows CASCADE deletions when a company is deleted (by any user including Super Admins)
--    - Blocks direct deletion attempts of default departments by regular admins
--    - Allows Super Admins to delete default departments directly if needed
--
-- This ensures data integrity while enabling proper company cleanup.

-- Step 1: Drop the existing blocking trigger and function
DROP TRIGGER IF EXISTS trigger_prevent_delete_default_department ON departments;
DROP FUNCTION IF EXISTS prevent_delete_default_department();

-- Step 2: Create a new validation function that allows CASCADE operations
CREATE OR REPLACE FUNCTION check_department_deletion_permission()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow deletion if it's part of a CASCADE operation (company being deleted)
  -- Block only if user is trying to delete directly and it's a default department
  IF OLD.is_default = true THEN
    -- Check if the company still exists (if not, it's a CASCADE)
    IF EXISTS (SELECT 1 FROM companies WHERE id = OLD.company_id) THEN
      -- Company exists, so this is a direct deletion attempt
      -- Only allow if user is super admin
      IF NOT EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Não é possível deletar o departamento padrão (Recepção)';
      END IF;
    END IF;
    -- If company doesn't exist, allow (CASCADE)
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create the new trigger
CREATE TRIGGER trigger_check_department_deletion
  BEFORE DELETE ON departments
  FOR EACH ROW
  EXECUTE FUNCTION check_department_deletion_permission();

-- Add comment for documentation
COMMENT ON FUNCTION check_department_deletion_permission() IS 
'Validates department deletion permissions. Allows CASCADE deletions from company removal, blocks direct deletion of default departments by non-super-admins.';