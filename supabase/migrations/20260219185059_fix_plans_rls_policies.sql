/*
  # Fix plans RLS policies for companies access

  1. Changes
    - Add policy for companies to read their own plan (even if inactive)
    - This allows companies to view their plan details in the "Meu Plano" page

  2. Security
    - Companies can only read plans they are associated with
    - All users can still read active plans for comparison
*/

-- Allow companies to read their own plan (even if not active)
CREATE POLICY "Companies can read their own plan"
  ON plans
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.plan_id = plans.id
      AND companies.user_id = auth.uid()
    )
  );
