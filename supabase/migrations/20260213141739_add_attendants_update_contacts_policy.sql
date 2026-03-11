/*
  # Add UPDATE Policy for Attendants on contacts

  1. Problem
    - Attendants cannot update contacts (department_id, sector_id)
    - Missing UPDATE policy for attendants on contacts table
    - Transfer department functionality fails for attendants

  2. New Policy
    - Allow attendants to update contacts for their company
    - Attendants can update department_id and sector_id fields
    - Validates that the attendant belongs to the company

  3. Security
    - Ensures attendants cannot update contacts from other companies
    - Uses EXISTS check with attendants table to verify ownership
    - Validates both user_id and company_id match
*/

-- Allow attendants to update contacts for their company
CREATE POLICY "Attendants can update company contacts"
  ON contacts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM attendants a
      WHERE a.user_id = auth.uid()
        AND a.company_id = contacts.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM attendants a
      WHERE a.user_id = auth.uid()
        AND a.company_id = contacts.company_id
    )
  );
