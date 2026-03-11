/*
  # Add INSERT Policy for Attendants on transferencias

  1. Problem
    - Attendants cannot insert transfer records
    - Missing INSERT policy for attendants on transferencias table
    - Transfer department functionality fails when trying to log transfer

  2. New Policy
    - Allow attendants to insert transfer records for their company
    - Attendants can log transfers for the company they belong to
    - Validates that the attendant belongs to the company

  3. Security
    - Ensures attendants cannot insert transfers for other companies
    - Uses EXISTS check with attendants table to verify ownership
    - Validates both user_id and company_id match
*/

-- Allow attendants to insert transfer records for their company
CREATE POLICY "Attendants can insert company transfers"
  ON transferencias
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM attendants a
      WHERE a.user_id = auth.uid()
        AND a.company_id = transferencias.company_id
    )
  );
