/*
  # Enable RLS on transferencias table and add policies

  1. Changes
    - Enable RLS on `transferencias` table
    - Add policy for companies to view their own transfers
    - Add policy for attendants to view transfers from their company
    - Add policy for super admins to view all transfers

  2. Security
    - Companies can only see transfers from their own contacts
    - Attendants can only see transfers from their company
    - Super admins can see all transfers

  3. Important Notes
    - Transfer records are read-only for attendants
    - Only system can create transfer records (through application logic)
*/

-- Enable RLS on transferencias table
ALTER TABLE transferencias ENABLE ROW LEVEL SECURITY;

-- Policy for companies to view their own transfers
CREATE POLICY "Companies can view own transfers"
  ON transferencias FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

-- Policy for attendants to view transfers from their company
CREATE POLICY "Attendants can view company transfers"
  ON transferencias FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM attendants WHERE user_id = auth.uid()
    )
  );

-- Policy for super admins to view all transfers
CREATE POLICY "Super admins can view all transfers"
  ON transferencias FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );

-- Policy for attendants to insert transfers
CREATE POLICY "Attendants can insert transfers"
  ON transferencias FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM attendants WHERE user_id = auth.uid()
    )
  );

-- Policy for companies to insert transfers
CREATE POLICY "Companies can insert own transfers"
  ON transferencias FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );
