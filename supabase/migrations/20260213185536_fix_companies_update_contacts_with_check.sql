/*
  # Fix Companies UPDATE Policy on Contacts

  1. Problem
    - Companies cannot update contacts (pinned, ia_ativada fields)
    - UPDATE policy missing WITH CHECK clause
    - Only USING clause is not enough for UPDATE operations

  2. Solution
    - Add WITH CHECK clause to "Companies can update own contacts" policy
    - Ensures companies can both read and write to their contacts
    - Maintains security by validating company ownership

  3. Security
    - Companies can only update their own contacts
    - Validates user_id matches company owner
    - No cross-company data leaks
*/

-- Fix companies UPDATE policy on contacts with WITH CHECK clause
DROP POLICY IF EXISTS "Companies can update own contacts" ON contacts;
CREATE POLICY "Companies can update own contacts" ON contacts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = contacts.company_id
      AND companies.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.id = contacts.company_id
      AND companies.user_id = (select auth.uid())
    )
  );
